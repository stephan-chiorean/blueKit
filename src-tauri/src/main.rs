// Preprocessor attributes: these run before compilation
// `#![...]` applies to the entire crate (this file and its modules)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")] // Hide console window in release builds on Windows

// Module declarations: tell Rust about other modules in this crate
// These must match the file names in the `src/` directory
mod commands; // IPC command handlers
mod state;    // Application state management
mod utils;    // Utility functions
mod watcher;  // File watching functionality

// Import statements: bring items from other modules into scope
// `use` statements allow us to reference items without their full path
// (No imports needed for basic Tauri setup)

/// Main entry point of the Rust application.
/// 
/// In Rust, `fn main()` is the entry point that gets executed when the program starts.
/// The `#[tokio::main]` attribute converts this function into an async runtime entry point,
/// which is required because Tauri uses async/await for handling IPC commands.
/// 
/// This function:
/// 1. Creates a Tauri application builder
/// 2. Registers all IPC commands (functions that can be called from the frontend)
/// 3. Runs the application, which opens the window and starts the event loop
#[tokio::main]
async fn main() {
    // `tauri::Builder` is used to configure and create a Tauri application
    // The `default()` method creates a builder with default settings
    tauri::Builder::default()
        // `.invoke_handler()` registers all the IPC commands that the frontend can call
        // `tauri::generate_handler![]` is a macro that automatically generates
        // the handler code for the commands we specify
        // 
        // To add a new command:
        // 1. Create the function in `commands.rs` with `#[tauri::command]` attribute
        // 2. Add it to this list: `commands::your_command_name`
        .invoke_handler(tauri::generate_handler![
            commands::ping,              // Simple ping/pong test command
            commands::get_app_info,      // Returns app metadata
            commands::example_error,      // Demonstrates error handling
            commands::get_project_kits,  // Get kits from .bluekit directory
            commands::get_project_registry, // Get projects from registry
            commands::watch_project_kits, // Watch project .bluekit directory for changes
            commands::read_file,        // Read file contents
            commands::copy_kit_to_project, // Copy kit file to project
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
        // `.run()` actually starts the Tauri application
        // This is an async function, so we use `.await` to wait for it
        // If there's an error, `expect()` will panic with the provided message
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
    // Note: The code after `.run()` will never execute because `.run()` blocks
    // until the application is closed. This is the expected behavior for a GUI application.
}

// Architecture Notes:
// 
// 1. **Module Organization**: 
//    - `commands.rs` - All IPC command handlers
//    - `state.rs` - Shared application state (if needed)
//    - `utils.rs` - Reusable helper functions
// 
// 2. **Adding New Commands**:
//    - Create the function in `commands.rs` with `#[tauri::command]`
//    - Add it to the `invoke_handler![]` macro above
//    - Create a typed wrapper in `src/ipc.ts` on the frontend
// 
// 3. **State Management**:
//    - If you need shared state across commands, use Tauri's state management
//    - See `state.rs` for an example structure
//    - Pass state to `.manage()` in the builder chain
// 
// 4. **Error Handling**:
//    - All commands return `Result<T, E>`
//    - Use `Ok(value)` for success
//    - Use `Err(message)` for errors
//    - Errors are automatically sent to the frontend

