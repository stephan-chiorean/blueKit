---
id: getting-kits-from-bluekit-directory
alias: Getting Kits from .bluekit Directory
type: walkthrough
is_base: false
version: 1
tags:
  - kits
  - file-system
  - rust
  - tauri
description: Simple walkthrough explaining how BlueKit reads kit files from a project's .bluekit directory
---
# Getting Kits from .bluekit Directory

This walkthrough explains how BlueKit retrieves kit files from a project's `.bluekit` directory. Kits are markdown files (`.md`) stored in the `.bluekit` folder at the root of each project.

## Overview

When you want to get all kits from a project, BlueKit:
1. Constructs the path to the `.bluekit` directory
2. Checks if the directory exists
3. Reads all files in the directory
4. Filters for `.md` files
5. Returns a list of kit files with their names and paths

## The KitFile Structure

Before we dive into the retrieval logic, let's understand what we're returning:

```140:146:src-tauri/src/commands.rs
#[derive(Debug, Serialize, Deserialize)]
pub struct KitFile {
    /// Name of the kit file (without .md extension)
    pub name: String,
    /// Full path to the kit file
    pub path: String,
}
```

Each `KitFile` contains:
- `name`: The file name without the `.md` extension (e.g., "my-kit" from "my-kit.md")
- `path`: The full absolute path to the file (e.g., "/path/to/project/.bluekit/my-kit.md")

## Step-by-Step: The get_project_kits Function

The `get_project_kits` function in `src-tauri/src/commands.rs` does all the work:

### Step 1: Construct the .bluekit Path

```160:164:src-tauri/src/commands.rs
pub async fn get_project_kits(project_path: String) -> Result<Vec<KitFile>, String> {
    use std::fs;
    
    // Construct the path to .bluekit directory
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
```

Given a project path like `/Users/developer/my-project`, this creates `/Users/developer/my-project/.bluekit`.

### Step 2: Check if Directory Exists

```166:169:src-tauri/src/commands.rs
    // Check if .bluekit directory exists
    if !bluekit_path.exists() {
        return Ok(Vec::new()); // Return empty vector if directory doesn't exist
    }
```

If the `.bluekit` directory doesn't exist (maybe the project hasn't created any kits yet), the function returns an empty array. This is not an error - it just means there are no kits.

### Step 3: Read the Directory

```171:173:src-tauri/src/commands.rs
    // Read the directory
    let entries = fs::read_dir(&bluekit_path)
        .map_err(|e| format!("Failed to read .bluekit directory: {}", e))?;
```

This reads all entries (files and subdirectories) in the `.bluekit` directory. If reading fails, it returns an error.

### Step 4: Filter for Markdown Files

```175:206:src-tauri/src/commands.rs
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
```

For each entry in the directory:
1. **Check if it's a file**: `path.is_file()` - skips subdirectories
2. **Check the extension**: `path.extension() == "md"` - only markdown files
3. **Extract the name**: `file_stem()` gets the filename without extension
4. **Get the full path**: Converts the path to a string
5. **Create KitFile**: Adds it to the results

### Step 5: Return the Results

```208:209:src-tauri/src/commands.rs
    Ok(kits)
}
```

Returns the vector of `KitFile` objects.

## Example Usage

Here's how you'd call this from TypeScript:

```175:177:src/ipc.ts
export async function invokeGetProjectKits(projectPath: string): Promise<KitFile[]> {
  return await invoke<KitFile[]>('get_project_kits', { projectPath });
}
```

Example:
```typescript
const kits = await invokeGetProjectKits('/Users/developer/my-project');
// kits = [
//   { name: "authentication", path: "/Users/developer/my-project/.bluekit/authentication.md" },
//   { name: "api-patterns", path: "/Users/developer/my-project/.bluekit/api-patterns.md" }
// ]
```

## What Gets Included

- ✅ All `.md` files in `.bluekit/`
- ✅ Files in subdirectories are **not** included (only top-level `.md` files)

## What Gets Excluded

- ❌ Non-markdown files (`.txt`, `.json`, etc.)
- ❌ Subdirectories
- ❌ Files in subdirectories of `.bluekit/`

## Summary

The `get_project_kits` function is straightforward:
1. Build the `.bluekit` path
2. Check if it exists (return empty if not)
3. Read the directory
4. Filter for `.md` files
5. Return their names and paths

This simple approach keeps kits discoverable and easy to manage - just drop a `.md` file in `.bluekit/` and it will be found automatically.