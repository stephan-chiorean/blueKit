use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
use tracing::info;

pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Create tasks table
    create_tasks_table(db).await?;

    // Create task_projects junction table
    create_task_projects_table(db).await?;

    // Add status and complexity columns to tasks table
    add_task_status_and_complexity_columns(db).await?;

    // Add type column to tasks table
    add_task_type_column(db).await?;

    // Create library tables
    create_library_workspaces_table(db).await?;
    create_library_artifacts_table(db).await?;
    create_library_resources_table(db).await?;

    // Migrate library schema (Phase 2)
    migrate_library_artifacts_to_catalogs(db).await?;
    create_library_variations_table(db).await?;
    create_library_subscriptions_table(db).await?;

    // Library collections (Phase 3)
    create_library_collections_table(db).await?;
    create_library_collection_catalogs_table(db).await?;
    add_collection_description_and_tags(db).await?;

    // Add pinned field to library_workspaces
    add_library_workspaces_pinned_field(db).await?;

    // Create projects and checkpoints tables
    create_projects_table(db).await?;
    create_checkpoints_table(db).await?;

    // Create plans tables
    create_plans_table(db).await?;
    create_plan_phases_table(db).await?;
    create_plan_milestones_table(db).await?;
    create_plan_documents_table(db).await?;
    create_plan_links_table(db).await?;

    // Add order_index to plan_documents
    add_plan_documents_order_index(db).await?;

    // Create walkthrough tables
    create_walkthroughs_table(db).await?;
    create_walkthrough_takeaways_table(db).await?;
    create_walkthrough_notes_table(db).await?;

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

async fn add_task_type_column(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Check if type column exists
    let check_type_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('tasks')
        WHERE name='type'
    "#;

    let result = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_type_sql.to_string(),
    )).await?;

    let type_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else {
        false
    };

    // Add type column if it doesn't exist
    if !type_exists {
        let add_type_sql = r#"
            ALTER TABLE tasks ADD COLUMN type TEXT
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            add_type_sql.to_string(),
        )).await?;

        info!("Added type column to tasks table");
    } else {
        info!("Type column already exists in tasks table");
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

async fn create_projects_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            description TEXT,
            tags TEXT,
            git_connected INTEGER NOT NULL DEFAULT 0,
            git_url TEXT,
            git_branch TEXT,
            git_remote TEXT,
            last_commit_sha TEXT,
            last_synced_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_opened_at INTEGER
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_projects_git_connected ON projects(git_connected);
        CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Projects table and indexes created or already exist");

    Ok(())
}

async fn create_checkpoints_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS checkpoints (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            git_commit_sha TEXT NOT NULL,
            git_branch TEXT,
            git_url TEXT,
            name TEXT NOT NULL,
            description TEXT,
            tags TEXT,
            checkpoint_type TEXT NOT NULL,
            parent_checkpoint_id TEXT,
            created_from_project_id TEXT,
            pinned_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_checkpoint_id) REFERENCES checkpoints(id)
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes for performance
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_checkpoints_project_id ON checkpoints(project_id);
        CREATE INDEX IF NOT EXISTS idx_checkpoints_commit_sha ON checkpoints(git_commit_sha);
        CREATE INDEX IF NOT EXISTS idx_checkpoints_type ON checkpoints(checkpoint_type);
        CREATE INDEX IF NOT EXISTS idx_checkpoints_parent_id ON checkpoints(parent_checkpoint_id);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Checkpoints table and indexes created or already exist");

    Ok(())
}

async fn create_plans_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            project_id TEXT NOT NULL,
            folder_path TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            brainstorm_link TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_plans_project_id ON plans(project_id);
        CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Plans table and indexes created or already exist");

    Ok(())
}

async fn create_plan_phases_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS plan_phases (
            id TEXT PRIMARY KEY NOT NULL,
            plan_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            order_index INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            started_at INTEGER,
            completed_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_plan_phases_plan_id ON plan_phases(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_phases_order ON plan_phases(plan_id, order_index);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Plan phases table and indexes created or already exist");

    Ok(())
}

async fn create_plan_milestones_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS plan_milestones (
            id TEXT PRIMARY KEY NOT NULL,
            phase_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            order_index INTEGER NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            completed_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (phase_id) REFERENCES plan_phases(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_plan_milestones_phase_id ON plan_milestones(phase_id);
        CREATE INDEX IF NOT EXISTS idx_plan_milestones_order ON plan_milestones(phase_id, order_index);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Plan milestones table and indexes created or already exist");

    Ok(())
}

async fn create_plan_documents_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS plan_documents (
            id TEXT PRIMARY KEY NOT NULL,
            plan_id TEXT NOT NULL,
            phase_id TEXT,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
            FOREIGN KEY (phase_id) REFERENCES plan_phases(id) ON DELETE SET NULL
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_plan_documents_plan_id ON plan_documents(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_documents_phase_id ON plan_documents(phase_id);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Plan documents table and indexes created or already exist");

    Ok(())
}

async fn add_plan_documents_order_index(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Check if order_index column exists
    let check_column_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('plan_documents')
        WHERE name='order_index'
    "#;

    let result = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_column_sql.to_string(),
    )).await?;

    let column_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else {
        false
    };

    if !column_exists {
        let add_column_sql = r#"
            ALTER TABLE plan_documents ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            add_column_sql.to_string(),
        )).await?;

        // Create index for ordering
        let index_sql = r#"
            CREATE INDEX IF NOT EXISTS idx_plan_documents_order ON plan_documents(plan_id, order_index);
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            index_sql.to_string(),
        )).await?;

        info!("Added order_index to plan_documents table");
    } else {
        info!("order_index column already exists in plan_documents table");
    }

    Ok(())
}

async fn create_plan_links_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS plan_links (
            id TEXT PRIMARY KEY NOT NULL,
            plan_id TEXT NOT NULL,
            linked_plan_path TEXT NOT NULL,
            source TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
            UNIQUE(plan_id, linked_plan_path)
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_plan_links_plan_id ON plan_links(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_links_path ON plan_links(linked_plan_path);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Plan links table and indexes created or already exist");

    Ok(())
}

async fn create_library_resources_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_resources (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            content_hash TEXT,
            yaml_metadata TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_modified_at INTEGER,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes for performance
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_resources_project_id ON library_resources(project_id);
        CREATE INDEX IF NOT EXISTS idx_library_resources_type ON library_resources(artifact_type);
        CREATE INDEX IF NOT EXISTS idx_library_resources_path ON library_resources(project_id, relative_path);
        CREATE INDEX IF NOT EXISTS idx_library_resources_hash ON library_resources(content_hash);
        CREATE INDEX IF NOT EXISTS idx_library_resources_active ON library_resources(project_id, is_deleted);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Library resources table and indexes created or already exist");

    Ok(())
}

async fn migrate_library_artifacts_to_catalogs(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Check if library_catalogs already exists
    let check_catalogs_sql = r#"
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='library_catalogs'
    "#;

    let catalogs_exists = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_catalogs_sql.to_string(),
    )).await?.is_some();

    if catalogs_exists {
        info!("Library catalogs table already exists, skipping migration");
        return Ok(());
    }

    // Check if old library_artifacts table exists
    let check_artifacts_sql = r#"
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='library_artifacts'
    "#;

    let artifacts_exists = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_artifacts_sql.to_string(),
    )).await?.is_some();

    if !artifacts_exists {
        // Neither table exists, create catalogs table directly
        info!("No existing library_artifacts table, creating library_catalogs directly");
        return create_library_catalogs_table(db).await;
    }

    // Table exists - migrate data
    info!("Migrating library_artifacts to library_catalogs...");

    // Create new catalogs table
    create_library_catalogs_table(db).await?;

    // Migrate existing data
    let migrate_data_sql = r#"
        INSERT INTO library_catalogs (id, workspace_id, name, description, artifact_type, tags, remote_path, created_at, updated_at)
        SELECT
            id,
            workspace_id,
            COALESCE(
                substr(library_path, instr(library_path, '/') + 1),
                library_path
            ) as name,
            NULL as description,
            artifact_type,
            '[]' as tags,
            library_path as remote_path,
            published_at as created_at,
            last_synced_at as updated_at
        FROM library_artifacts
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        migrate_data_sql.to_string(),
    )).await?;

    // Drop old table
    let drop_sql = "DROP TABLE IF EXISTS library_artifacts";
    db.execute(Statement::from_string(
        db.get_database_backend(),
        drop_sql.to_string(),
    )).await?;

    info!("Migration complete: library_artifacts → library_catalogs");

    Ok(())
}

async fn create_library_catalogs_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_catalogs (
            id TEXT PRIMARY KEY NOT NULL,
            workspace_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            artifact_type TEXT NOT NULL,
            tags TEXT,
            remote_path TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES library_workspaces(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    )).await?;

    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_catalogs_workspace_id ON library_catalogs(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_library_catalogs_type ON library_catalogs(artifact_type);
        CREATE INDEX IF NOT EXISTS idx_library_catalogs_remote_path ON library_catalogs(workspace_id, remote_path);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    )).await?;

    info!("Library catalogs table created");
    Ok(())
}

async fn create_library_variations_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_variations (
            id TEXT PRIMARY KEY NOT NULL,
            catalog_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            remote_path TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            github_commit_sha TEXT,
            published_at INTEGER NOT NULL,
            publisher_name TEXT,
            version_tag TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (catalog_id) REFERENCES library_catalogs(id) ON DELETE CASCADE,
            FOREIGN KEY (workspace_id) REFERENCES library_workspaces(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    )).await?;

    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_variations_catalog_id ON library_variations(catalog_id);
        CREATE INDEX IF NOT EXISTS idx_library_variations_workspace_id ON library_variations(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_library_variations_hash ON library_variations(content_hash);
        CREATE INDEX IF NOT EXISTS idx_library_variations_published_at ON library_variations(catalog_id, published_at DESC);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    )).await?;

    info!("Library variations table created");
    Ok(())
}

async fn create_library_subscriptions_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_subscriptions (
            id TEXT PRIMARY KEY NOT NULL,
            catalog_id TEXT NOT NULL,
            variation_id TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            pulled_at INTEGER NOT NULL,
            last_checked_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (catalog_id) REFERENCES library_catalogs(id) ON DELETE CASCADE,
            FOREIGN KEY (variation_id) REFERENCES library_variations(id) ON DELETE CASCADE,
            FOREIGN KEY (resource_id) REFERENCES library_resources(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(resource_id)
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    )).await?;

    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_subscriptions_catalog_id ON library_subscriptions(catalog_id);
        CREATE INDEX IF NOT EXISTS idx_library_subscriptions_project_id ON library_subscriptions(project_id);
        CREATE INDEX IF NOT EXISTS idx_library_subscriptions_variation_id ON library_subscriptions(variation_id);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    )).await?;

    info!("Library subscriptions table created");
    Ok(())
}

async fn create_library_collections_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_collections (
            id TEXT PRIMARY KEY NOT NULL,
            workspace_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES library_workspaces(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    )).await?;

    // Create index on workspace_id for faster lookups
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_collections_workspace_id
        ON library_collections(workspace_id)
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    )).await?;

    info!("Library collections table created");
    Ok(())
}

async fn create_library_collection_catalogs_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS library_collection_catalogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id TEXT NOT NULL,
            catalog_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (collection_id) REFERENCES library_collections(id) ON DELETE CASCADE,
            FOREIGN KEY (catalog_id) REFERENCES library_catalogs(id) ON DELETE CASCADE,
            UNIQUE(collection_id, catalog_id)
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    )).await?;

    // Create indexes for efficient lookups
    let index_collection_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_collection_catalogs_collection_id
        ON library_collection_catalogs(collection_id)
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_collection_sql.to_string(),
    )).await?;

    let index_catalog_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_collection_catalogs_catalog_id
        ON library_collection_catalogs(catalog_id)
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_catalog_sql.to_string(),
    )).await?;

    info!("Library collection catalogs junction table created");
    Ok(())
}

async fn add_library_workspaces_pinned_field(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Check if the column already exists by trying to add it (SQLite will error if it exists)
    // We'll use a more robust approach: try to alter the table
    let sql = r#"
        ALTER TABLE library_workspaces 
        ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0
    "#;

    // SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
    // So we'll catch the error if the column already exists
    match db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    )).await {
        Ok(_) => {
            info!("Added pinned field to library_workspaces table");
        }
        Err(e) => {
            // If the error is about the column already existing, that's fine
            if e.to_string().contains("duplicate column") || e.to_string().contains("already exists") {
                info!("pinned field already exists in library_workspaces table");
            } else {
                return Err(e);
            }
        }
    }

    // Create index on pinned for efficient querying
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_library_workspaces_pinned
        ON library_workspaces(pinned)
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    )).await?;

    info!("Created index on library_workspaces.pinned");
    Ok(())
}

async fn add_collection_description_and_tags(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Check if description column exists
    let check_description_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('library_collections')
        WHERE name='description'
    "#;

    let result = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_description_sql.to_string(),
    )).await?;

    let description_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else {
        false
    };

    // Add description column if it doesn't exist
    if !description_exists {
        let add_description_sql = r#"
            ALTER TABLE library_collections ADD COLUMN description TEXT
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            add_description_sql.to_string(),
        )).await?;

        info!("Added description column to library_collections table");
    } else {
        info!("Description column already exists in library_collections table");
    }

    // Check if tags column exists
    let check_tags_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('library_collections')
        WHERE name='tags'
    "#;

    let result = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_tags_sql.to_string(),
    )).await?;

    let tags_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else {
        false
    };

    // Add tags column if it doesn't exist
    if !tags_exists {
        let add_tags_sql = r#"
            ALTER TABLE library_collections ADD COLUMN tags TEXT
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            add_tags_sql.to_string(),
        )).await?;

        info!("Added tags column to library_collections table");
    } else {
        info!("Tags column already exists in library_collections table");
    }

    Ok(())
}

async fn create_walkthroughs_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS walkthroughs (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'not_started',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_walkthroughs_project_id ON walkthroughs(project_id);
        CREATE INDEX IF NOT EXISTS idx_walkthroughs_status ON walkthroughs(status);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_walkthroughs_file_path ON walkthroughs(project_id, file_path);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Walkthroughs table and indexes created or already exist");

    Ok(())
}

async fn create_walkthrough_takeaways_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS walkthrough_takeaways (
            id TEXT PRIMARY KEY NOT NULL,
            walkthrough_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            completed_at INTEGER,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (walkthrough_id) REFERENCES walkthroughs(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_walkthrough_takeaways_walkthrough_id ON walkthrough_takeaways(walkthrough_id);
        CREATE INDEX IF NOT EXISTS idx_walkthrough_takeaways_order ON walkthrough_takeaways(walkthrough_id, sort_order);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Walkthrough takeaways table and indexes created or already exist");

    Ok(())
}

async fn create_walkthrough_notes_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS walkthrough_notes (
            id TEXT PRIMARY KEY NOT NULL,
            walkthrough_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (walkthrough_id) REFERENCES walkthroughs(id) ON DELETE CASCADE
        )
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await?;

    // Create indexes
    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_walkthrough_notes_walkthrough_id ON walkthrough_notes(walkthrough_id);
    "#;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        index_sql.to_string(),
    ))
    .await?;

    info!("Walkthrough notes table and indexes created or already exist");

    Ok(())
}
