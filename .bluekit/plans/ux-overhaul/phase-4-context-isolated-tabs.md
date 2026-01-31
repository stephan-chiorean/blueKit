# Phase 4: Context-Isolated Tabs

## 🎯 Goal

Implement context-isolated tab management where each project and the home/library view have their own dedicated tab sets. When you navigate between contexts (e.g., switch from Project A to Project B), you see that context's tabs.

**Mental Model**: Like VS Code workspaces or IntelliJ IDEA project windows - each project is its own workspace with isolated tabs.

---

## Why This Matters

### Current Problem
All tabs live in one global pool. Whether you're viewing Home, Library, Project A, or Project B - all tabs are visible in the same tab bar. This creates:

- **Tab clutter**: Tabs from different projects mix together
- **Context confusion**: Hard to remember which tabs belong to which project
- **Lost focus**: Switching projects doesn't feel like switching workspaces
- **Mental overhead**: Users must manually manage tabs across contexts

### After This Phase
- Each project has its own isolated set of tabs
- Home/Library has its own tab set
- Switching to a project shows only that project's tabs
- Clean workspace boundaries match user mental model
- Similar to VS Code's workspace-per-folder model

---

## Architecture Changes

### Current Architecture

```typescript
// Single global tab array
const [tabs, setTabs] = useState<TabState[]>([initialTab]);
const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);
```

All tabs stored in one flat array. Switching tabs just changes which tab is active.

### New Architecture

```typescript
// Tabs grouped by context
const [tabsByContext, setTabsByContext] = useState<{
  [contextKey: string]: TabState[]
}>({
  'home': [homeTab],
  'project:abc123': [projectTab1, projectTab2],
  'project:def456': [projectTab3],
});

// Track active context
const [activeContext, setActiveContext] = useState<string>('home');
const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);
```

**Context Keys**:
- `"home"` - Home/Library view
- `"project:{projectId}"` - Individual project workspaces (e.g., `"project:abc123"`)

---

## Implementation Steps

### Step 1: Refactor TabContext Storage Structure

**File**: `src/app/TabContext.tsx`

**Changes**:

#### 1.1 Update State Structure

```tsx
// Add new state
const [tabsByContext, setTabsByContext] = useState<{
  [contextKey: string]: TabState[]
}>({
  home: [createDefaultHomeTab()],
});

const [activeContext, setActiveContext] = useState<string>('home');
const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_HOME_TAB_ID);

// Helper to get current context's tabs
const tabs = useMemo(() => {
  return tabsByContext[activeContext] || [];
}, [tabsByContext, activeContext]);
```

#### 1.2 Add Context Management Functions

```tsx
// Switch to a different context
const switchContext = useCallback((contextKey: string) => {
  if (!tabsByContext[contextKey]) {
    // Create default tab for new context
    if (contextKey.startsWith('project:')) {
      const projectId = contextKey.replace('project:', '');
      const defaultTab = {
        id: createTabId(),
        type: 'project' as TabType,
        title: 'Project',
        icon: 'project',
        resource: { projectId, view: 'file' },
        view: {},
        pinned: false,
        dirty: false,
        closable: true,
        openedAt: new Date().toISOString(),
      };

      setTabsByContext(prev => ({
        ...prev,
        [contextKey]: [defaultTab],
      }));
      setActiveContext(contextKey);
      setActiveTabId(defaultTab.id);
    } else {
      // For home/library
      setActiveContext(contextKey);
      const contextTabs = tabsByContext[contextKey] || [];
      if (contextTabs.length > 0) {
        setActiveTabId(contextTabs[0].id);
      }
    }
  } else {
    // Context exists - switch to it
    setActiveContext(contextKey);
    const contextTabs = tabsByContext[contextKey];
    if (contextTabs.length > 0) {
      setActiveTabId(contextTabs[0].id);
    }
  }
}, [tabsByContext]);

// Get context key from tab resource
const getContextKey = useCallback((resource: TabResourceInput): string => {
  if (resource.type === 'home') {
    return 'home';
  }
  if (resource.projectId) {
    return `project:${resource.projectId}`;
  }
  return 'home'; // fallback
}, []);
```

#### 1.3 Update Tab Operations

**createTab** - Add to current context:
```tsx
const createTab = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
  const { type, ...resourceData } = resource;
  const openedAt = new Date().toISOString();
  const title = options?.title ?? getDefaultTitle(resource);
  const icon = options?.icon ?? resource.type;
  const closable = options?.closable ?? true;
  const pinned = options?.pinned ?? false;
  const dirty = options?.dirty ?? false;

  const newTab: TabState = {
    id: createTabId(),
    type,
    title,
    icon,
    resource: resourceData,
    view: {},
    pinned,
    dirty,
    closable,
    openedAt,
  };

  // Add to current context
  setTabsByContext(prev => ({
    ...prev,
    [activeContext]: [...(prev[activeContext] || []), newTab],
  }));

  setActiveTabId(newTab.id);
  return newTab.id;
}, [activeContext]);
```

**closeTab** - Remove from current context:
```tsx
const closeTab = useCallback((tabId: string) => {
  setTabsByContext(prev => {
    const currentTabs = prev[activeContext] || [];
    const tabToClose = currentTabs.find(tab => tab.id === tabId);

    if (!tabToClose || tabToClose.closable === false) return prev;

    const nextTabs = currentTabs.filter(tab => tab.id !== tabId);

    // Handle empty context
    if (nextTabs.length === 0) {
      if (activeContext === 'home') {
        const fallbackTab = createDefaultHomeTab();
        setActiveTabId(fallbackTab.id);
        return {
          ...prev,
          [activeContext]: [fallbackTab],
        };
      } else {
        // For projects, create a default empty tab
        const projectId = activeContext.replace('project:', '');
        const defaultTab: TabState = {
          id: createTabId(),
          type: 'project',
          title: 'Project',
          icon: 'project',
          resource: { projectId, view: 'file' },
          view: {},
          pinned: false,
          dirty: false,
          closable: true,
          openedAt: new Date().toISOString(),
        };
        setActiveTabId(defaultTab.id);
        return {
          ...prev,
          [activeContext]: [defaultTab],
        };
      }
    }

    // Select adjacent tab
    if (activeTabId === tabId) {
      const closedIndex = currentTabs.findIndex(tab => tab.id === tabId);
      const newActiveIndex = Math.max(0, closedIndex - 1);
      setActiveTabId(nextTabs[newActiveIndex]?.id ?? nextTabs[0].id);
    }

    return {
      ...prev,
      [activeContext]: nextTabs,
    };
  });
}, [activeContext, activeTabId]);
```

**selectTab** - Only select within current context:
```tsx
const selectTab = useCallback((tabId: string) => {
  const currentTabs = tabsByContext[activeContext] || [];
  const tab = currentTabs.find(t => t.id === tabId);
  if (tab) {
    setActiveTabId(tabId);
  }
}, [activeContext, tabsByContext]);
```

**openInNewTab** - Switches context if needed:
```tsx
const openInNewTab = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
  const targetContext = getContextKey(resource);

  // Check if we need to switch context
  if (targetContext !== activeContext) {
    switchContext(targetContext);
    // After switching, create the tab
    setTimeout(() => {
      createTab(resource, options);
    }, 0);
  } else {
    // Same context - check for existing tab
    const existing = findMatchingTab(resource);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    createTab(resource, options);
  }
}, [activeContext, createTab, findMatchingTab, getContextKey, switchContext]);
```

**openInCurrentTab** - Updates current tab (stays in context):
```tsx
const openInCurrentTab = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
  if (!activeTabId) {
    createTab(resource, options);
    return;
  }

  const targetContext = getContextKey(resource);

  // If resource is from different context, switch context first
  if (targetContext !== activeContext) {
    switchContext(targetContext);
    // After switching, update the active tab in new context
    setTimeout(() => {
      updateCurrentTabInContext(resource, options);
    }, 0);
  } else {
    // Same context - update current tab
    updateCurrentTabInContext(resource, options);
  }
}, [activeContext, activeTabId, createTab, getContextKey, switchContext]);

const updateCurrentTabInContext = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
  const { type, ...resourceData } = resource;
  const title = options?.title ?? getDefaultTitle(resource);
  const icon = options?.icon ?? resource.type;
  const closable = options?.closable ?? true;
  const pinned = options?.pinned ?? false;
  const dirty = options?.dirty ?? false;

  setTabsByContext(prev => ({
    ...prev,
    [activeContext]: (prev[activeContext] || []).map(tab => {
      if (tab.id !== activeTabId) return tab;
      return {
        ...tab,
        type,
        title,
        icon,
        resource: resourceData,
        closable,
        pinned,
        dirty,
      };
    }),
  }));
}, [activeContext, activeTabId]);
```

#### 1.4 Update Context Value

```tsx
const value: TabContextValue = {
  tabs, // Computed from tabsByContext[activeContext]
  activeTabId,
  activeContext,
  createTab,
  closeTab,
  selectTab,
  switchContext,
  updateTabResource,
  updateTabMeta,
  openInNewTab,
  openInCurrentTab,
  saveTabs,
  loadTabs,
};
```

---

### Step 2: Update Tab Persistence

**File**: `src/app/TabContext.tsx`

#### 2.1 Update saveTabs()

```tsx
const saveTabs = useCallback(async () => {
  const tabsFilePath = await ensureTabsDirectory();
  if (!tabsFilePath) return;

  const payload = {
    schemaVersion: 'bluekit.tabs.v2', // Bump version for new schema
    updatedAt: new Date().toISOString(),
    activeContext,
    contexts: Object.entries(tabsByContext).reduce((acc, [contextKey, contextTabs]) => {
      const activeTabInContext = contextTabs.find(t => t.id === activeTabId);
      acc[contextKey] = {
        activeTabId: activeTabInContext?.id ?? contextTabs[0]?.id ?? null,
        tabs: contextTabs,
      };
      return acc;
    }, {} as Record<string, { activeTabId: string | null; tabs: TabState[] }>),
  };

  try {
    await invokeWriteFile(tabsFilePath, JSON.stringify(payload, null, 2));
  } catch (error) {
    console.warn('Failed to save tabs:', error);
  }
}, [activeContext, activeTabId, ensureTabsDirectory, tabsByContext]);
```

#### 2.2 Update loadTabs()

```tsx
const loadTabs = useCallback(async () => {
  const tabsFilePath = await resolveTabsFilePath();
  if (!tabsFilePath) return;

  try {
    const content = await invokeReadFile(tabsFilePath);
    const data = JSON.parse(content);

    // Handle v2 schema (context-isolated)
    if (data.schemaVersion === 'bluekit.tabs.v2') {
      const loadedContexts = data.contexts || {};

      // Ensure home context exists
      if (!loadedContexts.home) {
        loadedContexts.home = {
          activeTabId: DEFAULT_HOME_TAB_ID,
          tabs: [createDefaultHomeTab()],
        };
      }

      // Build tabsByContext
      const contexts: { [contextKey: string]: TabState[] } = {};
      for (const [contextKey, contextData] of Object.entries(loadedContexts)) {
        const contextTabs = (contextData as any).tabs || [];
        contexts[contextKey] = contextTabs.map((tab: TabState) => ({
          ...tab,
          resource: tab.resource ?? {},
          view: tab.view ?? {},
        }));
      }

      setTabsByContext(contexts);

      // Restore active context
      const restoredContext = data.activeContext && contexts[data.activeContext]
        ? data.activeContext
        : 'home';
      setActiveContext(restoredContext);

      // Restore active tab in that context
      const contextTabs = contexts[restoredContext] || [];
      const contextData = loadedContexts[restoredContext] as any;
      const restoredActiveId = contextTabs.some(tab => tab.id === contextData?.activeTabId)
        ? contextData.activeTabId
        : contextTabs[0]?.id ?? DEFAULT_HOME_TAB_ID;
      setActiveTabId(restoredActiveId);

      return;
    }

    // Handle legacy v1 schema (migrate to v2)
    if (data.schemaVersion === 'bluekit.tabs.v1') {
      const loadedTabs: TabState[] = Array.isArray(data.groups)
        ? (data.groups[0]?.tabs ?? []).map((tab: TabState) => ({
          ...tab,
          resource: tab.resource ?? {},
          view: tab.view ?? {},
        }))
        : [];

      // Group tabs by context
      const contexts: { [contextKey: string]: TabState[] } = {
        home: [],
      };

      for (const tab of loadedTabs) {
        if (tab.type === 'home') {
          contexts.home.push(tab);
        } else if (tab.resource.projectId) {
          const contextKey = `project:${tab.resource.projectId}`;
          if (!contexts[contextKey]) {
            contexts[contextKey] = [];
          }
          contexts[contextKey].push(tab);
        } else {
          // Fallback to home
          contexts.home.push(tab);
        }
      }

      // Ensure home has at least one tab
      if (contexts.home.length === 0) {
        contexts.home.push(createDefaultHomeTab());
      }

      setTabsByContext(contexts);

      // Default to home context
      setActiveContext('home');
      setActiveTabId(data.activeTabId ?? contexts.home[0].id);

      // Save migrated data
      setTimeout(() => saveTabs(), 100);
      return;
    }

    // Unsupported schema - reset to default
    throw new Error('Unsupported tabs schema');

  } catch (error) {
    console.warn('Failed to load tabs, using defaults:', error);
    const fallbackTab = createDefaultHomeTab();
    setTabsByContext({ home: [fallbackTab] });
    setActiveContext('home');
    setActiveTabId(fallbackTab.id);
  }
}, [resolveTabsFilePath, saveTabs]);
```

---

### Step 3: Update UI to Use Context-Aware Tabs

**File**: `src/app/TabContent.tsx`

No changes needed! TabContent already uses `useTabContext()` which now returns context-filtered tabs.

**File**: `src/tabs/BrowserTabs.tsx`

No changes needed! BrowserTabs receives `tabs` prop which is already filtered by context.

---

### Step 4: Add Context Switching Logic

**File**: `src/views/home/HomeView.tsx`

When user selects a project, switch to that project's context:

```tsx
import { useTabContext } from '@/app/TabContext';

function HomeView({ onProjectSelect }: HomeViewProps) {
  const { switchContext, openInNewTab } = useTabContext();

  const handleProjectClick = (project: Project) => {
    // Switch to project's context
    const contextKey = `project:${project.id}`;
    switchContext(contextKey);

    // Or call the prop
    onProjectSelect?.(project);
  };

  // ... rest of component
}
```

**File**: `src/app/TabContent.tsx`

When user navigates to a project tab, ensure we're in that project's context:

```tsx
useEffect(() => {
  if (!activeTab) return;

  // Determine expected context from active tab
  let expectedContext = 'home';
  if (activeTab.type === 'project' && activeTab.resource.projectId) {
    expectedContext = `project:${activeTab.resource.projectId}`;
  }

  // Auto-switch context if needed (shouldn't happen often)
  if (expectedContext !== activeContext) {
    switchContext(expectedContext);
  }
}, [activeTab, activeContext, switchContext]);
```

---

## Edge Cases & Handling

### 1. Closing All Tabs in a Context

**Behavior**: Create a default empty tab for that context

```tsx
// In closeTab() - see Step 1.3 above
if (nextTabs.length === 0) {
  if (activeContext === 'home') {
    // Home always gets default home tab
    return [createDefaultHomeTab()];
  } else {
    // Projects get empty project tab
    const projectId = activeContext.replace('project:', '');
    return [createDefaultProjectTab(projectId)];
  }
}
```

### 2. Opening Cross-Context Tab

**Behavior**: Switch to target context, then open/update tab there

```tsx
// In openInNewTab() - see Step 1.3 above
if (targetContext !== activeContext) {
  switchContext(targetContext);
  setTimeout(() => createTab(resource, options), 0);
}
```

### 3. Context Cleanup

**Behavior**: Remove empty project contexts when user closes all tabs

```tsx
const cleanupEmptyContexts = useCallback(() => {
  setTabsByContext(prev => {
    const next = { ...prev };

    // Remove empty project contexts (but keep home)
    for (const [key, tabs] of Object.entries(next)) {
      if (key !== 'home' && tabs.length === 0) {
        delete next[key];
      }
    }

    return next;
  });
}, []);

// Call after closeTab if context is now empty
```

### 4. Unknown/Missing Project Context

**Behavior**: If a saved context references a project that no longer exists, create a fallback or switch to home

```tsx
// In loadTabs() - validate projects exist
const validContexts: { [key: string]: TabState[] } = {};

for (const [contextKey, tabs] of Object.entries(loadedContexts)) {
  if (contextKey === 'home') {
    validContexts.home = tabs;
  } else if (contextKey.startsWith('project:')) {
    const projectId = contextKey.replace('project:', '');
    // Validate project exists (could add IPC check here)
    // For now, assume it exists
    validContexts[contextKey] = tabs;
  }
}
```

---

## Testing Checklist

### Context Switching
- [ ] Click on Project A → see Project A's tabs
- [ ] Click on Project B → see Project B's tabs (Project A tabs disappear)
- [ ] Click on Home → see Home tabs
- [ ] Switch back to Project A → tabs are preserved (same tabs as before)

### Tab Operations Within Context
- [ ] Create new tab in Project A → tab appears in Project A context only
- [ ] Close tab in Project A → other Project A tabs remain
- [ ] Close all tabs in Project A → creates default empty project tab
- [ ] Cmd+1-9 switches between tabs in current context only

### Cross-Context Navigation
- [ ] In Project A, open item from Project B → switches to Project B context
- [ ] Open home from project → switches to home context
- [ ] Cmd+Click on cross-context item → switches context and opens in new tab

### Persistence
- [ ] Create tabs in multiple contexts → quit app → reopen → all contexts restored
- [ ] Active context remembered across restarts
- [ ] Active tab per context remembered
- [ ] Legacy v1 tabs migrate correctly to context-isolated v2 format

### Edge Cases
- [ ] Close all tabs in a context → default tab created
- [ ] Delete a project → its context removed gracefully
- [ ] Empty context doesn't show in tab bar
- [ ] Switching to empty context creates default tab

---

## Files to Modify

1. **`src/app/TabContext.tsx`** - Core refactor
   - Update state structure to `tabsByContext`
   - Add `activeContext` tracking
   - Add `switchContext()` function
   - Update all tab operations (create, close, select, etc.)
   - Update persistence (saveTabs/loadTabs) for v2 schema

2. **`src/app/TabContent.tsx`** - Minimal changes
   - Add auto-context-switching effect
   - Update project selection handlers

3. **`src/views/home/HomeView.tsx`** - Context switching
   - Call `switchContext()` when project selected

---

## Success Criteria

- ✅ Each project has isolated tab set
- ✅ Home/Library has its own tab set
- ✅ Switching contexts shows correct tabs
- ✅ Tab operations (create, close, select) work within current context
- ✅ Cross-context navigation switches contexts appropriately
- ✅ Tabs persist per context across app restarts
- ✅ Legacy tabs migrate to new format
- ✅ Empty contexts handled gracefully
- ✅ No tab clutter - clean workspace boundaries
- ✅ Matches VS Code workspace mental model

---

## Migration Strategy

### Backward Compatibility

The schema version bump (`v1` → `v2`) ensures safe migration:

1. **On first load with new code**:
   - Detect `schemaVersion: 'bluekit.tabs.v1'`
   - Migrate tabs to context-isolated structure
   - Group tabs by `projectId`
   - Save as `v2` format

2. **Users can rollback if needed**:
   - If rolling back to old version, old code will see unsupported `v2` schema
   - Falls back to default tabs (safe degradation)

---

## Next Steps

After Phase 4 is complete, move to **Phase 5** (formerly Phase 4):
- Tab navigation refinement
- Spotlight popover for new tabs
- Empty tab states
- Keyboard shortcuts

The context-isolated architecture makes Phase 5's scope selection popover more valuable - users can choose which context to create a tab in.

---

## Notes

### Why Context Isolation First?

This is a foundational architectural change that should be done before UI refinements (Phase 5). It affects:
- How tabs are stored
- How tab operations work
- How persistence works

Doing this first means Phase 5's UI work builds on the correct foundation.

### Benefits

- **Mental model alignment**: Matches how users think about projects
- **Reduced clutter**: Only relevant tabs visible at a time
- **Better focus**: Each workspace is isolated
- **Scalability**: Works well with many projects
- **Future-proof**: Enables workspace-level features (saved layouts, split views per project, etc.)
