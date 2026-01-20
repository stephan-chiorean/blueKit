use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "plan_documents")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
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

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::plan::Entity",
        from = "Column::PlanId",
        to = "super::plan::Column::Id"
    )]
    Plan,
    #[sea_orm(
        belongs_to = "super::plan_phase::Entity",
        from = "Column::PhaseId",
        to = "super::plan_phase::Column::Id"
    )]
    Phase,
}

impl Related<super::plan::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Plan.def()
    }
}

impl Related<super::plan_phase::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Phase.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
