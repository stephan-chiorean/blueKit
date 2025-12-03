use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String, // "pinned", "high", "long term", "nit"
    pub tags: String,     // JSON array stored as string
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::task_project::Entity")]
    TaskProjects,
}

impl Related<super::task_project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TaskProjects.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
