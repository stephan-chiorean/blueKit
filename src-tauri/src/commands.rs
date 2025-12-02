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

/// Scrapbook item structure - can be either a folder or a file.
#[derive(Debug, Serialize, Deserialize)]
pub struct ScrapbookItem {
    /// Name of the folder or file
    pub name: String,
    /// Full path to the folder or file
    pub path: String,
    /// Whether this is a folder (true) or file (false)
    pub is_folder: bool,
}

/// Blueprint metadata structure.
#[derive(Debug, Serialize, Deserialize)]
pub struct Blueprint {
    /// Blueprint directory name
    pub name: String,
    /// Full path to the blueprint directory
    pub path: String,
    /// Blueprint metadata from blueprint.json
    pub metadata: BlueprintMetadata,
}

/// Blueprint metadata from blueprint.json file.
#[derive(Debug, Serialize, Deserialize)]
pub struct BlueprintMetadata {
    pub id: String,
    pub name: String,
    pub version: i32,
    pub description: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub layers: Vec<BlueprintLayer>,
}

/// Blueprint layer structure.
#[derive(Debug, Serialize, Deserialize)]
pub struct BlueprintLayer {
    pub id: String,
    pub order: i32,
    pub name: String,
    pub tasks: Vec<BlueprintTask>,
}

/// Blueprint task structure.
#[derive(Debug, Serialize, Deserialize)]
pub struct BlueprintTask {
    pub id: String,
    #[serde(rename = "taskFile")]
    pub task_file: String,
    pub description: String,
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
    // Construct the path to .bluekit directory
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");

    // Check if .bluekit directory exists
    if !bluekit_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }

    let mut kits = Vec::new();

    // Helper function to read markdown files from a directory recursively
    fn read_md_files_from_dir(dir_path: &PathBuf, kits: &mut Vec<KitFile>) -> Result<(), String> {
        use std::fs;

        if !dir_path.exists() {
            return Ok(()); // Directory doesn't exist, skip it
        }

        let entries = fs::read_dir(dir_path)
            .map_err(|e| format!("Failed to read directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
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
            } else if path.is_dir() {
                // Recursively read subdirectories
                read_md_files_from_dir(&path, kits)?;
            }
        }
        
        Ok(())
    }
    
    // Read from subdirectories: kits, walkthroughs, and agents
    let kits_dir = bluekit_path.join("kits");
    read_md_files_from_dir(&kits_dir, &mut kits)?;
    
    let walkthroughs_dir = bluekit_path.join("walkthroughs");
    read_md_files_from_dir(&walkthroughs_dir, &mut kits)?;
    
    let agents_dir = bluekit_path.join("agents");
    read_md_files_from_dir(&agents_dir, &mut kits)?;
    
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

/// Clone metadata structure matching the clones.json format.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloneMetadata {
    /// Unique clone ID (format: slugified-name-YYYYMMDD)
    pub id: String,
    /// Display name (e.g., "BlueKit Foundation")
    pub name: String,
    /// Description of what this clone represents
    pub description: String,
    /// Git repository URL
    #[serde(rename = "gitUrl")]
    pub git_url: String,
    /// Full commit hash (40 chars)
    #[serde(rename = "gitCommit")]
    pub git_commit: String,
    /// Branch name (if not detached HEAD)
    #[serde(rename = "gitBranch", skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    /// Git tag (if HEAD is on a tag)
    #[serde(rename = "gitTag", skip_serializing_if = "Option::is_none")]
    pub git_tag: Option<String>,
    /// Array of tags for categorization
    pub tags: Vec<String>,
    /// ISO 8601 timestamp
    #[serde(rename = "createdAt")]
    pub created_at: String,
    /// Optional additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
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

    eprintln!("[get_project_registry] Starting to load project registry...");

    // Get home directory
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE")) // Windows fallback
        .map_err(|e| {
            let error_msg = format!("Could not determine home directory: {:?}", e);
            eprintln!("[get_project_registry] ERROR: {}", error_msg);
            error_msg
        })?;

    eprintln!("[get_project_registry] Home directory: {}", home_dir);

    // Construct path to project registry
    let registry_path = PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json");

    eprintln!("[get_project_registry] Looking for registry at: {:?}", registry_path);

    // Check if registry file exists
    if !registry_path.exists() {
        eprintln!("[get_project_registry] WARNING: Project registry file does not exist at {:?}", registry_path);
        return Ok(Vec::new()); // Return empty vector if file doesn't exist
    }

    eprintln!("[get_project_registry] Registry file exists, reading contents...");

    // Read the file
    let contents = fs::read_to_string(&registry_path)
        .map_err(|e| {
            let error_msg = format!("Failed to read project registry at {:?}: {}", registry_path, e);
            eprintln!("[get_project_registry] ERROR: {}", error_msg);
            error_msg
        })?;

    // Handle empty file
    if contents.trim().is_empty() {
        eprintln!("[get_project_registry] WARNING: Project registry file is empty");
        return Ok(Vec::new());
    }

    eprintln!("[get_project_registry] Read {} bytes from registry file", contents.len());
    eprintln!("[get_project_registry] Contents preview: {}", &contents[..contents.len().min(200)]);

    // Parse JSON
    let projects: Vec<ProjectEntry> = serde_json::from_str(&contents)
        .map_err(|e| {
            let error_msg = format!("Failed to parse project registry JSON: {}. Content: {}", e, contents);
            eprintln!("[get_project_registry] ERROR: {}", error_msg);
            error_msg
        })?;

    eprintln!("[get_project_registry] SUCCESS: Parsed {} projects from registry", projects.len());
    for (i, project) in projects.iter().enumerate() {
        eprintln!("[get_project_registry]   Project {}: id={}, title={}, path={}",
            i + 1, project.id, project.title, project.path);
    }

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

/// Reads the contents of a file.
/// 
/// # Arguments
/// 
/// * `file_path` - The absolute path to the file to read
/// 
/// # Returns
/// 
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success case with file contents
/// - `Err(String)` - Error case with an error message
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// const contents = await invoke<string>('read_file', { filePath: '/path/to/file.md' });
/// ```
#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    use std::fs;
    
    let path = PathBuf::from(&file_path);
    
    // Check if file exists
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    // Read the file
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
    
    Ok(contents)
}

/// Copies a kit file to a project's .bluekit directory.
/// 
/// This command reads the source kit file and writes it to the target project's
/// .bluekit/kits directory. It creates the directory structure if it doesn't exist.
/// 
/// # Arguments
/// 
/// * `source_file_path` - The absolute path to the source kit file
/// * `target_project_path` - The absolute path to the target project root directory
/// 
/// # Returns
/// 
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success case with the path to the copied file
/// - `Err(String)` - Error case with an error message
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// const result = await invoke<string>('copy_kit_to_project', {
///   sourceFilePath: '/path/to/source/kit.md',
///   targetProjectPath: '/path/to/target/project'
/// });
/// ```
#[tauri::command]
pub async fn copy_kit_to_project(
    source_file_path: String,
    target_project_path: String,
) -> Result<String, String> {
    use std::fs;
    
    let source_path = PathBuf::from(&source_file_path);
    let target_project = PathBuf::from(&target_project_path);
    
    // Check if source file exists
    if !source_path.exists() {
        return Err(format!("Source file does not exist: {}", source_file_path));
    }
    
    // Check if target project directory exists
    if !target_project.exists() {
        return Err(format!("Target project directory does not exist: {}", target_project_path));
    }
    
    // Get the source file name
    let file_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid source file name".to_string())?
        .to_string();
    
    // Construct target path: target_project/.bluekit/kits/filename
    let bluekit_dir = target_project.join(".bluekit");
    let kits_dir = bluekit_dir.join("kits");
    
    // Create directories if they don't exist
    fs::create_dir_all(&kits_dir)
        .map_err(|e| format!("Failed to create .bluekit/kits directory: {}", e))?;
    
    // Construct the full target file path
    let target_file_path = kits_dir.join(&file_name);
    
    // Read source file contents
    let contents = fs::read_to_string(&source_path)
        .map_err(|e| format!("Failed to read source file: {}", e))?;
    
    // Write to target file
    fs::write(&target_file_path, contents)
        .map_err(|e| format!("Failed to write target file: {}", e))?;
    
    // Return the target file path as a string
    target_file_path
        .to_str()
        .ok_or_else(|| "Invalid target file path encoding".to_string())
        .map(|s| s.to_string())
}

/// Copies a blueprint directory to a project's .bluekit/blueprints directory.
/// 
/// This command recursively copies the entire blueprint directory (including blueprint.json
/// and all task files) to the target project's .bluekit/blueprints directory.
/// 
/// # Arguments
/// 
/// * `source_blueprint_path` - The absolute path to the source blueprint directory
/// * `target_project_path` - The absolute path to the target project root directory
/// 
/// # Returns
/// 
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success case with the path to the copied blueprint directory
/// - `Err(String)` - Error case with an error message
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// const result = await invoke<string>('copy_blueprint_to_project', {
///   sourceBlueprintPath: '/path/to/source/blueprint',
///   targetProjectPath: '/path/to/target/project'
/// });
/// ```
#[tauri::command]
pub async fn copy_blueprint_to_project(
    source_blueprint_path: String,
    target_project_path: String,
) -> Result<String, String> {
    use std::fs;
    
    let source_path = PathBuf::from(&source_blueprint_path);
    let target_project = PathBuf::from(&target_project_path);
    
    // Check if source blueprint directory exists
    if !source_path.exists() {
        return Err(format!("Source blueprint directory does not exist: {}", source_blueprint_path));
    }
    
    if !source_path.is_dir() {
        return Err(format!("Source path is not a directory: {}", source_blueprint_path));
    }
    
    // Check if target project directory exists
    if !target_project.exists() {
        return Err(format!("Target project directory does not exist: {}", target_project_path));
    }
    
    // Get the blueprint directory name
    let blueprint_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid blueprint directory name".to_string())?
        .to_string();
    
    // Construct target path: target_project/.bluekit/blueprints/blueprint_name
    let bluekit_dir = target_project.join(".bluekit");
    let blueprints_dir = bluekit_dir.join("blueprints");
    
    // Create directories if they don't exist
    fs::create_dir_all(&blueprints_dir)
        .map_err(|e| format!("Failed to create .bluekit/blueprints directory: {}", e))?;
    
    // Construct the full target blueprint directory path
    let target_blueprint_path = blueprints_dir.join(&blueprint_name);
    
    // Helper function to recursively copy directory
    fn copy_dir_recursive(source: &PathBuf, target: &PathBuf) -> Result<(), String> {
        use std::fs;
        
        // Create target directory
        fs::create_dir_all(target)
            .map_err(|e| format!("Failed to create directory {}: {}", target.display(), e))?;
        
        // Read source directory entries
        let entries = fs::read_dir(source)
            .map_err(|e| format!("Failed to read directory {}: {}", source.display(), e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let entry_path = entry.path();
            let entry_name = entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| "Invalid entry name".to_string())?;
            
            let target_path = target.join(entry_name);
            
            if entry_path.is_dir() {
                // Recursively copy subdirectory
                copy_dir_recursive(&entry_path, &target_path)?;
            } else {
                // Copy file
                let contents = fs::read_to_string(&entry_path)
                    .map_err(|e| format!("Failed to read file {}: {}", entry_path.display(), e))?;
                fs::write(&target_path, contents)
                    .map_err(|e| format!("Failed to write file {}: {}", target_path.display(), e))?;
            }
        }
        
        Ok(())
    }
    
    // Copy the blueprint directory
    copy_dir_recursive(&source_path, &target_blueprint_path)?;
    
    // Return the target blueprint directory path as a string
    target_blueprint_path
        .to_str()
        .ok_or_else(|| "Invalid target blueprint path encoding".to_string())
        .map(|s| s.to_string())
}

/// Gets scrapbook items (folders and loose .md files) from the .bluekit directory.
///
/// This command scans the .bluekit directory and returns all folders and loose .md files
/// that are not in the known subdirectories (kits, agents, walkthroughs).
///
/// # Arguments
///
/// * `project_path` - The path to the project root directory
///
/// # Returns
///
/// A `Result<Vec<ScrapbookItem>, String>` containing either:
/// - `Ok(Vec<ScrapbookItem>)` - Success case with list of scrapbook items
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_scrapbook_items(project_path: String) -> Result<Vec<ScrapbookItem>, String> {
    use std::fs;

    // Construct the path to .bluekit directory
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");

    // Check if .bluekit directory exists
    if !bluekit_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }

    let mut items = Vec::new();
    let known_folders = vec!["kits", "agents", "walkthroughs", "blueprints", "diagrams"];

    // Read entries in .bluekit directory
    let entries = fs::read_dir(&bluekit_path)
        .map_err(|e| format!("Failed to read .bluekit directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Skip known folders
        if known_folders.contains(&name.as_str()) {
            continue;
        }

        // Skip clones.json file
        if name == "clones.json" {
            continue;
        }

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            // Add folder to scrapbook
            items.push(ScrapbookItem {
                name: name.clone(),
                path: path.to_str().unwrap_or("").to_string(),
                is_folder: true,
            });
        } else if path.is_file() {
            // Only add .md files
            if let Some(extension) = path.extension() {
                if extension == "md" {
                    let file_name = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();

                    items.push(ScrapbookItem {
                        name: file_name,
                        path: path.to_str().unwrap_or("").to_string(),
                        is_folder: false,
                    });
                }
            }
        }
    }

    // Sort items: folders first, then files, alphabetically
    items.sort_by(|a, b| {
        match (a.is_folder, b.is_folder) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(items)
}

/// Gets markdown files from a specific folder in the .bluekit directory.
///
/// # Arguments
///
/// * `folder_path` - The absolute path to the folder
///
/// # Returns
///
/// A `Result<Vec<KitFile>, String>` containing either:
/// - `Ok(Vec<KitFile>)` - Success case with list of markdown files
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_folder_markdown_files(folder_path: String) -> Result<Vec<KitFile>, String> {
    use std::fs;

    let path = PathBuf::from(&folder_path);

    // Check if folder exists
    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();

    // Read entries in the folder
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read folder: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let entry_path = entry.path();

        if entry_path.is_file() {
            if let Some(extension) = entry_path.extension() {
                if extension == "md" {
                    let name = entry_path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();

                    let path_str = entry_path
                        .to_str()
                        .ok_or_else(|| "Invalid path encoding".to_string())?
                        .to_string();

                    files.push(KitFile {
                        name,
                        path: path_str,
                    });
                }
            }
        }
    }

    // Sort alphabetically
    files.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(files)
}

/// Gets all blueprints from the .bluekit/blueprints directory.
///
/// # Arguments
///
/// * `project_path` - The path to the project root directory
///
/// # Returns
///
/// A `Result<Vec<Blueprint>, String>` containing either:
/// - `Ok(Vec<Blueprint>)` - Success case with list of blueprints
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_blueprints(project_path: String) -> Result<Vec<Blueprint>, String> {
    use std::fs;

    // Construct the path to .bluekit/blueprints directory
    let blueprints_path = PathBuf::from(&project_path).join(".bluekit").join("blueprints");

    // Check if blueprints directory exists
    if !blueprints_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }

    let mut blueprints = Vec::new();

    // Read entries in blueprints directory
    let entries = fs::read_dir(&blueprints_path)
        .map_err(|e| format!("Failed to read blueprints directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Only process directories
        if !path.is_dir() {
            continue;
        }

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Skip hidden directories
        if name.starts_with('.') {
            continue;
        }

        // Try to read blueprint.json from this directory
        let blueprint_json_path = path.join("blueprint.json");
        if blueprint_json_path.exists() {
            match fs::read_to_string(&blueprint_json_path) {
                Ok(contents) => {
                    match serde_json::from_str::<BlueprintMetadata>(&contents) {
                        Ok(metadata) => {
                            blueprints.push(Blueprint {
                                name: name.clone(),
                                path: path.to_str().unwrap_or("").to_string(),
                                metadata,
                            });
                        }
                        Err(e) => {
                            eprintln!("Failed to parse blueprint.json in {}: {}", name, e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to read blueprint.json in {}: {}", name, e);
                }
            }
        }
    }

    // Sort blueprints alphabetically by name
    blueprints.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(blueprints)
}

/// Gets the content of a task file from a blueprint directory.
///
/// # Arguments
///
/// * `blueprint_path` - The path to the blueprint directory
/// * `task_file` - The name of the task markdown file (e.g., "project-setup.md")
///
/// # Returns
///
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success case with task file contents
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_blueprint_task_file(
    blueprint_path: String,
    task_file: String,
) -> Result<String, String> {
    use std::fs;

    let blueprint_dir = PathBuf::from(&blueprint_path);
    let task_file_path = blueprint_dir.join(&task_file);

    // Check if task file exists
    if !task_file_path.exists() {
        return Err(format!("Task file does not exist: {}", task_file));
    }

    // Read the task file
    let contents = fs::read_to_string(&task_file_path)
        .map_err(|e| format!("Failed to read task file {}: {}", task_file, e))?;

    Ok(contents)
}

/// Gets all diagram files (.mmd and .mermaid) from the .bluekit/diagrams directory.
///
/// # Arguments
///
/// * `project_path` - The path to the project root directory
///
/// # Returns
///
/// A `Result<Vec<KitFile>, String>` containing either:
/// - `Ok(Vec<KitFile>)` - Success case with list of diagram files
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_project_diagrams(project_path: String) -> Result<Vec<KitFile>, String> {
    use std::fs;

    // Construct the path to .bluekit/diagrams directory
    let diagrams_path = PathBuf::from(&project_path).join(".bluekit").join("diagrams");

    // Check if diagrams directory exists
    if !diagrams_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }

    let mut diagrams = Vec::new();

    // Helper function to read mermaid files from a directory recursively
    fn read_mermaid_files_from_dir(dir_path: &PathBuf, diagrams: &mut Vec<KitFile>) -> Result<(), String> {
        if !dir_path.exists() {
            return Ok(()); // Directory doesn't exist, skip it
        }

        let entries = fs::read_dir(dir_path)
            .map_err(|e| format!("Failed to read directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(extension) = path.extension() {
                    // Accept both .mmd and .mermaid extensions
                    if extension == "mmd" || extension == "mermaid" {
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
                        
                        diagrams.push(KitFile {
                            name,
                            path: path_str,
                        });
                    }
                }
            } else if path.is_dir() {
                // Recursively read subdirectories
                read_mermaid_files_from_dir(&path, diagrams)?;
            }
        }
        
        Ok(())
    }

    // Read from diagrams directory
    read_mermaid_files_from_dir(&diagrams_path, &mut diagrams)?;

    // Sort alphabetically
    diagrams.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(diagrams)
}

/// Gets all clones from the .bluekit/clones.json file.
///
/// This command reads the clones.json file from the specified project's .bluekit directory
/// and returns a list of all registered clones.
///
/// # Arguments
///
/// * `project_path` - The path to the project root directory
///
/// # Returns
///
/// A `Result<Vec<CloneMetadata>, String>` containing either:
/// - `Ok(Vec<CloneMetadata>)` - Success case with list of clones
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_project_clones(project_path: String) -> Result<Vec<CloneMetadata>, String> {
    use std::fs;

    // Construct the path to clones.json
    let clones_path = PathBuf::from(&project_path).join(".bluekit").join("clones.json");

    // Check if clones.json exists
    if !clones_path.exists() {
        return Ok(Vec::new()); // Return empty vector if file doesn't exist
    }

    // Read the file
    let content = fs::read_to_string(&clones_path)
        .map_err(|e| format!("Failed to read clones.json: {}", e))?;

    // Parse JSON
    let clones: Vec<CloneMetadata> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse clones.json: {}", e))?;

    Ok(clones)
}

/// Finds a clone by ID across all projects in the registry.
///
/// This function searches through all projects' clones.json files to find
/// a clone with the matching ID.
///
/// # Arguments
///
/// * `clone_id` - The unique clone ID to search for
///
/// # Returns
///
/// A `Result<(CloneMetadata, String), String>` containing either:
/// - `Ok((CloneMetadata, String))` - Success case with clone and source project path
/// - `Err(String)` - Error case with an error message
fn find_clone_by_id(clone_id: &str) -> Result<(CloneMetadata, String), String> {
    use std::fs;

    // Get home directory
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|e| format!("Could not determine home directory: {:?}", e))?;

    // Construct path to project registry
    let registry_path = PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json");

    // Read project registry
    let projects: Vec<ProjectEntry> = if registry_path.exists() {
        let content = fs::read_to_string(&registry_path)
            .map_err(|e| format!("Failed to read project registry: {}", e))?;
        
        if content.trim().is_empty() {
            Vec::new()
        } else {
            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse project registry: {}", e))?
        }
    } else {
        Vec::new()
    };

    // Search each project's clones.json
    for project in projects {
        let clones_path = PathBuf::from(&project.path)
            .join(".bluekit")
            .join("clones.json");

        if !clones_path.exists() {
            continue;
        }

        // Read and parse clones.json
        let content = fs::read_to_string(&clones_path)
            .map_err(|e| format!("Failed to read clones.json: {}", e))?;

        let clones: Vec<CloneMetadata> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse clones.json: {}", e))?;

        // Find matching clone
        if let Some(clone) = clones.iter().find(|c| c.id == clone_id) {
            return Ok((clone.clone(), project.path));
        }
    }

    Err(format!("Clone not found: {}", clone_id))
}

/// Copies a directory recursively, excluding specified paths.
///
/// # Arguments
///
/// * `source` - Source directory path
/// * `destination` - Destination directory path
/// * `exclude` - Vector of path names to exclude (e.g., [".git"])
///
/// # Returns
///
/// A `Result<(), String>` indicating success or failure
fn copy_directory_excluding(
    source: &PathBuf,
    destination: &PathBuf,
    exclude: &[&str],
) -> Result<(), String> {
    use std::fs;

    // Helper function to check if a path should be excluded
    let should_exclude = |path: &PathBuf| -> bool {
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            exclude.iter().any(|&ex| ex == name)
        } else {
            false
        }
    };

    // Recursive copy function
    fn copy_recursive(
        src: &PathBuf,
        dst: &PathBuf,
        exclude: &[&str],
        should_exclude: &dyn Fn(&PathBuf) -> bool,
    ) -> Result<(), String> {
        use std::fs;

        if should_exclude(src) {
            return Ok(()); // Skip excluded paths
        }

        if src.is_dir() {
            // Create destination directory
            fs::create_dir_all(dst)
                .map_err(|e| format!("Failed to create directory {:?}: {}", dst, e))?;

            // Read directory entries
            let entries = fs::read_dir(src)
                .map_err(|e| format!("Failed to read directory {:?}: {}", src, e))?;

            for entry in entries {
                let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
                let src_path = entry.path();
                let file_name = src_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .ok_or_else(|| "Invalid file name".to_string())?;
                let dst_path = dst.join(file_name);

                copy_recursive(&src_path, &dst_path, exclude, should_exclude)?;
            }
        } else if src.is_file() {
            // Copy file
            fs::copy(src, dst)
                .map_err(|e| format!("Failed to copy file {:?} to {:?}: {}", src, dst, e))?;
        }

        Ok(())
    }

    copy_recursive(source, destination, exclude, &should_exclude)
}

/// Creates a new project from a clone.
///
/// This command:
/// 1. Finds the clone by ID across all projects
/// 2. Clones the git repository to a temporary directory
/// 3. Checks out the specific commit
/// 4. Copies files to the target location (excluding .git)
/// 5. Optionally registers the new project in the registry
/// 6. Cleans up the temporary directory
///
/// # Arguments
///
/// * `clone_id` - The unique clone ID
/// * `target_path` - Absolute path where the new project should be created
/// * `project_title` - Optional title for the new project (used if registering)
/// * `register_project` - Whether to automatically register the new project
///
/// # Returns
///
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success message with project path
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn create_project_from_clone(
    clone_id: String,
    target_path: String,
    project_title: Option<String>,
    register_project: bool,
) -> Result<String, String> {
    use std::fs;
    use std::process::Command;

    // 1. Find clone
    let (clone, _source_project) = find_clone_by_id(&clone_id)?;

    // 2. Validate target path
    let target = PathBuf::from(&target_path);
    if target.exists() {
        return Err(format!("Target path already exists: {}", target_path));
    }

    // Ensure target path is absolute
    let target = if target.is_absolute() {
        target
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join(target)
    };

    // 3. Create temp directory
    let temp_dir = std::env::temp_dir().join(format!("bluekit-clone-{}", std::process::id()));

    // Ensure temp directory doesn't exist
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to remove existing temp directory: {}", e))?;
    }

    // Ensure cleanup happens
    let cleanup_temp = || {
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
    };

    // 4. Clone repository
    let clone_output = Command::new("git")
        .arg("clone")
        .arg("--quiet")
        .arg(&clone.git_url)
        .arg(&temp_dir)
        .output()
        .map_err(|e| {
            cleanup_temp();
            format!("Failed to clone repository: {}", e)
        })?;

    if !clone_output.status.success() {
        cleanup_temp();
        let error = String::from_utf8_lossy(&clone_output.stderr);
        return Err(format!("Git clone failed: {}", error));
    }

    // 5. Checkout commit
    let checkout_output = Command::new("git")
        .arg("-C")
        .arg(&temp_dir)
        .arg("checkout")
        .arg("--quiet")
        .arg(&clone.git_commit)
        .output()
        .map_err(|e| {
            cleanup_temp();
            format!("Failed to checkout commit: {}", e)
        })?;

    if !checkout_output.status.success() {
        cleanup_temp();
        let error = String::from_utf8_lossy(&checkout_output.stderr);
        return Err(format!("Git checkout failed: {}", error));
    }

    // 6. Create target directory
    fs::create_dir_all(&target).map_err(|e| {
        cleanup_temp();
        format!("Failed to create target directory: {}", e)
    })?;

    // 7. Copy files (excluding .git)
    copy_directory_excluding(&temp_dir, &target, &[".git"]).map_err(|e| {
        cleanup_temp();
        format!("Failed to copy files: {}", e)
    })?;

    // 8. Clean up temp directory
    cleanup_temp();

    // 9. Register project (optional)
    if register_project {
        let title = project_title.unwrap_or_else(|| {
            target
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "New Project".to_string())
        });

        let project_entry = ProjectEntry {
            id: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
                .to_string(),
            title,
            description: format!("Created from clone: {}", clone.name),
            path: target_path.clone(),
        };

        // Read existing registry
        let home_dir = env::var("HOME")
            .or_else(|_| env::var("USERPROFILE"))
            .map_err(|e| format!("Could not determine home directory: {:?}", e))?;

        let registry_path = PathBuf::from(&home_dir)
            .join(".bluekit")
            .join("projectRegistry.json");

        let mut projects = if registry_path.exists() {
            let content = fs::read_to_string(&registry_path)
                .map_err(|e| format!("Failed to read registry: {}", e))?;
            serde_json::from_str::<Vec<ProjectEntry>>(&content)
                .unwrap_or_else(|_| Vec::new())
        } else {
            Vec::new()
        };

        // Add new project
        projects.push(project_entry);

        // Ensure .bluekit directory exists
        if let Some(parent) = registry_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create .bluekit directory: {}", e))?;
        }

        // Write back to registry
        let json = serde_json::to_string_pretty(&projects)
            .map_err(|e| format!("Failed to serialize registry: {}", e))?;
        fs::write(&registry_path, json)
            .map_err(|e| format!("Failed to write registry: {}", e))?;
    }

    Ok(format!("Project created successfully at: {}", target_path))
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

use std::collections::HashMap;

/// Gets the health status of all active file watchers.
///
/// Returns a HashMap where keys are event names and values are boolean
/// indicating whether the watcher is alive (true) or dead (false).
///
/// # Returns
///
/// A `Result<HashMap<String, bool>, String>` containing the health status
///
/// # Example
///
/// ```typescript
/// const health = await invoke('get_watcher_health');
/// // { "project-kits-changed-foo": true, "project-kits-changed-bar": false }
/// ```
#[tauri::command]
pub async fn get_watcher_health() -> Result<HashMap<String, bool>, String> {
    Ok(crate::watcher::get_watcher_health().await)
}

