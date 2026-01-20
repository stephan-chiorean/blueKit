use sea_orm::*;
use sea_orm::sea_query::{Expr, Value};
use serde::{Deserialize, Serialize};
use crate::db::entities::{plan, plan_phase, plan_milestone, plan_document, plan_link};
use chrono::Utc;
use uuid::Uuid;
use std::path::{Path, PathBuf};
use std::fs;

/// Plan DTO for frontend communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanDto {
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "folderPath")]
    pub folder_path: String,
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "brainstormLink")]
    pub brainstorm_link: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub progress: f32, // 0-100 based on milestone completion
}

/// Plan Phase DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanPhaseDto {
    pub id: String,
    #[serde(rename = "planId")]
    pub plan_id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
    pub status: String,
    #[serde(rename = "startedAt")]
    pub started_at: Option<i64>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub milestones: Vec<PlanMilestoneDto>,
}

/// Plan Milestone DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanMilestoneDto {
    pub id: String,
    #[serde(rename = "phaseId")]
    pub phase_id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
    pub completed: bool,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Plan Document DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanDocumentDto {
    pub id: String,
    #[serde(rename = "planId")]
    pub plan_id: String,
    #[serde(rename = "phaseId")]
    pub phase_id: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
}

/// Plan Link DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanLinkDto {
    pub id: String,
    #[serde(rename = "planId")]
    pub plan_id: String,
    #[serde(rename = "linkedPlanPath")]
    pub linked_plan_path: String,
    pub source: String, // 'claude' or 'cursor'
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Plan Details DTO (includes phases with milestones and documents)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanDetailsDto {
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "folderPath")]
    pub folder_path: String,
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "brainstormLink")]
    pub brainstorm_link: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub phases: Vec<PlanPhaseDto>,
    pub documents: Vec<PlanDocumentDto>,
    #[serde(rename = "linkedPlans")]
    pub linked_plans: Vec<PlanLinkDto>,
    pub progress: f32, // 0-100 based on milestone completion
}

// Helper function to slugify plan name
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

/// Create a new plan with folder structure
pub async fn create_plan(
    db: &DatabaseConnection,
    project_id: String,
    project_path: String,
    name: String,
    description: Option<String>,
) -> Result<PlanDto, DbErr> {
    let now = Utc::now().timestamp();
    let plan_id = Uuid::new_v4().to_string();
    let folder_name = slugify(&name);

    // Create folder path: {project_path}/.bluekit/plans/{folder_name}
    let folder_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join("plans")
        .join(&folder_name);

    // Create the folder
    fs::create_dir_all(&folder_path)
        .map_err(|e| DbErr::Custom(format!("Failed to create plan folder: {}", e)))?;

    let folder_path_str = folder_path.to_string_lossy().to_string();

    // Create plan record
    let plan_active_model = plan::ActiveModel {
        id: Set(plan_id.clone()),
        name: Set(name),
        project_id: Set(project_id.clone()),
        folder_path: Set(folder_path_str.clone()),
        description: Set(description.clone()),
        status: Set("active".to_string()),
        brainstorm_link: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let plan_model = plan_active_model.insert(db).await?;

    // New plan has 0 progress (no milestones yet)
    Ok(PlanDto {
        id: plan_model.id,
        name: plan_model.name,
        project_id: plan_model.project_id,
        folder_path: plan_model.folder_path,
        description: plan_model.description,
        status: plan_model.status,
        brainstorm_link: plan_model.brainstorm_link,
        created_at: plan_model.created_at,
        updated_at: plan_model.updated_at,
        progress: 0.0,
    })
}

/// Get all plans for a project
pub async fn get_project_plans(
    db: &DatabaseConnection,
    project_id: String,
) -> Result<Vec<PlanDto>, DbErr> {
    let plans: Vec<plan::Model> = plan::Entity::find()
        .filter(plan::Column::ProjectId.eq(project_id))
        .order_by_desc(plan::Column::CreatedAt)
        .all(db)
        .await?;

    let mut plan_dtos = Vec::new();
    for p in plans {
        let progress = calculate_plan_progress(db, &p.id).await?;
        plan_dtos.push(PlanDto {
            id: p.id,
            name: p.name,
            project_id: p.project_id,
            folder_path: p.folder_path,
            description: p.description,
            status: p.status,
            brainstorm_link: p.brainstorm_link,
            created_at: p.created_at,
            updated_at: p.updated_at,
            progress,
        });
    }

    Ok(plan_dtos)
}

/// Get plan details with phases, milestones, and documents
pub async fn get_plan_details(
    db: &DatabaseConnection,
    plan_id: String,
) -> Result<PlanDetailsDto, DbErr> {
    // Get plan
    let plan_model = plan::Entity::find_by_id(&plan_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Plan not found: {}", plan_id)))?;

    // Get phases with milestones
    let phases = get_plan_phases_with_milestones(db, &plan_id).await?;

    // Get documents (scans folder and creates DB records for new files)
    let documents = get_plan_documents(db, plan_id.clone()).await?;

    // Get linked plans
    let linked_plans = get_plan_links_internal(db, &plan_id).await?;

    // Calculate progress (completed milestones / total milestones)
    let mut total_milestones = 0;
    let mut completed_milestones = 0;
    for phase in &phases {
        total_milestones += phase.milestones.len();
        completed_milestones += phase.milestones.iter().filter(|m| m.completed).count();
    }

    let progress = if total_milestones > 0 {
        (completed_milestones as f32 / total_milestones as f32) * 100.0
    } else {
        0.0
    };

    Ok(PlanDetailsDto {
        id: plan_model.id,
        name: plan_model.name,
        project_id: plan_model.project_id,
        folder_path: plan_model.folder_path,
        description: plan_model.description,
        status: plan_model.status,
        brainstorm_link: plan_model.brainstorm_link,
        created_at: plan_model.created_at,
        updated_at: plan_model.updated_at,
        phases,
        documents,
        linked_plans,
        progress,
    })
}

// Helper to calculate plan progress from milestones
async fn calculate_plan_progress(
    db: &DatabaseConnection,
    plan_id: &str,
) -> Result<f32, DbErr> {
    let phases = get_plan_phases_with_milestones(db, plan_id).await?;
    
    let mut total_milestones = 0;
    let mut completed_milestones = 0;
    for phase in &phases {
        total_milestones += phase.milestones.len();
        completed_milestones += phase.milestones.iter().filter(|m| m.completed).count();
    }

    let progress = if total_milestones > 0 {
        (completed_milestones as f32 / total_milestones as f32) * 100.0
    } else {
        0.0
    };

    Ok(progress)
}

// Helper to get phases with milestones
async fn get_plan_phases_with_milestones(
    db: &DatabaseConnection,
    plan_id: &str,
) -> Result<Vec<PlanPhaseDto>, DbErr> {
    let phases: Vec<plan_phase::Model> = plan_phase::Entity::find()
        .filter(plan_phase::Column::PlanId.eq(plan_id))
        .order_by_asc(plan_phase::Column::OrderIndex)
        .all(db)
        .await?;

    let mut phase_dtos = Vec::new();
    for phase in phases {
        let milestones = get_phase_milestones(db, &phase.id).await?;
        phase_dtos.push(PlanPhaseDto {
            id: phase.id,
            plan_id: phase.plan_id,
            name: phase.name,
            description: phase.description,
            order_index: phase.order_index,
            status: phase.status,
            started_at: phase.started_at,
            completed_at: phase.completed_at,
            created_at: phase.created_at,
            updated_at: phase.updated_at,
            milestones,
        });
    }

    Ok(phase_dtos)
}

// Helper to get milestones for a phase
async fn get_phase_milestones(
    db: &DatabaseConnection,
    phase_id: &str,
) -> Result<Vec<PlanMilestoneDto>, DbErr> {
    let milestones: Vec<plan_milestone::Model> = plan_milestone::Entity::find()
        .filter(plan_milestone::Column::PhaseId.eq(phase_id))
        .order_by_asc(plan_milestone::Column::OrderIndex)
        .all(db)
        .await?;

    Ok(milestones.into_iter().map(|m| PlanMilestoneDto {
        id: m.id,
        phase_id: m.phase_id,
        name: m.name,
        description: m.description,
        order_index: m.order_index,
        completed: m.completed != 0,
        completed_at: m.completed_at,
        created_at: m.created_at,
        updated_at: m.updated_at,
    }).collect())
}

// Helper to get documents for a plan
async fn get_plan_documents_internal(
    db: &DatabaseConnection,
    plan_id: &str,
) -> Result<Vec<PlanDocumentDto>, DbErr> {
    let documents: Vec<plan_document::Model> = plan_document::Entity::find()
        .filter(plan_document::Column::PlanId.eq(plan_id))
        .all(db)
        .await?;

    Ok(documents.into_iter().map(|d| PlanDocumentDto {
        id: d.id,
        plan_id: d.plan_id,
        phase_id: d.phase_id,
        file_path: d.file_path,
        file_name: d.file_name,
        created_at: d.created_at,
        updated_at: d.updated_at,
        order_index: d.order_index,
    }).collect())
}

// Helper to get linked plans for a plan
async fn get_plan_links_internal(
    db: &DatabaseConnection,
    plan_id: &str,
) -> Result<Vec<PlanLinkDto>, DbErr> {
    let links: Vec<plan_link::Model> = plan_link::Entity::find()
        .filter(plan_link::Column::PlanId.eq(plan_id))
        .order_by_asc(plan_link::Column::CreatedAt)
        .all(db)
        .await?;

    Ok(links.into_iter().map(|l| PlanLinkDto {
        id: l.id,
        plan_id: l.plan_id,
        linked_plan_path: l.linked_plan_path,
        source: l.source,
        created_at: l.created_at,
        updated_at: l.updated_at,
    }).collect())
}

/// Update a plan
pub async fn update_plan(
    db: &DatabaseConnection,
    plan_id: String,
    name: Option<String>,
    description: Option<Option<String>>,
    status: Option<String>,
) -> Result<PlanDto, DbErr> {
    let now = Utc::now().timestamp();

    // Find existing plan
    let plan_model = plan::Entity::find_by_id(&plan_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Plan not found: {}", plan_id)))?;

    let mut plan_active_model: plan::ActiveModel = plan_model.clone().into();

    // Update name and potentially rename folder
    if let Some(new_name) = name {
        plan_active_model.name = Set(new_name.clone());

        // Rename folder if name changed
        let new_folder_name = slugify(&new_name);
        let old_path = PathBuf::from(&plan_model.folder_path);
        let new_path = old_path.parent()
            .unwrap()
            .join(&new_folder_name);

        if old_path != new_path {
            fs::rename(&old_path, &new_path)
                .map_err(|e| DbErr::Custom(format!("Failed to rename plan folder: {}", e)))?;
            plan_active_model.folder_path = Set(new_path.to_string_lossy().to_string());
        }
    }

    if let Some(desc) = description {
        plan_active_model.description = Set(desc);
    }

    if let Some(s) = status {
        plan_active_model.status = Set(s);
    }

    plan_active_model.updated_at = Set(now);

    let updated_plan = plan_active_model.update(db).await?;

    // Calculate progress for updated plan
    let progress = calculate_plan_progress(db, &plan_id).await?;

    Ok(PlanDto {
        id: updated_plan.id,
        name: updated_plan.name,
        project_id: updated_plan.project_id,
        folder_path: updated_plan.folder_path,
        description: updated_plan.description,
        status: updated_plan.status,
        brainstorm_link: updated_plan.brainstorm_link,
        created_at: updated_plan.created_at,
        updated_at: updated_plan.updated_at,
        progress,
    })
}

/// Delete a plan (removes folder and database records)
pub async fn delete_plan(
    db: &DatabaseConnection,
    plan_id: String,
) -> Result<(), DbErr> {
    // Get plan to find folder path
    let plan_model = plan::Entity::find_by_id(&plan_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Plan not found: {}", plan_id)))?;

    // Delete folder recursively
    if Path::new(&plan_model.folder_path).exists() {
        fs::remove_dir_all(&plan_model.folder_path)
            .map_err(|e| DbErr::Custom(format!("Failed to delete plan folder: {}", e)))?;
    }

    // Delete database record (cascade will delete phases, milestones, documents)
    plan::Entity::delete_by_id(plan_id).exec(db).await?;

    Ok(())
}

/// Link brainstorm plan to a plan (legacy - maintains backward compatibility)
pub async fn link_brainstorm_to_plan(
    db: &DatabaseConnection,
    plan_id: String,
    brainstorm_path: String,
) -> Result<(), DbErr> {
    // Detect source from path
    let source = if brainstorm_path.contains(".claude") {
        "claude"
    } else if brainstorm_path.contains(".cursor") {
        "cursor"
    } else {
        "unknown"
    };

    // Use new multi-link function
    link_plan_to_plan(db, plan_id, brainstorm_path, source.to_string()).await
}

/// Unlink brainstorm from plan (legacy - maintains backward compatibility)
pub async fn unlink_brainstorm_from_plan(
    db: &DatabaseConnection,
    plan_id: String,
) -> Result<(), DbErr> {
    // Get all linked plans and remove them
    let links = get_plan_links_internal(db, &plan_id).await?;
    for link in links {
        unlink_plan_from_plan(db, plan_id.clone(), link.linked_plan_path).await?;
    }
    Ok(())
}

/// Link a plan (from cursor/claude) to a plan
pub async fn link_plan_to_plan(
    db: &DatabaseConnection,
    plan_id: String,
    linked_plan_path: String,
    source: String,
) -> Result<(), DbErr> {
    let now = Utc::now().timestamp();

    // Verify file exists
    if !Path::new(&linked_plan_path).exists() {
        return Err(DbErr::Custom("Linked plan file does not exist".to_string()));
    }

    // Verify plan exists
    plan::Entity::find_by_id(&plan_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Plan not found: {}", plan_id)))?;

    // Check if link already exists
    let existing_link = plan_link::Entity::find()
        .filter(plan_link::Column::PlanId.eq(&plan_id))
        .filter(plan_link::Column::LinkedPlanPath.eq(&linked_plan_path))
        .one(db)
        .await?;

    if existing_link.is_some() {
        // Link already exists, just return success
        return Ok(());
    }

    // Create new link
    let link_id = Uuid::new_v4().to_string();
    let link_active_model = plan_link::ActiveModel {
        id: Set(link_id),
        plan_id: Set(plan_id),
        linked_plan_path: Set(linked_plan_path),
        source: Set(source),
        created_at: Set(now),
        updated_at: Set(now),
    };

    link_active_model.insert(db).await?;

    Ok(())
}

/// Unlink a plan from a plan
pub async fn unlink_plan_from_plan(
    db: &DatabaseConnection,
    plan_id: String,
    linked_plan_path: String,
) -> Result<(), DbErr> {
    // Find and delete the link
    let link = plan_link::Entity::find()
        .filter(plan_link::Column::PlanId.eq(&plan_id))
        .filter(plan_link::Column::LinkedPlanPath.eq(&linked_plan_path))
        .one(db)
        .await?;

    if let Some(link_model) = link {
        plan_link::Entity::delete_by_id(link_model.id).exec(db).await?;
    }

    Ok(())
}

/// Link multiple plans to a plan
pub async fn link_multiple_plans_to_plan(
    db: &DatabaseConnection,
    plan_id: String,
    plan_paths: Vec<String>,
    source: String,
) -> Result<(), DbErr> {
    for path in plan_paths {
        link_plan_to_plan(db, plan_id.clone(), path, source.clone()).await?;
    }
    Ok(())
}

/// Create a plan phase
pub async fn create_plan_phase(
    db: &DatabaseConnection,
    plan_id: String,
    name: String,
    description: Option<String>,
    order_index: i32,
) -> Result<PlanPhaseDto, DbErr> {
    let now = Utc::now().timestamp();
    let phase_id = Uuid::new_v4().to_string();

    let phase_active_model = plan_phase::ActiveModel {
        id: Set(phase_id),
        plan_id: Set(plan_id),
        name: Set(name),
        description: Set(description),
        order_index: Set(order_index),
        status: Set("pending".to_string()),
        started_at: Set(None),
        completed_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let phase_model = phase_active_model.insert(db).await?;

    Ok(PlanPhaseDto {
        id: phase_model.id,
        plan_id: phase_model.plan_id,
        name: phase_model.name,
        description: phase_model.description,
        order_index: phase_model.order_index,
        status: phase_model.status,
        started_at: phase_model.started_at,
        completed_at: phase_model.completed_at,
        created_at: phase_model.created_at,
        updated_at: phase_model.updated_at,
        milestones: vec![],
    })
}

/// Update a plan phase
pub async fn update_plan_phase(
    db: &DatabaseConnection,
    phase_id: String,
    name: Option<String>,
    description: Option<Option<String>>,
    status: Option<String>,
    order_index: Option<i32>,
) -> Result<PlanPhaseDto, DbErr> {
    let now = Utc::now().timestamp();

    let phase_model = plan_phase::Entity::find_by_id(&phase_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Phase not found: {}", phase_id)))?;

    let mut phase_active_model: plan_phase::ActiveModel = phase_model.clone().into();

    if let Some(n) = name {
        phase_active_model.name = Set(n);
    }

    if let Some(d) = description {
        phase_active_model.description = Set(d);
    }

    if let Some(o) = order_index {
        phase_active_model.order_index = Set(o);
    }

    // Handle status change and auto-complete milestones if status changed to 'completed'
    if let Some(s) = status {
        let old_status = phase_model.status.clone();
        phase_active_model.status = Set(s.clone());

        if s == "completed" && old_status != "completed" {
            // Mark phase as completed
            phase_active_model.completed_at = Set(Some(now));

            // Auto-complete all milestones in this phase
            let milestones: Vec<plan_milestone::Model> = plan_milestone::Entity::find()
                .filter(plan_milestone::Column::PhaseId.eq(&phase_id))
                .all(db)
                .await?;

            for milestone in milestones {
                let mut milestone_active: plan_milestone::ActiveModel = milestone.into();
                milestone_active.completed = Set(1);
                milestone_active.completed_at = Set(Some(now));
                milestone_active.updated_at = Set(now);
                milestone_active.update(db).await?;
            }
        } else if s == "in_progress" && phase_model.started_at.is_none() {
            phase_active_model.started_at = Set(Some(now));
        }
    }

    phase_active_model.updated_at = Set(now);

    let updated_phase = phase_active_model.update(db).await?;

    // Get milestones
    let milestones = get_phase_milestones(db, &updated_phase.id).await?;

    Ok(PlanPhaseDto {
        id: updated_phase.id,
        plan_id: updated_phase.plan_id,
        name: updated_phase.name,
        description: updated_phase.description,
        order_index: updated_phase.order_index,
        status: updated_phase.status,
        started_at: updated_phase.started_at,
        completed_at: updated_phase.completed_at,
        created_at: updated_phase.created_at,
        updated_at: updated_phase.updated_at,
        milestones,
    })
}

/// Delete a plan phase
pub async fn delete_plan_phase(
    db: &DatabaseConnection,
    phase_id: String,
) -> Result<(), DbErr> {
    // Unlink documents from this phase (set phase_id to NULL)
    plan_document::Entity::update_many()
        .col_expr(plan_document::Column::PhaseId, Expr::value(Value::String(None)))
        .filter(plan_document::Column::PhaseId.eq(&phase_id))
        .exec(db)
        .await?;

    // Delete phase (cascade will delete milestones)
    plan_phase::Entity::delete_by_id(phase_id).exec(db).await?;

    Ok(())
}

/// Reorder plan phases
pub async fn reorder_plan_phases(
    db: &DatabaseConnection,
    plan_id: String,
    phase_ids_in_order: Vec<String>,
) -> Result<(), DbErr> {
    let now = Utc::now().timestamp();

    for (index, phase_id) in phase_ids_in_order.iter().enumerate() {
        let phase_model = plan_phase::Entity::find_by_id(phase_id)
            .one(db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Phase not found: {}", phase_id)))?;

        // Verify phase belongs to this plan
        if phase_model.plan_id != plan_id {
            return Err(DbErr::Custom("Phase does not belong to this plan".to_string()));
        }

        let mut phase_active: plan_phase::ActiveModel = phase_model.into();
        phase_active.order_index = Set(index as i32);
        phase_active.updated_at = Set(now);
        phase_active.update(db).await?;
    }

    Ok(())
}

/// Create a plan milestone
pub async fn create_plan_milestone(
    db: &DatabaseConnection,
    phase_id: String,
    name: String,
    description: Option<String>,
    order_index: i32,
) -> Result<PlanMilestoneDto, DbErr> {
    let now = Utc::now().timestamp();
    let milestone_id = Uuid::new_v4().to_string();

    let milestone_active_model = plan_milestone::ActiveModel {
        id: Set(milestone_id),
        phase_id: Set(phase_id),
        name: Set(name),
        description: Set(description),
        order_index: Set(order_index),
        completed: Set(0),
        completed_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let milestone_model = milestone_active_model.insert(db).await?;

    Ok(PlanMilestoneDto {
        id: milestone_model.id,
        phase_id: milestone_model.phase_id,
        name: milestone_model.name,
        description: milestone_model.description,
        order_index: milestone_model.order_index,
        completed: milestone_model.completed != 0,
        completed_at: milestone_model.completed_at,
        created_at: milestone_model.created_at,
        updated_at: milestone_model.updated_at,
    })
}

/// Update a plan milestone
pub async fn update_plan_milestone(
    db: &DatabaseConnection,
    milestone_id: String,
    name: Option<String>,
    description: Option<Option<String>>,
    completed: Option<bool>,
) -> Result<PlanMilestoneDto, DbErr> {
    let now = Utc::now().timestamp();

    let milestone_model = plan_milestone::Entity::find_by_id(&milestone_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Milestone not found: {}", milestone_id)))?;

    let mut milestone_active: plan_milestone::ActiveModel = milestone_model.into();

    if let Some(n) = name {
        milestone_active.name = Set(n);
    }

    if let Some(d) = description {
        milestone_active.description = Set(d);
    }

    if let Some(c) = completed {
        milestone_active.completed = Set(if c { 1 } else { 0 });
        milestone_active.completed_at = Set(if c { Some(now) } else { None });
    }

    milestone_active.updated_at = Set(now);

    let updated_milestone = milestone_active.update(db).await?;

    Ok(PlanMilestoneDto {
        id: updated_milestone.id,
        phase_id: updated_milestone.phase_id,
        name: updated_milestone.name,
        description: updated_milestone.description,
        order_index: updated_milestone.order_index,
        completed: updated_milestone.completed != 0,
        completed_at: updated_milestone.completed_at,
        created_at: updated_milestone.created_at,
        updated_at: updated_milestone.updated_at,
    })
}

/// Delete a plan milestone
pub async fn delete_plan_milestone(
    db: &DatabaseConnection,
    milestone_id: String,
) -> Result<(), DbErr> {
    plan_milestone::Entity::delete_by_id(milestone_id).exec(db).await?;
    Ok(())
}

/// Toggle milestone completion
pub async fn toggle_milestone_completion(
    db: &DatabaseConnection,
    milestone_id: String,
) -> Result<PlanMilestoneDto, DbErr> {
    let now = Utc::now().timestamp();

    let milestone_model = plan_milestone::Entity::find_by_id(&milestone_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Milestone not found: {}", milestone_id)))?;

    let new_completed = if milestone_model.completed == 0 { 1 } else { 0 };

    let mut milestone_active: plan_milestone::ActiveModel = milestone_model.into();
    milestone_active.completed = Set(new_completed);
    milestone_active.completed_at = Set(if new_completed == 1 { Some(now) } else { None });
    milestone_active.updated_at = Set(now);

    let updated_milestone = milestone_active.update(db).await?;

    Ok(PlanMilestoneDto {
        id: updated_milestone.id,
        phase_id: updated_milestone.phase_id,
        name: updated_milestone.name,
        description: updated_milestone.description,
        order_index: updated_milestone.order_index,
        completed: updated_milestone.completed != 0,
        completed_at: updated_milestone.completed_at,
        created_at: updated_milestone.created_at,
        updated_at: updated_milestone.updated_at,
    })
}

/// Get plan documents (scans folder and reconciles with DB)
pub async fn get_plan_documents(
    db: &DatabaseConnection,
    plan_id: String,
) -> Result<Vec<PlanDocumentDto>, DbErr> {
    // Get plan to find folder path
    let plan_model = plan::Entity::find_by_id(&plan_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Plan not found: {}", plan_id)))?;

    let folder_path = Path::new(&plan_model.folder_path);

    // Get existing documents from DB sorted by order_index
    let existing_docs: Vec<plan_document::Model> = plan_document::Entity::find()
        .filter(plan_document::Column::PlanId.eq(&plan_id))
        .order_by_asc(plan_document::Column::OrderIndex)
        .all(db)
        .await?;

    let mut existing_paths: std::collections::HashMap<String, plan_document::Model> =
        existing_docs.iter().map(|d| (d.file_path.clone(), d.clone())).collect();

    // Determine next order index
    let mut next_order_index = existing_docs.iter()
        .map(|d| d.order_index)
        .max()
        .unwrap_or(-1) + 1;

    // Scan folder for .md files
    let mut documents = Vec::new();

    if folder_path.exists() {
        for entry in fs::read_dir(folder_path)
            .map_err(|e| DbErr::Custom(format!("Failed to read plan folder: {}", e)))?
        {
            let entry = entry.map_err(|e| DbErr::Custom(format!("Failed to read entry: {}", e)))?;
            let path = entry.path();

            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let file_path_str = path.to_string_lossy().to_string();
                let file_name = path.file_name().unwrap().to_string_lossy().to_string();

                // Check if document exists in DB
                if let Some(doc) = existing_paths.remove(&file_path_str) {
                    // Exists, use DB record
                    documents.push(PlanDocumentDto {
                        id: doc.id,
                        plan_id: doc.plan_id,
                        phase_id: doc.phase_id,
                        file_path: doc.file_path,
                        file_name: doc.file_name,
                        created_at: doc.created_at,
                        updated_at: doc.updated_at,
                        order_index: doc.order_index,
                    });
                } else {
                    // New file, create DB record
                    let now = Utc::now().timestamp();
                    let doc_id = Uuid::new_v4().to_string();

                    let doc_active = plan_document::ActiveModel {
                        id: Set(doc_id.clone()),
                        plan_id: Set(plan_id.clone()),
                        phase_id: Set(None),
                        file_path: Set(file_path_str.clone()),
                        file_name: Set(file_name.clone()),
                        created_at: Set(now),
                        updated_at: Set(now),
                        order_index: Set(next_order_index),
                    };

                    next_order_index += 1;

                    let doc_model = doc_active.insert(db).await?;

                    documents.push(PlanDocumentDto {
                        id: doc_model.id,
                        plan_id: doc_model.plan_id,
                        phase_id: doc_model.phase_id,
                        file_path: doc_model.file_path,
                        file_name: doc_model.file_name,
                        created_at: doc_model.created_at,
                        updated_at: doc_model.updated_at,
                        order_index: doc_model.order_index,
                    });
                }
            }
        }
    }

    // Delete orphaned documents (files that no longer exist)
    for (_, doc) in existing_paths {
        plan_document::Entity::delete_by_id(doc.id).exec(db).await?;
    }

    // Sort documents by order_index just to be safe
    documents.sort_by_key(|d| d.order_index);

    Ok(documents)
}

/// Link document to phase
pub async fn link_document_to_phase(
    db: &DatabaseConnection,
    document_id: String,
    phase_id: Option<String>,
) -> Result<(), DbErr> {
    let now = Utc::now().timestamp();

    let doc_model = plan_document::Entity::find_by_id(&document_id)
        .one(db)
        .await?
        .ok_or_else(|| DbErr::RecordNotFound(format!("Document not found: {}", document_id)))?;

    let mut doc_active: plan_document::ActiveModel = doc_model.into();
    doc_active.phase_id = Set(phase_id);
    doc_active.updated_at = Set(now);

    doc_active.update(db).await?;

    Ok(())
}

/// Reorder plan documents
pub async fn reorder_plan_documents(
    db: &DatabaseConnection,
    plan_id: String,
    document_ids_in_order: Vec<String>,
) -> Result<(), DbErr> {
    let now = Utc::now().timestamp();

    for (index, doc_id) in document_ids_in_order.iter().enumerate() {
        let doc_model = plan_document::Entity::find_by_id(doc_id)
            .one(db)
            .await?
            .ok_or_else(|| DbErr::RecordNotFound(format!("Document not found: {}", doc_id)))?;

        // Verify document belongs to this plan
        if doc_model.plan_id != plan_id {
            return Err(DbErr::Custom("Document does not belong to this plan".to_string()));
        }

        let mut doc_active: plan_document::ActiveModel = doc_model.into();
        doc_active.order_index = Set(index as i32);
        doc_active.updated_at = Set(now);
        doc_active.update(db).await?;
    }

    Ok(())
}
