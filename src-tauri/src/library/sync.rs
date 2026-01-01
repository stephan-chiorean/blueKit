use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::db::entities::*;
use crate::integrations::github::GitHubClient;
use super::utils::compute_content_hash;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub catalogs_created: u32,
    pub catalogs_updated: u32,
    pub variations_created: u32,
    pub variations_updated: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogWithVariations {
    pub catalog: library_catalog::Model,
    pub variations: Vec<library_variation::Model>,
}

/// Sync workspace catalog from GitHub by scanning known artifact directories.
pub async fn sync_workspace_catalog(
    db: &DatabaseConnection,
    workspace_id: &str,
) -> Result<SyncResult, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Get the workspace
    let workspace = library_workspace::Entity::find_by_id(workspace_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Workspace not found: {}", workspace_id))?;

    // Get GitHub client
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("Failed to get GitHub client: {}", e))?;

    let mut stats = SyncResult {
        catalogs_created: 0,
        catalogs_updated: 0,
        variations_created: 0,
        variations_updated: 0,
    };

    // Artifact type directories to scan (optimization - type comes from YAML)
    let artifact_dirs = vec![
        ".bluekit/kits",
        ".bluekit/walkthroughs",
        ".bluekit/agents",
        ".bluekit/diagrams",
    ];

    for dir_path in artifact_dirs {
        // For each directory, we'll need to list files
        // Using get_tree with main branch would work, but we need a simpler approach
        // For now, we'll use a recursive listing approach based on get_file_contents

        match sync_directory(
            db,
            &github_client,
            &workspace,
            dir_path,
            now,
            &mut stats,
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                // Log error but continue with other directories
                eprintln!("Failed to sync directory {}: {}", dir_path, e);
            }
        }
    }

    Ok(stats)
}

/// Sync a single directory by attempting to get its contents.
/// Artifact type is determined from YAML front matter, not directory location.
async fn sync_directory(
    db: &DatabaseConnection,
    github_client: &GitHubClient,
    workspace: &library_workspace::Model,
    dir_path: &str,
    now: i64,
    stats: &mut SyncResult,
) -> Result<(), String> {
    // GitHub contents API endpoint for directory
    // When called on a directory, it returns an array of items
    // We'll use the low-level request method to get directory listings

    let endpoint = format!("/repos/{}/{}/contents/{}", workspace.github_owner, workspace.github_repo, dir_path);

    // Try to get directory contents as a vector of content items
    // This is a workaround since get_file_contents only handles files
    let dir_items: Vec<DirectoryItem> = match github_client.request_raw("GET", endpoint, None).await {
        Ok(items) => items,
        Err(e) => {
            if e.contains("404") {
                // Directory doesn't exist, skip
                return Ok(());
            }
            return Err(e);
        }
    };

    // Process each file in the directory
    for item in dir_items {
        // Only process markdown files
        if item.item_type != "file" || !item.name.ends_with(".md") {
            continue;
        }

        // Get file contents
        let content = github_client
            .get_file_contents(&workspace.github_owner, &workspace.github_repo, &item.path)
            .await?;

        // Calculate content hash
        let content_hash = compute_content_hash(&content);

        // Extract metadata from YAML front matter
        let (name, description, tags, artifact_type) = extract_metadata_from_content(&content);

        // YAML type field is required
        let artifact_type = artifact_type.ok_or_else(|| {
            format!(
                "Missing 'type' field in YAML front matter for file: {}. All library artifacts must have a 'type' field (e.g., kit, walkthrough, agent, diagram).",
                item.path
            )
        })?;

        // Check if catalog exists for this remote path
        let remote_path = item.path.clone();
        let existing_catalog = library_catalog::Entity::find()
            .filter(library_catalog::Column::WorkspaceId.eq(workspace.id.as_str()))
            .filter(library_catalog::Column::RemotePath.eq(&remote_path))
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        let catalog_id = match existing_catalog {
            Some(catalog) => {
                stats.catalogs_updated += 1;
                catalog.id
            }
            None => {
                // Create new catalog
                let new_catalog_id = Uuid::new_v4().to_string();
                let new_catalog = library_catalog::ActiveModel {
                    id: Set(new_catalog_id.clone()),
                    workspace_id: Set(workspace.id.clone()),
                    name: Set(name.clone()),
                    description: Set(description.clone()),
                    artifact_type: Set(artifact_type),
                    tags: Set(tags.clone()),
                    remote_path: Set(remote_path.clone()),
                    created_at: Set(now),
                    updated_at: Set(now),
                };

                new_catalog
                    .insert(db)
                    .await
                    .map_err(|e| format!("Failed to create catalog: {}", e))?;

                stats.catalogs_created += 1;
                new_catalog_id
            }
        };

        // Check if a variation with this content hash already exists
        let existing_variation = library_variation::Entity::find()
            .filter(library_variation::Column::CatalogId.eq(&catalog_id))
            .filter(library_variation::Column::ContentHash.eq(&content_hash))
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if existing_variation.is_none() {
            // Create new variation
            let new_variation_id = Uuid::new_v4().to_string();
            let new_variation = library_variation::ActiveModel {
                id: Set(new_variation_id),
                catalog_id: Set(catalog_id),
                workspace_id: Set(workspace.id.clone()),
                remote_path: Set(remote_path),
                content_hash: Set(content_hash),
                github_commit_sha: Set(Some(item.sha.clone())),
                published_at: Set(now),
                publisher_name: Set(None), // We don't know who published it from directory listing
                version_tag: Set(None),
                created_at: Set(now),
                updated_at: Set(now),
            };

            new_variation
                .insert(db)
                .await
                .map_err(|e| format!("Failed to create variation: {}", e))?;

            stats.variations_created += 1;
        }
    }

    Ok(())
}

/// List workspace catalogs with their variations.
pub async fn list_workspace_catalogs(
    db: &DatabaseConnection,
    workspace_id: &str,
    artifact_type: Option<String>,
) -> Result<Vec<CatalogWithVariations>, String> {
    // Build query
    let mut query = library_catalog::Entity::find()
        .filter(library_catalog::Column::WorkspaceId.eq(workspace_id));

    if let Some(atype) = artifact_type {
        query = query.filter(library_catalog::Column::ArtifactType.eq(atype));
    }

    let catalogs = query
        .all(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    // For each catalog, get its variations
    let mut results = Vec::new();
    for catalog in catalogs {
        let variations = library_variation::Entity::find()
            .filter(library_variation::Column::CatalogId.eq(&catalog.id))
            .order_by_desc(library_variation::Column::PublishedAt)
            .all(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        results.push(CatalogWithVariations {
            catalog,
            variations,
        });
    }

    Ok(results)
}

/// Helper struct for GitHub directory listing items.
#[derive(Debug, Serialize, Deserialize)]
struct DirectoryItem {
    name: String,
    path: String,
    sha: String,
    #[serde(rename = "type")]
    item_type: String,
}

/// Delete catalogs and their variations from both database and GitHub.
/// This removes the catalog files from the repository and deletes all associated variations.
pub async fn delete_catalogs(
    db: &DatabaseConnection,
    catalog_ids: Vec<String>,
) -> Result<u32, String> {
    if catalog_ids.is_empty() {
        return Ok(0);
    }

    // Get GitHub client
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("Failed to get GitHub client: {}", e))?;

    // Get authenticated user info for commit message
    let user_info = github_client
        .get_user()
        .await
        .map_err(|e| format!("Failed to get GitHub user: {}", e))?;

    let mut deleted_count = 0;

    // Process each catalog
    for catalog_id in catalog_ids {
        // Get the catalog with its workspace
        let catalog = library_catalog::Entity::find_by_id(&catalog_id)
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("Catalog not found: {}", catalog_id))?;

        let workspace = library_workspace::Entity::find_by_id(&catalog.workspace_id)
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("Workspace not found: {}", catalog.workspace_id))?;

        // Get all variations for this catalog to get their file SHAs
        let variations = library_variation::Entity::find()
            .filter(library_variation::Column::CatalogId.eq(&catalog_id))
            .all(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        // Delete the file from GitHub (use the latest variation's SHA if available)
        // If multiple variations exist, we'll delete using the most recent one's SHA
        let mut github_deletion_attempted = false;
        if let Some(latest_variation) = variations.iter().max_by_key(|v| v.published_at) {
            if let Some(sha) = &latest_variation.github_commit_sha {
                github_deletion_attempted = true;
                // Try to get current file SHA (in case it was updated)
                let current_sha = match github_client
                    .get_file_sha(&workspace.github_owner, &workspace.github_repo, &catalog.remote_path)
                    .await
                {
                    Ok(Some(sha)) => sha,
                    Ok(None) => {
                        // File doesn't exist in GitHub, that's fine
                        sha.clone()
                    }
                    Err(_) => {
                        // Error getting SHA, use the one from variation
                        sha.clone()
                    }
                };

                // Delete the file from GitHub
                let commit_message = format!(
                    "[BlueKit] Delete catalog: {} by {}",
                    catalog.name,
                    user_info.login
                );

                // Try to delete from GitHub (ignore errors if file doesn't exist)
                if let Err(e) = github_client
                    .delete_file(
                        &workspace.github_owner,
                        &workspace.github_repo,
                        &catalog.remote_path,
                        &commit_message,
                        &current_sha,
                    )
                    .await
                {
                    // Log error but continue - file might already be deleted or SHA might be outdated
                    // Database deletion will still proceed
                    eprintln!("Warning: Failed to delete file from GitHub (continuing with DB deletion): {}", e);
                }
            }
        }
        
        if !github_deletion_attempted {
            // No variations with SHA, but still try to delete the file if it exists
            match github_client
                .get_file_sha(&workspace.github_owner, &workspace.github_repo, &catalog.remote_path)
                .await
            {
                Ok(Some(sha)) => {
                    let commit_message = format!(
                        "[BlueKit] Delete catalog: {} by {}",
                        catalog.name,
                        user_info.login
                    );

                    if let Err(e) = github_client
                        .delete_file(
                            &workspace.github_owner,
                            &workspace.github_repo,
                            &catalog.remote_path,
                            &commit_message,
                            &sha,
                        )
                        .await
                    {
                        eprintln!("Warning: Failed to delete file from GitHub (continuing with DB deletion): {}", e);
                    }
                }
                Ok(None) => {
                    // File doesn't exist, that's fine
                }
                Err(e) => {
                    // Error checking file, log but continue
                    eprintln!("Warning: Failed to check if file exists in GitHub (continuing with DB deletion): {}", e);
                }
            }
        }

        // Delete the catalog from database (variations will be cascade deleted)
        library_catalog::Entity::delete_by_id(&catalog_id)
            .exec(db)
            .await
            .map_err(|e| format!("Failed to delete catalog: {}", e))?;

        deleted_count += 1;
    }

    Ok(deleted_count)
}

/// Extract metadata from markdown content (YAML front matter).
/// Returns: (name, description, tags, artifact_type)
fn extract_metadata_from_content(content: &str) -> (String, Option<String>, Option<String>, Option<String>) {
    // Parse YAML front matter
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() || lines[0] != "---" {
        return ("Untitled".to_string(), None, None, None);
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
        return ("Untitled".to_string(), None, None, None);
    }

    // Extract YAML content
    let yaml_content = lines[1..yaml_end].join("\n");

    // Parse YAML using serde_yaml
    if let Ok(yaml_value) = serde_yaml::from_str::<serde_yaml::Value>(&yaml_content) {
        let name = yaml_value.get("alias")
            .or_else(|| yaml_value.get("name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Untitled".to_string());

        let description = yaml_value.get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let tags = yaml_value.get("tags")
            .and_then(|v| serde_json::to_string(v).ok());

        let artifact_type = yaml_value.get("type")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        (name, description, tags, artifact_type)
    } else {
        ("Untitled".to_string(), None, None, None)
    }
}
