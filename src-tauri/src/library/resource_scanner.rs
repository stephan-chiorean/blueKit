use sea_orm::{DatabaseConnection, EntityTrait, ColumnTrait, QueryFilter, Set, ActiveModelTrait};
use std::path::{Path, PathBuf};
use std::fs;
use chrono::Utc;
use tracing::{info, warn, debug};

use crate::db::entities::library_resource;
use super::utils::{compute_content_hash, infer_artifact_type};

/// Result of scanning a single resource file.
#[derive(Debug)]
pub struct ScanResult {
    pub resources_created: usize,
    pub resources_updated: usize,
    pub resources_deleted: usize,
}

/// Scans a project's .bluekit directory and syncs resources to database.
///
/// This function:
/// 1. Walks the .bluekit directory to find all artifact files
/// 2. For each file, checks if resource exists in DB (by project_id + relative_path)
/// 3. Creates new resource if not found
/// 4. Updates existing resource if content hash changed
/// 5. Marks resources as deleted if file no longer exists
///
/// Returns statistics about the scan operation.
pub async fn scan_project_resources(
    db: &DatabaseConnection,
    project_id: &str,
    project_path: &Path,
) -> Result<ScanResult, String> {
    let mut result = ScanResult {
        resources_created: 0,
        resources_updated: 0,
        resources_deleted: 0,
    };

    let bluekit_path = project_path.join(".bluekit");
    if !bluekit_path.exists() {
        info!("No .bluekit directory found at {}", project_path.display());
        return Ok(result);
    }

    // Collect all artifact files
    let mut artifact_files = Vec::new();
    collect_artifact_files(&bluekit_path, project_path, &mut artifact_files)?;

    info!("Found {} artifact files in {}", artifact_files.len(), project_path.display());

    // Track which resources we've seen in this scan
    let mut seen_resource_paths = std::collections::HashSet::new();

    // Process each file
    for (relative_path, absolute_path) in artifact_files {
        seen_resource_paths.insert(relative_path.clone());

        match process_artifact_file(
            db,
            project_id,
            &relative_path,
            &absolute_path,
            &mut result,
        ).await {
            Ok(_) => {},
            Err(e) => {
                warn!("Failed to process {}: {}", relative_path, e);
            }
        }
    }

    // Mark unseen resources as deleted (soft delete)
    let existing_resources = library_resource::Entity::find()
        .filter(library_resource::Column::ProjectId.eq(project_id))
        .filter(library_resource::Column::IsDeleted.eq(0))
        .all(db)
        .await
        .map_err(|e| format!("Failed to query existing resources: {}", e))?;

    for resource in existing_resources {
        if !seen_resource_paths.contains(&resource.relative_path) {
            let mut active_model: library_resource::ActiveModel = resource.into();
            active_model.is_deleted = Set(1);
            active_model.updated_at = Set(Utc::now().timestamp());

            active_model.update(db).await
                .map_err(|e| format!("Failed to mark resource as deleted: {}", e))?;

            result.resources_deleted += 1;
        }
    }

    Ok(result)
}

/// Collects all artifact files from .bluekit directory.
fn collect_artifact_files(
    bluekit_path: &Path,
    project_root: &Path,
    results: &mut Vec<(String, PathBuf)>, // (relative_path, absolute_path)
) -> Result<(), String> {
    let subdirs = ["kits", "walkthroughs", "agents", "diagrams", "tasks"];

    for subdir in subdirs {
        let dir_path = bluekit_path.join(subdir);
        if dir_path.exists() {
            walk_directory(&dir_path, project_root, results)?;
        }
    }

    Ok(())
}

/// Recursively walks a directory collecting artifact files.
fn walk_directory(
    dir: &Path,
    project_root: &Path,
    results: &mut Vec<(String, PathBuf)>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            walk_directory(&path, project_root, results)?;
        } else if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_str().unwrap_or("");
                if matches!(ext_str, "md" | "mmd" | "mermaid") {
                    let relative_path = path.strip_prefix(project_root)
                        .map_err(|e| format!("Failed to compute relative path: {}", e))?
                        .to_string_lossy()
                        .to_string();

                    results.push((relative_path, path));
                }
            }
        }
    }

    Ok(())
}

/// Processes a single artifact file: create or update resource record.
///
/// Returns the resource ID.
async fn process_artifact_file(
    db: &DatabaseConnection,
    project_id: &str,
    relative_path: &str,
    absolute_path: &Path,
    result: &mut ScanResult,
) -> Result<String, String> {
    // Read file content
    let content = fs::read_to_string(absolute_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Compute content hash
    let content_hash = compute_content_hash(&content);

    // Extract YAML front matter
    let yaml_metadata = extract_yaml_metadata(&content);

    // Get file metadata
    let file_name = absolute_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?
        .to_string();

    let artifact_type = infer_artifact_type(relative_path);

    let metadata = fs::metadata(absolute_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let last_modified_at = metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let now = Utc::now().timestamp();

    // Check if resource already exists
    let existing = library_resource::Entity::find()
        .filter(library_resource::Column::ProjectId.eq(project_id))
        .filter(library_resource::Column::RelativePath.eq(relative_path))
        .one(db)
        .await
        .map_err(|e| format!("Failed to query resource: {}", e))?;

    if let Some(resource) = existing {
        // Update if hash changed
        if resource.content_hash.as_deref() != Some(&content_hash) {
            let mut active_model: library_resource::ActiveModel = resource.clone().into();
            active_model.content_hash = Set(Some(content_hash));
            active_model.yaml_metadata = Set(yaml_metadata);
            active_model.file_name = Set(file_name);
            active_model.artifact_type = Set(artifact_type);
            active_model.updated_at = Set(now);
            active_model.last_modified_at = Set(last_modified_at);
            active_model.is_deleted = Set(0); // Un-delete if file reappeared

            active_model.update(db).await
                .map_err(|e| format!("Failed to update resource: {}", e))?;

            debug!("Updated resource: {}", relative_path);
            result.resources_updated += 1;
        }

        Ok(resource.id)
    } else {
        // Create new resource
        let resource_id = uuid::Uuid::new_v4().to_string();

        let new_resource = library_resource::ActiveModel {
            id: Set(resource_id.clone()),
            project_id: Set(project_id.to_string()),
            relative_path: Set(relative_path.to_string()),
            file_name: Set(file_name),
            artifact_type: Set(artifact_type),
            content_hash: Set(Some(content_hash)),
            yaml_metadata: Set(yaml_metadata),
            created_at: Set(now),
            updated_at: Set(now),
            last_modified_at: Set(last_modified_at),
            is_deleted: Set(0),
        };

        library_resource::Entity::insert(new_resource)
            .exec(db)
            .await
            .map_err(|e| format!("Failed to create resource: {}", e))?;

        info!("Created new resource: {}", relative_path);
        result.resources_created += 1;

        Ok(resource_id)
    }
}

/// Extracts and JSON-serializes YAML front matter.
fn extract_yaml_metadata(content: &str) -> Option<String> {
    // Reuse parse_front_matter logic from commands.rs
    if !content.trim_start().starts_with("---") {
        return None;
    }

    let start_pos = content.find("---")?;
    let after_first_delim = start_pos + 3;

    if let Some(end_pos) = content[after_first_delim..].find("\n---") {
        let front_matter_str = content[after_first_delim..after_first_delim + end_pos].trim();

        if front_matter_str.is_empty() {
            return None;
        }

        // Parse YAML and re-serialize to JSON for storage
        let yaml_value: serde_yaml::Value = serde_yaml::from_str(front_matter_str).ok()?;
        serde_json::to_string(&yaml_value).ok()
    } else {
        None
    }
}
