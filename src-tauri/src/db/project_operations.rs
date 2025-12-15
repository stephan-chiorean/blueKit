use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use crate::db::entities::{project, checkpoint};

#[derive(Serialize, Deserialize)]
struct LegacyProjectEntry {
    id: String,
    title: String,
    description: String,
    path: String,
}

#[derive(Serialize, Deserialize)]
struct LegacyCloneMetadata {
    id: String,
    name: String,
    description: String,
    #[serde(rename = "gitUrl")]
    git_url: String,
    #[serde(rename = "gitCommit")]
    git_commit: String,
    #[serde(rename = "gitBranch")]
    git_branch: Option<String>,
    #[serde(rename = "gitTag")]
    git_tag: Option<String>,
    tags: Vec<String>,
    #[serde(rename = "createdAt")]
    created_at: String, // ISO 8601 string
}

#[derive(Serialize)]
pub struct MigrationSummary {
    pub projects_migrated: usize,
    pub checkpoints_migrated: usize,
    pub errors: Vec<String>,
    pub backup_path: Option<String>,
}

pub async fn migrate_json_to_database(
    db: &DatabaseConnection,
) -> Result<MigrationSummary, DbErr> {
    let mut summary = MigrationSummary {
        projects_migrated: 0,
        checkpoints_migrated: 0,
        errors: vec![],
        backup_path: None,
    };

    let now = Utc::now().timestamp_millis();

    // 1. Migrate projectRegistry.json
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| DbErr::Custom("Could not find home directory".to_string()))?;

    let registry_path = PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json");

    if !registry_path.exists() {
        return Ok(summary); // Nothing to migrate
    }

    // Backup original file
    let backup_path = registry_path.with_extension("json.backup");
    fs::copy(&registry_path, &backup_path)
        .map_err(|e| DbErr::Custom(format!("Backup failed: {}", e)))?;
    summary.backup_path = Some(backup_path.display().to_string());

    // Read and parse
    let content = fs::read_to_string(&registry_path)
        .map_err(|e| DbErr::Custom(format!("Failed to read registry: {}", e)))?;

    let legacy_projects: Vec<LegacyProjectEntry> = serde_json::from_str(&content)
        .map_err(|e| DbErr::Custom(format!("Failed to parse registry: {}", e)))?;

    for legacy_project in legacy_projects {
        // Check if already exists (idempotent migration)
        let exists = project::Entity::find_by_id(&legacy_project.id)
            .one(db)
            .await?
            .is_some();

        if exists {
            summary.errors.push(format!("Project {} already exists, skipping", legacy_project.id));
            continue;
        }

        // Parse created_at from ID (millisecond timestamp)
        let created_at = legacy_project.id.parse::<i64>().unwrap_or(now);

        let project_model = project::ActiveModel {
            id: Set(legacy_project.id.clone()),
            name: Set(legacy_project.title),
            path: Set(legacy_project.path.clone()),
            description: Set(if legacy_project.description.is_empty() {
                None
            } else {
                Some(legacy_project.description)
            }),
            tags: Set(None),
            git_connected: Set(false),
            git_url: Set(None),
            git_branch: Set(None),
            git_remote: Set(None),
            last_commit_sha: Set(None),
            last_synced_at: Set(None),
            created_at: Set(created_at),
            updated_at: Set(now),
            last_opened_at: Set(None),
        };

        match project_model.insert(db).await {
            Ok(_) => {
                summary.projects_migrated += 1;

                // 2. Migrate clones.json for this project
                let clones_path = PathBuf::from(&legacy_project.path)
                    .join(".bluekit")
                    .join("clones.json");

                if clones_path.exists() {
                    if let Ok(clones_content) = fs::read_to_string(&clones_path) {
                        if let Ok(legacy_clones) = serde_json::from_str::<Vec<LegacyCloneMetadata>>(&clones_content) {
                            for legacy_clone in legacy_clones {
                                // Parse timestamp
                                let pinned_at = chrono::DateTime::parse_from_rfc3339(&legacy_clone.created_at)
                                    .map(|dt| dt.timestamp_millis())
                                    .unwrap_or(now);

                                let checkpoint_model = checkpoint::ActiveModel {
                                    id: Set(legacy_clone.id.clone()),
                                    project_id: Set(legacy_project.id.clone()),
                                    git_commit_sha: Set(legacy_clone.git_commit),
                                    git_branch: Set(legacy_clone.git_branch),
                                    git_url: Set(Some(legacy_clone.git_url)),
                                    name: Set(legacy_clone.name),
                                    description: Set(Some(legacy_clone.description)),
                                    tags: Set(if legacy_clone.tags.is_empty() {
                                        None
                                    } else {
                                        Some(serde_json::to_string(&legacy_clone.tags).unwrap())
                                    }),
                                    checkpoint_type: Set("template".to_string()), // Existing clones → templates
                                    parent_checkpoint_id: Set(None),
                                    created_from_project_id: Set(None),
                                    pinned_at: Set(pinned_at),
                                    created_at: Set(pinned_at),
                                    updated_at: Set(now),
                                };

                                match checkpoint_model.insert(db).await {
                                    Ok(_) => summary.checkpoints_migrated += 1,
                                    Err(e) => summary.errors.push(format!(
                                        "Checkpoint {} migration failed: {}",
                                        legacy_clone.id,
                                        e
                                    )),
                                }
                            }

                            // Backup clones.json
                            let clones_backup = clones_path.with_extension("json.backup");
                            let _ = fs::copy(&clones_path, &clones_backup);
                        }
                    }
                }
            }
            Err(e) => summary.errors.push(format!(
                "Project {} migration failed: {}",
                legacy_project.id,
                e
            )),
        }
    }

    Ok(summary)
}
