---
id: tauri-file-watching
alias: Tauri File Watching
is_base: false
version: 1
tags: [tauri, file-system, events]
description: "Pattern for watching files in a Tauri application and updating the frontend"
---

# Tauri File Watching Pattern

## Overview
A reusable pattern for watching files in a Tauri application and automatically updating the frontend when files change. This pattern enables reactive UI updates based on file system changes without polling or manual refresh.

## Pattern Description

This pattern solves the problem of keeping frontend state synchronized with file system changes. Instead of polling files or requiring manual refresh, it uses:

1. **File System Watching**: Rust `notify` crate monitors file changes
2. **Event Emission**: Tauri events notify the frontend of changes (using `Manager` trait's `emit_all()`)
3. **Reactive Updates**: Frontend listens to events and updates state automatically
4. **Resilient Setup**: Handles missing directories gracefully

## Use Cases

- Configuration files that can be edited externally
- Data files that are modified by other processes
- Registry/index files that track application state
- Log files that need real-time updates
- Any file that needs to trigger UI updates when changed

## Architecture

### Backend (Rust)

1. **Watcher Module**: Handles file system watching logic
2. **Event Emission**: Emits Tauri events when files change
3. **Setup Hook**: Initializes watchers when app starts

### Frontend (TypeScript/React)

1. **Event Listener**: Listens for file change events
2. **State Update**: Reloads data when events are received
3. **Cleanup**: Properly unlistens when component unmounts

## Implementation Pattern

### Backend Structure

#### 1. Add Dependencies

In `Cargo.toml`:
```toml
[dependencies]
notify = "6.1"
tauri = { version = "1.5", features = ["shell-open", "dialog-open", "fs-read-dir", "fs-read-file"] }
```

#### 2. Create Watcher Module

Create `src-tauri/src/watcher.rs`:

```rust
/// File watching module for monitoring file system changes.
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Manager};
use std::env;
use std::fs;

/// Starts watching a file and emits Tauri events when it changes.
/// 
/// # Arguments
/// 
/// * `app_handle` - Tauri application handle for emitting events
/// * `file_path` - Path to the file to watch (relative to home directory or absolute)
/// * `event_name` - Name of the Tauri event to emit when file changes
/// 
/// # Returns
/// 
/// A `Result<(), String>` indicating success or failure
pub fn watch_file(
    app_handle: AppHandle,
    file_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    // Create a channel for file system events
    let (tx, rx) = mpsc::channel();
    
    // Get the parent directory to watch
    let watch_dir = file_path.parent()
        .ok_or_else(|| "File path has no parent directory".to_string())?
        .to_path_buf();
    
    // Create the directory if it doesn't exist (resilient to missing directories)
    if !watch_dir.exists() {
        fs::create_dir_all(&watch_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Create the watcher
    let mut watcher: RecommendedWatcher = Watcher::new(
        tx,
        notify::Config::default()
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;
    
    // Start watching the directory (non-recursive)
    watcher.watch(&watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;
    
    // Spawn a task to handle file system events
    // Move watcher into the task to keep it alive
    let app_handle_clone = app_handle.clone();
    let file_name = file_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string();
    
    tauri::async_runtime::spawn(async move {
        // Keep watcher alive by moving it into the task
        let _watcher = watcher;
        
        while let Ok(event) = rx.recv() {
            match event {
                Ok(Event { kind: EventKind::Modify(_), paths, .. }) => {
                    // Check if the changed file is the one we're watching
                    if paths.iter().any(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n == file_name)
                            .unwrap_or(false)
                    }) {
                        // Emit Tauri event to frontend using emit_all()
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit file change event: {}", e);
                        });
                    }
                }
                Ok(Event { kind: EventKind::Create(_), paths, .. }) => {
                    // Also watch for file creation
                    if paths.iter().any(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n == file_name)
                            .unwrap_or(false)
                    }) {
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit file change event: {}", e);
                        });
                    }
                }
                Ok(Event { kind: EventKind::Remove(_), paths, .. }) => {
                    // Watch for file deletion
                    if paths.iter().any(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n == file_name)
                            .unwrap_or(false)
                    }) {
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit file change event: {}", e);
                        });
                    }
                }
                Err(e) => {
                    eprintln!("File watcher error: {}", e);
                }
                _ => {}
            }
        }
    });
    
    Ok(())
}

/// Helper function to get a file path (example for home directory)
pub fn get_file_path(subdir: &str, filename: &str) -> Result<PathBuf, String> {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE")) // Windows fallback
        .map_err(|_| "Could not determine home directory".to_string())?;
    
    Ok(PathBuf::from(&home_dir)
        .join(subdir)
        .join(filename))
}
```

#### 3. Register Module and Set Up Watcher

In `src-tauri/src/main.rs`:

```rust
mod watcher;  // Add this with other module declarations

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... your commands
        ])
        .setup(|app| {
            // Set up file watcher
            let app_handle = app.handle();
            if let Ok(file_path) = watcher::get_file_path(".bluekit", "projectRegistry.json") {
                // Don't fail app startup if watcher fails - just log it
                if let Err(e) = watcher::watch_file(
                    app_handle.clone(),
                    file_path,
                    "file-changed".to_string(), // Your event name
                ) {
                    eprintln!("Warning: Failed to start file watcher: {}", e);
                    // App continues to work even if watcher fails
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend Structure

#### 1. Import Required Modules

```typescript
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
```

#### 2. Set Up Event Listener in React Component

```typescript
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);

// Function to load data from file
const loadData = async () => {
    try {
        setLoading(true);
        const loadedData = await invokeGetData(); // Your IPC command
        setData(loadedData);
        console.log('Loaded data:', loadedData);
    } catch (error) {
        console.error('Error loading data:', error);
    } finally {
        setLoading(false);
    }
};

useEffect(() => {
    // Load initial data on mount
    loadData();

    // Set up file watcher event listener
    let unlistenFn: (() => void) | null = null;

    const setupFileWatcher = async () => {
        try {
            const unlisten = await listen('file-changed', () => {
                // Reload data when file changes
                console.log('File changed, reloading data...');
                loadData();
            });
            unlistenFn = unlisten;
        } catch (error) {
            console.error('Failed to set up file watcher listener:', error);
        }
    };

    setupFileWatcher();

    // Cleanup: unlisten when component unmounts
    return () => {
        if (unlistenFn) {
            unlistenFn();
        }
    };
}, []); // Empty dependency array - only run on mount
```

## Key Components

### 1. File Watcher Module
- Uses `notify` crate for cross-platform file watching
- Watches parent directory (more reliable than watching file directly)
- Filters events to only target specific file
- Emits Tauri events for frontend consumption

### 2. Event System
- Tauri's built-in event system for backend-to-frontend communication
- Event names should be descriptive and unique
- Events can carry payload data if needed

### 3. Frontend Integration
- React hooks for lifecycle management
- Async event listener setup
- Proper cleanup to prevent memory leaks

## Benefits

- **Real-time Updates**: UI updates immediately when files change
- **Efficient**: No polling overhead, only reacts to actual changes
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Reusable**: Pattern can be applied to any file watching scenario
- **Non-blocking**: File watching runs in background, doesn't block UI

## Dependencies

### Backend (Cargo.toml)
```toml
[dependencies]
notify = "6.1"
tauri = { version = "1.5", features = ["shell-open", "dialog-open", "fs-read-dir", "fs-read-file"] }
tokio = { version = "1", features = ["full"] }
```

**Important**: Must import `Manager` trait to use `emit_all()`:
```rust
use tauri::{AppHandle, Manager};
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "@tauri-apps/api": "^1.5.0"
  }
}
```

Import in TypeScript:
```typescript
import { listen } from '@tauri-apps/api/event';
```

## Customization Points

- **Event Name**: Choose descriptive event names per use case
- **File Path**: Can watch files in home directory, app data, or anywhere
- **Event Payload**: Can include file contents or metadata in events
- **Filtering**: Can filter by file type, size, or other criteria
- **Debouncing**: Can add debouncing for rapid file changes

## Error Handling

- Watcher creation failures should be logged but not crash app
- Event emission failures should be handled gracefully
- Frontend should handle missing files or parse errors
- Network or permission issues should be communicated to user

## Best Practices

1. **Watch Directories**: Watch parent directory, not individual files (more reliable)
2. **Filter Events**: Only emit events for the specific file you care about
3. **Cleanup**: Always unlisten to events when components unmount
4. **Error Handling**: Handle file read errors gracefully
5. **Event Naming**: Use descriptive, namespaced event names
6. **Initial Load**: Load data on mount, not just on file changes
7. **Resilient Setup**: Create directories if they don't exist
8. **Non-Fatal Errors**: Don't crash app if watcher setup fails
9. **Manager Trait**: Always import `Manager` trait for `emit_all()` method
10. **Keep Watcher Alive**: Move watcher into spawned task to prevent dropping

## Complete Example: Project Registry Watcher

This pattern is used to watch `~/.bluekit/projectRegistry.json`:

### Backend Setup

1. **Add to `main.rs` setup hook**:
```rust
.setup(|app| {
    let app_handle = app.handle();
    if let Ok(registry_path) = watcher::get_file_path(".bluekit", "projectRegistry.json") {
        if let Err(e) = watcher::watch_file(
            app_handle.clone(),
            registry_path,
            "project-registry-changed".to_string(),
        ) {
            eprintln!("Warning: Failed to start file watcher: {}", e);
        }
    }
    Ok(())
})
```

### Frontend Setup

```typescript
useEffect(() => {
    loadProjects(); // Initial load
    
    let unlistenFn: (() => void) | null = null;
    
    const setupFileWatcher = async () => {
        const unlisten = await listen('project-registry-changed', () => {
            loadProjects(); // Reload when registry changes
        });
        unlistenFn = unlisten;
    };
    
    setupFileWatcher();
    
    return () => {
        if (unlistenFn) unlistenFn();
    };
}, []);
```

### Result
- Projects update automatically when `projectRegistry.json` changes externally
- Works even if directory doesn't exist initially (creates it)
- App continues to work if watcher setup fails
- Proper cleanup prevents memory leaks

## Common Issues and Solutions

### Issue: "no method named `emit_all` found"
**Solution**: Import `Manager` trait:
```rust
use tauri::{AppHandle, Manager};
```

### Issue: "No path was found" error
**Solution**: Create directory if it doesn't exist:
```rust
if !watch_dir.exists() {
    fs::create_dir_all(&watch_dir)?;
}
```

### Issue: Watcher stops working
**Solution**: Keep watcher alive by moving it into spawned task:
```rust
let _watcher = watcher; // Move into task
```

### Issue: Events not received in frontend
**Solution**: 
- Check event name matches exactly
- Ensure `listen()` is called after app is ready
- Check browser console for errors
- Verify watcher is set up in `setup()` hook, not `main()`

