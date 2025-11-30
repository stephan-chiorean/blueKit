---
id: ipc-commands
type: task
version: 1
---

# IPC Command Handlers

Implement IPC command handlers in Rust with proper error handling, serialization, and file system operations.

## Requirements

- Completed "Main Entry Point" task
- Understanding of Rust error handling (`Result<T, E>`)
- Familiarity with serde for serialization

## Steps

### 1. Add File Reading Command

Add to `src-tauri/src/commands.rs`:

```rust
use std::fs;
use std::path::PathBuf;

/// Reads the contents of a file.
#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
    
    Ok(contents)
}
```

### 2. Add Directory Listing Command

Add to `src-tauri/src/commands.rs`:

```rust
/// File information structure.
#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_file: bool,
}

/// Gets files and directories from a path.
#[tauri::command]
pub async fn list_directory(dir_path: String) -> Result<Vec<FileInfo>, String> {
    use std::fs;
    
    let path = PathBuf::from(&dir_path);
    
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    
    let mut items = Vec::new();
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_path = entry.path();
        
        let name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .unwrap_or_default();
        
        let path_str = entry_path
            .to_str()
            .ok_or_else(|| "Invalid path encoding".to_string())?
            .to_string();
        
        items.push(FileInfo {
            name,
            path: path_str,
            is_file: entry_path.is_file(),
        });
    }
    
    Ok(items)
}
```

### 3. Add File Writing Command

Add to `src-tauri/src/commands.rs`:

```rust
/// Writes content to a file.
#[tauri::command]
pub async fn write_file(file_path: String, content: String) -> Result<String, String> {
    use std::fs;
    
    let path = PathBuf::from(&file_path);
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;
    
    Ok(file_path)
}
```

### 4. Register Commands in main.rs

Update `src-tauri/src/main.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::ping,
    commands::get_app_info,
    commands::read_file,
    commands::list_directory,
    commands::write_file,
])
```

## Error Handling Patterns

1. **File Operations**: Always check if file/directory exists before operations
2. **Path Handling**: Convert paths safely, handle encoding issues
3. **Error Messages**: Provide descriptive error messages for debugging
4. **Result Type**: Always return `Result<T, String>` for error handling

## Best Practices

1. Use `?` operator for error propagation
2. Provide context in error messages
3. Validate inputs before processing
4. Handle edge cases (empty directories, missing files, etc.)

## Verification

- Run `cargo check` - should compile without errors
- Commands will be testable once TypeScript wrappers are created

## Next Steps

After completing this task, proceed to "TypeScript IPC Wrappers" task.