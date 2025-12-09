---
id: artifact-folder-system
alias: Artifact Folder Organization System
type: kit
is_base: false
version: 1
tags:
  - folder-system
  - artifacts
  - file-organization
description: Complete implementation guide for adding folder organization to any artifact type (kits, walkthroughs, diagrams, etc.)
---
# Artifact Folder Organization System

A complete kit for implementing folder-based organization for any artifact type in BlueKit. This system allows users to create folders, move artifacts in/out of folders, and nest folders within folders.

## What This System Does

Users can:
- Create folders with custom names, aliases, and descriptions
- Move artifacts into/out of folders via drag-and-drop or menu actions
- Nest folders inside other folders (multi-level hierarchy)
- Expand/collapse folder views
- See folder metadata (artifact count, description)
- Delete folders (moves contents back to root)
- Edit folder metadata (name, alias, description)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/TypeScript)              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TabContent.tsx (e.g., KitsTabContent.tsx)           │  │
│  │  - Manages artifact state                            │  │
│  │  - Loads folders via invokeGetArtifactFolders()     │  │
│  │  - Builds folder tree with buildFolderTree()        │  │
│  │  - Handles folder operations (create/edit/delete)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Shared Components                                   │  │
│  │  - FolderCard.tsx: Renders folder with artifacts    │  │
│  │  - CreateFolderModal.tsx: Create new folders        │  │
│  │  - EditFolderModal.tsx: Edit folder metadata        │  │
│  │  - DeleteFolderDialog.tsx: Delete confirmation      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Utilities                                           │  │
│  │  - buildFolderTree(): Converts flat list to tree    │  │
│  │  - IPC wrappers: Type-safe Tauri command calls      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ Tauri IPC
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Rust/Tauri)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  IPC Commands (commands.rs)                          │  │
│  │  - get_artifact_folders()                            │  │
│  │  - create_artifact_folder()                          │  │
│  │  - update_folder_config()                            │  │
│  │  - delete_artifact_folder()                          │  │
│  │  - move_artifact_to_folder()                         │  │
│  │  - move_folder_to_folder()                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  File System Operations                              │  │
│  │  - Create/delete directories                         │  │
│  │  - Move files between directories                    │  │
│  │  - Read/write config.json files                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    File System Structure                    │
│                                                             │
│  .bluekit/{artifact_type}/                                  │
│  ├── artifact1.md                     (root level)          │
│  ├── artifact2.md                     (root level)          │
│  ├── folder1/                                               │
│  │   ├── config.json                 (folder metadata)      │
│  │   ├── artifact3.md                                       │
│  │   └── subfolder/                  (nested folder)        │
│  │       ├── config.json                                    │
│  │       └── artifact4.md                                   │
│  └── folder2/                                               │
│      ├── config.json                                        │
│      └── artifact5.md                                       │
└─────────────────────────────────────────────────────────────┘
```

## File Structure: config.json Schema

Each folder contains a `config.json` with metadata:

```json
{
  "id": "ui-components",
  "alias": "UI Components",
  "description": "Reusable React UI components",
  "artifacts": [
    "button.md",
    "modal.md",
    "form.md"
  ],
  "folders": [
    "forms",
    "layouts"
  ]
}
```

**Fields**:
- `id`: Folder name (kebab-case, matches directory name)
- `alias`: Display name (Title Case)
- `description`: Brief explanation of folder contents
- `artifacts`: Array of artifact filenames in this folder
- `folders`: Array of subfolder names (nested folders)

## Implementation Steps

### 1. Backend: Rust IPC Commands

**File**: `src-tauri/src/commands.rs`

Add these structs and commands:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Folder metadata structure matching config.json
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArtifactFolder {
    /// Folder ID (matches directory name)
    pub id: String,
    /// Display name
    pub alias: String,
    /// Folder description
    pub description: String,
    /// Full path to folder directory
    pub path: String,
    /// List of artifact filenames in this folder
    pub artifacts: Vec<String>,
    /// List of subfolder names (nested folders)
    pub folders: Vec<String>,
}

/// Gets all folders for a specific artifact type
#[tauri::command]
pub async fn get_artifact_folders(
    project_path: String,
    artifact_type: String, // "kits", "walkthroughs", "diagrams", etc.
) -> Result<Vec<ArtifactFolder>, String> {
    let base_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type);

    if !base_path.exists() {
        return Ok(Vec::new());
    }

    let mut folders = Vec::new();
    scan_folders_recursive(&base_path, &base_path, &mut folders)?;
    
    Ok(folders)
}

/// Recursively scans for folders with config.json
fn scan_folders_recursive(
    base_path: &PathBuf,
    current_path: &PathBuf,
    folders: &mut Vec<ArtifactFolder>,
) -> Result<(), String> {
    let entries = fs::read_dir(current_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let config_path = path.join("config.json");
            
            if config_path.exists() {
                // Read and parse config.json
                let config_content = fs::read_to_string(&config_path)
                    .map_err(|e| format!("Failed to read config.json: {}", e))?;
                
                let mut folder: ArtifactFolder = serde_json::from_str(&config_content)
                    .map_err(|e| format!("Failed to parse config.json: {}", e))?;
                
                // Set full path (relative to base)
                folder.path = path
                    .strip_prefix(base_path)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                
                folders.push(folder);
                
                // Recursively scan subfolders
                scan_folders_recursive(base_path, &path, folders)?;
            }
        }
    }

    Ok(())
}

/// Creates a new folder with config.json
#[tauri::command]
pub async fn create_artifact_folder(
    project_path: String,
    artifact_type: String,
    folder_id: String,
    alias: String,
    description: String,
    parent_folder: Option<String>, // Path to parent folder for nesting
) -> Result<(), String> {
    let mut folder_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type);

    if let Some(parent) = parent_folder {
        folder_path = folder_path.join(parent);
    }
    
    folder_path = folder_path.join(&folder_id);

    // Create directory
    fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    // Create config.json
    let config = ArtifactFolder {
        id: folder_id.clone(),
        alias,
        description,
        path: String::new(), // Will be set by get_artifact_folders
        artifacts: Vec::new(),
        folders: Vec::new(),
    };

    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    let config_path = folder_path.join("config.json");
    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;

    Ok(())
}

/// Updates folder config.json metadata
#[tauri::command]
pub async fn update_folder_config(
    project_path: String,
    artifact_type: String,
    folder_path: String, // Relative path like "ui-components" or "ui-components/forms"
    alias: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let config_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type)
        .join(&folder_path)
        .join("config.json");

    if !config_path.exists() {
        return Err("Folder config.json not found".to_string());
    }

    // Read existing config
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.json: {}", e))?;
    
    let mut folder: ArtifactFolder = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config.json: {}", e))?;

    // Update fields
    if let Some(new_alias) = alias {
        folder.alias = new_alias;
    }
    if let Some(new_desc) = description {
        folder.description = new_desc;
    }

    // Write back
    let config_json = serde_json::to_string_pretty(&folder)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;

    Ok(())
}

/// Deletes a folder and moves contents back to root
#[tauri::command]
pub async fn delete_artifact_folder(
    project_path: String,
    artifact_type: String,
    folder_path: String,
) -> Result<(), String> {
    let full_folder_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type)
        .join(&folder_path);

    if !full_folder_path.exists() {
        return Err("Folder not found".to_string());
    }

    let root_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type);

    // Move all files to root
    let entries = fs::read_dir(&full_folder_path)
        .map_err(|e| format!("Failed to read folder: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Skip config.json
        if path.file_name() == Some(std::ffi::OsStr::new("config.json")) {
            continue;
        }

        let file_name = path.file_name()
            .ok_or_else(|| "Invalid file name".to_string())?;

        let dest_path = root_path.join(file_name);

        // Move file/folder to root
        fs::rename(&path, &dest_path)
            .map_err(|e| format!("Failed to move {}: {}", path.display(), e))?;
    }

    // Delete the now-empty folder
    fs::remove_dir_all(&full_folder_path)
        .map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

/// Moves an artifact file into a folder
#[tauri::command]
pub async fn move_artifact_to_folder(
    artifact_path: String,    // Full path to artifact file
    folder_id: String,         // Target folder ID
    artifact_type: String,
) -> Result<(), String> {
    let artifact_pathbuf = PathBuf::from(&artifact_path);
    
    let file_name = artifact_pathbuf
        .file_name()
        .ok_or_else(|| "Invalid artifact path".to_string())?;

    // Determine project path by going up to .bluekit parent
    let project_path = artifact_pathbuf
        .ancestors()
        .find(|p| p.join(".bluekit").exists())
        .ok_or_else(|| "Could not find project root".to_string())?;

    let folder_path = project_path
        .join(".bluekit")
        .join(&artifact_type)
        .join(&folder_id);

    if !folder_path.exists() {
        return Err("Target folder not found".to_string());
    }

    let dest_path = folder_path.join(file_name);

    // Move file
    fs::rename(&artifact_pathbuf, &dest_path)
        .map_err(|e| format!("Failed to move artifact: {}", e))?;

    // Update folder config.json
    let config_path = folder_path.join("config.json");
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.json: {}", e))?;
    
    let mut folder: ArtifactFolder = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config.json: {}", e))?;

    let file_name_str = file_name.to_string_lossy().to_string();
    if !folder.artifacts.contains(&file_name_str) {
        folder.artifacts.push(file_name_str);
    }

    let config_json = serde_json::to_string_pretty(&folder)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;

    Ok(())
}

/// Moves a folder into another folder (nesting)
#[tauri::command]
pub async fn move_folder_to_folder(
    project_path: String,
    artifact_type: String,
    source_folder_path: String,    // e.g., "ui-components"
    target_folder_path: String,    // e.g., "react"
) -> Result<(), String> {
    let base_path = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type);

    let source_path = base_path.join(&source_folder_path);
    let target_base = base_path.join(&target_folder_path);

    if !source_path.exists() {
        return Err("Source folder not found".to_string());
    }
    if !target_base.exists() {
        return Err("Target folder not found".to_string());
    }

    let folder_name = source_path
        .file_name()
        .ok_or_else(|| "Invalid source folder".to_string())?;

    let dest_path = target_base.join(folder_name);

    // Move folder
    fs::rename(&source_path, &dest_path)
        .map_err(|e| format!("Failed to move folder: {}", e))?;

    // Update target folder's config.json
    let config_path = target_base.join("config.json");
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.json: {}", e))?;
    
    let mut folder: ArtifactFolder = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config.json: {}", e))?;

    let folder_name_str = folder_name.to_string_lossy().to_string();
    if !folder.folders.contains(&folder_name_str) {
        folder.folders.push(folder_name_str);
    }

    let config_json = serde_json::to_string_pretty(&folder)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;

    Ok(())
}
```

**Register commands in `src-tauri/src/main.rs`**:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::get_artifact_folders,
    commands::create_artifact_folder,
    commands::update_folder_config,
    commands::delete_artifact_folder,
    commands::move_artifact_to_folder,
    commands::move_folder_to_folder,
])
```

### 2. Frontend: IPC Wrappers

**File**: `src/ipc.ts`

Add type-safe wrappers:

```typescript
import { invokeWithTimeout } from './utils/ipcTimeout';

export interface ArtifactFolder {
  id: string;
  alias: string;
  description: string;
  path: string;
  artifacts: string[];
  folders: string[];
}

export const invokeGetArtifactFolders = (
  projectPath: string,
  artifactType: 'kits' | 'walkthroughs' | 'diagrams' | 'agents'
): Promise<ArtifactFolder[]> => {
  return invokeWithTimeout<ArtifactFolder[]>(
    'get_artifact_folders',
    { projectPath, artifactType },
    5000
  );
};

export const invokeCreateArtifactFolder = (
  projectPath: string,
  artifactType: string,
  folderId: string,
  alias: string,
  description: string,
  parentFolder?: string
): Promise<void> => {
  return invokeWithTimeout<void>(
    'create_artifact_folder',
    { projectPath, artifactType, folderId, alias, description, parentFolder },
    5000
  );
};

export const invokeUpdateFolderConfig = (
  projectPath: string,
  artifactType: string,
  folderPath: string,
  alias?: string,
  description?: string
): Promise<void> => {
  return invokeWithTimeout<void>(
    'update_folder_config',
    { projectPath, artifactType, folderPath, alias, description },
    5000
  );
};

export const invokeDeleteArtifactFolder = (
  projectPath: string,
  artifactType: string,
  folderPath: string
): Promise<void> => {
  return invokeWithTimeout<void>(
    'delete_artifact_folder',
    { projectPath, artifactType, folderPath },
    5000
  );
};

export const invokeMoveArtifactToFolder = (
  artifactPath: string,
  folderId: string,
  artifactType: string
): Promise<void> => {
  return invokeWithTimeout<void>(
    'move_artifact_to_folder',
    { artifactPath, folderId, artifactType },
    5000
  );
};

export const invokeMoveToRoot = (
  artifactPath: string,
  artifactType: string
): Promise<void> => {
  // Moving to root means moving to .bluekit/{artifactType}/
  const projectPath = artifactPath.split('.bluekit')[0];
  return invokeWithTimeout<void>(
    'move_artifact_to_folder',
    { artifactPath, folderId: '', artifactType },
    5000
  );
};

export const invokeMoveFolderToFolder = (
  projectPath: string,
  artifactType: string,
  sourceFolderPath: string,
  targetFolderPath: string
): Promise<void> => {
  return invokeWithTimeout<void>(
    'move_folder_to_folder',
    { projectPath, artifactType, sourceFolderPath, targetFolderPath },
    5000
  );
};
```

### 3. Frontend: Folder Tree Builder Utility

**File**: `src/utils/buildFolderTree.ts`

```typescript
import { ArtifactFile } from '../ipc';
import { ArtifactFolder } from '../ipc';

export interface FolderTreeNode {
  folder: ArtifactFolder;
  artifacts: ArtifactFile[];
  subfolders: FolderTreeNode[];
  isExpanded: boolean;
}

/**
 * Builds a hierarchical tree structure from flat folder and artifact lists
 */
export function buildFolderTree(
  folders: ArtifactFolder[],
  artifacts: ArtifactFile[],
  artifactType: string,
  projectPath: string
): FolderTreeNode[] {
  // Filter to only root-level folders (no slashes in path)
  const rootFolders = folders.filter(f => !f.path.includes('/'));

  return rootFolders.map(folder => buildNode(folder, folders, artifacts, projectPath, artifactType));
}

function buildNode(
  folder: ArtifactFolder,
  allFolders: ArtifactFolder[],
  allArtifacts: ArtifactFile[],
  projectPath: string,
  artifactType: string
): FolderTreeNode {
  const folderBasePath = `${projectPath}/.bluekit/${artifactType}/${folder.path}`;

  // Find artifacts in this folder
  const folderArtifacts = allArtifacts.filter(artifact =>
    artifact.path.startsWith(folderBasePath + '/') &&
    !artifact.path.substring(folderBasePath.length + 1).includes('/')
  );

  // Find subfolders (folders whose path starts with this folder's path)
  const subfolders = allFolders
    .filter(f => {
      const relativePath = f.path.replace(folder.path + '/', '');
      return f.path.startsWith(folder.path + '/') && !relativePath.includes('/');
    })
    .map(subfolder => buildNode(subfolder, allFolders, allArtifacts, projectPath, artifactType));

  return {
    folder,
    artifacts: folderArtifacts,
    subfolders,
    isExpanded: false,
  };
}
```

### 4. Frontend: Shared Components

**File**: `src/components/shared/FolderCard.tsx`

```typescript
import { useState } from 'react';
import { Box, Card, Heading, Text, HStack, IconButton } from '@chakra-ui/react';
import { FolderTreeNode } from '../../utils/buildFolderTree';
import { LuChevronDown, LuChevronRight, LuMoreVertical } from 'react-icons/lu';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '../ui/menu';

interface FolderCardProps {
  node: FolderTreeNode;
  onToggleExpand: (folderPath: string) => void;
  onEditFolder?: (folderPath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  renderArtifact: (artifact: any) => React.ReactNode;
}

export default function FolderCard({
  node,
  onToggleExpand,
  onEditFolder,
  onDeleteFolder,
  renderArtifact,
}: FolderCardProps) {
  const { folder, artifacts, subfolders, isExpanded } = node;

  return (
    <Card.Root mb={4}>
      <Card.Header>
        <HStack justify="space-between">
          <HStack>
            <IconButton
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              size="sm"
              variant="ghost"
              onClick={() => onToggleExpand(folder.path)}
            >
              {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
            </IconButton>
            <Box>
              <Heading size="md">{folder.alias || folder.id}</Heading>
              {folder.description && (
                <Text fontSize="sm" color="fg.muted">
                  {folder.description}
                </Text>
              )}
            </Box>
          </HStack>

          <HStack>
            <Text fontSize="sm" color="fg.muted">
              {artifacts.length} items
            </Text>
            <MenuRoot>
              <MenuTrigger asChild>
                <IconButton
                  aria-label="Folder options"
                  size="sm"
                  variant="ghost"
                >
                  <LuMoreVertical />
                </IconButton>
              </MenuTrigger>
              <MenuContent>
                {onEditFolder && (
                  <MenuItem value="edit" onClick={() => onEditFolder(folder.path)}>
                    Edit Folder
                  </MenuItem>
                )}
                {onDeleteFolder && (
                  <MenuItem value="delete" onClick={() => onDeleteFolder(folder.path)}>
                    Delete Folder
                  </MenuItem>
                )}
              </MenuContent>
            </MenuRoot>
          </HStack>
        </HStack>
      </Card.Header>

      {isExpanded && (
        <Card.Body>
          {/* Render artifacts */}
          {artifacts.length > 0 && (
            <Box mb={4}>
              {artifacts.map(artifact => (
                <Box key={artifact.path} mb={2}>
                  {renderArtifact(artifact)}
                </Box>
              ))}
            </Box>
          )}

          {/* Render nested folders */}
          {subfolders.length > 0 && (
            <Box pl={4}>
              {subfolders.map(subfolder => (
                <FolderCard
                  key={subfolder.folder.path}
                  node={subfolder}
                  onToggleExpand={onToggleExpand}
                  onEditFolder={onEditFolder}
                  onDeleteFolder={onDeleteFolder}
                  renderArtifact={renderArtifact}
                />
              ))}
            </Box>
          )}
        </Card.Body>
      )}
    </Card.Root>
  );
}
```

**File**: `src/components/shared/CreateFolderModal.tsx`

```typescript
import { useState } from 'react';
import {
  Dialog,
  Portal,
  CloseButton,
  Input,
  Textarea,
  Button,
  VStack,
  HStack,
  Field,
} from '@chakra-ui/react';
import { toaster } from '../ui/toaster';
import { invokeCreateArtifactFolder } from '../../ipc';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  artifactType: string;
  parentFolder?: string;
  onFolderCreated?: () => void;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
  projectPath,
  artifactType,
  parentFolder,
  onFolderCreated,
}: CreateFolderModalProps) {
  const [folderId, setFolderId] = useState('');
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!folderId.trim()) {
      toaster.create({
        type: 'error',
        title: 'Folder ID required',
        description: 'Please enter a folder ID (kebab-case)',
      });
      return;
    }

    setLoading(true);
    try {
      await invokeCreateArtifactFolder(
        projectPath,
        artifactType,
        folderId,
        alias || folderId,
        description,
        parentFolder
      );

      toaster.create({
        type: 'success',
        title: 'Folder created',
        description: `Created folder: ${alias || folderId}`,
      });

      onFolderCreated?.();
      onClose();
      
      // Reset form
      setFolderId('');
      setAlias('');
      setDescription('');
    } catch (error) {
      toaster.create({
        type: 'error',
        title: 'Failed to create folder',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="lg">
            <Dialog.Header>
              <Dialog.Title>Create New Folder</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root>
                  <Field.Label>Folder ID (kebab-case)</Field.Label>
                  <Input
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    placeholder="e.g., ui-components"
                  />
                  <Field.HelperText>
                    Unique identifier for this folder (lowercase, hyphens only)
                  </Field.HelperText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Display Name</Field.Label>
                  <Input
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="e.g., UI Components"
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of folder contents..."
                    rows={3}
                  />
                </Field.Root>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleCreate}
                  loading={loading}
                >
                  Create Folder
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
```

### 5. Frontend: Tab Content Integration

**Example**: `src/components/kits/KitsTabContent.tsx`

```typescript
import { useState, useEffect, useMemo } from 'react';
import { Box, Button, HStack } from '@chakra-ui/react';
import { ArtifactFile, ArtifactFolder } from '../../ipc';
import {
  invokeGetArtifactFolders,
  invokeDeleteArtifactFolder,
  invokeMoveArtifactToFolder,
} from '../../ipc';
import { buildFolderTree, FolderTreeNode } from '../../utils/buildFolderTree';
import FolderCard from '../shared/FolderCard';
import CreateFolderModal from '../shared/CreateFolderModal';
import { toaster } from '../ui/toaster';

interface KitsTabContentProps {
  kits: ArtifactFile[];
  kitsLoading: boolean;
  projectPath: string;
  onReload: () => void;
}

export default function KitsTabContent({
  kits,
  kitsLoading,
  projectPath,
  onReload,
}: KitsTabContentProps) {
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Load folders
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'kits');
        setFolders(loadedFolders);
      } catch (err) {
        console.error('Failed to load folders:', err);
      }
    };

    // Debounce to prevent rapid reloads
    const timeoutId = setTimeout(loadFolders, 100);
    return () => clearTimeout(timeoutId);
  }, [projectPath, kits]); // Reload when kits change

  // Build folder tree
  const folderTree = useMemo(() => {
    const tree = buildFolderTree(folders, kits, 'kits', projectPath);
    return tree.map(node => ({
      ...node,
      isExpanded: expandedFolders.has(node.folder.path),
    }));
  }, [folders, kits, projectPath, expandedFolders]);

  // Get kits not in any folder (root level)
  const rootKits = useMemo(() => {
    const folderPaths = new Set(
      folders.flatMap(f =>
        f.artifacts.map(a => `${projectPath}/.bluekit/kits/${f.path}/${a}`)
      )
    );
    return kits.filter(kit => !folderPaths.has(kit.path));
  }, [kits, folders, projectPath]);

  const handleToggleExpand = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleDeleteFolder = async (folderPath: string) => {
    try {
      await invokeDeleteArtifactFolder(projectPath, 'kits', folderPath);
      toaster.create({
        type: 'success',
        title: 'Folder deleted',
        description: 'Folder contents moved to root',
      });
      // File watcher will trigger reload automatically
    } catch (err) {
      toaster.create({
        type: 'error',
        title: 'Failed to delete folder',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleAddToFolder = async (kitPath: string, folderId: string) => {
    try {
      await invokeMoveArtifactToFolder(kitPath, folderId, 'kits');
      toaster.create({
        type: 'success',
        title: 'Kit moved to folder',
      });
      // File watcher will trigger reload automatically
    } catch (err) {
      toaster.create({
        type: 'error',
        title: 'Failed to move kit',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <Box>
      <HStack mb={4}>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          Create Folder
        </Button>
      </HStack>

      {/* Render folders */}
      {folderTree.map(node => (
        <FolderCard
          key={node.folder.path}
          node={node}
          onToggleExpand={handleToggleExpand}
          onDeleteFolder={handleDeleteFolder}
          renderArtifact={(kit) => (
            <KitCard kit={kit} onAddToFolder={handleAddToFolder} />
          )}
        />
      ))}

      {/* Render root-level kits */}
      {rootKits.map(kit => (
        <KitCard
          key={kit.path}
          kit={kit}
          onAddToFolder={handleAddToFolder}
        />
      ))}

      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectPath={projectPath}
        artifactType="kits"
        onFolderCreated={() => {
          // File watcher will trigger reload
        }}
      />
    </Box>
  );
}
```

## Critical Implementation Notes

### 1. File Watcher Integration

**CRITICAL**: After folder operations (create/delete/move), the file watcher will automatically detect changes and trigger reloads. **DO NOT** call `onReload()` manually - let the watcher handle it.

See: `.bluekit/walkthroughs/fixing-file-move-detection.md` for details on why manual reloads cause flickering.

### 2. Cache Invalidation

The backend's `get_changed_artifacts` command now **always invalidates cache** for changed paths. This ensures moved files are properly detected even when modification time hasn't changed.

### 3. State Management Pattern

```typescript
// CORRECT: Let file watcher trigger reload
await invokeMoveArtifactToFolder(path, folderId, 'kits');
// Watcher detects change → backend emits event → frontend updates

// WRONG: Manual reload causes duplicate updates
await invokeMoveArtifactToFolder(path, folderId, 'kits');
onReload(); // ❌ Don't do this!
```

### 4. Folder Tree Building

Use `useMemo` to build folder tree - **NOT** `useEffect` + `useState`. This prevents extra render cycles:

```typescript
// CORRECT: Direct memoization
const folderTree = useMemo(() => {
  return buildFolderTree(folders, artifacts, type, projectPath);
}, [folders, artifacts, type, projectPath]);

// WRONG: Extra render cycle
const [folderTree, setFolderTree] = useState([]);
useEffect(() => {
  setFolderTree(buildFolderTree(...)); // Triggers extra render
}, [folders, artifacts]);
```

## Applying to Other Artifact Types

To add folder support to any artifact type:

1. **Backend**: Commands already support any `artifact_type` parameter
2. **Frontend IPC**: Reuse existing wrappers, pass different `artifactType`
3. **Tab Content**: Copy pattern from `KitsTabContent.tsx`
4. **Components**: Reuse `FolderCard`, `CreateFolderModal`, etc.

**Example for Diagrams**:

```typescript
// DiagramsTabContent.tsx
const folders = await invokeGetArtifactFolders(projectPath, 'diagrams');
const tree = buildFolderTree(folders, diagrams, 'diagrams', projectPath);
await invokeMoveArtifactToFolder(diagramPath, folderId, 'diagrams');
```

That's it! The entire system is artifact-type agnostic.

## Testing Checklist

- [ ] Create folder → appears in UI
- [ ] Move artifact to folder → appears in folder, removed from root
- [ ] Move artifact out of folder → appears in root, removed from folder
- [ ] Nest folder inside folder → hierarchy displays correctly
- [ ] Delete folder → contents move to root
- [ ] Edit folder metadata → updates reflected in UI
- [ ] File watcher triggers reload after all operations
- [ ] No manual reload calls (no flickering)
- [ ] Config.json files created/updated correctly
- [ ] Multi-level nesting works (folder in folder in folder)

## References

- **Walkthrough**: `.bluekit/walkthroughs/fixing-file-move-detection.md` - Cache invalidation fix
- **File Watcher**: `src-tauri/src/watcher.rs` - Production-grade file watching
- **Incremental Updates**: `src/pages/ProjectDetailPage.tsx` - State merge logic
- **Example Implementation**: `src/components/kits/KitsTabContent.tsx` - Full integration
