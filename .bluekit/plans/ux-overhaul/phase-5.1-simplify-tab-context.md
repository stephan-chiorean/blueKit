# Phase 5.1: Simplify Tab Context Architecture

> **Prerequisites**: Discovered during Phase 5 implementation. This fixes fundamental issues with tab restoration and context caching.

## Problem Statement

The current `TabContext.tsx` implementation is over-engineered with in-memory context caching that causes critical bugs:

### Issue 1: `restoreContext` Flag is Ignored

When navigating from Library → Project with `restoreContext: true`:

**Expected**: Restore user's previous tab state (e.g., "Kits" view)
**Actual**: First tab gets overwritten with `view: 'file'`

**Root Cause**: Code checks in-memory cache (`targetTabs.length > 0`) instead of reading from disk, then always overwrites the first tab.

### Issue 2: Unnecessary Complexity

The caching system adds significant complexity for minimal benefit:
- `loadedContextsRef` tracks which contexts are loaded
- `tabsByContext` maintains in-memory state
- Complex branching logic for "context exists in memory" vs "load from disk"
- File reads are ~1-2ms, the optimization isn't worth the bugs

### Issue 3: Cache vs Disk Inconsistency

- In-memory check doesn't tell you if `tabs.json` exists
- It tells you if you loaded it this session
- On app restart, memory is gone anyway → everything reads from disk
- The cache creates a false distinction between "has tabs" and "has loaded tabs"

## The Insight

**Current mental model**: "Check cache first, then maybe load from disk"
**Simplified mental model**: "Disk is source of truth, always read it"

The `restoreContext` flag only exists to work around the broken caching logic. If we just read from disk every time:

```typescript
const tabs = await readTabsFromDisk(projectId);

if (tabs.length > 0) {
  // File has tabs → restore them
  setTabsByContext(prev => ({ ...prev, [projectId]: tabs }));
  switchContext(projectId);
} else {
  // No tabs → create default
  createDefaultTab();
  switchContext(projectId);
}
```

No `restoreContext` flag needed. Behavior is deterministic.

---

## Solution Architecture

### New Navigation Flow

**Cross-Context Navigation** (`openInCurrentTab` when switching projects):

```typescript
async function openInCurrentTab(resource: TabResourceInput, options?: TabCreateOptions) {
  const targetContext = getContextKey(resource);

  if (targetContext !== activeContext) {
    // ALWAYS read from disk first
    const tabs = await readTabsFromDisk(targetContext);

    if (tabs.length > 0) {
      // File exists with tabs → restore user's state
      setTabsByContext(prev => ({ ...prev, [targetContext]: tabs }));
      switchContext(targetContext);
    } else {
      // No file or empty → create default tab
      const newTab = createDefaultTab(resource);
      setTabsByContext(prev => ({ ...prev, [targetContext]: [newTab] }));
      switchContext(targetContext);
    }
  } else {
    // Same context → update current tab (no change needed here)
    updateCurrentTabInContext(resource, options);
  }
}
```

**Helper Function**:

```typescript
async function readTabsFromDisk(contextKey: string): Promise<TabState[]> {
  const filePath = await getTabsFilePath(contextKey);
  if (!filePath) return [];

  try {
    const content = await invokeReadFile(filePath);
    const data = JSON.parse(content);
    return data.contexts?.[contextKey]?.tabs || [];
  } catch {
    return []; // File doesn't exist or is malformed
  }
}

async function getTabsFilePath(contextKey: string): Promise<string | null> {
  if (contextKey === 'library') {
    return await getGlobalTabsPath();
  } else if (contextKey.startsWith('project:')) {
    const projectId = contextKey.replace('project:', '');
    return await getProjectTabsPath(projectId);
  }
  return null;
}
```

### What Gets Removed

1. ❌ `loadedContextsRef` - No need to track what's loaded
2. ❌ `restoreContext` option - Redundant when disk is source of truth
3. ❌ `options?.restoreContext` checks in `openInCurrentTab`
4. ❌ `options?.restoreContext` checks in `updateCurrentTabInContext`
5. ❌ Complex "target tabs exist in memory?" logic (lines 1082-1149)
6. ❌ The "overwrite first tab" bug (lines 1120-1142)

### What Remains (Simplified)

1. ✅ Read `tabs.json` → use it if exists → create default if not
2. ✅ Save `tabs.json` on changes (debounced, 500ms)
3. ✅ `switchContext` - switches active context
4. ✅ `createTab` - creates new tab in current context
5. ✅ `closeTab` - closes tab, creates default if last
6. ✅ `updateCurrentTabInContext` - updates current tab (same context navigation)

---

## Implementation Steps

### Step 1: Create Helper Functions

**File**: `src/app/TabContext.tsx`

**Add before `openInCurrentTab`**:

```typescript
// Helper to read tabs from disk
const readTabsFromDisk = useCallback(async (contextKey: string): Promise<TabState[]> => {
  console.log('[TabContext] readTabsFromDisk:', contextKey);

  let filePath: string | null = null;
  if (contextKey === 'library') {
    filePath = await getGlobalTabsPath();
  } else if (contextKey.startsWith('project:')) {
    const projectId = contextKey.replace('project:', '');
    filePath = await getProjectTabsPath(projectId);
  }

  if (!filePath) {
    console.log('[TabContext] No file path for context:', contextKey);
    return [];
  }

  try {
    const content = await invokeReadFile(filePath);
    const data = JSON.parse(content);
    const tabs = data.contexts?.[contextKey]?.tabs || [];

    console.log('[TabContext] Loaded tabs from disk:', {
      contextKey,
      tabCount: tabs.length,
      tabs: tabs.map((t: TabState) => ({ id: t.id, title: t.title, view: t.resource?.view })),
    });

    return tabs.map((tab: TabState) => ({
      ...tab,
      resource: tab.resource ?? {},
      view: tab.view ?? {},
    }));
  } catch (error) {
    console.log('[TabContext] Failed to read tabs (file may not exist):', { contextKey, error });
    return [];
  }
}, [getGlobalTabsPath, getProjectTabsPath]);
```

### Step 2: Simplify `openInCurrentTab` (Cross-Context Path)

**File**: `src/app/TabContext.tsx` (lines 1063-1172)

**Replace the cross-context branch**:

```diff
  const openInCurrentTab = useCallback((resource: TabResourceInput, options?: TabCreateOptions) => {
+   console.log('[TabContext] openInCurrentTab called', {
+     resource,
+     options,
+     activeTabId,
+     activeContext,
+   });
+
    if (!activeTabId) {
+     console.log('[TabContext] No active tab, creating new tab');
      createTab(resource, options);
      return;
    }

    const targetContext = getContextKey(resource);
+   console.log('[TabContext] Target context:', targetContext, 'Active:', activeContext);

    // If resource is from different context, switch context
    if (targetContext !== activeContext) {
-     const { type, ...resourceData } = resource;
-     const title = options?.title ?? getDefaultTitle(resource);
-     const icon = options?.icon ?? resource.type;
-     const closable = options?.closable ?? true;
-     const pinned = options?.pinned ?? false;
-     const dirty = options?.dirty ?? false;
-
-     // Get or create target context tabs
-     const targetTabs = tabsByContext[targetContext] || [];
-     const restoreContext = options?.restoreContext ?? false;
-
-     console.log('[TabContext] openInCurrentTab - different context branch', {
-       targetContext,
-       targetTabCount: targetTabs.length,
-       restoreContext,
-       passedView: resourceData.view,
-     });
-
-     if (targetTabs.length === 0) {
-       // Create new tab in target context
-       console.log('[TabContext] No tabs in target context - creating new tab with passed resource');
-       const newTab: TabState = {
-         id: createTabId(),
-         type,
-         title,
-         icon,
-         resource: resourceData,
-         view: {},
-         pinned,
-         dirty,
-         closable,
-         openedAt: new Date().toISOString(),
-       };
-
-       setTabsByContext(prev => ({ ...prev, [targetContext]: [newTab] }));
-       setActiveContext(targetContext);
-       setActiveTab(newTab.id, targetContext);
-     } else {
-       // Update first tab in target context
-       console.log('[TabContext] Target context HAS tabs - OVERWRITING first tab (IGNORING restoreContext!)', {
-         firstTabBefore: targetTabs[0],
-         willOverwriteWith: resourceData,
-       });
-       const updatedTabs = targetTabs.map((tab, index) => {
-         if (index === 0) {
-           return { ...tab, type, title, icon, resource: resourceData, closable, pinned, dirty };
-         }
-         return tab;
-       });
-
-       setTabsByContext(prev => ({ ...prev, [targetContext]: updatedTabs }));
-       setActiveContext(targetContext);
-       setActiveTab(updatedTabs[0].id, targetContext);
-     }
+     // Cross-context: Always read from disk
+     const tabs = await readTabsFromDisk(targetContext);
+
+     if (tabs.length > 0) {
+       // File has tabs → restore user's previous state
+       console.log('[TabContext] Restoring tabs from disk:', {
+         contextKey: targetContext,
+         tabCount: tabs.length,
+       });
+       setTabsByContext(prev => ({ ...prev, [targetContext]: tabs }));
+       switchContext(targetContext);
+     } else {
+       // No tabs on disk → create default
+       console.log('[TabContext] No tabs on disk, creating default tab');
+       const { type, ...resourceData } = resource;
+       const newTab: TabState = {
+         id: createTabId(),
+         type,
+         title: options?.title ?? getDefaultTitle(resource),
+         icon: options?.icon ?? resource.type,
+         resource: resourceData,
+         view: {},
+         pinned: options?.pinned ?? false,
+         dirty: options?.dirty ?? false,
+         closable: options?.closable ?? true,
+         openedAt: new Date().toISOString(),
+       };
+       setTabsByContext(prev => ({ ...prev, [targetContext]: [newTab] }));
+       switchContext(targetContext);
+     }
    } else {
      // Same context - update current tab
      console.log('[TabContext] SAME CONTEXT: updating current tab', {
        currentTabId: activeTabId,
      });
      updateCurrentTabInContext(resource, options);
    }
  }, [
    activeContext,
    activeTabId,
    createTab,
    getContextKey,
    setActiveTab,
+   switchContext,
+   readTabsFromDisk,
-   tabsByContext,
    updateCurrentTabInContext,
  ]);
```

### Step 3: Remove `loadedContextsRef`

**File**: `src/app/TabContext.tsx`

**Remove declaration** (line 187):
```diff
- const loadedContextsRef = useRef<Set<string>>(new Set(['library']));
```

**Remove usage in `loadContextTabs`** (line 320):
```diff
  const loadContextTabs = useCallback(async (contextKey: string): Promise<TabState[]> => {
    console.log('[TabContext] loadContextTabs called', { contextKey });

-   if (loadedContextsRef.current.has(contextKey)) {
-     console.log('[TabContext] loadContextTabs: Already loaded, returning cached', {
-       contextKey,
-       tabCount: (tabsByContext[contextKey] || []).length
-     });
-     return tabsByContext[contextKey] || [];
-   }

    // ... rest of function

-   } finally {
-     loadedContextsRef.current.add(contextKey);
-   }
  }, [activeContext, getGlobalTabsPath, getProjectTabsPath, tabsByContext]);
```

**Remove usage in `switchContext`** (line 446):
```diff
  const switchContext = useCallback(async (contextKey: string) => {
    // ...

-   // Lazy load the context's tabs if needed
-   if (!loadedContextsRef.current.has(targetContext)) {
-     console.log('[TabContext] Context not loaded, loading now:', targetContext);
-     contextTabs = await loadContextTabs(targetContext);
-   } else {
-     contextTabs = tabsByContext[targetContext] || [];
-     console.log('[TabContext] Context already loaded:', {
-       contextKey: targetContext,
-       tabCount: contextTabs.length,
-     });
-   }
+   // Always load from disk (source of truth)
+   contextTabs = await readTabsFromDisk(targetContext);
+   if (contextTabs.length > 0) {
+     setTabsByContext(prev => ({ ...prev, [targetContext]: contextTabs }));
+   }

    // ... rest of function
  }, [/* ... */]);
```

### Step 4: Remove `restoreContext` Logging

**File**: `src/app/TabContext.tsx`

**Remove from `updateCurrentTabInContext`** (line 911):
```diff
  console.log('[TabContext] updateCurrentTabInContext: OVERWRITING current tab', {
    currentTabId: activeTabId,
    newResource: resourceData,
    newTitle: title,
-   restoreContextIgnored: options?.restoreContext,
  });
```

### Step 5: Update `openInNewTab` to Use Disk

**Optional**: For consistency, update `openInNewTab` to also read from disk when checking if context exists:

```diff
  // Check if we need to switch context
  if (targetContext !== activeContext) {
-   const targetTabs = tabsByContext[targetContext] || [];
-   const contextExists = targetTabs.length > 0;
+   const targetTabs = await readTabsFromDisk(targetContext);
+   const contextExists = targetTabs.length > 0;

    // If restoreContext is true and context exists, just switch to it
    if (restoreContext && contextExists) {
      console.log('[TabContext] RESTORE PATH: restoreContext=true && contextExists=true → switching context');
+     setTabsByContext(prev => ({ ...prev, [targetContext]: targetTabs }));
      switchContext(targetContext);
      return;
    }
    // ...
  }
```

---

## Testing Plan

### Test Case 1: Cross-Context Navigation with Existing Tabs

**Setup**:
1. blueKit project has `tabs.json` with 2 tabs: "Kits" (active) and "Agent"
2. User is in Library/Vault viewing projects list

**Action**: Click blueKit project card

**Expected Console Logs**:
```
[TabContext] openInCurrentTab called
[TabContext] Target context: project:1763859627143
[TabContext] readTabsFromDisk: project:1763859627143
[TabContext] Loaded tabs from disk: { tabCount: 2, tabs: [{title: "Kits"}, {title: "Agent"}] }
[TabContext] Restoring tabs from disk
[TabContext] Switching context: { from: "project:db377353...", to: "project:1763859627143" }
[TabContext] Restoring active tab: tab_0a978cca
```

**Expected Result**: User sees "Kits" view (their last state), NOT "File Tree"

### Test Case 2: Cross-Context with No Tabs

**Setup**:
1. New project has no `tabs.json` file
2. User is in Library

**Action**: Click new project card

**Expected**:
```
[TabContext] readTabsFromDisk: project:new-project-id
[TabContext] Failed to read tabs (file may not exist)
[TabContext] No tabs on disk, creating default tab
```

**Result**: Creates default empty tab

### Test Case 3: Same-Context Navigation

**Setup**: Already in blueKit project viewing "Kits"

**Action**: Click on "Walkthroughs" in sidebar

**Expected**:
```
[TabContext] SAME CONTEXT: updating current tab
[TabContext] updateCurrentTabInContext: OVERWRITING current tab
```

**Result**: Current tab changes from "Kits" to "Walkthroughs" (same tab ID)

---

## Migration Notes

### Breaking Changes

None for users - this is an internal refactor.

### Performance Impact

**Before**: Check in-memory cache (instant), conditionally read file
**After**: Always read file (~1-2ms)

Net impact: ~1-2ms added latency on navigation, which is imperceptible.

### Code Complexity

**Before**: ~100 lines of complex branching logic
**After**: ~30 lines of straightforward "read → use or create"

**Maintenance**: Much easier to reason about and debug.

---

## Success Criteria

- ✅ Navigation from Library → Project restores user's previous tab state
- ✅ First tab is NOT overwritten with `view: 'file'`
- ✅ New projects (no tabs.json) get default empty tab
- ✅ `restoreContext` option removed from codebase
- ✅ `loadedContextsRef` removed from codebase
- ✅ Console logs show "Loaded tabs from disk" every navigation
- ✅ No regressions in tab switching, creation, or closing
- ✅ All existing tests pass (if any)

---

## Follow-Up Work

After this simplification:
1. Complete Phase 5 (spotlight popover for new tabs)
2. Remove remaining debugging console.logs
3. Consider caching strategy if file reads become a bottleneck (unlikely)

---

## References

- **Issue Discovery**: Traced during walkthrough documentation (`tab-navigation-system.md`)
- **Root Cause**: Lines 1120-1142 in `TabContext.tsx` (overwrite first tab logic)
- **Related Phase**: Phase 5 (Tab Navigation Refinement)
