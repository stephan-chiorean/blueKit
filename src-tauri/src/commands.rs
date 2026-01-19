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
use tauri::{AppHandle, State};
use crate::core::cache::ArtifactCache;
use std::collections::HashMap;

/// Parses YAML front matter from markdown content.
///
/// Extracts YAML between `---` delimiters at the start of the file.
/// Returns `None` if no front matter is found or if parsing fails.
fn parse_front_matter(content: &str) -> Option<serde_yaml::Value> {
    if !content.trim_start().starts_with("---") {
        return None;
    }

    let start_pos = content.find("---")?;
    let after_first_delim = start_pos + 3;
    
    // Find the closing "---" (must be on its own line)
    if let Some(end_pos) = content[after_first_delim..].find("\n---") {
        let front_matter_str = content[after_first_delim..after_first_delim + end_pos].trim();
        
        if front_matter_str.is_empty() {
            return None;
        }

        // Parse YAML front matter
        serde_yaml::from_str(front_matter_str).ok()
    } else {
        None
    }
}

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

/// Artifact file information structure.
///
/// Represents any file in the .bluekit directory: kits, walkthroughs, agents,
/// diagrams, tasks, etc. This generic structure allows the backend to return
/// all resources at once while the frontend filters by type.
#[derive(Debug, Serialize, Deserialize)]
pub struct ArtifactFile {
    /// Name of the artifact file (without extension)
    pub name: String,
    /// Full path to the artifact file
    pub path: String,
    /// File content (optional - populated when using cache)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    /// Parsed YAML front matter (optional - populated when using cache)
    #[serde(skip_serializing_if = "Option::is_none", rename = "frontMatter")]
    pub front_matter: Option<serde_yaml::Value>,
}

/// Folder group structure for organizing resources within a folder.
///
/// Similar to blueprint layers, groups allow organizing artifacts into named categories.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderGroup {
    /// Unique identifier for the group
    pub id: String,
    /// Display order (lower numbers appear first)
    pub order: i32,
    /// Display name for the group
    pub name: String,
    /// Array of artifact file paths belonging to this group
    #[serde(rename = "resourcePaths")]
    pub resource_paths: Vec<String>,
}

/// Folder configuration from config.json.
///
/// Each folder in artifact directories can contain a config.json file
/// with metadata about the folder, including optional groups for organizing resources.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderConfig {
    /// Unique identifier (slugified-name-timestamp)
    pub id: String,
    /// Display name for the folder
    pub name: String,
    /// Optional description of the folder's purpose
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Tags for categorization
    #[serde(default)]
    pub tags: Vec<String>,
    /// Optional hex color for visual grouping (#3B82F6)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Optional icon identifier (Lucide icon name)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Optional groups for organizing resources within the folder
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<FolderGroup>>,
    /// Extensible custom metadata (future-proof for Postgres migration)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    /// Creation timestamp (ISO 8601)
    #[serde(rename = "createdAt")]
    pub created_at: String,
    /// Last updated timestamp (ISO 8601)
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

/// Folder information for artifact organization.
///
/// Represents a folder within an artifact type directory (kits, walkthroughs, diagrams).
/// Folders can contain artifacts and other folders (nested).
#[derive(Debug, Serialize, Deserialize)]
pub struct ArtifactFolder {
    /// Folder name (directory name)
    pub name: String,
    /// Full path to the folder
    pub path: String,
    /// Parent folder path (if nested), None if root level
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_path: Option<String>,
    /// Parsed config.json if exists
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<FolderConfig>,
    /// Number of direct child artifacts
    pub artifact_count: usize,
    /// Number of direct child folders
    pub folder_count: usize,
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

/// Reads the .bluekit directory and returns all artifact files.
///
/// This function loads ALL markdown files from .bluekit/ in one shot, including:
/// kits, walkthroughs, agents, diagrams, tasks, and any other .md files.
///
/// Design rationale for "load everything, filter later" approach:
/// - Simpler backend (one function vs many type-specific functions)
/// - Single file watcher monitors all changes
/// - Powers the Scrapbook tab (needs everything)
/// - Frontend filtering by frontMatter.type is cheap compared to file I/O
///
/// # Arguments
///
/// * `project_path` - The path to the project root directory
///
/// # Returns
///
/// A `Result<Vec<ArtifactFile>, String>` containing either:
/// - `Ok(Vec<ArtifactFile>)` - Success case with list of all artifact files
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_project_artifacts(
    project_path: String,
    cache: State<'_, ArtifactCache>,
) -> Result<Vec<ArtifactFile>, String> {
    // Construct the path to .bluekit directory
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");

    // Check if .bluekit directory exists
    if !bluekit_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }

    let mut artifact_paths = Vec::new();

    // Helper function to read artifact files from a directory recursively
    // Scans for: .md (markdown), .mmd (mermaid), .mermaid (mermaid)
    fn read_artifact_files_from_dir(dir_path: &PathBuf, artifact_paths: &mut Vec<PathBuf>) -> Result<(), String> {
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
                    let ext_str = extension.to_str().unwrap_or("");
                    // Include markdown files (.md) and diagram files (.mmd, .mermaid)
                    if ext_str == "md" || ext_str == "mmd" || ext_str == "mermaid" {
                        artifact_paths.push(path);
                    }
                }
            } else if path.is_dir() {
                // Recursively read subdirectories
                read_artifact_files_from_dir(&path, artifact_paths)?;
            }
        }

        Ok(())
    }

    // Read from subdirectories: kits, walkthroughs, agents, tasks, and diagrams
    let kits_dir = bluekit_path.join("kits");
    read_artifact_files_from_dir(&kits_dir, &mut artifact_paths)?;

    let walkthroughs_dir = bluekit_path.join("walkthroughs");
    read_artifact_files_from_dir(&walkthroughs_dir, &mut artifact_paths)?;

    let agents_dir = bluekit_path.join("agents");
    read_artifact_files_from_dir(&agents_dir, &mut artifact_paths)?;

    let tasks_dir = bluekit_path.join("tasks");
    read_artifact_files_from_dir(&tasks_dir, &mut artifact_paths)?;

    let diagrams_dir = bluekit_path.join("diagrams");
    read_artifact_files_from_dir(&diagrams_dir, &mut artifact_paths)?;

    // Read file contents using cache and parse front matter
    let mut artifacts = Vec::new();
    for path in artifact_paths {
        // Get file name without extension
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        // Get full path as string
        let path_str = path
            .to_str()
            .ok_or_else(|| "Invalid path encoding".to_string())?
            .to_string();

        // Read content from cache
        match cache.get_or_read(&path).await {
            Ok(content) => {
                // Parse front matter
                let front_matter = parse_front_matter(&content);
                
                artifacts.push(ArtifactFile {
                    name,
                    path: path_str,
                    content: Some(content),
                    front_matter,
                });
            }
            Err(e) => {
                // If reading fails, still return the artifact without content
                // This maintains backward compatibility
                tracing::warn!("Failed to read file {}: {}", path.display(), e);
                artifacts.push(ArtifactFile {
                    name,
                    path: path_str,
                    content: None,
                    front_matter: None,
                });
            }
        }
    }

    Ok(artifacts)
}

/// Gets only changed artifacts based on file paths.
///
/// This command is used for incremental updates - when the file watcher
/// detects changes, it sends the changed file paths, and this command
/// returns only those artifacts that have actually changed (based on
/// modification time comparison with cache).
///
/// # Arguments
///
/// * `project_path` - The path to the project root directory
/// * `changed_paths` - Vector of file paths that were detected as changed
///
/// # Returns
///
/// A `Result<Vec<ArtifactFile>, String>` containing only changed artifacts
/// with content and front_matter populated.
#[tauri::command]
pub async fn get_changed_artifacts(
    _project_path: String,
    changed_paths: Vec<String>,
    cache: State<'_, ArtifactCache>,
) -> Result<Vec<ArtifactFile>, String> {
    let mut artifacts = Vec::new();

    for path_str in changed_paths {
        let path = PathBuf::from(&path_str);

        // Skip if file doesn't exist (might have been deleted)
        if !path.exists() {
            // Invalidate cache entry for deleted file
            cache.invalidate(&path).await;
            tracing::debug!("File deleted or moved: {}", path.display());
            continue;
        }

        // ALWAYS invalidate cache for changed paths to force re-read
        // This ensures moved files are properly detected even if mod time unchanged
        cache.invalidate(&path).await;

        // Get file name without extension
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        // Read content from cache (will read from disk after invalidation)
        match cache.get_or_read(&path).await {
            Ok(content) => {
                // Parse front matter
                let front_matter = parse_front_matter(&content);

                tracing::debug!("Re-read changed file: {} (name: {})", path.display(), name);
                artifacts.push(ArtifactFile {
                    name,
                    path: path_str,
                    content: Some(content),
                    front_matter,
                });
            }
            Err(e) => {
                tracing::warn!("Failed to read changed file {}: {}", path.display(), e);
                // Still return artifact without content for error handling
                artifacts.push(ArtifactFile {
                    name,
                    path: path_str,
                    content: None,
                    front_matter: None,
                });
            }
        }
    }

    Ok(artifacts)
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

/// Starts watching a project's .bluekit directory for artifact file changes.
///
/// This command sets up a file watcher that monitors the .bluekit directory
/// in the specified project path. When any artifact file (.md, .mmd, etc.) is
/// added, modified, or removed, it emits a Tauri event that the frontend can listen to.
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
/// await invoke('watch_project_artifacts', { projectPath: '/path/to/project' });
/// ```
#[tauri::command]
pub async fn watch_project_artifacts(
    app_handle: AppHandle,
    project_path: String,
) -> Result<(), String> {
    use crate::core::watcher;

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
    let event_name = format!("project-artifacts-changed-{}", sanitized_path);

    // Check if watcher already exists - prevent duplicates
    if watcher::watcher_exists(&event_name).await {
        tracing::info!("Watcher already exists for: {}", event_name);
        return Ok(());
    }

    // Start watching the directory
    watcher::watch_directory(
        app_handle,
        bluekit_path,
        event_name,
    )?;

    Ok(())
}

/// Starts watching the projects database file for changes.
///
/// This command sets up a file watcher that monitors the BlueKit database file
/// (`~/.bluekit/bluekit.db`). When the database file is modified (e.g., when a project
/// is added via CLI), it emits a Tauri event that the frontend can listen to.
///
/// # Arguments
///
/// * `app_handle` - Tauri application handle (automatically provided)
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
/// await invoke('watch_projects_database');
/// ```
#[tauri::command]
pub async fn watch_projects_database(
    app_handle: AppHandle,
) -> Result<(), String> {
    use crate::core::watcher;
    use crate::db;

    // Get the database file path
    let db_path = db::get_db_path()
        .map_err(|e| format!("Failed to get database path: {}", e))?;

    // Event name for database changes
    let event_name = "projects-database-changed".to_string();

    // Check if watcher already exists - prevent duplicates
    if watcher::watcher_exists(&event_name).await {
        tracing::info!("Database watcher already exists");
        return Ok(());
    }

    // Start watching the database file
    watcher::watch_file(
        app_handle,
        db_path,
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

/// Writes content to a file.
///
/// This command writes the provided content to the specified file path.
/// The file will be created if it doesn't exist, or overwritten if it does.
///
/// # Arguments
///
/// * `file_path` - The absolute path to the file to write
/// * `content` - The content to write to the file
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
/// await invoke('write_file', { filePath: '/path/to/file.md', content: 'Hello world' });
/// ```
#[tauri::command]
pub async fn write_file(file_path: String, content: String) -> Result<(), String> {
    use std::fs;

    let path = PathBuf::from(&file_path);

    // Write the file
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;

    Ok(())
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
    
    // Determine target directory: if .bluekit exists, use structured path, otherwise copy directly
    let bluekit_dir = target_project.join(".bluekit");
    let target_file_path = if bluekit_dir.exists() && bluekit_dir.is_dir() {
        // Use structured path: target_project/.bluekit/kits/filename
        let kits_dir = bluekit_dir.join("kits");
        fs::create_dir_all(&kits_dir)
            .map_err(|e| format!("Failed to create .bluekit/kits directory: {}", e))?;
        kits_dir.join(&file_name)
    } else {
        // Copy directly to target directory
        target_project.join(&file_name)
    };
    
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

/// Copies a walkthrough file to a project's .bluekit directory.
/// 
/// This command reads the source walkthrough file and writes it to the target project's
/// .bluekit/walkthroughs directory. It creates the directory structure if it doesn't exist.
/// 
/// # Arguments
/// 
/// * `source_file_path` - The absolute path to the source walkthrough file
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
/// const result = await invoke<string>('copy_walkthrough_to_project', {
///   sourceFilePath: '/path/to/source/walkthrough.md',
///   targetProjectPath: '/path/to/target/project'
/// });
/// ```
#[tauri::command]
pub async fn copy_walkthrough_to_project(
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
    
    // Determine target directory: if .bluekit exists, use structured path, otherwise copy directly
    let bluekit_dir = target_project.join(".bluekit");
    let target_file_path = if bluekit_dir.exists() && bluekit_dir.is_dir() {
        // Use structured path: target_project/.bluekit/walkthroughs/filename
        let walkthroughs_dir = bluekit_dir.join("walkthroughs");
        fs::create_dir_all(&walkthroughs_dir)
            .map_err(|e| format!("Failed to create .bluekit/walkthroughs directory: {}", e))?;
        walkthroughs_dir.join(&file_name)
    } else {
        // Copy directly to target directory
        target_project.join(&file_name)
    };
    
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

/// Copies a diagram file to a project's .bluekit directory.
/// 
/// This command reads the source diagram file (.mmd or .mermaid) and writes it to the target project's
/// .bluekit/diagrams directory. It creates the directory structure if it doesn't exist.
/// 
/// # Arguments
/// 
/// * `source_file_path` - The absolute path to the source diagram file
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
/// const result = await invoke<string>('copy_diagram_to_project', {
///   sourceFilePath: '/path/to/source/diagram.mmd',
///   targetProjectPath: '/path/to/target/project'
/// });
/// ```
#[tauri::command]
pub async fn copy_diagram_to_project(
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
    
    // Determine target directory: if .bluekit exists, use structured path, otherwise copy directly
    let bluekit_dir = target_project.join(".bluekit");
    let target_file_path = if bluekit_dir.exists() && bluekit_dir.is_dir() {
        // Use structured path: target_project/.bluekit/diagrams/filename
        let diagrams_dir = bluekit_dir.join("diagrams");
        fs::create_dir_all(&diagrams_dir)
            .map_err(|e| format!("Failed to create .bluekit/diagrams directory: {}", e))?;
        diagrams_dir.join(&file_name)
    } else {
        // Copy directly to target directory
        target_project.join(&file_name)
    };
    
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
/// that are not in the known subdirectories (kits, agents, walkthroughs, tasks, blueprints, diagrams).
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
    let known_folders = vec!["kits", "agents", "walkthroughs", "blueprints", "diagrams", "tasks"];

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
/// A `Result<Vec<ArtifactFile>, String>` containing either:
/// - `Ok(Vec<ArtifactFile>)` - Success case with list of markdown files
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_folder_markdown_files(folder_path: String) -> Result<Vec<ArtifactFile>, String> {
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

                    files.push(ArtifactFile {
                        name,
                        path: path_str,
                        content: None,
                        front_matter: None,
                    });
                }
            }
        }
    }

    // Sort alphabetically
    files.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(files)
}

/// Gets all plan files from Claude or Cursor plans directory.
///
/// This command reads markdown files from either `~/.claude/plans` or `~/.cursor/plans`
/// based on the source parameter.
///
/// # Arguments
///
/// * `source` - Either "claude" or "cursor" to specify which plans directory to read
///
/// # Returns
///
/// A `Result<Vec<ArtifactFile>, String>` containing either:
/// - `Ok(Vec<ArtifactFile>)` - Success case with list of plan files
/// - `Err(String)` - Error case with an error message
///
/// # Example Usage (from frontend)
///
/// ```typescript
/// const plans = await invoke<ArtifactFile[]>('get_plans_files', { source: 'claude' });
/// ```
#[tauri::command]
pub async fn get_plans_files(source: String) -> Result<Vec<ArtifactFile>, String> {
    use std::fs;

    // Validate source
    if source != "claude" && source != "cursor" {
        return Err(format!("Invalid source: {}. Must be 'claude' or 'cursor'", source));
    }

    // Get home directory
    let home_dir = env::var("HOME")
        .map_err(|e| format!("Could not determine home directory: {:?}", e))?;

    // Construct path to plans directory
    let plans_path = PathBuf::from(&home_dir)
        .join(if source == "claude" { ".claude" } else { ".cursor" })
        .join("plans");

    // Check if folder exists
    if !plans_path.exists() || !plans_path.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();

    // Read entries in the folder
    let entries = fs::read_dir(&plans_path)
        .map_err(|e| format!("Failed to read plans folder: {}", e))?;

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

                    files.push(ArtifactFile {
                        name,
                        path: path_str,
                        content: None,
                        front_matter: None,
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
/// A `Result<Vec<ArtifactFile>, String>` containing either:
/// - `Ok(Vec<ArtifactFile>)` - Success case with list of diagram files
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_project_diagrams(project_path: String) -> Result<Vec<ArtifactFile>, String> {
    use std::fs;

    // Construct the path to .bluekit/diagrams directory
    let diagrams_path = PathBuf::from(&project_path).join(".bluekit").join("diagrams");

    // Check if diagrams directory exists
    if !diagrams_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }

    let mut diagrams = Vec::new();

    // Helper function to read mermaid files from a directory recursively
    fn read_mermaid_files_from_dir(dir_path: &PathBuf, diagrams: &mut Vec<ArtifactFile>) -> Result<(), String> {
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
                        
                        diagrams.push(ArtifactFile {
                            name,
                            path: path_str,
                            content: None,
                            front_matter: None,
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
    db: State<'_, DatabaseConnection>,
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

    // 9. Register project in database (optional)
    if register_project {
        use sea_orm::*;
        use chrono::Utc;
        use uuid::Uuid;

        let title = project_title.unwrap_or_else(|| {
            target
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "New Project".to_string())
        });

        let now = Utc::now().timestamp_millis();
        let id = Uuid::new_v4().to_string();

        let project = crate::db::entities::project::ActiveModel {
            id: Set(id),
            name: Set(title),
            path: Set(target_path.clone()),
            description: Set(Some(format!("Created from clone: {}", clone.name))),
            tags: Set(None),
            git_connected: Set(false),
            git_url: Set(None),
            git_branch: Set(None),
            git_remote: Set(None),
            last_commit_sha: Set(None),
            last_synced_at: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
            last_opened_at: Set(None),
        };

        project.insert(&*db).await
            .map_err(|e| format!("Failed to register project in database: {}", e))?;
    }

    Ok(format!("Project created successfully at: {}", target_path))
}

/// Creates a new project directory and copies files to it.
/// 
/// This command:
/// 1. Creates a new project directory at the specified path
/// 2. Creates .bluekit directory structure
/// 3. Copies source files to appropriate subdirectories based on file type
/// 4. Registers the project in the database
/// 
/// # Arguments
/// 
/// * `target_path` - The absolute path where the new project should be created
/// * `project_title` - Title for the new project
/// * `source_files` - Array of source file paths with their types
/// 
/// # Returns
/// 
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success case with the project path
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn create_new_project(
    db: State<'_, DatabaseConnection>,
    target_path: String,
    project_title: String,
    source_files: Vec<(String, String)>, // (file_path, file_type) where file_type is "kit", "walkthrough", or "diagram"
) -> Result<String, String> {
    use std::fs;
    
    let target = PathBuf::from(&target_path);
    
    // Check if target path already exists
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
    
    // Create project directory
    fs::create_dir_all(&target)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    
    // Create .bluekit directory structure
    let bluekit_dir = target.join(".bluekit");
    let kits_dir = bluekit_dir.join("kits");
    let walkthroughs_dir = bluekit_dir.join("walkthroughs");
    let diagrams_dir = bluekit_dir.join("diagrams");
    
    fs::create_dir_all(&kits_dir)
        .map_err(|e| format!("Failed to create .bluekit/kits directory: {}", e))?;
    fs::create_dir_all(&walkthroughs_dir)
        .map_err(|e| format!("Failed to create .bluekit/walkthroughs directory: {}", e))?;
    fs::create_dir_all(&diagrams_dir)
        .map_err(|e| format!("Failed to create .bluekit/diagrams directory: {}", e))?;
    
    // Capture file count before moving source_files
    let file_count = source_files.len();
    
    // Copy files to appropriate directories
    for (source_file_path, file_type) in source_files {
        let source_path = PathBuf::from(&source_file_path);
        
        if !source_path.exists() {
            eprintln!("Warning: Source file does not exist: {}", source_file_path);
            continue;
        }
        
        let file_name = source_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| format!("Invalid source file name: {}", source_file_path))?
            .to_string();
        
        // Determine target directory based on file type
        let target_dir = match file_type.as_str() {
            "kit" => &kits_dir,
            "walkthrough" => &walkthroughs_dir,
            "diagram" => &diagrams_dir,
            _ => {
                eprintln!("Warning: Unknown file type '{}', copying to kits directory", file_type);
                &kits_dir
            }
        };
        
        let target_file_path = target_dir.join(&file_name);
        
        // Read source file contents
        let contents = fs::read_to_string(&source_path)
            .map_err(|e| format!("Failed to read source file {}: {}", source_file_path, e))?;
        
        // Write to target file
        fs::write(&target_file_path, contents)
            .map_err(|e| format!("Failed to write target file {}: {}", target_file_path.display(), e))?;
    }
    
    // Register project in database
    use sea_orm::*;
    use chrono::Utc;
    use uuid::Uuid;

    let now = Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    let project = crate::db::entities::project::ActiveModel {
        id: Set(id),
        name: Set(project_title),
        path: Set(target_path.clone()),
        description: Set(Some(format!("Created with {} file{}", file_count, if file_count != 1 { "s" } else { "" }))),
        tags: Set(None),
        git_connected: Set(false),
        git_url: Set(None),
        git_branch: Set(None),
        git_remote: Set(None),
        last_commit_sha: Set(None),
        last_synced_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
        last_opened_at: Set(None),
    };

    project.insert(&*db).await
        .map_err(|e| format!("Failed to register project in database: {}", e))?;
    
    Ok(target_path)
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
    Ok(crate::core::watcher::get_watcher_health().await)
}

/// Stops a file watcher by event name.
///
/// This command gracefully stops a running file watcher task by sending a
/// cancellation signal and waiting for the task to complete (with 5s timeout).
///
/// # Arguments
///
/// * `event_name` - The event name of the watcher to stop
///
/// # Returns
///
/// A `Result<(), String>` containing success or error message
///
/// # Example
///
/// ```typescript
/// await invoke('stop_watcher', { eventName: 'project-kits-changed-foo' });
/// ```
#[tauri::command]
pub async fn stop_watcher(event_name: String) -> Result<(), String> {
    crate::core::watcher::stop_watcher(&event_name).await
}

// ============================================================================
// DATABASE-BACKED TASK COMMANDS
// ============================================================================

/// Get all tasks, optionally filtered by project IDs
#[tauri::command]
pub async fn db_get_tasks(
    db: State<'_, sea_orm::DatabaseConnection>,
    project_ids: Option<Vec<String>>,
) -> Result<Vec<crate::db::task_operations::TaskDto>, String> {
    crate::db::task_operations::get_tasks(db.inner(), project_ids)
        .await
        .map_err(|e| format!("Failed to get tasks: {}", e))
}

/// Get tasks for a specific project
#[tauri::command]
pub async fn db_get_project_tasks(
    db: State<'_, sea_orm::DatabaseConnection>,
    project_id: String,
) -> Result<Vec<crate::db::task_operations::TaskDto>, String> {
    crate::db::task_operations::get_tasks(db.inner(), Some(vec![project_id]))
        .await
        .map_err(|e| format!("Failed to get project tasks: {}", e))
}

/// Get a single task by ID
#[tauri::command]
pub async fn db_get_task(
    db: State<'_, sea_orm::DatabaseConnection>,
    task_id: String,
) -> Result<Option<crate::db::task_operations::TaskDto>, String> {
    crate::db::task_operations::get_task(db.inner(), &task_id)
        .await
        .map_err(|e| format!("Failed to get task: {}", e))
}

/// Create a new task
#[tauri::command]
pub async fn db_create_task(
    db: State<'_, sea_orm::DatabaseConnection>,
    title: String,
    description: Option<String>,
    priority: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
    status: Option<String>,
    complexity: Option<String>,
    type_: Option<String>,
) -> Result<crate::db::task_operations::TaskDto, String> {
    eprintln!("[db_create_task] Received type_: {:?}", type_);
    
    crate::db::task_operations::create_task(
        db.inner(),
        title,
        description,
        priority,
        tags,
        project_ids,
        status,
        complexity,
        type_,
    )
    .await
    .map_err(|e| format!("Failed to create task: {}", e))
}

/// Update an existing task
#[tauri::command]
pub async fn db_update_task(
    db: State<'_, sea_orm::DatabaseConnection>,
    task_id: String,
    title: Option<String>,
    description: Option<Option<String>>,
    priority: Option<String>,
    tags: Option<Vec<String>>,
    project_ids: Option<Vec<String>>,
    status: Option<String>,
    complexity: Option<Option<String>>,
    type_: Option<Option<String>>,
) -> Result<crate::db::task_operations::TaskDto, String> {
    eprintln!("[db_update_task] Received type_: {:?}", type_);
    
    crate::db::task_operations::update_task(
        db.inner(),
        task_id,
        title,
        description,
        priority,
        tags,
        project_ids,
        status,
        complexity,
        type_,
    )
    .await
    .map_err(|e| format!("Failed to update task: {}", e))
}

/// Delete a task
#[tauri::command]
pub async fn db_delete_task(
    db: State<'_, sea_orm::DatabaseConnection>,
    task_id: String,
) -> Result<(), String> {
    crate::db::task_operations::delete_task(db.inner(), &task_id)
        .await
        .map_err(|e| format!("Failed to delete task: {}", e))
}

/// Delete resource files from the filesystem.
///
/// This command deletes one or more resource files (kits, walkthroughs, agents, diagrams).
/// It validates that all paths are within `.bluekit` directories for safety.
///
/// # Arguments
///
/// * `file_paths` - Vector of absolute file paths to delete
///
/// # Returns
///
/// A `Result<(), String>` containing either:
/// - `Ok(())` - Success case (all files deleted)
/// - `Err(String)` - Error case with an error message
///
/// # Safety
///
/// This function validates that all file paths are within `.bluekit` directories
/// to prevent accidental deletion of files outside the project structure.
#[tauri::command]
pub async fn delete_resources(file_paths: Vec<String>) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let mut errors = Vec::new();

    for file_path in file_paths {
        let path = Path::new(&file_path);

        // Validate path is within a .bluekit directory for safety
        if !path.to_string_lossy().contains(".bluekit") {
            errors.push(format!(
                "Path is not within a .bluekit directory: {}",
                file_path
            ));
            continue;
        }

        // Check if file exists
        if !path.exists() {
            // File already deleted, skip silently or log warning
            continue;
        }

        // Attempt to delete the file
        match fs::remove_file(path) {
            Ok(_) => {
                // File deleted successfully
            }
            Err(e) => {
                errors.push(format!(
                    "Failed to delete file {}: {}",
                    file_path,
                    e
                ));
            }
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!("Some deletions failed: {}", errors.join("; ")))
    }
}

/// Update metadata in a resource file's YAML front matter.
///
/// This command updates the YAML front matter of a resource file (kit, walkthrough,
/// agent, or diagram) while preserving the markdown body content.
///
/// # Arguments
///
/// * `file_path` - Absolute path to the resource file
/// * `alias` - Optional new alias/title value
/// * `description` - Optional new description value
/// * `tags` - Optional new tags array
///
/// # Returns
///
/// A `Result<(), String>` containing either:
/// - `Ok(())` - Success case (metadata updated)
/// - `Err(String)` - Error case with an error message
///
/// # Behavior
///
/// - If front matter doesn't exist, creates a new front matter block
/// - Updates only the specified fields, preserving all others
/// - Preserves the markdown body content unchanged
/// - Works with both `.md` and `.mmd`/`.mermaid` files
#[tauri::command]
pub async fn update_resource_metadata(
    file_path: String,
    alias: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    use serde_yaml::{Mapping, Value};

    let path = Path::new(&file_path);

    // Validate path is within a .bluekit directory for safety
    if !path.to_string_lossy().contains(".bluekit") {
        return Err(format!(
            "Path is not within a .bluekit directory: {}",
            file_path
        ));
    }

    // Read existing file content
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;

    // Parse front matter and body
    // Front matter is between --- delimiters at the start of the file
    let (mut front_matter, body) = if content.trim_start().starts_with("---") {
        // Skip leading whitespace and first "---"
        let start_pos = content.find("---").unwrap();
        let after_first_delim = start_pos + 3;
        
        // Find the closing "---" (must be on its own line)
        if let Some(end_pos) = content[after_first_delim..].find("\n---") {
            let front_matter_end = after_first_delim + end_pos + 4; // +4 for "\n---"
            let front_matter_str = content[after_first_delim..after_first_delim + end_pos].trim();
            let body = content[front_matter_end..].to_string();

            // Parse existing front matter
            let fm: Mapping = if front_matter_str.is_empty() {
                Mapping::new()
            } else {
                serde_yaml::from_str(front_matter_str)
                    .map_err(|e| format!("Failed to parse YAML front matter: {}", e))?
            };

            (fm, body)
        } else {
            // Malformed front matter (no closing ---), treat as no front matter
            (Mapping::new(), content)
        }
    } else {
        // No front matter exists, create new
        (Mapping::new(), content)
    };

    // Update specified fields
    if let Some(alias_value) = alias {
        front_matter.insert(
            Value::String("alias".to_string()),
            Value::String(alias_value),
        );
    }

    if let Some(desc_value) = description {
        front_matter.insert(
            Value::String("description".to_string()),
            Value::String(desc_value),
        );
    }

    if let Some(tags_value) = tags {
        let tags_array: Vec<Value> = tags_value
            .into_iter()
            .map(|tag| Value::String(tag))
            .collect();
        front_matter.insert(
            Value::String("tags".to_string()),
            Value::Sequence(tags_array),
        );
    }

    // Serialize updated front matter
    let updated_front_matter = serde_yaml::to_string(&front_matter)
        .map_err(|e| format!("Failed to serialize YAML front matter: {}", e))?;

    // Reconstruct file content with updated front matter
    let new_content = if front_matter.is_empty() {
        // No front matter to write, just return body
        body
    } else {
        // Write front matter with proper delimiters
        // Ensure there's a newline before the closing --- delimiter
        let trimmed_fm = updated_front_matter.trim_end();
        format!("---\n{}\n---\n{}", trimmed_fm, body)
    };

    // Write back to file
    fs::write(path, new_content)
        .map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;

    Ok(())
}

/// Gets all folders in a specific artifact type directory.
///
/// This command scans a specific subdirectory (kits, walkthroughs, diagrams) and
/// returns all folders found. Folders are flat (no nesting) and only contain
/// basic metadata: name, path, and child counts.
///
/// # Arguments
///
/// * `project_path` - Path to project root
/// * `artifact_type` - Type directory to scan ("kits", "walkthroughs", "diagrams")
///
/// # Returns
///
/// A `Result<Vec<ArtifactFolder>, String>` with all folders found
#[tauri::command]
pub async fn get_artifact_folders(
    project_path: String,
    artifact_type: String,
) -> Result<Vec<ArtifactFolder>, String> {
    use std::fs;

    let artifact_dir = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type);

    if !artifact_dir.exists() {
        return Ok(Vec::new());
    }

    let mut folders = Vec::new();

    // Helper to count direct children (artifacts only, no subfolder count since flat structure)
    fn count_artifacts(dir: &PathBuf) -> Result<usize, String> {
        let entries = fs::read_dir(dir)
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        let mut artifact_count = 0;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if matches!(ext, "md" | "mmd" | "mermaid") {
                        artifact_count += 1;
                    }
                }
            }
        }

        Ok(artifact_count)
    }

    // Flat folder structure - only scan root level, no recursion
    let entries = fs::read_dir(&artifact_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let folder_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            // Skip hidden directories
            if folder_name.starts_with('.') {
                continue;
            }

            // Count direct artifacts only (no config.json reading, no nesting)
            let artifact_count = count_artifacts(&path)?;

            folders.push(ArtifactFolder {
                name: folder_name,
                path: path.to_str().unwrap_or("").to_string(),
                parent_path: None, // Flat structure - no parents
                config: None,      // No config.json dependency
                artifact_count,
                folder_count: 0,   // Flat structure - no subfolders
            });
        }
    }

    Ok(folders)
}

/// Creates a new empty folder in an artifact directory.
///
/// Folders are flat (no nesting) and contain only artifacts.
/// No config.json is created - the folder name is the only metadata.
///
/// # Arguments
///
/// * `project_path` - Path to project root
/// * `artifact_type` - Type directory ("kits", "walkthroughs", "diagrams")
/// * `parent_path` - Ignored (kept for backward compatibility, flat structure only)
/// * `folder_name` - Name of the new folder
/// * `config` - Ignored (kept for backward compatibility, no config.json created)
///
/// # Returns
///
/// Path to the created folder
#[tauri::command]
pub async fn create_artifact_folder(
    project_path: String,
    artifact_type: String,
    _parent_path: Option<String>,  // Ignored - flat structure
    folder_name: String,
    _config: FolderConfig,          // Ignored - no config.json
) -> Result<String, String> {
    use std::fs;

    // Always create at root level (flat structure)
    let base_dir = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type);

    let folder_path = base_dir.join(&folder_name);

    if folder_path.exists() {
        return Err(format!("Folder already exists: {}", folder_name));
    }

    // Just create the folder, no config.json
    fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(folder_path.to_str().unwrap_or("").to_string())
}

/// DEPRECATED: Updates a folder's config.json file.
///
/// This function is deprecated as folders no longer use config.json.
/// It is kept for backward compatibility but does nothing.
///
/// # Arguments
///
/// * `folder_path` - Full path to the folder
/// * `config` - Updated folder configuration (ignored)
///
/// # Returns
///
/// Always returns Ok(())
#[tauri::command]
pub async fn update_folder_config(
    _folder_path: String,
    _config: FolderConfig,
) -> Result<(), String> {
    // DEPRECATED: Folders no longer use config.json
    // This function is kept for backward compatibility but does nothing
    Ok(())
}

/// Deletes a folder and all its contents.
///
/// WARNING: This permanently deletes the folder and all files/subfolders inside.
///
/// # Arguments
///
/// * `folder_path` - Full path to the folder to delete
///
/// # Safety
///
/// - Validates path is within .bluekit directory
/// - Returns error if path is invalid or outside .bluekit
#[tauri::command]
pub async fn delete_artifact_folder(
    folder_path: String,
) -> Result<(), String> {
    use std::fs;

    let path = PathBuf::from(&folder_path);

    // Validate path is within .bluekit
    if !path.to_string_lossy().contains(".bluekit") {
        return Err("Path must be within .bluekit directory".to_string());
    }

    if !path.exists() {
        return Err("Folder does not exist".to_string());
    }

    // Remove directory and all contents
    fs::remove_dir_all(&path)
        .map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

/// Renames a folder.
///
/// # Arguments
///
/// * `folder_path` - Full path to the folder to rename
/// * `new_name` - New name for the folder
///
/// # Returns
///
/// New path of the renamed folder
///
/// # Safety
///
/// - Validates path is within .bluekit directory
/// - Returns error if new name already exists
#[tauri::command]
pub async fn rename_artifact_folder(
    folder_path: String,
    new_name: String,
) -> Result<String, String> {
    use std::fs;

    let path = PathBuf::from(&folder_path);

    // Validate path is within .bluekit
    if !path.to_string_lossy().contains(".bluekit") {
        return Err("Path must be within .bluekit directory".to_string());
    }

    if !path.exists() {
        return Err("Folder does not exist".to_string());
    }

    // Get parent directory
    let parent = path.parent()
        .ok_or_else(|| "Invalid folder path".to_string())?;

    // Create new path with new name
    let new_path = parent.join(&new_name);

    // Check if it's a case-only rename
    let is_case_rename = path.to_string_lossy().to_lowercase() == new_path.to_string_lossy().to_lowercase();

    if new_path.exists() && !is_case_rename {
        return Err(format!("A folder named '{}' already exists", new_name));
    }

    // Rename folder
    fs::rename(&path, &new_path)
        .map_err(|e| format!("Failed to rename folder: {}", e))?;

    Ok(new_path.to_str().unwrap_or("").to_string())
}

/// Moves an artifact file into a folder.
///
/// # Arguments
///
/// * `artifact_path` - Full path to the artifact file
/// * `target_folder_path` - Full path to the target folder
///
/// # Returns
///
/// New path of the moved artifact
#[tauri::command]
pub async fn move_artifact_to_folder(
    artifact_path: String,
    target_folder_path: String,
) -> Result<String, String> {
    use std::fs;

    let source = PathBuf::from(&artifact_path);
    let target_folder = PathBuf::from(&target_folder_path);

    if !source.exists() {
        return Err("Source artifact does not exist".to_string());
    }

    if !target_folder.exists() || !target_folder.is_dir() {
        return Err("Target folder does not exist".to_string());
    }

    let file_name = source.file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?;
    let destination = target_folder.join(file_name);

    if destination.exists() {
        return Err(format!("File already exists in target folder: {:?}", file_name));
    }

    // Move file
    fs::rename(&source, &destination)
        .map_err(|e| format!("Failed to move file: {}", e))?;

    Ok(destination.to_str().unwrap_or("").to_string())
}

/// Moves a folder into another folder (creating nesting).
///
/// # Arguments
///
/// * `source_folder_path` - Full path to folder being moved
/// * `target_folder_path` - Full path to destination folder
///
/// # Returns
///
/// New path of the moved folder
#[tauri::command]
pub async fn move_folder_to_folder(
    source_folder_path: String,
    target_folder_path: String,
) -> Result<String, String> {
    use std::fs;

    let source = PathBuf::from(&source_folder_path);
    let target_folder = PathBuf::from(&target_folder_path);

    // Prevent moving folder into itself or its descendants
    if target_folder.starts_with(&source) {
        return Err("Cannot move folder into itself or its subdirectories".to_string());
    }

    if !source.exists() || !source.is_dir() {
        return Err("Source folder does not exist".to_string());
    }

    if !target_folder.exists() || !target_folder.is_dir() {
        return Err("Target folder does not exist".to_string());
    }

    let folder_name = source.file_name()
        .ok_or_else(|| "Invalid source folder name".to_string())?;
    let destination = target_folder.join(folder_name);

    if destination.exists() {
        return Err(format!("Folder already exists in target: {:?}", folder_name));
    }

    // Move entire folder tree
    fs::rename(&source, &destination)
        .map_err(|e| format!("Failed to move folder: {}", e))?;

    Ok(destination.to_str().unwrap_or("").to_string())
}

/// Opens a project in the specified editor.
///
/// This command opens a project directory in either Cursor or VSCode.
/// It uses the system's default command for each editor.
///
/// # Arguments
///
/// * `project_path` - The absolute path to the project directory
/// * `editor` - The editor to use: "cursor" or "vscode"
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
/// await invoke('open_project_in_editor', { 
///   projectPath: '/path/to/project', 
///   editor: 'cursor' 
/// });
/// ```
#[tauri::command]
pub async fn open_project_in_editor(
    project_path: String,
    editor: String,
) -> Result<(), String> {
    use std::process::Command;

    let path = PathBuf::from(&project_path);

    // Verify the project path exists
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    if !path.is_dir() {
        return Err(format!("Project path is not a directory: {}", project_path));
    }

    // Determine the command based on the editor
    let (cmd, args) = match editor.as_str() {
        "cursor" => {
            #[cfg(target_os = "macos")]
            {
                ("open", vec!["-a", "Cursor", &project_path])
            }
            #[cfg(not(target_os = "macos"))]
            {
                ("cursor", vec![&project_path])
            }
        }
        "vscode" | "code" => {
            #[cfg(target_os = "macos")]
            {
                ("open", vec!["-a", "Visual Studio Code", &project_path])
            }
            #[cfg(not(target_os = "macos"))]
            {
                ("code", vec![&project_path])
            }
        }
        "antigravity" => {
            #[cfg(target_os = "macos")]
            {
                ("open", vec!["-a", "Antigravity", &project_path])
            }
            #[cfg(not(target_os = "macos"))]
            {
                ("antigravity", vec![&project_path])
            }
        }
        _ => {
            return Err(format!("Unknown editor: {}. Supported editors: 'cursor', 'vscode', 'antigravity'", editor));
        }
    };

    // Execute the command
    let output = Command::new(cmd)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to open project in {}: {}", editor, stderr));
    }

    Ok(())
}

/// Opens a file in the specified editor (Cursor or VSCode).
///
/// Similar to `open_project_in_editor`, but opens a specific file instead of a directory.
///
/// # Arguments
/// * `file_path` - Absolute path to the file to open
/// * `editor` - The editor to use: 'cursor' or 'vscode'
///
/// # Returns
/// * `Ok(())` if the file was opened successfully
/// * `Err(String)` if the file doesn't exist, is not a file, or the editor failed to open
///
/// # Examples
/// ```typescript
/// await invoke('open_file_in_editor', {
///   filePath: '/path/to/file.md',
///   editor: 'cursor'
/// });
/// ```
#[tauri::command]
pub async fn open_file_in_editor(
    file_path: String,
    editor: String,
) -> Result<(), String> {
    use std::process::Command;

    let path = PathBuf::from(&file_path);

    // Verify the file path exists
    if !path.exists() {
        return Err(format!("File path does not exist: {}", file_path));
    }

    if !path.is_file() {
        return Err(format!("Path is not a file: {}", file_path));
    }

    // Determine the command based on the editor
    let (cmd, args) = match editor.as_str() {
        "cursor" => {
            #[cfg(target_os = "macos")]
            {
                ("open", vec!["-a", "Cursor", &file_path])
            }
            #[cfg(not(target_os = "macos"))]
            {
                ("cursor", vec![&file_path])
            }
        }
        "claude" => {
            #[cfg(target_os = "macos")]
            {
                ("open", vec!["-a", "Claude", &file_path])
            }
            #[cfg(not(target_os = "macos"))]
            {
                ("claude", vec![&file_path])
            }
        }
        "vscode" | "code" => {
            #[cfg(target_os = "macos")]
            {
                ("open", vec!["-a", "Visual Studio Code", &file_path])
            }
            #[cfg(not(target_os = "macos"))]
            {
                ("code", vec![&file_path])
            }
        }
        _ => {
            return Err(format!("Unknown editor: {}. Supported editors: 'cursor', 'claude', 'vscode'", editor));
        }
    };

    // Execute the command
    let output = Command::new(cmd)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to open file in {}: {}", editor, stderr));
    }

    Ok(())
}

/// Opens HTML content in the default browser.
///
/// Creates a temporary HTML file and opens it in the system's default browser.
/// The temporary file is created in the system temp directory with a unique name.
///
/// # Arguments
/// * `html_content` - The HTML content to display
/// * `title` - Optional title for the browser tab (defaults to "BlueKit")
///
/// # Returns
/// * `Ok(())` if the browser was opened successfully
/// * `Err(String)` if the file creation or browser launch failed
///
/// # Examples
/// ```typescript
/// await invoke('open_html_in_browser', {
///   htmlContent: '<html><body><h1>Hello</h1></body></html>',
///   title: 'My Document'
/// });
/// ```
#[tauri::command]
pub async fn open_html_in_browser(
    html_content: String,
    title: Option<String>,
) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;
    use std::process::Command;

    // Create a unique filename in the temp directory
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let filename = format!("bluekit_{}_{}.html",
        title.as_deref().unwrap_or("document"),
        timestamp
    );

    let mut temp_path = std::env::temp_dir();
    temp_path.push(filename);

    // Write HTML content to temp file
    let mut file = File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    file.write_all(html_content.as_bytes())
        .map_err(|e| format!("Failed to write HTML content: {}", e))?;

    // Open the file in the default browser
    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg(&temp_path)
        .status()
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(&["/C", "start", "", temp_path.to_str().unwrap()])
        .status()
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    #[cfg(target_os = "linux")]
    let status = Command::new("xdg-open")
        .arg(&temp_path)
        .status()
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    if !status.success() {
        return Err("Failed to open browser".to_string());
    }

    Ok(())
}

/// Configuration for opening a resource in a preview window.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWindowConfig {
    /// Unique identifier for the window (used as window label)
    pub window_id: String,
    /// Resource ID or path to display
    pub resource_id: String,
    /// Resource type (kit, plan, walkthrough, etc.)
    pub resource_type: String,
    /// Window title
    pub title: String,
    /// Optional window width (default: 1200)
    pub width: Option<f64>,
    /// Optional window height (default: 900)
    pub height: Option<f64>,
}

/// Opens a resource in a new Tauri window.
///
/// Creates a new OS-level window that loads a route for displaying the resource.
/// The window is independently moveable and can span multiple monitors.
///
/// # Arguments
///
/// * `app_handle` - Tauri app handle for creating windows
/// * `config` - Window configuration including resource details
///
/// # Returns
///
/// * `Ok(())` if the window was created successfully
/// * `Err(String)` if window already exists or creation fails
///
/// # Examples
///
/// ```typescript
/// await invoke('open_resource_in_window', {
///   windowId: 'preview-kit-123',
///   resourceId: '/path/to/kit.md',
///   resourceType: 'kit',
///   title: 'My Kit',
///   width: 1200,
///   height: 900,
/// });
/// ```
#[tauri::command]
pub async fn open_resource_in_window(
    app_handle: AppHandle,
    config: PreviewWindowConfig,
) -> Result<(), String> {
    use tauri::{WindowBuilder, WindowUrl, Manager};

    // Generate unique window label (must be unique across all windows)
    let window_label = format!("preview-{}", config.window_id);

    // Check if window already exists
    if app_handle.get_window(&window_label).is_some() {
        return Err(format!("Window '{}' already exists", window_label));
    }

    // Build URL with query parameters for the preview route
    // Frontend route will be: /preview?resourceId=...&resourceType=...
    let url = format!(
        "/preview?resourceId={}&resourceType={}",
        urlencoding::encode(&config.resource_id),
        urlencoding::encode(&config.resource_type)
    );

    // Create new window
    let _window = WindowBuilder::new(
        &app_handle,
        window_label.clone(),
        WindowUrl::App(url.into())
    )
    .title(&config.title)
    .inner_size(
        config.width.unwrap_or(1200.0),
        config.height.unwrap_or(900.0)
    )
    .resizable(true)
    .decorations(true) // Standard OS window decorations
    .center() // Center on screen initially
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    tracing::info!("Created preview window: {}", window_label);

    Ok(())
}

/// Closes a preview window by ID.
///
/// Useful for programmatic window management from frontend.
///
/// # Arguments
///
/// * `app_handle` - Tauri app handle for accessing windows
/// * `window_id` - The window ID (without 'preview-' prefix)
///
/// # Returns
///
/// * `Ok(())` if the window was closed successfully
/// * `Err(String)` if window not found or close fails
///
/// # Examples
///
/// ```typescript
/// await invoke('close_preview_window', {
///   windowId: 'kit-123',
/// });
/// ```
#[tauri::command]
pub async fn close_preview_window(
    app_handle: AppHandle,
    window_id: String,
) -> Result<(), String> {
    use tauri::Manager;

    let window_label = format!("preview-{}", window_id);

    if let Some(window) = app_handle.get_window(&window_label) {
        window.close()
            .map_err(|e| format!("Failed to close window: {}", e))?;
        tracing::info!("Closed preview window: {}", window_label);
        Ok(())
    } else {
        Err(format!("Window '{}' not found", window_label))
    }
}

// ============================================================================
// KEYCHAIN COMMANDS
// ============================================================================

use crate::integrations::github::keychain::{KeychainManager, GitHubToken};

/// Stores a GitHub token in the OS keychain.
#[tauri::command]
pub async fn keychain_store_token(token: GitHubToken) -> Result<(), String> {
    let manager = KeychainManager::new()?;
    manager.store_token(&token)
}

/// Retrieves a GitHub token from the OS keychain.
#[tauri::command]
pub async fn keychain_retrieve_token() -> Result<GitHubToken, String> {
    let manager = KeychainManager::new()?;
    manager.retrieve_token()
}

/// Deletes a GitHub token from the OS keychain.
#[tauri::command]
pub async fn keychain_delete_token() -> Result<(), String> {
    let manager = KeychainManager::new()?;
    manager.delete_token()
}

// ============================================================================
// AUTHENTICATION COMMANDS
// ============================================================================

use crate::integrations::github::auth::{exchange_code_for_token, get_auth_status, AuthStatus};
use crate::integrations::github::oauth_server::start_oauth_server;
use std::sync::{Arc, Mutex};

/// Shared state for OAuth flow (state -> code_verifier mapping).
type OAuthState = Arc<Mutex<HashMap<String, String>>>;

/// Starts the GitHub authorization code flow.
/// 
/// Generates authorization URL, starts local HTTP server, and returns the URL.
/// The server will listen for the OAuth callback and emit a Tauri event.
#[tauri::command]
pub async fn auth_start_authorization(
    app_handle: AppHandle,
    oauth_state: State<'_, OAuthState>,
) -> Result<String, String> {
    // Generate state first
    let state = crate::integrations::github::auth::generate_state();
    
    // Generate code verifier BEFORE starting server (to avoid race condition)
    let code_verifier = crate::integrations::github::auth::generate_code_verifier();
    let code_challenge = crate::integrations::github::auth::generate_code_challenge(&code_verifier);
    
    // Store verifier mapped to state BEFORE starting server
    {
        let mut state_map = oauth_state.lock().unwrap();
        state_map.insert(state.clone(), code_verifier.clone());
        tracing::info!("Stored code_verifier for state: {} (map now has {} entries)", 
            state, 
            state_map.len());
    }
    
    // Start OAuth server in background to get the port
    let app_handle_clone = app_handle.clone();
    let oauth_state_clone = oauth_state.inner().clone();
    let state_clone = state.clone();
    
    // Start server and get port (this will try ports starting from 8080)
    let port = start_oauth_server(app_handle_clone, oauth_state_clone, state_clone).await?;
    
    // Generate authorization URL with the actual port, state, and challenge
    let auth_url = {
        let client_id = std::env::var("GITHUB_CLIENT_ID")
            .map_err(|_| "GITHUB_CLIENT_ID not set in environment variables".to_string())?;
        let redirect_uri = format!("http://localhost:{}/oauth/callback", port);
        
        format!(
            "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=repo,user,read:org,write:org,user:follow&state={}&code_challenge={}&code_challenge_method=S256",
            urlencoding::encode(&client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(&state),
            urlencoding::encode(&code_challenge)
        )
    };
    
    Ok(auth_url)
}

/// Exchanges the authorization code for an access token.
#[tauri::command]
pub async fn auth_exchange_code(
    code: String,
    state: String, // State is validated by the server, kept for API consistency
    codeVerifier: String, // Tauri v1.5 expects camelCase parameter names
    redirectUri: String, // Must match the redirect_uri used in authorization request
) -> Result<AuthStatus, String> {
    tracing::info!("auth_exchange_code called with code (len={}), state (len={}), codeVerifier (len={}), redirectUri={}", 
        code.len(), state.len(), codeVerifier.len(), redirectUri);
    exchange_code_for_token(&code, &codeVerifier, &redirectUri).await
}

/// Gets the current authentication status.
#[tauri::command]
pub async fn auth_get_status() -> Result<AuthStatus, String> {
    get_auth_status()
}

// ============================================================================
// GITHUB API COMMANDS
// ============================================================================

use crate::integrations::github::github::{GitHubClient, GitHubUser, GitHubRepo, GitHubFileResponse, GitHubTreeResponse};

/// Gets the authenticated user's information from GitHub.
#[tauri::command]
pub async fn github_get_user() -> Result<GitHubUser, String> {
    let client = GitHubClient::from_keychain()?;
    client.get_user().await
}

/// Gets the authenticated user's repositories from GitHub.
#[tauri::command]
pub async fn github_get_repos() -> Result<Vec<GitHubRepo>, String> {
    let client = GitHubClient::from_keychain()?;
    client.get_user_repos().await
}

/// Gets the contents of a file from a GitHub repository.
#[tauri::command]
pub async fn github_get_file(
    owner: String,
    repo: String,
    path: String,
) -> Result<String, String> {
    let client = GitHubClient::from_keychain()?;
    client.get_file_contents(&owner, &repo, &path).await
}

/// Creates or updates a file in a GitHub repository.
#[tauri::command]
pub async fn github_create_or_update_file(
    owner: String,
    repo: String,
    path: String,
    content: String,
    message: String,
    sha: Option<String>, // Required for updates
) -> Result<GitHubFileResponse, String> {
    let client = GitHubClient::from_keychain()?;
    client
        .create_or_update_file(&owner, &repo, &path, &content, &message, sha.as_deref())
        .await
}

/// Deletes a file from a GitHub repository.
#[tauri::command]
pub async fn github_delete_file(
    owner: String,
    repo: String,
    path: String,
    message: String,
    sha: String, // Required for deletion
) -> Result<GitHubFileResponse, String> {
    let client = GitHubClient::from_keychain()?;
    client.delete_file(&owner, &repo, &path, &message, &sha).await
}

/// Gets a file's SHA (for checking if file exists).
#[tauri::command]
pub async fn github_get_file_sha(
    owner: String,
    repo: String,
    path: String,
) -> Result<Option<String>, String> {
    let client = GitHubClient::from_keychain()?;
    client.get_file_sha(&owner, &repo, &path).await
}

/// Gets a tree (directory contents) from a GitHub repository.
#[tauri::command]
pub async fn github_get_tree(
    owner: String,
    repo: String,
    tree_sha: String,
) -> Result<GitHubTreeResponse, String> {
    let client = GitHubClient::from_keychain()?;
    client.get_tree(&owner, &repo, &tree_sha).await
}

// ============================================================================
// LIBRARY COMMANDS
// ============================================================================

use crate::library::library::{LibraryWorkspace, LibraryArtifact};
use sea_orm::DatabaseConnection;

/// Creates a new Library workspace.
#[tauri::command]
pub async fn library_create_workspace(
    db: State<'_, DatabaseConnection>,
    name: String,
    github_owner: String,
    github_repo: String,
) -> Result<LibraryWorkspace, String> {
    crate::library::library::create_workspace(&*db, name, github_owner, github_repo).await
}

/// Lists all Library workspaces.
#[tauri::command]
pub async fn library_list_workspaces(
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<LibraryWorkspace>, String> {
    crate::library::library::list_workspaces(&*db).await
}

/// Gets a Library workspace by ID.
#[tauri::command]
pub async fn library_get_workspace(
    db: State<'_, DatabaseConnection>,
    workspace_id: String,
) -> Result<LibraryWorkspace, String> {
    crate::library::library::get_workspace(&*db, workspace_id).await
}

/// Deletes a Library workspace.
#[tauri::command]
pub async fn library_delete_workspace(
    db: State<'_, DatabaseConnection>,
    workspace_id: String,
) -> Result<(), String> {
    crate::library::library::delete_workspace(&*db, workspace_id).await
}

/// Updates a Library workspace name.
#[tauri::command]
pub async fn library_update_workspace_name(
    db: State<'_, DatabaseConnection>,
    workspace_id: String,
    name: String,
) -> Result<LibraryWorkspace, String> {
    crate::library::library::update_workspace_name(&*db, workspace_id, name).await
}

/// Sets the pinned state of a Library workspace.
#[tauri::command]
pub async fn library_set_workspace_pinned(
    db: State<'_, DatabaseConnection>,
    workspace_id: String,
    pinned: bool,
) -> Result<LibraryWorkspace, String> {
    crate::library::library::set_workspace_pinned(&*db, workspace_id, pinned).await
}

/// Lists all artifacts in a workspace (or all workspaces if None).
#[tauri::command]
pub async fn library_get_artifacts(
    db: State<'_, DatabaseConnection>,
    workspace_id: Option<String>,
) -> Result<Vec<LibraryArtifact>, String> {
    crate::library::library::list_artifacts(&*db, workspace_id).await
}

/// Creates a collection in a library workspace (SQLite only, not in GitHub).
///
/// This is a virtual collection that exists only in BlueKit's database
/// to organize catalogs in the library UI. It doesn't create any files
/// or directories in the GitHub repository.
#[tauri::command]
pub async fn library_create_collection(
    db: State<'_, DatabaseConnection>,
    workspace_id: String,
    name: String,
    description: Option<String>,
    tags: Option<String>,
    color: Option<String>,
) -> Result<String, String> {
    use crate::db::entities::library_collection;
    use sea_orm::{ActiveModelTrait, Set};
    use chrono::Utc;
    use uuid::Uuid;

    // Validate collection name
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Collection name cannot be empty".to_string());
    }

    // Generate unique ID
    let collection_id = format!("collection_{}", Uuid::new_v4());
    let now = Utc::now().timestamp();

    // Create collection in database
    let description_opt = description.and_then(|s| {
        let trimmed = s.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    
    let collection = library_collection::ActiveModel {
        id: Set(collection_id.clone()),
        workspace_id: Set(workspace_id),
        name: Set(trimmed_name.to_string()),
        description: Set(description_opt),
        tags: Set(tags),
        color: Set(color),
        order_index: Set(0),
        created_at: Set(now),
        updated_at: Set(now),
    };

    collection
        .insert(&*db)
        .await
        .map_err(|e| format!("Failed to create collection: {}", e))?;

    Ok(collection_id)
}

/// Gets all collections for a workspace
#[tauri::command]
pub async fn library_get_collections(
    db: State<'_, DatabaseConnection>,
    workspace_id: String,
) -> Result<Vec<crate::db::entities::library_collection::Model>, String> {
    use crate::db::entities::library_collection;
    use sea_orm::{EntityTrait, ColumnTrait, QueryFilter, QueryOrder};

    let collections = library_collection::Entity::find()
        .filter(library_collection::Column::WorkspaceId.eq(workspace_id))
        .order_by_asc(library_collection::Column::OrderIndex)
        .order_by_asc(library_collection::Column::Name)
        .all(&*db)
        .await
        .map_err(|e| format!("Failed to get collections: {}", e))?;

    Ok(collections)
}

/// Updates a collection's metadata
#[tauri::command]
pub async fn library_update_collection(
    db: State<'_, DatabaseConnection>,
    collection_id: String,
    name: Option<String>,
    description: Option<String>,
    tags: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    use crate::db::entities::library_collection;
    use sea_orm::{EntityTrait, ActiveModelTrait, Set};
    use chrono::Utc;

    // Find existing collection
    let collection = library_collection::Entity::find_by_id(&collection_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Collection not found: {}", collection_id))?;

    // Create active model for update
    let mut active_collection: library_collection::ActiveModel = collection.into();

    if let Some(n) = name {
        active_collection.name = Set(n);
    }
    if let Some(d) = description {
        let trimmed = d.trim().to_string();
        active_collection.description = Set(if trimmed.is_empty() { None } else { Some(trimmed) });
    }
    if tags.is_some() {
        active_collection.tags = Set(tags);
    }
    if let Some(c) = color {
        active_collection.color = Set(Some(c));
    }
    active_collection.updated_at = Set(Utc::now().timestamp());

    active_collection
        .update(&*db)
        .await
        .map_err(|e| format!("Failed to update collection: {}", e))?;

    Ok(())
}

/// Deletes a collection
#[tauri::command]
pub async fn library_delete_collection(
    db: State<'_, DatabaseConnection>,
    collection_id: String,
) -> Result<(), String> {
    use crate::db::entities::library_collection;
    use sea_orm::{EntityTrait, ModelTrait};

    // Find and delete the collection
    let collection = library_collection::Entity::find_by_id(&collection_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| format!("Collection not found: {}", collection_id))?;

    collection
        .delete(&*db)
        .await
        .map_err(|e| format!("Failed to delete collection: {}", e))?;

    Ok(())
}

/// Adds catalogs to a collection
#[tauri::command]
pub async fn library_add_catalogs_to_collection(
    db: State<'_, DatabaseConnection>,
    collection_id: String,
    catalog_ids: Vec<String>,
) -> Result<(), String> {
    use sea_orm::{Statement, ConnectionTrait};
    use chrono::Utc;

    let now = Utc::now().timestamp();

    for catalog_id in catalog_ids {
        // Use INSERT OR IGNORE to avoid errors if already exists
        let sql = format!(
            "INSERT OR IGNORE INTO library_collection_catalogs (collection_id, catalog_id, created_at) VALUES ('{}', '{}', {})",
            collection_id, catalog_id, now
        );

        db.inner().execute(Statement::from_string(
            db.inner().get_database_backend(),
            sql,
        ))
        .await
        .map_err(|e| format!("Failed to add catalog to collection: {}", e))?;
    }

    Ok(())
}

/// Removes catalogs from a collection
#[tauri::command]
pub async fn library_remove_catalogs_from_collection(
    db: State<'_, DatabaseConnection>,
    collection_id: String,
    catalog_ids: Vec<String>,
) -> Result<(), String> {
    use sea_orm::{Statement, ConnectionTrait};

    for catalog_id in catalog_ids {
        let sql = format!(
            "DELETE FROM library_collection_catalogs WHERE collection_id = '{}' AND catalog_id = '{}'",
            collection_id, catalog_id
        );

        db.inner().execute(Statement::from_string(
            db.inner().get_database_backend(),
            sql,
        ))
        .await
        .map_err(|e| format!("Failed to remove catalog from collection: {}", e))?;
    }

    Ok(())
}

/// Gets all catalog IDs in a collection
#[tauri::command]
pub async fn library_get_collection_catalog_ids(
    db: State<'_, DatabaseConnection>,
    collection_id: String,
) -> Result<Vec<String>, String> {
    use sea_orm::{Statement, ConnectionTrait};

    // Get catalog IDs for this collection
    let query = format!(
        "SELECT catalog_id FROM library_collection_catalogs WHERE collection_id = '{}'",
        collection_id
    );

    let catalog_ids_result = db.inner()
        .query_all(Statement::from_string(
            db.inner().get_database_backend(),
            query,
        ))
        .await
        .map_err(|e| format!("Failed to get collection catalog IDs: {}", e))?;

    let catalog_ids: Vec<String> = catalog_ids_result
        .iter()
        .filter_map(|row| row.try_get::<String>("", "catalog_id").ok())
        .collect();

    Ok(catalog_ids)
}

// ============================================================================
// LIBRARY RESOURCE COMMANDS (Phase 1)
// ============================================================================

/// Scans a project's .bluekit directory and syncs resources to database.
///
/// This command should be called:
/// - When a project is first opened
/// - When user manually triggers a rescan
/// - After git operations that might have changed files
#[tauri::command]
pub async fn scan_project_resources(
    project_id: String,
    project_path: String,
    db: State<'_, DatabaseConnection>,
) -> Result<serde_json::Value, String> {
    use crate::library::resource_scanner;
    use std::path::Path;

    let result = resource_scanner::scan_project_resources(
        &db,
        &project_id,
        Path::new(&project_path),
    ).await?;

    Ok(serde_json::json!({
        "resourcesCreated": result.resources_created,
        "resourcesUpdated": result.resources_updated,
        "resourcesDeleted": result.resources_deleted,
    }))
}

/// Gets all resources for a project.
#[tauri::command]
pub async fn get_project_resources(
    project_id: String,
    include_deleted: Option<bool>,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<serde_json::Value>, String> {
    use crate::db::entities::library_resource;
    use sea_orm::{EntityTrait, ColumnTrait, QueryFilter};

    let mut query = library_resource::Entity::find()
        .filter(library_resource::Column::ProjectId.eq(project_id));

    if !include_deleted.unwrap_or(false) {
        query = query.filter(library_resource::Column::IsDeleted.eq(0));
    }

    let resources = query
        .all(db.inner())
        .await
        .map_err(|e| format!("Failed to get resources: {}", e))?;

    let result: Vec<serde_json::Value> = resources
        .into_iter()
        .map(|r| serde_json::json!({
            "id": r.id,
            "projectId": r.project_id,
            "relativePath": r.relative_path,
            "fileName": r.file_name,
            "artifactType": r.artifact_type,
            "contentHash": r.content_hash,
            "yamlMetadata": r.yaml_metadata.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
            "createdAt": r.created_at,
            "updatedAt": r.updated_at,
            "lastModifiedAt": r.last_modified_at,
            "isDeleted": r.is_deleted == 1,
        }))
        .collect();

    Ok(result)
}

/// Gets a single resource by ID.
#[tauri::command]
pub async fn get_resource_by_id(
    resource_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<serde_json::Value, String> {
    use crate::db::entities::library_resource;
    use sea_orm::EntityTrait;

    let resource = library_resource::Entity::find_by_id(resource_id.clone())
        .one(db.inner())
        .await
        .map_err(|e| format!("Failed to get resource: {}", e))?
        .ok_or_else(|| format!("Resource not found: {}", resource_id))?;

    Ok(serde_json::json!({
        "id": resource.id,
        "projectId": resource.project_id,
        "relativePath": resource.relative_path,
        "fileName": resource.file_name,
        "artifactType": resource.artifact_type,
        "contentHash": resource.content_hash,
        "yamlMetadata": resource.yaml_metadata.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
        "createdAt": resource.created_at,
        "updatedAt": resource.updated_at,
        "lastModifiedAt": resource.last_modified_at,
        "isDeleted": resource.is_deleted == 1,
    }))
}

/// Check publish status for a resource (doesn't publish, just checks)
#[tauri::command]
pub async fn check_publish_status(
    resource_id: String,
    workspace_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<serde_json::Value, String> {
    let result = crate::library::publishing::check_publish_status(
        db.inner(),
        &resource_id,
        &workspace_id,
    )
    .await?;

    serde_json::to_value(&result).map_err(|e| format!("Serialization error: {}", e))
}

/// Publish a resource to a workspace
#[tauri::command]
pub async fn publish_resource(
    resource_id: String,
    workspace_id: String,
    overwrite_variation_id: Option<String>,
    version_tag: Option<String>,
    db: State<'_, DatabaseConnection>,
) -> Result<serde_json::Value, String> {
    let options = crate::library::publishing::PublishOptions {
        resource_id,
        workspace_id,
        overwrite_variation_id,
        version_tag,
    };

    let result = crate::library::publishing::publish_resource(db.inner(), options).await?;

    serde_json::to_value(&result).map_err(|e| format!("Serialization error: {}", e))
}

/// Sync workspace catalog from GitHub
#[tauri::command]
pub async fn sync_workspace_catalog(
    workspace_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<serde_json::Value, String> {
    let result = crate::library::sync::sync_workspace_catalog(db.inner(), &workspace_id).await?;
    serde_json::to_value(&result).map_err(|e| format!("Serialization error: {}", e))
}

/// List workspace catalogs with variations
#[tauri::command]
pub async fn list_workspace_catalogs(
    workspace_id: String,
    artifact_type: Option<String>,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<crate::library::sync::CatalogWithVariations>, String> {
    crate::library::sync::list_workspace_catalogs(db.inner(), &workspace_id, artifact_type).await
}

/// Delete catalogs and their variations from workspace
#[tauri::command]
pub async fn delete_catalogs(
    catalog_ids: Vec<String>,
    db: State<'_, DatabaseConnection>,
) -> Result<u32, String> {
    crate::library::sync::delete_catalogs(db.inner(), catalog_ids).await
}

/// Pull a variation to a local project
#[tauri::command]
pub async fn pull_variation(
    variation_id: String,
    target_project_id: String,
    target_project_path: String,
    overwrite_if_exists: bool,
    db: State<'_, DatabaseConnection>,
) -> Result<serde_json::Value, String> {
    let options = crate::library::pull::PullOptions {
        variation_id,
        target_project_id,
        target_project_path,
        overwrite_if_exists,
    };

    let result = crate::library::pull::pull_variation(db.inner(), options).await?;
    serde_json::to_value(&result).map_err(|e| format!("Serialization error: {}", e))
}

/// Check resource status for unpublished changes and available updates
#[tauri::command]
pub async fn check_resource_status(
    resource_id: String,
    project_root: String,
    db: State<'_, DatabaseConnection>,
) -> Result<crate::library::updates::ResourceStatus, String> {
    crate::library::updates::check_resource_status(db.inner(), &resource_id, &project_root).await
}

/// Check all resources in a project for updates
#[tauri::command]
pub async fn check_project_for_updates(
    project_id: String,
    project_root: String,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<crate::library::updates::ResourceStatus>, String> {
    crate::library::updates::check_project_for_updates(db.inner(), &project_id, &project_root).await
}

// ============================================================================
// PROJECT DATABASE COMMANDS (Phase 1)
// ============================================================================

/// Migrates projectRegistry.json and clones.json to database
#[tauri::command]
pub async fn migrate_projects_to_database(
    db: State<'_, DatabaseConnection>,
) -> Result<crate::db::project_operations::MigrationSummary, String> {
    crate::db::project_operations::migrate_json_to_database(&*db)
        .await
        .map_err(|e| format!("Migration failed: {}", e))
}

/// Gets all projects from database
#[tauri::command]
pub async fn db_get_projects(
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<crate::db::entities::project::Model>, String> {
    use sea_orm::EntityTrait;
    crate::db::entities::project::Entity::find()
        .all(&*db)
        .await
        .map_err(|e| format!("Failed to get projects: {}", e))
}

/// Creates a new project in database
#[tauri::command]
pub async fn db_create_project(
    db: State<'_, DatabaseConnection>,
    name: String,
    path: String,
    description: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<crate::db::entities::project::Model, String> {
    use sea_orm::*;
    use chrono::Utc;
    use uuid::Uuid;

    let now = Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    let project = crate::db::entities::project::ActiveModel {
        id: Set(id),
        name: Set(name),
        path: Set(path),
        description: Set(description),
        tags: Set(tags.and_then(|t| {
            if t.is_empty() { None } else { Some(serde_json::to_string(&t).unwrap()) }
        })),
        git_connected: Set(false),
        git_url: Set(None),
        git_branch: Set(None),
        git_remote: Set(None),
        last_commit_sha: Set(None),
        last_synced_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
        last_opened_at: Set(None),
    };

    project.insert(&*db).await
        .map_err(|e| format!("Failed to create project: {}", e))
}

/// Updates a project's name and/or description in the database
#[tauri::command]
pub async fn db_update_project(
    db: State<'_, DatabaseConnection>,
    project_id: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<crate::db::entities::project::Model, String> {
    use sea_orm::*;
    use chrono::Utc;

    // Fetch existing project
    let project = crate::db::entities::project::Entity::find_by_id(&project_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Failed to fetch project: {}", e))?
        .ok_or_else(|| format!("Project not found: {}", project_id))?;

    let now = Utc::now().timestamp_millis();

    let mut active_model: crate::db::entities::project::ActiveModel = project.into();

    if let Some(new_name) = name {
        active_model.name = Set(new_name);
    }

    if let Some(new_description) = description {
        active_model.description = Set(if new_description.is_empty() {
            None
        } else {
            Some(new_description)
        });
    }

    active_model.updated_at = Set(now);

    active_model.update(&*db).await
        .map_err(|e| format!("Failed to update project: {}", e))
}

/// Deletes a project from the database
#[tauri::command]
pub async fn db_delete_project(
    db: State<'_, DatabaseConnection>,
    project_id: String,
) -> Result<(), String> {
    use sea_orm::*;

    crate::db::entities::project::Entity::delete_by_id(&project_id)
        .exec(&*db)
        .await
        .map_err(|e| format!("Failed to delete project: {}", e))?;

    Ok(())
}

/// Connects a project to its git repository
#[tauri::command]
pub async fn connect_project_git(
    db: State<'_, DatabaseConnection>,
    project_id: String,
) -> Result<crate::db::entities::project::Model, String> {
    use sea_orm::*;
    use chrono::Utc;

    // 1. Get project
    let project = crate::db::entities::project::Entity::find_by_id(&project_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "Project not found".to_string())?;

    // 2. Detect git metadata
    let git_metadata = crate::integrations::git::detect_git_metadata(&project.path)?;

    // 3. Update project
    let mut project_active: crate::db::entities::project::ActiveModel = project.into();
    project_active.git_connected = Set(true);
    project_active.git_url = Set(Some(git_metadata.remote_url));
    project_active.git_branch = Set(Some(git_metadata.current_branch));
    project_active.git_remote = Set(Some(git_metadata.remote_name));
    project_active.last_commit_sha = Set(Some(git_metadata.latest_commit_sha));
    project_active.last_synced_at = Set(Some(Utc::now().timestamp_millis()));
    project_active.updated_at = Set(Utc::now().timestamp_millis());

    project_active.update(&*db).await
        .map_err(|e| format!("Failed to update project: {}", e))
}

/// Disconnects a project from git
#[tauri::command]
pub async fn disconnect_project_git(
    db: State<'_, DatabaseConnection>,
    project_id: String,
) -> Result<crate::db::entities::project::Model, String> {
    use sea_orm::*;
    use chrono::Utc;

    let project = crate::db::entities::project::Entity::find_by_id(&project_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "Project not found".to_string())?;

    let mut project_active: crate::db::entities::project::ActiveModel = project.into();
    project_active.git_connected = Set(false);
    project_active.git_url = Set(None);
    project_active.git_branch = Set(None);
    project_active.git_remote = Set(None);
    project_active.last_commit_sha = Set(None);
    project_active.last_synced_at = Set(None);
    project_active.updated_at = Set(Utc::now().timestamp_millis());

    project_active.update(&*db).await
        .map_err(|e| format!("Failed to update project: {}", e))
}

// ============================================================================
// COMMIT TIMELINE COMMANDS (Phase 2)
// ============================================================================

use crate::integrations::github::{GitHubCommit, CommitCache};

/// Parse GitHub URL to extract owner and repo.
/// Handles both HTTPS and SSH formats.
fn parse_github_url(git_url: &str) -> Result<(String, String), String> {
    // Handle both HTTPS and SSH URLs
    let url_clean = git_url
        .trim_end_matches(".git")
        .replace("git@github.com:", "https://github.com/");

    let parts: Vec<&str> = url_clean
        .trim_start_matches("https://github.com/")
        .split('/')
        .collect();

    if parts.len() >= 2 {
        Ok((parts[0].to_string(), parts[1].to_string()))
    } else {
        Err(format!("Invalid GitHub URL: {}", git_url))
    }
}

/// Fetch commits for a project from GitHub API (with caching).
#[tauri::command]
pub async fn fetch_project_commits(
    db: State<'_, DatabaseConnection>,
    commit_cache: State<'_, CommitCache>,
    project_id: String,
    branch: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<Vec<GitHubCommit>, String> {
    use crate::db::entities::project;
    use sea_orm::EntityTrait;
    use crate::integrations::github::github::GitHubClient;

    // Check cache first
    let page_num = page.unwrap_or(1);
    if let Some(cached_commits) = commit_cache.get(&project_id, branch.as_deref(), page_num) {
        return Ok(cached_commits);
    }

    // Get project from database
    let project = project::Entity::find_by_id(&project_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or("Project not found")?;

    // Validate git connection
    if !project.git_connected {
        return Err("Project is not connected to git. Click 'Connect Git' first.".to_string());
    }

    let git_url = project.git_url
        .ok_or("Project has no git URL")?;

    // Parse owner/repo from git URL
    let (owner, repo) = parse_github_url(&git_url)?;

    // Use project's branch if not specified
    let branch_to_use = branch.clone().or(project.git_branch);

    // Create GitHub client and fetch commits
    let client = GitHubClient::from_keychain()?;
    let commits = client
        .get_commits(
            &owner,
            &repo,
            branch_to_use.as_deref(),
            per_page,
            Some(page_num),
        )
        .await?;

    // Enrich commits with file details by fetching each commit individually
    // GitHub API rate limits: 5,000 requests/hour for authenticated users
    // This adds N additional API calls for N commits (e.g., 30 commits = 30 extra calls)
    // Mitigations:
    // - Results are cached, so subsequent views don't re-fetch
    // - Concurrency limited to 3 to be respectful of rate limits
    // - Falls back to basic info if individual fetch fails
    use futures::stream::{self, StreamExt};

    tracing::info!(
        "Enriching {} commits with file details (will make {} additional API calls)",
        commits.len(),
        commits.len()
    );

    let mut enriched_commits: Vec<GitHubCommit> = stream::iter(commits.into_iter().map(|commit| {
        let client = &client;
        let owner = owner.clone();
        let repo = repo.clone();
        let sha = commit.sha.clone();

        async move {
            // Try to fetch detailed commit info, fall back to original if it fails
            match client.get_commit(&owner, &repo, &sha).await {
                Ok(detailed_commit) => detailed_commit,
                Err(e) => {
                    eprintln!("Failed to fetch details for commit {}: {}. Using basic commit info.", sha, e);
                    commit
                }
            }
        }
    }))
    .buffer_unordered(3) // Fetch up to 3 commits in parallel (conservative to respect rate limits)
    .collect()
    .await;

    // Sort commits by date (newest first) to restore chronological order after parallel enrichment
    enriched_commits.sort_by(|a, b| {
        b.commit.author.date.cmp(&a.commit.author.date)
    });

    tracing::info!("Successfully enriched {} commits with file details", enriched_commits.len());

    // Cache the results to avoid re-fetching
    commit_cache.set(&project_id, branch.as_deref(), page_num, enriched_commits.clone());

    Ok(enriched_commits)
}

/// Open a commit diff in GitHub (in default browser).
#[tauri::command]
pub async fn open_commit_in_github(
    git_url: String,
    commit_sha: String,
) -> Result<(), String> {
    use std::process::Command;

    let (owner, repo) = parse_github_url(&git_url)?;
    let url = format!("https://github.com/{}/{}/commit/{}", owner, repo, commit_sha);

    // Open URL in default browser using platform-specific command
    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg(&url)
        .status()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    #[cfg(target_os = "linux")]
    let status = Command::new("xdg-open")
        .arg(&url)
        .status()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(&["/C", "start", &url])
        .status()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    if !status.success() {
        return Err(format!("Failed to open URL: command exited with status {}", status));
    }

    Ok(())
}

/// Invalidate commit cache for a project (forces fresh fetch on next request).
#[tauri::command]
pub async fn invalidate_commit_cache(
    commit_cache: State<'_, CommitCache>,
    project_id: String,
) -> Result<(), String> {
    commit_cache.invalidate_project(&project_id);
    Ok(())
}

/// Checkout a commit in a project (either detached HEAD or new branch).
/// Returns the project path on success.
#[tauri::command]
pub async fn checkout_commit_in_project(
    db: State<'_, DatabaseConnection>,
    project_id: String,
    commit_sha: String,
    branch_name: Option<String>,
) -> Result<String, String> {
    use sea_orm::*;
    use std::process::Command;
    use std::path::Path;

    // 1. Get project from database
    let project = crate::db::entities::project::Entity::find_by_id(&project_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "Project not found".to_string())?;

    let project_path = &project.path;

    // 2. Validate project has git repository
    let git_dir = Path::new(project_path).join(".git");
    if !git_dir.exists() {
        return Err("Project does not have a git repository".to_string());
    }

    // 3. Verify commit exists
    let verify_output = Command::new("git")
        .arg("-C")
        .arg(project_path)
        .arg("rev-parse")
        .arg("--verify")
        .arg(format!("{}", commit_sha))
        .output()
        .map_err(|e| format!("Failed to verify commit: {}", e))?;

    if !verify_output.status.success() {
        let error = String::from_utf8_lossy(&verify_output.stderr);
        return Err(format!("Invalid commit SHA: {}", error.trim()));
    }

    // 4. Checkout commit (detached HEAD or new branch)
    let checkout_result = if let Some(branch) = branch_name {
        // Create and checkout new branch
        Command::new("git")
            .arg("-C")
            .arg(project_path)
            .arg("checkout")
            .arg("-b")
            .arg(&branch)
            .arg(&commit_sha)
            .output()
            .map_err(|e| format!("Failed to checkout branch: {}", e))?
    } else {
        // Checkout in detached HEAD
        Command::new("git")
            .arg("-C")
            .arg(project_path)
            .arg("checkout")
            .arg(&commit_sha)
            .output()
            .map_err(|e| format!("Failed to checkout commit: {}", e))?
    };

    if !checkout_result.status.success() {
        let error = String::from_utf8_lossy(&checkout_result.stderr);
        return Err(format!("Git checkout failed: {}", error.trim()));
    }

    // 5. Return project path
    Ok(project_path.clone())
}

// ============================================================================
// CHECKPOINT COMMANDS (Phase 3)
// ============================================================================

use crate::db::entities::checkpoint;
use chrono::Utc;

/// Pin a commit as a checkpoint.
#[tauri::command]
pub async fn pin_checkpoint(
    db: State<'_, DatabaseConnection>,
    project_id: String,
    git_commit_sha: String,
    name: String,
    checkpoint_type: String,
    description: Option<String>,
    git_branch: Option<String>,
    git_url: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<checkpoint::Model, String> {
    use sea_orm::*;

    // Validate checkpoint type
    let valid_types = ["milestone", "experiment", "template", "backup"];
    if !valid_types.contains(&checkpoint_type.as_str()) {
        return Err(format!("Invalid checkpoint type: {}. Must be one of: milestone, experiment, template, backup", checkpoint_type));
    }

    // Check if checkpoint already exists for this commit
    let existing = checkpoint::Entity::find()
        .filter(checkpoint::Column::ProjectId.eq(&project_id))
        .filter(checkpoint::Column::GitCommitSha.eq(&git_commit_sha))
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Err("This commit is already pinned as a checkpoint".to_string());
    }

    // Generate checkpoint ID
    let checkpoint_id = format!("checkpoint-{}-{}", project_id, Utc::now().timestamp_millis());

    // Serialize tags to JSON
    let tags_json = tags.and_then(|t| {
        if t.is_empty() {
            None
        } else {
            serde_json::to_string(&t).ok()
        }
    });

    let now = Utc::now().timestamp_millis();

    let checkpoint = checkpoint::ActiveModel {
        id: Set(checkpoint_id),
        project_id: Set(project_id),
        git_commit_sha: Set(git_commit_sha),
        git_branch: Set(git_branch),
        git_url: Set(git_url),
        name: Set(name),
        description: Set(description),
        tags: Set(tags_json),
        checkpoint_type: Set(checkpoint_type),
        parent_checkpoint_id: Set(None), // Lineage tracking deferred to Phase 4
        created_from_project_id: Set(None),
        pinned_at: Set(now),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let result = checkpoint.insert(&*db)
        .await
        .map_err(|e| format!("Failed to create checkpoint: {}", e))?;

    Ok(result)
}

/// Get all checkpoints for a project.
#[tauri::command]
pub async fn get_project_checkpoints(
    db: State<'_, DatabaseConnection>,
    project_id: String,
) -> Result<Vec<checkpoint::Model>, String> {
    use sea_orm::*;

    let checkpoints = checkpoint::Entity::find()
        .filter(checkpoint::Column::ProjectId.eq(&project_id))
        .order_by_desc(checkpoint::Column::PinnedAt)
        .all(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(checkpoints)
}

/// Unpin a checkpoint (delete it).
#[tauri::command]
pub async fn unpin_checkpoint(
    db: State<'_, DatabaseConnection>,
    checkpoint_id: String,
) -> Result<(), String> {
    use sea_orm::*;

    let checkpoint = checkpoint::Entity::find_by_id(&checkpoint_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "Checkpoint not found".to_string())?;

    checkpoint::Entity::delete_by_id(&checkpoint_id)
        .exec(&*db)
        .await
        .map_err(|e| format!("Failed to delete checkpoint: {}", e))?;

    Ok(())
}

/// Create a new project from a checkpoint (reuses clone logic).
#[tauri::command]
pub async fn create_project_from_checkpoint(
    db: State<'_, DatabaseConnection>,
    checkpoint_id: String,
    target_path: String,
    project_title: Option<String>,
    register_project: bool,
) -> Result<String, String> {
    use sea_orm::*;
    use std::fs;
    use std::process::Command;
    use std::path::PathBuf;

    // Get checkpoint
    let checkpoint = checkpoint::Entity::find_by_id(&checkpoint_id)
        .one(&*db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "Checkpoint not found".to_string())?;

    let git_url = checkpoint.git_url
        .ok_or_else(|| "Checkpoint has no git URL".to_string())?;

    // Validate target path
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

    // Create temp directory
    let temp_dir = std::env::temp_dir().join(format!("bluekit-checkpoint-{}", std::process::id()));

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

    // Clone repository
    let clone_output = Command::new("git")
        .arg("clone")
        .arg("--quiet")
        .arg(&git_url)
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

    // Checkout commit
    let checkout_output = Command::new("git")
        .arg("-C")
        .arg(&temp_dir)
        .arg("checkout")
        .arg(&checkpoint.git_commit_sha)
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

    // Copy files to target (excluding .git)
    fs::create_dir_all(&target)
        .map_err(|e| {
            cleanup_temp();
            format!("Failed to create target directory: {}", e)
        })?;

    // Copy all files except .git using existing helper
    copy_directory_excluding(&temp_dir, &target, &[".git"])
        .map_err(|e| {
            cleanup_temp();
            format!("Failed to copy files: {}", e)
        })?;

    // Register project if requested
    if register_project {
        use crate::db::entities::project;
        use sea_orm::*;
        
        let project_name = project_title.unwrap_or_else(|| checkpoint.name.clone());
        let now = Utc::now().timestamp_millis();
        let project_id = format!("project-{}", now);
        
        let project_model = project::ActiveModel {
            id: Set(project_id),
            name: Set(project_name),
            path: Set(target.to_string_lossy().to_string()),
            description: Set(Some(format!("Created from checkpoint: {}", checkpoint.name))),
            tags: Set(None),
            git_connected: Set(false),
            git_url: Set(None),
            git_branch: Set(None),
            git_remote: Set(None),
            last_commit_sha: Set(None),
            last_synced_at: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
            last_opened_at: Set(None),
        };
        
        let _ = project_model.insert(&*db)
            .await
            .map_err(|e| format!("Failed to register project: {}", e))?;
    }

    // Cleanup temp directory
    cleanup_temp();

    Ok(format!("Project created successfully at: {}", target.to_string_lossy()))
}

// ============================================================================
// PLAN COMMANDS
// ============================================================================

/// Create a new plan with folder structure
#[tauri::command]
pub async fn create_plan(
    db: State<'_, sea_orm::DatabaseConnection>,
    project_id: String,
    project_path: String,
    name: String,
    description: Option<String>,
) -> Result<crate::db::plan_operations::PlanDto, String> {
    crate::db::plan_operations::create_plan(
        db.inner(),
        project_id,
        project_path,
        name,
        description,
    )
    .await
    .map_err(|e| format!("Failed to create plan: {}", e))
}

/// Get all plans for a project
#[tauri::command]
pub async fn get_project_plans(
    db: State<'_, sea_orm::DatabaseConnection>,
    project_id: String,
) -> Result<Vec<crate::db::plan_operations::PlanDto>, String> {
    crate::db::plan_operations::get_project_plans(db.inner(), project_id)
        .await
        .map_err(|e| format!("Failed to get project plans: {}", e))
}

/// Get plan details with phases, milestones, and documents
#[tauri::command]
pub async fn get_plan_details(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
) -> Result<crate::db::plan_operations::PlanDetailsDto, String> {
    crate::db::plan_operations::get_plan_details(db.inner(), plan_id)
        .await
        .map_err(|e| format!("Failed to get plan details: {}", e))
}

/// Update a plan
#[tauri::command]
pub async fn update_plan(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
    name: Option<String>,
    description: Option<Option<String>>,
    status: Option<String>,
) -> Result<crate::db::plan_operations::PlanDto, String> {
    crate::db::plan_operations::update_plan(db.inner(), plan_id, name, description, status)
        .await
        .map_err(|e| format!("Failed to update plan: {}", e))
}

/// Delete a plan (removes folder and database records)
#[tauri::command]
pub async fn delete_plan(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
) -> Result<(), String> {
    crate::db::plan_operations::delete_plan(db.inner(), plan_id)
        .await
        .map_err(|e| format!("Failed to delete plan: {}", e))
}

/// Link brainstorm plan to a plan
#[tauri::command]
pub async fn link_brainstorm_to_plan(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
    brainstorm_path: String,
) -> Result<(), String> {
    crate::db::plan_operations::link_brainstorm_to_plan(db.inner(), plan_id, brainstorm_path)
        .await
        .map_err(|e| format!("Failed to link brainstorm: {}", e))
}

/// Unlink brainstorm from plan
#[tauri::command]
pub async fn unlink_brainstorm_from_plan(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
) -> Result<(), String> {
    crate::db::plan_operations::unlink_brainstorm_from_plan(db.inner(), plan_id)
        .await
        .map_err(|e| format!("Failed to unlink brainstorm: {}", e))
}

/// Link multiple plans to a plan
#[tauri::command]
pub async fn link_multiple_plans_to_plan(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
    plan_paths: Vec<String>,
    source: String,
) -> Result<(), String> {
    crate::db::plan_operations::link_multiple_plans_to_plan(db.inner(), plan_id, plan_paths, source)
        .await
        .map_err(|e| format!("Failed to link plans: {}", e))
}

/// Unlink a specific plan from a plan
#[tauri::command]
pub async fn unlink_plan_from_plan(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
    linked_plan_path: String,
) -> Result<(), String> {
    crate::db::plan_operations::unlink_plan_from_plan(db.inner(), plan_id, linked_plan_path)
        .await
        .map_err(|e| format!("Failed to unlink plan: {}", e))
}

/// Create a plan phase
#[tauri::command]
pub async fn create_plan_phase(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
    name: String,
    description: Option<String>,
    order_index: i32,
) -> Result<crate::db::plan_operations::PlanPhaseDto, String> {
    crate::db::plan_operations::create_plan_phase(
        db.inner(),
        plan_id,
        name,
        description,
        order_index,
    )
    .await
    .map_err(|e| format!("Failed to create phase: {}", e))
}

/// Update a plan phase
#[tauri::command]
pub async fn update_plan_phase(
    db: State<'_, sea_orm::DatabaseConnection>,
    phase_id: String,
    name: Option<String>,
    description: Option<Option<String>>,
    status: Option<String>,
    order_index: Option<i32>,
) -> Result<crate::db::plan_operations::PlanPhaseDto, String> {
    crate::db::plan_operations::update_plan_phase(
        db.inner(),
        phase_id,
        name,
        description,
        status,
        order_index,
    )
    .await
    .map_err(|e| format!("Failed to update phase: {}", e))
}

/// Delete a plan phase
#[tauri::command]
pub async fn delete_plan_phase(
    db: State<'_, sea_orm::DatabaseConnection>,
    phase_id: String,
) -> Result<(), String> {
    crate::db::plan_operations::delete_plan_phase(db.inner(), phase_id)
        .await
        .map_err(|e| format!("Failed to delete phase: {}", e))
}

/// Reorder plan phases
#[tauri::command]
pub async fn reorder_plan_phases(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
    phase_ids_in_order: Vec<String>,
) -> Result<(), String> {
    crate::db::plan_operations::reorder_plan_phases(db.inner(), plan_id, phase_ids_in_order)
        .await
        .map_err(|e| format!("Failed to reorder phases: {}", e))
}

/// Create a plan milestone
#[tauri::command]
pub async fn create_plan_milestone(
    db: State<'_, sea_orm::DatabaseConnection>,
    phase_id: String,
    name: String,
    description: Option<String>,
    order_index: i32,
) -> Result<crate::db::plan_operations::PlanMilestoneDto, String> {
    crate::db::plan_operations::create_plan_milestone(
        db.inner(),
        phase_id,
        name,
        description,
        order_index,
    )
    .await
    .map_err(|e| format!("Failed to create milestone: {}", e))
}

/// Update a plan milestone
#[tauri::command]
pub async fn update_plan_milestone(
    db: State<'_, sea_orm::DatabaseConnection>,
    milestone_id: String,
    name: Option<String>,
    description: Option<Option<String>>,
    completed: Option<bool>,
) -> Result<crate::db::plan_operations::PlanMilestoneDto, String> {
    crate::db::plan_operations::update_plan_milestone(
        db.inner(),
        milestone_id,
        name,
        description,
        completed,
    )
    .await
    .map_err(|e| format!("Failed to update milestone: {}", e))
}

/// Delete a plan milestone
#[tauri::command]
pub async fn delete_plan_milestone(
    db: State<'_, sea_orm::DatabaseConnection>,
    milestone_id: String,
) -> Result<(), String> {
    crate::db::plan_operations::delete_plan_milestone(db.inner(), milestone_id)
        .await
        .map_err(|e| format!("Failed to delete milestone: {}", e))
}

/// Toggle milestone completion
#[tauri::command]
pub async fn toggle_milestone_completion(
    db: State<'_, sea_orm::DatabaseConnection>,
    milestone_id: String,
) -> Result<crate::db::plan_operations::PlanMilestoneDto, String> {
    crate::db::plan_operations::toggle_milestone_completion(db.inner(), milestone_id)
        .await
        .map_err(|e| format!("Failed to toggle milestone: {}", e))
}

/// Get plan documents (scans folder and reconciles with DB)
#[tauri::command]
pub async fn get_plan_documents(
    db: State<'_, sea_orm::DatabaseConnection>,
    plan_id: String,
) -> Result<Vec<crate::db::plan_operations::PlanDocumentDto>, String> {
    crate::db::plan_operations::get_plan_documents(db.inner(), plan_id)
        .await
        .map_err(|e| format!("Failed to get plan documents: {}", e))
}

/// Link document to phase
#[tauri::command]
pub async fn link_document_to_phase(
    db: State<'_, sea_orm::DatabaseConnection>,
    document_id: String,
    phase_id: Option<String>,
) -> Result<(), String> {
    crate::db::plan_operations::link_document_to_phase(db.inner(), document_id, phase_id)
        .await
        .map_err(|e| format!("Failed to link document to phase: {}", e))
}

/// Watch plan folder for file changes
#[tauri::command]
pub async fn watch_plan_folder(
    app: AppHandle,
    plan_id: String,
    folder_path: String,
) -> Result<(), String> {
    use std::path::PathBuf;
    // Use the existing watcher infrastructure
    let event_name = format!("plan-documents-changed-{}", plan_id);
    let path = PathBuf::from(folder_path);
    crate::core::watcher::watch_directory(app, path, event_name)
}

/// File tree node structure.
#[derive(Debug, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
    #[serde(rename = "artifactType", skip_serializing_if = "Option::is_none")]
    pub artifact_type: Option<String>,
    #[serde(rename = "isEssential")]
    pub is_essential: bool,
    #[serde(rename = "frontMatter", skip_serializing_if = "Option::is_none")]
    pub front_matter: Option<serde_yaml::Value>,
}

/// Recursively scans .bluekit directory and returns a tree structure.
#[tauri::command]
pub async fn get_bluekit_file_tree(project_path: String) -> Result<Vec<FileTreeNode>, String> {
    use std::fs;

    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    if !bluekit_path.exists() {
        return Ok(Vec::new());
    }

    // Helper to recursively build tree
    fn build_tree(dir: PathBuf, root_path: &PathBuf) -> Result<Vec<FileTreeNode>, String> {
        let mut nodes = Vec::new();

        if dir.exists() && dir.is_dir() {
            let entries = fs::read_dir(&dir)
                .map_err(|e| format!("Failed to read dir: {}", e))?;

            for entry in entries {
                let entry = entry.map_err(|e| format!("Error reading entry: {}", e))?;
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                
                // Skip hidden files/folders (except .bluekit itself if we were scanning root, but we are inside .bluekit)
                if name.starts_with('.') {
                    continue;
                }

                let path_str = path.to_string_lossy().to_string();
                // Generate a stable ID based on relative path from bluekit root
                let relative_path = path.strip_prefix(root_path)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                let id = format!("node-{}", relative_path.replace(['/', '\\'], "-"));

                let is_folder = path.is_dir();
                
                let mut children = None;
                let mut artifact_type = None;
                let mut front_matter = None;
                let mut is_essential = false;

                if is_folder {
                    // Recursive call
                    let child_nodes = build_tree(path.clone(), root_path)?;
                    if !child_nodes.is_empty() {
                        children = Some(child_nodes);
                    }
                    // Mark essential directories (kits, walkthroughs, diagrams)
                    if name == "kits" || name == "walkthroughs" || name == "diagrams" {
                        is_essential = true;
                    }
                } else {
                    // Check file extension
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if ext == "md" || ext == "mmd" || ext == "mermaid" {
                        // Detect type
                        if ext == "mmd" || ext == "mermaid" {
                            artifact_type = Some("diagram".to_string());
                        } else {
                            // Read front matter to determine type
                            if let Ok(content) = fs::read_to_string(&path) {
                                if let Some(fm) = parse_front_matter(&content) {
                                    front_matter = Some(fm.clone());
                                    if let Some(type_val) = fm.get("type").and_then(|v| v.as_str()) {
                                        artifact_type = Some(type_val.to_string());
                                    } else {
                                        // Infer from parent folder
                                        if path.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str()) == Some("kits") {
                                            artifact_type = Some("kit".to_string());
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // Skip non-supported files? or include them allowing simple view?
                        // For now include them as 'file'
                        artifact_type = Some("file".to_string());
                    }
                }

                nodes.push(FileTreeNode {
                    id,
                    name,
                    path: path_str,
                    is_folder,
                    children,
                    artifact_type,
                    is_essential,
                    front_matter,
                });
            }
        }
        
        // Sort folders first, then files
        nodes.sort_by(|a, b| {
            if a.is_folder && !b.is_folder {
                std::cmp::Ordering::Less
            } else if !a.is_folder && b.is_folder {
                std::cmp::Ordering::Greater
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        });

        Ok(nodes)
    }

    build_tree(bluekit_path.clone(), &bluekit_path)
}

/// Creates a folder at the specified path.
#[tauri::command]
pub async fn create_folder(path: String) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| format!("Failed to create folder: {}", e))
}

#[tauri::command]
pub async fn clone_from_github(
    db: State<'_, crate::db::DatabaseConnection>,
    owner_repo: String,      // e.g., "facebook/react"
    target_path: String,     // absolute path
    project_title: Option<String>,
    register_project: bool,  // default: true
    init_bluekit: bool,      // default: true
) -> Result<String, String> {
    use std::process::Command;
    use std::fs;
    
    // 1. Validate owner/repo format
    let repo_regex = regex::Regex::new(r"^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$").map_err(|e| e.to_string())?;
    if !repo_regex.is_match(&owner_repo) {
        return Err("Invalid repository format. Use 'owner/repo'".to_string());
    }
    
    // 2. Construct GitHub URL
    let git_url = format!("https://github.com/{}.git", owner_repo);
    let path = PathBuf::from(&target_path);
    
    // 3. Validate target path doesn't exist
    if path.exists() {
        // If it exists, it must be empty
        let is_empty = path.read_dir().map_err(|e| e.to_string())?.next().is_none();
        if !is_empty {
            return Err(format!("Target directory already exists and is not empty: {}", target_path));
        }
    } else {
        // Create parent directories if needed
        fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // 4. Run git clone
    tracing::info!("Cloning {} to {}", git_url, target_path);
    
    let output = Command::new("git")
        .arg("clone")
        .arg("--quiet")
        .arg(&git_url)
        .arg(".")  // Clone into the target directory (which we created)
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;
        
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Git clone failed: {}", error_msg));
    }
    
    // 5. Optionally create .bluekit directory
    if init_bluekit {
        let bluekit_path = path.join(".bluekit");
        if !bluekit_path.exists() {
            fs::create_dir_all(&bluekit_path).map_err(|e| format!("Failed to create .bluekit directory: {}", e))?;
            
            // Create default directories
            fs::create_dir_all(bluekit_path.join("kits")).ok();
            fs::create_dir_all(bluekit_path.join("walkthroughs")).ok();
            fs::create_dir_all(bluekit_path.join("diagrams")).ok();
        }
    }
    
    // 6. Optionally register in database
    if register_project {
        // Extract project name from path if title not provided
        let name = project_title.unwrap_or_else(|| {
             path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("New Project")
                .to_string()
        });
        
        // Create project entry
        let _ = crate::db::project_operations::create_project(
            &db,
            &name,
            &target_path,
            None, // description
            None, // tags
        ).await.map_err(|e| format!("Failed to register project: {}", e))?;
            
        // We find the project we just created
        let projects = crate::db::project_operations::get_all_projects(&db).await
            .map_err(|e| format!("Failed to fetch projects: {}", e))?;
            
        if let Some(project) = projects.into_iter().find(|p| p.path == target_path) {
             // Connect git
             let _ = crate::db::project_operations::update_project_git_info(&db, &project.id).await;
        }
    }
    
    Ok(format!("Successfully cloned {} to {}", owner_repo, target_path))
}

// ============================================================================
// BOOKMARKS - File bookmarking system
// ============================================================================

/// Bookmark item - can be either a file bookmark or a group containing other items.
/// Uses serde's tagged enum representation to match the JSON format:
/// { "type": "file", ... } or { "type": "group", ... }
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum BookmarkItem {
    #[serde(rename = "file")]
    File {
        /// Creation timestamp in milliseconds
        ctime: u64,
        /// Absolute path to the bookmarked file
        path: String,
        /// Display title for the bookmark
        title: String,
    },
    #[serde(rename = "group")]
    Group {
        /// Creation timestamp in milliseconds
        ctime: u64,
        /// Display title for the group
        title: String,
        /// Nested bookmark items within this group
        items: Vec<BookmarkItem>,
    },
}

/// Root structure for bookmarks.json file.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookmarksData {
    pub items: Vec<BookmarkItem>,
}

impl Default for BookmarksData {
    fn default() -> Self {
        Self { items: Vec::new() }
    }
}

/// Gets the path to the bookmarks.json file for a project.
fn get_bookmarks_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".bluekit").join("bookmarks.json")
}

/// Loads bookmarks from a project's .bluekit/bookmarks.json file.
///
/// # Arguments
///
/// * `project_path` - The root path of the project
///
/// # Returns
///
/// A `Result<BookmarksData, String>` containing either:
/// - `Ok(BookmarksData)` - Success case with bookmarks (empty if file doesn't exist)
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_bookmarks(project_path: String) -> Result<BookmarksData, String> {
    use std::fs;

    let bookmarks_path = get_bookmarks_path(&project_path);

    // Return empty bookmarks if file doesn't exist
    if !bookmarks_path.exists() {
        return Ok(BookmarksData::default());
    }

    // Read and parse the file
    let content = fs::read_to_string(&bookmarks_path)
        .map_err(|e| format!("Failed to read bookmarks.json: {}", e))?;

    let bookmarks: BookmarksData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse bookmarks.json: {}", e))?;

    Ok(bookmarks)
}

/// Saves bookmarks to a project's .bluekit/bookmarks.json file.
/// Uses atomic write (tmp file + rename) to prevent corruption.
///
/// # Arguments
///
/// * `project_path` - The root path of the project
/// * `data` - The bookmarks data to save
///
/// # Returns
///
/// A `Result<(), String>` indicating success or failure
#[tauri::command]
pub async fn save_bookmarks(project_path: String, data: BookmarksData) -> Result<(), String> {
    use std::fs;
    use std::io::Write;

    let bookmarks_path = get_bookmarks_path(&project_path);
    let bluekit_dir = bookmarks_path.parent()
        .ok_or_else(|| "Invalid bookmarks path".to_string())?;

    // Ensure .bluekit directory exists
    if !bluekit_dir.exists() {
        fs::create_dir_all(bluekit_dir)
            .map_err(|e| format!("Failed to create .bluekit directory: {}", e))?;
    }

    // Serialize to JSON with pretty formatting
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize bookmarks: {}", e))?;

    // Atomic write: write to temp file then rename
    let tmp_path = bookmarks_path.with_extension("json.tmp");

    let mut file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    file.sync_all()
        .map_err(|e| format!("Failed to sync temp file: {}", e))?;

    drop(file); // Ensure file is closed before rename

    fs::rename(&tmp_path, &bookmarks_path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

/// Adds a bookmark item to the root of the bookmarks list.
///
/// # Arguments
///
/// * `project_path` - The root path of the project
/// * `item` - The bookmark item to add
///
/// # Returns
///
/// A `Result<BookmarksData, String>` containing the updated bookmarks
#[tauri::command]
pub async fn add_bookmark(project_path: String, item: BookmarkItem) -> Result<BookmarksData, String> {
    // Load existing bookmarks
    let mut bookmarks = get_bookmarks(project_path.clone()).await?;

    // Check for duplicate file paths (only for file bookmarks)
    if let BookmarkItem::File { ref path, .. } = item {
        let is_duplicate = check_bookmark_exists(&bookmarks.items, path);
        if is_duplicate {
            return Err(format!("File is already bookmarked: {}", path));
        }
    }

    // Add the new item
    bookmarks.items.push(item);

    // Save and return updated bookmarks
    save_bookmarks(project_path, bookmarks.clone()).await?;

    Ok(bookmarks)
}

/// Helper function to recursively check if a file path exists in bookmarks.
fn check_bookmark_exists(items: &[BookmarkItem], target_path: &str) -> bool {
    for item in items {
        match item {
            BookmarkItem::File { path, .. } => {
                if path == target_path {
                    return true;
                }
            }
            BookmarkItem::Group { items: nested_items, .. } => {
                if check_bookmark_exists(nested_items, target_path) {
                    return true;
                }
            }
        }
    }
    false
}

/// Removes a bookmark by file path (recursively searches through groups).
///
/// # Arguments
///
/// * `project_path` - The root path of the project
/// * `bookmark_path` - The file path of the bookmark to remove
///
/// # Returns
///
/// A `Result<BookmarksData, String>` containing the updated bookmarks
#[tauri::command]
pub async fn remove_bookmark(project_path: String, bookmark_path: String) -> Result<BookmarksData, String> {
    // Load existing bookmarks
    let mut bookmarks = get_bookmarks(project_path.clone()).await?;

    // Remove the bookmark recursively
    let removed = remove_bookmark_recursive(&mut bookmarks.items, &bookmark_path);

    if !removed {
        return Err(format!("Bookmark not found: {}", bookmark_path));
    }

    // Save and return updated bookmarks
    save_bookmarks(project_path, bookmarks.clone()).await?;

    Ok(bookmarks)
}

/// Helper function to recursively remove a bookmark by path.
/// Returns true if a bookmark was removed.
fn remove_bookmark_recursive(items: &mut Vec<BookmarkItem>, target_path: &str) -> bool {
    // First, try to remove from this level
    let initial_len = items.len();
    items.retain(|item| {
        match item {
            BookmarkItem::File { path, .. } => path != target_path,
            BookmarkItem::Group { .. } => true, // Keep groups, we'll search inside them
        }
    });

    if items.len() < initial_len {
        return true; // Found and removed at this level
    }

    // If not found at this level, search in nested groups
    for item in items.iter_mut() {
        if let BookmarkItem::Group { items: nested_items, .. } = item {
            if remove_bookmark_recursive(nested_items, target_path) {
                return true;
            }
        }
    }

    false
}

/// Reconciles bookmarks by removing any that point to non-existent files.
/// This is useful when files are deleted or moved outside the app.
///
/// # Arguments
///
/// * `project_path` - The root path of the project
///
/// # Returns
///
/// A `Result<BookmarksData, String>` containing the reconciled bookmarks
#[tauri::command]
pub async fn reconcile_bookmarks(project_path: String) -> Result<BookmarksData, String> {
    use std::fs;

    // Load existing bookmarks
    let mut bookmarks = get_bookmarks(project_path.clone()).await?;

    // Reconcile recursively
    reconcile_bookmarks_recursive(&mut bookmarks.items);

    // Save and return updated bookmarks
    save_bookmarks(project_path, bookmarks.clone()).await?;

    Ok(bookmarks)
}

/// Helper function to recursively reconcile bookmarks.
/// Removes file bookmarks that point to non-existent files.
fn reconcile_bookmarks_recursive(items: &mut Vec<BookmarkItem>) {
    use std::fs;

    // Remove invalid file bookmarks
    items.retain(|item| {
        match item {
            BookmarkItem::File { path, .. } => {
                let exists = fs::metadata(path).is_ok();
                if !exists {
                    tracing::info!("Removing stale bookmark: {}", path);
                }
                exists
            }
            BookmarkItem::Group { .. } => true, // Keep groups, process their contents
        }
    });

    // Recursively reconcile nested groups
    for item in items.iter_mut() {
        if let BookmarkItem::Group { items: nested_items, .. } = item {
            reconcile_bookmarks_recursive(nested_items);
        }
    }
}

