use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::db::entities::*;
use crate::integrations::github::GitHubClient;
use super::utils::compute_content_hash;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum PublishResult {
    NoCatalogExists {
        resource_id: String,
        suggested_catalog_name: String,
        suggested_remote_path: String,
    },
    CatalogExists {
        catalog_id: String,
        catalog_name: String,
        variations: Vec<VariationInfo>,
    },
    Published {
        catalog_id: String,
        variation_id: String,
        github_commit_sha: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VariationInfo {
    pub id: String,
    pub content_hash: String,
    pub published_at: i64,
    pub publisher_name: Option<String>,
    pub version_tag: Option<String>,
    pub github_commit_sha: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublishOptions {
    pub resource_id: String,
    pub workspace_id: String,
    pub overwrite_variation_id: Option<String>,
    pub version_tag: Option<String>,
}

/// Check if a resource can be published and return its status.
/// This doesn't publish anything, just checks what would happen.
pub async fn check_publish_status(
    db: &DatabaseConnection,
    resource_id: &str,
    workspace_id: &str,
) -> Result<PublishResult, String> {
    // Get the resource
    let resource = library_resource::Entity::find_by_id(resource_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Resource not found: {}", resource_id))?;

    // Get the workspace
    let workspace = library_workspace::Entity::find_by_id(workspace_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Workspace not found: {}", workspace_id))?;

    // Determine remote path based on artifact type and file name
    let remote_path = determine_remote_path(&resource.artifact_type, &resource.file_name);

    // Check if a catalog exists for this remote path in this workspace
    let existing_catalog = library_catalog::Entity::find()
        .filter(library_catalog::Column::WorkspaceId.eq(workspace_id))
        .filter(library_catalog::Column::RemotePath.eq(&remote_path))
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    match existing_catalog {
        None => {
            // No catalog exists yet
            let suggested_name = extract_name_from_filename(&resource.file_name);
            Ok(PublishResult::NoCatalogExists {
                resource_id: resource_id.to_string(),
                suggested_catalog_name: suggested_name,
                suggested_remote_path: remote_path,
            })
        }
        Some(catalog) => {
            // Catalog exists, get all variations
            let variations = library_variation::Entity::find()
                .filter(library_variation::Column::CatalogId.eq(&catalog.id))
                .order_by_desc(library_variation::Column::PublishedAt)
                .all(db)
                .await
                .map_err(|e| format!("Database error: {}", e))?;

            let variation_infos: Vec<VariationInfo> = variations
                .into_iter()
                .map(|v| VariationInfo {
                    id: v.id,
                    content_hash: v.content_hash,
                    published_at: v.published_at,
                    publisher_name: v.publisher_name,
                    version_tag: v.version_tag,
                    github_commit_sha: v.github_commit_sha,
                })
                .collect();

            Ok(PublishResult::CatalogExists {
                catalog_id: catalog.id,
                catalog_name: catalog.name,
                variations: variation_infos,
            })
        }
    }
}

/// Actually publish a resource to a workspace.
pub async fn publish_resource(
    db: &DatabaseConnection,
    options: PublishOptions,
) -> Result<PublishResult, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Get the resource
    let resource = library_resource::Entity::find_by_id(&options.resource_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Resource not found: {}", options.resource_id))?;

    // Get the project to construct full path
    let project = project::Entity::find_by_id(&resource.project_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Project not found: {}", resource.project_id))?;

    // Read file content
    let full_path = Path::new(&project.path).join(&resource.relative_path);
    let content = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Calculate content hash and verify it matches
    let content_hash = compute_content_hash(&content);
    if resource.content_hash.as_ref() != Some(&content_hash) {
        return Err("Resource content hash mismatch. Re-scan resources first.".to_string());
    }

    // Get the workspace
    let workspace = library_workspace::Entity::find_by_id(&options.workspace_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Workspace not found: {}", options.workspace_id))?;

    // Get GitHub client
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("Failed to get GitHub client: {}", e))?;

    // Get authenticated user info for publisher name
    let user_info = github_client
        .get_user()
        .await
        .map_err(|e| format!("Failed to get GitHub user: {}", e))?;

    // Determine remote path
    let remote_path = determine_remote_path(&resource.artifact_type, &resource.file_name);

    // Push to GitHub
    let file_sha = github_client
        .get_file_sha(&workspace.github_owner, &workspace.github_repo, &remote_path)
        .await
        .map_err(|e| format!("Failed to check file existence: {}", e))?;

    let commit_message = format!(
        "[BlueKit] Publish: {} by {}",
        extract_name_from_filename(&resource.file_name),
        user_info.login
    );

    let github_response = github_client
        .create_or_update_file(
            &workspace.github_owner,
            &workspace.github_repo,
            &remote_path,
            &content,
            &commit_message,
            file_sha.as_deref(),
        )
        .await
        .map_err(|e| format!("Failed to push to GitHub: {}", e))?;

    // Get commit SHA from response
    let commit_sha = github_response.commit.sha.clone();

    // Get or create catalog
    let catalog = library_catalog::Entity::find()
        .filter(library_catalog::Column::WorkspaceId.eq(&options.workspace_id))
        .filter(library_catalog::Column::RemotePath.eq(&remote_path))
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let catalog_id = match catalog {
        Some(existing) => existing.id,
        None => {
            // Create new catalog
            let new_catalog_id = Uuid::new_v4().to_string();

            // Extract metadata from YAML
            let (name, description, tags) = extract_metadata_from_yaml(&resource.yaml_metadata);

            let new_catalog = library_catalog::ActiveModel {
                id: Set(new_catalog_id.clone()),
                workspace_id: Set(options.workspace_id.clone()),
                name: Set(name),
                description: Set(description),
                artifact_type: Set(resource.artifact_type.clone()),
                tags: Set(tags),
                remote_path: Set(remote_path.clone()),
                created_at: Set(now),
                updated_at: Set(now),
            };

            new_catalog
                .insert(db)
                .await
                .map_err(|e| format!("Failed to create catalog: {}", e))?;

            new_catalog_id
        }
    };

    // Create or update variation
    let variation_id = if let Some(overwrite_id) = options.overwrite_variation_id {
        // Update existing variation
        let existing = library_variation::Entity::find_by_id(&overwrite_id)
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("Variation not found: {}", overwrite_id))?;

        let mut active_model: library_variation::ActiveModel = existing.into();
        active_model.content_hash = Set(content_hash);
        active_model.github_commit_sha = Set(Some(commit_sha.clone()));
        active_model.published_at = Set(now);
        active_model.publisher_name = Set(Some(user_info.login.clone()));
        active_model.version_tag = Set(options.version_tag.clone());
        active_model.updated_at = Set(now);

        active_model
            .update(db)
            .await
            .map_err(|e| format!("Failed to update variation: {}", e))?;

        overwrite_id
    } else {
        // Create new variation
        let new_variation_id = Uuid::new_v4().to_string();

        let new_variation = library_variation::ActiveModel {
            id: Set(new_variation_id.clone()),
            catalog_id: Set(catalog_id.clone()),
            workspace_id: Set(options.workspace_id.clone()),
            remote_path: Set(remote_path),
            content_hash: Set(content_hash),
            github_commit_sha: Set(Some(commit_sha.clone())),
            published_at: Set(now),
            publisher_name: Set(Some(user_info.login)),
            version_tag: Set(options.version_tag),
            created_at: Set(now),
            updated_at: Set(now),
        };

        new_variation
            .insert(db)
            .await
            .map_err(|e| format!("Failed to create variation: {}", e))?;

        new_variation_id
    };

    Ok(PublishResult::Published {
        catalog_id,
        variation_id,
        github_commit_sha: commit_sha,
    })
}

/// Determine the remote path in GitHub based on artifact type and filename.
fn determine_remote_path(artifact_type: &str, file_name: &str) -> String {
    match artifact_type {
        "kit" => format!("kits/{}", file_name),
        "walkthrough" => format!("walkthroughs/{}", file_name),
        "agent" => format!("agents/{}", file_name),
        "diagram" => format!("diagrams/{}", file_name),
        _ => format!("other/{}", file_name),
    }
}

/// Extract a display name from a filename (remove extension, convert dashes/underscores to spaces).
fn extract_name_from_filename(file_name: &str) -> String {
    let without_ext = file_name
        .strip_suffix(".md")
        .or_else(|| file_name.strip_suffix(".mmd"))
        .or_else(|| file_name.strip_suffix(".mermaid"))
        .unwrap_or(file_name);

    without_ext
        .replace("-", " ")
        .replace("_", " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Extract metadata (name, description, tags) from YAML metadata JSON string.
fn extract_metadata_from_yaml(yaml_metadata: &Option<String>) -> (String, Option<String>, Option<String>) {
    if let Some(yaml_str) = yaml_metadata {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(yaml_str) {
            let name = json.get("alias")
                .or_else(|| json.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let description = json.get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let tags = json.get("tags")
                .and_then(|v| serde_json::to_string(v).ok());

            return (
                name.unwrap_or_else(|| "Untitled".to_string()),
                description,
                tags,
            );
        }
    }

    ("Untitled".to_string(), None, None)
}
