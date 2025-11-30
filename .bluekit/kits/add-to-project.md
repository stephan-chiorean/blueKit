---
id: add-to-project
alias: Add to Project
type: kit
is_base: false
version: 1
tags:
  - tauri
  - file-operations
  - ui-patterns
description: Complete implementation of "Add to Project" functionality with file explorer dialog, directory selection, and file/folder copying from frontend to backend
---
# Add to Project Functionality

## Overview

The "Add to Project" feature allows users to copy files or folders (like kits, blueprints, or other artifacts) from one location to a project's `.bluekit` directory. It provides a user-friendly flow: click a button, select a project directory via file explorer, and automatically copy the selected items.

## Architecture

### Frontend Flow
1. User clicks "Add to Project" button
2. Tauri dialog opens to select target project directory
3. Frontend calls IPC command with source path and selected project path
4. Backend copies files/folders to target location
5. Success/error toast notification shown to user

### Backend Flow
1. Receive IPC command with source and target paths
2. Validate paths exist
3. Create target directory structure if needed
4. Copy files/folders (recursively for directories)
5. Return success or error

## Implementation

### Step 1: Frontend - Button Component

Add a button that triggers the "Add to Project" action:

```typescript
import { Button, HStack, Icon, Text } from '@chakra-ui/react';
import { LuFolderPlus } from 'react-icons/lu';
import { open } from '@tauri-apps/api/dialog';
import { invokeCopyKitToProject } from '../ipc';
import { toaster } from '../ui/toaster';

function MyComponent({ sourcePath }: { sourcePath: string }) {
  const handleAddToProject = async () => {
    try {
      // Open directory picker to select a project
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project',
      });

      if (!selectedPath || typeof selectedPath !== 'string') {
        // User cancelled
        return;
      }

      // Copy to project
      await invokeCopyKitToProject(sourcePath, selectedPath);

      // Show success toast
      toaster.create({
        type: 'success',
        title: 'Success',
        description: 'Successfully added to project',
      });
    } catch (error) {
      toaster.create({
        type: 'error',
        title: 'Error',
        description: `Failed to add to project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={handleAddToProject}
    >
      <HStack gap={1}>
        <Icon size="xs">
          <LuFolderPlus />
        </Icon>
        <Text>Add to Project</Text>
      </HStack>
    </Button>
  );
}
```

### Step 2: Frontend - IPC Wrapper

Create a type-safe IPC wrapper function:

```typescript
// src/ipc.ts
import { invoke } from '@tauri-apps/api/tauri';

/**
 * Copies a file to a project's .bluekit directory.
 * 
 * @param sourceFilePath - The absolute path to the source file
 * @param targetProjectPath - The absolute path to the target project root directory
 * @returns A promise that resolves to the path of the copied file
 */
export async function invokeCopyKitToProject(
  sourceFilePath: string,
  targetProjectPath: string,
): Promise<string> {
  return await invoke<string>('copy_kit_to_project', {
    sourceFilePath,
    targetProjectPath,
  });
}
```

### Step 3: Backend - IPC Command (Single File)

For copying a single file:

```rust
// src-tauri/src/commands.rs
use std::fs;
use std::path::PathBuf;

/// Copies a kit file to a project's .bluekit directory.
#[tauri::command]
pub async fn copy_kit_to_project(
    source_file_path: String,
    target_project_path: String,
) -> Result<String, String> {
    let source_path = PathBuf::from(&source_file_path);
    let target_project = PathBuf::from(&target_project_path);
    
    // Validate paths
    if !source_path.exists() {
        return Err(format!("Source file does not exist: {}", source_file_path));
    }
    
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
    
    // Return the target file path
    target_file_path
        .to_str()
        .ok_or_else(|| "Invalid target file path encoding".to_string())
        .map(|s| s.to_string())
}
```

### Step 4: Backend - IPC Command (Directory)

For copying an entire directory (like blueprints):

```rust
/// Copies a blueprint directory to a project's .bluekit/blueprints directory.
#[tauri::command]
pub async fn copy_blueprint_to_project(
    source_blueprint_path: String,
    target_project_path: String,
) -> Result<String, String> {
    use std::fs;
    
    let source_path = PathBuf::from(&source_blueprint_path);
    let target_project = PathBuf::from(&target_project_path);
    
    // Validate paths
    if !source_path.exists() {
        return Err(format!("Source blueprint directory does not exist: {}", source_blueprint_path));
    }
    
    if !source_path.is_dir() {
        return Err(format!("Source path is not a directory: {}", source_blueprint_path));
    }
    
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
    
    // Return the target blueprint directory path
    target_blueprint_path
        .to_str()
        .ok_or_else(|| "Invalid target blueprint path encoding".to_string())
        .map(|s| s.to_string())
}
```

### Step 5: Register Command in main.rs

```rust
// src-tauri/src/main.rs
.invoke_handler(tauri::generate_handler![
    // ... other commands
    commands::copy_kit_to_project,
    commands::copy_blueprint_to_project,
])
```

## Customization Possibilities

### 1. Dialog Options

Customize the file explorer dialog:

```typescript
const selectedPath = await open({
  directory: true,
  multiple: false,
  title: 'Select Target Project',
  defaultPath: '/path/to/default/location', // Set default location
  filters: [
    { name: 'Projects', extensions: [] }, // Optional file type filters
  ],
});
```

### 2. Target Directory Structure

Modify where files are copied within the project:

```rust
// Instead of .bluekit/kits/, use custom location
let custom_dir = target_project.join(".bluekit").join("custom");
fs::create_dir_all(&custom_dir)?;
```

### 3. File Filtering

Add logic to filter which files to copy:

```rust
// Only copy .md files
if entry_path.is_file() {
    if let Some(extension) = entry_path.extension() {
        if extension == "md" {
            // Copy file
        }
    }
}
```

### 4. Conflict Handling

Handle existing files:

```rust
// Check if file exists before copying
if target_file_path.exists() {
    // Option 1: Skip
    return Ok(target_file_path.to_string_lossy().to_string());
    
    // Option 2: Overwrite
    // Continue with copy
    
    // Option 3: Rename
    let mut counter = 1;
    while target_file_path.exists() {
        let new_name = format!("{}_{}", file_name, counter);
        target_file_path = kits_dir.join(&new_name);
        counter += 1;
    }
}
```

### 5. Progress Feedback

Add progress tracking for large operations:

```typescript
// Frontend: Show progress
const [copying, setCopying] = useState(false);

const handleAddToProject = async () => {
  setCopying(true);
  try {
    await invokeCopyKitToProject(sourcePath, selectedPath);
  } finally {
    setCopying(false);
  }
};

// In button
<Button disabled={copying}>
  {copying ? 'Copying...' : 'Add to Project'}
</Button>
```

### 6. Batch Operations

Copy multiple items at once:

```typescript
const handleAddMultipleToProject = async (items: string[]) => {
  const selectedPath = await open({ directory: true, multiple: false });
  
  if (!selectedPath || typeof selectedPath !== 'string') return;
  
  let successCount = 0;
  const errors: string[] = [];
  
  for (const itemPath of items) {
    try {
      await invokeCopyKitToProject(itemPath, selectedPath);
      successCount++;
    } catch (error) {
      errors.push(`${itemPath}: ${error}`);
    }
  }
  
  // Show summary toast
  toaster.create({
    type: successCount > 0 ? 'success' : 'error',
    title: `${successCount} of ${items.length} copied`,
    description: errors.length > 0 ? errors.join(', ') : undefined,
  });
};
```

### 7. Validation

Add validation before copying:

```rust
// Validate file size
let metadata = fs::metadata(&source_path)?;
if metadata.len() > 10 * 1024 * 1024 { // 10MB limit
    return Err("File too large".to_string());
}

// Validate file type
if let Some(extension) = source_path.extension() {
    let allowed = vec!["md", "json", "txt"];
    if !allowed.contains(&extension.to_str().unwrap_or("")) {
        return Err("File type not allowed".to_string());
    }
}
```

## Error Handling

### Frontend Error Handling

```typescript
try {
  await invokeCopyKitToProject(sourcePath, targetPath);
} catch (error) {
  // Handle specific error types
  if (error instanceof Error) {
    if (error.message.includes('does not exist')) {
      // Show specific message for missing files
    } else if (error.message.includes('permission')) {
      // Show permission error
    }
  }
  
  // Generic error fallback
  toaster.create({
    type: 'error',
    title: 'Error',
    description: error instanceof Error ? error.message : 'Unknown error',
  });
}
```

### Backend Error Handling

```rust
// Provide descriptive error messages
.map_err(|e| format!("Failed to read source file {}: {}", source_file_path, e))?;

// Return early on validation errors
if !source_path.exists() {
    return Err(format!("Source file does not exist: {}", source_file_path));
}
```

## Testing

### Test File Copy

```typescript
// Test single file copy
const testSource = '/path/to/test/kit.md';
const testTarget = '/path/to/test/project';

try {
  const result = await invokeCopyKitToProject(testSource, testTarget);
  console.assert(result.includes('.bluekit/kits/kit.md'));
} catch (error) {
  console.error('Test failed:', error);
}
```

### Test Directory Copy

```typescript
// Test directory copy
const testBlueprint = '/path/to/test/blueprint';
const testTarget = '/path/to/test/project';

try {
  const result = await invokeCopyBlueprintToProject(testBlueprint, testTarget);
  console.assert(result.includes('.bluekit/blueprints/blueprint'));
} catch (error) {
  console.error('Test failed:', error);
}
```

## Integration Examples

### In Action Bar

```typescript
// GlobalActionBar.tsx
<Button variant="outline" size="sm" onClick={handleAddToProject}>
  <HStack gap={2}>
    <LuFolderPlus />
    <Text>Add to Project</Text>
  </HStack>
</Button>
```

### In Component Card

```typescript
// BlueprintsTabContent.tsx
<Button
  variant="outline"
  size="xs"
  mt={2}
  onClick={() => handleAddToProject(blueprint)}
>
  <HStack gap={1}>
    <Icon size="xs">
      <LuFolderPlus />
    </Icon>
    <Text>Add to Project</Text>
  </HStack>
</Button>
```

## Best Practices

1. **Always validate paths** before attempting file operations
2. **Create directories** if they don't exist (use `create_dir_all`)
3. **Provide clear error messages** to help users understand what went wrong
4. **Show loading states** during async operations
5. **Handle user cancellation** gracefully (when dialog is closed)
6. **Use type-safe IPC wrappers** for better developer experience
7. **Test with various file sizes** and directory structures
8. **Consider permissions** - ensure Tauri has necessary file system permissions

## Security Considerations

1. **Validate file paths** to prevent directory traversal attacks
2. **Check file sizes** to prevent memory issues
3. **Sanitize file names** to prevent path injection
4. **Limit file types** if copying from untrusted sources
5. **Request minimal permissions** in `tauri.conf.json`

## Related Patterns

- **File Watching**: After copying, set up file watchers to detect changes
- **Project Registry**: Update project registry after adding items
- **Undo/Redo**: Consider implementing undo functionality for copy operations
- **Sync**: For multi-project scenarios, consider sync mechanisms
