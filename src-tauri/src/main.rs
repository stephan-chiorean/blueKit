// Preprocessor attributes: these run before compilation
// `#![...]` applies to the entire crate (this file and its modules)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")] // Hide console window in release builds on Windows

// Module declarations: tell Rust about other modules in this crate
// These must match the file names in the `src/` directory
mod commands;      // IPC command handlers
mod core;          // Core application functionality
mod db;            // Database layer (SeaORM + SQLite)
mod integrations;  // External service integrations (GitHub, Git, etc.)
mod library;       // Library workspace management

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
    // Load environment variables from .env file (for development)
    #[cfg(debug_assertions)]
    {
        if let Err(e) = dotenv::dotenv() {
            tracing::warn!("Failed to load .env file: {}", e);
        }
    }
    
    // Initialize structured logging
    // INFO level temporarily for debugging timeout issues
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .with_env_filter(
            // Set app logs to INFO, database logs to WARN
            tracing_subscriber::EnvFilter::new("bluekit_app=info,sqlx=warn,sea_orm=warn")
        )
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
            commands::get_bluekit_file_tree, // Get recursive file tree of .bluekit directory
            commands::create_folder, // Create folder
            commands::get_changed_artifacts, // Get only changed artifacts (incremental updates)
            commands::watch_project_artifacts, // Watch project .bluekit directory for artifact changes
            commands::watch_projects_database, // Watch projects database for changes
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
            commands::clone_from_github, // Clone from GitHub
            commands::create_new_project, // Create new project with files
            commands::get_watcher_health, // Get health status of all active file watchers
            commands::stop_watcher, // Stop a file watcher by event name
            commands::db_get_tasks, // Get all tasks (database)
            commands::db_get_project_tasks, // Get tasks for a project (database)
            commands::db_get_task, // Get a single task (database)
            commands::db_create_task, // Create a new task (database)
            commands::db_update_task, // Update a task (database)
            commands::db_delete_task, // Delete a task (database)
            commands::delete_resources, // Delete resource files
            commands::update_resource_metadata, // Update resource metadata
            commands::get_artifact_folders, // Get folders in artifact directory
            commands::create_artifact_folder, // Create new folder with config.json
            commands::update_folder_config, // Update folder config.json
            commands::delete_artifact_folder, // Delete folder and contents
            commands::rename_artifact_folder, // Rename folder
            commands::move_artifact_to_folder, // Move artifact into folder
            commands::move_folder_to_folder, // Move folder into folder (nesting)
            commands::open_project_in_editor, // Open project in Cursor or VSCode
            commands::open_in_terminal, // Open directory in Terminal
            commands::open_file_in_editor, // Open file in Cursor or VSCode
            commands::open_html_in_browser, // Open HTML content in browser
            commands::open_resource_in_window, // Open resource in new Tauri window
            commands::close_preview_window, // Close preview window
            // GitHub OAuth and API commands (tokens passed from Supabase via frontend)
            commands::auth_start_authorization, // Start GitHub OAuth flow
            commands::auth_exchange_code, // Exchange OAuth code for token
            commands::auth_get_status, // Get current auth status
            commands::github_get_user, // Get GitHub user info with token
            commands::github_get_repos, // Get user repositories
            commands::github_get_file, // Get file from repository
            commands::github_create_or_update_file, // Create or update file
            commands::github_delete_file, // Delete file from repository
            commands::github_get_file_sha, // Get file SHA
            commands::github_get_tree, // Get repository tree
            commands::library_create_workspace, // Create Library workspace
            commands::library_list_workspaces, // List Library workspaces
            commands::library_get_workspace, // Get Library workspace
            commands::library_delete_workspace, // Delete Library workspace
            commands::library_update_workspace_name, // Update Library workspace name
            commands::library_set_workspace_pinned, // Pin/unpin Library workspace
            commands::library_get_artifacts, // Get Library artifacts
            commands::library_create_collection, // Create collection in SQLite
            commands::library_get_collections, // Get collections from SQLite
            commands::library_update_collection, // Update collection metadata
            commands::library_delete_collection, // Delete collection from SQLite
            commands::library_add_catalogs_to_collection, // Add catalogs to collection
            commands::library_remove_catalogs_from_collection, // Remove catalogs from collection
            commands::library_get_collection_catalog_ids, // Get catalog IDs in collection
            commands::scan_project_resources, // Scan project resources (Phase 1)
            commands::get_project_resources, // Get project resources (Phase 1)
            commands::get_resource_by_id, // Get resource by ID (Phase 1)
            commands::check_publish_status, // Check publish status (Phase 3)
            // Library publishing commands (now use tokens from Supabase)
            commands::publish_resource, // Publish resource to GitHub
            commands::sync_workspace_catalog, // Sync workspace catalog
            commands::list_workspace_catalogs, // List workspace catalogs
            commands::delete_catalogs, // Delete catalogs
            commands::pull_variation, // Pull variation to project
            commands::check_resource_status, // Check resource publish status
            commands::check_project_for_updates, // Check for resource updates
            commands::migrate_projects_to_database, // Migrate JSON to database (Phase 1)
            commands::db_get_projects, // Get all projects from database (Phase 1)
            commands::db_create_project, // Create new project in database (Phase 1)
            commands::db_update_project, // Update project in database (Phase 1)
            commands::db_delete_project, // Delete project from database (Phase 1)
            commands::get_vault_project, // Get vault project (Phase 1 Vault)
            commands::connect_project_git, // Connect project to git (Phase 1)
            commands::disconnect_project_git, // Disconnect project from git (Phase 1)
            commands::list_project_worktrees, // List git worktrees for project
            commands::open_worktree_in_window, // Open worktree in new window
            // Commit commands (now use tokens from Supabase)
            commands::fetch_project_commits, // Fetch commits from GitHub
            commands::open_commit_in_github, // Open commit in GitHub
            commands::invalidate_commit_cache, // Invalidate commit cache
            commands::checkout_commit_in_project, // Checkout commit in project
            commands::pin_checkpoint, // Pin commit as checkpoint (Phase 3)
            commands::get_project_checkpoints, // Get project checkpoints (Phase 3)
            commands::unpin_checkpoint, // Unpin checkpoint (Phase 3)
            commands::create_project_from_checkpoint, // Create project from checkpoint (Phase 3)
            commands::create_plan, // Create a new plan
            commands::get_project_plans, // Get all plans for a project
            commands::get_plan_details, // Get plan details with phases and milestones
            commands::update_plan, // Update a plan
            commands::delete_plan, // Delete a plan
            commands::link_brainstorm_to_plan, // Link brainstorm file to plan
            commands::unlink_brainstorm_from_plan, // Unlink brainstorm from plan
            commands::link_multiple_plans_to_plan, // Link multiple plans to a plan
            commands::unlink_plan_from_plan, // Unlink a specific plan from a plan
            commands::create_plan_phase, // Create a plan phase
            commands::update_plan_phase, // Update a plan phase
            commands::delete_plan_phase, // Delete a plan phase
            commands::reorder_plan_phases, // Reorder plan phases
            commands::create_plan_milestone, // Create a plan milestone
            commands::update_plan_milestone, // Update a plan milestone
            commands::delete_plan_milestone, // Delete a plan milestone
            commands::toggle_milestone_completion, // Toggle milestone completion
            commands::get_plan_documents, // Get plan documents
            commands::link_document_to_phase, // Link document to phase
            commands::reorder_plan_documents, // Reorder plan documents
            commands::watch_plan_folder, // Watch plan folder for changes
            commands::create_walkthrough, // Create a new walkthrough
            commands::get_project_walkthroughs, // Get all walkthroughs for a project
            commands::get_or_create_walkthrough_by_path, // Get or create walkthrough by file path
            commands::get_walkthrough_details, // Get walkthrough details
            commands::update_walkthrough, // Update a walkthrough
            commands::delete_walkthrough, // Delete a walkthrough
            commands::add_walkthrough_takeaway, // Add takeaway
            commands::toggle_takeaway_complete, // Toggle takeaway completion
            commands::update_walkthrough_takeaway, // Update takeaway
            commands::delete_walkthrough_takeaway, // Delete takeaway
            commands::reorder_walkthrough_takeaways, // Reorder takeaways
            commands::get_walkthrough_notes, // Get walkthrough notes
            commands::add_walkthrough_note, // Add walkthrough note
            commands::update_walkthrough_note, // Update walkthrough note
            commands::delete_walkthrough_note, // Delete walkthrough note
            commands::get_bookmarks, // Get bookmarks from .bluekit/bookmarks.json
            commands::save_bookmarks, // Save bookmarks to .bluekit/bookmarks.json
            commands::add_bookmark, // Add a bookmark to the root
            commands::remove_bookmark, // Remove a bookmark by file path
            commands::reconcile_bookmarks, // Prune invalid bookmark paths
            commands::start_supabase_auth_server, // Start Supabase OAuth callback server
            commands::stop_supabase_auth_server, // Stop Supabase OAuth callback server
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

            app.manage(db.clone());

            // Auto-migrate projects on startup if projectRegistry.json exists
            let db_clone = db.clone();
            tauri::async_runtime::spawn(async move {
                match crate::db::project_operations::migrate_json_to_database(&db_clone).await {
                    Ok(summary) => {
                        if summary.projects_migrated > 0 {
                            tracing::info!(
                                "Auto-migrated {} projects and {} checkpoints",
                                summary.projects_migrated,
                                summary.checkpoints_migrated
                            );
                        }
                    }
                    Err(e) => tracing::warn!("Auto-migration failed: {}", e),
                }
            });

            // Initialize and register artifact cache
            use crate::core::cache::ArtifactCache;
            app.manage(ArtifactCache::new());

            // Initialize OAuth state management (state -> code_verifier mapping)
            use std::collections::HashMap;
            use std::sync::{Arc, Mutex};
            app.manage(Arc::new(Mutex::new(HashMap::<String, String>::new())));

            // Initialize and register commit cache (Phase 2)
            use crate::integrations::github::CommitCache;
            app.manage(CommitCache::new());

            // Register cleanup handler for app shutdown
            let window = app.get_window("main").expect("Failed to get main window");

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Destroyed = event {
                    tracing::info!("App closing, cleaning up watchers...");

                    // Block until cleanup completes
                    tauri::async_runtime::block_on(async {
                        if let Err(e) = crate::core::watcher::stop_all_watchers().await {
                            tracing::error!("Watcher cleanup failed: {}", e);
                        }
                    });

                    tracing::info!("Watcher cleanup complete");
                }
            });

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

