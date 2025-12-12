/// Library workspace management module.
/// 
/// This module handles Library workspaces, which are GitHub repositories
/// used for publishing and syncing kits, walkthroughs, and other artifacts.

use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait, Set};
use serde::{Deserialize, Serialize};
use crate::db::entities::{library_workspace, library_artifact};
use chrono::Utc;

/// Library workspace structure.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryWorkspace {
    pub id: String,
    pub name: String,
    pub github_owner: String,
    pub github_repo: String,
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

/// Creates a new Library workspace.
pub async fn create_workspace(
    db: &DatabaseConnection,
    name: String,
    github_owner: String,
    github_repo: String,
) -> Result<LibraryWorkspace, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    let workspace = library_workspace::ActiveModel {
        id: Set(id.clone()),
        name: Set(name.clone()),
        github_owner: Set(github_owner.clone()),
        github_repo: Set(github_repo.clone()),
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
        created_at: now,
        updated_at: now,
    })
}

/// Lists all Library workspaces.
pub async fn list_workspaces(
    db: &DatabaseConnection,
) -> Result<Vec<LibraryWorkspace>, String> {
    let workspaces = library_workspace::Entity::find()
        .all(db)
        .await
        .map_err(|e| format!("Failed to list workspaces: {}", e))?;

    Ok(workspaces
        .into_iter()
        .map(|w| LibraryWorkspace {
            id: w.id,
            name: w.name,
            github_owner: w.github_owner,
            github_repo: w.github_repo,
            created_at: w.created_at,
            updated_at: w.updated_at,
        })
        .collect())
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
