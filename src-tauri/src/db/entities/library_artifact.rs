use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "library_artifacts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub workspace_id: String,
    pub local_path: String,
    pub library_path: String,
    pub artifact_type: String, // "kit", "walkthrough", "blueprint", etc.
    pub published_at: i64,
    pub last_synced_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::library_workspace::Entity",
        from = "Column::WorkspaceId",
        to = "super::library_workspace::Column::Id"
    )]
    LibraryWorkspace,
}

impl Related<super::library_workspace::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibraryWorkspace.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}



