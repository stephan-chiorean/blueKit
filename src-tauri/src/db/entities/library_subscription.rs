use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "library_subscriptions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub catalog_id: String,
    pub variation_id: String,
    pub resource_id: String,
    pub project_id: String,
    pub pulled_at: i64,
    pub last_checked_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::library_catalog::Entity",
        from = "Column::CatalogId",
        to = "super::library_catalog::Column::Id"
    )]
    LibraryCatalog,

    #[sea_orm(
        belongs_to = "super::library_variation::Entity",
        from = "Column::VariationId",
        to = "super::library_variation::Column::Id"
    )]
    LibraryVariation,

    #[sea_orm(
        belongs_to = "super::library_resource::Entity",
        from = "Column::ResourceId",
        to = "super::library_resource::Column::Id"
    )]
    LibraryResource,

    #[sea_orm(
        belongs_to = "super::project::Entity",
        from = "Column::ProjectId",
        to = "super::project::Column::Id"
    )]
    Project,
}

impl Related<super::library_catalog::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibraryCatalog.def()
    }
}

impl Related<super::library_variation::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibraryVariation.def()
    }
}

impl Related<super::library_resource::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LibraryResource.def()
    }
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
