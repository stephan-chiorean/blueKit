---
id: database-state-injection
alias: Database State Injection in Tauri
type: walkthrough
is_base: false
version: 1
tags:
  - tauri
  - database
  - state-management
description: Step-by-step guide to injecting database connections into Tauri commands using State, with Express.js dependency injection comparisons
complexity: moderate
format: guide
---
# Database State Injection in Tauri (For Express.js Developers)

If you're coming from Express.js, you're used to passing database connections through middleware or request objects. Tauri has a similar concept called **State injection** that automatically provides shared resources (like database connections) to your commands.

## The Big Picture

**In Express.js**, you typically:
1. Create a database connection pool at startup
2. Attach it to `req` via middleware
3. Access it in route handlers

**In Tauri**, you:
1. Initialize the database connection at startup
2. Register it with `app.manage()`
3. Access it via `State<'_, DatabaseConnection>` parameter

Same concept, different syntax!

## Express.js vs Tauri: Side by Side

### In Express.js:

```typescript
// 1. Create connection pool at startup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 2. Middleware to attach to req
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// 3. Use in route handler
app.get('/api/tasks', async (req, res) => {
  const tasks = await req.db.query('SELECT * FROM tasks');
  res.json(tasks.rows);
});
```

### In Tauri:

```rust
// 1. Initialize at startup (in main.rs)
let db = db::initialize_database().await?;
app.manage(db);

// 2. Access via State parameter (automatic!)
#[tauri::command]
async fn get_tasks(
    db: State<'_, DatabaseConnection>,  // Injected automatically!
) -> Result<Vec<Task>, String> {
    // 3. Use the connection
    let tasks = db::get_tasks(db.inner()).await?;
    Ok(tasks)
}
```

**Key difference**: In Tauri, you don't write middleware—the `State` parameter type tells Tauri "I need this resource" and it's automatically provided!

## Step-by-Step: Setting Up State

### Step 1: Initialize the Database Connection

In `main.rs`, you initialize the database during app setup:

```78:93:src-tauri/src/main.rs
        .setup(|app| {
            // Initialize database synchronously before app starts accepting commands
            // Use a channel to wait for the async initialization to complete
            let (tx, rx) = std::sync::mpsc::channel();

            tauri::async_runtime::spawn(async move {
                let result = db::initialize_database().await;
                let _ = tx.send(result);
            });

            // Wait for initialization to complete
            let db = rx.recv()
                .expect("Database initialization channel closed unexpectedly")
                .expect("Failed to initialize database");

            app.manage(db);
```

**What's happening here:**
- `db::initialize_database()` creates the database connection (async)
- `app.manage(db)` registers it with Tauri's state system
- This makes it available to all commands that request it

**Express equivalent:**
```typescript
const db = await initializeDatabase();
app.locals.db = db;  // Similar to app.manage()
```

### Step 2: The Database Initialization Function

Let's look at what `initialize_database()` does:

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

This is like your Express database setup:
- Creates the connection
- Runs migrations (like your schema setup)
- Returns the connection for use

## Step-by-Step: Using State in Commands

### Step 1: Declare State in Command Parameters

To access the database in a command, add `State<'_, DatabaseConnection>` as a parameter:

```1730:1738:src-tauri/src/commands.rs
#[tauri::command]
pub async fn db_get_tasks(
    db: State<'_, sea_orm::DatabaseConnection>,
    project_ids: Option<Vec<String>>,
) -> Result<Vec<crate::db::task_operations::TaskDto>, String> {
    crate::db::task_operations::get_tasks(db.inner(), project_ids)
        .await
        .map_err(|e| format!("Failed to get tasks: {}", e))
}
```

**Breaking down `State<'_, DatabaseConnection>`:**
- `State` = Tauri's state wrapper type
- `'_` = Lifetime parameter (Rust's way of saying "borrow for the function call")
- `DatabaseConnection` = The actual type you registered with `app.manage()`

**Express equivalent:**
```typescript
app.get('/api/tasks', async (req, res) => {
  const db = req.app.locals.db;  // Similar to State
  const tasks = await db.query('SELECT * FROM tasks');
  res.json(tasks.rows);
});
```

### Step 2: Access the Inner Value

To use the connection, call `.inner()`:

```rust
db.inner()  // Gets the actual DatabaseConnection
```

This is because `State` is a wrapper that provides thread-safe access. The `.inner()` method gives you the underlying value.

**Express equivalent:**
```typescript
// In Express, req.app.locals.db is already the connection
// No .inner() needed because there's no wrapper
```

### Step 3: Pass to Business Logic

Once you have the connection, pass it to your business logic functions:

```1772:1782:src-tauri/src/commands.rs
    crate::db::task_operations::create_task(
        db.inner(),
        title,
        description,
        priority,
        tags,
        project_ids,
    )
    .await
    .map_err(|e| format!("Failed to create task: {}", e))
```

This keeps your commands thin (like Express route handlers) and your business logic separate (like Express service layers).

## How State Injection Works

### The Magic Behind `State`

When Tauri sees `State<'_, DatabaseConnection>` in a command parameter:

1. **Type Matching**: It looks for a value registered with `app.manage()` that matches `DatabaseConnection`
2. **Automatic Injection**: It automatically provides that value to your function
3. **Thread Safety**: `State` ensures safe concurrent access (multiple commands can run simultaneously)

**Express equivalent:**
```typescript
// Express middleware does this manually:
app.use((req, res, next) => {
  req.db = app.locals.db;  // Manual injection
  next();
});
```

In Tauri, this is automatic based on the parameter type!

### Multiple State Types

You can register multiple state types:

```rust
// In main.rs
app.manage(database_connection);
app.manage(config);
app.manage(cache);

// In commands
#[tauri::command]
async fn my_command(
    db: State<'_, DatabaseConnection>,
    config: State<'_, AppConfig>,
    cache: State<'_, Cache>,
) -> Result<(), String> {
    // All three are automatically injected!
}
```

**Express equivalent:**
```typescript
app.locals.db = db;
app.locals.config = config;
app.locals.cache = cache;

app.get('/api/endpoint', async (req, res) => {
  const { db, config, cache } = req.app.locals;
  // Use all three
});
```

## Real Example: Creating a Task

Let's trace a complete example from frontend to database:

### 1. Frontend Call (TypeScript)

```typescript
const task = await invokeDbCreateTask(
  "Fix bug",
  "Fix the login issue",
  "high",
  ["bug", "urgent"],
  ["project-123"]
);
```

### 2. Type-Safe Wrapper (ipc.ts)

```typescript
export async function invokeDbCreateTask(
  title: string,
  description: string | undefined,
  priority: TaskPriority,
  tags: string[],
  project_ids: string[]
): Promise<Task> {
  return await invokeWithTimeout<Task>(
    'db_create_task',
    { title, description, priority, tags, project_ids },
    10000
  );
}
```

### 3. Tauri Command (commands.rs)

```1764:1782:src-tauri/src/commands.rs
#[tauri::command]
pub async fn db_create_task(
    db: State<'_, sea_orm::DatabaseConnection>,
    title: String,
    description: Option<String>,
    priority: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
) -> Result<crate::db::task_operations::TaskDto, String> {
    crate::db::task_operations::create_task(
        db.inner(),
        title,
        description,
        priority,
        tags,
        project_ids,
    )
    .await
    .map_err(|e| format!("Failed to create task: {}", e))
}
```

**What happens:**
1. Tauri receives the `invoke('db_create_task', {...})` call
2. It sees `State<'_, DatabaseConnection>` in the parameters
3. It automatically finds the database connection registered with `app.manage()`
4. It injects it as the `db` parameter
5. Your function receives both the database AND the frontend parameters
6. You call `db.inner()` to get the actual connection
7. Pass it to your business logic

**Express equivalent flow:**
```typescript
// 1. Frontend
fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({ title: "Fix bug", ... })
});

// 2. Route handler
app.post('/api/tasks', async (req, res) => {
  const db = req.app.locals.db;  // Manual access
  const task = await createTask(db, req.body);
  res.json(task);
});
```

## Common Patterns

### Pattern 1: Simple Query

**Express:**
```typescript
app.get('/api/user/:id', async (req, res) => {
  const db = req.app.locals.db;
  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(user.rows[0]);
});
```

**Tauri:**
```rust
#[tauri::command]
async fn get_user(
    db: State<'_, DatabaseConnection>,
    id: String,
) -> Result<User, String> {
    db::get_user(db.inner(), &id).await
        .map_err(|e| e.to_string())
}
```

### Pattern 2: Multiple State Types

**Express:**
```typescript
app.get('/api/data', async (req, res) => {
  const { db, cache, logger } = req.app.locals;
  // Use all three
});
```

**Tauri:**
```rust
#[tauri::command]
async fn get_data(
    db: State<'_, DatabaseConnection>,
    cache: State<'_, Cache>,
    logger: State<'_, Logger>,
) -> Result<Data, String> {
    // All three automatically injected!
}
```

### Pattern 3: Optional State

Sometimes you want state that might not exist:

**Express:**
```typescript
app.get('/api/endpoint', async (req, res) => {
  const cache = req.app.locals.cache;  // Might be undefined
  if (cache) {
    // Use cache
  }
});
```

**Tauri:**
```rust
#[tauri::command]
async fn get_data(
    cache: Option<State<'_, Cache>>,  // Optional state
) -> Result<Data, String> {
    if let Some(cache) = cache {
        // Use cache
    }
}
```

## Key Differences from Express

| Express.js | Tauri State |
|------------|-------------|
| Manual middleware setup | Automatic based on type |
| `req.app.locals.db` | `State<'_, DatabaseConnection>` |
| Access via request object | Parameter injection |
| Can forget to attach | Type system ensures it exists |
| Manual dependency management | Automatic dependency injection |

## Why State Injection is Powerful

### 1. Type Safety

If you forget to register state, Rust won't compile:
```rust
// If you forget app.manage(db), this won't compile:
#[tauri::command]
async fn get_tasks(
    db: State<'_, DatabaseConnection>,  // Error: No such state registered!
) -> Result<Vec<Task>, String> {
    // ...
}
```

In Express, you'd only discover missing state at runtime:
```typescript
// This compiles but crashes at runtime:
app.get('/api/tasks', async (req, res) => {
  const db = req.app.locals.db;  // undefined if you forgot to set it!
  await db.query(...);  // 💥 Runtime error
});
```

### 2. Automatic Dependency Resolution

Tauri automatically figures out what each command needs:
```rust
// Command A needs database
#[tauri::command]
async fn cmd_a(db: State<'_, DatabaseConnection>) -> Result<(), String> { }

// Command B needs database + cache
#[tauri::command]
async fn cmd_b(
    db: State<'_, DatabaseConnection>,
    cache: State<'_, Cache>,
) -> Result<(), String> { }
```

Each command declares what it needs, and Tauri provides it. No manual wiring!

### 3. Thread Safety Built-In

`State` ensures safe concurrent access. Multiple commands can run simultaneously without conflicts.

## Mental Model Summary

```
Express.js                    Tauri
─────────────────────────────────────────────
app.locals.db = db    →    app.manage(db)

req.app.locals.db     →    State<'_, DatabaseConnection>

Middleware injection   →    Automatic type-based injection

Runtime errors         →    Compile-time safety
```

**Tauri's State injection is like Express middleware + dependency injection + type safety**, all built into the framework. You declare what you need, and Tauri provides it automatically!

## Takeaways

1. **Register once**: Use `app.manage()` in `main.rs` setup
2. **Request via type**: Add `State<'_, YourType>` as a parameter
3. **Access with `.inner()`**: Get the actual value from the wrapper
4. **Type-safe**: Rust ensures state exists at compile time
5. **Automatic**: No middleware or manual wiring needed

The same dependency injection pattern you know from Express, but with Rust's type system ensuring correctness at compile time!
