use sea_orm::*;
use serde::{Deserialize, Serialize};
use crate::db::entities::{walkthrough, walkthrough_takeaway, walkthrough_note};
use chrono::Utc;
use uuid::Uuid;
use std::path::PathBuf;
use std::fs;

/// Walkthrough DTO for frontend communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalkthroughDto {
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub progress: f32, // 0-100 based on takeaway completion
}

/// Takeaway DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TakeawayDto {
    pub id: String,
    #[serde(rename = "walkthroughId")]
    pub walkthrough_id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
    pub completed: bool,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// Walkthrough Note DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalkthroughNoteDto {
    pub id: String,
    #[serde(rename = "walkthroughId")]
    pub walkthrough_id: String,
    pub content: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Walkthrough Details DTO (includes takeaways and notes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalkthroughDetailsDto {
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub takeaways: Vec<TakeawayDto>,
    pub notes: Vec<WalkthroughNoteDto>,
    pub progress: f32,
}

// Helper function to slugify walkthrough name
fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Create a new walkthrough with file and DB registration
pub async fn create_walkthrough(
    db: &DatabaseConnection,
    project_id: String,
    project_path: String,
    name: String,
    description: Option<String>,
    initial_takeaways: Vec<(String, Option<String>)>, // (title, description)
) -> Result<WalkthroughDto, DbErr> {
    let now = Utc::now().timestamp();
    let walkthrough_id = Uuid::new_v4().to_string();
    let file_name = format!("{}.md", slugify(&name));

    // Create file path: {project_path}/.bluekit/walkthroughs/{file_name}
    let file_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join("walkthroughs")
        .join(&file_name);

    // Ensure directory exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| DbErr::Custom(format!("Failed to create walkthroughs directory: {}", e)))?;
    }

    // Create initial markdown file with front matter
    let front_matter = format!(
        r#"---
type: walkthrough
alias: {}
description: {}
---

# {}

[Walkthrough content goes here]
"#,
        name,
        description.clone().unwrap_or_default(),
        name
    );

    fs::write(&file_path, front_matter)
        .map_err(|e| DbErr::Custom(format!("Failed to create walkthrough file: {}", e)))?;

    let file_path_str = file_path.to_string_lossy().to_string();

    // Create walkthrough record
    let walkthrough_active_model = walkthrough::ActiveModel {
        id: Set(walkthrough_id.clone()),
        project_id: Set(project_id.clone()),
        file_path: Set(file_path_str.clone()),
        name: Set(name),
        description: Set(description),
        status: Set("not_started".to_string()),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let walkthrough_model = walkthrough_active_model.insert(db).await?;

    // Create initial takeaways
    for (index, (title, desc)) in initial_takeaways.iter().enumerate() {
        let takeaway_id = Uuid::new_v4().to_string();
        let takeaway_active = walkthrough_takeaway::ActiveModel {
            id: Set(takeaway_id),
            walkthrough_id: Set(walkthrough_id.clone()),
            title: Set(title.clone()),
            description: Set(desc.clone()),
            sort_order: Set(index as i32),
            completed: Set(0),
            completed_at: Set(None),
            created_at: Set(now),
        };
        takeaway_active.insert(db).await?;
    }

    Ok(WalkthroughDto {
        id: walkthrough_model.id,
        name: walkthrough_model.name,
        project_id: walkthrough_model.project_id,
        file_path: walkthrough_model.file_path,
        description: walkthrough_model.description,
        status: walkthrough_model.status,
        created_at: walkthrough_model.created_at,
        updated_at: walkthrough_model.updated_at,
        progress: 0.0,
    })
}

/// Get all walkthroughs for a project (syncs with file system first)
pub async fn get_project_walkthroughs(
    db: &DatabaseConnection,
    project_id: String,
    project_path: Option<String>,
) -> Result<Vec<WalkthroughDto>, DbErr> {
    // If project_path is provided, sync with file system first
    if let Some(path) = project_path {
        sync_project_walkthroughs(db, &project_id, &path).await?;
    }

    let walkthroughs: Vec<walkthrough::Model> = walkthrough::Entity::find()
        .filter(walkthrough::Column::ProjectId.eq(&project_id))
        .order_by_desc(walkthrough::Column::CreatedAt)
        .all(db)
        .await?;

    let mut walkthrough_dtos = Vec::new();
    for w in walkthroughs {
        let progress = calculate_walkthrough_progress(db, &w.id).await?;
        walkthrough_dtos.push(WalkthroughDto {
            id: w.id,
            name: w.name,
            project_id: w.project_id,
            file_path: w.file_path,
            description: w.description,
            status: w.status,
            created_at: w.created_at,
            updated_at: w.updated_at,
            progress,
        });
    }

    Ok(walkthrough_dtos)
}

/// Sync database with walkthrough files in the project's walkthroughs folder
/// This ensures DB reflects file system (file system is SOT)
pub async fn sync_project_walkthroughs(
    db: &DatabaseConnection,
    project_id: &str,
    project_path: &str,
) -> Result<(), DbErr> {
    let walkthroughs_dir = PathBuf::from(project_path)
        .join(".bluekit")
        .join("walkthroughs");

    // If directory doesn't exist, nothing to sync
    if !walkthroughs_dir.exists() {
        return Ok(());
    }

    // Get all existing DB records for this project
    let existing_walkthroughs: Vec<walkthrough::Model> = walkthrough::Entity::find()
        .filter(walkthrough::Column::ProjectId.eq(project_id))
        .all(db)
        .await?;

    let existing_paths: std::collections::HashSet<String> = existing_walkthroughs
        .iter()
        .map(|w| w.file_path.clone())
        .collect();

    // Scan directory for .md files
    let entries = fs::read_dir(&walkthroughs_dir)
        .map_err(|e| DbErr::Custom(format!("Failed to read walkthroughs directory: {}", e)))?;

    for entry in entries.flatten() {
        let path = entry.path();
        
        // Only process .md files
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let file_path_str = path.to_string_lossy().to_string();

        // Skip if already in DB
        if existing_paths.contains(&file_path_str) {
            continue;
        }

        // Read and parse file
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Parse frontmatter
        if let Some((name, description)) = parse_walkthrough_frontmatter(&content) {
            // Create DB record for this file
            let now = Utc::now().timestamp();
            let walkthrough_id = Uuid::new_v4().to_string();

            let walkthrough_active = walkthrough::ActiveModel {
                id: Set(walkthrough_id),
                project_id: Set(project_id.to_string()),
                file_path: Set(file_path_str),
                name: Set(name),
                description: Set(description),
                status: Set("not_started".to_string()),
                created_at: Set(now),
                updated_at: Set(now),
            };

            let _ = walkthrough_active.insert(db).await;
        }
    }

    // Clean up DB records for files that no longer exist
    for w in existing_walkthroughs {
        if !std::path::Path::new(&w.file_path).exists() {
            let _ = walkthrough::Entity::delete_by_id(&w.id).exec(db).await;
        }
    }

    Ok(())
}

/// Get or create a walkthrough by file path
/// Used when viewing a walkthrough that may not have a DB record yet
pub async fn get_or_create_walkthrough_by_path(
    db: &DatabaseConnection,
    project_id: &str,
    file_path: &str,
) -> Result<WalkthroughDto, DbErr> {
    // Check if walkthrough exists in DB
    let existing = walkthrough::Entity::find()
        .filter(walkthrough::Column::FilePath.eq(file_path))
        .one(db)
        .await?;

    if let Some(w) = existing {
        let progress = calculate_walkthrough_progress(db, &w.id).await?;
        return Ok(WalkthroughDto {
            id: w.id,
            name: w.name,
            project_id: w.project_id,
            file_path: w.file_path,
            description: w.description,
            status: w.status,
            created_at: w.created_at,
            updated_at: w.updated_at,
            progress,
        });
    }

    // File exists but no DB record - create one
    let content = fs::read_to_string(file_path)
        .map_err(|e| DbErr::Custom(format!("Failed to read walkthrough file: {}", e)))?;

    let (name, description) = parse_walkthrough_frontmatter(&content)
        .ok_or_else(|| DbErr::Custom("Invalid walkthrough frontmatter".to_string()))?;

    let now = Utc::now().timestamp();
    let walkthrough_id = Uuid::new_v4().to_string();

    let walkthrough_active = walkthrough::ActiveModel {
        id: Set(walkthrough_id.clone()),
        project_id: Set(project_id.to_string()),
        file_path: Set(file_path.to_string()),
        name: Set(name.clone()),
        description: Set(description.clone()),
        status: Set("not_started".to_string()),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let model = walkthrough_active.insert(db).await?;

    Ok(WalkthroughDto {
        id: model.id,
        name: model.name,
        project_id: model.project_id,
        file_path: model.file_path,
        description: model.description,
        status: model.status,
        created_at: model.created_at,
        updated_at: model.updated_at,
        progress: 0.0,
    })
}

/// Parse walkthrough frontmatter to extract name and description
fn parse_walkthrough_frontmatter(content: &str) -> Option<(String, Option<String>)> {
    // Check if content has frontmatter
    if !content.starts_with("---") {
        return None;
    }

    // Find the closing ---
    let remaining = &content[3..];
    let end_pos = remaining.find("---")?;
    let frontmatter = &remaining[..end_pos];

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut is_walkthrough = false;

    for line in frontmatter.lines() {
        let line = line.trim();
        if line.starts_with("type:") {
            let value = line[5..].trim().trim_matches('"').trim_matches('\'');
            if value == "walkthrough" {
                is_walkthrough = true;
            }
        } else if line.starts_with("alias:") {
            let value = line[6..].trim().trim_matches('"').trim_matches('\'');
            name = Some(value.to_string());
        } else if line.starts_with("description:") {
            let value = line[12..].trim().trim_matches('"').trim_matches('\'');
            if !value.is_empty() {
                description = Some(value.to_string());
            }
        }
    }

    // Only return if it's a walkthrough type
    if is_walkthrough {
        // If no alias, use file name as fallback (caller will need to extract)
        let final_name = name.unwrap_or_else(|| "Untitled Walkthrough".to_string());
        Some((final_name, description))
    } else {
        None
    }
}

/// Get walkthrough details with takeaways and notes
pub async fn get_walkthrough_details(
    db: &DatabaseConnection,
    walkthrough_id: String,
) -> Result<WalkthroughDetailsDto, DbErr> {
    // Get walkthrough
    let walkthrough_model = walkthrough::Entity::find_by_id(&walkthrough_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Walkthrough not found: {}", walkthrough_id)))?;

    // Get takeaways
    let takeaways = get_walkthrough_takeaways(db, &walkthrough_id).await?;

    // Get notes
    let notes = get_walkthrough_notes_internal(db, &walkthrough_id).await?;

    // Calculate progress
    let total = takeaways.len();
    let completed = takeaways.iter().filter(|t| t.completed).count();
    let progress = if total > 0 {
        (completed as f32 / total as f32) * 100.0
    } else {
        0.0
    };

    Ok(WalkthroughDetailsDto {
        id: walkthrough_model.id,
        name: walkthrough_model.name,
        project_id: walkthrough_model.project_id,
        file_path: walkthrough_model.file_path,
        description: walkthrough_model.description,
        status: walkthrough_model.status,
        created_at: walkthrough_model.created_at,
        updated_at: walkthrough_model.updated_at,
        takeaways,
        notes,
        progress,
    })
}

// Helper to calculate walkthrough progress from takeaways
async fn calculate_walkthrough_progress(
    db: &DatabaseConnection,
    walkthrough_id: &str,
) -> Result<f32, DbErr> {
    let takeaways = get_walkthrough_takeaways(db, walkthrough_id).await?;
    
    let total = takeaways.len();
    let completed = takeaways.iter().filter(|t| t.completed).count();

    let progress = if total > 0 {
        (completed as f32 / total as f32) * 100.0
    } else {
        0.0
    };

    Ok(progress)
}

// Helper to get takeaways
async fn get_walkthrough_takeaways(
    db: &DatabaseConnection,
    walkthrough_id: &str,
) -> Result<Vec<TakeawayDto>, DbErr> {
    let takeaways: Vec<walkthrough_takeaway::Model> = walkthrough_takeaway::Entity::find()
        .filter(walkthrough_takeaway::Column::WalkthroughId.eq(walkthrough_id))
        .order_by_asc(walkthrough_takeaway::Column::SortOrder)
        .all(db)
        .await?;

    Ok(takeaways.into_iter().map(|t| TakeawayDto {
        id: t.id,
        walkthrough_id: t.walkthrough_id,
        title: t.title,
        description: t.description,
        sort_order: t.sort_order,
        completed: t.completed != 0,
        completed_at: t.completed_at,
        created_at: t.created_at,
    }).collect())
}

// Helper to get notes
async fn get_walkthrough_notes_internal(
    db: &DatabaseConnection,
    walkthrough_id: &str,
) -> Result<Vec<WalkthroughNoteDto>, DbErr> {
    let notes: Vec<walkthrough_note::Model> = walkthrough_note::Entity::find()
        .filter(walkthrough_note::Column::WalkthroughId.eq(walkthrough_id))
        .order_by_desc(walkthrough_note::Column::CreatedAt)
        .all(db)
        .await?;

    Ok(notes.into_iter().map(|n| WalkthroughNoteDto {
        id: n.id,
        walkthrough_id: n.walkthrough_id,
        content: n.content,
        created_at: n.created_at,
        updated_at: n.updated_at,
    }).collect())
}

/// Update a walkthrough
pub async fn update_walkthrough(
    db: &DatabaseConnection,
    walkthrough_id: String,
    name: Option<String>,
    description: Option<Option<String>>,
    status: Option<String>,
) -> Result<WalkthroughDto, DbErr> {
    let now = Utc::now().timestamp();

    // Find existing walkthrough
    let walkthrough_model = walkthrough::Entity::find_by_id(&walkthrough_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Walkthrough not found: {}", walkthrough_id)))?;

    let mut walkthrough_active: walkthrough::ActiveModel = walkthrough_model.clone().into();

    if let Some(new_name) = name {
        walkthrough_active.name = Set(new_name);
    }

    if let Some(desc) = description {
        walkthrough_active.description = Set(desc);
    }

    if let Some(s) = status {
        walkthrough_active.status = Set(s);
    }

    walkthrough_active.updated_at = Set(now);

    let updated_walkthrough = walkthrough_active.update(db).await?;

    let progress = calculate_walkthrough_progress(db, &walkthrough_id).await?;

    Ok(WalkthroughDto {
        id: updated_walkthrough.id,
        name: updated_walkthrough.name,
        project_id: updated_walkthrough.project_id,
        file_path: updated_walkthrough.file_path,
        description: updated_walkthrough.description,
        status: updated_walkthrough.status,
        created_at: updated_walkthrough.created_at,
        updated_at: updated_walkthrough.updated_at,
        progress,
    })
}

/// Delete a walkthrough (removes file and database records)
pub async fn delete_walkthrough(
    db: &DatabaseConnection,
    walkthrough_id: String,
) -> Result<(), DbErr> {
    // Get walkthrough to find file path
    let walkthrough_model = walkthrough::Entity::find_by_id(&walkthrough_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Walkthrough not found: {}", walkthrough_id)))?;

    // Delete file if exists
    if std::path::Path::new(&walkthrough_model.file_path).exists() {
        fs::remove_file(&walkthrough_model.file_path)
            .map_err(|e| DbErr::Custom(format!("Failed to delete walkthrough file: {}", e)))?;
    }

    // Delete database record (cascade will delete takeaways, notes)
    walkthrough::Entity::delete_by_id(walkthrough_id).exec(db).await?;

    Ok(())
}

// ============================================================================
// TAKEAWAY OPERATIONS
// ============================================================================

/// Add a takeaway to a walkthrough
pub async fn add_takeaway(
    db: &DatabaseConnection,
    walkthrough_id: String,
    title: String,
    description: Option<String>,
) -> Result<TakeawayDto, DbErr> {
    let now = Utc::now().timestamp();
    let takeaway_id = Uuid::new_v4().to_string();

    // Get max sort_order
    let max_order = walkthrough_takeaway::Entity::find()
        .filter(walkthrough_takeaway::Column::WalkthroughId.eq(&walkthrough_id))
        .order_by_desc(walkthrough_takeaway::Column::SortOrder)
        .one(db)
        .await?
        .map(|t| t.sort_order + 1)
        .unwrap_or(0);

    let takeaway_active = walkthrough_takeaway::ActiveModel {
        id: Set(takeaway_id),
        walkthrough_id: Set(walkthrough_id),
        title: Set(title),
        description: Set(description),
        sort_order: Set(max_order),
        completed: Set(0),
        completed_at: Set(None),
        created_at: Set(now),
    };

    let takeaway_model = takeaway_active.insert(db).await?;

    Ok(TakeawayDto {
        id: takeaway_model.id,
        walkthrough_id: takeaway_model.walkthrough_id,
        title: takeaway_model.title,
        description: takeaway_model.description,
        sort_order: takeaway_model.sort_order,
        completed: takeaway_model.completed != 0,
        completed_at: takeaway_model.completed_at,
        created_at: takeaway_model.created_at,
    })
}

/// Toggle takeaway completion
pub async fn toggle_takeaway_complete(
    db: &DatabaseConnection,
    takeaway_id: String,
) -> Result<TakeawayDto, DbErr> {
    let now = Utc::now().timestamp();

    let takeaway_model = walkthrough_takeaway::Entity::find_by_id(&takeaway_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Takeaway not found: {}", takeaway_id)))?;

    let new_completed = if takeaway_model.completed == 0 { 1 } else { 0 };
    let new_completed_at = if new_completed == 1 { Some(now) } else { None };

    let mut takeaway_active: walkthrough_takeaway::ActiveModel = takeaway_model.into();
    takeaway_active.completed = Set(new_completed);
    takeaway_active.completed_at = Set(new_completed_at);

    let updated = takeaway_active.update(db).await?;

    Ok(TakeawayDto {
        id: updated.id,
        walkthrough_id: updated.walkthrough_id,
        title: updated.title,
        description: updated.description,
        sort_order: updated.sort_order,
        completed: updated.completed != 0,
        completed_at: updated.completed_at,
        created_at: updated.created_at,
    })
}

/// Update a takeaway
pub async fn update_takeaway(
    db: &DatabaseConnection,
    takeaway_id: String,
    title: Option<String>,
    description: Option<Option<String>>,
) -> Result<TakeawayDto, DbErr> {
    let takeaway_model = walkthrough_takeaway::Entity::find_by_id(&takeaway_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Takeaway not found: {}", takeaway_id)))?;

    let mut takeaway_active: walkthrough_takeaway::ActiveModel = takeaway_model.into();

    if let Some(t) = title {
        takeaway_active.title = Set(t);
    }

    if let Some(d) = description {
        takeaway_active.description = Set(d);
    }

    let updated = takeaway_active.update(db).await?;

    Ok(TakeawayDto {
        id: updated.id,
        walkthrough_id: updated.walkthrough_id,
        title: updated.title,
        description: updated.description,
        sort_order: updated.sort_order,
        completed: updated.completed != 0,
        completed_at: updated.completed_at,
        created_at: updated.created_at,
    })
}

/// Delete a takeaway
pub async fn delete_takeaway(
    db: &DatabaseConnection,
    takeaway_id: String,
) -> Result<(), DbErr> {
    walkthrough_takeaway::Entity::delete_by_id(takeaway_id).exec(db).await?;
    Ok(())
}

/// Reorder takeaways
pub async fn reorder_takeaways(
    db: &DatabaseConnection,
    walkthrough_id: String,
    takeaway_ids_in_order: Vec<String>,
) -> Result<(), DbErr> {
    for (index, takeaway_id) in takeaway_ids_in_order.iter().enumerate() {
        let takeaway_model = walkthrough_takeaway::Entity::find_by_id(takeaway_id)
            .one(db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Takeaway not found: {}", takeaway_id)))?;

        // Verify takeaway belongs to this walkthrough
        if takeaway_model.walkthrough_id != walkthrough_id {
            return Err(DbErr::Custom("Takeaway does not belong to this walkthrough".to_string()));
        }

        let mut takeaway_active: walkthrough_takeaway::ActiveModel = takeaway_model.into();
        takeaway_active.sort_order = Set(index as i32);
        takeaway_active.update(db).await?;
    }

    Ok(())
}

// ============================================================================
// NOTE OPERATIONS
// ============================================================================

/// Get walkthrough notes
pub async fn get_walkthrough_notes(
    db: &DatabaseConnection,
    walkthrough_id: String,
) -> Result<Vec<WalkthroughNoteDto>, DbErr> {
    get_walkthrough_notes_internal(db, &walkthrough_id).await
}

/// Add a note to a walkthrough
pub async fn add_walkthrough_note(
    db: &DatabaseConnection,
    walkthrough_id: String,
    content: String,
) -> Result<WalkthroughNoteDto, DbErr> {
    let now = Utc::now().timestamp();
    let note_id = Uuid::new_v4().to_string();

    let note_active = walkthrough_note::ActiveModel {
        id: Set(note_id),
        walkthrough_id: Set(walkthrough_id),
        content: Set(content),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let note_model = note_active.insert(db).await?;

    Ok(WalkthroughNoteDto {
        id: note_model.id,
        walkthrough_id: note_model.walkthrough_id,
        content: note_model.content,
        created_at: note_model.created_at,
        updated_at: note_model.updated_at,
    })
}

/// Update a walkthrough note
pub async fn update_walkthrough_note(
    db: &DatabaseConnection,
    note_id: String,
    content: String,
) -> Result<WalkthroughNoteDto, DbErr> {
    let now = Utc::now().timestamp();

    let note_model = walkthrough_note::Entity::find_by_id(&note_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Note not found: {}", note_id)))?;

    let mut note_active: walkthrough_note::ActiveModel = note_model.into();
    note_active.content = Set(content);
    note_active.updated_at = Set(now);

    let updated = note_active.update(db).await?;

    Ok(WalkthroughNoteDto {
        id: updated.id,
        walkthrough_id: updated.walkthrough_id,
        content: updated.content,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
    })
}

/// Delete a walkthrough note
pub async fn delete_walkthrough_note(
    db: &DatabaseConnection,
    note_id: String,
) -> Result<(), DbErr> {
    walkthrough_note::Entity::delete_by_id(note_id).exec(db).await?;
    Ok(())
}
