# Phase 6: Eliminate Context Decision Logic

> **Prerequisites**: Phase 5.1 (Simplified Tab Context Architecture)

## Problem Statement

Phase 5.1 fixed the mechanism (always read from disk) but we're still carrying unnecessary **decision logic** from the old caching model.

### Current Issues

**Issue 1: Redundant `restoreContext` Flag**

The `restoreContext` option is passed everywhere but serves no purpose when disk is source of truth:

```typescript
openInNewTab({ type: 'library' }, { restoreContext: true });
//                                   ^^^^^^^^^^^^^^^^^^
//                                   Why? Disk always has the answer.
```

**Question:** "Should I restore context or create new?"
**Answer:** Read the file. It tells you what tabs exist.

**Issue 2: Complex Branching in Navigation Functions**

`openInNewTab` has elaborate logic checking if context exists:

```typescript
const targetTabs = await readTabsFromDisk(targetContext);
const contextExists = targetTabs.length > 0;

if (restoreContext && contextExists) {
  switchContext(targetContext);
  return;
}

// More branching about existing tabs, creating new, etc.
```

**Why is this complex?** Because we're trying to *decide* what to do based on what's on disk, when we should just **use** what's on disk.

**Issue 3: Double Reads**

`openInNewTab` reads from disk to check if context exists, then `switchContext` reads again:

```typescript
// Read 1: Check if context exists
const targetTabs = await readTabsFromDisk(targetContext);

if (restoreContext && contextExists) {
  // Read 2: switchContext reads again
  switchContext(targetContext);
}
```

This is a code smell indicating we're asking the wrong questions.

---

## The Insight

**Current mental model:**
"Check if context exists → decide whether to restore or create → do the thing"

**Correct mental model:**
"Switch to context → disk tells me what tabs exist → done"

The file **is** the decision. We don't need to check it, branch on it, or have flags about it. Just read it and use it.

---

## Core Principles

### Principle 1: Separation of Concerns

Navigation functions are trying to do too much. Separate:

- **Context switching** (`switchContext`) - changes active context, loads tabs from disk
- **Tab creation** (`createTab`) - adds new tab to current context
- **Tab navigation** (`openInNewTab`, `openInCurrentTab`) - coordinate the above

### Principle 2: Disk as Authority

Never ask "does context exist?" or "should I restore?"
Always: "What does the file say?" → use that.

### Principle 3: No Predictive Logic

Don't try to predict what *should* be in the context.
Read what *is* in the context and work with that.

---

## Solution Architecture

### New Navigation Flow

**Simplified `openInNewTab`:**

```typescript
const openInNewTab = useCallback(async (resource: TabResourceInput, options?: TabCreateOptions) => {
  const targetContext = getContextKey(resource);

  if (targetContext !== activeContext) {
    // Different context - just switch
    await switchContext(targetContext);
  }

  // Now create the new tab in current context (after switch if needed)
  createTab(resource, options);
}, [activeContext, createTab, getContextKey, switchContext]);
```

**That's it.** No:
- `restoreContext` checks
- `readTabsFromDisk` to check if context exists
- Branching on "contextExists"
- Special handling for "if tabs exist vs don't exist"

`switchContext` handles all of that by reading the file.

### Simplified `openInCurrentTab`

**Current implementation:**
```typescript
if (targetContext !== activeContext) {
  // Cross-context: Just switch - switchContext reads from disk
  switchContext(targetContext);
} else {
  // Same context - update current tab
  updateCurrentTabInContext(resource, options);
}
```

**Even simpler:**
```typescript
const openInCurrentTab = useCallback(async (resource: TabResourceInput, options?: TabCreateOptions) => {
  const targetContext = getContextKey(resource);

  if (targetContext !== activeContext) {
    // Switch context - disk will restore tabs
    await switchContext(targetContext);
  } else {
    // Same context - update current tab content
    updateCurrentTabInContext(resource, options);
  }
}, [activeContext, getContextKey, switchContext, updateCurrentTabInContext]);
```

### `switchContext` Stays Simple

```typescript
const switchContext = useCallback(async (contextKey: string) => {
  // Resolve vault alias
  let targetContext = contextKey;
  if (contextKey === 'library') {
    const vaultId = await ensureVaultId();
    targetContext = `project:${vaultId}`;
  }

  // Read from disk - source of truth
  let contextTabs = await readTabsFromDisk(targetContext);

  if (contextTabs.length > 0) {
    // Tabs exist - use them
    setTabsByContext(prev => ({ ...prev, [targetContext]: contextTabs }));
  } else {
    // No tabs - create default empty tab
    const defaultTab = createDefaultTab(targetContext);
    contextTabs = [defaultTab];
    setTabsByContext(prev => ({ ...prev, [targetContext]: contextTabs }));
  }

  // Switch context
  setActiveContext(targetContext);

  // Restore last active tab
  const lastActiveTab = lastActiveTabByContext[targetContext];
  const tabToActivate = lastActiveTab && contextTabs.some(t => t.id === lastActiveTab)
    ? lastActiveTab
    : contextTabs[0]?.id;

  if (tabToActivate) {
    setActiveTab(tabToActivate, targetContext);
  }
}, [readTabsFromDisk, createDefaultTab, setTabsByContext, lastActiveTabByContext, setActiveTab, ensureVaultId]);
```

**Key point:** `switchContext` doesn't care *why* you're switching or *what* you plan to do after. It just switches and loads what's on disk.

---

## Implementation Steps

### Step 1: Remove `restoreContext` Option

**File**: `src/app/TabContext.tsx`

**Remove from `TabCreateOptions` interface:**
```diff
  interface TabCreateOptions {
    title?: string;
    icon?: string;
    closable?: boolean;
    pinned?: boolean;
    dirty?: boolean;
-   restoreContext?: boolean;
    forceNew?: boolean;
  }
```

### Step 2: Simplify `openInNewTab`

**File**: `src/app/TabContext.tsx`

**Replace entire function:**

```typescript
const openInNewTab = useCallback(
  async (resource: TabResourceInput, options?: TabCreateOptions) => {
    const targetContext = getContextKey(resource);
    const forceNew = options?.forceNew ?? false;

    console.log('[TabContext] openInNewTab called', {
      resource,
      options,
      targetContext,
      activeContext,
      forceNew,
    });

    // Check if we need to switch context
    if (targetContext !== activeContext) {
      console.log('[TabContext] Different context - switching first');
      await switchContext(targetContext);
    }

    // Now in correct context - check if tab already exists (unless forceNew)
    if (!forceNew) {
      const tabs = tabsByContext[targetContext] || [];
      const existingTab = tabs.find((tab) => {
        // Tab matching logic (same as before)
        if (resource.type === 'file' && tab.resource?.path === resource.path) return true;
        if (resource.type === 'kit' && tab.resource?.kitId === resource.kitId) return true;
        // ... etc
        return false;
      });

      if (existingTab) {
        console.log('[TabContext] Tab already exists, activating it:', existingTab.id);
        setActiveTab(existingTab.id, targetContext);
        return;
      }
    }

    // Create new tab in current context
    console.log('[TabContext] Creating new tab');
    createTab(resource, options);
  },
  [activeContext, createTab, getContextKey, setActiveTab, switchContext, tabsByContext]
);
```

**What's removed:**
- ❌ `readTabsFromDisk` call to check if context exists
- ❌ `restoreContext` flag and branching
- ❌ `contextExists` variable
- ❌ Complex "if restore && exists then switch else create" logic

**What remains:**
- ✅ Switch context if needed (disk handles restore)
- ✅ Check if tab already exists (to avoid duplicates)
- ✅ Create new tab

### Step 3: Verify `openInCurrentTab` is Already Simple

**File**: `src/app/TabContext.tsx`

The current implementation should already be simple after Phase 5.1:

```typescript
const openInCurrentTab = useCallback(
  async (resource: TabResourceInput, options?: TabCreateOptions) => {
    if (!activeTabId) {
      createTab(resource, options);
      return;
    }

    const targetContext = getContextKey(resource);

    if (targetContext !== activeContext) {
      // Cross-context: Just switch
      await switchContext(targetContext);
    } else {
      // Same context: Update current tab
      updateCurrentTabInContext(resource, options);
    }
  },
  [activeContext, activeTabId, createTab, getContextKey, switchContext, updateCurrentTabInContext]
);
```

**No changes needed** - it's already simplified.

### Step 4: Update All Callers to Remove `restoreContext`

**Files to update:**

1. **`src/app/TabContent.tsx`**
   ```diff
   const openLibraryTab = useCallback(() => {
   - openInNewTab({ type: 'library', view: 'projects' }, { title: 'New Tab', restoreContext: true });
   + openInNewTab({ type: 'library', view: 'projects' }, { title: 'New Tab' });
   }, [openInNewTab]);
   ```

2. **`src/app/TabContent.tsx`** (handleProjectSelectNewTab)
   ```diff
   openInNewTab(
     { type: 'project', projectId: project.id, view: project.isVault ? 'projects' : 'file' },
   - { title: project.name, restoreContext: true }
   + { title: project.name }
   );
   ```

3. **Search for all instances:**
   ```bash
   grep -r "restoreContext" src/
   ```
   Remove from all call sites.

### Step 5: Remove Unused Variables in `openInNewTab`

After simplification, `openInNewTab` should not have:
- `targetTabs` variable
- `contextExists` variable
- `restoreContext` variable

Verify with TypeScript that no unused variables remain.

### Step 6: Update Dependencies

**`openInNewTab` dependencies should be:**
```typescript
[activeContext, createTab, getContextKey, setActiveTab, switchContext, tabsByContext]
```

**Remove:**
- ❌ `readTabsFromDisk` (no longer called directly)

---

## Testing Plan

### Test Case 1: Navigate Library → Project

**Setup:**
1. User is in Library (vault)
2. blueKit project has `tabs.json` with 2 tabs: "Kits" and "Agent"

**Action:** Click blueKit project card

**Expected Flow:**
```
[TabContent] handleProjectSelectCurrentTab
[TabContext] openInCurrentTab called
[TabContext] Different context - switching
[TabContext] switchContext: reading from disk
[TabContext] Loaded tabs from disk: { tabCount: 2 }
[TabContext] Switching context to project:1763859627143
[TabContext] Restoring active tab: tab_0a978cca
```

**Result:** User sees "Kits" tab (their last state)

### Test Case 2: Navigate Project → Library

**Setup:**
1. User is in blueKit project
2. Library has 3 tabs in `tabs.json`

**Action:** Click back arrow

**Expected Flow:**
```
[TabContent] openLibraryTab
[TabContext] openInNewTab called
[TabContext] Different context - switching
[TabContext] switchContext: reading from disk
[TabContext] Loaded tabs from disk: { tabCount: 3 }
[TabContext] Restoring active tab: tab_40bfe062
```

**Result:** User sees all 3 library tabs restored

### Test Case 3: New Project (No tabs.json)

**Setup:**
1. User clicks on brand new project
2. Project has no `.bluekit/workspace/tabs.json` file

**Action:** Click project card

**Expected Flow:**
```
[TabContext] openInCurrentTab called
[TabContext] Different context - switching
[TabContext] switchContext: reading from disk
[TabContext] Failed to read tabs (file may not exist)
[TabContext] No tabs on disk, creating default tab
[TabContext] Switching context
```

**Result:** User sees 1 default empty tab

### Test Case 4: Open New Tab in Same Context

**Setup:**
1. User is in blueKit project viewing "Kits"

**Action:** Press Cmd+T (new tab)

**Expected Flow:**
```
[TabContext] openInNewTab called
[TabContext] Same context (no switch needed)
[TabContext] Creating new tab
```

**Result:** New empty tab created, doesn't re-read from disk

---

## Success Criteria

- ✅ `restoreContext` option removed from codebase
- ✅ `openInNewTab` simplified to ~30 lines (down from ~80)
- ✅ No double disk reads (only `switchContext` reads)
- ✅ No "does context exist?" checks
- ✅ Navigation Library ↔ Project works flawlessly
- ✅ New projects (no tabs.json) get default tab
- ✅ TypeScript compiles with no errors
- ✅ All existing tests pass

---

## Code Complexity Metrics

**Before Phase 6:**
- `openInNewTab`: ~80 lines with nested branching
- Variables: `targetTabs`, `contextExists`, `restoreContext`, `forceNew`
- Logic paths: 4+ different branches

**After Phase 6:**
- `openInNewTab`: ~30 lines, linear flow
- Variables: `targetContext`, `forceNew`, `existingTab`
- Logic paths: 2 (switch context vs same context)

**Reduction:** ~60% less code, ~50% fewer logic paths

---

## Philosophical Note

This phase completes the mental model shift:

**Old model (Phases 1-4):**
"Cache contexts in memory, check cache, maybe load from disk"

**Phase 5.1 model:**
"Always read from disk, disk is source of truth"

**Phase 6 model:**
"Disk **is** the answer, not something to check and decide about"

The difference is subtle but profound:
- Phase 5.1: We read the file and then decide what to do
- Phase 6: We use what's in the file, period

No decisions. No flags. No branching. Just **use the file**.

---

## Follow-Up Work

After Phase 6:
1. Remove all console.log debugging statements
2. Update walkthrough documentation to reflect final architecture
3. Consider if `createDefaultTab` should be in `switchContext` or handled by UI layer
4. Performance profiling (though 1-2ms disk reads are negligible)

---

## References

- **Phase 5.1**: Simplified disk reads, removed `loadedContextsRef`
- **Root insight**: "Disk is source of truth" means no decision logic needed
- **Discussion**: User feedback on "why do we have context logic at all?"
