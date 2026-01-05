use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::db::entities::*;
use crate::integrations::github::GitHubClient;
use super::utils::compute_content_hash;

#[derive(Debug, Serialize, Deserialize)]
pub struct PullOptions {
    pub variation_id: String,
    pub target_project_id: String,
    pub target_project_path: String,
    pub overwrite_if_exists: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PullResult {
    pub resource_id: String,
    pub subscription_id: String,
    pub file_path: String,
    pub content_hash: String,
}

/// Pull a variation to a local project.
pub async fn pull_variation(
    db: &DatabaseConnection,
    options: PullOptions,
) -> Result<PullResult, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Get the variation
    let variation = library_variation::Entity::find_by_id(&options.variation_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Variation not found: {}", options.variation_id))?;

    // Get the catalog
    let catalog = library_catalog::Entity::find_by_id(&variation.catalog_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Catalog not found: {}", variation.catalog_id))?;

    // Get the workspace
    let workspace = library_workspace::Entity::find_by_id(&variation.workspace_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Workspace not found: {}", variation.workspace_id))?;

    // Get GitHub client
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("Failed to get GitHub client: {}", e))?;

    // Fetch content from GitHub
    let content = github_client
        .get_file_contents(&workspace.github_owner, &workspace.github_repo, &variation.remote_path)
        .await
        .map_err(|e| format!("Failed to fetch file from GitHub: {}", e))?;

    // Verify content hash
    let content_hash = compute_content_hash(&content);
    if content_hash != variation.content_hash {
        return Err("Content hash mismatch. The file in GitHub has changed.".to_string());
    }

    // Determine local file path based on artifact type from YAML front matter
    let file_name = variation.remote_path
        .split('/')
        .last()
        .ok_or_else(|| format!("Invalid remote path: {}", variation.remote_path))?;

    // Extract artifact type from YAML front matter (more reliable than catalog.artifact_type)
    let artifact_type = extract_artifact_type_from_content(&content)
        .unwrap_or_else(|| catalog.artifact_type.clone());

    let relative_path = determine_local_path(&artifact_type, file_name);
    let full_path = Path::new(&options.target_project_path).join(&relative_path);

    // Check if file already exists
    if full_path.exists() && !options.overwrite_if_exists {
        return Err(format!(
            "File already exists: {}. Set overwrite_if_exists to true to replace it.",
            relative_path
        ));
    }

    // Ensure parent directory exists
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Write file to disk
    std::fs::write(&full_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Create or update resource record
    let existing_resource = library_resource::Entity::find()
        .filter(library_resource::Column::ProjectId.eq(&options.target_project_id))
        .filter(library_resource::Column::RelativePath.eq(&relative_path))
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let resource_id = match existing_resource {
        Some(existing) => {
            // Update existing resource
            let mut active_model: library_resource::ActiveModel = existing.into();
            active_model.content_hash = Set(Some(content_hash.clone()));
            active_model.updated_at = Set(now);
            active_model.is_deleted = Set(0);

            let updated = active_model
                .update(db)
                .await
                .map_err(|e| format!("Failed to update resource: {}", e))?;

            updated.id
        }
        None => {
            // Create new resource
            let new_resource_id = Uuid::new_v4().to_string();

            // Extract YAML metadata from content
            let yaml_metadata = extract_yaml_metadata(&content);

            let new_resource = library_resource::ActiveModel {
                id: Set(new_resource_id.clone()),
                project_id: Set(options.target_project_id.clone()),
                relative_path: Set(relative_path.clone()),
                file_name: Set(file_name.to_string()),
                artifact_type: Set(catalog.artifact_type.clone()),
                content_hash: Set(Some(content_hash.clone())),
                yaml_metadata: Set(yaml_metadata),
                created_at: Set(now),
                updated_at: Set(now),
                last_modified_at: Set(Some(now)),
                is_deleted: Set(0),
            };

            new_resource
                .insert(db)
                .await
                .map_err(|e| format!("Failed to create resource: {}", e))?;

            new_resource_id
        }
    };

    // Create or update subscription record
    let existing_subscription = library_subscription::Entity::find()
        .filter(library_subscription::Column::ResourceId.eq(&resource_id))
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let subscription_id = match existing_subscription {
        Some(existing) => {
            // Update existing subscription
            let mut active_model: library_subscription::ActiveModel = existing.into();
            active_model.catalog_id = Set(catalog.id.clone());
            active_model.variation_id = Set(variation.id.clone());
            active_model.pulled_at = Set(now);
            active_model.last_checked_at = Set(Some(now));
            active_model.updated_at = Set(now);

            let updated = active_model
                .update(db)
                .await
                .map_err(|e| format!("Failed to update subscription: {}", e))?;

            updated.id
        }
        None => {
            // Create new subscription
            let new_subscription_id = Uuid::new_v4().to_string();

            let new_subscription = library_subscription::ActiveModel {
                id: Set(new_subscription_id.clone()),
                catalog_id: Set(catalog.id),
                variation_id: Set(variation.id),
                resource_id: Set(resource_id.clone()),
                project_id: Set(options.target_project_id),
                pulled_at: Set(now),
                last_checked_at: Set(Some(now)),
                created_at: Set(now),
                updated_at: Set(now),
            };

            new_subscription
                .insert(db)
                .await
                .map_err(|e| format!("Failed to create subscription: {}", e))?;

            new_subscription_id
        }
    };

    Ok(PullResult {
        resource_id,
        subscription_id,
        file_path: relative_path,
        content_hash,
    })
}

/// Determine local file path based on artifact type.
fn determine_local_path(artifact_type: &str, file_name: &str) -> String {
    match artifact_type {
        "kit" => format!(".bluekit/kits/{}", file_name),
        "walkthrough" => format!(".bluekit/walkthroughs/{}", file_name),
        "agent" => format!(".bluekit/agents/{}", file_name),
        "diagram" => format!(".bluekit/diagrams/{}", file_name),
        _ => format!(".bluekit/other/{}", file_name),
    }
}

/// Extract YAML metadata from markdown content and serialize to JSON.
fn extract_yaml_metadata(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() || lines[0] != "---" {
        return None;
    }

    // Find the closing ---
    let mut yaml_end = 0;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            yaml_end = i;
            break;
        }
    }

    if yaml_end == 0 {
        return None;
    }

    // Extract YAML content
    let yaml_content = lines[1..yaml_end].join("\n");

    // Parse YAML and convert to JSON
    if let Ok(yaml_value) = serde_yaml::from_str::<serde_yaml::Value>(&yaml_content) {
        serde_json::to_string(&yaml_value).ok()
    } else {
        None
    }
}

/// Extract artifact type from markdown content's YAML front matter.
/// Returns the value of the 'type' field if present (e.g., "kit", "walkthrough").
fn extract_artifact_type_from_content(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() || lines[0] != "---" {
        return None;
    }

    // Find the closing ---
    let mut yaml_end = 0;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            yaml_end = i;
            break;
        }
    }

    if yaml_end == 0 {
        return None;
    }

    // Extract YAML content
    let yaml_content = lines[1..yaml_end].join("\n");

    // Parse YAML and extract type field
    if let Ok(yaml_value) = serde_yaml::from_str::<serde_yaml::Value>(&yaml_content) {
        yaml_value.get("type")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    }
}
