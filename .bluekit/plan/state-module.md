# State Module Usage Guide

## Overview

The `state.rs` module in Tauri provides a way to manage shared, in-memory application state that can be injected into commands via `State<'_, YourType>`. This document outlines practical use cases for the state module when you already have file storage and database persistence.

## Key Principle

**State is for ephemeral, runtime-only data** - things that:
- Don't need to persist across app restarts
- Benefit from being in-memory for performance
- Need to be shared across multiple commands
- Are temporary or session-specific

## Use Cases

### 1. In-Memory Caches (Performance Optimization)

Cache frequently accessed data that doesn't change often to avoid expensive file/database reads.

**Example Use Cases:**
- Project metadata summaries (avoid re-reading JSON files on every access)
- Blueprint lists (cache parsed blueprints in memory)
- Recently accessed file contents
- Computed statistics (e.g., task counts per project, project health metrics)

**Why not persist?** Too expensive to read/write on every access, but fine to lose on restart.

**Example Implementation:**

```rust
// In state.rs
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

pub struct AppState {
    // Cache project metadata to avoid re-reading JSON files
    pub project_cache: Arc<RwLock<HashMap<String, ProjectMetadata>>>,
    
    // Cache blueprint summaries
    pub blueprint_cache: Arc<RwLock<HashMap<String, BlueprintSummary>>>,
    
    // Recently accessed file contents (LRU cache)
    pub file_cache: Arc<RwLock<HashMap<String, CachedFile>>>,
}

// In commands.rs
#[tauri::command]
pub async fn get_project_metadata(
    state: State<'_, AppState>,
    project_path: String,
) -> Result<ProjectMetadata, String> {
    // Check cache first
    let cache = state.project_cache.read().await;
    if let Some(metadata) = cache.get(&project_path) {
        return Ok(metadata.clone());
    }
    drop(cache);
    
    // Cache miss - read from file
    let metadata = read_project_metadata(&project_path).await?;
    
    // Update cache
    let mut cache = state.project_cache.write().await;
    cache.insert(project_path, metadata.clone());
    
    Ok(metadata)
}
```

### 2. Runtime Configuration (Not Persisted)

Settings that change at runtime but shouldn't be saved to disk.

**Example Use Cases:**
- Feature flags (enable/disable features without restart)
- Debug mode toggle
- Log level (INFO/DEBUG/ERROR) - runtime only
- UI preferences that reset on restart (sidebar width, theme)
- Development/testing mode flags

**Example Implementation:**

```rust
// In state.rs
pub struct AppState {
    pub config: Arc<RwLock<RuntimeConfig>>,
}

pub struct RuntimeConfig {
    pub debug_mode: bool,
    pub log_level: LogLevel,
    pub feature_flags: HashMap<String, bool>,
    pub ui_preferences: UiPreferences,
}

// In commands.rs
#[tauri::command]
pub async fn toggle_debug_mode(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut config = state.config.write().await;
    config.debug_mode = !config.debug_mode;
    Ok(config.debug_mode)
}

#[tauri::command]
pub async fn get_feature_flag(
    state: State<'_, AppState>,
    flag_name: String,
) -> Result<bool, String> {
    let config = state.config.read().await;
    Ok(config.feature_flags.get(&flag_name).copied().unwrap_or(false))
}
```

### 3. Background Task Management

Track and manage background tasks, watchers, and long-running operations.

**Current State:** Your `watcher.rs` uses a static global `WATCHER_REGISTRY`. This could be moved to State management for better testability and organization.

**Example Implementation:**

```rust
// In state.rs
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;

pub struct AppState {
    // Active file watchers
    pub active_watchers: Arc<RwLock<HashMap<String, WatcherTask>>>,
    
    // Background task handles
    pub background_tasks: Arc<RwLock<Vec<TaskHandle>>>,
    
    // Task status tracking
    pub task_status: Arc<RwLock<HashMap<String, TaskStatus>>>,
}

pub struct WatcherTask {
    pub path: PathBuf,
    pub event_name: String,
    pub restart_count: u32,
    pub is_active: bool,
}

// In commands.rs
#[tauri::command]
pub async fn get_watcher_health(
    state: State<'_, AppState>,
) -> Result<HashMap<String, bool>, String> {
    let watchers = state.active_watchers.read().await;
    Ok(watchers.iter()
        .map(|(name, task)| (name.clone(), task.is_active))
        .collect())
}

#[tauri::command]
pub async fn stop_watcher(
    state: State<'_, AppState>,
    event_name: String,
) -> Result<(), String> {
    let mut watchers = state.active_watchers.write().await;
    if let Some(mut task) = watchers.remove(&event_name) {
        task.is_active = false;
        Ok(())
    } else {
        Err(format!("Watcher not found: {}", event_name))
    }
}
```

**Benefits:**
- Better testability (can inject mock state)
- Cleaner organization (no static globals)
- Easier to extend with additional task types

### 4. Rate Limiting & Throttling

Track request counts, API call limits, or operation throttling to prevent abuse or overload.

**Example Use Cases:**
- "Don't allow more than 10 file writes per second"
- "Limit database queries to 100/minute"
- "Throttle watcher restarts"
- "Rate limit IPC command calls"

**Example Implementation:**

```rust
// In state.rs
use std::collections::HashMap;
use std::time::{Instant, Duration};

pub struct AppState {
    pub rate_limiter: Arc<RwLock<RateLimiter>>,
}

pub struct RateLimiter {
    pub operation_counts: HashMap<String, Vec<Instant>>,
    pub limits: HashMap<String, (u32, Duration)>, // (max_count, time_window)
}

impl RateLimiter {
    pub fn check_limit(&mut self, operation: &str) -> Result<(), String> {
        let (max_count, window) = self.limits.get(operation)
            .ok_or_else(|| format!("No limit configured for: {}", operation))?;
        
        let now = Instant::now();
        let window_start = now - *window;
        
        // Get counts for this operation
        let counts = self.operation_counts.entry(operation.to_string())
            .or_insert_with(Vec::new);
        
        // Remove old entries outside the window
        counts.retain(|&time| time > window_start);
        
        // Check if limit exceeded
        if counts.len() >= *max_count as usize {
            return Err(format!("Rate limit exceeded for {}: {} requests in {:?}", 
                operation, max_count, window));
        }
        
        // Record this operation
        counts.push(now);
        Ok(())
    }
}

// In commands.rs
#[tauri::command]
pub async fn write_file_with_throttle(
    state: State<'_, AppState>,
    path: String,
    content: String,
) -> Result<(), String> {
    // Check rate limit
    let mut limiter = state.rate_limiter.write().await;
    limiter.check_limit("file_write")?;
    drop(limiter);
    
    // Proceed with file write
    crate::commands::write_file(path, content).await
}
```

### 5. Temporary Locks/Flags

Prevent concurrent operations or track operation state.

**Example Use Cases:**
- "Is a migration running?" (prevent starting another)
- "Is sync in progress?" (show status, prevent duplicate syncs)
- "Is app initializing?" (show loading state)
- "Is database backup in progress?"
- "Is file system operation in progress?"

**Example Implementation:**

```rust
// In state.rs
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashSet;

pub struct AppState {
    pub active_operations: Arc<RwLock<HashSet<String>>>,
}

// In commands.rs
#[tauri::command]
pub async fn start_migration(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut operations = state.active_operations.write().await;
    
    if operations.contains("migration") {
        return Err("Migration already in progress".to_string());
    }
    
    operations.insert("migration".to_string());
    drop(operations);
    
    // Perform migration
    match perform_migration().await {
        Ok(_) => {
            let mut operations = state.active_operations.write().await;
            operations.remove("migration");
            Ok(())
        }
        Err(e) => {
            let mut operations = state.active_operations.write().await;
            operations.remove("migration");
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn is_operation_active(
    state: State<'_, AppState>,
    operation: String,
) -> Result<bool, String> {
    let operations = state.active_operations.read().await;
    Ok(operations.contains(&operation))
}
```

### 6. Session/Ephemeral Data

Data that exists only for the current session and doesn't need persistence.

**Example Use Cases:**
- Currently selected project path
- Last search query
- Undo/redo stack (if you add it)
- Temporary clipboard data
- User's current view state (which tab is open, scroll position)
- Temporary file uploads in progress

**Example Implementation:**

```rust
// In state.rs
pub struct AppState {
    pub session: Arc<RwLock<SessionData>>,
}

pub struct SessionData {
    pub selected_project: Option<String>,
    pub last_search_query: Option<String>,
    pub current_view: ViewState,
    pub undo_stack: Vec<Action>,
    pub redo_stack: Vec<Action>,
}

// In commands.rs
#[tauri::command]
pub async fn set_selected_project(
    state: State<'_, AppState>,
    project_path: String,
) -> Result<(), String> {
    let mut session = state.session.write().await;
    session.selected_project = Some(project_path);
    Ok(())
}

#[tauri::command]
pub async fn get_selected_project(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let session = state.session.read().await;
    Ok(session.selected_project.clone())
}
```

### 7. Performance Metrics

Track runtime statistics for monitoring and debugging.

**Example Use Cases:**
- Command execution times
- Error rates
- Cache hit rates
- Memory usage
- Request counts per command
- Average response times

**Example Implementation:**

```rust
// In state.rs
use std::time::Instant;
use std::collections::VecDeque;

pub struct AppState {
    pub metrics: Arc<RwLock<AppMetrics>>,
}

pub struct AppMetrics {
    pub command_times: HashMap<String, VecDeque<Duration>>,
    pub error_counts: HashMap<String, u64>,
    pub cache_hits: u64,
    pub cache_misses: u64,
}

impl AppMetrics {
    pub fn record_command_time(&mut self, command: &str, duration: Duration) {
        let times = self.command_times.entry(command.to_string())
            .or_insert_with(|| VecDeque::with_capacity(100));
        
        times.push_back(duration);
        if times.len() > 100 {
            times.pop_front(); // Keep only last 100 measurements
        }
    }
    
    pub fn get_avg_time(&self, command: &str) -> Option<Duration> {
        self.command_times.get(command)
            .map(|times| {
                let sum: Duration = times.iter().sum();
                sum / times.len() as u32
            })
    }
}

// In commands.rs - wrap existing commands
#[tauri::command]
pub async fn get_project_kits_tracked(
    state: State<'_, AppState>,
    project_path: String,
) -> Result<Vec<KitFile>, String> {
    let start = Instant::now();
    
    let result = commands::get_project_kits(project_path).await;
    
    let duration = start.elapsed();
    let mut metrics = state.metrics.write().await;
    metrics.record_command_time("get_project_kits", duration);
    
    result
}
```

## Real Example: Refactoring Watcher Registry

Your current `watcher.rs` uses a static global:

```rust
// Current approach (static global)
static WATCHER_REGISTRY: once_cell::sync::Lazy<Arc<RwLock<HashMap<String, WatcherTask>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));
```

**Refactored to use State:**

```rust
// In state.rs
pub struct AppState {
    pub watchers: Arc<RwLock<HashMap<String, WatcherTask>>>,
}

// In main.rs
.setup(|app| {
    // ... database setup ...
    
    let app_state = AppState {
        watchers: Arc::new(RwLock::new(HashMap::new())),
    };
    app.manage(app_state);
    
    Ok(())
})

// In watcher.rs
pub async fn watch_file(
    app_handle: AppHandle,
    file_path: PathBuf,
    event_name: String,
    state: State<'_, AppState>, // Inject state
) -> Result<(), String> {
    // ... watcher setup ...
    
    // Store in state instead of static global
    let mut registry = state.watchers.write().await;
    registry.insert(event_name, WatcherTask {
        path: file_path,
        event_name: event_name.clone(),
        restart_count: 0,
        is_active: true,
    });
    
    Ok(())
}

// In commands.rs
#[tauri::command]
pub async fn get_watcher_health(
    state: State<'_, AppState>,
) -> Result<HashMap<String, bool>, String> {
    let watchers = state.watchers.read().await;
    Ok(watchers.iter()
        .map(|(name, task)| (name.clone(), task.is_active))
        .collect())
}
```

**Benefits:**
- Better testability (can inject mock state in tests)
- Cleaner organization (no static globals)
- Easier to extend (can add more state alongside watchers)
- Type-safe dependency injection

## When NOT to Use State

**Don't use State for:**
- ❌ **User data** → Use database or files
- ❌ **Settings that should persist** → Use JSON config files
- ❌ **Large datasets** → Use database
- ❌ **Things that need to survive restarts** → Use persistent storage
- ❌ **File contents** → Read from files when needed (unless caching for performance)

## State Registration Pattern

**In `main.rs`:**

```rust
.setup(|app| {
    // Initialize database
    let db = initialize_database().await?;
    app.manage(db);
    
    // Initialize application state
    let app_state = AppState {
        project_cache: Arc::new(RwLock::new(HashMap::new())),
        config: Arc::new(RwLock::new(RuntimeConfig::default())),
        active_watchers: Arc::new(RwLock::new(HashMap::new())),
        // ... other state fields ...
    };
    app.manage(app_state);
    
    Ok(())
})
```

**In `commands.rs`:**

```rust
#[tauri::command]
pub async fn my_command(
    db: State<'_, DatabaseConnection>,      // Database state
    state: State<'_, AppState>,              // Application state
    // ... other parameters ...
) -> Result<ReturnType, String> {
    // Access database
    let connection = db.inner();
    
    // Access app state
    let cache = state.project_cache.read().await;
    // ... use cache ...
    
    Ok(result)
}
```

## Thread Safety

**Always use thread-safe wrappers:**
- `Arc<RwLock<T>>` for shared mutable state
- `Arc<Mutex<T>>` for simple shared state (if you don't need concurrent reads)
- `RwLock` allows multiple concurrent readers
- `Mutex` allows only one access at a time

**Example:**

```rust
pub struct AppState {
    // Use RwLock for read-heavy workloads (caches, config)
    pub cache: Arc<RwLock<HashMap<String, Data>>>,
    
    // Use Mutex for simple shared state
    pub counter: Arc<Mutex<u32>>,
}
```

## Best Practices

1. **Keep state minimal** - Only store what truly needs to be shared
2. **Use appropriate locks** - `RwLock` for read-heavy, `Mutex` for simple cases
3. **Avoid long-held locks** - Lock, use, unlock quickly
4. **Document state purpose** - Make it clear why each piece of state exists
5. **Consider cache invalidation** - Have a strategy for when cached data becomes stale
6. **Use `Arc` for shared ownership** - Required for `State` injection
7. **Initialize in `main.rs`** - Set up all state during app setup

## Summary

The `state.rs` module is useful for:
- ✅ Fast, ephemeral runtime state
- ✅ Performance caches
- ✅ Background task coordination
- ✅ Temporary flags/locks
- ✅ Session-only data
- ✅ Runtime configuration
- ✅ Performance metrics

**Current Status:** Your `state.rs` is just a template. You can:
- Delete it if you don't need it yet
- Repurpose it for one of the use cases above
- Use it to refactor the watcher registry from static globals to State management

The watcher registry is a good candidate for moving into State management for better organization and testability.


