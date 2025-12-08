---
id: database-migrations-system
alias: Database Migrations System
type: walkthrough
is_base: false
version: 1
tags:
  - database
  - migrations
  - schema
description: Understanding the database migrations system in migrations.rs, how it safely handles schema changes, and how to extend it for future migrations
complexity: moderate
format: guide
---
# Database Migrations System

This walkthrough explains the database migrations system used in BlueKit to manage schema changes safely. The system was created to handle adding new columns (like `status` and `complexity`) to existing tables without breaking existing databases.

## Overview

The migrations system in `src-tauri/src/db/migrations.rs` provides a way to:
- Create database tables on first run
- Add new columns to existing tables safely
- Ensure schema consistency across different database states
- Handle both fresh installs and upgrades gracefully

## When Migrations Run

Migrations execute automatically during application startup:

```27:46:src-tauri/src/db/mod.rs
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
```

This function is called from `main.rs` during the Tauri app setup phase, ensuring the database schema is up-to-date before any commands can execute.

## Migration Execution Flow

The `run_migrations` function orchestrates all migrations in order:

```4:15:src-tauri/src/db/migrations.rs
pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Create tasks table
    create_tasks_table(db).await?;

    // Create task_projects junction table
    create_task_projects_table(db).await?;

    // Add status and complexity columns to tasks table
    add_task_status_and_complexity_columns(db).await?;

    Ok(())
}
```

**Key points:**
- Migrations run sequentially (one after another)
- Each migration uses `?` to propagate errors
- If any migration fails, the entire process stops
- Migrations are idempotent (safe to run multiple times)

## Migration Patterns

### Pattern 1: Creating Tables

The `create_tasks_table` function uses `CREATE TABLE IF NOT EXISTS`:

```17:39:src-tauri/src/db/migrations.rs
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
```

**Why `IF NOT EXISTS`:**
- Safe for fresh installs (creates the table)
- Safe for existing databases (does nothing if table exists)
- No error if run multiple times

### Pattern 2: Creating Junction Tables with Indexes

The `create_task_projects_table` function shows how to create relationships:

```41:73:src-tauri/src/db/migrations.rs
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
```

**Key features:**
- Foreign key constraints for data integrity
- `UNIQUE` constraint to prevent duplicate relationships
- Indexes for query performance
- `ON DELETE CASCADE` to clean up related records

### Pattern 3: Adding Columns Safely (The Important One!)

The `add_task_status_and_complexity_columns` function demonstrates the critical pattern for adding columns to existing tables:

```75:145:src-tauri/src/db/migrations.rs
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
```

**Why this pattern is necessary:**

SQLite doesn't support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. You must:
1. **Check first**: Query `pragma_table_info()` to see if the column exists
2. **Add conditionally**: Only run `ALTER TABLE` if the column doesn't exist
3. **Handle defaults**: Use `DEFAULT` values for `NOT NULL` columns to avoid errors on existing rows

**The check pattern:**
```sql
SELECT COUNT(*) as count
FROM pragma_table_info('tasks')
WHERE name='status'
```

This queries SQLite's table metadata to see if a column exists. If `count > 0`, the column exists.

## When to Use Migrations

Use migrations when you need to:

1. **Add new columns** to existing tables (like `status` and `complexity`)
2. **Create new tables** for new features
3. **Add indexes** for performance optimization
4. **Modify constraints** (though be careful with existing data)
5. **Create relationships** between tables

**Don't use migrations for:**
- Data updates (use regular queries)
- Temporary changes (use transactions)
- Reversible operations that might need rollback (consider a different approach)

## How to Extend for Future Migrations

### Step 1: Create a New Migration Function

Add a new async function following the existing patterns:

```rust
async fn add_your_new_column(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Check if column exists
    let check_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('tasks')
        WHERE name='your_column_name'
    "#;

    let result = db.query_one(Statement::from_string(
        db.get_database_backend(),
        check_sql.to_string(),
    )).await?;

    let column_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else {
        false
    };

    // Add column if it doesn't exist
    if !column_exists {
        let add_sql = r#"
            ALTER TABLE tasks ADD COLUMN your_column_name TEXT
        "#;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            add_sql.to_string(),
        )).await?;

        info!("Added your_column_name column to tasks table");
    } else {
        info!("your_column_name column already exists in tasks table");
    }

    Ok(())
}
```

### Step 2: Add It to `run_migrations`

Add your new migration function to the execution chain:

```rust
pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    create_tasks_table(db).await?;
    create_task_projects_table(db).await?;
    add_task_status_and_complexity_columns(db).await?;
    add_your_new_column(db).await?;  // Add your new migration here
    
    Ok(())
}
```

### Step 3: Consider Migration Order

**Important:** Migrations run in order. If migration B depends on migration A, make sure A comes first in the `run_migrations` function.

For example:
- Create tables before adding columns to them
- Create base tables before creating junction tables that reference them
- Add required columns before adding optional ones (if there are dependencies)

## Best Practices

1. **Always check before adding columns** - Use the `pragma_table_info` pattern
2. **Use `IF NOT EXISTS` for tables** - Makes migrations idempotent
3. **Provide default values** - For `NOT NULL` columns, always include `DEFAULT`
4. **Log migration steps** - Use `info!()` to track what happened
5. **Test on existing databases** - Don't just test on fresh installs
6. **Keep migrations additive** - Avoid dropping columns or tables in migrations (handle separately if needed)

## Common Pitfalls

1. **Forgetting to check column existence** - Will cause errors on second run
2. **Missing DEFAULT values** - `NOT NULL` columns without defaults fail on existing rows
3. **Wrong migration order** - Referencing tables/columns that don't exist yet
4. **Not handling errors** - Always use `?` to propagate errors properly

## Summary

The migrations system provides a safe, idempotent way to evolve the database schema. The key pattern for adding columns is:

1. Check if column exists using `pragma_table_info`
2. Only add the column if it doesn't exist
3. Use appropriate defaults for `NOT NULL` columns
4. Log the operation for debugging

This pattern was essential when adding `status` and `complexity` columns to the tasks table, allowing the app to work with both old and new database schemas seamlessly.
