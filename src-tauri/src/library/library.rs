/// Library workspace management module.
/// 
/// This module handles Library workspaces, which are GitHub repositories
/// used for publishing and syncing kits, walkthroughs, and other artifacts.

use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait, Set, Update};
use serde::{Deserialize, Serialize};
use crate::db::entities::{library_workspace, library_artifact};
use crate::integrations::github::GitHubClient;
use chrono::Utc;

/// Library workspace structure.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryWorkspace {
    pub id: String,
    pub name: String,
    pub github_owner: String,
    pub github_repo: String,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Library artifact structure.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryArtifact {
    pub id: String,
    pub workspace_id: String,
    pub local_path: String,
    pub library_path: String,
    pub artifact_type: String,
    pub published_at: i64,
    pub last_synced_at: i64,
}

/// Creates a new Library workspace and the associated GitHub repository.
pub async fn create_workspace(
    db: &DatabaseConnection,
    name: String,
    github_owner: String,
    github_repo: String,
) -> Result<LibraryWorkspace, String> {
    // Get GitHub client
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    // Create the GitHub repository
    let description = format!("BlueKit library workspace: {}", name);
    github_client.create_repo(&github_repo, Some(&description), false)
        .await
        .map_err(|e| {
            // Check if repo already exists (422 error usually means name conflict)
            if e.contains("422") || e.contains("already exists") || e.contains("name already exists") {
                format!("Repository '{}' already exists. Use a different name or use the existing repository.", github_repo)
            } else {
                format!("Failed to create GitHub repository: {}", e)
            }
        })?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    let workspace = library_workspace::ActiveModel {
        id: Set(id.clone()),
        name: Set(name.clone()),
        github_owner: Set(github_owner.clone()),
        github_repo: Set(github_repo.clone()),
        pinned: Set(0), // Default to not pinned
        created_at: Set(now),
        updated_at: Set(now),
    };

    library_workspace::Entity::insert(workspace)
        .exec(db)
        .await
        .map_err(|e| format!("Failed to create workspace: {}", e))?;

    Ok(LibraryWorkspace {
        id,
        name,
        github_owner,
        github_repo,
        pinned: false,
        created_at: now,
        updated_at: now,
    })
}

/// Lists all Library workspaces.
/// Sorts pinned workspaces first, then by name.
pub async fn list_workspaces(
    db: &DatabaseConnection,
) -> Result<Vec<LibraryWorkspace>, String> {
    let workspaces = library_workspace::Entity::find()
        .all(db)
        .await
        .map_err(|e| format!("Failed to list workspaces: {}", e))?;

    let mut result: Vec<LibraryWorkspace> = workspaces
        .into_iter()
        .map(|w| LibraryWorkspace {
            id: w.id,
            name: w.name,
            github_owner: w.github_owner,
            github_repo: w.github_repo,
            pinned: w.pinned != 0,
            created_at: w.created_at,
            updated_at: w.updated_at,
        })
        .collect();

    // Sort: pinned first, then by name
    result.sort_by(|a, b| {
        match (a.pinned, b.pinned) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(result)
}

/// Gets a Library workspace by ID.
pub async fn get_workspace(
    db: &DatabaseConnection,
    workspace_id: String,
) -> Result<LibraryWorkspace, String> {
    let workspace = library_workspace::Entity::find_by_id(workspace_id.clone())
        .one(db)
        .await
        .map_err(|e| format!("Failed to get workspace: {}", e))?
        .ok_or_else(|| format!("Workspace not found: {}", workspace_id))?;

    Ok(LibraryWorkspace {
        id: workspace.id,
        name: workspace.name,
        github_owner: workspace.github_owner,
        github_repo: workspace.github_repo,
        pinned: workspace.pinned != 0,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
    })
}

/// Deletes a Library workspace.
pub async fn delete_workspace(
    db: &DatabaseConnection,
    workspace_id: String,
) -> Result<(), String> {
    library_workspace::Entity::delete_by_id(workspace_id.clone())
        .exec(db)
        .await
        .map_err(|e| format!("Failed to delete workspace: {}", e))?;

    Ok(())
}

/// Updates a workspace name.
pub async fn update_workspace_name(
    db: &DatabaseConnection,
    workspace_id: String,
    name: String,
) -> Result<LibraryWorkspace, String> {
    let workspace = library_workspace::Entity::find_by_id(workspace_id.clone())
        .one(db)
        .await
        .map_err(|e| format!("Failed to find workspace: {}", e))?
        .ok_or_else(|| format!("Workspace not found: {}", workspace_id))?;

    let now = Utc::now().timestamp();
    let mut workspace: library_workspace::ActiveModel = workspace.into();
    workspace.name = Set(name.clone());
    workspace.updated_at = Set(now);

    let updated = library_workspace::Entity::update(workspace)
        .exec(db)
        .await
        .map_err(|e| format!("Failed to update workspace: {}", e))?;

    Ok(LibraryWorkspace {
        id: updated.id,
        name: updated.name,
        github_owner: updated.github_owner,
        github_repo: updated.github_repo,
        pinned: updated.pinned != 0,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
    })
}

/// Sets the pinned state of a workspace.
/// When pinning a workspace, unpins any previously pinned workspace (only one can be pinned at a time).
pub async fn set_workspace_pinned(
    db: &DatabaseConnection,
    workspace_id: String,
    pinned: bool,
) -> Result<LibraryWorkspace, String> {
    // If pinning, first unpin any currently pinned workspace
    if pinned {
        let pinned_workspaces = library_workspace::Entity::find()
            .filter(library_workspace::Column::Pinned.eq(1))
            .all(db)
            .await
            .map_err(|e| format!("Failed to find pinned workspaces: {}", e))?;

        for mut workspace in pinned_workspaces {
            // Skip the workspace we're about to pin
            if workspace.id != workspace_id {
                let mut active_model: library_workspace::ActiveModel = workspace.into();
                active_model.pinned = Set(0);
                active_model.updated_at = Set(Utc::now().timestamp());
                library_workspace::Entity::update(active_model)
                    .exec(db)
                    .await
                    .map_err(|e| format!("Failed to unpin workspace: {}", e))?;
            }
        }
    }

    // Update the target workspace
    let workspace = library_workspace::Entity::find_by_id(workspace_id.clone())
        .one(db)
        .await
        .map_err(|e| format!("Failed to find workspace: {}", e))?
        .ok_or_else(|| format!("Workspace not found: {}", workspace_id))?;

    let now = Utc::now().timestamp();
    let mut workspace: library_workspace::ActiveModel = workspace.into();
    workspace.pinned = Set(if pinned { 1 } else { 0 });
    workspace.updated_at = Set(now);

    let updated = library_workspace::Entity::update(workspace)
        .exec(db)
        .await
        .map_err(|e| format!("Failed to update workspace: {}", e))?;

    Ok(LibraryWorkspace {
        id: updated.id,
        name: updated.name,
        github_owner: updated.github_owner,
        github_repo: updated.github_repo,
        pinned: updated.pinned != 0,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
    })
}

/// Lists all artifacts in a workspace (or all workspaces if None).
pub async fn list_artifacts(
    db: &DatabaseConnection,
    workspace_id: Option<String>,
) -> Result<Vec<LibraryArtifact>, String> {
    let mut query = library_artifact::Entity::find();

    if let Some(ws_id) = workspace_id {
        query = query.filter(library_artifact::Column::WorkspaceId.eq(ws_id));
    }

    let artifacts = query
        .all(db)
        .await
        .map_err(|e| format!("Failed to list artifacts: {}", e))?;

    Ok(artifacts
        .into_iter()
        .map(|a| LibraryArtifact {
            id: a.id,
            workspace_id: a.workspace_id,
            local_path: a.local_path,
            library_path: a.library_path,
            artifact_type: a.artifact_type,
            published_at: a.published_at,
            last_synced_at: a.last_synced_at,
        })
        .collect())
}
