---
id: main-entry
type: task
version: 1
---

# Main Entry Point

Set up main.rs as the application entry point with Tauri builder, command registration, and setup hooks.

## Requirements

- Completed "Rust Modules" task
- All module files created

## Steps

### 1. Complete main.rs

Edit `src-tauri/src/main.rs`:

```rust
// Preprocessor attributes
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Module declarations
mod commands;
mod state;
mod utils;
mod watcher;

/// Main entry point of the Rust application.
/// 
/// The `#[tokio::main]` attribute converts this function into an async runtime entry point,
/// which is required because Tauri uses async/await for handling IPC commands.
#[tokio::main]
async fn main() {
    tauri::Builder::default()
        // Register all IPC commands
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_app_info,
            // Add more commands here as you implement them
        ])
        .setup(|app| {
            // Setup hook - runs once when app starts
            // Use this for initialization tasks like file watchers
            let app_handle = app.handle();
            
            // Example: Set up file watcher for project registry
            // if let Ok(registry_path) = watcher::get_registry_path() {
            //     if let Err(e) = watcher::watch_file(
            //         app_handle.clone(),
            //         registry_path,
            //         "project-registry-changed".to_string(),
            //     ) {
            //         eprintln!("Failed to start file watcher: {}", e);
            //     }
            // }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2. Add Basic Commands to commands.rs

Add these basic commands to `src-tauri/src/commands.rs`:

```rust
use serde::{Deserialize, Serialize};

/// Response structure for the `get_app_info` command.
#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
}

/// Simple ping command to test IPC communication.
#[tauri::command]
pub async fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

/// Gets application information.
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    let app_info = AppInfo {
        name: "your-app-name".to_string(),
        version: "0.1.0".to_string(),
        platform: std::env::consts::OS.to_string(),
    };
    Ok(app_info)
}
```

## Key Concepts

1. **`#[tokio::main]`**: Enables async runtime for Tauri commands
2. **`invoke_handler![]`**: Macro that registers IPC commands
3. **`.setup()`**: Hook for initialization tasks
4. **`.run()`**: Starts the Tauri application event loop

## Verification

- Run `cargo check` - should compile successfully
- Run `npm run tauri dev` - app should launch
- Commands will be testable once frontend IPC wrappers are created

## Next Steps

After completing this task, proceed to "IPC Commands" task to add more command handlers.