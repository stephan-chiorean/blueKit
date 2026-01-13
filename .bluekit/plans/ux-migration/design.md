---
title: UX Migration Implementation Plan - Sidebar Navigation
created: 2025-01-12
purpose: Migrate ProjectDetailPage from tabs to sidebar navigation with file tree explorer
status: planned
---

# UX Migration: Sidebar Navigation Implementation

## Overview

Migrate `ProjectDetailPage` from horizontal tabs to a collapsible sidebar with:
1. **Toolkit** (top): Menu items for structured views (Tasks, Plans, Timeline, Essentials)
2. **Notebook** (bottom): File tree explorer showing all `.bluekit` contents

This preserves the tabs design on `HomePage` while giving project-level navigation an Obsidian-like file explorer experience.

---

## Current Architecture

### HomePage (`src/pages/HomePage.tsx`)
- Horizontal tabs: Projects, Library, Workflows, Tasks
- **No changes needed** - stays as is

### ProjectDetailPage (`src/pages/ProjectDetailPage.tsx`)
- Horizontal tabs: Tasks, Plans, Scrapbook, Diagrams, Docs, Kits, Blueprints, Agents, Timeline
- Content loaded via:
  - `invokeGetProjectArtifacts()` → loads ALL from `.bluekit/`
  - Frontend filters by `frontMatter.type`
- File watching via `invokeWatchProjectArtifacts()`

### Key Components
- `KitsTabContent`, `WalkthroughsTabContent`, `DiagramsTabContent` etc.
- Each has folder support via `FolderCard`, `buildFolderTree()`
- Selection context for multi-select operations

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Header                                                          │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│   SIDEBAR    │              CONTENT AREA                        │
│  (collapsible)                                                  │
│              │                                                   │
│ ┌──────────┐ │                                                   │
│ │ VIEWS    │ │  (renders selected view)                         │
│ │          │ │                                                   │
│ │ ☐ Tasks  │ │  - TasksTabContent                               │
│ │ ☐ Plans  │ │  - PlansTabContent                               │
│ │ ★ Kits   │ │  - KitsTabContent                                │
│ │ ★ Docs   │ │  - WalkthroughsTabContent                        │
│ │ ★ Diagrams│ │  - DiagramsTabContent                            │
│ │ ☐ Timeline│ │  - TimelineTabContent                            │
│ └──────────┘ │  - ResourceViewPage (when file selected)         │
│              │                                                   │
│ ┌──────────┐ │                                                   │
│ │ NOTEBOOK │ │                                                   │
│ │          │ │                                                   │
│ │ + ⊕ 🔍   │ │  (new file, new folder, search)                  │
│ │          │ │                                                   │
│ │ TreeView │ │                                                   │
│ │ ├─ kits  │ │                                                   │
│ │ │  ★ auth│ │                                                   │
│ │ ├─ walk..│ │                                                   │
│ │ │  ★ api │ │                                                   │
│ │ ├─ plans │ │                                                   │
│ │ └─ notes │ │                                                   │
│ └──────────┘ │                                                   │
│              │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

**Views Section** - Flat menu, all at same level:
| Item | Icon | Star | Component |
|------|------|------|-----------|
| Tasks | `LuListTodo` | | `TasksTabContent` |
| Plans | `LuMap` | | `PlansTabContent` |
| Kits | `LuPackage` | ★ | `KitsTabContent` |
| Docs | `AiOutlineFileText` | ★ | `WalkthroughsTabContent` |
| Diagrams | `LuNetwork` | ★ | `DiagramsTabContent` |
| Timeline | `LuGitBranch` | | `TimelineTabContent` |

Stars (★) indicate "essential" artifact types that are also surfaced in the Notebook tree.

---

## Implementation Phases

### Phase 1: Sidebar Component Infrastructure

**Goal**: Create reusable sidebar components without breaking existing functionality.

#### Files to Create

1. **`src/components/sidebar/ProjectSidebar.tsx`**
   - Main sidebar container
   - Collapsible state (default: expanded)
   - Glassmorphism styling to match app theme
   - Props: `isOpen`, `onToggle`, `children`

2. **`src/components/sidebar/SidebarSection.tsx`**
   - Section container with title
   - Props: `title`, `icon`, `children`, `collapsible`

3. **`src/components/sidebar/SidebarMenuItem.tsx`**
   - Menu item with icon, label, optional badge
   - Active state styling
   - Props: `icon`, `label`, `isActive`, `onClick`, `badge?`

#### Implementation Notes
- Use existing `colorMode` context for light/dark styling
- Match glassmorphism from current tabs (`tabsBg`, `tabsBorder` patterns)
- Width: ~250px expanded, ~50px collapsed (icons only)

---

### Phase 2: Views Menu Section

**Goal**: Move current tabs to sidebar menu items in a flat list.

#### Menu Items (Flat Structure)

| Item | Icon | Component |
|------|------|-----------|
| Tasks | `LuListTodo` | `TasksTabContent` |
| Plans | `LuMap` | `PlansTabContent` |
| Kits | `LuPackage` | `KitsTabContent` |
| Docs | `AiOutlineFileText` | `WalkthroughsTabContent` |
| Diagrams | `LuNetwork` | `DiagramsTabContent` |
| Timeline | `LuGitBranch` | `TimelineTabContent` |

All items at same level - no nesting, no submenus. Simple and direct.

#### Refactor Steps

1. Add `activeView` state to `ProjectDetailPage`
   - Replaces `currentTab` but works with sidebar
   - Values: `'tasks' | 'plans' | 'kits' | 'walkthroughs' | 'diagrams' | 'timeline' | 'file'`

2. Render content based on `activeView` instead of `Tabs.Content`

3. Keep existing tab content components unchanged - just change navigation

---

### Phase 3: Notebook File Tree (TreeView)

**Goal**: Implement file explorer showing all `.bluekit` contents.

#### Chakra TreeView Usage (v3.22+)

```tsx
import { TreeView } from '@chakra-ui/react';

// Tree data structure
interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
  type?: 'kit' | 'walkthrough' | 'diagram' | 'agent' | 'plan' | 'file';
  isEssential?: boolean; // starred items
}

<TreeView.Root>
  <TreeView.Tree>
    {nodes.map(node => (
      <TreeView.Branch key={node.id} value={node.id}>
        <TreeView.BranchControl>
          <TreeView.BranchIndicator />
          <TreeView.BranchText>{node.name}</TreeView.BranchText>
        </TreeView.BranchControl>
        <TreeView.BranchContent>
          {/* Recursive children */}
        </TreeView.BranchContent>
      </TreeView.Branch>
    ))}
  </TreeView.Tree>
</TreeView.Root>
```

#### Data Source

**New IPC Command: `get_bluekit_file_tree`**

```rust
// Returns recursive tree of all .bluekit contents
#[tauri::command]
pub async fn get_bluekit_file_tree(project_path: String) -> Result<Vec<FileTreeNode>, String> {
    // Recursively scan .bluekit directory
    // Return tree structure with:
    // - name, path, is_folder
    // - type (detected from path or front matter)
    // - is_essential (in kits/, walkthroughs/, diagrams/)
}
```

**Frontend Type:**
```typescript
interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileTreeNode[];
  artifactType?: 'kit' | 'walkthrough' | 'diagram' | 'agent' | 'blueprint' | 'plan';
  isEssential?: boolean;
  frontMatter?: FrontMatter;
}
```

#### Tree Actions

| Action | Trigger | Handler |
|--------|---------|---------|
| Click file | Click on leaf node | `handleFileClick(node)` → set `activeView: 'file'`, load content |
| Click folder | Click on branch | Toggle expand/collapse |
| Right-click | Context menu | Rename, Delete, Move, Copy path |
| Double-click | Quick open | Same as click file |

---

### Phase 4: File/Folder Creation Controls

**Goal**: Obsidian-like creation buttons at top of tree.

#### UI Elements

```
┌──────────────────────┐
│  NOTEBOOK            │
│  [+📄] [+📁] [🔍]    │  ← Action bar
│                      │
│  ▼ kits              │
│    ★ auth-patterns   │
│  ...                 │
└──────────────────────┘
```

#### Buttons

1. **New File** (`+📄`)
   - Opens dialog: name, type (kit/walkthrough/diagram/note)
   - Creates file in appropriate directory or selected folder
   - Auto-generates front matter based on type

2. **New Folder** (`+📁`)
   - Opens dialog: name
   - Creates folder in selected location or `.bluekit` root

3. **Search** (`🔍`)
   - Filter tree by file name
   - Uses Chakra TreeView's filter functionality

#### Existing Patterns to Reuse

- `CreateFolderDialog` from `src/components/shared/CreateFolderDialog.tsx`
- File creation patterns from MCP server (`bluekit_kit_generateKit`, etc.)
- `invokeCreateArtifactFolder` for folder creation

---

### Phase 5: Essential Items (Star Indicators)

**Goal**: Mark kits/walkthroughs/diagrams with star icons in tree.

#### Detection Logic

```typescript
const isEssential = (path: string): boolean => {
  const essentialFolders = ['kits', 'walkthroughs', 'diagrams'];
  return essentialFolders.some(folder =>
    path.includes(`/.bluekit/${folder}/`) ||
    path.includes(`/.bluekit/${folder}`)
  );
};
```

#### Rendering

```tsx
<TreeView.BranchText>
  <HStack gap={1}>
    {node.isEssential && <Icon as={LuStar} boxSize={3} color="yellow.500" />}
    <Text>{node.name}</Text>
  </HStack>
</TreeView.BranchText>
```

---

### Phase 6: Integration & Polish

**Goal**: Wire everything together, handle edge cases.

#### State Management

```typescript
// ProjectDetailPage state additions
const [sidebarOpen, setSidebarOpen] = useState(true);
const [activeView, setActiveView] = useState<ViewType>('tasks');
const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
```

#### File Selection Flow

```
User clicks file in tree
  → setSelectedFile(node)
  → setActiveView('file')
  → Load content via invokeReadFile(node.path)
  → Render ResourceViewPage with content
```

#### Back Navigation

- Clicking toolkit menu item clears file selection
- "Back" button in ResourceViewPage returns to previous view

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Toggle sidebar |
| `Cmd+N` | New file |
| `Cmd+Shift+N` | New folder |
| `Cmd+P` | Quick file search |

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/components/sidebar/ProjectSidebar.tsx` | Main sidebar container |
| `src/components/sidebar/SidebarSection.tsx` | Section wrapper |
| `src/components/sidebar/SidebarMenuItem.tsx` | Menu item |
| `src/components/sidebar/NotebookTree.tsx` | TreeView file explorer |
| `src/components/sidebar/NotebookToolbar.tsx` | New file/folder buttons |
| `src/ipc/fileTree.ts` | IPC for file tree operations |
| `src-tauri/src/file_tree.rs` | Rust backend for tree scanning |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/ProjectDetailPage.tsx` | Replace tabs with sidebar layout |
| `src-tauri/src/commands.rs` | Add `get_bluekit_file_tree` command |
| `src-tauri/src/main.rs` | Register new command |

### Unchanged Files

- `src/pages/HomePage.tsx` - Keep tabs design
- All `*TabContent.tsx` components - Reused as-is
- `src/components/workstation/*` - Reused for content display

---

## Migration Strategy

### Step 1: Parallel Development
- Build sidebar components alongside existing tabs
- Feature flag: `flags.sidebarNav`
- Toggle between old/new layouts

### Step 2: Gradual Rollout
- Enable for testing with flag
- Keep tabs as fallback
- Gather feedback

### Step 3: Full Migration
- Remove tabs from ProjectDetailPage
- Remove feature flag
- Clean up unused code

---

## Dependencies

- **Chakra UI TreeView** (v3.22+) - Already have v3.30.0 ✓
- **Existing file watching** - `invokeWatchProjectArtifacts` works unchanged
- **Existing content components** - All `*TabContent` components reusable

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| TreeView performance with large trees | Lazy loading via `useTreeView` hook |
| Breaking existing functionality | Feature flag for gradual rollout |
| State complexity | Keep `activeView` + `selectedFile` simple |
| Mobile/small screens | Responsive collapse behavior |

---

## Success Criteria

1. All current tab functionality accessible via sidebar
2. File tree shows complete `.bluekit` structure
3. Starred items clearly visible
4. File/folder creation works
5. No performance regression
6. Smooth collapse/expand animations
7. Keyboard navigation works

---

## Timeline Estimate

| Phase | Scope |
|-------|-------|
| Phase 1 | Sidebar infrastructure - foundation |
| Phase 2 | Toolkit menu - port tabs |
| Phase 3 | Notebook tree - main feature |
| Phase 4 | Creation controls |
| Phase 5 | Star indicators |
| Phase 6 | Polish & integration |

---

## Open Questions

1. **Tree selection mode?**
   - Single select (click to open)
   - vs Multi-select (checkboxes for batch operations)
   - Recommendation: Single select, use existing SelectionContext for batch ops

2. **Collapsed sidebar behavior?**
   - Icons only vs completely hidden
   - Recommendation: Icons only for quick access

3. **Search scope?**
   - Tree only vs full content search
   - Recommendation: Tree first, content search as future enhancement
