---
id: understanding-tauri-ipc
alias: Understanding Tauri IPC
type: walkthrough
is_base: false
version: 1
tags:
  - tauri
  - ipc
  - rust
  - beginner
description: A beginner-friendly explanation of how Tauri's IPC system connects TypeScript frontend to Rust backend, explained through Express.js metaphors
complexity: simple
format: guide
---
# Understanding Tauri IPC (For TypeScript/Express Developers)

If you're coming from a TypeScript/Express.js background, Tauri's IPC (Inter-Process Communication) system might seem mysterious. Let me break it down using concepts you already know.

## The Big Picture Metaphor

**Think of Tauri like a fullstack app where:**
- **Frontend** = React (TypeScript) - like your typical SPA
- **Backend** = Rust functions - like your Express API
- **IPC** = The HTTP layer - except it's built-in and automatic

Instead of `fetch('/api/tasks')`, you call `invoke('db_get_tasks')`. Instead of Express routes, you use Rust functions with a special annotation.

## Express.js vs Tauri: Side by Side

### In Express.js:

```typescript
// Backend: Define a route
app.get('/api/tasks', async (req, res) => {
  const tasks = await database.getTasks(req.query.projectIds);
  res.json(tasks);
});

// Frontend: Call the API
const response = await fetch('/api/tasks?projectIds=123');
const tasks = await response.json();
```

### In Tauri:

```rust
// Backend: Define a command (in Rust)
#[tauri::command]
pub async fn db_get_tasks(project_ids: Option<Vec<String>>) -> Result<Vec<Task>, String> {
    let tasks = database::get_tasks(project_ids).await?;
    Ok(tasks)
}
```

```typescript
// Frontend: Call the command (in TypeScript)
const tasks = await invoke('db_get_tasks', { project_ids: ['123'] });
```

**That's it!** No route setup, no middleware, no serialization code. The `#[tauri::command]` annotation does all the Express-like work automatically.

## Breaking Down the Magic

### Step 1: The Command Annotation

```rust
#[tauri::command]  // <-- This is like app.get() or app.post()
pub async fn db_get_tasks(
    project_ids: Option<Vec<String>>  // Parameters from frontend
) -> Result<Vec<Task>, String> {     // Return type (auto-serialized to JSON)
    // Your logic here
}
```

**What `#[tauri::command]` does:**
- ✅ Registers this function as callable from JavaScript
- ✅ Automatically converts TypeScript objects → Rust types (deserialization)
- ✅ Automatically converts Rust types → JSON (serialization)
- ✅ Handles errors (Result<T, E> becomes Promise resolve/reject)

Think of it as Express middleware + route handler + JSON serialization all in one line.

### Step 2: Registering Commands

In Express, you'd mount routes:
```typescript
app.use('/api', taskRoutes);
```

In Tauri, you register commands in `main.rs`:
```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        db_get_tasks,      // List all commands here
        db_create_task,
        db_delete_task,
    ])
    .run(tauri::generate_context!())
```

This is like telling Express "here are all my routes" - but you do it once at app startup.

### Step 3: Calling from Frontend

In Express world:
```typescript
const response = await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'New Task', priority: 'high' })
});
const task = await response.json();
```

In Tauri world:
```typescript
const task = await invoke('db_create_task', {
  title: 'New Task',
  priority: 'high'
});
```

**No fetch, no headers, no JSON.stringify!** Tauri handles all of it.

## Real Example from BlueKit

Let's trace creating a task from start to finish:

### 1. Frontend Component (TaskCreateDialog.tsx:59)

```typescript
const createdTask = await invokeDbCreateTask(
  title.trim(),
  description.trim() || undefined,
  priority,
  tags.split(',').map(t => t.trim()).filter(Boolean),
  selectedProjectIds
);
```

### 2. Type-Safe Wrapper (ipc.ts:868)

```typescript
export async function invokeDbCreateTask(
  title: string,
  description: string | undefined,
  priority: TaskPriority,
  tags: string[],
  project_ids: string[]
): Promise<Task> {
  return await invokeWithTimeout<Task>(
    'db_create_task',     // Command name
    { title, description, priority, tags, project_ids },  // Parameters
    10000  // Timeout
  );
}
```

This wraps Tauri's raw `invoke()` with TypeScript types and timeout handling. **Think of it like your Axios wrapper or API client layer.**

### 3. Tauri Command (commands.rs:1764)

```rust
#[tauri::command]
pub async fn db_create_task(
    db: State<'_, sea_orm::DatabaseConnection>,
    title: String,
    description: Option<String>,
    priority: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
) -> Result<TaskDto, String> {
    // Call the actual database logic
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

**This is like your Express route handler.** It:
- Receives parameters (auto-deserialized from JSON)
- Calls the business logic (database operations)
- Returns a result (auto-serialized to JSON)
- Handles errors (converts them to strings for the frontend)

### 4. Database Operation (task_operations.rs:81)

```rust
pub async fn create_task(
    db: &DatabaseConnection,
    title: String,
    description: Option<String>,
    priority: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
) -> Result<TaskDto, DbErr> {
    let task_id = Uuid::new_v4().to_string();
    
    // Create task in database
    let task_active_model = task::ActiveModel {
        id: Set(task_id.clone()),
        title: Set(title),
        // ... more fields
    };
    
    task::Entity::insert(task_active_model).exec(db).await?;
    
    // Return the created task
    Ok(TaskDto { /* ... */ })
}
```

**This is like your service/repository layer** - pure business logic, no IPC concerns.

## Key Differences from Express

| Express.js | Tauri IPC |
|------------|-----------|
| HTTP requests over network | Function calls within same app |
| Need to define routes explicitly | Commands auto-registered |
| Manual JSON parsing/stringifying | Automatic serialization |
| Can call from anywhere (curl, Postman) | Only frontend can call backend |
| Need CORS, auth middleware | Not applicable (same app) |
| Slower (network overhead) | Faster (direct function calls) |

## Common Patterns

### Pattern 1: Simple Data Fetch

**Express:**
```typescript
app.get('/api/user/:id', async (req, res) => {
  const user = await db.getUser(req.params.id);
  res.json(user);
});
```

**Tauri:**
```rust
#[tauri::command]
async fn get_user(id: String) -> Result<User, String> {
    db::get_user(&id).await
        .map_err(|e| e.to_string())
}
```

### Pattern 2: Create with Body

**Express:**
```typescript
app.post('/api/tasks', async (req, res) => {
  const task = await db.createTask(req.body);
  res.json(task);
});
```

**Tauri:**
```rust
#[tauri::command]
async fn create_task(title: String, priority: String) -> Result<Task, String> {
    db::create_task(title, priority).await
        .map_err(|e| e.to_string())
}
```

### Pattern 3: Error Handling

**Express:**
```typescript
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.getTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Tauri:**
```rust
#[tauri::command]
async fn get_tasks() -> Result<Vec<Task>, String> {
    // Return Result type - Tauri handles the try/catch!
    db::get_tasks().await
        .map_err(|e| format!("Failed: {}", e))
}
```

In the frontend, this becomes:
```typescript
try {
  const tasks = await invoke('get_tasks');
} catch (error) {
  console.error(error);  // Gets the String from Err()
}
```

## Special Feature: State Injection

Remember `req` in Express that has your database connection, session, etc? Tauri has something similar:

```rust
#[tauri::command]
async fn get_tasks(
    db: State<'_, DatabaseConnection>,  // Injected automatically!
    app: tauri::AppHandle,              // Also available
) -> Result<Vec<Task>, String> {
    db.inner().get_tasks().await  // Use the injected state
}
```

You set up the state once in `main.rs`, and Tauri injects it into any command that needs it. Like dependency injection in Express, but built-in.

## Mental Model Summary

```
TypeScript → Tauri IPC → Rust
    ↓           ↓          ↓
  React      invoke()   #[tauri::command]
   SPA       (like       (like Express
           fetch())      routes)
```

**Tauri is basically an Express server embedded inside your desktop app**, where:
- Routes = `#[tauri::command]` functions
- API calls = `invoke()` calls
- HTTP = IPC (faster, local-only)
- All serialization is automatic

The frontend and backend run in the same application, communicating through Tauri's IPC bridge instead of HTTP. Same concepts, different transport layer!

