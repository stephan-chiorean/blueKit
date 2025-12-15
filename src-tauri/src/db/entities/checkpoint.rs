use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "checkpoints")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,

    // Foreign key to projects table
    #[sea_orm(indexed)]
    #[serde(rename = "projectId")]
    pub project_id: String,

    // Git metadata
    #[serde(rename = "gitCommitSha")]
    pub git_commit_sha: String,  // 40-char hex string
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    #[serde(rename = "gitUrl")]
    pub git_url: Option<String>,

    // Checkpoint metadata
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>, // JSON array: ["api-refactor", "working-auth"]

    // Checkpoint type: "milestone" | "experiment" | "template" | "backup"
    #[serde(rename = "checkpointType")]
    pub checkpoint_type: String,

    // Lineage tracking
    #[serde(rename = "parentCheckpointId")]
    pub parent_checkpoint_id: Option<String>, // Self-referential foreign key

    // Project creation tracking
    #[serde(rename = "createdFromProjectId")]
    pub created_from_project_id: Option<String>, // Track if checkpoint spawned new project

    // Timestamps (i64 for consistency)
    #[serde(rename = "pinnedAt")]
    pub pinned_at: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::project::Entity",
        from = "Column::ProjectId",
        to = "super::project::Column::Id",
        on_delete = "Cascade"
    )]
    Project,

    // Self-referential for parent checkpoint
    #[sea_orm(
        belongs_to = "Entity",
        from = "Column::ParentCheckpointId",
        to = "Column::Id"
    )]
    ParentCheckpoint,
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
