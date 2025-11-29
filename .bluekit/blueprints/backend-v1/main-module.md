---
id: main-module
type: task
version: 1
---

# Main Module (main.rs)

Implement the application entry point with Tauri builder and command registration.

## Requirements

- All command modules must be created first
- Tauri dependencies installed

## Steps

### 1. Create main.rs Structure

Create `src-tauri/src/main.rs` with the following:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Module declarations
mod commands; // IPC command handlers
mod state;    // Application state management
mod utils;    // Utility functions
mod watcher;  // File watching functionality

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_app_info,
            commands::example_error,
            commands::get_project_kits,
            commands::get_project_registry,
            commands::watch_project_kits,
            commands::read_file,
        ])
        .setup(|app| {
            // Set up file watcher for project registry
            let app_handle = app.handle();
            if let Ok(registry_path) = watcher::get_registry_path() {
                if let Err(e) = watcher::watch_file(
                    app_handle.clone(),
                    registry_path,
                    "project-registry-changed".to_string(),
                ) {
                    eprintln!("Failed to start file watcher: {}", e);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Key Components

### Module Declarations

- Declare all modules that will be used
- Modules must match file names in `src/` directory

### Command Registration

- Use `tauri::generate_handler![]` macro to register commands
- Add each command function from `commands.rs` module
- Commands are async functions marked with `#[tauri::command]`

### Setup Hook

- Runs once when application starts
- Use for initialization tasks:
  - File watchers
  - State initialization
  - External service connections

### Async Runtime

- `#[tokio::main]` attribute enables async/await
- Required for Tauri's async command handlers

## Adding New Commands

1. Create function in `commands.rs` with `#[tauri::command]`
2. Add to `invoke_handler![]` macro in main.rs
3. Create typed wrapper in frontend `src/ipc.ts`

## Verification

- Run `cargo check` to verify compilation
- Run `tauri dev` to test application startup