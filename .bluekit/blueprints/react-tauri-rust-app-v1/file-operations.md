---
id: file-operations
type: task
version: 1
---

# File System Operations

Implement comprehensive file reading, writing, and directory traversal commands with proper error handling.

## Requirements

- Completed "IPC Commands" and "TypeScript IPC Wrappers" tasks
- Basic file operations already implemented

## Steps

### 1. Add Recursive Directory Reading

Add to `src-tauri/src/commands.rs`:

```rust
/// Recursively reads markdown files from a directory.
#[tauri::command]
pub async fn get_markdown_files(project_path: String) -> Result<Vec<KitFile>, String> {
    use std::fs;
    
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    if !bluekit_path.exists() {
        return Ok(Vec::new());
    }
    
    let mut files = Vec::new();
    
    fn read_md_files_from_dir(dir_path: &PathBuf, files: &mut Vec<KitFile>) -> Result<(), String> {
        if !dir_path.exists() {
            return Ok(());
        }
        
        let entries = fs::read_dir(dir_path)
            .map_err(|e| format!("Failed to read directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
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
                        
                        files.push(KitFile { name, path: path_str });
                    }
                }
            } else if path.is_dir() {
                read_md_files_from_dir(&path, files)?;
            }
        }
        
        Ok(())
    }
    
    read_md_files_from_dir(&bluekit_path, &mut files)?;
    Ok(files)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KitFile {
    pub name: String,
    pub path: String,
}
```

### 2. Add File Copying Command

Add to `src-tauri/src/commands.rs`:

```rust
/// Copies a file to a target directory.
#[tauri::command]
pub async fn copy_file(
    source_file_path: String,
    target_directory: String,
) -> Result<String, String> {
    use std::fs;
    
    let source_path = PathBuf::from(&source_file_path);
    let target_dir = PathBuf::from(&target_directory);
    
    if !source_path.exists() {
        return Err(format!("Source file does not exist: {}", source_file_path));
    }
    
    let file_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid source file name".to_string())?
        .to_string();
    
    // Create target directory if it doesn't exist
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    let target_file_path = target_dir.join(&file_name);
    
    // Read source file
    let contents = fs::read_to_string(&source_path)
        .map_err(|e| format!("Failed to read source file: {}", e))?;
    
    // Write to target
    fs::write(&target_file_path, contents)
        .map_err(|e| format!("Failed to write target file: {}", e))?;
    
    target_file_path
        .to_str()
        .ok_or_else(|| "Invalid target file path encoding".to_string())
        .map(|s| s.to_string())
}
```

### 3. Add TypeScript Wrappers

Add to `src/ipc.ts`:

```typescript
export interface KitFile {
  name: string;
  path: string;
}

export async function invokeGetMarkdownFiles(projectPath: string): Promise<KitFile[]> {
  return await invoke<KitFile[]>('get_markdown_files', { projectPath });
}

export async function invokeCopyFile(
  sourceFilePath: string,
  targetDirectory: string
): Promise<string> {
  return await invoke<string>('copy_file', {
    sourceFilePath,
    targetDirectory,
  });
}
```

### 4. Register Commands

Update `main.rs` to register new commands.

## Error Handling

- Always check file/directory existence
- Handle path encoding issues
- Provide descriptive error messages
- Create directories as needed

## Verification

- Test file operations with various paths
- Verify recursive directory reading works
- Test file copying functionality

## Next Steps

After completing this task, proceed to "File Watching" task.