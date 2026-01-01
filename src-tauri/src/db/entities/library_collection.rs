use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "library_collections")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>, // JSON array
    pub color: Option<String>,
    pub order_index: i32,
    pub created_at: i64,
    pub updated_at: i64,
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
