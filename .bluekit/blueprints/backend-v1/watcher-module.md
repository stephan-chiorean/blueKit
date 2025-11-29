---
id: watcher-module
type: task
version: 1
---

# Watcher Module (watcher.rs)

Implement file system watching with notify crate and Tauri events.

## Requirements

- `notify` crate (version 6.1)
- `tokio` async runtime
- Tauri AppHandle for events

## Steps

### 1. Create watcher.rs Structure

Create `src-tauri/src/watcher.rs` with the following:

```rust
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Manager};
use std::env;
use std::fs;

/// Starts watching a file and emits Tauri events when it changes.
pub fn watch_file(
    app_handle: AppHandle,
    file_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();
    
    let watch_dir = file_path.parent()
        .ok_or_else(|| "File path has no parent directory".to_string())?
        .to_path_buf();
    
    if !watch_dir.exists() {
        fs::create_dir_all(&watch_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let mut watcher: RecommendedWatcher = Watcher::new(
        tx,
        notify::Config::default()
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;
    
    watcher.watch(&watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;
    
    let app_handle_clone = app_handle.clone();
    let file_name = file_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string();
    
    tauri::async_runtime::spawn(async move {
        let _watcher = watcher;
        
        while let Ok(event) = rx.recv() {
            match event {
                Ok(Event { kind: EventKind::Modify(_), paths, .. }) |
                Ok(Event { kind: EventKind::Create(_), paths, .. }) |
                Ok(Event { kind: EventKind::Remove(_), paths, .. }) => {
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

/// Starts watching a directory for .md file changes.
pub fn watch_directory(
    app_handle: AppHandle,
    directory_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();
    
    if !directory_path.exists() {
        fs::create_dir_all(&directory_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let mut watcher: RecommendedWatcher = Watcher::new(
        tx,
        notify::Config::default()
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;
    
    watcher.watch(&directory_path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;
    
    let app_handle_clone = app_handle.clone();
    
    tauri::async_runtime::spawn(async move {
        let _watcher = watcher;
        
        while let Ok(event) = rx.recv() {
            match event {
                Ok(Event { kind: EventKind::Modify(_), paths, .. }) |
                Ok(Event { kind: EventKind::Create(_), paths, .. }) |
                Ok(Event { kind: EventKind::Remove(_), paths, .. }) => {
                    let has_md_file = paths.iter().any(|p| {
                        p.extension()
                            .and_then(|ext| ext.to_str())
                            .map(|ext| ext == "md")
                            .unwrap_or(false)
                    });
                    
                    if has_md_file {
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit directory change event: {}", e);
                        });
                    }
                }
                Err(e) => {
                    eprintln!("Directory watcher error: {}", e);
                }
                _ => {}
            }
        }
    });
    
    Ok(())
}

/// Gets the path to the project registry file.
pub fn get_registry_path() -> Result<PathBuf, String> {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;
    
    Ok(PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json"))
}
```

## Key Concepts

### File Watching with notify

- `RecommendedWatcher` - Platform-optimized watcher
- `mpsc::channel()` - Channel for receiving events
- `RecursiveMode::NonRecursive` - Only watch direct children

### Event Handling

- Filter events by type (Create, Modify, Remove)
- Filter by file extension (`.md` files)
- Emit Tauri events to frontend

### Async Task Spawning

- Use `tauri::async_runtime::spawn()` for background tasks
- Keep watcher alive by moving into task
- Handle events in loop

### Directory Creation

- Create directories if they don't exist
- Handle errors gracefully
- Use `fs::create_dir_all()` for recursive creation

## Event Types

- **Create**: File created
- **Modify**: File modified
- **Remove**: File deleted

## Best Practices

- Keep watchers alive by moving into spawned tasks
- Handle errors without crashing
- Filter events to only relevant changes
- Use unique event names per watch

## Cross-Platform Notes

- `notify` handles platform differences
- Works on Windows, macOS, and Linux
- May have different behavior on different platforms

## Verification

- Test file creation triggers events
- Test file modification triggers events
- Test file deletion triggers events
- Verify events reach frontend
- Test with multiple watchers