use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "walkthroughs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String, // 'not_started', 'in_progress', 'completed'
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::walkthrough_takeaway::Entity")]
    Takeaways,
    #[sea_orm(has_many = "super::walkthrough_note::Entity")]
    Notes,
}

impl Related<super::walkthrough_takeaway::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Takeaways.def()
    }
}

impl Related<super::walkthrough_note::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Notes.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
