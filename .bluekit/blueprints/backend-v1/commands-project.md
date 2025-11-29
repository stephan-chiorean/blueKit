---
id: commands-project
type: task
version: 1
---

# Project-Related IPC Commands

Implement commands for managing projects, kits, and file operations.

## Requirements

- File system access permissions
- JSON parsing with serde_json
- Path handling

## Steps

### 1. Add Project Commands to commands.rs

Add the following commands to `src-tauri/src/commands.rs`:

```rust
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct KitFile {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectEntry {
    pub id: String,
    pub title: String,
    pub description: String,
    pub path: String,
}

/// Reads the .bluekit directory and returns a list of .md files (kits).
#[tauri::command]
pub async fn get_project_kits(project_path: String) -> Result<Vec<KitFile>, String> {
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    if !bluekit_path.exists() {
        return Ok(Vec::new());
    }
    
    let entries = fs::read_dir(&bluekit_path)
        .map_err(|e| format!("Failed to read .bluekit directory: {}", e))?;
    
    let mut kits = Vec::new();
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            if let Some(extension) = path.extension() {
                if extension == "md" {
                    let name = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();
                    
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

/// Reads the project registry from ~/.bluekit/projectRegistry.json.
#[tauri::command]
pub async fn get_project_registry() -> Result<Vec<ProjectEntry>, String> {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;
    
    let registry_path = PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json");
    
    if !registry_path.exists() {
        return Ok(Vec::new());
    }
    
    let contents = fs::read_to_string(&registry_path)
        .map_err(|e| format!("Failed to read project registry: {}", e))?;
    
    if contents.trim().is_empty() {
        return Ok(Vec::new());
    }
    
    let projects: Vec<ProjectEntry> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse project registry JSON: {}", e))?;
    
    Ok(projects)
}

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

## Key Concepts

### Path Handling

- Use `PathBuf` for cross-platform path operations
- Use `.join()` to build paths safely
- Convert to strings with `.to_str()` when needed

### Error Handling

- Use `map_err()` to convert I/O errors to strings
- Return empty vectors for missing files/directories
- Provide clear error messages

### JSON Parsing

- Use `serde_json::from_str()` to parse JSON
- Handle empty files gracefully
- Return appropriate error messages on parse failure

### Directory Reading

- Use `fs::read_dir()` to iterate directory entries
- Filter by file extension
- Handle errors at each step

## Cross-Platform Considerations

- Use `HOME` on Unix, `USERPROFILE` on Windows
- Path separators handled by `PathBuf`
- File encoding handled by Rust strings

## Verification

- Test with existing projects
- Verify empty directory handling
- Test on different platforms
- Verify JSON parsing with valid/invalid files