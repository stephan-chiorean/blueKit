use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "walkthrough_takeaways")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[serde(rename = "walkthroughId")]
    pub walkthrough_id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
    pub completed: i32, // SQLite boolean (0 or 1)
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::walkthrough::Entity",
        from = "Column::WalkthroughId",
        to = "super::walkthrough::Column::Id"
    )]
    Walkthrough,
}

impl Related<super::walkthrough::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Walkthrough.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
