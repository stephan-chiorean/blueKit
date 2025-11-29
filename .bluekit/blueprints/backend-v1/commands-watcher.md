---
id: commands-watcher
type: task
version: 1
---

# File Watching Commands

Implement commands for setting up file system watchers.

## Requirements

- `watcher` module must be implemented first
- Tauri AppHandle for event emission

## Steps

### 1. Add Watcher Command to commands.rs

Add the following command to `src-tauri/src/commands.rs`:

```rust
use tauri::AppHandle;

/// Starts watching a project's .bluekit directory for kit file changes.
#[tauri::command]
pub async fn watch_project_kits(
    app_handle: AppHandle,
    project_path: String,
) -> Result<(), String> {
    use crate::watcher;
    
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    // Generate a unique event name based on the project path
    let sanitized_path: String = project_path
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '.' | ' ' => '_',
            _ => c,
        })
        .collect();
    let event_name = format!("project-kits-changed-{}", sanitized_path);
    
    // Start watching the directory
    watcher::watch_directory(
        app_handle,
        bluekit_path,
        event_name,
    )?;
    
    Ok(())
}
```

## Key Concepts

### AppHandle

- Automatically injected by Tauri
- Used to emit events to frontend
- Cloneable for use in async tasks

### Event Naming

- Sanitize paths to create valid event names
- Use unique names per project
- Frontend listens to these event names

### Directory Watching

- Watches `.bluekit` directory
- Emits events when `.md` files change
- Non-recursive watching (only direct children)

## Frontend Integration

Frontend listens to events:

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen("project-kits-changed-{sanitized}", () => {
  // Refresh kit list
  refreshKits();
});
```

## Error Handling

- Return errors if directory doesn't exist
- Handle watcher creation failures
- Log errors but don't crash app

## Verification

- Test with file creation/modification/deletion
- Verify events are emitted
- Test with multiple projects
- Verify event names are unique