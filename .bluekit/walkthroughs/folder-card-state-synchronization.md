---
id: folder-card-state-synchronization
alias: FolderCard State Synchronization Guide
type: walkthrough
is_base: false
version: 1
tags:
  - react
  - state-management
  - performance
description: Deep dive into how FolderCard handles rendering during additions/deletions using useDeferredValue, automatic folder reloads, and synchronized state updates
complexity: comprehensive
format: guide
---
# FolderCard State Synchronization Guide

## Overview

The FolderCard component displays collapsible folders containing artifacts (kits, walkthroughs, diagrams) with real-time updates via file watchers. However, coordinating state updates between parent (artifacts) and child (folders) components created a critical challenge: **premature state updates causing flickering and UI reversions**.

This walkthrough explains:
- Why folders and artifacts must stay synchronized
- How `useDeferredValue` delays state updates
- The timing issue that caused flickering
- The automatic folder reload mechanism that fixed it

## Table of Contents

- [The Architecture](#the-architecture)
- [The Problem: Asymmetric State Updates](#the-problem-asymmetric-state-updates)
- [Root Cause: Premature Folder Reloads](#root-cause-premature-folder-reloads)
- [The Solution: Automatic Synchronization](#the-solution-automatic-synchronization)
- [Implementation Details](#implementation-details)
- [Flow Diagrams](#flow-diagrams)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## The Architecture

### Component Hierarchy

```
ProjectDetailPage (Parent)
├── artifacts: ArtifactFile[]        // Source of truth
├── deferredArtifacts                // Delayed version via useDeferredValue
└── kitsOnly, walkthroughs, diagrams // Filtered by type
    ↓
KitsTabContent / WalkthroughsTabContent / DiagramsTabContent (Child)
├── kits/walkthroughs/diagrams prop (from parent's deferredArtifacts)
├── folders: ArtifactFolder[]        // Child's local state
└── folderTree: FolderTreeNode[]     // Built from folders + artifacts
    ↓
FolderCard
├── Displays folder with artifacts
└── Shows artifacts grouped by folder structure
```

### Two Independent Data Sources

This architecture has **two separate state sources**:

1. **Artifacts** (managed by parent):
   - Source: `ProjectDetailPage.tsx:40-50`
   - Updated by: File watcher events
   - Contains: Kit/walkthrough/diagram files with full paths
   - Example: `{ path: '.bluekit/kits/ui-components/button.md', name: 'button.md', ... }`

2. **Folders** (managed by child):
   - Source: `KitsTabContent.tsx:55` (useState)
   - Updated by: `invokeGetArtifactFolders()` calls
   - Contains: Folder structure and metadata
   - Example: `{ path: '.bluekit/kits/ui-components', name: 'ui-components', config: {...} }`

### The Synchronization Challenge

When moving an artifact to/from a folder:
- **Artifact paths change** (e.g., `kits/button.md` → `kits/ui-components/button.md`)
- **Folder structure may change** (new subfolder created)
- **Both sources must update** before UI can render correctly

If they update at different times → **state mismatch** → **UI glitches**

## The Problem: Asymmetric State Updates

### Symptom

Users reported flickering behavior:

**Adding kit to folder:**
- Kit disappears from root list ✓ (correct)
- Kit appears in folder briefly
- **Kit disappears from folder** (wrong!)
- After navigating away and back, kit shows correctly

**Deleting folder:**
- Folder disappears ✓ (correct)
- Kits appear in folder briefly (wrong!)
- **Kits disappear** (wrong!)
- After reload, kits show in root list ✓

Both scenarios showed the same pattern: **items appear briefly, then disappear**.

### Why It Looked Different

The visual symptoms differed, but the root cause was identical:

| Operation | Visual Effect | Root Cause |
|-----------|---------------|------------|
| Add to folder | Item appears then disappears | Premature folder reload before artifacts sync |
| Delete folder | Items appear then disappear | Premature folder reload before artifacts sync |
| Edit folder | Same flickering | Premature folder reload before artifacts sync |

The "asymmetry" was only visual - both had the **same timing issue**.

## Root Cause: Premature Folder Reloads

### The Timing Issue

Located in these lines:
- `KitsTabContent.tsx:265-266` (delete folder handler)
- `KitsTabContent.tsx:281-282` (edit folder handler)
- `WalkthroughsTabContent.tsx:270-271` (delete folder handler)
- `WalkthroughsTabContent.tsx:286-287` (edit folder handler)
- `DiagramsTabContent.tsx:218-219` (delete folder handler)
- `DiagramsTabContent.tsx:234-235` (edit folder handler)

**The Problem Code:**

```typescript
const handleConfirmDeleteFolder = async () => {
  await invokeDeleteArtifactFolder(deletingFolder.path);
  
  // ❌ PROBLEM: Premature folder reload
  const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
  setFolders(newFolders);
};
```

### Why This Caused Flickering

**Timeline of Events:**

```
T+0ms:   User deletes folder
         → invokeDeleteArtifactFolder (backend operation)
         → Backend moves files from folder to root on disk

T+50ms:  handleConfirmDeleteFolder executes
         → setFolders(newFolders) updates child state
         → Folders now reflect new structure (no folder)

T+60ms:  React renders with NEW folders but STALE kits
         → buildFolderTree(newFolders, staleKits)
         → Kits still have old paths (e.g., 'kits/folder/button.md')
         → Grouping logic can't find matching folder
         → Items disappear from UI

T+350ms: File watcher detects changes (300ms debounce in Rust)
         → Emits event with changed file paths

T+360ms: updateArtifactsIncremental runs
         → Reads changed files and updates artifacts state
         → setArtifacts(updatedArtifacts)

T+380ms: Parent state updates
         → BUT useDeferredValue delays propagation to children

T+480ms: deferredArtifacts finally updates
         → kits prop changes in child component
         → Triggers folder reload effect (100ms debounce)

T+580ms: Folders reload again
         → NOW folders + kits are synchronized
         → buildFolderTree works correctly
         → Items appear in correct location
```

**The Critical Problem:** Line T+60ms shows the mismatch - fresh folders with stale kits.

### The Role of useDeferredValue

In `ProjectDetailPage.tsx:50`:

```typescript
const deferredArtifacts = useDeferredValue(artifacts);
```

**Purpose:** Prevents UI blocking during expensive artifact updates (parsing front matter, etc.)

**Side Effect:** Creates a timing delay between:
1. Parent `artifacts` state updating (T+360ms)
2. Child receiving updated prop (T+480ms)

This 100-120ms delay is normally invisible, but when child components reload folders **before** this delay completes, we get state mismatch.

### Why buildFolderTree Failed

`buildFolderTree` (`src/utils/buildFolderTree.ts:36-45`) groups artifacts by parent directory:

```typescript
artifacts.forEach(artifact => {
  const parentDir = getParentDirectory(artifact.path);
  // parentDir = '.bluekit/kits/ui-components'
  
  if (!artifactsByFolder.has(parentDir)) {
    artifactsByFolder.set(parentDir, []);
  }
  artifactsByFolder.get(parentDir)!.push(artifact);
});
```

**With Fresh Folders + Stale Artifacts:**

```typescript
// Folders say: "ui-components folder exists at .bluekit/kits/ui-components"
folders = [{ path: '.bluekit/kits/ui-components', ... }]

// Artifacts say: "button.md is at .bluekit/kits/button.md" (old path!)
artifacts = [{ path: '.bluekit/kits/button.md', name: 'button.md' }]

// buildFolderTree result:
// - ui-components folder: [] (empty! no artifacts match this path)
// - Root kits: [button.md] (artifact at old path)
```

The artifact's `parentDir` is `.bluekit/kits` (root), not `.bluekit/kits/ui-components`, so it doesn't get grouped into the folder.

## The Solution: Automatic Synchronization

### Strategy

Instead of manually reloading folders after operations, let folders **automatically sync** when artifacts update:

1. Remove premature `setFolders()` calls from folder operations
2. Add artifact dependency to folder loading effect
3. Debounce folder reloads to prevent excessive calls
4. Let file watcher drive all state updates

### Implementation

**Step 1: Add Automatic Folder Reload** (`KitsTabContent.tsx:121-138`)

```typescript
// Load folders from backend
useEffect(() => {
  const loadFolders = async () => {
    try {
      const loadedFolders = await invokeGetArtifactFolders(projectPath, 'kits');
      setFolders(loadedFolders);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  // Debounce folder loading to avoid excessive calls when artifacts update rapidly
  const timeoutId = setTimeout(() => {
    loadFolders();
  }, 100); // 100ms debounce

  return () => clearTimeout(timeoutId);
}, [projectPath, kits]); // ← kits dependency triggers reload when artifacts change
```

**Key Points:**
- `kits` dependency means effect runs whenever parent updates kits
- 100ms debounce prevents rapid-fire reloads during multiple file changes
- Cleanup function cancels pending timeout on unmount

**Step 2: Remove Premature Reloads** (`KitsTabContent.tsx:264-266`)

```typescript
const handleConfirmDeleteFolder = async () => {
  await invokeDeleteArtifactFolder(deletingFolder.path);
  
  // ✅ Don't reload folders here - file watcher will update artifacts first,
  // then the folder reload effect (with kits dependency) will sync folders
  // Reloading now causes state mismatch with useDeferredValue
};
```

**Same pattern applied to:**
- `handleAddToFolder` (already fixed in previous commits)
- `handleConfirmDeleteFolder` ✓
- `handleFolderUpdated` ✓

### New Flow (After Fix)

**Deleting Folder:**

```
T+0ms:   User deletes folder
         → invokeDeleteArtifactFolder (backend)
         → Backend moves files to root on disk

T+50ms:  handleConfirmDeleteFolder completes
         → No setFolders() call (removed!)
         → Folder state unchanged (still has old folder)

T+350ms: File watcher detects changes
         → updateArtifactsIncremental runs
         → setArtifacts(updatedArtifacts)

T+380ms: Parent artifacts state updates
         → useDeferredValue delays propagation

T+480ms: deferredArtifacts updates
         → kits prop changes in child
         → Triggers folder reload effect

T+580ms: Effect's debounce completes (100ms)
         → invokeGetArtifactFolders executes
         → setFolders(newFolders)

T+600ms: React renders with SYNCHRONIZED data
         → buildFolderTree(newFolders, freshKits)
         → Both have updated paths
         → Items appear in correct location
         → No flickering!
```

**Critical Difference:** Folders update AFTER artifacts fully sync (including useDeferredValue delay).

## Implementation Details

### Component Locations

**Parent Component:**
- File: `src/pages/ProjectDetailPage.tsx`
- Manages: `artifacts` state, file watcher, optimistic updates
- Key lines:
  - 40: `const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);`
  - 50: `const deferredArtifacts = useDeferredValue(artifacts);`
  - 127-230: File watcher setup and incremental updates

**Child Components:**
- Files: 
  - `src/components/kits/KitsTabContent.tsx`
  - `src/components/walkthroughs/WalkthroughsTabContent.tsx`
  - `src/components/diagrams/DiagramsTabContent.tsx`
- Manage: `folders` state, local UI state
- Key pattern: Automatic folder reload effect with debouncing

**Shared Logic:**
- File: `src/utils/buildFolderTree.ts`
- Function: `buildFolderTree(folders, artifacts, type, projectPath)`
- Returns: `FolderTreeNode[]` with hierarchical structure

**Display Component:**
- File: `src/components/shared/FolderCard.tsx`
- Props: `node`, `onToggleExpand`, `onViewArtifact`, `onAddToFolder`, etc.
- Features: Collapsible UI, checkbox selection, 3-dot menu

### Debounce Timing Strategy

**Backend (Rust):**
- File watcher: 300ms debounce (`src-tauri/src/watcher.rs:26`)
- Batches multiple file changes into single event
- Example: Moving 5 files triggers ONE event after 300ms

**Frontend (TypeScript):**
- Parent reload: 200ms debounce (`ProjectDetailPage.tsx:129`)
- Child folder reload: 100ms debounce (`KitsTabContent.tsx:133`)

**Why Different Timings:**
- Backend: Longer delay (300ms) batches disk operations
- Parent: Medium delay (200ms) batches file watcher events
- Child: Shorter delay (100ms) responds quickly to prop changes

**Total Delay Calculation:**
```
Backend watcher fires: 300ms
+ Parent debounce: 200ms
+ useDeferredValue: ~100ms
+ Child debounce: 100ms
= ~700ms total from file change to final UI update
```

This feels instant to users while preventing performance issues.

### Optimistic Updates

For immediate feedback, `handleAddToFolder` uses optimistic updates:

**Pattern** (`KitsTabContent.tsx:143-197`):

```typescript
const handleAddToFolder = async (folder: ArtifactFolder) => {
  const rollbacks: (() => void)[] = [];

  try {
    // 1. Optimistically update UI immediately
    for (const item of selectedKits) {
      if (item.path && onOptimisticMove) {
        const rollback = onOptimisticMove(item.path, folder.path);
        rollbacks.push(rollback);
      }
    }

    // 2. Expand folder to show new items
    if (!expandedFolders.has(folder.path)) {
      setExpandedFolders(prev => new Set(prev).add(folder.path));
    }

    // 3. Perform backend operation
    for (const item of selectedKits) {
      const newPath = await invokeMoveArtifactToFolder(item.path, folder.path);
      if (onConfirmMove) {
        onConfirmMove(item.path, newPath);
      }
    }

    // 4. NO folder reload here! Let automatic sync handle it

    clearSelection();
  } catch (err) {
    // Rollback on error
    rollbacks.forEach(rollback => rollback());
    throw err;
  }
};
```

**Benefits:**
- User sees immediate visual feedback (< 50ms)
- Backend confirms actual file paths (< 200ms)
- Automatic sync ensures consistency (< 700ms)
- Error handling rolls back optimistic changes

## Flow Diagrams

### Before Fix: Premature Reload (Flickering)

```
User Action: Delete Folder
         ↓
┌────────────────────────────────────────────────┐
│ handleConfirmDeleteFolder                      │
│ 1. invokeDeleteArtifactFolder (backend)        │
│ 2. setFolders(newFolders) ← PREMATURE!        │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ React Render (T+60ms)                          │
│ buildFolderTree(NEW folders, STALE kits)       │
│ Result: Items disappear! ❌                    │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ File Watcher (T+350ms)                         │
│ updateArtifactsIncremental                     │
│ setArtifacts(updated)                          │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ useDeferredValue Delay (T+480ms)               │
│ kits prop finally updates                      │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ Folder Reload Effect (T+580ms)                 │
│ setFolders(newFolders) ← Too late!            │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ React Render (T+600ms)                         │
│ buildFolderTree(NEW folders, FRESH kits)       │
│ Result: Items appear correctly ✅              │
│ But user saw flicker from T+60ms to T+600ms!  │
└────────────────────────────────────────────────┘
```

### After Fix: Automatic Sync (Smooth)

```
User Action: Delete Folder
         ↓
┌────────────────────────────────────────────────┐
│ handleConfirmDeleteFolder                      │
│ 1. invokeDeleteArtifactFolder (backend)        │
│ 2. NO setFolders() call ✅                     │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ File Watcher (T+350ms)                         │
│ updateArtifactsIncremental                     │
│ setArtifacts(updated)                          │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ useDeferredValue Delay (T+480ms)               │
│ kits prop updates in child                    │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ Folder Reload Effect Triggers (T+480ms)        │
│ 100ms debounce starts                          │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ Debounce Completes (T+580ms)                   │
│ invokeGetArtifactFolders                       │
│ setFolders(newFolders)                         │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ React Render (T+600ms)                         │
│ buildFolderTree(NEW folders, FRESH kits)       │
│ Result: Items appear correctly ✅              │
│ User never sees flicker! 🎉                    │
└────────────────────────────────────────────────┘
```

### Add to Folder with Optimistic Updates

```
User Action: Add Kit to Folder
         ↓
┌────────────────────────────────────────────────┐
│ handleAddToFolder                              │
│ 1. onOptimisticMove (immediate UI update)      │
│    - Remove from root list                     │
│    - Add to folder with predicted path         │
│ 2. Expand folder (immediate visual feedback)   │
└────────────────────────────────────────────────┘
         ↓ (User sees change at T+50ms)
┌────────────────────────────────────────────────┐
│ Backend Operation (T+50ms - T+200ms)           │
│ invokeMoveArtifactToFolder                     │
│ Returns actual new path                        │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ onConfirmMove (T+200ms)                        │
│ Update optimistic path → actual path           │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ File Watcher (T+550ms)                         │
│ updateArtifactsIncremental                     │
│ Confirms backend state                         │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ Automatic Folder Sync (T+780ms)                │
│ Folders reload after kits prop updates         │
│ Final state matches reality ✅                 │
└────────────────────────────────────────────────┘
```

## Best Practices

### ✅ Do This

1. **Always sync folders after artifacts update**
   ```typescript
   useEffect(() => {
     // Reload folders when artifacts change
     const timeoutId = setTimeout(loadFolders, 100);
     return () => clearTimeout(timeoutId);
   }, [projectPath, kits]); // Include artifact dependency
   ```

2. **Use debouncing for effects triggered by props**
   ```typescript
   // Prevents excessive calls during rapid updates
   const timeoutId = setTimeout(expensiveOperation, 100);
   ```

3. **Let file watchers drive state updates**
   - Don't manually reload after file operations
   - Trust the watcher to detect changes
   - Use optimistic updates for immediate feedback

4. **Consider useDeferredValue timing**
   - Allow 100-200ms for deferred values to propagate
   - Don't assume parent state === child prop immediately

5. **Build with synchronized data**
   ```typescript
   const folderTree = useMemo(() => {
     // folders and kits must be in sync!
     return buildFolderTree(folders, filteredKits, 'kits', projectPath);
   }, [folders, filteredKits, projectPath]);
   ```

### ❌ Don't Do This

1. **Don't reload folders immediately after file operations**
   ```typescript
   // ❌ BAD: Premature reload
   await invokeMoveArtifactToFolder(path, folder);
   const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
   setFolders(newFolders); // Too early! Artifacts haven't synced yet
   ```

2. **Don't assume state synchronization is instant**
   ```typescript
   // ❌ BAD: Assuming artifacts updated
   await fileOperation();
   buildFolderTree(folders, kits); // kits might be stale!
   ```

3. **Don't skip debouncing on rapid-fire effects**
   ```typescript
   // ❌ BAD: No debounce
   useEffect(() => {
     loadFolders(); // Fires on every kits change!
   }, [kits]);
   ```

4. **Don't mix manual reloads with automatic effects**
   ```typescript
   // ❌ BAD: Redundant reloads
   const handleOperation = async () => {
     await fileOperation();
     loadFolders(); // Manual reload
     // Effect will also reload when kits updates → double reload!
   };
   ```

5. **Don't forget cleanup functions**
   ```typescript
   // ❌ BAD: Memory leak risk
   useEffect(() => {
     const timeoutId = setTimeout(loadFolders, 100);
     // Missing: return () => clearTimeout(timeoutId);
   }, [kits]);
   ```

### 💡 Pro Tips

**Tip 1: Visualize State Dependencies**

Draw the data flow before implementing:
```
Parent Artifacts → useDeferredValue → Child Prop
                                          ↓
                                    Trigger Effect
                                          ↓
                                    Load Folders
                                          ↓
                                  Build Folder Tree
```

**Tip 2: Use React DevTools Profiler**

Identify unnecessary re-renders:
1. Open React DevTools → Profiler tab
2. Record a folder operation
3. Look for components rendering multiple times
4. Add `React.memo` or optimize dependencies

**Tip 3: Log Timing in Development**

Add debug logs to understand timing:
```typescript
useEffect(() => {
  console.log('[FolderSync] Kits changed, scheduling folder reload');
  const timeoutId = setTimeout(() => {
    console.log('[FolderSync] Loading folders...');
    loadFolders();
  }, 100);
  return () => clearTimeout(timeoutId);
}, [kits]);
```

**Tip 4: Test Edge Cases**

- Moving multiple items at once (batch operations)
- Rapidly adding/removing items (debounce stress test)
- Deleting folder with nested subfolders (recursive operations)
- Network errors during file operations (rollback logic)

## Troubleshooting

### Issue: Items Still Flickering

**Symptom:** Items appear then disappear when moving to/from folders

**Possible Causes:**

1. **Premature folder reload still exists**
   - Check for `invokeGetArtifactFolders` calls in folder operation handlers
   - Search for `setFolders(newFolders)` in `handleAddToFolder`, `handleConfirmDeleteFolder`, `handleFolderUpdated`
   - Remove any found instances

2. **Missing artifact dependency**
   - Verify folder reload effect has artifact dependency: `[projectPath, kits]`
   - Check in all three tab components (Kits, Walkthroughs, Diagrams)

3. **Debounce timing too short**
   - Increase debounce from 100ms to 200ms in folder reload effect
   - Check if `useDeferredValue` delay is longer than expected

**Fix:**
```typescript
useEffect(() => {
  const timeoutId = setTimeout(() => {
    loadFolders();
  }, 200); // Increased from 100ms
  return () => clearTimeout(timeoutId);
}, [projectPath, kits]);
```

### Issue: Folders Not Updating After File Changes

**Symptom:** Manual page reload required to see folder changes

**Possible Causes:**

1. **File watcher not running**
   - Check console for watcher setup logs
   - Verify `invokeWatchProjectArtifacts` was called
   - Check Rust backend logs for watcher errors

2. **Effect not triggering**
   - Verify `kits` prop is actually changing (use React DevTools)
   - Check if `deferredArtifacts` is updating in parent
   - Look for memo comparison issues preventing prop changes

3. **Cleanup canceling too aggressively**
   - Check if component unmounts before debounce completes
   - Verify timeout cleanup isn't canceling legitimate updates

**Fix:**
```typescript
// Add debug logging
useEffect(() => {
  console.log('[Debug] Kits changed:', kits.length, 'items');
  const timeoutId = setTimeout(() => {
    console.log('[Debug] Loading folders...');
    loadFolders().then(() => {
      console.log('[Debug] Folders loaded successfully');
    });
  }, 100);
  return () => {
    console.log('[Debug] Cleaning up folder reload timeout');
    clearTimeout(timeoutId);
  };
}, [projectPath, kits]);
```

### Issue: Excessive Backend Calls

**Symptom:** Console shows many `invokeGetArtifactFolders` calls in rapid succession

**Possible Causes:**

1. **Debounce not working**
   - Verify timeout cleanup function is present
   - Check if effect re-runs before debounce completes

2. **Artifacts updating too frequently**
   - File watcher may be too sensitive
   - Parent may be setting artifacts multiple times per operation

3. **Multiple components reloading**
   - All three tab components reload on mount
   - Switching tabs triggers folder reloads

**Fix:**
```typescript
// Increase debounce time
const timeoutId = setTimeout(loadFolders, 300); // Increased from 100ms

// Or add a ref to track last load
const lastLoadRef = useRef(0);
useEffect(() => {
  const now = Date.now();
  if (now - lastLoadRef.current < 500) return; // Skip if loaded recently
  
  const timeoutId = setTimeout(() => {
    lastLoadRef.current = Date.now();
    loadFolders();
  }, 100);
  return () => clearTimeout(timeoutId);
}, [kits]);
```

### Issue: Optimistic Updates Not Rolling Back on Error

**Symptom:** UI shows incorrect state after failed file operation

**Possible Causes:**

1. **Rollback function not called**
   - Check error handling in `handleAddToFolder`
   - Verify `catch` block calls `rollbacks.forEach(rollback => rollback())`

2. **Rollback function incorrect**
   - Verify `onOptimisticMove` returns proper rollback function
   - Check if rollback restores original state

3. **Error swallowed silently**
   - Look for `catch` blocks that don't re-throw
   - Check if errors are logged to console

**Fix:**
```typescript
try {
  // Optimistic updates
  for (const item of selectedKits) {
    const rollback = onOptimisticMove(item.path, folder.path);
    rollbacks.push(rollback);
  }
  
  // Backend operation
  await invokeMoveArtifactToFolder(item.path, folder.path);
} catch (err) {
  console.error('Operation failed:', err);
  
  // CRITICAL: Rollback ALL optimistic updates
  rollbacks.forEach(rollback => rollback());
  
  // Show error to user
  toaster.create({
    type: 'error',
    title: 'Failed to move items',
    description: err instanceof Error ? err.message : 'Unknown error',
  });
  
  // Re-throw to prevent continuing
  throw err;
}
```

## Summary

### Key Takeaways

1. **Two-Source Synchronization:** Artifacts (parent) and folders (child) must stay in sync for correct UI rendering

2. **useDeferredValue Timing:** Creates 100-200ms delay between parent state update and child prop update

3. **Premature Reloads Cause Flickering:** Loading folders before artifacts sync creates state mismatch

4. **Automatic Sync Pattern:** Let artifacts drive folder reloads via effect dependencies

5. **Debouncing Prevents Thrashing:** 100ms debounce in folder reload effect prevents excessive backend calls

6. **Optimistic Updates for UX:** Immediate visual feedback while waiting for backend confirmation

### The Fix in One Sentence

**Remove manual folder reloads from operation handlers; instead, add artifact dependencies to folder reload effects with debouncing.**

### Files Modified

- `src/components/kits/KitsTabContent.tsx`
  - Lines 121-138: Automatic folder reload effect
  - Lines 264-266: Removed from delete handler
  - Lines 280-283: Removed from edit handler

- `src/components/walkthroughs/WalkthroughsTabContent.tsx`
  - Lines 127-144: Automatic folder reload effect  
  - Lines 269-271: Removed from delete handler
  - Lines 285-288: Removed from edit handler

- `src/components/diagrams/DiagramsTabContent.tsx`
  - Lines 79-96: Automatic folder reload effect
  - Lines 217-219: Removed from delete handler
  - Lines 233-236: Removed from edit handler

### Related Documentation

- **File Watching System:** See `.bluekit/walkthroughs/documentation/file-watching-system.md`
- **IPC Communication:** See `.bluekit/walkthroughs/guide/understanding-tauri-ipc.md`
- **React Performance:** See official React docs on `useDeferredValue` and `useMemo`
- **Chakra UI Animations:** See `.bluekit/walkthroughs/color-mode-theming-system.md` for transition patterns

---

**Last Updated:** 2025-12-08  
**Version:** 1.0  
**Contributors:** Claude Sonnet 4.5
