use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "plans")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "folderPath")]
    pub folder_path: String,
    pub description: Option<String>,
    pub status: String, // 'active', 'completed', 'archived'
    #[serde(rename = "brainstormLink")]
    pub brainstorm_link: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::plan_phase::Entity")]
    Phases,
    #[sea_orm(has_many = "super::plan_document::Entity")]
    Documents,
}

impl Related<super::plan_phase::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Phases.def()
    }
}

impl Related<super::plan_document::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Documents.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
