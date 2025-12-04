use sea_orm::*;
use serde::{Deserialize, Serialize};
use crate::db::entities::{task, task_project};
use chrono::Utc;
use uuid::Uuid;

/// Task DTO for frontend communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDto {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub tags: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "projectIds")]
    pub project_ids: Vec<String>,
    pub status: String,
    pub complexity: Option<String>,
}

/// Get all tasks (optionally filtered by project IDs)
pub async fn get_tasks(
    db: &DatabaseConnection,
    project_ids: Option<Vec<String>>,
) -> Result<Vec<TaskDto>, DbErr> {
    let mut tasks: Vec<TaskDto> = Vec::new();

    if let Some(proj_ids) = project_ids {
        // Get tasks associated with specific projects
        let task_project_links: Vec<task_project::Model> = task_project::Entity::find()
            .filter(task_project::Column::ProjectId.is_in(proj_ids))
            .all(db)
            .await?;

        // Get unique task IDs
        let task_ids: Vec<String> = task_project_links
            .iter()
            .map(|tp| tp.task_id.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        if !task_ids.is_empty() {
            let task_models: Vec<task::Model> = task::Entity::find()
                .filter(task::Column::Id.is_in(task_ids))
                .all(db)
                .await?;

            for task_model in task_models {
                // Get project IDs for this task
                let project_ids = get_task_project_ids(db, &task_model.id).await?;
                tasks.push(model_to_dto(task_model, project_ids));
            }
        }
    } else {
        // Get all tasks
        let task_models: Vec<task::Model> = task::Entity::find().all(db).await?;

        for task_model in task_models {
            let project_ids = get_task_project_ids(db, &task_model.id).await?;
            tasks.push(model_to_dto(task_model, project_ids));
        }
    }

    Ok(tasks)
}

/// Get a single task by ID
pub async fn get_task(db: &DatabaseConnection, task_id: &str) -> Result<Option<TaskDto>, DbErr> {
    if let Some(task_model) = task::Entity::find_by_id(task_id).one(db).await? {
        let project_ids = get_task_project_ids(db, task_id).await?;
        Ok(Some(model_to_dto(task_model, project_ids)))
    } else {
        Ok(None)
    }
}

/// Create a new task
pub async fn create_task(
    db: &DatabaseConnection,
    title: String,
    description: Option<String>,
    priority: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
    status: Option<String>,
    complexity: Option<String>,
) -> Result<TaskDto, DbErr> {
    let now = Utc::now().to_rfc3339();
    let task_id = Uuid::new_v4().to_string();

    // Serialize tags to JSON
    let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());

    // Create task
    let task_active_model = task::ActiveModel {
        id: Set(task_id.clone()),
        title: Set(title),
        description: Set(description),
        priority: Set(priority),
        tags: Set(tags_json),
        created_at: Set(now.clone()),
        updated_at: Set(now),
        status: Set(status.unwrap_or_else(|| "backlog".to_string())),
        complexity: Set(complexity),
    };

    let task_model = task_active_model.insert(db).await?;

    // Create task-project associations
    for project_id in &project_ids {
        let task_project_model = task_project::ActiveModel {
            id: NotSet,
            task_id: Set(task_id.clone()),
            project_id: Set(project_id.clone()),
        };
        task_project_model.insert(db).await?;
    }

    Ok(model_to_dto(task_model, project_ids))
}

/// Update an existing task
pub async fn update_task(
    db: &DatabaseConnection,
    task_id: String,
    title: Option<String>,
    description: Option<Option<String>>,
    priority: Option<String>,
    tags: Option<Vec<String>>,
    project_ids: Option<Vec<String>>,
    status: Option<String>,
    complexity: Option<Option<String>>,
) -> Result<TaskDto, DbErr> {
    // Find existing task
    let task_model = task::Entity::find_by_id(&task_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Task not found: {}", task_id)))?;

    let mut task_active_model: task::ActiveModel = task_model.into();

    // Update fields if provided
    if let Some(t) = title {
        task_active_model.title = Set(t);
    }
    if let Some(d) = description {
        task_active_model.description = Set(d);
    }
    if let Some(p) = priority {
        task_active_model.priority = Set(p);
    }
    if let Some(s) = status {
        task_active_model.status = Set(s);
    }
    if let Some(c) = complexity {
        task_active_model.complexity = Set(c);
    }
    if let Some(t) = tags {
        let tags_json = serde_json::to_string(&t).unwrap_or_else(|_| "[]".to_string());
        task_active_model.tags = Set(tags_json);
    }

    task_active_model.updated_at = Set(Utc::now().to_rfc3339());

    let updated_task = task_active_model.update(db).await?;

    // Update project associations if provided
    let final_project_ids = if let Some(new_project_ids) = project_ids {
        // Delete existing associations
        task_project::Entity::delete_many()
            .filter(task_project::Column::TaskId.eq(&task_id))
            .exec(db)
            .await?;

        // Create new associations
        for project_id in &new_project_ids {
            let task_project_model = task_project::ActiveModel {
                id: NotSet,
                task_id: Set(task_id.clone()),
                project_id: Set(project_id.clone()),
            };
            task_project_model.insert(db).await?;
        }

        new_project_ids
    } else {
        get_task_project_ids(db, &task_id).await?
    };

    Ok(model_to_dto(updated_task, final_project_ids))
}

/// Delete a task
pub async fn delete_task(db: &DatabaseConnection, task_id: &str) -> Result<(), DbErr> {
    // Delete task-project associations (CASCADE should handle this, but being explicit)
    task_project::Entity::delete_many()
        .filter(task_project::Column::TaskId.eq(task_id))
        .exec(db)
        .await?;

    // Delete task
    task::Entity::delete_by_id(task_id).exec(db).await?;

    Ok(())
}

/// Helper: Get project IDs for a task
async fn get_task_project_ids(db: &DatabaseConnection, task_id: &str) -> Result<Vec<String>, DbErr> {
    let task_projects: Vec<task_project::Model> = task_project::Entity::find()
        .filter(task_project::Column::TaskId.eq(task_id))
        .all(db)
        .await?;

    Ok(task_projects.into_iter().map(|tp| tp.project_id).collect())
}

/// Helper: Convert task model to DTO
fn model_to_dto(model: task::Model, project_ids: Vec<String>) -> TaskDto {
    let tags: Vec<String> = serde_json::from_str(&model.tags).unwrap_or_else(|_| Vec::new());

    TaskDto {
        id: model.id,
        title: model.title,
        description: model.description,
        priority: model.priority,
        tags,
        created_at: model.created_at,
        updated_at: model.updated_at,
        project_ids,
        status: model.status,
        complexity: model.complexity,
    }
}
