use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "plan_phases")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[serde(rename = "planId")]
    pub plan_id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
    pub status: String, // 'pending', 'in_progress', 'completed'
    #[serde(rename = "startedAt")]
    pub started_at: Option<i64>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::plan_milestone::Entity")]
    Milestones,
    #[sea_orm(
        belongs_to = "super::plan::Entity",
        from = "Column::PlanId",
        to = "super::plan::Column::Id"
    )]
    Plan,
}

impl Related<super::plan_milestone::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Milestones.def()
    }
}

impl Related<super::plan::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Plan.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
