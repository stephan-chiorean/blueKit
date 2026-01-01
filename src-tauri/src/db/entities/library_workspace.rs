use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "library_workspaces")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub name: String,
    pub github_owner: String,
    pub github_repo: String,
    pub pinned: i32, // SQLite uses INTEGER for booleans (0 = false, 1 = true)
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::library_artifact::Entity")]
    LibraryArtifacts,
}

impl Related<super::library_artifact::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibraryArtifacts.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}




