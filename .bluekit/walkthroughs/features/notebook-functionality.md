---
id: notebook-functionality
alias: Notebook Functionality Architecture
type: walkthrough
is_base: false
version: 1
tags:
  - notebook
  - file-system
  - editing
description: End-to-end architecture walkthrough of the notebook functionality from file tree loading to document editing with auto-save
complexity: comprehensive
format: architecture
---
# Notebook Functionality Architecture

The Notebook is the central file browsing and editing feature of BlueKit. It provides a hierarchical view of `.bluekit/` directory contents in the sidebar, allowing users to navigate, create, edit, and manage markdown documents with multiple view modes and auto-save capability.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Capabilities](#user-capabilities)
3. [Architecture Layers](#architecture-layers)
4. [Data Flow: Loading the File Tree](#data-flow-loading-the-file-tree)
5. [Data Flow: Selecting a Document](#data-flow-selecting-a-document)
6. [Data Flow: Creating New Files and Folders](#data-flow-creating-new-files-and-folders)
7. [Data Flow: Editing with Auto-Save](#data-flow-editing-with-auto-save)
8. [Data Flow: View Mode Switching](#data-flow-view-mode-switching)
9. [Component Deep Dives](#component-deep-dives)
10. [State Management](#state-management)
11. [Key Patterns](#key-patterns)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ProjectDetailPage                                  │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐│
│  │ ProjectSidebar              │  │ Content Area                            ││
│  │ ┌─────────────────────────┐ │  │ ┌─────────────────────────────────────┐ ││
│  │ │ SidebarContent          │ │  │ │ NoteViewPage                        │ ││
│  │ │ ┌───────────────────┐   │ │  │ │ ┌─────────────────────────────────┐ │ ││
│  │ │ │ Toolkit Section   │   │ │  │ │ │ NoteViewHeader                  │ │ ││
│  │ │ └───────────────────┘   │ │  │ │ │ [←][→] | breadcrumbs | [👁️][</>][✎]│ │ ││
│  │ │ ┌───────────────────┐   │ │  │ │ └─────────────────────────────────┘ │ ││
│  │ │ │ Notebook Section  │   │ │  │ │ ┌─────────────────────────────────┐ │ ││
│  │ │ │ ┌───────────────┐ │   │ │  │ │ │ Content (based on viewMode)     │ │ ││
│  │ │ │ │NotebookToolbar│ │   │ │  │ │ │ - preview: ResourceMarkdownContent │ ││
│  │ │ │ │ [📄+] [📁+]   │ │   │ │  │ │ │ - source: ResourceMarkdownContent  │ ││
│  │ │ │ └───────────────┘ │   │ │  │ │ │ - edit: MarkdownEditor          │ │ ││
│  │ │ │ ┌───────────────┐ │   │ │  │ │ └─────────────────────────────────┘ │ ││
│  │ │ │ │ NotebookTree  │ │   │ │  │ └─────────────────────────────────────┘ ││
│  │ │ │ │ 📁 kits       │ │   │ │  └─────────────────────────────────────────┘│
│  │ │ │ │   📄 my-kit   │ │   │ │                                            │
│  │ │ │ │ 📁 walkthroughs│ │  │ │                                            │
│  │ │ │ └───────────────┘ │   │ │                                            │
│  │ │ └───────────────────┘   │ │                                            │
│  │ └─────────────────────────┘ │                                            │
│  └─────────────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IPC Layer (Tauri)                                  │
│  invokeGetBlueKitFileTree() ──────►  get_bluekit_file_tree (Rust)           │
│  invokeReadFile() ────────────────►  read_file (Rust)                       │
│  invokeWriteFile() ───────────────►  write_file (Rust)                      │
│  invokeCreateFolder() ────────────►  create_folder (Rust)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           File System                                        │
│  project/                                                                    │
│  └── .bluekit/                                                               │
│      ├── kits/                                                               │
│      │   └── my-kit.md                                                       │
│      ├── walkthroughs/                                                       │
│      ├── diagrams/                                                           │
│      └── notes/                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Capabilities

### What Users Can Do

| Capability | Description | Entry Point |
|-----------|-------------|-------------|
| **Browse Files** | Navigate the hierarchical file tree in the sidebar | NotebookTree |
| **Expand/Collapse Folders** | Toggle folder visibility with click | TreeNode.handleClick |
| **Auto-Expand Parents** | Selected file's parents auto-expand | NotebookTree useEffect |
| **Create Files** | Create new .md files, opens immediately in editor with title sync | NotebookToolbar, NotebookContextMenu → handleNewFile |
| **Create Folders** | Create new subfolders with inline rename in tree | NotebookToolbar, NotebookContextMenu → handleNewFolder |
| **Inline Rename Folders** | Rename folders directly in tree (Enter/blur to confirm, Escape to cancel) | TreeNode inline edit mode |
| **Rename** | Rename files and folders via context menu | NotebookContextMenu |
| **Delete** | Remove files and folders | NotebookContextMenu |
| **Copy Paths** | Copy absolute or relative paths | NotebookContextMenu |
| **View Preview** | Rendered markdown with styling | NoteViewPage (viewMode='preview') |
| **View Source** | Raw markdown in code block | NoteViewPage (viewMode='source') |
| **Edit** | Full CodeMirror editor | NoteViewPage (viewMode='edit') |
| **Auto-Save** | Debounced save (1.5s) while editing | useAutoSave hook |
| **Manual Save** | Cmd+S for immediate save | MarkdownEditor onSave |
| **Search** | Cmd+F to search in preview/source | SearchInMarkdown |

---

## Architecture Layers

### Layer 1: React Components (Frontend)

```
ProjectDetailPage.tsx          # Main orchestrator - holds notebookFile state
├── ProjectSidebar.tsx         # Sidebar container with project selector
│   └── SidebarContent.tsx     # Contains toolkit menu + notebook section
│       ├── SidebarSection     # Collapsible section wrapper
│       ├── NotebookToolbar    # Create file/folder buttons
│       └── NotebookTree       # File tree with expand/collapse
│           ├── CustomTree     # Recursive tree renderer
│           ├── TreeNode       # Individual file/folder item
│           └── NotebookContextMenu # Right-click menu
│
└── NoteViewPage.tsx           # Document viewer/editor
    ├── NoteViewHeader         # Breadcrumbs + view mode switcher
    ├── MarkdownEditor         # CodeMirror editor (edit mode)
    ├── ResourceMarkdownContent # Rendered markdown (preview/source)
    └── SearchInMarkdown       # Search overlay
```

### Layer 2: IPC Bridge (TypeScript ↔ Rust)

| TypeScript Function | Rust Command | Purpose |
|--------------------|--------------|---------|
| `invokeGetBlueKitFileTree(projectPath)` | `get_bluekit_file_tree` | Get tree structure of .bluekit/ |
| `invokeReadFile(filePath)` | `read_file` | Read file contents |
| `invokeWriteFile(filePath, content)` | `write_file` | Write/create file |
| `invokeCreateFolder(path)` | `create_folder` | Create directory |
| `invokeRenameArtifactFolder(path, newName)` | `rename_artifact_folder` | Rename folder |
| `invokeDeleteArtifactFolder(path)` | `delete_artifact_folder` | Delete folder |
| `deleteResources(paths)` | `delete_resources` | Delete files |

### Layer 3: Rust Backend (Tauri Commands)

**Location**: `src-tauri/src/commands.rs`

- `get_bluekit_file_tree`: Recursively scans `.bluekit/` and builds `FileTreeNode[]`
- `read_file`: Reads file contents as UTF-8 string
- `write_file`: Writes content to file (creates parent dirs if needed)
- `create_folder`: Creates directory with recursive parent creation

---

## Data Flow: Loading the File Tree

When a project opens, the notebook tree loads all files from `.bluekit/`:

```
┌─────────────────┐     mount/version change     ┌─────────────────────────┐
│  NotebookTree   │ ──────────────────────────►  │ invokeGetBlueKitFileTree│
│  (React)        │                              │ (IPC)                   │
└────────┬────────┘                              └───────────┬─────────────┘
         │                                                   │
         │                                                   ▼
         │                                       ┌─────────────────────────┐
         │                                       │ get_bluekit_file_tree   │
         │                                       │ (Rust)                  │
         │                                       └───────────┬─────────────┘
         │                                                   │
         │                                                   ▼
         │                                       ┌─────────────────────────┐
         │                                       │ File System Scan        │
         │                                       │ .bluekit/               │
         │                                       │ ├── kits/               │
         │                                       │ ├── walkthroughs/       │
         │                                       │ └── diagrams/           │
         │                                       └───────────┬─────────────┘
         │                                                   │
         │ setNodes(tree)                                    │
         │◄──────────────────────────────────────────────────┘
         │         FileTreeNode[]
         ▼
┌─────────────────┐
│  CustomTree     │
│  renders nodes  │
│  recursively    │
└─────────────────┘
```

### Key Code: NotebookTree.loadTree()

```typescript
// src/components/sidebar/NotebookTree.tsx:89-96
const loadTree = async () => {
    try {
        const tree = await invokeGetBlueKitFileTree(projectPath);
        setNodes(tree);
    } catch (error) {
        console.error('Failed to load file tree:', error);
    }
};
```

### Rust Scanner: build_tree()

```rust
// src-tauri/src/commands.rs:4792-4903
pub async fn get_bluekit_file_tree(project_path: String) -> Result<Vec<FileTreeNode>, String> {
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    fn build_tree(dir: PathBuf, root_path: &PathBuf) -> Result<Vec<FileTreeNode>, String> {
        // Recursively build tree, parsing frontMatter for type detection
        // Sorts: folders first, then alphabetically
    }
    
    build_tree(bluekit_path.clone(), &bluekit_path)
}
```

### FileTreeNode Interface

```typescript
// src/ipc/fileTree.ts:3-12
interface FileTreeNode {
    id: string;           // Stable ID based on relative path
    name: string;         // Filename or folder name
    path: string;         // Absolute path
    isFolder: boolean;    // Directory flag
    children?: FileTreeNode[];  // Nested items
    artifactType?: string;      // 'kit', 'walkthrough', 'diagram', 'file'
    isEssential: boolean;       // kits/, walkthroughs/, diagrams/ folders
    frontMatter?: any;          // Parsed YAML front matter
}
```

---

## Data Flow: Selecting a Document

When user clicks a file in the tree:

```
┌─────────────────┐   click on file   ┌─────────────────────────┐
│  TreeNode       │ ────────────────► │ onFileSelect(node)      │
│  (NotebookTree) │                   │ (prop from parent)      │
└─────────────────┘                   └───────────┬─────────────┘
                                                  │
                    ┌─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ProjectDetailPage.handleFileSelect(node)                         │
│ 1. const content = await invokeReadFile(node.path)              │
│ 2. setActiveView('file')                                         │
│ 3. setNotebookFile({ resource, content })                        │
└───────────────────────────────────────────┬─────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ renderContent() detects notebookFile is set                      │
│ └── renders <NoteViewPage resource={...} content={...} />       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Code: handleFileSelect

```typescript
// src/pages/ProjectDetailPage.tsx:552-590
const handleFileSelect = async (node: FileTreeNode) => {
  try {
    const content = await invokeReadFile(node.path);
    const isDiagram = node.path.endsWith('.mmd') || node.path.endsWith('.mermaid');

    setActiveView('file');  // Indicate file view mode

    if (isDiagram) {
      // Diagrams use ResourceViewPage with MermaidDiagramViewer
      setViewingResource({ ... });
      setNotebookFile(null);
    } else {
      // Markdown files render in NoteViewPage
      setNotebookFile({
        resource: {
          name: node.name,
          path: node.path,
          resourceType: (node.artifactType as ResourceType) || 'file',
          frontMatter: node.frontMatter
        },
        content
      });
      setViewingResource(null);
    }
  } catch (e) {
    console.error("Failed to read file", e);
  }
};
```

### Auto-Expand Parents

When a file is selected, its parent folders automatically expand:

```typescript
// src/components/sidebar/NotebookTree.tsx:99-136
const parentFolderPaths = useMemo(() => {
    if (!selectedFileId || nodes.length === 0) return new Set<string>();
    const parentPaths = findParentFolderPaths(nodes, selectedFileId);
    return new Set(parentPaths || []);
}, [selectedFileId, nodes]);

useEffect(() => {
    if (parentFolderPaths.size > 0 && nodes.length > 0) {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            parentFolderPaths.forEach(path => {
                const folderId = findFolderIdByPath(nodes, path);
                if (folderId) next.add(folderId);
            });
            return next;
        });
    }
}, [parentFolderPaths, nodes]);
```

---

## Data Flow: Creating New Files and Folders

The notebook supports Obsidian-style inline creation for both files and folders, with different behaviors optimized for each type.

### New File Flow

When creating a new file (right-click folder → New File):

```
┌─────────────────────┐   right-click folder   ┌──────────────────────────┐
│ NotebookContextMenu │ ────────────────────► │ handleNewFile(folderPath) │
│ "New File"          │                        │ (NotebookTree)            │
└─────────────────────┘                        └───────────┬──────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Create file: invokeWriteFile("folder/Untitled.md", "# Untitled\n\n") │
│ 2. Expand parent folder                                                 │
│ 3. Refresh tree: invokeGetBlueKitFileTree()                             │
│ 4. Find new node                                                        │
└───────────────────┬───────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ onNewFileCreated(newNode) callback                                      │
│ └── ProjectDetailPage.handleNewFileCreated()                          │
└───────────────────┬───────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Set isCreatingNewFileRef.current = true (prevent race conditions)   │
│ 2. Finalize any previous title edit                                    │
│ 3. setIsNewFile(true)                                                   │
│ 4. setTitleEditPath(node.path)  // Visual highlight in tree            │
│ 5. setEditingTitle('Untitled')   // Sync title from editor              │
│ 6. handleFileSelect(node)        // Open in editor immediately         │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ NoteViewPage opens in 'edit' mode                                       │
│ - Editor has focus (user types immediately)                             │
│ - Tree shows visual highlight via titleEditPath                         │
│ - Title syncs bidirectionally: editor ↔ tree                            │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Behaviors**:
- File opens immediately in edit mode with focus
- Tree shows visual highlight (not inline edit input)
- Title editing happens in the editor, synced to tree via `titleEditPath`/`editingTitle`
- User types content and title simultaneously

### New Folder Flow

When creating a new folder (right-click folder → New Folder):

```
┌─────────────────────┐   right-click folder   ┌──────────────────────────┐
│ NotebookContextMenu │ ────────────────────► │ handleNewFolder(folderPath)│
│ "New Folder"        │                        │ (NotebookTree)            │
└─────────────────────┘                        └───────────┬──────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Create folder: invokeCreateFolder("folder/Untitled")                 │
│ 2. Expand parent folder                                                 │
│ 3. Refresh tree: invokeGetBlueKitFileTree()                             │
│ 4. Find new node                                                        │
└───────────────────┬───────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ setInlineEdit({                                                          │
│   nodeId: newNode.id,                                                    │
│   path: newNode.path,                                                     │
│   isNew: true,                                                           │
│   isFolder: true,                                                        │
│   value: 'Untitled'                                                      │
│ })                                                                       │
└───────────────────┬───────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TreeNode renders Input component (isEditing === true)                   │
│ - Input auto-selects text once (hasSelectedTextRef prevents re-selection)│
│ - User types new name                                                    │
└───────────────────┬───────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────────┐   ┌──────────────────────┐
│ Enter or blur    │   │ Escape key            │
│ (complete)        │   │ (cancel)              │
└────────┬─────────┘   └──────────┬───────────┘
         │                         │
         ▼                         ▼
┌──────────────────┐   ┌──────────────────────┐
│ handleInlineEdit │   │ handleInlineEditCancel│
│ Complete()       │   │ ()                    │
│ - Sanitize name  │   │ - Delete folder if    │
│ - Rename folder  │   │   isNew === true      │
│ - Refresh tree   │   │ - Clear inline edit   │
│ - Clear state    │   │   state               │
└──────────────────┘   └──────────────────────┘
```

**Key Behaviors**:
- Folder enters inline edit mode in the tree (not in editor)
- Input auto-selects text once on mount (prevents re-selection on re-renders)
- User types new name directly in tree
- **Enter or blur**: Renames folder, clears edit state
- **Escape**: Cancels and deletes the newly created folder

### Key Code: Inline Edit State

```typescript
// src/components/sidebar/NotebookTree.tsx:32-39
interface InlineEditState {
    nodeId: string | null;    // ID of node being edited
    path: string | null;      // Path of node being edited
    isNew: boolean;           // true if newly created (for cancel deletion)
    isFolder: boolean;        // true for folders, false for files
    value: string;            // Current edit value
}
```

### Key Code: New File Creation

```typescript
// src/components/sidebar/NotebookTree.tsx:209-247
const handleNewFile = async (folderPath: string) => {
    const tempName = 'Untitled.md';
    const filePath = `${folderPath}/${tempName}`;
    
    // Create file with placeholder content
    await invokeWriteFile(filePath, '# Untitled\n\n');
    
    // Expand parent and refresh tree
    const parentNode = findNodeByPath(nodes, folderPath);
    if (parentNode) {
        setExpandedFolders(prev => new Set([...prev, parentNode.id]));
    }
    
    const tree = await invokeGetBlueKitFileTree(projectPath);
    setNodes(tree);
    
    // Notify parent to open in editor
    const newNode = findNodeByPath(tree, filePath);
    if (newNode && onNewFileCreated) {
        onNewFileCreated(newNode);
    }
};
```

### Key Code: New Folder Creation

```typescript
// src/components/sidebar/NotebookTree.tsx:249-286
const handleNewFolder = async (folderPath: string) => {
    const tempName = 'Untitled';
    const newFolderPath = `${folderPath}/${tempName}`;
    
    await invokeCreateFolder(newFolderPath);
    
    // Expand parent and refresh tree
    const parentNode = findNodeByPath(nodes, folderPath);
    if (parentNode) {
        setExpandedFolders(prev => new Set([...prev, parentNode.id]));
    }
    
    const tree = await invokeGetBlueKitFileTree(projectPath);
    setNodes(tree);
    
    // Enter inline edit mode
    const newNode = findNodeByPath(tree, newFolderPath);
    if (newNode) {
        setInlineEdit({
            nodeId: newNode.id,
            path: newNode.path,
            isNew: true,
            isFolder: true,
            value: tempName
        });
    }
};
```

### Key Code: Inline Edit Input (Prevents Re-Selection)

```typescript
// src/components/sidebar/NotebookTree.tsx:726-734
// Track if text has been selected to prevent re-selecting on every render
const hasSelectedTextRef = useRef<boolean>(false);

// Reset selection state when exiting edit mode
useEffect(() => {
    if (!isEditing) {
        hasSelectedTextRef.current = false;
    }
}, [isEditing]);

// Input ref callback - only selects once
ref={(input) => {
    if (input && !hasSelectedTextRef.current) {
        setTimeout(() => {
            input.select();
            hasSelectedTextRef.current = true;
        }, 0);
    }
}}
```

### Key Code: Inline Edit Completion

```typescript
// src/components/sidebar/NotebookTree.tsx:294-359
const handleInlineEditComplete = async () => {
    if (!inlineEdit.nodeId || !inlineEdit.path) return;
    
    const node = findNodeByPath(nodes, inlineEdit.path);
    if (!node) return;
    
    // Sanitize name
    let newName = sanitizeFileName(inlineEdit.value) || 'Untitled';
    
    // Only rename if name changed
    if (node.name !== newName) {
        if (inlineEdit.isFolder) {
            await invokeRenameArtifactFolder(node.path, newName);
        }
        // ... file rename logic
    }
    
    // Clear state and refresh
    setInlineEdit({ nodeId: null, path: null, isNew: false, isFolder: false, value: '' });
    refreshTree();
};
```

### Key Code: Inline Edit Cancellation

```typescript
// src/components/sidebar/NotebookTree.tsx:362-383
const handleInlineEditCancel = async () => {
    if (!inlineEdit.path) return;
    
    // If newly created, delete it
    if (inlineEdit.isNew) {
        if (inlineEdit.isFolder) {
            await invokeDeleteArtifactFolder(inlineEdit.path);
        } else {
            await deleteResources([inlineEdit.path]);
        }
        refreshTree();
    }
    
    // Clear state
    setInlineEdit({ nodeId: null, path: null, isNew: false, isFolder: false, value: '' });
};
```

### Differences: Files vs Folders

| Aspect | New File | New Folder |
|--------|----------|------------|
| **Edit Location** | Editor (CodeMirror) | Tree (inline Input) |
| **Focus** | Editor has focus | Input in tree has focus |
| **Title Sync** | Bidirectional via `titleEditPath`/`editingTitle` | Direct rename in tree |
| **Auto-Select** | N/A (editor handles) | Input selects text once |
| **Cancel Behavior** | File remains (no deletion) | Folder deleted if cancelled |
| **Completion** | User saves in editor | Enter/blur renames folder |

---

## Data Flow: Editing with Auto-Save

The edit mode uses CodeMirror with debounced auto-save:

```
┌─────────────────┐                      ┌─────────────────────────┐
│  MarkdownEditor │  onChange(content)   │  NoteViewPage           │
│  (CodeMirror)   │ ───────────────────► │  handleContentChange()  │
└─────────────────┘                      └───────────┬─────────────┘
                                                     │
                          ┌──────────────────────────┼───────────────────────┐
                          │                          │                       │
                          ▼                          ▼                       ▼
               ┌─────────────────┐      ┌──────────────────┐    ┌────────────────────┐
               │ setContent()    │      │ onContentChange? │    │ save(newContent)   │
               │ (local state)   │      │ (parent callback)│    │ (useAutoSave)      │
               └─────────────────┘      └──────────────────┘    └─────────┬──────────┘
                                                                          │
                                         ┌────────────────────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────────────────────┐
                              │  useAutoSave Hook                    │
                              │  1. setIsDirty(true), status='unsaved'│
                              │  2. Clear existing timeout            │
                              │  3. Set new timeout (1500ms)          │
                              └───────────────────┬─────────────────┘
                                                  │ after 1500ms
                                                  ▼
                              ┌─────────────────────────────────────┐
                              │  performSave(content)                │
                              │  1. Skip if unchanged                │
                              │  2. status='saving'                  │
                              │  3. invokeWriteFile(path, content)   │
                              │  4. status='saved', onSaveSuccess()  │
                              └─────────────────────────────────────┘
```

### Key Code: useAutoSave Hook

```typescript
// src/hooks/useAutoSave.ts:58-151
export function useAutoSave(filePath: string, options: UseAutoSaveOptions = {}): UseAutoSaveResult {
  const { delay = 1000, onSaveSuccess, onSaveError, enabled = true } = options;

  const performSave = useCallback(async (content: string): Promise<void> => {
    if (!enabled) return;
    if (content === lastSavedContentRef.current) {
      setStatus('saved');
      return;
    }
    
    setStatus('saving');
    try {
      await invokeWriteFile(filePath, content);
      lastSavedContentRef.current = content;
      setStatus('saved');
      setLastSaveTime(Date.now());
      onSaveSuccess?.();
    } catch (err) {
      setStatus('error');
      onSaveError?.(err);
    }
  }, [filePath, enabled, onSaveSuccess, onSaveError]);

  const save = useCallback((content: string) => {
    if (!enabled) return;
    setIsDirty(true);
    setStatus('unsaved');
    pendingContentRef.current = content;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      if (pendingContentRef.current !== null) {
        performSave(pendingContentRef.current);
      }
    }, delay);
  }, [delay, enabled, performSave]);

  return { save, saveNow, status, error, isDirty, cancel, lastSaveTime };
}
```

### Parent State Sync (Critical Fix)

The `onContentChange` callback keeps parent state in sync:

```typescript
// src/pages/ProjectDetailPage.tsx:616-626
if (notebookFile) {
  return (
    <NoteViewPage
      resource={notebookFile.resource}
      content={notebookFile.content}
      onContentChange={(newContent) => {
        setNotebookFile(prev => prev ? { ...prev, content: newContent } : null);
      }}
    />
  );
}
```

**Why this matters**: Without this callback, switching view modes would show stale content because `notebookFile.content` (the prop) wouldn't update when the user edits.

---

## Data Flow: View Mode Switching

Three view modes are available:

| Mode | Component | Description |
|------|-----------|-------------|
| `preview` | ResourceMarkdownContent | Rendered markdown with rich formatting |
| `source` | ResourceMarkdownContent | Raw markdown in styled code block |
| `edit` | MarkdownEditor | Full CodeMirror editor |

```
┌─────────────────────────────────────────────────────────────────┐
│  NoteViewHeader                                                  │
│  [👁️ Preview] [</> Source] [✎ Edit]                              │
└───────────────────────────────────────┬─────────────────────────┘
                                        │ onClick
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  onViewModeChange(setViewMode)                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│  │  'preview' │ │  'source'  │ │   'edit'   │                   │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘                   │
│        │              │              │                           │
│        ▼              ▼              ▼                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ viewMode === 'edit' ?                                     │   │
│  │   <MarkdownEditor content={content} onChange={...} />     │   │
│  │ :                                                         │   │
│  │   <ResourceMarkdownContent content={content}              │   │
│  │     viewMode={viewMode} />                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Content Preservation

Content is preserved across view mode switches because:

1. `NoteViewPage` maintains local `content` state
2. When editing, changes flow up via `onContentChange` to parent
3. Parent's `notebookFile.content` stays in sync
4. useEffect syncs `initialContent` prop → local state (but only in non-edit modes)

```typescript
// src/pages/NoteViewPage.tsx:59-63
useEffect(() => {
  if (initialContent !== content && viewMode !== 'edit') {
    setContent(initialContent);
  }
}, [initialContent, viewMode]);
```

---

## Component Deep Dives

### NotebookTree

**Purpose**: Displays hierarchical file tree, handles expand/collapse, context menus, and inline creation/editing

**State**:
- `nodes: FileTreeNode[]` - Tree data
- `expandedFolders: Set<string>` - IDs of expanded folders
- `contextMenu: { isOpen, x, y, node }` - Right-click menu state
- `renameState: { isOpen, node, newName }` - Rename popover state
- `inlineEdit: InlineEditState` - Inline edit state for folders (new folder creation)

**Key Behaviors**:
- Loads tree on mount and when `version` prop changes
- Auto-expands parent folders when `selectedFileId` changes
- Context menu for folders: New File, New Folder, Rename, Delete, Copy Path
- **New File**: Creates file, opens in editor immediately with title sync (`onNewFileCreated` callback)
- **New Folder**: Creates folder, enters inline edit mode in tree (Input component with auto-select)
- **Inline Edit**: Folders can be renamed directly in tree (Enter/blur to confirm, Escape to cancel and delete if new)
- File icons vary by type (folder, markdown, mermaid diagram)
- Supports `titleEditPath`/`editingTitle` props for visual sync when editing file titles in editor

### NoteViewPage

**Purpose**: Displays and edits a single document with view mode switching

**Props**:
- `resource: ResourceFile` - File metadata
- `content: string` - Initial file content
- `editable?: boolean` - Enable edit mode (default: true)
- `onContentChange?: (content) => void` - Sync changes to parent

**State**:
- `viewMode: 'preview' | 'source' | 'edit'`
- `content: string` - Local content state

**Key Behaviors**:
- Switches between MarkdownEditor and ResourceMarkdownContent
- Auto-save enabled only in edit mode
- Cmd+F opens search in preview/source modes
- Glassmorphic styling with backdrop blur

### MarkdownEditor

**Purpose**: CodeMirror-based markdown editor

**Features**:
- Markdown syntax highlighting
- Line numbers (optional)
- History (undo/redo)
- Cmd+S triggers `onSave` callback
- Dynamic theme based on colorMode
- Compartments for runtime reconfiguration

**Ref Methods**:
- `focus()`, `getContent()`, `setContent()`
- `getScrollPosition()`, `setScrollPosition()`
- `getView()` - Access EditorView instance

---

## State Management

### State Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  ProjectDetailPage (OWNER)                                       │
│  ├── notebookFile: { resource, content } | null                 │
│  ├── activeView: ViewType                                        │
│  └── fileTreeVersion: number (triggers tree reload)             │
└───────────────────────────────────────┬─────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────┐
        │                               │                           │
        ▼                               ▼                           ▼
┌───────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│ NotebookTree      │      │ NoteViewPage        │      │ NotebookToolbar     │
│ nodes (local)     │      │ content (local)     │      │ (stateless actions) │
│ expandedFolders   │      │ viewMode            │      │                     │
│ contextMenu       │      │ useAutoSave()       │      │                     │
└───────────────────┘      └─────────────────────┘      └─────────────────────┘
```

### State Update Patterns

1. **File Selection**: `handleFileSelect` → reads file → sets `notebookFile`
2. **Content Edit**: `handleContentChange` → updates local + calls `onContentChange` → updates parent
3. **Tree Refresh**: Increment `fileTreeVersion` → NotebookTree reloads via useEffect
4. **View Clear**: `handleClearResourceView` → sets all resource states to null

---

## Key Patterns

### 1. Controlled Content with Bidirectional Sync

```typescript
// Parent provides initial content, child syncs back changes
<NoteViewPage
  content={notebookFile.content}
  onContentChange={(newContent) => {
    setNotebookFile(prev => prev ? { ...prev, content: newContent } : null);
  }}
/>
```

### 2. Version-Based Refresh

```typescript
// Increment version to trigger reload
const [fileTreeVersion, setFileTreeVersion] = useState(0);

const refreshTree = () => setFileTreeVersion(v => v + 1);

<NotebookTree version={fileTreeVersion} ... />
```

### 3. Debounced Auto-Save

```typescript
// useAutoSave provides debouncing + status tracking
const { save, saveNow, status } = useAutoSave(path, { delay: 1500 });

// On every keystroke
const handleChange = (content) => {
  setContent(content);
  save(content);  // Debounced
};

// On Cmd+S
const handleSave = (content) => saveNow(content);  // Immediate
```

### 4. Conditional View Mode Rendering

```typescript
// Single source of truth for content, different renderers
{viewMode === 'edit' ? (
  <MarkdownEditor content={content} onChange={handleChange} />
) : (
  <ResourceMarkdownContent content={content} viewMode={viewMode} />
)}
```

### 5. IPC Command Wrapper Pattern

```typescript
// TypeScript wrapper with typed promise
export async function invokeGetBlueKitFileTree(projectPath: string): Promise<FileTreeNode[]> {
    return await invoke<FileTreeNode[]>('get_bluekit_file_tree', { projectPath });
}
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/pages/ProjectDetailPage.tsx` | Main orchestrator, holds notebook state |
| `src/pages/NoteViewPage.tsx` | Document viewer/editor |
| `src/components/sidebar/ProjectSidebar.tsx` | Sidebar container |
| `src/components/sidebar/SidebarContent.tsx` | Toolkit menu + notebook section |
| `src/components/sidebar/NotebookTree.tsx` | File tree component |
| `src/components/sidebar/NotebookToolbar.tsx` | Create file/folder buttons |
| `src/components/sidebar/NotebookContextMenu.tsx` | Right-click menu |
| `src/components/workstation/NoteViewHeader.tsx` | Breadcrumbs + view mode toggle |
| `src/components/workstation/ResourceMarkdownContent.tsx` | Markdown renderer |
| `src/components/editor/MarkdownEditor.tsx` | CodeMirror editor |
| `src/hooks/useAutoSave.ts` | Debounced save hook |
| `src/ipc/fileTree.ts` | IPC wrappers for tree operations |
| `src/ipc/files.ts` | IPC wrappers for file I/O |
| `src-tauri/src/commands.rs` | Rust backend commands |
