---
id: bluekit-ux-component-architecture
alias: BlueKit UX Component Architecture
type: walkthrough
is_base: false
version: 1
tags:
  - architecture
  - react
  - ui-components
description: A comprehensive map of BlueKit's component hierarchy showing how the application's UX flows from onboarding through project views to the notebook system.
complexity: comprehensive
format: architecture
---
# BlueKit UX Component Architecture

A visual and structural map of how BlueKit's UI components connect to create the complete user experience.

## Application Entry Point: App.tsx

**Location**: `src/App.tsx`

The root of BlueKit wraps the entire application in a series of context providers that provide global state:

```tsx
App
├── SupabaseAuthProvider (authentication)
├── GitHubIntegrationProvider (GitHub integration)
├── NotepadProvider (floating notepad)
├── TimerProvider (time tracking)
├── QuickTaskPopoverProvider (quick task creation)
└── WorkstationProvider (current kit content)
    └── AppContent
        ├── ColorModeProvider (light/dark mode)
        ├── FeatureFlagsProvider (feature toggles)
        ├── LibraryCacheProvider (caching)
        ├── ResourceProvider (resource management)
        ├── ProjectArtifactsProvider (artifacts)
        └── SelectionProvider (multi-item selection)
```

### View State Management

`App.tsx:27-34` defines the core view types:
- `'welcome'` - Initial onboarding screen
- `'home'` - Project registry and global actions
- `'project-detail'` - Kit browsing for selected project
- `'plans'` - Editor plans view

### Special Window Modes

BlueKit supports multiple window types (detected via URL path):
- **Main window**: Standard navigation flow (Welcome → Home → Project Detail)
- **Preview window** (`/preview`): Standalone preview for resources
- **Worktree window** (`/worktree`): Git worktree management view

## Navigation Flow

### 1. Welcome Screen → Home → Project Detail

```
WelcomeScreen (src/components/WelcomeScreen.tsx)
    ↓ onGetStarted()
HomePage (src/pages/HomePage.tsx)
    ↓ onProjectSelect(project)
ProjectDetailPage (src/pages/ProjectDetailPage.tsx)
    ↓ onBack()
Back to HomePage
```

### WelcomeScreen Component

**Location**: `src/components/WelcomeScreen.tsx`

The initial onboarding experience that handles authentication and first-time setup:

**Key Features**:
- OAuth sign-in (Google/GitHub) via Supabase
- Skip option (works fully offline)
- Auto-redirect if already authenticated
- BlueKit logo and branding

**Navigation**: After sign-in or skip → `HomePage`

### HomePage Component

**Location**: `src/pages/HomePage.tsx`

The central hub showing all linked projects and global actions:

**Key Features**:
- Project registry list
- Link new projects
- Navigate to editor plans (Claude/Cursor)
- Global search/actions

**Navigation**: Select project → `ProjectDetailPage`

## Project Detail Page: The Portal

**Location**: `src/pages/ProjectDetailPage.tsx`

This is the **main workspace** for interacting with a project. It serves as the portal that coordinates:
- Sidebar navigation
- Toolkit tab contents
- Notebook file viewing/editing
- Resource viewing (kits, walkthroughs, plans, diagrams)

### ProjectDetailPage Architecture

```
ProjectDetailPage
├── State Management (lines 154-200)
│   ├── artifacts (kits, walkthroughs, agents, diagrams)
│   ├── viewingResource (currently viewed resource)
│   ├── notebookFile (currently selected notebook file)
│   ├── plans (project plans)
│   └── folders (artifact organization)
│
├── Real-Time Updates (lines 396-456)
│   ├── File watcher setup
│   ├── Incremental artifact updates
│   └── Event listeners for changes
│
└── Rendering (lines 1047-1256)
    ├── Splitter (sidebar + content)
    ├── ProjectSidebar (navigation)
    └── Content Area (based on activeView)
```

### View Types in ProjectDetailPage

The `activeView` state (line 66) determines what content is shown:

```typescript
type ViewType =
  | 'file'        // Notebook file selected
  | 'tasks'       // Tasks tab
  | 'plans'       // Plans tab
  | 'kits'        // Kits tab
  | 'walkthroughs' // Walkthroughs tab
  | 'diagrams'    // Diagrams tab
  | 'git'         // Git tab
  | 'bookmarks'   // Bookmarks tab
  | 'scrapbook'   // Scrapbook tab
  | 'blueprints'  // Blueprints tab
  | 'agents'      // Agents tab
  | 'projects'    // Projects (Library view)
  | 'workflows';  // Workflows (Library view)
```

### Content Rendering Logic (ProjectDetailPage.tsx:813-1044)

```tsx
const renderContent = () => {
  // Notebook file view
  if (activeView === 'file' && notebookFile) {
    return <NoteViewPage ... />;
  }
  
  // Toolkit tabs
  switch (activeView) {
    case 'tasks': return <TasksTabContent ... />;
    case 'plans': return <PlansTabContent ... />;
    case 'kits': return <KitsTabContent ... />;
    case 'walkthroughs': return <WalkthroughsTabContent ... />;
    case 'diagrams': return <DiagramsTabContent ... />;
    // ... etc
  }
};
```

## Sidebar Structure

**Location**: `src/components/sidebar/ProjectSidebar.tsx`

The sidebar is the main navigation interface for the project view. It coordinates:

```
ProjectSidebar
├── Back button & Project selector (lines 79-192)
├── SidebarContent (navigation menu) (lines 194-216)
└── Library/Projects switcher (lines 218-261)
```

### SidebarContent: The Navigation Menu

**Location**: `src/components/sidebar/SidebarContent.tsx`

This component renders the collapsible menu structure with two main sections:

#### 1. Toolkit Section (lines 113-407)

The primary navigation menu for project artifacts:

```
Toolkit
├── Tasks (LuListTodo)
├── Plans (LuMap)
├── Kits (LuPackage)
├── Walkthroughs (LuBookOpen)
├── Diagrams (LuNetwork) [if enabled]
├── Git (LuGitBranch)
└── Bookmarks (LuBookmark)

Extensions (collapsible, feature-flagged)
├── Scrapbook (LuNotebook)
├── Blueprints (BsStack)
└── Agents (LuBot)
```

**Header Actions** (lines 116-296):
- Customize palette (LuPalette)
- Open GitHub repository (LuGithub)
- Open in editor menu (Cursor/VSCode/Antigravity)

#### 2. Notebook Section (lines 409-482)

File tree navigation for markdown notes:

```
Notebook
├── NotebookToolbar (new file/folder actions)
└── NotebookTree (hierarchical file browser)
```

**Only visible when**:
- Sidebar is expanded (`!collapsed`)
- Project path is available
- File select handler exists

### NotebookTree: File Navigation

**Location**: `src/components/sidebar/NotebookTree.tsx`

A hierarchical file browser for `.bluekit/` markdown files with advanced features:

**Key Features**:
- Recursive folder expansion/collapse
- Drag-and-drop file/folder movement
- Inline file/folder creation (Obsidian-style)
- Real-time title sync during editing
- Context menus for file operations
- Bookmark indicators
- File type icons (diagram vs. markdown)

**File Tree Structure** (loaded via `invokeGetBlueKitFileTree`):
```typescript
interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileTreeNode[];
  frontMatter?: Record<string, any>;
  artifactType?: string;
}
```

**Interaction Flow**:
1. User clicks file in tree
2. `onFileSelect(node)` called
3. ProjectDetailPage loads file content
4. Sets `activeView = 'file'`
5. Renders `NoteViewPage` in content area

## Toolkit Tab Content Components

All tab content components follow a similar structure for consistency. Let's examine the pattern using `KitsTabContent` as the reference.

### KitsTabContent Pattern

**Location**: `src/components/kits/KitsTabContent.tsx`

```
KitsTabContent
├── Header (ToolkitHeader)
├── Groups Section (artifact folders)
│   ├── Heading + "New Group" button
│   ├── ElegantList (folder cards)
│   └── CreateFolderPopover
│
├── Kits Section (root-level kits)
│   ├── Heading + Filter button + count
│   ├── FilterPanel (name + tags)
│   └── ElegantList (kit cards)
│
├── ResourceSelectionBar (multi-select actions)
├── DeleteFolderDialog (confirmation)
└── KitContextMenu (right-click actions)
```

**State Management**:
- `kits`: Array of kit files from parent (ProjectDetailPage)
- `folders`: Loaded from backend via `invokeGetArtifactFolders`
- `nameFilter`, `selectedTags`: Client-side filtering
- `viewingFolder`: When set, shows FolderView instead of main content

**Filtering Logic** (lines 86-117):
```tsx
// Get root-level artifacts (not in folders)
const rootKitsUnfiltered = getRootArtifacts(kits, folders, 'kits', projectPath);

// Extract unique tags
const allTags = Array.from(new Set(rootKitsUnfiltered.flatMap(k => k.frontMatter?.tags)));

// Filter by name and tags
const filteredRootKits = rootKitsUnfiltered.filter(kit => {
  const matchesName = displayName.toLowerCase().includes(nameFilter);
  const matchesTags = selectedTags.some(tag => kit.frontMatter?.tags.includes(tag));
  return matchesName && matchesTags;
});
```

**Folder View Navigation** (lines 298-310):
When a folder is clicked, the component switches to `FolderView`:
```tsx
if (viewingFolder) {
  return (
    <FolderView
      folder={viewingFolder}
      artifacts={getFolderArtifacts(viewingFolder.path)}
      onBack={() => setViewingFolder(null)}
    />
  );
}
```

### Other Tab Content Components

Following the same pattern as `KitsTabContent`:

**WalkthroughsTabContent** (`src/components/walkthroughs/WalkthroughsTabContent.tsx`)
- Displays walkthroughs with same folder/filtering pattern
- Calls `onViewWalkthrough(walkthrough)` → opens WalkthroughWorkspace

**DiagramsTabContent** (`src/components/diagrams/DiagramsTabContent.tsx`)
- Shows `.mmd` and `.mermaid` files
- Calls `onViewDiagram(diagram)` → opens MermaidDiagramViewer

**AgentsTabContent** (`src/components/agents/AgentsTabContent.tsx`)
- Lists agent markdown files with capabilities
- Similar folder organization

**TasksTabContent** (`src/components/tasks/TasksTabContent.tsx`)
- Task list view with project filtering
- Different structure (not artifact-based)

**PlansTabContent** (`src/components/plans/PlansTabContent.tsx`)
- Database-backed plans (not file-based)
- Create/view/delete plan operations

**BlueprintsTabContent** (`src/components/blueprints/BlueprintsTabContent.tsx`)
- Displays blueprints with layer visualization
- Each blueprint has tasks organized in parallel layers

**GitTabContent** (`src/components/commits/GitTabContent.tsx`)
- Git integration and commit history
- Connect to GitHub repositories

**BookmarksTabContent** (`src/components/bookmarks/BookmarksTabContent.tsx`)
- Bookmarked files across project
- Quick navigation to frequently accessed files

## Resource Viewing

When a user clicks on a kit, walkthrough, plan, or other resource, ProjectDetailPage switches to resource view mode.

### ResourceViewPage

**Location**: `src/pages/ResourceViewPage.tsx`

Generic viewer for all resource types with mode-specific rendering:

```tsx
<ResourceViewPage
  resource={viewingResource}
  resourceContent={content}
  resourceType={type}
  viewMode={mode} // 'plan' | 'walkthrough' | undefined
  onBack={handleBackFromResourceView}
/>
```

**Resource Types**:
- `kit`: Markdown content viewer
- `walkthrough`: WalkthroughWorkspace (interactive workspace)
- `plan`: PlanWorkspace (task execution interface)
- `diagram`: MermaidDiagramViewer
- `task`: Blueprint task viewer
- `agent`: Agent definition viewer

### NoteViewPage

**Location**: `src/pages/NoteViewPage.tsx`

Specialized viewer for notebook markdown files (not toolkit artifacts):

**Key Features**:
- Edit/Preview mode toggle
- Title synchronization (H1 extraction)
- Internal link navigation (`[[link]]` syntax)
- Real-time content updates
- Integration with title editing flow

**Used when**: User selects a file from NotebookTree in sidebar

## Component Data Flow

### Complete User Journey Example

```
1. User opens BlueKit
   → App.tsx renders WelcomeScreen

2. User clicks "Get Started"
   → App.tsx sets currentView = 'home'
   → HomePage rendered

3. User clicks project "My App"
   → HomePage calls onProjectSelect(project)
   → App.tsx sets selectedProject + currentView = 'project-detail'
   → ProjectDetailPage rendered

4. ProjectDetailPage loads
   → Calls invokeGetProjectArtifacts (line 291)
   → Sets up file watcher (line 404)
   → Renders ProjectSidebar + content area

5. User clicks "Kits" in sidebar
   → SidebarContent calls onViewChange('kits')
   → ProjectDetailPage sets activeView = 'kits'
   → renderContent() returns <KitsTabContent />

6. User clicks kit in KitsTabContent
   → Calls onViewKit(kit)
   → ProjectDetailPage sets viewingResource + resourceType
   → Renders ResourceViewPage instead of KitsTabContent

7. User clicks "Back" in ResourceViewPage
   → Calls onBack()
   → ProjectDetailPage clears viewingResource
   → Returns to KitsTabContent view
```

### File Watcher Data Flow

```
Backend File Change
   ↓
Rust notify watcher detects change (src-tauri/src/watcher.rs)
   ↓
Emits event: "project-artifacts-changed-{sanitized_path}"
   ↓
Frontend listen() receives event (ProjectDetailPage.tsx:418)
   ↓
Calls updateArtifactsIncremental(changedPaths)
   ↓
Loads only changed files via invokeGetChangedArtifacts
   ↓
Merges into existing artifacts state (transition)
   ↓
React re-renders affected components
   ↓
UI updates with new/changed/deleted artifacts
```

## Key Architectural Patterns

### 1. Portal Pattern

ProjectDetailPage acts as a **portal** coordinating multiple concerns:
- Sidebar navigation state
- Active view rendering
- Resource viewing state
- File watcher lifecycle
- Artifact loading/caching

### 2. Lift State Up

Handlers for creating files/folders in NotebookTree are lifted up to ProjectDetailPage via `onHandlersReady` callback, then passed down to NotebookToolbar in sidebar.

### 3. Optimistic Updates

File move operations use optimistic UI updates:
```tsx
// Immediate UI update
const rollback = handleOptimisticMove(artifactPath, targetFolder);
// Backend operation
try {
  await moveArtifact(...);
  handleConfirmMove(oldPath, newPath);
} catch {
  rollback(); // Revert on error
}
```

### 4. Transition-Based Performance

Non-urgent updates wrapped in `startTransition` to prevent blocking:
```tsx
startTransition(() => {
  setArtifacts(newArtifacts); // Lower priority update
});
```

### 5. Context-Based Global State

All global state managed through React Context providers:
- ColorModeContext: Theme
- FeatureFlagsContext: Feature toggles
- ProjectArtifactsContext: Current project artifacts
- SelectionContext: Multi-item selection
- WorkstationContext: Current kit content

## Component Reusability

### Shared Components

**ToolkitHeader** (`src/components/shared/ToolkitHeader.tsx`)
- Consistent header for all toolkit tabs
- Title + optional subtitle

**ElegantList** (`src/components/shared/ElegantList.tsx`)
- Card-based list for artifacts/folders
- Hover states, actions menu, tags display

**FilterPanel** (`src/components/shared/FilterPanel.tsx`)
- Dropdown panel for name + tag filtering
- Click-outside detection via ref

**FolderView** (`src/components/shared/FolderView.tsx`)
- Generic view for folder contents
- Used by all toolkit tabs

**ResourceSelectionBar** (`src/components/shared/ResourceSelectionBar.tsx`)
- Bottom bar for multi-select actions
- Move to folder, delete, etc.

### Context Menu Components

Each artifact type has a specialized context menu:
- **KitContextMenu**: Open, edit, delete kit
- **FileContextMenu**: Rename, delete, bookmark file
- **DirectoryContextMenu**: New file/folder, rename, delete folder

## File Organization Summary

```
src/
├── App.tsx                          # Root component + providers
├── components/
│   ├── WelcomeScreen.tsx            # Onboarding
│   ├── kits/
│   │   └── KitsTabContent.tsx       # Kits toolkit tab
│   ├── walkthroughs/
│   │   └── WalkthroughsTabContent.tsx # Walkthroughs tab
│   ├── diagrams/
│   │   └── DiagramsTabContent.tsx   # Diagrams tab
│   ├── tasks/
│   │   └── TasksTabContent.tsx      # Tasks tab
│   ├── plans/
│   │   └── PlansTabContent.tsx      # Plans tab
│   ├── agents/
│   │   └── AgentsTabContent.tsx     # Agents tab
│   ├── blueprints/
│   │   └── BlueprintsTabContent.tsx # Blueprints tab
│   ├── commits/
│   │   └── GitTabContent.tsx        # Git tab
│   ├── bookmarks/
│   │   └── BookmarksTabContent.tsx  # Bookmarks tab
│   ├── sidebar/
│   │   ├── ProjectSidebar.tsx       # Sidebar wrapper
│   │   ├── SidebarContent.tsx       # Navigation menu
│   │   ├── NotebookTree.tsx         # File tree
│   │   └── NotebookToolbar.tsx      # File tree actions
│   └── shared/
│       ├── ToolkitHeader.tsx        # Shared header
│       ├── ElegantList.tsx          # Shared list
│       ├── FilterPanel.tsx          # Shared filter
│       ├── FolderView.tsx           # Shared folder view
│       └── ResourceSelectionBar.tsx # Multi-select bar
└── pages/
    ├── HomePage.tsx                 # Project registry
    ├── ProjectDetailPage.tsx        # Main workspace
    ├── ResourceViewPage.tsx         # Generic resource viewer
    └── NoteViewPage.tsx             # Notebook file viewer
```

## Navigation State Matrix

| From State | User Action | To State | Component Change |
|------------|-------------|----------|------------------|
| Welcome | Click "Get Started" | Home | WelcomeScreen → HomePage |
| Home | Select project | Project Detail | HomePage → ProjectDetailPage |
| Project Detail (kits) | Click kit | Resource View | KitsTabContent → ResourceViewPage |
| Resource View | Click "Back" | Project Detail (kits) | ResourceViewPage → KitsTabContent |
| Project Detail | Click sidebar tab | Project Detail (new tab) | Swap TabContent component |
| Project Detail | Select file in tree | Notebook View | TabContent → NoteViewPage |
| Project Detail | Click "Back" | Home | ProjectDetailPage → HomePage |

## Summary

BlueKit's UX architecture is built on a clear hierarchy:

1. **App.tsx**: Global providers and view routing
2. **WelcomeScreen**: Initial onboarding gate
3. **HomePage**: Project selection hub
4. **ProjectDetailPage**: Main workspace portal that coordinates:
   - **ProjectSidebar**: Navigation (SidebarContent + NotebookTree)
   - **Tab Content Components**: Toolkit views (Kits, Walkthroughs, Plans, etc.)
   - **Resource Viewers**: Full-screen views for individual items
   - **Notebook Viewer**: Markdown file editing/viewing

All components communicate through:
- **Props drilling**: Parent → child data flow
- **Callback props**: Child → parent events
- **React Context**: Global state access
- **IPC calls**: Backend data fetching

The architecture prioritizes:
- **Separation of concerns**: Each component has a single responsibility
- **Reusability**: Shared components for common patterns
- **Performance**: Optimistic updates, transitions, memoization
- **Real-time sync**: File watchers keep UI updated
