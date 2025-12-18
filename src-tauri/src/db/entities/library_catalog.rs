use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "library_catalogs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    pub artifact_type: String,
    pub tags: Option<String>, // JSON array
    pub remote_path: String,
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

    #[sea_orm(has_many = "super::library_variation::Entity")]
    LibraryVariations,

    #[sea_orm(has_many = "super::library_subscription::Entity")]
    LibrarySubscriptions,
}

impl Related<super::library_workspace::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibraryWorkspace.def()
    }
}

impl Related<super::library_variation::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibraryVariations.def()
    }
}

impl Related<super::library_subscription::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibrarySubscriptions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
