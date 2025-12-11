---
id: fixing-file-move-detection
alias: Fixing File Move Detection in Incremental Updates
type: walkthrough
is_base: false
version: 1
tags:
  - bug-fix
  - file-watcher
  - cache-invalidation
description: How we fixed the cache invalidation bug preventing moved artifacts from appearing in the UI after folder operations
complexity: comprehensive
format: guide
---
# Fixing File Move Detection in Incremental Updates

## Problem Summary

When users removed kits/walkthroughs from folders (moving them back to the root directory), the files would disappear from the folder but **never appear in the main list**. The UI would flicker rapidly, and logs showed the backend returning `0 changed artifacts` despite the file watcher detecting changes.

### Symptoms
- Kit removed from folder → doesn't show up in kits section
- Backend logs: `Received 0 changed artifacts`
- Watcher detects 3 files changed (old path, new path, config.json)
- Frontend state oscillating wildly (37 → 39 → 38 → 37)
- 8+ duplicate watcher events firing in rapid succession

## Root Cause Analysis

### Issue 1: Cache Invalidation Logic (Primary Bug)

**Location**: `src-tauri/src/commands.rs:459-516` (get_changed_artifacts)

The incremental update system uses a cache (`ArtifactCache`) to avoid re-reading files that haven't changed. When a file is moved:

```
Move operation: .bluekit/kits/folder/file.md → .bluekit/kits/file.md
```

The file system watcher detects **two paths**:
1. Old path: `.bluekit/kits/folder/file.md` (deleted)
2. New path: `.bluekit/kits/file.md` (created)

**The Bug (Before Fix)**:
```rust
// Line 470-480 (BROKEN)
if !path.exists() {
    cache.invalidate(&path).await;
    continue;  // Skip deleted files
}

// Check if file actually changed by comparing modification times
if cache.get_if_unchanged(&path).await.is_some() {
    continue;  // Skip if cache says "unchanged"
}
```

**What went wrong**:
1. Old path → doesn't exist → invalidate cache → **SKIP** ✅ (correct)
2. New path → exists → check cache → cache says "unchanged" (same mod time as when it was in folder) → **SKIP** ❌ (BUG!)

The file was physically moved (same inode, same content, same mod time on macOS), so the cache thought nothing changed. The backend returned `[]` to the frontend.

**The Fix**:
```rust
// Line 477-479 (FIXED)
// ALWAYS invalidate cache for changed paths to force re-read
// This ensures moved files are properly detected even if mod time unchanged
cache.invalidate(&path).await;
```

Now the flow is:
1. Old path → doesn't exist → invalidate cache → SKIP ✅
2. New path → exists → **FORCE invalidate cache** → re-read from disk → return artifact ✅

### Issue 2: React Strict Mode (Contributing Factor)

**Location**: `src/main.tsx:15` (removed)

React Strict Mode intentionally **double-mounts** components in development to detect side effects. This caused:

```
Component mounts → sets up file watcher
Component unmounts (Strict Mode)
Component mounts AGAIN → sets up ANOTHER file watcher
```

Result: **Multiple ProjectDetailPage instances**, each with its own watcher, all receiving the same events and fighting over the `artifacts` state.

**Evidence from logs**:
```
[Watcher] ⚠️ Event received but component unmounted (15+ times)
[UpdateIncremental] 💾 State updated with 37 total artifacts (x8)
```

**The Fix**:
```tsx
// Before (main.tsx:14-21)
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>  // ← REMOVED
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
);

// After
ReactDOM.createRoot(rootElement).render(
  <ChakraProvider value={system}>
    <App />
  </ChakraProvider>
);
```

## How the Incremental Update System Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │          ProjectDetailPage.tsx                        │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  1. Mount: loadProjectArtifacts()               │  │ │
│  │  │     - Full scan of .bluekit/ directory          │  │ │
│  │  │     - Returns ALL artifacts                     │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  2. Setup: watch_project_artifacts()            │  │ │
│  │  │     - Starts Rust file watcher                  │  │ │
│  │  │     - Listens for events                        │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  3. Event: updateArtifactsIncremental()         │  │ │
│  │  │     - Receives changed file paths               │  │ │
│  │  │     - Calls get_changed_artifacts()             │  │ │
│  │  │     - Merges changes into state                 │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕
                    Tauri IPC Layer
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                         Backend (Rust)                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │          watcher.rs (File System Watcher)             │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  - Uses notify crate (production-grade)         │  │ │
│  │  │  - 300ms debounce window                        │  │ │
│  │  │  - HashSet deduplication                        │  │ │
│  │  │  - Emits: project-artifacts-changed event       │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │          commands.rs (IPC Handlers)                   │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  get_changed_artifacts(paths)                   │  │ │
│  │  │  - Invalidate cache for each path              │  │ │
│  │  │  - Re-read file content                         │  │ │
│  │  │  - Parse YAML front matter                      │  │ │
│  │  │  - Return artifacts with metadata               │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │          cache.rs (ArtifactCache)                     │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  - Stores (path → (content, mod_time))          │  │ │
│  │  │  - invalidate(path): removes cache entry        │  │ │
│  │  │  - get_or_read(path): reads if missing/changed  │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Detailed Flow: File Move Operation

**Example**: User removes `view-mode-switcher.md` from `ui-components` folder

#### Step 1: Frontend Action (KitsTabContent.tsx)
```tsx
const handleAddToFolder = async (folderId: string) => {
  // Move file on disk
  await invokeMoveArtifactToFolder(selectedItems[0].path, folderId, 'kits');
  
  // REMOVED: onReload() call - let watcher handle it
  clearSelection();
};
```

#### Step 2: File System Changes
```
DELETE: .bluekit/kits/ui-components/view-mode-switcher.md
CREATE: .bluekit/kits/view-mode-switcher.md
UPDATE: .bluekit/kits/ui-components/config.json (remove from artifacts array)
```

#### Step 3: Rust Watcher Detection (watcher.rs)

**Debouncing (300ms window)**:
```rust
// Lines 254-290: Directory watcher event handling
loop {
    tokio::select! {
        event_result = rx.recv() => {
            match event_result {
                Some(Ok(event)) => {
                    // Check if any relevant files changed
                    let has_relevant_change = event.paths.iter().any(|p| {
                        if is_watched_file(p) {
                            // Only specific JSON files
                            if p.extension() == Some("json") {
                                is_watched_json(p)
                            } else {
                                true  // All .md files
                            }
                        } else {
                            false
                        }
                    });

                    if has_relevant_change {
                        for path in &event.paths {
                            debounce_state.pending_paths.insert(path.clone());
                        }
                        debounce_state.last_event_time = Instant::now();
                    }
                }
            }
        }

        // Debounce timer - emit after quiet period
        _ = sleep(Duration::from_millis(300)) => {
            if !debounce_state.pending_paths.is_empty() {
                // Convert HashSet to Vec<String>
                let changed_paths: Vec<String> = debounce_state.pending_paths
                    .iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();

                // Emit event to frontend
                app_handle.emit_all(&event_name, changed_paths)?;
                
                debounce_state.pending_paths.clear();
            }
        }
    }
}
```

**HashSet Deduplication**: 
- OS may emit multiple events for the same file (CREATE + MODIFY)
- HashSet automatically deduplicates: `[file.md, file.md] → [file.md]`

**Event Payload**:
```javascript
[
  "/path/to/.bluekit/kits/view-mode-switcher.md",           // new path
  "/path/to/.bluekit/kits/ui-components/config.json",       // folder config
  "/path/to/.bluekit/kits/ui-components/view-mode-switcher.md"  // old path (won't exist)
]
```

#### Step 4: Frontend Event Handler (ProjectDetailPage.tsx)

**Lines 233-248: Event listener**:
```tsx
unlisten = await listen<string[]>(eventName, (event) => {
  if (isMounted) {
    const changedPaths = event.payload;
    console.log('[Watcher] 📁 Artifacts directory changed');
    console.log('[Watcher] 📝', changedPaths.length, 'files changed:', changedPaths);
    
    if (changedPaths.length > 0) {
      updateArtifactsIncremental(changedPaths);
    }
  } else {
    console.log('[Watcher] ⚠️ Event received but component unmounted');
  }
});
```

#### Step 5: Incremental Update (ProjectDetailPage.tsx)

**Lines 100-206: updateArtifactsIncremental**:
```tsx
const updateArtifactsIncremental = async (changedPaths: string[]) => {
  console.log('[UpdateIncremental] 🔄 Starting incremental update');
  console.log('[UpdateIncremental] 📋 Changed paths:', changedPaths);

  try {
    console.log('[UpdateIncremental] 🔍 Fetching changed artifacts from backend...');
    
    // Call backend with changed paths
    const changedArtifacts = await invokeGetChangedArtifacts(
      project.path,
      changedPaths
    );
    
    console.log('[UpdateIncremental] ✅ Received', changedArtifacts.length, 'changed artifacts');

    // Use startTransition for non-blocking updates
    startTransition(() => {
      setArtifacts(prevArtifacts => {
        // Create a map of current artifacts (path → artifact)
        const updated = new Map(prevArtifacts.map(a => [a.path, a]));
        const seenPaths = new Set<string>();

        // Process each changed artifact
        changedArtifacts.forEach(newArtifact => {
          seenPaths.add(newArtifact.path);
          
          // Check if this file was moved (same name, different path)
          let oldPath: string | undefined;
          
          if (!updated.has(newArtifact.path)) {
            // New path not in current state - check for moves
            oldPath = prevArtifacts.find(a => {
              const currentPath = a.path;
              
              // Skip if name doesn't match (different file)
              if (a.name !== newArtifact.name) {
                return false;
              }
              
              // Check if this is a predicted path (same filename, different full path)
              return currentPath !== newArtifact.path && 
                     currentPath.endsWith(`/${newArtifact.name}`);
            })?.path;
          }
          
          if (oldPath) {
            // File was moved - remove old path
            updated.delete(oldPath);
          }
          
          // Add/update with new artifact data
          updated.set(newArtifact.path, newArtifact);
        });

        // Remove artifacts that were deleted
        changedPaths.forEach(path => {
          if (!seenPaths.has(path) && updated.has(path)) {
            // Check if file was moved (exists with same name but different path)
            const oldArtifact = updated.get(path);
            const wasMoved = oldArtifact && changedArtifacts.some(a => 
              a.name === oldArtifact.name && a.path !== path
            );
            
            if (!wasMoved) {
              // File was actually deleted, not moved
              updated.delete(path);
            }
          }
        });

        const finalArtifacts = Array.from(updated.values());
        console.log('[UpdateIncremental] 💾 State updated with', finalArtifacts.length, 'total artifacts');
        return finalArtifacts;
      });
      console.log('[UpdateIncremental] ✨ Transition complete');
    });
  } catch (err) {
    console.error('[UpdateIncremental] ❌ Error:', err);
    loadProjectArtifacts();  // Fallback to full reload
  }
};
```

**Key Logic: Move Detection**:
```tsx
// Find old path by matching filename
oldPath = prevArtifacts.find(a => {
  // Same name but different path = moved file
  return a.name === newArtifact.name && 
         a.path !== newArtifact.path &&
         a.path.endsWith(`/${newArtifact.name}`);
})?.path;

if (oldPath) {
  updated.delete(oldPath);  // Remove old location
}
updated.set(newArtifact.path, newArtifact);  // Add new location
```

#### Step 6: Backend Processing (commands.rs)

**BEFORE THE FIX** (Lines 459-480):
```rust
pub async fn get_changed_artifacts(
    _project_path: String,
    changed_paths: Vec<String>,
    cache: State<'_, ArtifactCache>,
) -> Result<Vec<ArtifactFile>, String> {
    let mut artifacts = Vec::new();

    for path_str in changed_paths {
        let path = PathBuf::from(&path_str);

        // Skip deleted files
        if !path.exists() {
            cache.invalidate(&path).await;
            continue;  // Old path skipped ✅
        }

        // BUG: Skip if cache says unchanged
        if cache.get_if_unchanged(&path).await.is_some() {
            continue;  // New path skipped ❌ (SAME MOD TIME!)
        }

        // This code never executes for moved files!
        // ...
    }

    Ok(artifacts)  // Returns [] for moved files
}
```

**AFTER THE FIX** (Lines 459-516):
```rust
pub async fn get_changed_artifacts(
    _project_path: String,
    changed_paths: Vec<String>,
    cache: State<'_, ArtifactCache>,
) -> Result<Vec<ArtifactFile>, String> {
    let mut artifacts = Vec::new();

    for path_str in changed_paths {
        let path = PathBuf::from(&path_str);

        // Skip deleted files
        if !path.exists() {
            cache.invalidate(&path).await;
            tracing::debug!("File deleted or moved: {}", path.display());
            continue;  // Old path skipped ✅
        }

        // FIX: ALWAYS invalidate cache for changed paths
        // This forces re-read even if mod time unchanged
        cache.invalidate(&path).await;

        // Get file name without extension
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        // Read content from disk (cache was invalidated)
        match cache.get_or_read(&path).await {
            Ok(content) => {
                let front_matter = parse_front_matter(&content);

                tracing::debug!("Re-read changed file: {} (name: {})", path.display(), name);
                artifacts.push(ArtifactFile {
                    name,
                    path: path_str,
                    content: Some(content),
                    front_matter,
                });
            }
            Err(e) => {
                tracing::warn!("Failed to read changed file {}: {}", path.display(), e);
                artifacts.push(ArtifactFile {
                    name,
                    path: path_str,
                    content: None,
                    front_matter: None,
                });
            }
        }
    }

    Ok(artifacts)  // Now returns moved file! ✅
}
```

**Why the fix works**:
1. **Old path** (`.bluekit/kits/ui-components/view-mode-switcher.md`):
   - `path.exists()` → false
   - Invalidate cache (cleanup)
   - Skip (correct behavior)

2. **New path** (`.bluekit/kits/view-mode-switcher.md`):
   - `path.exists()` → true
   - **Force invalidate cache** (NEW!)
   - `cache.get_or_read()` → reads from disk
   - Returns artifact with new path ✅

3. **Config.json**:
   - `path.exists()` → true
   - Force invalidate cache
   - Re-read (updated artifacts array)
   - Returns config metadata

## Testing the Fix

### Before Fix:
```
User removes kit from folder
  ↓
Frontend: invokeMoveArtifactToFolder()
  ↓
Backend: File moved on disk
  ↓
Watcher: Detects 3 paths (old, new, config.json)
  ↓
Frontend: updateArtifactsIncremental([3 paths])
  ↓
Backend: get_changed_artifacts() → Returns []  ❌
  ↓
Frontend: State unchanged → Kit missing from UI ❌
```

### After Fix:
```
User removes kit from folder
  ↓
Frontend: invokeMoveArtifactToFolder()
  ↓
Backend: File moved on disk
  ↓
Watcher: Detects 3 paths (old, new, config.json)
  ↓
Frontend: updateArtifactsIncremental([3 paths])
  ↓
Backend: get_changed_artifacts() → Returns [new_file, config]  ✅
  ↓
Frontend: Detects move (same name, diff path)
  ↓
Frontend: updated.delete(old_path)
  ↓
Frontend: updated.set(new_path, artifact)
  ↓
UI: Kit appears in main kits section ✅
```

### Log Output (After Fix):
```
[Watcher] 📁 Artifacts directory changed
[Watcher] 📝 3 files changed:
  - /path/to/.bluekit/kits/view-mode-switcher.md
  - /path/to/.bluekit/kits/ui-components/config.json
  - /path/to/.bluekit/kits/ui-components/view-mode-switcher.md

[UpdateIncremental] 🔄 Starting incremental update
[UpdateIncremental] 📋 Changed paths: [3 paths]
[UpdateIncremental] 🔍 Fetching changed artifacts from backend...

[Backend DEBUG] File deleted or moved: /path/to/.bluekit/kits/ui-components/view-mode-switcher.md
[Backend DEBUG] Re-read changed file: /path/to/.bluekit/kits/view-mode-switcher.md (name: view-mode-switcher)
[Backend DEBUG] Re-read changed file: /path/to/.bluekit/kits/ui-components/config.json (name: config)

[UpdateIncremental] ✅ Received 2 changed artifacts
[UpdateIncremental] 📦 Changed artifacts:
  - {path: ".bluekit/kits/view-mode-switcher.md", ...}
  - {path: ".bluekit/kits/ui-components/config.json", ...}
[UpdateIncremental] 💾 State updated with 38 total artifacts
[UpdateIncremental] ✨ Transition complete
```

## Key Takeaways

### 1. Cache Invalidation is Critical for File Moves
When files are moved (not copied), the **modification time doesn't change** on many file systems. The cache must be invalidated based on **path changes**, not just mod time.

### 2. File Watchers Detect Moves as Delete + Create
The `notify` crate (and most OS-level file watchers) emit separate events for:
- DELETE event on old path
- CREATE event on new path

Your code must handle both paths to properly detect moves.

### 3. Incremental Updates Need Move Detection
The frontend's merge logic must:
1. Detect when a file was moved (same name, different path)
2. Remove the old path from state
3. Add the new path to state
4. Handle deletions (path in changedPaths but not in results)

### 4. React Strict Mode Can Cause Duplicate Effects
In development, Strict Mode double-mounts components to detect issues. This can create:
- Multiple event listeners
- Duplicate API calls
- State synchronization issues

Disable it if it interferes with real-time systems like file watchers.

### 5. Debouncing Prevents Event Spam
The 300ms debounce window in the Rust watcher:
- Batches rapid file changes (save spam from editors)
- Reduces IPC calls to frontend
- Uses HashSet for automatic deduplication

## Related Files

### Backend (Rust)
- `src-tauri/src/watcher.rs` - File system watcher with debouncing
- `src-tauri/src/commands.rs` - IPC handlers including `get_changed_artifacts`
- `src-tauri/src/cache.rs` - Artifact content caching layer

### Frontend (React)
- `src/pages/ProjectDetailPage.tsx` - Artifact state management and incremental updates
- `src/components/kits/KitsTabContent.tsx` - Kit folder operations
- `src/components/walkthroughs/WalkthroughsTabContent.tsx` - Walkthrough folder operations
- `src/main.tsx` - React root (Strict Mode removed)

### IPC Layer
- `src/ipc.ts` - Type-safe wrappers for Tauri commands
- `src/utils/ipcTimeout.ts` - Timeout handling for IPC calls

## Future Improvements

### 1. Smarter Cache Key
Instead of using file path as cache key, consider:
```rust
struct CacheKey {
    path: PathBuf,
    inode: u64,  // Detect moves by inode
}
```
This would allow detecting moves directly instead of invalidating.

### 2. Batch Invalidation
For folder operations affecting many files:
```rust
cache.invalidate_batch(&paths).await;
```
More efficient than individual invalidate calls.

### 3. Frontend Debouncing
Add debouncing to the event listener to prevent rapid-fire updates:
```tsx
const debouncedUpdate = useMemo(
  () => debounce((paths: string[]) => {
    updateArtifactsIncremental(paths);
  }, 100),
  []
);
```

### 4. Event Coalescing
Merge multiple watcher events within a time window:
```tsx
const eventQueue = useRef<string[]>([]);
const flushTimer = useRef<NodeJS.Timeout>();

const queueUpdate = (paths: string[]) => {
  eventQueue.current.push(...paths);
  
  clearTimeout(flushTimer.current);
  flushTimer.current = setTimeout(() => {
    const allPaths = [...new Set(eventQueue.current)];
    updateArtifactsIncremental(allPaths);
    eventQueue.current = [];
  }, 200);
};
```

## Lessons Learned

1. **Cache invalidation is one of the two hard problems in computer science** (along with naming things). When in doubt, invalidate.

2. **File system operations are complex**. Moves, copies, renames, and permissions all behave differently across OS platforms.

3. **Debug logging is essential**. The comprehensive emoji-tagged logging we added made it immediately obvious where the bug was:
   ```
   [UpdateIncremental] ✅ Received 0 changed artifacts  // ← Smoking gun!
   ```

4. **Test your assumptions**. We assumed the cache was working correctly. Adding logs showed it was skipping moved files.

5. **React Strict Mode is helpful for finding bugs** but can interfere with real-time systems. Know when to disable it.
