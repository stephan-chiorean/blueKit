---
id: sidebar-notebook-exploration
alias: Sidebar & Notebook File Explorer
type: walkthrough
is_base: false
version: 1
tags:
  - sidebar
  - file-tree
  - navigation
description: Understanding how the sidebar and notebook file tree components work together to provide project navigation and file exploration.
complexity: comprehensive
format: architecture
---
# Sidebar & Notebook File Explorer

This walkthrough explains the sidebar navigation system and notebook file tree components that enable browsing `.bluekit` directory contents.

## Component Architecture

The sidebar system consists of five React components that work together, integrated directly into `ProjectDetailPage` using Chakra UI's `Splitter`:

```
ProjectDetailPage (Splitter layout)
└── Splitter.Panel (sidebar panel)
    └── ProjectSidebar (sidebar shell)
        ├── Back button & project selector
        └── SidebarContent (orchestrator)
            ├── SidebarSection (grouping)
            │   └── SidebarMenuItem (navigation items)
            └── NotebookTree (file explorer)
                └── NotebookToolbar (file/folder creation)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/ProjectDetailPage.tsx` | Main page with Splitter layout containing sidebar panel |
| `src/components/sidebar/ProjectSidebar.tsx` | Sidebar shell component that hosts project selector, back button, and SidebarContent |
| `src/components/sidebar/SidebarContent.tsx` | Main content orchestrator, defines ViewType |
| `src/components/sidebar/SidebarSection.tsx` | Collapsible section container with title |
| `src/components/sidebar/SidebarMenuItem.tsx` | Individual navigation item with icon/badge |
| `src/components/sidebar/NotebookTree.tsx` | Recursive file tree for `.bluekit` browsing |
| `src/components/sidebar/NotebookToolbar.tsx` | Actions to create new files/folders |
| `src/ipc/fileTree.ts` | IPC wrappers for Rust file tree commands |

## Data Flow

### 1. View Navigation

The `SidebarContent` component defines available views:

```typescript
// src/components/sidebar/SidebarContent.tsx:20-30
export type ViewType =
    | 'tasks'
    | 'plans'
    | 'kits'
    | 'walkthroughs'
    | 'diagrams'
    | 'timeline'
    | 'scrapbook'
    | 'blueprints'
    | 'agents'
    | 'file'; // When a file is selected in the tree
```

When a user clicks a `SidebarMenuItem`, it triggers `onViewChange(view)` which propagates up to `ProjectDetailPage` to update the active content panel.

### 2. File Tree Loading

The `NotebookTree` component loads the file tree on mount and when `version` prop changes:

```typescript
// src/components/sidebar/NotebookTree.tsx:29-40
useEffect(() => {
    loadTree();
}, [projectPath, version]);

const loadTree = async () => {
    const tree = await invokeGetBlueKitFileTree(projectPath);
    setNodes(tree);
};
```

The `version` prop allows external triggers (like file creation) to refresh the tree.

### 3. Rust Backend Processing

The `get_bluekit_file_tree` command (`src-tauri/src/commands.rs:4794`) recursively scans the `.bluekit` directory:

```rust
fn build_tree(dir: PathBuf, root_path: &PathBuf) -> Result<Vec<FileTreeNode>, String> {
    // For each entry:
    // 1. Skip hidden files (starting with '.')
    // 2. Generate stable ID from relative path
    // 3. For folders: recurse to get children
    // 4. For files: parse front matter to detect artifact type
    // 5. Sort: folders first, then alphabetically
}
```

**Key behaviors:**
- `.md` files: Parses YAML front matter to determine `type` (kit, walkthrough, agent)
- `.mmd`/`.mermaid` files: Automatically marked as diagrams
- `isEssential` flag: Set for kits, walkthroughs, and diagrams (shown with star icon)

### 4. FileTreeNode Structure

```typescript
// src/ipc/fileTree.ts:3-12
export interface FileTreeNode {
    id: string;           // Stable ID like "node-kits-my-kit-md"
    name: string;         // Display name
    path: string;         // Absolute file path
    isFolder: boolean;
    children?: FileTreeNode[];
    artifactType?: string; // 'kit', 'walkthrough', 'diagram', etc.
    isEssential: boolean;  // Whether to highlight with star
    frontMatter?: any;     // Parsed YAML metadata
}
```

## Component Deep Dive

### ProjectDetailPage Sidebar Integration

The sidebar lives in its own `ProjectSidebar` shell, rendered inside the left `Splitter.Panel` of `ProjectDetailPage`. `ProjectSidebar` owns the back button, project selector, scrollable container, and wires `SidebarContent` to parent callbacks (view changes, file select, tree refresh) while clearing resource selections when switching views. This keeps the Splitter layout thin and moves sidebar logic into a dedicated component.

Sidebar panel features:
- Resizable via drag handle (15-40% width range)
- Glassmorphism styling with backdrop blur
- Scrollable content area with custom scrollbar
- Project selector dropdown at the top

### SidebarMenuItem

Interactive navigation item with:
- Active state highlighting
- Hover effects
- Optional badge for counts
- Collapsed mode (icon only with tooltip)

```typescript
// src/components/sidebar/SidebarMenuItem.tsx:29-45
<Box
    onClick={onClick}
    bg={isActive ? activeBg : 'transparent'}
    _hover={{
        bg: isActive ? activeBg : hoverBg,
        color: activeColor,
    }}
    title={collapsed ? label : undefined}
>
```

### NotebookTree - Recursive Rendering

Uses a custom recursive tree component (not Chakra TreeView) for reliability:

```typescript
// src/components/sidebar/NotebookTree.tsx:72-87
function CustomTree({ nodes, onNodeClick, selectedId, level, colorMode }) {
    return (
        <Box pl={level > 0 ? 4 : 0}>
            {nodes.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    level={level}
                    // ...
                />
            ))}
        </Box>
    );
}
```

Each `TreeNode` handles:
- Folder expansion/collapse on click
- File selection on click
- Icon switching (folder open/closed, file)
- Essential item star indicator

### NotebookToolbar

Provides file/folder creation via popovers:

```typescript
// src/components/sidebar/NotebookToolbar.tsx:90-116
const handleCreate = async () => {
    const fullPath = `${basePath}/${name.trim()}`;
    if (type === 'file') {
        let fileName = name.trim();
        if (!fileName.includes('.')) {
            fileName += '.md'; // Default to markdown
        }
        await invokeWriteFile(path, '');
    } else {
        await invokeCreateFolder(fullPath);
    }
    onRefresh(); // Trigger tree reload
};
```

## Feature Flag Integration

Some sections are gated behind feature flags:

```typescript
// src/components/sidebar/SidebarContent.tsx:87-95
{flags.diagrams && (
    <SidebarMenuItem
        icon={LuNetwork}
        label="Diagrams"
        // ...
    />
)}
```

Extensions section (Scrapbook, Blueprints, Agents) only appears if any of these flags are enabled.

## Integration with ProjectDetailPage

The sidebar is integrated in `ProjectDetailPage` using Chakra UI's `Splitter` component (`src/pages/ProjectDetailPage.tsx:797-952`):

```typescript
<Splitter.Root defaultSize={[20, 80]}>
    <Splitter.Panel id="sidebar">
        {/* Back button and project selector */}
        <Box px={3} py={4}>
            {/* Project navigation UI */}
        </Box>
        
        {/* Sidebar Menu Content */}
        <Box flex="1" overflowY="auto" px={2}>
            <SidebarContent
                activeView={activeView}
                onViewChange={(view) => {
                    setActiveView(view);
                    // Clear selections when switching views
                    setViewingResource(null);
                    setResourceContent(null);
                    setResourceType(null);
                    setNotebookFile(null);
                }}
                projectPath={project.path}
                onFileSelect={handleFileSelect}
                selectedFileId={notebookFile?.resource.path || viewingResource?.path}
                fileTreeVersion={fileTreeVersion}
                onTreeRefresh={handleTreeRefresh}
            />
        </Box>
    </Splitter.Panel>
    
    <Splitter.ResizeTrigger id="sidebar:content" />
    
    <Splitter.Panel id="content">
        {renderContent()}
    </Splitter.Panel>
</Splitter.Root>
```

The sidebar is resizable via drag handle, with a default 20/80 split between sidebar and content panels.

## Key Patterns

### State Management
- View state (`activeView`) lives in parent `ProjectDetailPage`
- Tree nodes loaded once per mount/refresh via `version` prop
- Local expansion state for folders in each `TreeNode`

### IPC Communication
- `invokeGetBlueKitFileTree`: Fetches entire tree structure
- `invokeCreateFolder`: Creates new directory
- `invokeWriteFile`: Creates empty file

### Styling Approach
- Uses ColorModeContext for light/dark theming
- Glassmorphism patterns with transparent backgrounds
- Chakra UI v3 components with custom hover/active states

## Extending the Sidebar

To add a new view type:

1. Add to `ViewType` union in `SidebarContent.tsx:20-30`
2. Add corresponding `SidebarMenuItem` in the Views section of `SidebarContent.tsx`
3. Handle the view in `ProjectDetailPage`'s `renderContent()` function (around line 610)
4. If feature-flagged, check `flags.yourFeature` before rendering the menu item

The sidebar width is controlled by the `Splitter` component's `defaultSize` prop and can be adjusted by users via the resize handle.
