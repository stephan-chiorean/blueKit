use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "plan_milestones")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[serde(rename = "phaseId")]
    pub phase_id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
    pub completed: i32, // SQLite boolean (0 or 1)
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::plan_phase::Entity",
        from = "Column::PhaseId",
        to = "super::plan_phase::Column::Id"
    )]
    Phase,
}

impl Related<super::plan_phase::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Phase.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
