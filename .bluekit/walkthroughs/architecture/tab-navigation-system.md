---
id: tab-navigation-system
alias: Tab Navigation System
type: walkthrough
is_base: false
version: 1
tags:
  - tabs
  - navigation
  - state-management
description: Deep dive into how browser-style tabs work, including context isolation between library and project views, default tab behavior, and state persistence.
complexity: comprehensive
format: architecture
---
# Tab Navigation System

BlueKit uses a browser-style tab system with **context isolation** - library tabs and project tabs are completely separate, each with their own tab bar and state.

## Architecture Overview

```
TabManager (src/app/TabManager.tsx)
├── TabProvider (context)
│   ├── TabPersistence (auto-save/load)
│   └── TabContent (renders active view)
│       ├── HomeView (library context → renders vault ProjectView)
│       └── ProjectView (project context → renders project content)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/TabContext.tsx` | Core state management, context switching |
| `src/app/TabContent.tsx` | Decides what to render based on active tab |
| `src/app/TabManager.tsx` | Wraps everything, handles persistence |
| `src/views/project/ProjectView.tsx` | Renders tab bar + content for both library and project |

---

## Context Isolation: Library vs Project

Tabs are organized into **contexts**. Each context maintains its own independent set of tabs.

### Context Keys

```typescript
// Library context (the vault/home view)
contextKey = 'library'

// Project context (one per project)
contextKey = `project:${projectId}`
```

### State Structure

```typescript
// TabContext internal state
const [tabsByContext, setTabsByContext] = useState<{
  [contextKey: string]: TabState[]
}>({
  library: [initialTab],  // Library always has at least one tab
});

const [activeContext, setActiveContext] = useState('library');
const [lastActiveTabByContext, setLastActiveTabByContext] = useState<{
  [contextKey: string]: string  // tabId
}>({});
```

### How `tab` is Computed

```typescript
// src/app/TabContext.tsx:161-163
const tabs = useMemo(() => {
  return tabsByContext[activeContext] || [];
}, [tabsByContext, activeContext]);
```

When you switch context, `tabs` recomputes to show only the tabs for that context.

---



## Default Tab Behavior

### When a New Tab is Created

**In Library Context:**
```typescript
// Creates empty "New Tab" with no specific view
{
  type: 'library',
  title: 'New Tab',
  icon: '',
  resource: {}  // No view = renders EmptyTabState
}
```

**In Project Context:**
```typescript
// Creates empty project tab
{
  type: 'project',
  title: 'New Tab',
  icon: '',
  resource: { projectId: '...' }  // No view = renders EmptyTabState
}
```

### Self-Healing & "Reset" Behavior

If a context is reset (e.g., all tabs closed, or first load with no history):

1.  A single "New Tab" is automatically created.
2.  It has NO icon and NO default view.
3.  The UI renders the **Empty Tab State**, offering options to:
    -   Create a new note
    -   Search files
    -   (Library) Go to project

This ensures that a clean slate always results in a friendly, empty starting point rather than forcefully opening a default view like 'File Tree' or 'Projects List'.

### Closing the Last Tab

When you close the last tab in a context, a new default tab (Empty State) is immediately created to replace it.

## Lifecycle Walkthroughs

### 1. Application Startup Sequence

This flow ensures the correct tabs are restored when the app launches, handling both Global Library state and persistent active projects.

1.  **`TabManager` Mounts**: The `TabManager` component initializes `TabContext` and triggers `loadTabs()` once (protected by a ref guard).
2.  **`loadTabs` Execution**:
    *   **Global Load**: Calls `getGlobalTabsPath()` to read the Library's `tabs.json` (e.g. `~/Documents/projects/my-library/.bluekit/workspace/tabs.json`).
    *   **Library Restore**: Parses the file and immediately restores `tabsByContext['library']` and `lastActiveTabByContext['library']`.
    *   **Active Context Check**: Reads the `activeContext` field from the JSON.
    *   **Hybrid State Optimization**:
        *   If `activeContext` is a project (e.g., `project:vacation-planner`), it *first* checks if that project's tab data exists directly inside the Library file.
        *   **Found**: It loads the project tabs directly from the library file.
        *   **Not Found**: It calls `loadContextTabs(activeContext)`, which resolves the project's path and reads its local `tabs.json`.
    *   **Activate**: Finally, `setActiveContext` is called, restoring the user's last session.


### 2. Navigating Back to Library

This flow demonstrates how the simplified "disk as source of truth" architecture works when returning from a project to the library context.

**Scenario:** User is in a project (e.g., `project:1763859627143`) and clicks the back arrow button in the sidebar to return to the library.

#### Flow Overview

**1. User Interaction (ProjectSidebar)**
*   **File**: `src/views/project/ProjectSidebar.tsx:188`
*   **Action**: User clicks the back arrow icon (`LuArrowLeft`)
*   **Code**: The `onClick` handler calls `onBack()`

**2. Event Propagation (ProjectView → TabContent)**
*   **File**: `src/views/project/ProjectView.tsx:1566`
*   **Flow**: ProjectView passes the handler: `onBack={onBack}`
*   **Handler**: This prop comes from `TabContent.tsx:175`

**3. Action Handler (TabContent)**
*   **File**: `src/app/TabContent.tsx:20-23`
*   **Function**: `openLibraryTab`
*   **Logic**:
    ```typescript
    const openLibraryTab = useCallback(() => {
      // Switch to library context (restore last active tab or show empty state)
      openInNewTab({ type: 'library', view: 'projects' }, { title: 'New Tab', restoreContext: true });
    }, [openInNewTab]);
    ```

**4. Context Detection & Disk Read (TabContext)**
*   **File**: `src/app/TabContext.tsx:854-896`
*   **Function**: `openInNewTab`
*   **Logic**:
    1.  Computes `targetContext` from resource: `library` (which is aliased to the vault project ID)
    2.  Compares to `activeContext` (e.g., `project:1763859627143` for the current project)
    3.  Detects **cross-context navigation** (project → library)
    4.  **Reads tabs.json from disk** using `readTabsFromDisk(targetContext)`

**5. Restore or Create (Simplified Logic)**

**The disk is the source of truth:**

```typescript
// src/app/TabContext.tsx:872-896
const targetTabs = await readTabsFromDisk(targetContext);
const contextExists = targetTabs.length > 0;

if (restoreContext && contextExists) {
  // File has tabs → restore user's previous state
  console.log('[TabContext] RESTORE PATH: restoreContext=true && contextExists=true → switching context, IGNORING passed resource.view');
  setTabsByContext(prev => ({ ...prev, [targetContext]: targetTabs }));
  switchContext(targetContext);
  return;
}

// Otherwise, create new tab with passed resource
// (but this path is rarely hit since library always has tabs)
```

**What happens:**
- ✅ Library tabs are **always read from disk** (no in-memory cache)
- ✅ If `tabs.json` exists with tabs → **user's state is restored**
- ✅ The `view: 'projects'` passed in the resource is **ignored** when tabs exist
- ✅ User sees their library exactly as they left it

#### Example Trace

**Before navigation (in blueKit project):**
```json
// Current context: project:1763859627143
// Library tabs.json on disk (at Vault-tec/.bluekit/workspace/tabs.json):
{
  "activeTabId": "tab_40bfe062",
  "contexts": {
    "project:db377353-6ef9-460a-8e4a-6de077bc6983": {
      "activeTabId": "tab_40bfe062",
      "tabs": [
        { "id": "tab_40bfe062", "title": "Projects", "resource": { "view": "projects" } },
        { "id": "tab_f8cc29f5", "title": "New Tab", "resource": { "view": "file" } },
        { "id": "tab_4b55e84e", "title": "New Tab", "resource": { "view": "file" } }
      ]
    }
  }
}
```

**After clicking back arrow:**
```json
// New context: project:db377353-6ef9-460a-8e4a-6de077bc6983 (library/vault)
// Tabs RESTORED from disk:
{
  "activeTabId": "tab_40bfe062",
  "tabs": [
    { "id": "tab_40bfe062", "title": "Projects", "resource": { "view": "projects" } }, // ✅ Restored!
    { "id": "tab_f8cc29f5", "title": "New Tab", "resource": { "view": "file" } },       // ✅ Preserved!
    { "id": "tab_4b55e84e", "title": "New Tab", "resource": { "view": "file" } }        // ✅ Preserved!
  ]
}
```

#### Console Log Trace

When navigating from Project → Library:
```
[TabContent] openLibraryTab called
[TabContext] openInNewTab called { resource: { type: "library", view: "projects" }, restoreContext: true }
[TabContext] Target context: project:db377353-6ef9-460a-8e4a-6de077bc6983 Active: project:1763859627143
[TabContext] readTabsFromDisk: project:db377353-6ef9-460a-8e4a-6de077bc6983
[TabContext] Loaded tabs from disk: { contextKey: "project:db377353-...", tabCount: 3, tabs: [{title: "Projects"}, {title: "New Tab"}, {title: "New Tab"}] }
[TabContext] Context switch needed: { from: "project:1763859627143", to: "project:db377353-...", contextExists: true, targetTabCount: 3 }
[TabContext] RESTORE PATH: restoreContext=true && contextExists=true → switching context, IGNORING passed resource.view
[TabContext] Switching context: { from: "project:1763859627143", to: "project:db377353-..." }
[TabContext] Restoring active tab: tab_40bfe062
```

**Result:** ✅ User sees their library's "Projects" tab (their last state), not a newly created tab with `view: 'projects'`.

#### Key Insights

1. **`restoreContext: true` is honored**: When tabs exist on disk, the passed `view: 'projects'` is completely ignored
2. **Disk is source of truth**: Every context switch reads from disk, ensuring state consistency
3. **No "overwrite" bugs**: Unlike the old implementation, existing tabs are never modified during navigation
4. **Same simplification as Project navigation**: Both directions (Library → Project and Project → Library) use identical logic

---

### 3. Navigating from Library to Project

This flow traces the execution from the UI trigger to the final state update when opening a project from the library.

**Important:** The actual implementation uses `openInCurrentTab`, not `openInNewTab`. This means the target project opens in the current tab/window, replacing the current view.

#### Flow Overview

**1. User Interaction (ProjectsTabContent)**
*   **File**: `src/features/projects/components/ProjectsTabContent.tsx:327`
*   **Action**: User clicks a project card from the library/vault projects list.
*   **Code**: The `onClick` handler calls `onProjectSelect(project)`.

**2. Event Propagation (ProjectView → TabContent)**
*   **File**: `src/views/project/ProjectView.tsx:1334`
*   **Flow**: ProjectView wraps the handler: `onProjectSelect={(p) => onProjectSelect?.(p)}`
*   **Handler**: This prop comes from `TabContent.tsx:176`

**3. Action Handler (TabContent)**
*   **File**: `src/app/TabContent.tsx:43-51`
*   **Function**: `handleProjectSelectCurrentTab` (NOT `handleProjectSelectNewTab`)
*   **Logic**:
    ```typescript
    openInCurrentTab(
      {
        type: 'project',
        projectId: project.id,
        view: project.isVault ? 'projects' : 'file', // Default fallback (only used if no tabs.json)
      },
      { title: project.name, restoreContext: true }
    );
    ```

**4. Context Detection & Disk Read (TabContext)**
*   **File**: `src/app/TabContext.tsx:985`
*   **Function**: `openInCurrentTab`
*   **Logic**:
    1.  Computes `targetContext` from resource: `project:${projectId}`
    2.  Compares to `activeContext` (e.g., `project:db377353-...` for vault)
    3.  Detects **cross-context navigation** (vault → target project)
    4.  **Reads tabs.json from disk** (always, no caching)

**5. Restore or Create (Simplified Logic)**

**The disk is the source of truth:**

```typescript
// src/app/TabContext.tsx:1004-1032
// Always read from disk first
const tabs = await readTabsFromDisk(targetContext);

if (tabs.length > 0) {
  // File has tabs → restore user's previous state
  console.log('[TabContext] Restoring tabs from disk');
  setTabsByContext(prev => ({ ...prev, [targetContext]: tabs }));
  switchContext(targetContext);
} else {
  // No tabs on disk → create default tab
  console.log('[TabContext] No tabs on disk, creating default tab');
  const newTab = createDefaultTab(resource);
  setTabsByContext(prev => ({ ...prev, [targetContext]: [newTab] }));
  switchContext(targetContext);
}
```

**What happens:**
- ✅ Tabs are **always read from disk** (no in-memory cache)
- ✅ If `tabs.json` exists with tabs → **user's state is restored**
- ✅ If `tabs.json` is missing/empty → **default tab is created**
- ✅ No "overwrite first tab" logic
- ✅ `restoreContext` is implicit (always restore if tabs exist)

#### Example Trace

**Before navigation:**
```json
// Vault context: project:db377353-...
// Target project tabs.json on disk:
{
  "activeTabId": "tab_0a978cca",
  "tabs": [
    { "id": "tab_0a978cca", "title": "Kits", "resource": { "view": "kits" } },
    { "id": "tab_6e7f1836", "title": "Agent", "resource": { "view": "file" } }
  ]
}
```

**After clicking project card:**
```json
// New context: project:1763859627143
// Tabs RESTORED from disk:
{
  "activeTabId": "tab_0a978cca",
  "tabs": [
    { "id": "tab_0a978cca", "title": "Kits", "resource": { "view": "kits" } }, // ✅ Preserved!
    { "id": "tab_6e7f1836", "title": "Agent", "resource": { "view": "file" } }
  ]
}
```

#### Console Log Trace

When navigating from Vault → Project:
```
[ProjectsTabContent] Project card clicked { projectId: "1763859627143" }
[TabContent] handleProjectSelectCurrentTab { passedView: "file", restoreContext: true }
[TabContext] openInCurrentTab called { activeContext: "project:db377353-..." }
[TabContext] Target context: project:1763859627143 Active: project:db377353-...
[TabContext] readTabsFromDisk: project:1763859627143
[TabContext] Loaded tabs from disk: { tabCount: 2, tabs: [{title: "Kits"}, {title: "Agent"}] }
[TabContext] Restoring tabs from disk: { contextKey: "project:1763859627143", tabCount: 2 }
[TabContext] Switching context: { from: "project:db377353-...", to: "project:1763859627143" }
[TabContext] Restoring active tab: tab_0a978cca
```

**Result:** ✅ User sees their previous "Kits" view, exactly as they left it.

---

### 3.1. Same-Context Navigation (Edge Case)

If you're already in a project and navigate to a different view within the same project, the current tab is updated in place.

**Scenario:** Already in `project:1763859627143` viewing "Kits", click "Walkthroughs" in the sidebar.

**Flow:**
```typescript
// src/app/TabContext.tsx (openInCurrentTab)
if (targetContext === activeContext) {
  // Same context - update current tab
  updateCurrentTabInContext(resource, options);
}
```

**What happens:**
```typescript
// updateCurrentTabInContext
const updateCurrentTabInContext = (resource, options) => {
  // Overwrites the CURRENT active tab with new resource
  setTabsByContext(prev => ({
    ...prev,
    [activeContext]: prev[activeContext].map(tab => {
      if (tab.id !== activeTabId) return tab;
      return {
        ...tab,
        resource: { projectId, view: 'walkthroughs' }, // ← Updates current tab
        title: options.title,
      };
    }),
  }));
};
```

**Result:**
- The currently active tab is **updated in place** (same tab ID)
- Example: "Kits" tab becomes "Walkthroughs" tab
- This is intentional behavior for in-project navigation

**Console trace:**
```
[TabContext] openInCurrentTab: context check { isSameContext: true }
[TabContext] SAME CONTEXT: updating current tab
[TabContext] updateCurrentTabInContext: OVERWRITING current tab
```

---

### 4. Creating a New Tab (Library vs Project)

The creation flow differs slightly by context but results in a consistent "Empty State".

**Scenario A: In Library Context**
1.  User starts in Library (seeing Projects list).
2.  Clicks "+" or presses `Cmd+T`.
3.  `createTab` is called with `type: 'library'`.
4.  `createDefaultLibraryTab` returns a tab with:
    *   `title`: "New Tab"
    *   `resource`: `{}` (Empty)
    *   `view`: `{}` (Empty)
5.  **Result**: The new tab renders the `<EmptyTabState />` component, giving the user options to search or navigate.

**Scenario B: In Project Context**
1.  User is in a Project.
2.  Clicks "+" or presses `Cmd+T`.
3.  `createTab` is called with `type: 'project'` and `projectId`.
4.  `createDefaultProjectTab` returns a tab with:
    *   `title`: "New Tab"
    *   `resource`: `{ projectId: '...' }` (No specific view)
5.  **Result**: `ProjectView` detects the undefined view and renders `<EmptyTabState />`.

---

## Tab State Persistence

### Storage Model

*   **Library Context**: Stored in the Vault Project's `.bluekit/workspace/tabs.json` (just like any other project).
*   **Project Contexts**: Stored in each project's `.bluekit/workspace/tabs.json`.

### Library = Designated Vault Project

**Terminology:**
- **"Library"** is the current, canonical term for the global knowledge store
- **"Vault"** is a legacy alias that may appear in older code
- The library is architecturally identical to any project but has a special designation

**Implementation:**
*   The library is stored as a project with `is_vault = 1` in the database
*   Its `contextKey` is `project:<LIBRARY_PROJECT_ID>` (e.g., `project:db377353-6ef9-460a-8e4a-6de077bc6983`)
*   Legacy `library` context keys are aliased to the vault project ID during `switchContext()`
*   The "Back" button in a project triggers a switch to the library's context: `project:<LIBRARY_PROJECT_ID>`

### Save Triggers

Tabs auto-save 500ms after any mutation (create, close, navigate, edit). The `saveTabs` function indicates which context is active and saves to the appropriate file.

---

## Tab Type Reference

| Type | Context | Description |
|------|---------|-------------|
| `library` | project:<vault> | Legacy type, resolving to Vault Project view |
| `project` | project:* | Project root view (sidebar sections) |
| `kit` | project:* | Viewing a kit markdown file |
| `walkthrough` | project:* | Viewing a walkthrough |
| `plan` | project:* | Viewing a plan |
| `diagram` | project:* | Viewing a mermaid diagram |
| `file` | project:* | Viewing/editing a notebook file |
| `task` | project:* | Viewing a blueprint task |
| `editor-plans` | any | Claude/Cursor plans editor |

---

## Key Functions Reference

| Function | Location | Purpose |
|----------|----------|---------|
| `switchContext(key)` | TabContext.tsx | Switch between library/project contexts (aliases library -> vault ID), always reads from disk |
| `readTabsFromDisk(contextKey)` | TabContext.tsx | Helper that reads `tabs.json` from disk for a given context (source of truth) |
| `openInNewTab(resource, opts)` | TabContext.tsx | Open resource in new tab, handles context switching |
| `openInCurrentTab(resource, opts)` | TabContext.tsx | Navigate in current tab. Cross-context: reads from disk and restores. Same-context: updates current tab |
| `updateCurrentTabInContext(resource, opts)` | TabContext.tsx | Updates active tab in same context (e.g., sidebar navigation within project) |
| `createTab(resource, opts)` | TabContext.tsx | Create new tab in current context |
| `closeTab(tabId)` | TabContext.tsx | Close tab, create default if last |
| `saveTabs()` | TabContext.tsx | Persist all contexts to disk (debounced 500ms) |
| `loadTabs()` | TabContext.tsx | Restore contexts from disk on app startup |

---

## Architecture Notes: Phase 5.1 Simplification

**Prior to Phase 5.1**, the tab navigation system had a complex in-memory caching layer (`loadedContextsRef`) that tracked which contexts were loaded. This caused critical bugs where the `restoreContext` flag was ignored, and users would lose their previous tab state when navigating between projects.

**Phase 5.1 Fix** (implemented 2026-01-30):
- **Removed**: In-memory context caching (`loadedContextsRef`)
- **Removed**: `restoreContext` option (no longer needed)
- **Simplified**: Always read `tabs.json` from disk (source of truth)
- **Result**: Deterministic behavior - if tabs exist on disk, they're restored; if not, create default

**New Flow:**
```typescript
const tabs = await readTabsFromDisk(targetContext);

if (tabs.length > 0) {
  // File has tabs → restore user's previous state
  setTabsByContext(prev => ({ ...prev, [targetContext]: tabs }));
  switchContext(targetContext);
} else {
  // No tabs on disk → create default
  const newTab = createDefaultTab(resource);
  setTabsByContext(prev => ({ ...prev, [targetContext]: [newTab] }));
  switchContext(targetContext);
}
```

**Benefits:**
- Tab state always matches what's on disk
- No "overwrite first tab" bugs
- ~70 lines of complexity removed
- File reads are ~1-2ms (negligible performance impact)

See `.bluekit/plans/ux-overhaul/phase-5.1-simplify-tab-context.md` for full implementation details.
