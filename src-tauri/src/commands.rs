/// IPC command handlers module.
/// 
/// This module contains all the functions that handle IPC (Inter-Process Communication)
/// requests from the frontend. In Tauri, these are called "commands".
/// 
/// Each command is a Rust function that:
/// 1. Is marked with `#[tauri::command]` attribute
/// 2. Is async (can perform asynchronous operations)
/// 3. Returns a `Result<T, E>` for error handling
/// 4. Can accept parameters from the frontend
/// 5. Can return data back to the frontend

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::env;
use tauri::AppHandle;

/// Response structure for the `get_app_info` command.
/// 
/// The `#[derive(Serialize, Deserialize)]` attributes allow this struct
/// to be automatically converted to/from JSON when communicating with the frontend.
/// 
/// `Serialize` - converts Rust struct to JSON
/// `Deserialize` - converts JSON to Rust struct
#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    /// Application name
    pub name: String,
    /// Application version
    pub version: String,
    /// Platform the app is running on
    pub platform: String,
}

/// Simple ping command to test IPC communication.
/// 
/// This is the simplest possible IPC command - it takes no parameters
/// and returns a simple string. Use this as a template for creating
/// new commands.
/// 
/// # Returns
/// 
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success case with the "pong" message
/// - `Err(String)` - Error case with an error message
/// 
/// In Rust, `Result<T, E>` is the standard way to handle operations
/// that can fail. `Ok(T)` represents success, `Err(E)` represents failure.
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// import { invoke } from '@tauri-apps/api/tauri';
/// const result = await invoke<string>('ping');
/// console.log(result); // "pong"
/// ```
#[tauri::command]
pub async fn ping() -> Result<String, String> {
    // The `Ok()` constructor wraps the success value
    // This string will be sent back to the frontend
    Ok("pong".to_string())
}

/// Gets application information including name, version, and platform.
/// 
/// This command demonstrates how to return structured data (a struct)
/// from a Tauri command. The struct will be automatically serialized
/// to JSON and sent to the frontend.
/// 
/// # Returns
/// 
/// A `Result<AppInfo, String>` containing either:
/// - `Ok(AppInfo)` - Success case with app information
/// - `Err(String)` - Error case with an error message
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// import { invoke } from '@tauri-apps/api/tauri';
/// const info = await invoke<AppInfo>('get_app_info');
/// console.log(info.name); // "bluekit-app"
/// ```
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    // We're creating a new AppInfo struct instance
    // In Rust, structs can be created using struct literal syntax
    let app_info = AppInfo {
        name: "bluekit-app".to_string(),
        version: "0.1.0".to_string(),
        // Using the `std::env::consts::OS` constant to get the platform
        // This is a standard library feature that works at compile time
        platform: std::env::consts::OS.to_string(),
    };
    
    // Return the struct wrapped in Ok()
    // Tauri will automatically serialize this to JSON
    Ok(app_info)
}

/// Example command that demonstrates error handling.
/// 
/// This command shows how to return errors from Tauri commands.
/// In a real application, you might use this pattern when:
/// - File operations fail
/// - Network requests fail
/// - Validation fails
/// 
/// # Arguments
/// 
/// * `should_fail` - If true, the command will return an error
/// 
/// # Returns
/// 
/// A `Result<String, String>` that either succeeds or fails based on the parameter
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// try {
///   const result = await invoke<string>('example_error', { shouldFail: false });
///   console.log(result); // "Success!"
/// } catch (error) {
///   console.error(error); // Error message if shouldFail is true
/// }
/// ```
#[tauri::command]
pub async fn example_error(should_fail: bool) -> Result<String, String> {
    // Rust's `if` expression can return values
    // This is similar to a ternary operator in other languages
    if should_fail {
        // Return an error using the `Err()` constructor
        Err("This is an example error message".to_string())
    } else {
        // Return success
        Ok("Success!".to_string())
    }
}

/// Kit file information structure.
#[derive(Debug, Serialize, Deserialize)]
pub struct KitFile {
    /// Name of the kit file (without .md extension)
    pub name: String,
    /// Full path to the kit file
    pub path: String,
}

/// Reads the .bluekit directory and returns a list of .md files (kits).
/// 
/// # Arguments
/// 
/// * `project_path` - The path to the project root directory
/// 
/// # Returns
/// 
/// A `Result<Vec<KitFile>, String>` containing either:
/// - `Ok(Vec<KitFile>)` - Success case with list of kit files
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_project_kits(project_path: String) -> Result<Vec<KitFile>, String> {
    use std::fs;
    
    // Construct the path to .bluekit directory
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    // Check if .bluekit directory exists
    if !bluekit_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }
    
    // Read the directory
    let entries = fs::read_dir(&bluekit_path)
        .map_err(|e| format!("Failed to read .bluekit directory: {}", e))?;
    
    let mut kits = Vec::new();
    
    // Iterate through directory entries
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        // Check if it's a file and has .md extension
        if path.is_file() {
            if let Some(extension) = path.extension() {
                if extension == "md" {
                    // Get the file name without extension
                    let name = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();
                    
                    // Get the full path as a string
                    let path_str = path
                        .to_str()
                        .ok_or_else(|| "Invalid path encoding".to_string())?
                        .to_string();
                    
                    kits.push(KitFile {
                        name,
                        path: path_str,
                    });
                }
            }
        }
    }
    
    Ok(kits)
}

/// Project registry entry structure.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectEntry {
    /// Unique identifier for the project
    pub id: String,
    /// Project title/name
    pub title: String,
    /// Project description
    pub description: String,
    /// Absolute path to the project directory
    pub path: String,
}

/// Reads the project registry from ~/.bluekit/projectRegistry.json.
/// 
/// # Returns
/// 
/// A `Result<Vec<ProjectEntry>, String>` containing either:
/// - `Ok(Vec<ProjectEntry>)` - Success case with list of projects
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_project_registry() -> Result<Vec<ProjectEntry>, String> {
    use std::fs;
    
    // Get home directory
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE")) // Windows fallback
        .map_err(|_| "Could not determine home directory".to_string())?;
    
    // Construct path to project registry
    let registry_path = PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json");
    
    // Check if registry file exists
    if !registry_path.exists() {
        eprintln!("Project registry file does not exist: {:?}", registry_path);
        return Ok(Vec::new()); // Return empty vector if file doesn't exist
    }
    
    // Read the file
    let contents = fs::read_to_string(&registry_path)
        .map_err(|e| format!("Failed to read project registry: {}", e))?;
    
    // Handle empty file
    if contents.trim().is_empty() {
        eprintln!("Project registry file is empty");
        return Ok(Vec::new());
    }
    
    eprintln!("Read project registry file, contents length: {}", contents.len());
    
    // Parse JSON
    let projects: Vec<ProjectEntry> = serde_json::from_str(&contents)
        .map_err(|e| {
            eprintln!("Failed to parse project registry JSON. Content: {}", contents);
            format!("Failed to parse project registry JSON: {}", e)
        })?;
    
    eprintln!("Successfully parsed {} projects from registry", projects.len());
    Ok(projects)
}

/// Starts watching a project's .bluekit directory for kit file changes.
/// 
/// This command sets up a file watcher that monitors the .bluekit directory
/// in the specified project path. When any .md file is added, modified, or
/// removed, it emits a Tauri event that the frontend can listen to.
/// 
/// # Arguments
/// 
/// * `app_handle` - Tauri application handle (automatically provided)
/// * `project_path` - The path to the project root directory
/// 
/// # Returns
/// 
/// A `Result<(), String>` containing either:
/// - `Ok(())` - Success case
/// - `Err(String)` - Error case with an error message
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// await invoke('watch_project_kits', { projectPath: '/path/to/project' });
/// ```
#[tauri::command]
pub async fn watch_project_kits(
    app_handle: AppHandle,
    project_path: String,
) -> Result<(), String> {
    use crate::watcher;
    
    // Construct the path to .bluekit directory
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    // Generate a unique event name based on the project path
    // Sanitize the path to create a valid event name
    // Replace path separators and special characters with underscores
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

// How to add a new command:
// 
// 1. Create a new async function in this file
// 2. Add the `#[tauri::command]` attribute above it
// 3. Define the function signature with parameters and return type
// 4. Return `Result<T, E>` where T is your success type and E is your error type
// 5. Register the command in `main.rs` (see the `main.rs` file)
// 6. Create a typed wrapper in `src/ipc.ts` on the frontend
// 7. Use the wrapper function in your React components
// 
// Example:
// 
// ```rust
// #[tauri::command]
// pub async fn my_new_command(param: String) -> Result<String, String> {
//     Ok(format!("Received: {}", param))
// }
// ```

