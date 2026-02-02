---
id: tab-architecture-and-navigation
alias: Tab Architecture and Navigation
type: walkthrough
is_base: false
version: 1
tags:
  - tabs
  - navigation
  - architecture
description: Complete guide to BlueKit's tab system, context isolation, navigation mechanism, and state management
complexity: comprehensive
format: architecture
---
# Tab Architecture and Navigation

BlueKit uses a browser-style tab system with **context isolation** - library tabs and project tabs are completely separate, each with their own independent state that persists to disk.

---

## Core Architecture

### Component Hierarchy

```
TabManager (src/app/TabManager.tsx)
└── TabProvider (src/app/TabContext.tsx)
    ├── Auto-save (500ms debounce)
    ├── Auto-load (on mount)
    └── TabContent (src/app/TabContent.tsx)
        ├── Routes based on activeTab.type
        │
        ├── type='editor-plans' → EditorPlansPage
        │
        ├── type='library' → HomeView (src/views/home/HomeView.tsx)
        │   ├── Loads vault project
        │   ├── Shows LibrarySetupScreen if no vault
        │   └── Renders ProjectView with vault (isVault=true)
        │
        └── type='project' → ProjectView (src/views/project/ProjectView.tsx)
            ├── Renders for regular projects
            └── Also renders for vault when called by HomeView
```

### Key Files

| File | Responsibility |
|------|---------------|
| `TabContext.tsx` | Core state, context switching, disk I/O, tab lifecycle |
| `TabManager.tsx` | Persistence wrapper, auto-save/load lifecycle |
| `TabContent.tsx` | Routes tabs to correct renderer, project registry caching |
| `HomeView.tsx` | Library-specific wrapper, loads vault, handles setup |
| `ProjectView.tsx` | Renders tabs + content for all projects (including vault) |

---

## The Library/Vault Duality

### Understanding Library vs Vault

BlueKit has a **global knowledge base** that goes by two names:

- **"Library"** - User-facing term (current, canonical)
- **"Vault"** - Legacy/internal term (still appears in code)

**Key insight:** The library is architecturally identical to any project, just with special designation (`is_vault = 1` in database).

### How Library is Represented

Library appears in **two different forms** depending on context:

#### 1. As a Tab Type (`type: 'library'`)

When you create a default library tab:

```typescript
function createDefaultLibraryTab(): TabState {
  return {
    id: createTabId(),
    type: "library",  // ← Tab type
    title: "New Tab",
    resource: {},
    // ...
  };
}
```

**Rendering path:**
```
TabContent checks activeTab.type
  ↓
type === 'library' → render HomeView
  ↓
HomeView loads vault project
  ↓
HomeView renders ProjectView with vault
```

#### 2. As a Context Key (`contextKey: 'library'`)

When you navigate to library:

```typescript
switchContext('library')
  ↓
Alias resolution: 'library' → 'project:<vault-id>'
  ↓
Actual contextKey stored: 'project:db377353-6ef9-460a-8e4a-6de077bc6983'
```

**Example tabs.json:**
```json
{
  "activeContext": "project:db377353-6ef9-460a-8e4a-6de077bc6983",
  "contexts": {
    "project:db377353-6ef9-460a-8e4a-6de077bc6983": {
      "activeTabId": "tab_123",
      "tabs": [
        {
          "id": "tab_123",
          "type": "library",  // ← Tab type (triggers HomeView rendering)
          "resource": { "view": "projects" }
        }
      ]
    }
  }
}
```

**Why both?**
- **Context key** determines which `tabs.json` to read/write (vault's project directory)
- **Tab type** determines how to render the tab (HomeView wrapper vs direct ProjectView)

### Library Navigation Flow: Complete Picture

**User Action:** Click back arrow from any project → Navigate to Library

**Step 1: Context Switching**
```typescript
// TabContent.tsx:19-22
const openLibraryTab = useCallback(() => {
  switchContext('library');  // ← 'library' is the contextKey
}, [switchContext]);
```

**Step 2: Context Aliasing**
```typescript
// TabContext.tsx:480 (switchContext)
let targetContext = contextKey;
if (contextKey === 'library') {
  const vaultId = await ensureVaultId();
  // vaultId = 'db377353-6ef9-460a-8e4a-6de077bc6983'

  targetContext = `project:${vaultId}`;
  // targetContext = 'project:db377353-6ef9-460a-8e4a-6de077bc6983'
}
```

**Step 3: Read Tabs from Disk**
```typescript
// Reads from: <vault-path>/.bluekit/workspace/tabs.json
const contextTabs = await readTabsFromDisk(targetContext);

// Example loaded tabs:
// [
//   { id: 'tab_123', type: 'library', resource: { view: 'projects' } },
//   { id: 'tab_456', type: 'library', resource: { view: 'workflows' } }
// ]
```

**Step 4: Set Active Context**
```typescript
setActiveContext('project:db377353-6ef9-460a-8e4a-6de077bc6983');
setActiveTab('tab_123');
```

**Step 5: Render Active Tab**
```typescript
// TabContent.tsx:135-138
const activeTab = tabs.find(t => t.id === activeTabId);
// activeTab.type = 'library'

if (activeTab.type === 'library') {
  return <HomeView onProjectSelect={handleProjectSelectNewTab} />;
}
```

**Step 6: HomeView Loads Vault**
```typescript
// HomeView.tsx:16-26
const loadVaultProject = async () => {
  const project = await invokeGetVaultProject();
  // project = { id: 'db377353-...', name: 'Vault', path: '/Users/you/Vault', is_vault: 1 }
  setVaultProject(project);
};
```

**Step 7: HomeView Renders ProjectView**
```typescript
// HomeView.tsx:47-61
return (
  <ProjectView
    project={vaultProject}
    onBack={() => {}} // No-op for vault
    isVault={true}
    onProjectSelect={onProjectSelect}
  />
);
```

**Result:** User sees vault's ProjectView with all their library content (projects list, workflows, etc.)

---

## Context Isolation

### What is a Context?

A **context** is an isolated workspace with its own set of tabs. Think of it like browser windows - each has independent tabs that don't affect each other.

**Context Keys (Internal):**
```typescript
// Library context (aliased)
contextKey = 'library'  // user-facing
           → 'project:<vault-id>'  // actual storage key

// Project contexts
contextKey = 'project:<project-id>'
```

**Important:** The context key determines:
1. Which `tabs.json` file to read/write
2. Which tabs appear in the tab bar
3. Isolation boundary (library tabs ≠ project tabs)

### State Structure

```typescript
// TabContext internal state
const [tabsByContext, setTabsByContext] = useState<{
  [contextKey: string]: TabState[]
}>({});

const [activeContext, setActiveContext] = useState('library');

const [lastActiveTabByContext, setLastActiveTabByContext] = useState<{
  [contextKey: string]: string  // tabId
}>({});
```

**Key insight:** The `tabs` array exposed by `useTabContext()` is computed dynamically:

```typescript
const tabs = useMemo(() => {
  return tabsByContext[activeContext] || [];
}, [tabsByContext, activeContext]);
```

When you switch contexts, `tabs` automatically switches to show only that context's tabs.

### Tab Rendering Decision Tree

How TabContent decides what to render:

```
TabContent receives activeTab
  ↓
Check activeTab.type
  │
  ├─ type === 'editor-plans'
  │   └─ Render EditorPlansPage
  │
  ├─ type === 'library'
  │   └─ Render HomeView
  │       ├─ Load vault project from DB
  │       ├─ If no vault → LibrarySetupScreen
  │       └─ If vault exists → ProjectView (isVault=true)
  │
  └─ type === 'project' (or any other type)
      ├─ Load project from registry cache
      ├─ If loading → "Loading project..."
      ├─ If error → Error screen with "Go to Library"
      └─ If loaded → ProjectView (isVault=false)
```

**Why HomeView wrapper for library?**

The wrapper provides:
1. **Vault loading logic** - Fetches vault project from database
2. **Setup screen** - Shows LibrarySetupScreen if no vault configured
3. **Isolation** - Keeps vault-specific logic separate from ProjectView

**Alternative architecture not used:** Library tabs could have `type: 'project'` with vault's projectId directly, skipping HomeView. Current design keeps library conceptually distinct.

---

## File Locations & Persistence

### Where Tabs Are Stored

Each context has its own `tabs.json` file in the project's workspace directory:

| Context | File Location | Example |
|---------|--------------|---------|
| **Library (Vault)** | `<vault-path>/.bluekit/workspace/tabs.json` | `/Users/you/Documents/Vault/.bluekit/workspace/tabs.json` |
| **Project** | `<project-path>/.bluekit/workspace/tabs.json` | `/Users/you/code/myapp/.bluekit/workspace/tabs.json` |

### File Format

```json
{
  "schemaVersion": "bluekit.tabs.v2",
  "updatedAt": "2026-01-31T15:30:00.000Z",
  "activeContext": "project:1763859627143",
  "contexts": {
    "project:1763859627143": {
      "activeTabId": "tab_c7d9e2f1",
      "tabs": [
        {
          "id": "tab_a1b2c3d4",
          "type": "project",
          "title": "Projects",
          "icon": "folder",
          "resource": {
            "projectId": "1763859627143",
            "view": "projects"
          },
          "view": {},
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-31T15:10:00.000Z"
        }
      ]
    }
  }
}
```

**Important fields:**
- `activeTabId` - Which tab was last active in this context
- `tabs[]` - Array of all tabs in this context
- `resource` - What the tab is displaying (view, file path, etc.)

### Save & Load

**Auto-save:** Triggered 500ms after any tab mutation (create, close, navigate)

```typescript
// TabManager.tsx - Auto-save effect
useEffect(() => {
  const timer = setTimeout(() => {
    saveTabs();
  }, 500);
  return () => clearTimeout(timer);
}, [tabs, activeTabId, saveTabs]);
```

**Auto-load:** Called once on app mount

```typescript
// TabManager.tsx - Auto-load effect
useEffect(() => {
  if (!hasLoadedRef.current) {
    loadTabs();
    hasLoadedRef.current = true;
  }
}, [loadTabs]);
```

---

## Navigation Mechanism

### The Golden Rule: Disk is Source of Truth

Since Phase 6, the navigation architecture follows one principle:

**When switching contexts, ALWAYS read from disk. The file tells you what tabs exist and which one was active.**

No caching, no decision flags, no complex branching. Just read the file and use it.

### Core Navigation Function: `switchContext`

**Location:** `src/app/TabContext.tsx:480`

```typescript
const switchContext = useCallback(
  async (contextKey: string) => {
    // 1. Alias 'library' to the vault project ID
    let targetContext = contextKey;
    if (contextKey === 'library') {
      const vaultId = await ensureVaultId();
      if (vaultId) {
        targetContext = `project:${vaultId}`;
      }
    }

    // 2. Read tabs from disk (source of truth)
    let contextTabs = await readTabsFromDisk(targetContext);

    // 3. Restore tabs or create default
    if (contextTabs.length > 0) {
      setTabsByContext((prev) => ({ ...prev, [targetContext]: contextTabs }));
    } else {
      // No tabs on disk - create default empty tab
      const defaultTab = createDefaultTab(targetContext);
      contextTabs = [defaultTab];
      setTabsByContext((prev) => ({ ...prev, [targetContext]: contextTabs }));
    }

    // 4. Switch to the context
    setActiveContext(targetContext);

    // 5. Restore last active tab
    const lastActiveTab = lastActiveTabByContext[targetContext];
    const tabToActivate =
      lastActiveTab && contextTabs.some((t) => t.id === lastActiveTab)
        ? lastActiveTab
        : contextTabs[0]?.id;

    if (tabToActivate) {
      setActiveTab(tabToActivate, targetContext);
    }

    return { contextKey: targetContext, tabs: contextTabs };
  },
  [readTabsFromDisk, lastActiveTabByContext, setActiveTab, ensureVaultId]
);
```

**What it does:**
1. Resolves library alias to vault project ID
2. Reads `tabs.json` from disk
3. Restores tabs to state (or creates default if empty)
4. Switches active context
5. Activates the last active tab (or first tab as fallback)

### Helper: `readTabsFromDisk`

**Location:** `src/app/TabContext.tsx:432`

```typescript
const readTabsFromDisk = useCallback(
  async (contextKey: string): Promise<TabState[]> => {
    // Determine file path based on context
    let filePath: string | null = null;
    if (contextKey === "library") {
      filePath = await getGlobalTabsPath();
    } else if (contextKey.startsWith("project:")) {
      const projectId = contextKey.replace("project:", "");
      filePath = await getProjectTabsPath(projectId);
    }

    if (!filePath) return [];

    try {
      const content = await invokeReadFile(filePath);
      const data = JSON.parse(content);
      const tabs = data.contexts?.[contextKey]?.tabs || [];

      return tabs.map((tab: TabState) => ({
        ...tab,
        resource: tab.resource ?? {},
        view: tab.view ?? {},
      }));
    } catch (error) {
      // File doesn't exist or is invalid - return empty
      return [];
    }
  },
  [getGlobalTabsPath, getProjectTabsPath]
);
```

**⚠️ Known Issue:** This function reads the `tabs` array but **does NOT extract the `activeTabId`** from the file. This causes `switchContext` to rely on in-memory `lastActiveTabByContext` state, which can be stale.

**Expected behavior:** Should return `{ tabs, activeTabId }` and update `lastActiveTabByContext` with the persisted value.

---

## Navigation Flows

### Flow 1: Navigate to Library

**Trigger:** User clicks back arrow in project sidebar

**Code Path:**
```
ProjectSidebar.tsx:188 (onClick)
  ↓
ProjectView.tsx:1566 (onBack prop)
  ↓
TabContent.tsx:20 (openLibraryTab)
  ↓
TabContext.tsx (switchContext('library'))
```

**Implementation:**

```typescript
// TabContent.tsx:19-22
const openLibraryTab = useCallback(() => {
  // Switch to library context - loads tabs from disk
  switchContext('library');
}, [switchContext]);
```

**What happens:**
1. `switchContext` resolves `'library'` → `'project:<vault-id>'`
2. Reads vault's `tabs.json` from disk
3. Restores all tabs from the file
4. Activates the last active tab (or first tab)
5. User sees their library exactly as they left it

**Example:**

Before navigation (in project):
```json
// Current: project:1763859627143
```

After navigation (to library):
```json
// Current: project:db377353-6ef9-460a-8e4a-6de077bc6983 (vault)
// Tabs loaded from: /Users/you/Vault/.bluekit/workspace/tabs.json
// Shows: ["Projects", "Workflows", "Kits"] tabs (from disk)
```

### Flow 2: Navigate to Project

**Trigger:** User clicks a project card from library

**Code Path:**
```
ProjectsTabContent.tsx:327 (onClick)
  ↓
ProjectView.tsx:1334 (onProjectSelect)
  ↓
TabContent.tsx:42 (handleProjectSelectCurrentTab)
  ↓
TabContext.tsx (openInCurrentTab)
  ↓
TabContext.tsx (switchContext)
```

**Implementation:**

```typescript
// TabContent.tsx:42-51
const handleProjectSelectCurrentTab = useCallback((project: Project) => {
  openInCurrentTab(
    {
      type: 'project',
      projectId: project.id,
      view: project.isVault ? 'projects' : 'file',
    },
    { title: project.name }
  );
}, [openInCurrentTab]);
```

```typescript
// TabContext.tsx:931-970 (openInCurrentTab)
const openInCurrentTab = useCallback(
  async (resource: TabResourceInput, options?: TabCreateOptions) => {
    const targetContext = getContextKey(resource);
    
    if (targetContext !== activeContext) {
      // Cross-context: switch and load from disk
      await switchContext(targetContext);
    } else {
      // Same context: update current tab
      updateCurrentTabInContext(resource, options);
    }
  },
  [activeContext, getContextKey, switchContext, updateCurrentTabInContext]
);
```

**What happens:**
1. Determines target context: `project:<project-id>`
2. Detects cross-context navigation (library → project)
3. Calls `switchContext(targetContext)`
4. Reads project's `tabs.json` from disk
5. Restores all tabs or creates default if file doesn't exist
6. User sees their project as they left it

**Example:**

Before navigation (in library):
```json
// Current: project:db377353-... (vault)
```

After navigation (to blueKit project):
```json
// Current: project:1763859627143
// Tabs loaded from: /Users/you/code/blueKit/.bluekit/workspace/tabs.json
// Shows: ["Kits", "Walkthroughs"] tabs (from disk)
```

### Flow 3: Same-Context Navigation

**Trigger:** User clicks a sidebar section while already in the project

**Example:** In blueKit project viewing "Kits" → click "Walkthroughs"

**Code Path:**
```
SidebarContent.tsx (onViewChange)
  ↓
ProjectView.tsx (handleViewChange)
  ↓
TabContext.tsx (openInCurrentTab)
  ↓
TabContext.tsx (updateCurrentTabInContext)
```

**What happens:**

```typescript
// TabContext.tsx:839-875 (updateCurrentTabInContext)
const updateCurrentTabInContext = useCallback(
  (resource: TabResourceInput, options?: TabCreateOptions) => {
    const { type, ...resourceData } = resource;
    
    // OVERWRITE current tab with new resource
    setTabsByContext((prev) => ({
      ...prev,
      [activeContext]: (prev[activeContext] || []).map((tab) => {
        if (tab.id !== activeTabId) return tab;
        return {
          ...tab,
          type,
          title: options?.title ?? getDefaultTitle(resource),
          resource: resourceData,
        };
      }),
    }));
  },
  [activeContext, activeTabId]
);
```

**Result:** Current tab is **updated in place** (same tab ID, new content)

**Example:**
- Tab "Kits" (id: `tab_123`) → becomes "Walkthroughs" (id: `tab_123`)
- No new tab created
- This is intentional for in-project navigation

---

## Complete Navigation Map: Library ↔ Projects

### Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  LIBRARY (Vault Project)                                        │
│  Context: project:db377353-6ef9-460a-8e4a-6de077bc6983         │
│  File: /Users/you/Vault/.bluekit/workspace/tabs.json           │
│                                                                 │
│  Tabs (type='library'):                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                    │
│  │ Projects  │ │ Workflows │ │   Kits    │                    │
│  └───────────┘ └───────────┘ └───────────┘                    │
│                                                                 │
│  Rendered by: HomeView → ProjectView (isVault=true)            │
│                                                                 │
│  Content: Projects list, global workflows, etc.                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Click project card (openInCurrentTab)
                          │ → switchContext('project:1763859627143')
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  PROJECT (blueKit)                                              │
│  Context: project:1763859627143                                 │
│  File: /Users/you/code/blueKit/.bluekit/workspace/tabs.json    │
│                                                                 │
│  Tabs (type='project'):                                         │
│  ┌───────────┐ ┌────────────────┐ ┌──────────┐                │
│  │   Kits    │ │ Walkthroughs   │ │  Plans   │                │
│  └───────────┘ └────────────────┘ └──────────┘                │
│                                                                 │
│  Rendered by: ProjectView (isVault=false)                      │
│                                                                 │
│  Content: Project-specific kits, walkthroughs, etc.            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Click back arrow (openLibraryTab)
                          │ → switchContext('library')
                          │ → Alias to project:db377353-...
                          ↓
                    (Back to Library)
```

### State Transitions

#### Library → Project

**Before:**
```javascript
{
  activeContext: 'project:db377353-6ef9-460a-8e4a-6de077bc6983',  // Vault
  activeTabId: 'tab_vault_1',
  tabsByContext: {
    'project:db377353-6ef9-460a-8e4a-6de077bc6983': [
      { id: 'tab_vault_1', type: 'library', resource: { view: 'projects' } },
      { id: 'tab_vault_2', type: 'library', resource: { view: 'workflows' } }
    ]
  }
}
```

**User clicks:** blueKit project card

**After:**
```javascript
{
  activeContext: 'project:1763859627143',  // blueKit project
  activeTabId: 'tab_proj_1',
  tabsByContext: {
    'project:db377353-6ef9-460a-8e4a-6de077bc6983': [
      // Library tabs preserved in state
      { id: 'tab_vault_1', type: 'library', resource: { view: 'projects' } },
      { id: 'tab_vault_2', type: 'library', resource: { view: 'workflows' } }
    ],
    'project:1763859627143': [
      // Project tabs loaded from disk
      { id: 'tab_proj_1', type: 'project', resource: { projectId: '1763859627143', view: 'kits' } },
      { id: 'tab_proj_2', type: 'project', resource: { projectId: '1763859627143', view: 'walkthroughs' } }
    ]
  }
}
```

**What changed:**
- `activeContext` switched from vault to project
- `activeTabId` switched to project's last active tab
- Project tabs loaded from `blueKit/.bluekit/workspace/tabs.json`
- Library tabs remain in memory (not unloaded)

#### Project → Library

**Before:**
```javascript
{
  activeContext: 'project:1763859627143',  // blueKit project
  activeTabId: 'tab_proj_1',
  tabsByContext: {
    'project:db377353-6ef9-460a-8e4a-6de077bc6983': [
      // Library tabs (already in memory from before)
      { id: 'tab_vault_1', type: 'library', resource: { view: 'projects' } }
    ],
    'project:1763859627143': [
      { id: 'tab_proj_1', type: 'project', resource: { projectId: '1763859627143', view: 'kits' } }
    ]
  }
}
```

**User clicks:** Back arrow

**After:**
```javascript
{
  activeContext: 'project:db377353-6ef9-460a-8e4a-6de077bc6983',  // Vault
  activeTabId: 'tab_vault_1',
  tabsByContext: {
    'project:db377353-6ef9-460a-8e4a-6de077bc6983': [
      // Library tabs RE-READ from disk (source of truth)
      { id: 'tab_vault_1', type: 'library', resource: { view: 'projects' } },
      { id: 'tab_vault_2', type: 'library', resource: { view: 'workflows' } }
    ],
    'project:1763859627143': [
      // Project tabs preserved in state
      { id: 'tab_proj_1', type: 'project', resource: { projectId: '1763859627143', view: 'kits' } }
    ]
  }
}
```

**What changed:**
- `activeContext` switched back to vault
- Library tabs **re-read from disk** (even though already in memory)
- `activeTabId` restored from `lastActiveTabByContext` or file's `activeTabId`
- Project tabs remain in memory

**Key insight:** Even though library tabs were in memory, `switchContext` **always reads from disk** to ensure consistency.

### Cross-Session Persistence

**Session 1:**
```
User in Library → navigates to blueKit → edits kits → closes app
```

**What's saved:**
```
Vault tabs.json:
  activeContext: 'project:db377353-...'
  contexts['project:db377353-...'].activeTabId: 'tab_vault_1'

blueKit tabs.json:
  activeContext: 'project:1763859627143'
  contexts['project:1763859627143'].activeTabId: 'tab_proj_2'
```

**Session 2:**
```
App starts → loadTabs() → reads vault tabs.json
  → activeContext = 'project:1763859627143' (last context from vault file)
  → Loads both vault tabs AND blueKit tabs
  → User sees blueKit project, exactly where they left off
```

**Session 2 continued:**
```
User clicks back → switchContext('library')
  → Re-reads vault tabs.json
  → Activates 'tab_vault_1' (Projects view)
  → User sees library, exactly as they left it
```

---

## Opening New Tabs

### Flow 4: New Tab in Same Context

**Trigger:** User presses `Cmd+T` or clicks "+" button

**What happens:**

```typescript
// TabContext.tsx:877-929 (openInNewTab)
const openInNewTab = useCallback(
  async (resource: TabResourceInput, options?: TabCreateOptions) => {
    const targetContext = getContextKey(resource);
    const forceNew = options?.forceNew ?? false;

    if (targetContext !== activeContext) {
      // Different context - switch first
      const switchResult = await switchContext(targetContext);
    }

    if (!forceNew) {
      // Check if tab already exists
      const matchKey = getMatchKey(resource.type, resource);
      const existingTab = contextTabs.find(
        (tab) => getMatchKey(tab.type, tab.resource) === matchKey
      );

      if (existingTab) {
        // Tab exists - just activate it
        setActiveTab(existingTab.id, targetContext);
        return;
      }
    }

    // Create new tab
    createTab(resource, options, targetContext);
  },
  [activeContext, createTab, switchContext, tabsByContext]
);
```

**Deduplication:** Before creating a new tab, checks if a matching tab already exists (same resource). If yes, activates existing tab instead of creating duplicate.

**Match keys** (used for deduplication):
- Library: `"library"`
- Project view: `"project:<id>:<view>"`
- Kit: `"kit:<path>"`
- Walkthrough: `"walkthrough:<id>"` or `"walkthrough:<path>"`
- Plan: `"plan:<id>"` or `"plan:<path>"`

---

## Tab Types Reference

| Type | Context | Rendered By | Description | Resource Shape |
|------|---------|-------------|-------------|----------------|
| `library` | Vault context | HomeView → ProjectView | Vault/library tabs (triggers vault loading) | `{}` or `{ view: ViewType }` |
| `project` | Any project | ProjectView | Project root with sidebar sections | `{ projectId, view?: ViewType }` |
| `kit` | Any project | ProjectView | Kit markdown file viewer | `{ projectId, path }` |
| `walkthrough` | Any project | ProjectView | Walkthrough viewer | `{ projectId, path }` or `{ walkthroughId }` |
| `plan` | Any project | ProjectView | Plan file viewer | `{ projectId, path }` or `{ planId }` |
| `diagram` | Any project | ProjectView | Mermaid diagram viewer | `{ projectId, path }` |
| `file` | Any project | ProjectView | Notebook file editor | `{ projectId, path }` |
| `task` | Any project | ProjectView | Blueprint task viewer | `{ projectId, blueprintPath, taskFile }` |
| `editor-plans` | Any | EditorPlansPage | Claude/Cursor plans editor | `{ plansSource: 'claude' \| 'cursor' }` |

### Tab Type Details

**`type: 'library'`**
- **When created:** Default tabs in vault/library context, or when `createDefaultLibraryTab()` is called
- **Context key:** Always in `project:<vault-id>` context
- **Rendering:** TabContent → HomeView → ProjectView (with `isVault=true`)
- **Example resource:** `{ view: 'projects' }`, `{ view: 'workflows' }`, or `{}`
- **File location:** `<vault-path>/.bluekit/workspace/tabs.json`

**`type: 'project'`**
- **When created:** Default tabs in project contexts, or when navigating to project views
- **Context key:** In `project:<project-id>` context matching the `resource.projectId`
- **Rendering:** TabContent → ProjectView (with `isVault=false`)
- **Example resource:** `{ projectId: '1763859627143', view: 'kits' }`
- **File location:** `<project-path>/.bluekit/workspace/tabs.json`

**ViewType values:**
```typescript
type ViewType =
  | 'projects'      // Projects list (library only)
  | 'workflows'     // Workflows (library only)
  | 'tasks'         // Tasks list
  | 'plans'         // Plans list
  | 'kits'          // Kits list
  | 'walkthroughs'  // Walkthroughs list
  | 'diagrams'      // Diagrams list
  | 'git'           // Git view
  | 'bookmarks'     // Bookmarks
  | 'scrapbook'     // Scrapbook notes
  | 'blueprints'    // Blueprints list
  | 'agents'        // Agents list
  | 'file';         // File tree browser
```

---

## Default Tab Behavior

### Creating Default Tabs

When a context has no tabs (new project, first load), a default "empty state" tab is created:

**Library:**
```typescript
function createDefaultLibraryTab(): TabState {
  return {
    id: createTabId(),
    type: "library",
    title: "New Tab",
    icon: "",
    resource: {},  // No view = renders EmptyTabState
    view: {},
    pinned: false,
    dirty: false,
    closable: true,
    openedAt: new Date().toISOString(),
  };
}
```

**Project:**
```typescript
function createDefaultProjectTab(projectId: string): TabState {
  return {
    id: createTabId(),
    type: "project",
    title: "New Tab",
    icon: "",
    resource: { projectId },  // No view = renders EmptyTabState
    view: {},
    pinned: false,
    dirty: false,
    closable: true,
    openedAt: new Date().toISOString(),
  };
}
```

**Key insight:** No `view` property = renders `<EmptyTabState />` component, which offers options to create content or navigate.

### Self-Healing

If you close all tabs in a context, a new default tab is immediately created:

```typescript
// TabContext.tsx:742-789 (closeTab)
const closeTab = useCallback((tabId: string) => {
  setTabsByContext((prev) => {
    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

    if (nextTabs.length === 0) {
      // Create default tab to replace the last one
      const newTab = activeContext === "library"
        ? createDefaultLibraryTab()
        : createDefaultProjectTab(projectId);
      
      return { ...prev, [activeContext]: [newTab] };
    }

    return { ...prev, [activeContext]: nextTabs };
  });
}, [activeContext]);
```

This ensures there's always at least one tab in every context.

---

## App Startup Flow

When BlueKit launches, tabs are restored in this order:

```typescript
// TabManager.tsx - Triggers loadTabs once
useEffect(() => {
  if (!hasLoadedRef.current) {
    loadTabs();
    hasLoadedRef.current = true;
  }
}, [loadTabs]);
```

**`loadTabs` execution:**

```typescript
// TabContext.tsx:559-689 (loadTabs)
const loadTabs = useCallback(async () => {
  // 1. Get vault project ID
  const vaultId = await ensureVaultId();
  const vaultContextKey = `project:${vaultId}`;
  
  // 2. Read global tabs.json (vault's file)
  const globalPath = await getGlobalTabsPath();
  const content = await invokeReadFile(globalPath);
  const data = JSON.parse(content);
  
  // 3. Load vault/library tabs
  if (data.contexts?.[vaultContextKey]) {
    const libraryTabs = data.contexts[vaultContextKey].tabs;
    setTabsByContext((prev) => ({ ...prev, [vaultContextKey]: libraryTabs }));
    
    // Restore last active tab for library
    if (data.contexts[vaultContextKey].activeTabId) {
      setLastActiveTabByContext((prev) => ({
        ...prev,
        [vaultContextKey]: data.contexts[vaultContextKey].activeTabId,
      }));
    }
  }
  
  // 4. Check persisted active context
  let persistedActiveContext = data.activeContext || vaultContextKey;
  
  // 5. Load active context tabs if it's a project
  if (persistedActiveContext !== vaultContextKey && 
      persistedActiveContext.startsWith('project:')) {
    await loadContextTabs(persistedActiveContext);
  }
  
  // 6. Set active context and tab
  setActiveContext(persistedActiveContext);
  
  const activeContextData = data.contexts?.[persistedActiveContext];
  if (activeContextData?.activeTabId) {
    setActiveTabId(activeContextData.activeTabId);
  }
}, [ensureVaultId, loadContextTabs]);
```

**What happens:**
1. Loads vault tabs from global `tabs.json`
2. Checks which context was active when app closed
3. If it was a project, loads that project's tabs
4. Restores active context and active tab
5. User sees exactly where they left off

---

## Architecture Evolution

### Phase 5.1: Disk as Source of Truth

**Problem:** In-memory caching (`loadedContextsRef`) caused bugs where tabs weren't restored when switching contexts.

**Solution:** Removed caching. Always read from disk when switching contexts.

**Benefits:**
- Deterministic behavior
- Tab state always matches disk
- ~70 lines of code removed
- File reads are ~1-2ms (negligible)

### Phase 6: Eliminate Decision Logic

**Problem:** `restoreContext` flag and complex branching logic made navigation unpredictable.

**Solution:** Removed `restoreContext` option. Simplified to: "Read disk, use what's there."

**Changes:**
- ❌ Removed `restoreContext` from `TabCreateOptions`
- ❌ Removed logic that checked `restoreContext && contextExists`
- ✅ Simplified `openInNewTab` from ~80 lines to ~30 lines
- ✅ Simplified `openLibraryTab` to just call `switchContext`

**New mental model:**
> "Disk **is** the answer, not something to check and decide about."

---

## Known Issues

### Issue: `activeTabId` Not Read from Disk

**Location:** `readTabsFromDisk` function

**Problem:** When switching contexts, the last active tab is determined by in-memory `lastActiveTabByContext` state, not the `activeTabId` stored in `tabs.json`.

**Why it matters:**
1. User clicks tab 2 in library
2. User navigates to a project
3. `lastActiveTabByContext['library']` = tab 2 (in memory)
4. User navigates back to library
5. `switchContext` reads tabs from disk but **ignores** `activeTabId` in the file
6. Uses stale in-memory value (tab 2) instead of what's on disk (might be tab 1)

**Expected fix:**
```typescript
// readTabsFromDisk should return:
return {
  tabs: tabs.map(...),
  activeTabId: data.contexts?.[contextKey]?.activeTabId
};

// switchContext should use it:
const { tabs, activeTabId } = await readTabsFromDisk(targetContext);
if (activeTabId) {
  setLastActiveTabByContext(prev => ({ ...prev, [targetContext]: activeTabId }));
}
```

See `.bluekit/walkthroughs/architecture/context-navigation-flow.md` for detailed analysis.

---

## Performance Characteristics

### Tab Switch Speed

| Scenario | Time | Details |
|----------|------|---------|
| Same context, same tab | ~0ms | No-op |
| Same context, different tab | ~10ms | Update active tab ID |
| Different context (cached project) | ~100ms | Disk read + render |
| Different context (first load) | ~200ms | Disk read + artifact load |

### Optimization: Project Registry Caching

**Location:** `TabContent.tsx`

```typescript
const [projectsCache, setProjectsCache] = useState<Project[]>([]);

// Check cache before fetching
const cachedProject = projectsCache.find(p => p.id === projectId);
if (cachedProject) {
  setActiveProject(cachedProject);  // Instant
  return;
}

// Cache miss - fetch and cache
const projects = await invokeDbGetProjects();
setProjectsCache(projects);
```

**Impact:**
- First project load: Shows "Loading project..."
- Subsequent switches: Instant (no loading state)
- Reduces backend calls from 1 per switch to 1 per session

---

## Architecture Summary

### Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER ACTIONS                                 │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
    Back Arrow          Project Card           Cmd+T
         │                    │                    │
         ↓                    ↓                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                  NAVIGATION FUNCTIONS                           │
│  openLibraryTab    openInCurrentTab       openInNewTab         │
│       │                    │                    │               │
│       └────────────────────┴────────────────────┘               │
│                            │                                    │
│                            ↓                                    │
│                      switchContext                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT RESOLUTION                           │
│                                                                 │
│  'library' → ensureVaultId() → 'project:db377353-...'         │
│  'project:xyz' → 'project:xyz' (no change)                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DISK READ (Source of Truth)                  │
│                                                                 │
│  readTabsFromDisk(contextKey)                                  │
│    ├─ Library: read <vault>/.bluekit/workspace/tabs.json      │
│    └─ Project: read <project>/.bluekit/workspace/tabs.json    │
│                                                                 │
│  Returns: TabState[]                                            │
│  ⚠️ Does NOT return activeTabId (known issue)                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STATE UPDATE                                 │
│                                                                 │
│  setTabsByContext({ [contextKey]: loadedTabs })                │
│  setActiveContext(contextKey)                                  │
│  setActiveTab(lastActiveTab || firstTab)                       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RENDERING                                    │
│                                                                 │
│  TabContent checks activeTab.type                              │
│    │                                                            │
│    ├─ type='library' → HomeView                                │
│    │   └─ Load vault → ProjectView (isVault=true)              │
│    │                                                            │
│    ├─ type='project' → ProjectView (isVault=false)             │
│    │                                                            │
│    └─ type='editor-plans' → EditorPlansPage                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-SAVE (500ms debounce)                   │
│                                                                 │
│  saveTabs()                                                     │
│    ├─ For each context in tabsByContext                        │
│    ├─ Write to context's tabs.json                             │
│    └─ Include activeTabId per context                          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Context Isolation**
   - Library and projects have completely independent tab sets
   - Context = isolated workspace with its own `tabs.json` file
   - Switching contexts = switching which tabs are visible

2. **Disk as Source of Truth**
   - Always read from `tabs.json` when switching contexts
   - No in-memory cache (except project registry for performance)
   - File reads are ~1-2ms (negligible overhead)

3. **Library/Vault Duality**
   - Library is both a **tab type** (`type: 'library'`) and a **context key** (`'library'` → `'project:<vault-id>'`)
   - Tab type determines rendering (HomeView wrapper)
   - Context key determines persistence location (vault's project directory)

4. **Automatic Persistence**
   - All tab changes auto-save after 500ms
   - Each context saves to its own file independently
   - App startup restores last session exactly

### Navigation Patterns

**Cross-Context (Library ↔ Project):**
```
switchContext(targetContext)
  → Read tabs.json from disk
  → Restore all tabs
  → Activate last active tab
  → User sees context exactly as saved
```

**Same-Context (Sidebar navigation):**
```
openInCurrentTab(resource)
  → Update current tab in place (same ID)
  → No disk read needed
  → Instant navigation
```

**New Tab:**
```
openInNewTab(resource)
  → Check for duplicate (by match key)
  → If exists: activate existing
  → If not: create new tab
  → Prevents duplicate tabs for same resource
```

### File Structure

```
Project Directory (e.g., /Users/you/code/blueKit/)
└── .bluekit/
    └── workspace/
        └── tabs.json
            {
              "schemaVersion": "bluekit.tabs.v2",
              "activeContext": "project:1763859627143",
              "contexts": {
                "project:1763859627143": {
                  "activeTabId": "tab_123",
                  "tabs": [...]
                }
              }
            }

Vault Directory (e.g., /Users/you/Documents/Vault/)
└── .bluekit/
    └── workspace/
        └── tabs.json
            {
              "schemaVersion": "bluekit.tabs.v2",
              "activeContext": "project:db377353-...",
              "contexts": {
                "project:db377353-6ef9-460a-8e4a-6de077bc6983": {
                  "activeTabId": "tab_vault_1",
                  "tabs": [...]
                }
              }
            }
```

**Important:** Each project (including vault) has its own independent `tabs.json`. There is no global tabs file - the vault's file is treated as "global" because it's the home/library context.

### Result

**Predictable, fast, stateful tab navigation** with:
- ✅ Zero configuration needed
- ✅ Automatic persistence across sessions
- ✅ Isolated contexts prevent interference
- ✅ Disk as source of truth ensures consistency
- ✅ ~100-200ms context switches (including disk I/O)
- ✅ ~10ms same-context navigation (no I/O)
