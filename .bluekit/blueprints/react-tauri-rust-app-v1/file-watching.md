---
id: file-watching
type: task
version: 1
---

# File System Watching

Set up file system watcher with Tauri event emission for real-time updates when files change.

## Requirements

- Completed "File Operations" task
- `notify` crate in Cargo.toml dependencies

## Steps

### 1. Implement File Watcher

Complete `src-tauri/src/watcher.rs`:

```rust
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Manager};
use std::fs;

/// Starts watching a directory for file changes and emits Tauri events.
pub fn watch_directory(
    app_handle: AppHandle,
    directory_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();
    
    // Create directory if it doesn't exist
    if !directory_path.exists() {
        fs::create_dir_all(&directory_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Create watcher
    let mut watcher: RecommendedWatcher = Watcher::new(
        tx,
        notify::Config::default()
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;
    
    // Start watching (recursive)
    watcher.watch(&directory_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;
    
    // Spawn task to handle events
    let app_handle_clone = app_handle.clone();
    
    tauri::async_runtime::spawn(async move {
        let _watcher = watcher; // Keep watcher alive
        
        while let Ok(event) = rx.recv() {
            match event {
                Ok(Event { kind: EventKind::Modify(_), paths, .. }) |
                Ok(Event { kind: EventKind::Create(_), paths, .. }) |
                Ok(Event { kind: EventKind::Remove(_), paths, .. }) => {
                    // Check if changed files are relevant (e.g., .md files)
                    let has_relevant_file = paths.iter().any(|p| {
                        p.extension()
                            .and_then(|ext| ext.to_str())
                            .map(|ext| ext == "md" || ext == "mmd" || ext == "mermaid")
                            .unwrap_or(false)
                    });
                    
                    if has_relevant_file {
                        // Emit Tauri event to frontend
                        app_handle_clone.emit_all(&event_name, ())
                            .unwrap_or_else(|e| {
                                eprintln!("Failed to emit event: {}", e);
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

/// Starts watching a single file.
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
    
    let mut watcher: RecommendedWatcher = Watcher::new(tx, notify::Config::default())
        .map_err(|e| format!("Failed to create watcher: {}", e))?;
    
    watcher.watch(&watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to start watching: {}", e))?;
    
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
                        app_handle_clone.emit_all(&event_name, ())
                            .unwrap_or_else(|e| eprintln!("Failed to emit event: {}", e));
                    }
                }
                Err(e) => eprintln!("Watcher error: {}", e),
                _ => {}
            }
        }
    });
    
    Ok(())
}
```

### 2. Add Watch Command

Add to `src-tauri/src/commands.rs`:

```rust
use crate::watcher;

/// Starts watching a project directory for changes.
#[tauri::command]
pub async fn watch_project(
    app_handle: AppHandle,
    project_path: String,
) -> Result<(), String> {
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    let sanitized_path: String = project_path
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '.' | ' ' => '_',
            _ => c,
        })
        .collect();
    
    let event_name = format!("project-changed-{}", sanitized_path);
    
    watcher::watch_directory(app_handle, bluekit_path, event_name)?;
    
    Ok(())
}
```

### 3. Register Command

Add to `main.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... other commands
    commands::watch_project,
])
```

### 4. Listen to Events in Frontend

Add to `src/ipc.ts`:

```typescript
import { listen } from '@tauri-apps/api/event';

export async function setupFileWatcher(
  projectPath: string,
  onFileChange: () => void
) {
  const sanitized = projectPath.replace(/[^a-zA-Z0-9]/g, '_');
  const eventName = `project-changed-${sanitized}`;
  
  await listen(eventName, () => {
    onFileChange();
  });
}
```

## Key Concepts

1. **Event Emission**: Use `app_handle.emit_all()` to send events to frontend
2. **Async Tasks**: Spawn tasks to keep watchers alive
3. **Event Filtering**: Filter events to only relevant file types
4. **Event Names**: Use sanitized paths for unique event names

## Verification

- Start watcher and modify files - events should be emitted
- Frontend should receive events and update UI
- Test with multiple projects simultaneously

## Next Steps

After completing this task, proceed to "React Setup" task.