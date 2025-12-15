use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub tags: Option<String>, // JSON array serialized as string

    // Git metadata (populated when user clicks "Connect Git")
    #[serde(rename = "gitConnected")]
    pub git_connected: bool,
    #[serde(rename = "gitUrl")]
    pub git_url: Option<String>,
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    #[serde(rename = "gitRemote")]
    pub git_remote: Option<String>,  // e.g., "origin"
    #[serde(rename = "lastCommitSha")]
    pub last_commit_sha: Option<String>,
    #[serde(rename = "lastSyncedAt")]
    pub last_synced_at: Option<i64>,  // Unix timestamp in milliseconds

    // Timestamps (use i64 for consistency with library_workspace)
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "lastOpenedAt")]
    pub last_opened_at: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::checkpoint::Entity")]
    Checkpoints,
}

impl Related<super::checkpoint::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Checkpoints.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
