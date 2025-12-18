use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::db::entities::*;
use super::utils::compute_content_hash;

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceStatus {
    pub resource_id: String,
    pub resource_name: String,
    pub artifact_type: String,
    pub has_unpublished_changes: bool,
    pub current_hash: String,
    pub published_hash: Option<String>,
    pub subscription: Option<SubscriptionStatus>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubscriptionStatus {
    pub subscription_id: String,
    pub catalog_id: String,
    pub catalog_name: String,
    pub current_variation_id: String,
    pub current_variation_hash: String,
    pub latest_variation_id: String,
    pub latest_variation_hash: String,
    pub has_updates: bool,
}

/// Check the status of a single resource (unpublished changes and available updates).
pub async fn check_resource_status(
    db: &DatabaseConnection,
    resource_id: &str,
    project_root: &str,
) -> Result<ResourceStatus, String> {
    // Get the resource
    let resource = library_resource::Entity::find_by_id(resource_id)
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Resource not found: {}", resource_id))?;

    // Read current file content and calculate hash
    let full_path = Path::new(project_root).join(&resource.relative_path);
    let current_content = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let current_hash = compute_content_hash(&current_content);

    // Determine if there are unpublished changes
    let has_unpublished_changes = resource.content_hash.as_ref() != Some(&current_hash);

    // Extract resource name from YAML metadata
    let resource_name = extract_name_from_yaml(&resource.yaml_metadata)
        .unwrap_or_else(|| resource.file_name.clone());

    // Check if resource has a subscription
    let subscription = library_subscription::Entity::find()
        .filter(library_subscription::Column::ResourceId.eq(resource_id))
        .one(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let subscription_status = if let Some(sub) = subscription {
        // Get the catalog
        let catalog = library_catalog::Entity::find_by_id(&sub.catalog_id)
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("Catalog not found: {}", sub.catalog_id))?;

        // Get the current variation (what the user pulled)
        let current_variation = library_variation::Entity::find_by_id(&sub.variation_id)
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("Variation not found: {}", sub.variation_id))?;

        // Get the latest variation for this catalog
        let latest_variation = library_variation::Entity::find()
            .filter(library_variation::Column::CatalogId.eq(&sub.catalog_id))
            .order_by_desc(library_variation::Column::PublishedAt)
            .one(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("No variations found for catalog: {}", sub.catalog_id))?;

        // Check if there are updates available
        let has_updates = latest_variation.id != current_variation.id
            || latest_variation.content_hash != current_variation.content_hash;

        Some(SubscriptionStatus {
            subscription_id: sub.id,
            catalog_id: catalog.id,
            catalog_name: catalog.name,
            current_variation_id: current_variation.id,
            current_variation_hash: current_variation.content_hash,
            latest_variation_id: latest_variation.id,
            latest_variation_hash: latest_variation.content_hash,
            has_updates,
        })
    } else {
        None
    };

    Ok(ResourceStatus {
        resource_id: resource_id.to_string(),
        resource_name,
        artifact_type: resource.artifact_type,
        has_unpublished_changes,
        current_hash,
        published_hash: resource.content_hash,
        subscription: subscription_status,
    })
}

/// Check all resources in a project for unpublished changes and available updates.
pub async fn check_project_for_updates(
    db: &DatabaseConnection,
    project_id: &str,
    project_root: &str,
) -> Result<Vec<ResourceStatus>, String> {
    // Get all active resources for this project
    let resources = library_resource::Entity::find()
        .filter(library_resource::Column::ProjectId.eq(project_id))
        .filter(library_resource::Column::IsDeleted.eq(0))
        .all(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut statuses = Vec::new();

    for resource in resources {
        match check_resource_status(db, &resource.id, project_root).await {
            Ok(status) => statuses.push(status),
            Err(e) => {
                // Log error but continue with other resources
                eprintln!("Failed to check resource {}: {}", resource.id, e);
            }
        }
    }

    Ok(statuses)
}

/// Extract name from YAML metadata JSON string.
fn extract_name_from_yaml(yaml_metadata: &Option<String>) -> Option<String> {
    if let Some(yaml_str) = yaml_metadata {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(yaml_str) {
            return json
                .get("alias")
                .or_else(|| json.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }
    }
    None
}
