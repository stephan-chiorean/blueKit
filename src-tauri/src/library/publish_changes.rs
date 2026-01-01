use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::db::entities::*;
use crate::integrations::github::GitHubClient;

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryChange {
    #[serde(rename = "type")]
    pub change_type: String,
    pub folder_name: Option<String>,
    pub folder_id: Option<String>,
    pub catalog_id: Option<String>,
    pub catalog_name: Option<String>,
    pub old_folder_id: Option<String>,
    pub old_folder_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublishChangesResult {
    pub folders_created: u32,
    pub folders_deleted: u32,
    pub catalogs_moved: u32,
    pub catalogs_removed_from_folders: u32,
    pub catalogs_deleted: u32,
    pub errors: Vec<String>,
}

/// Publishes library changes to GitHub.
pub async fn publish_library_changes(
    db: &DatabaseConnection,
    workspace_id: &str,
    changes: Vec<LibraryChange>,
) -> Result<PublishChangesResult, String> {
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

    // Get authenticated user info for commit messages
    let user_info = github_client
        .get_user()
        .await
        .map_err(|e| format!("Failed to get GitHub user: {}", e))?;

    let mut result = PublishChangesResult {
        folders_created: 0,
        folders_deleted: 0,
        catalogs_moved: 0,
        catalogs_removed_from_folders: 0,
        catalogs_deleted: 0,
        errors: Vec::new(),
    };

    // Process each change
    for change in changes {
        match change.change_type.as_str() {
            "folder_created" => {
                if let Some(folder_name) = change.folder_name {
                    match create_folder_marker(&github_client, &workspace, &folder_name, &user_info.login).await {
                        Ok(_) => result.folders_created += 1,
                        Err(e) => result.errors.push(format!("Failed to create folder '{}': {}", folder_name, e)),
                    }
                }
            }
            "folder_deleted" => {
                if let Some(folder_name) = change.folder_name {
                    match delete_folder_marker(&github_client, &workspace, &folder_name, &user_info.login).await {
                        Ok(_) => result.folders_deleted += 1,
                        Err(e) => result.errors.push(format!("Failed to delete folder '{}': {}", folder_name, e)),
                    }
                }
            }
            "catalog_moved_to_folder" => {
                if let Some(catalog_id) = change.catalog_id {
                    if let Some(folder_name) = change.folder_name {
                        match move_catalog_to_folder(
                            db,
                            &github_client,
                            &workspace,
                            &catalog_id,
                            &folder_name,
                            &user_info.login,
                            now,
                        )
                        .await
                        {
                            Ok(_) => result.catalogs_moved += 1,
                            Err(e) => result.errors.push(format!("Failed to move catalog '{}': {}", catalog_id, e)),
                        }
                    }
                }
            }
            "catalog_removed_from_folder" => {
                if let Some(catalog_id) = change.catalog_id {
                    match move_catalog_to_root(
                        db,
                        &github_client,
                        &workspace,
                        &catalog_id,
                        &user_info.login,
                        now,
                    )
                    .await
                    {
                        Ok(_) => result.catalogs_removed_from_folders += 1,
                        Err(e) => result.errors.push(format!("Failed to remove catalog '{}' from folder: {}", catalog_id, e)),
                    }
                }
            }
            "catalog_deleted" => {
                if let Some(catalog_id) = change.catalog_id {
                    // Catalog deletion is already handled by delete_catalogs command
                    // We just track it here for the result
                    result.catalogs_deleted += 1;
                }
            }
            _ => {
                result.errors.push(format!("Unknown change type: {}", change.change_type));
            }
        }
    }

    Ok(result)
}

/// Create a folder marker file (.bluekitws) in GitHub.
async fn create_folder_marker(
    github_client: &GitHubClient,
    workspace: &library_workspace::Model,
    folder_name: &str,
    user_login: &str,
) -> Result<(), String> {
    // Sanitize folder name
    let sanitized_name = folder_name
        .trim()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    if sanitized_name.is_empty() {
        return Err("Folder name cannot be empty after sanitization".to_string());
    }

    let folder_path = format!("{}/.bluekitws", sanitized_name);

    // Check if folder already exists
    match github_client
        .get_file_sha(&workspace.github_owner, &workspace.github_repo, &folder_path)
        .await
    {
        Ok(Some(_)) => {
            // Folder already exists, that's fine
            return Ok(());
        }
        Ok(None) => {
            // Folder doesn't exist, create it
        }
        Err(e) => {
            return Err(format!("Failed to check folder existence: {}", e));
        }
    }

    // Create the marker file
    let content = format!("# BlueKit Workspace Folder: {}\n", sanitized_name);
    let commit_message = format!(
        "[BlueKit] Create folder: {} by {}",
        sanitized_name, user_login
    );

    github_client
        .create_or_update_file(
            &workspace.github_owner,
            &workspace.github_repo,
            &folder_path,
            &content,
            &commit_message,
            None,
        )
        .await
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(())
}

/// Delete a folder marker file (.bluekitws) from GitHub.
async fn delete_folder_marker(
    github_client: &GitHubClient,
    workspace: &library_workspace::Model,
    folder_name: &str,
    user_login: &str,
) -> Result<(), String> {
    // Sanitize folder name
    let sanitized_name = folder_name
        .trim()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    let folder_path = format!("{}/.bluekitws", sanitized_name);

    // Get file SHA
    let sha = match github_client
        .get_file_sha(&workspace.github_owner, &workspace.github_repo, &folder_path)
        .await
    {
        Ok(Some(s)) => s,
        Ok(None) => {
            // File doesn't exist, that's fine
            return Ok(());
        }
        Err(e) => {
            return Err(format!("Failed to get folder SHA: {}", e));
        }
    };

    // Delete the marker file
    let commit_message = format!(
        "[BlueKit] Delete folder: {} by {}",
        sanitized_name, user_login
    );

    github_client
        .delete_file(
            &workspace.github_owner,
            &workspace.github_repo,
            &folder_path,
            &commit_message,
            &sha,
        )
        .await
        .map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

/// Move a catalog's files to a folder in GitHub.
async fn move_catalog_to_folder(
    db: &DatabaseConnection,
    github_client: &GitHubClient,
    workspace: &library_workspace::Model,
    catalog_id: &str,
    folder_name: &str,
    user_login: &str,
    now: i64,
) -> Result<(), String> {
    // Get the catalog
    let catalog = library_catalog::Entity::find_by_id(catalog_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Catalog not found: {}", catalog_id))?;

    // Get all variations for this catalog
    let variations = library_variation::Entity::find()
        .filter(library_variation::Column::CatalogId.eq(catalog_id))
        .all(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if variations.is_empty() {
        return Err("Catalog has no variations to move".to_string());
    }

    // Sanitize folder name
    let sanitized_folder = folder_name
        .trim()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    // Extract artifact type and filename from current remote_path
    // e.g., "kits/auth.md" -> artifact_type: "kits", filename: "auth.md"
    // or "ui-components/kits/auth.md" -> artifact_type: "kits", filename: "auth.md"
    let current_path = &catalog.remote_path;
    let path_parts: Vec<&str> = current_path.split('/').collect();
    
    // Find artifact type directory (kits, walkthroughs, agents, diagrams)
    let artifact_types = vec!["kits", "walkthroughs", "agents", "diagrams"];
    let mut artifact_type_idx = None;
    for (idx, part) in path_parts.iter().enumerate() {
        if artifact_types.contains(part) {
            artifact_type_idx = Some(idx);
            break;
        }
    }

    let (artifact_type, filename) = if let Some(idx) = artifact_type_idx {
        let artifact_type = path_parts[idx].to_string();
        let filename = ToString::to_string(path_parts.last().ok_or("Invalid path")?);
        (artifact_type, filename)
    } else {
        return Err(format!("Could not determine artifact type from path: {}", current_path));
    };

    // Move each variation file
    for variation in &variations {
        // Use variation's remote_path to get the actual file location
        let variation_path = &variation.remote_path;
        let variation_parts: Vec<&str> = variation_path.split('/').collect();
        
        // Find artifact type in variation path (might be different from catalog path)
        let artifact_types = vec!["kits", "walkthroughs", "agents", "diagrams"];
        let mut variation_artifact_type = None;
        for part in &variation_parts {
            if artifact_types.contains(part) {
                variation_artifact_type = Some(*part);
                break;
            }
        }
        
        // Use the artifact type from variation, or fall back to catalog's artifact type
        let final_artifact_type = variation_artifact_type.unwrap_or(&artifact_type);
        
        // Extract filename from variation path (last part)
        let variation_filename = variation_parts.last().ok_or("Invalid variation path")?;
        
        // Construct new path for this variation: {folder_name}/{artifact_type}/{filename}
        let variation_new_path = format!("{}/{}/{}", sanitized_folder, final_artifact_type, variation_filename);

        // Get current file content and SHA
        let current_sha = match github_client
            .get_file_sha(&workspace.github_owner, &workspace.github_repo, variation_path)
            .await
        {
            Ok(Some(sha)) => sha,
            Ok(None) => {
                // File doesn't exist, skip
                eprintln!("Warning: Variation file not found in GitHub: {}", variation_path);
                continue;
            }
            Err(e) => {
                return Err(format!("Failed to get file SHA for {}: {}", variation_path, e));
            }
        };

        // Read file content
        let content = github_client
            .get_file_contents(&workspace.github_owner, &workspace.github_repo, variation_path)
            .await
            .map_err(|e| format!("Failed to read file {}: {}", variation_path, e))?;

        // Delete old file
        let delete_message = format!(
            "[BlueKit] Move catalog to folder: {} → {} by {}",
            catalog.name, sanitized_folder, user_login
        );
        github_client
            .delete_file(
                &workspace.github_owner,
                &workspace.github_repo,
                variation_path,
                &delete_message,
                &current_sha,
            )
            .await
            .map_err(|e| format!("Failed to delete old file {}: {}", variation_path, e))?;

        // Create new file
        let create_message = format!(
            "[BlueKit] Move catalog to folder: {} → {} by {}",
            catalog.name, sanitized_folder, user_login
        );
        let response = github_client
            .create_or_update_file(
                &workspace.github_owner,
                &workspace.github_repo,
                &variation_new_path,
                &content,
                &create_message,
                None,
            )
            .await
            .map_err(|e| format!("Failed to create new file {}: {}", variation_new_path, e))?;

        // Update variation in database
        let mut active_model: library_variation::ActiveModel = variation.clone().into();
        active_model.remote_path = Set(variation_new_path.clone());
        active_model.github_commit_sha = Set(Some(response.commit.sha.clone()));
        active_model.updated_at = Set(now);
        active_model
            .update(db)
            .await
            .map_err(|e| format!("Failed to update variation: {}", e))?;
    }

    // Update catalog remote_path - use the first variation's new path as the catalog path
    if let Some(first_variation) = variations.first() {
        // Get the new path from the first variation we processed
        let first_variation_parts: Vec<&str> = first_variation.remote_path.split('/').collect();
        let artifact_types = vec!["kits", "walkthroughs", "agents", "diagrams"];
        let mut first_artifact_type: &str = &artifact_type;
        for part in &first_variation_parts {
            if artifact_types.contains(part) {
                first_artifact_type = part;
                break;
            }
        }
        let first_filename = first_variation_parts.last().map(|s| *s).unwrap_or(&filename);
        let catalog_new_path = format!("{}/{}/{}", sanitized_folder, first_artifact_type, first_filename);
        
        let mut catalog_model: library_catalog::ActiveModel = catalog.into();
        catalog_model.remote_path = Set(catalog_new_path);
        catalog_model.updated_at = Set(now);
        catalog_model
            .update(db)
            .await
            .map_err(|e| format!("Failed to update catalog: {}", e))?;
    }

    Ok(())
}

/// Move a catalog's files from a folder to root in GitHub.
async fn move_catalog_to_root(
    db: &DatabaseConnection,
    github_client: &GitHubClient,
    workspace: &library_workspace::Model,
    catalog_id: &str,
    user_login: &str,
    now: i64,
) -> Result<(), String> {
    // Get the catalog
    let catalog = library_catalog::Entity::find_by_id(catalog_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Catalog not found: {}", catalog_id))?;

    // Get all variations for this catalog
    let variations = library_variation::Entity::find()
        .filter(library_variation::Column::CatalogId.eq(catalog_id))
        .all(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if variations.is_empty() {
        return Err("Catalog has no variations to move".to_string());
    }

    // Extract artifact type and filename from current remote_path
    // e.g., "ui-components/kits/auth.md" -> artifact_type: "kits", filename: "auth.md"
    let current_path = &catalog.remote_path;
    let path_parts: Vec<&str> = current_path.split('/').collect();
    
    // Find artifact type directory
    let artifact_types = vec!["kits", "walkthroughs", "agents", "diagrams"];
    let mut artifact_type_idx = None;
    for (idx, part) in path_parts.iter().enumerate() {
        if artifact_types.contains(part) {
            artifact_type_idx = Some(idx);
            break;
        }
    }

    let (artifact_type, filename) = if let Some(idx) = artifact_type_idx {
        let artifact_type = path_parts[idx].to_string();
        let filename = ToString::to_string(path_parts.last().ok_or("Invalid path")?);
        (artifact_type, filename)
    } else {
        return Err(format!("Could not determine artifact type from path: {}", current_path));
    };

    // New path: {artifact_type}/{filename}
    let new_remote_path = format!("{}/{}", artifact_type, filename);

    // Move each variation file
    for variation in &variations {
        // Use variation's remote_path to get the actual file location
        let variation_path = &variation.remote_path;
        let variation_parts: Vec<&str> = variation_path.split('/').collect();
        
        // Find artifact type in variation path
        let mut variation_artifact_type_idx = None;
        for (idx, part) in variation_parts.iter().enumerate() {
            if artifact_types.contains(part) {
                variation_artifact_type_idx = Some(idx);
                break;
            }
        }
        
        // Extract filename from variation path
        let variation_filename = variation_parts.last().ok_or("Invalid variation path")?;
        
        // Construct new path for this variation (root level)
        let variation_new_path = if let Some(_) = variation_artifact_type_idx {
            format!("{}/{}", artifact_type, variation_filename)
        } else {
            // Fallback: use catalog's artifact type
            format!("{}/{}", artifact_type, variation_filename)
        };

        // Get current file content and SHA
        let current_sha = match github_client
            .get_file_sha(&workspace.github_owner, &workspace.github_repo, variation_path)
            .await
        {
            Ok(Some(sha)) => sha,
            Ok(None) => {
                // File doesn't exist, skip
                eprintln!("Warning: Variation file not found in GitHub: {}", variation_path);
                continue;
            }
            Err(e) => {
                return Err(format!("Failed to get file SHA for {}: {}", variation_path, e));
            }
        };

        // Read file content
        let content = github_client
            .get_file_contents(&workspace.github_owner, &workspace.github_repo, variation_path)
            .await
            .map_err(|e| format!("Failed to read file {}: {}", variation_path, e))?;

        // Delete old file
        let delete_message = format!(
            "[BlueKit] Remove catalog from folder: {} by {}",
            catalog.name, user_login
        );
        github_client
            .delete_file(
                &workspace.github_owner,
                &workspace.github_repo,
                variation_path,
                &delete_message,
                &current_sha,
            )
            .await
            .map_err(|e| format!("Failed to delete old file {}: {}", variation_path, e))?;

        // Create new file
        let create_message = format!(
            "[BlueKit] Remove catalog from folder: {} by {}",
            catalog.name, user_login
        );
        let response = github_client
            .create_or_update_file(
                &workspace.github_owner,
                &workspace.github_repo,
                &variation_new_path,
                &content,
                &create_message,
                None,
            )
            .await
            .map_err(|e| format!("Failed to create new file {}: {}", variation_new_path, e))?;

        // Update variation in database
        let mut active_model: library_variation::ActiveModel = variation.clone().into();
        active_model.remote_path = Set(variation_new_path.clone());
        active_model.github_commit_sha = Set(Some(response.commit.sha.clone()));
        active_model.updated_at = Set(now);
        active_model
            .update(db)
            .await
            .map_err(|e| format!("Failed to update variation: {}", e))?;
    }

    // Update catalog remote_path - use the first variation's new path as the catalog path
    if let Some(first_variation) = variations.first() {
        // Get the new path from the first variation we processed
        let first_variation_parts: Vec<&str> = first_variation.remote_path.split('/').collect();
        let artifact_types = vec!["kits", "walkthroughs", "agents", "diagrams"];
        let mut first_artifact_type: &str = &artifact_type;
        for part in &first_variation_parts {
            if artifact_types.contains(part) {
                first_artifact_type = part;
                break;
            }
        }
        let first_filename = first_variation_parts.last().map(|s| *s).unwrap_or(&filename);
        let catalog_new_path = format!("{}/{}", first_artifact_type, first_filename);
        
        let mut catalog_model: library_catalog::ActiveModel = catalog.into();
        catalog_model.remote_path = Set(catalog_new_path);
        catalog_model.updated_at = Set(now);
        catalog_model
            .update(db)
            .await
            .map_err(|e| format!("Failed to update catalog: {}", e))?;
    }

    Ok(())
}

