use sea_orm::{Database, DbErr};
pub use sea_orm::DatabaseConnection;
use std::env;
use std::path::PathBuf;
use tracing::info;

pub mod entities;
pub mod migrations;
pub mod task_operations;
pub mod project_operations;
pub mod plan_operations;
pub mod walkthrough_operations;

/// Get the path to the SQLite database file
pub fn get_db_path() -> Result<PathBuf, String> {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;

    let bluekit_dir = PathBuf::from(&home_dir).join(".bluekit");

    // Ensure .bluekit directory exists
    if !bluekit_dir.exists() {
        std::fs::create_dir_all(&bluekit_dir)
            .map_err(|e| format!("Failed to create .bluekit directory: {}", e))?;
    }

    Ok(bluekit_dir.join("bluekit.db"))
}

/// Initialize the database connection and run migrations
pub async fn initialize_database() -> Result<DatabaseConnection, DbErr> {
    let db_path = get_db_path()
        .map_err(|e| DbErr::Custom(format!("Failed to get database path: {}", e)))?;

    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    info!("Connecting to database at: {}", db_url);

    // Create database connection
    let db = Database::connect(&db_url).await?;

    // Run migrations
    info!("Running database migrations...");
    migrations::run_migrations(&db).await?;

    info!("Database initialized successfully");

    Ok(db)
}
