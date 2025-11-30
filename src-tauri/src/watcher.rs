/// File watching module for monitoring file system changes.
/// 
/// This module provides functionality to watch files and emit Tauri events
/// when changes are detected. Useful for keeping the frontend in sync with
/// file system changes.

use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Manager};
use std::env;
use std::fs;

/// Starts watching a file and emits Tauri events when it changes.
/// 
/// # Arguments
/// 
/// * `app_handle` - Tauri application handle for emitting events
/// * `file_path` - Path to the file to watch (relative to home directory or absolute)
/// * `event_name` - Name of the Tauri event to emit when file changes
/// 
/// # Returns
/// 
/// A `Result<(), String>` indicating success or failure
pub fn watch_file(
    app_handle: AppHandle,
    file_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    // Create a channel for file system events
    let (tx, rx) = mpsc::channel();
    
    // Get the parent directory to watch
    let watch_dir = file_path.parent()
        .ok_or_else(|| "File path has no parent directory".to_string())?
        .to_path_buf();
    
    // Create the directory if it doesn't exist (resilient to missing directories)
    if !watch_dir.exists() {
        fs::create_dir_all(&watch_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Create the watcher
    let mut watcher: RecommendedWatcher = Watcher::new(
        tx,
        notify::Config::default()
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;
    
    // Start watching the directory (non-recursive)
    watcher.watch(&watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;
    
    // Spawn a task to handle file system events
    // Move watcher into the task to keep it alive
    let app_handle_clone = app_handle.clone();
    let file_name = file_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string();
    
    tauri::async_runtime::spawn(async move {
        // Keep watcher alive by moving it into the task
        let _watcher = watcher;
        
        while let Ok(event) = rx.recv() {
            match event {
                Ok(Event { kind: EventKind::Modify(_), paths, .. }) => {
                    // Check if the changed file is the one we're watching
                    if paths.iter().any(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n == file_name)
                            .unwrap_or(false)
                    }) {
                        // Emit Tauri event to frontend
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit file change event: {}", e);
                        });
                    }
                }
                Ok(Event { kind: EventKind::Create(_), paths, .. }) => {
                    // Also watch for file creation
                    if paths.iter().any(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n == file_name)
                            .unwrap_or(false)
                    }) {
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit file change event: {}", e);
                        });
                    }
                }
                Ok(Event { kind: EventKind::Remove(_), paths, .. }) => {
                    // Watch for file deletion
                    if paths.iter().any(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n == file_name)
                            .unwrap_or(false)
                    }) {
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit file change event: {}", e);
                        });
                    }
                }
                Err(e) => {
                    eprintln!("File watcher error: {}", e);
                }
                _ => {}
            }
        }
    });
    
    Ok(())
}

/// Starts watching a directory for .md file changes and emits Tauri events.
/// 
/// This function watches a directory (typically a .bluekit directory) and emits
/// events when any .md file is created, modified, or removed.
/// 
/// # Arguments
/// 
/// * `app_handle` - Tauri application handle for emitting events
/// * `directory_path` - Path to the directory to watch
/// * `event_name` - Name of the Tauri event to emit when files change
/// 
/// # Returns
/// 
/// A `Result<(), String>` indicating success or failure
pub fn watch_directory(
    app_handle: AppHandle,
    directory_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    // Create a channel for file system events
    let (tx, rx) = mpsc::channel();
    
    // Create the directory if it doesn't exist (resilient to missing directories)
    if !directory_path.exists() {
        fs::create_dir_all(&directory_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Create the watcher
    let mut watcher: RecommendedWatcher = Watcher::new(
        tx,
        notify::Config::default()
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;
    
    // Start watching the directory (recursive to watch subdirectories)
    watcher.watch(&directory_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;
    
    // Spawn a task to handle file system events
    let app_handle_clone = app_handle.clone();
    
    tauri::async_runtime::spawn(async move {
        // Keep watcher alive by moving it into the task
        let _watcher = watcher;
        
        while let Ok(event) = rx.recv() {
            match event {
                Ok(Event { kind: EventKind::Modify(_), paths, .. }) |
                Ok(Event { kind: EventKind::Create(_), paths, .. }) |
                Ok(Event { kind: EventKind::Remove(_), paths, .. }) => {
                    // Check if any of the changed files are .md, .mmd, or .mermaid files
                    let has_relevant_file = paths.iter().any(|p| {
                        p.extension()
                            .and_then(|ext| ext.to_str())
                            .map(|ext| ext == "md" || ext == "mmd" || ext == "mermaid")
                            .unwrap_or(false)
                    });
                    
                    if has_relevant_file {
                        // Emit Tauri event to frontend
                        app_handle_clone.emit_all(&event_name, ()).unwrap_or_else(|e| {
                            eprintln!("Failed to emit directory change event: {}", e);
                        });
                    }
                }
                Err(e) => {
                    eprintln!("Directory watcher error: {}", e);
                }
                _ => {}
            }
        }
    });
    
    Ok(())
}

/// Gets the path to the project registry file.
pub fn get_registry_path() -> Result<PathBuf, String> {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE")) // Windows fallback
        .map_err(|_| "Could not determine home directory".to_string())?;
    
    Ok(PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json"))
}

