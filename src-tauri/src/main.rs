// Preprocessor attributes: these run before compilation
// `#![...]` applies to the entire crate (this file and its modules)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")] // Hide console window in release builds on Windows

// Module declarations: tell Rust about other modules in this crate
// These must match the file names in the `src/` directory
mod commands; // IPC command handlers
mod db;       // Database layer (SeaORM + SQLite)
mod state;    // Application state management
mod utils;    // Utility functions
mod watcher;  // File watching functionality

// Import statements: bring items from other modules into scope
// `use` statements allow us to reference items without their full path
use tauri::Manager;

/// Main entry point of the Rust application.
/// 
/// In Rust, `fn main()` is the entry point that gets executed when the program starts.
/// The `#[tokio::main]` attribute converts this function into an async runtime entry point,
/// which is required because Tauri uses async/await for handling IPC commands.
/// 
/// This function:
/// 1. Initializes logging infrastructure
/// 2. Creates a Tauri application builder
/// 3. Registers all IPC commands (functions that can be called from the frontend)
/// 4. Runs the application, which opens the window and starts the event loop
#[tokio::main]
async fn main() {
    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .init();

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
            commands::get_project_artifacts,  // Get all artifacts from .bluekit directory
            commands::get_project_registry, // Get projects from registry
            commands::watch_project_artifacts, // Watch project .bluekit directory for artifact changes
            commands::read_file,        // Read file contents
            commands::write_file,       // Write file contents
            commands::copy_kit_to_project, // Copy kit file to project
            commands::copy_walkthrough_to_project, // Copy walkthrough file to project
            commands::copy_diagram_to_project, // Copy diagram file to project
            commands::copy_blueprint_to_project, // Copy blueprint directory to project
            commands::get_scrapbook_items, // Get scrapbook folders and files
            commands::get_folder_markdown_files, // Get markdown files from a folder
            commands::get_plans_files, // Get plan files from ~/.claude/plans or ~/.cursor/plans
            commands::get_blueprints, // Get blueprints from .bluekit/blueprints directory
            commands::get_blueprint_task_file, // Get task file content from blueprint
            commands::get_project_diagrams, // Get diagrams from .bluekit/diagrams directory
            commands::get_project_clones, // Get clones from .bluekit/clones.json
            commands::create_project_from_clone, // Create project from clone
            commands::create_new_project, // Create new project with files
            commands::get_watcher_health, // Get health status of all active file watchers
            commands::db_get_tasks, // Get all tasks (database)
            commands::db_get_project_tasks, // Get tasks for a project (database)
            commands::db_get_task, // Get a single task (database)
            commands::db_create_task, // Create a new task (database)
            commands::db_update_task, // Update a task (database)
            commands::db_delete_task, // Delete a task (database)
            commands::delete_resources, // Delete resource files
            commands::update_resource_metadata, // Update resource metadata
        ])
        .setup(|app| {
            // Initialize database synchronously before app starts accepting commands
            // Use a channel to wait for the async initialization to complete
            let (tx, rx) = std::sync::mpsc::channel();

            tauri::async_runtime::spawn(async move {
                let result = db::initialize_database().await;
                let _ = tx.send(result);
            });

            // Wait for initialization to complete
            let db = rx.recv()
                .expect("Database initialization channel closed unexpectedly")
                .expect("Failed to initialize database");

            app.manage(db);

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

