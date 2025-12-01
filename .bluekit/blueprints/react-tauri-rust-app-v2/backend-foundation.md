---
id: backend-foundation
type: task
version: 1
blueprint: react-tauri-rust-app-v2
blueprint_name: React + Tauri + Rust Desktop App
layer: 2
layer_name: Backend Foundation
---

# Task: Backend Foundation

## Blueprint Context

**Blueprint Goal:** Build a fully functional React/Tauri/Rust desktop application with type-safe IPC, Chakra UI v3, file operations, and real-time file watching

**This Task:** Complete Rust backend structure with all modules, main entry point, command handlers, and file operations (Layer 2/6, Task 1/1)

**Task Position:** Second layer - builds on project setup, provides backend API for IPC layer

## Execution Instructions

When implementing this task:
1. Read all steps before making changes
2. Execute steps sequentially and completely
3. Run verification commands to ensure success
4. Report errors immediately
5. Only proceed after verification passes

## Requirements

- Project setup completed (Layer 1)
- Rust and Cargo installed
- Understanding of Rust async/await and Tauri commands

## Steps

### 1. Create Module Structure

Create the following module files in `src-tauri/src/`:

- `commands.rs` - IPC command handlers
- `state.rs` - Application state management
- `utils.rs` - Utility functions
- `watcher.rs` - File watching functionality

### 2. Implement state.rs

Create `src-tauri/src/state.rs` with application state management structures. Include AppState struct with Serialize/Deserialize support.

### 3. Implement utils.rs

Create `src-tauri/src/utils.rs` with utility functions like format_message and get_platform.

### 4. Implement watcher.rs

Create `src-tauri/src/watcher.rs` with file watching functionality using the `notify` crate. Include:
- `watch_file()` - Watch a single file for changes
- `watch_directory()` - Watch a directory recursively for .md file changes
- `get_registry_path()` - Get path to project registry file

### 5. Implement commands.rs

Create `src-tauri/src/commands.rs` with comprehensive command handlers. Include:

- Basic commands: `ping`, `get_app_info`, `example_error`
- File operations: `read_file`, `get_project_kits`, `get_scrapbook_items`
- Directory operations: `get_folder_markdown_files`, `get_blueprints`, `get_project_diagrams`
- Project registry: `get_project_registry`
- File watching: `watch_project_kits`
- Copy operations: `copy_kit_to_project`, `copy_blueprint_to_project`

Each command should:
- Use `#[tauri::command]` attribute
- Return `Result<T, String>` for error handling
- Use serde for serialization
- Include comprehensive documentation

### 6. Implement main.rs

Update `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;
mod utils;
mod watcher;

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
            commands::copy_kit_to_project,
            commands::copy_blueprint_to_project,
            commands::get_scrapbook_items,
            commands::get_folder_markdown_files,
            commands::get_blueprints,
            commands::get_blueprint_task_file,
            commands::get_project_diagrams,
        ])
        .setup(|app| {
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

## Verification

Run these commands to verify:

```bash
# Check Rust compilation
cd src-tauri && cargo check

# Build the project
cargo build

# Run in dev mode (should start without errors)
npm run tauri dev
```

## Completion Criteria

- [ ] All module files created (commands.rs, state.rs, utils.rs, watcher.rs)
- [ ] main.rs updated with module declarations and command registration
- [ ] All commands compile without errors
- [ ] File operations work correctly
- [ ] Project builds successfully

## Next Steps

After verification passes, proceed to: `frontend-foundation.md` in Layer 3.

