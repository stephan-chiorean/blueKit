use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
use tracing::info;

pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Create tasks table
    create_tasks_table(db).await?;

    // Create task_projects junction table
    create_task_projects_table(db).await?;

    // Add status and complexity columns to tasks table
    add_task_status_and_complexity_columns(db).await?;

    // Create library tables
    create_library_workspaces_table(db).await?;
    create_library_artifacts_table(db).await?;

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

async fn add_task_status_and_complexity_columns(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Check if status column exists
    let check_status_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('tasks')
        WHERE name='status'
    "#;

    let result = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_status_sql.to_string(),
    )).await?;

    let status_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else {
        false
    };

    // Add status column if it doesn't exist
    if !status_exists {
        let add_status_sql = r#"
            ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'backlog'
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            add_status_sql.to_string(),
        )).await?;

        info!("Added status column to tasks table");
    } else {
        info!("Status column already exists in tasks table");
    }

    // Check if complexity column exists
    let check_complexity_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('tasks')
        WHERE name='complexity'
    "#;

    let result = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_complexity_sql.to_string(),
    )).await?;

    let complexity_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else {
        false
    };

    // Add complexity column if it doesn't exist
    if !complexity_exists {
        let add_complexity_sql = r#"
            ALTER TABLE tasks ADD COLUMN complexity TEXT
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            add_complexity_sql.to_string(),
        )).await?;

        info!("Added complexity column to tasks table");
    } else {
        info!("Complexity column already exists in tasks table");
    }

    Ok(())
}

async fn create_library_workspaces_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_workspaces (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            github_owner TEXT NOT NULL,
            github_repo TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    info!("Library workspaces table created or already exists");

    Ok(())
}

async fn create_library_artifacts_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_artifacts (
            id TEXT PRIMARY KEY NOT NULL,
            workspace_id TEXT NOT NULL,
            local_path TEXT NOT NULL,
            library_path TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            published_at INTEGER NOT NULL,
            last_synced_at INTEGER NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES library_workspaces(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes for better query performance
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_artifacts_workspace_id ON library_artifacts(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_library_artifacts_local_path ON library_artifacts(local_path);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Library artifacts table and indexes created or already exist");

    Ok(())
}
