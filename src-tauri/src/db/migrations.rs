use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
use tracing::info;

pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Create tasks table
    create_tasks_table(db).await?;

    // Create task_projects junction table
    create_task_projects_table(db).await?;

    Ok(())
}

async fn create_tasks_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT NOT NULL DEFAULT 'nit',
            tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    info!("Tasks table created or already exists");

    Ok(())
}

async fn create_task_projects_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS task_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            UNIQUE(task_id, project_id)
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes for better query performance
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_task_projects_task_id ON task_projects(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_projects_project_id ON task_projects(project_id);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Task_projects table and indexes created or already exist");

    Ok(())
}
