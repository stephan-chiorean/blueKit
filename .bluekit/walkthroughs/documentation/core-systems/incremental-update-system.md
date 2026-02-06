---
id: incremental-update-system
alias: Incremental Update System Architecture
type: walkthrough
is_base: false
version: 1
tags:
  - architecture
  - file-watcher
  - incremental-updates
description: Complete architecture and implementation of the incremental update system from low-level Rust file watching to high-level React state synchronization
complexity: comprehensive
format: architecture
---
# Incremental Update System Architecture

## Overview

The incremental update system is a core component of BlueKit that enables real-time synchronization between the filesystem and the UI. Instead of reloading all artifacts on every change, the system:

1. **Watches** the `.bluekit/` directory for file changes using the `notify` crate
2. **Debounces** events to batch rapid changes (300ms window)
3. **Caches** file contents with modification time tracking
4. **Invalidates** cache entries for changed paths
5. **Emits** events to the frontend via Tauri IPC
6. **Merges** changes into React state incrementally

This architecture provides:
- **Performance**: Only re-reads changed files, not the entire directory
- **Responsiveness**: UI updates within 300ms of file changes
- **Reliability**: Handles file moves, deletes, and rapid editor saves
- **Scalability**: Works efficiently with hundreds of artifacts

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         ProjectDetailPage.tsx                             │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  1. loadProjectArtifacts()                          │  │ │
│  │  │     - Full scan via get_project_artifacts          │  │ │
│  │  │     - Returns ALL artifacts                         │  │ │
│  │  │     - Populates initial state                       │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  2. watch_project_artifacts()                       │  │ │
│  │  │     - Starts Rust file watcher                     │  │ │
│  │  │     - Sets up event listener                       │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  3. Event Listener                                  │  │ │
│  │  │     - listen('project-artifacts-changed-{path}')    │  │ │
│  │  │     - Receives: Vec<String> of changed paths       │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  4. updateArtifactsIncremental()                    │  │ │
│  │  │     - Calls get_changed_artifacts(paths)            │  │ │
│  │  │     - Merges changes into state                    │  │ │
│  │  │     - Detects moves, deletes, updates              │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  State: Map<path, ArtifactFile>                     │  │ │
│  │  │  - Key: Full file path                             │  │ │
│  │  │  - Value: Artifact with content & frontMatter      │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↕ Tauri IPC
┌─────────────────────────────────────────────────────────────────┐
│                    IPC Layer (Type-Safe Wrappers)               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  invokeGetChangedArtifacts(projectPath, changedPaths)      │ │
│  │  - Type-safe wrapper around Tauri invoke                 │ │
│  │  - Timeout handling (15s default)                        │ │
│  │  - Error propagation                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Event: 'project-artifacts-changed-{sanitized-path}'     │ │
│  │  - Payload: Vec<String> (changed file paths)              │ │
│  │  - Emitted by Rust watcher                                │ │
│  │  - Received by React event listener                       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↕ Tauri IPC
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Rust)                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         watcher.rs - File System Watcher                 │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  notify::RecommendedWatcher                         │  │ │
│  │  │  - Cross-platform file watching                     │  │ │
│  │  │  - Wraps: inotify (Linux), FSEvents (macOS), etc.  │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  DebouncerState                                     │  │ │
│  │  │  - pending_paths: HashSet<PathBuf>                  │  │ │
│  │  │  - last_event_time: Instant                        │  │ │
│  │  │  - 300ms debounce window                            │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Bounded Channel (mpsc, size: 100)                  │  │ │
│  │  │  - Prevents memory exhaustion                        │  │ │
│  │  │  - Drops events if full (with warning)              │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         commands.rs - IPC Handlers                       │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  get_changed_artifacts(paths)                        │  │ │
│  │  │  - Invalidates cache for each path                   │  │ │
│  │  │  - Re-reads file content                            │  │ │
│  │  │  - Parses YAML front matter                         │  │ │
│  │  │  - Returns Vec<ArtifactFile>                        │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         cache.rs - ArtifactCache                         │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  cache: Arc<RwLock<HashMap<PathBuf, CacheEntry>>>  │  │ │
│  │  │  - Key: File path (PathBuf)                         │  │ │
│  │  │  - Value: (content: String, mtime: SystemTime)      │  │ │
│  │  │  - Thread-safe via Arc<RwLock<>>                    │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Methods:                                         │  │ │
│  │  │  - get_or_read(): Read if missing/changed         │  │ │
│  │  │  - invalidate(): Remove cache entry                │  │ │
│  │  │  - get_if_unchanged(): Check cache only            │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Deep Dive

### 1. The Notify Crate

**Location**: `src-tauri/Cargo.toml` (dependency), `src-tauri/src/watcher.rs` (usage)

The `notify` crate is a production-grade Rust library for cross-platform file system watching. It provides a unified API over platform-specific implementations:

- **Linux**: Uses `inotify` (inotify-sys crate)
- **macOS**: Uses `FSEvents` (native macOS file system events)
- **Windows**: Uses `ReadDirectoryChangesW` (Windows API)

#### How Notify Works

```rust
// From watcher.rs:234-241
let mut watcher: RecommendedWatcher = Watcher::new(
    move |res| {
        // Callback function - called by notify when file changes detected
        if tx.blocking_send(res).is_err() {
            warn!("Directory watcher channel full, dropping event");
        }
    },
    notify::Config::default()
).map_err(|e| format!("Failed to create directory watcher: {}", e))?;

watcher.watch(&directory_path, RecursiveMode::Recursive)?;
```

**Key Concepts**:

1. **RecommendedWatcher**: Automatically selects the best watcher for the platform
2. **Callback Pattern**: Notify calls the provided closure when events occur
3. **Event Types**: Notify emits `Event` structs containing:
   - `paths: Vec<PathBuf>` - Changed file paths
   - `kind: EventKind` - Type of change (Create, Modify, Remove, Rename)
   - `attrs: EventAttributes` - Additional metadata

4. **Recursive Watching**: `RecursiveMode::Recursive` watches subdirectories

#### Event Flow

```
File System Change
    ↓
OS Kernel (inotify/FSEvents/ReadDirectoryChangesW)
    ↓
notify crate callback
    ↓
Bounded Channel (mpsc::channel, size: 100)
    ↓
Tokio async task receives event
    ↓
Filter by file type (.md, .mmd, .mermaid, .json)
    ↓
Insert into HashSet (deduplication)
    ↓
Debounce (300ms window)
    ↓
Emit Tauri event to frontend
```

#### Why Notify?

- **Production-Grade**: Used by major Rust projects (cargo watch, etc.)
- **Cross-Platform**: Single API works on all platforms
- **Efficient**: Uses native OS APIs, not polling
- **Reliable**: Handles edge cases (file moves, rapid changes, etc.)

### 2. HashMap-Based Cache Implementation

**Location**: `src-tauri/src/cache.rs`

The `ArtifactCache` provides thread-safe caching of file contents with modification time tracking.

#### Data Structure

```rust
// From cache.rs:19-28
type CacheEntry = (String, SystemTime);

pub struct ArtifactCache {
    cache: Arc<RwLock<HashMap<PathBuf, CacheEntry>>>,
}
```

**Components**:

1. **HashMap<PathBuf, CacheEntry>**: 
   - Key: Full file path
   - Value: Tuple of (content, modification_time)
   - O(1) lookup, insert, and remove

2. **Arc<RwLock<>>**: 
   - `Arc`: Atomic Reference Counting - allows sharing across threads
   - `RwLock`: Read-Write Lock - multiple readers OR one writer
   - Enables concurrent reads while preventing write conflicts

#### Cache Operations

##### Reading with Cache Check

```rust
// From cache.rs:50-80
pub async fn get_or_read(&self, path: &PathBuf) -> Result<String, String> {
    // 1. Check if file exists
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }

    // 2. Get current modification time from filesystem
    let current_mtime = Self::get_file_mtime(path)?;

    // 3. Try to read from cache (read lock - allows concurrent reads)
    let cache = self.cache.read().await;
    if let Some((cached_content, cached_mtime)) = cache.get(path) {
        // 4. Compare modification times
        if *cached_mtime == current_mtime {
            // Cache hit - file unchanged
            debug!("Cache hit for {}", path.display());
            return Ok(cached_content.clone());
        }
    }
    drop(cache); // Release read lock before acquiring write lock

    // 5. Cache miss or file changed - read from disk
    debug!("Cache miss for {}, reading from disk", path.display());
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file {}: {}", path.display(), e))?;

    // 6. Update cache (write lock - exclusive access)
    let mut cache = self.cache.write().await;
    cache.insert(path.clone(), (content.clone(), current_mtime));

    Ok(content)
}
```

**Lock Strategy**:
- **Read Lock**: Acquired for cache lookup (allows concurrent reads)
- **Released**: Before acquiring write lock (prevents deadlock)
- **Write Lock**: Acquired for cache updates (exclusive access)

##### Cache Invalidation

```rust
// From cache.rs:118-124
pub async fn invalidate(&self, path: &PathBuf) {
    let mut cache = self.cache.write().await;
    if cache.remove(path).is_some() {
        debug!("Invalidated cache for {}", path.display());
    }
}
```

**Why Invalidate?**
- **File Moves**: Same content, different path - mod time unchanged
- **Path Changes**: Cache key is the path, so moved files need invalidation
- **Force Re-read**: Ensures fresh data after file system operations

#### Performance Characteristics

- **Cache Hit**: O(1) HashMap lookup + string clone (~microseconds)
- **Cache Miss**: File I/O + YAML parsing (~milliseconds)
- **Concurrent Reads**: Multiple threads can read simultaneously
- **Memory**: Stores full file content (trade-off for speed)

### 3. File Watcher with Debouncing

**Location**: `src-tauri/src/watcher.rs`

The watcher combines notify events with debouncing and deduplication.

#### Debouncer State

```rust
// From watcher.rs:48-52
struct DebouncerState {
    last_event_time: Instant,
    pending_paths: std::collections::HashSet<PathBuf>, // Auto-deduplication
}
```

**Why HashSet?**
- **Automatic Deduplication**: Same path inserted twice → only one entry
- **OS Behavior**: File saves often trigger multiple events (CREATE + MODIFY)
- **Editor Behavior**: Auto-save can trigger rapid events

#### Debouncing Logic

```rust
// From watcher.rs:314-344
_ = sleep(Duration::from_millis(DEBOUNCE_DURATION_MS)) => {
    if !debounce_state.pending_paths.is_empty() &&
       debounce_state.last_event_time.elapsed() >= Duration::from_millis(DEBOUNCE_DURATION_MS) {
        debug!("Debounced {} directory changes, emitting event",
            debounce_state.pending_paths.len());

        // Filter to only watched file types and convert to strings
        let changed_paths: Vec<String> = debounce_state.pending_paths
            .iter()
            .filter(|p| {
                if is_watched_file(p) {
                    if p.extension().and_then(|e| e.to_str()) == Some("json") {
                        is_watched_json(p)
                    } else {
                        true // All .md, .mmd, .mermaid files
                    }
                } else {
                    false
                }
            })
            .map(|p| p.to_string_lossy().to_string())
            .collect();

        if let Err(e) = app_handle.emit_all(&event_name_for_task, changed_paths) {
            error!("Failed to emit directory change event: {}", e);
        }

        debounce_state.pending_paths.clear();
    }
}
```

**Debounce Window**: 300ms
- **Too Short**: Too many events, performance issues
- **Too Long**: UI feels unresponsive
- **300ms**: Balances responsiveness and efficiency

#### Event Collection

```rust
// From watcher.rs:285-290
if has_relevant_change {
    for path in &event.paths {
        debounce_state.pending_paths.insert(path.clone()); // HashSet auto-deduplicates
    }
    debounce_state.last_event_time = Instant::now();
}
```

**Flow**:
1. Notify emits event with paths
2. Filter by file type (`.md`, `.mmd`, `.mermaid`, `.json`)
3. Insert into HashSet (deduplicates automatically)
4. Update last event time
5. Wait 300ms of quiet period
6. Emit batched event to frontend

#### Bounded Channel

```rust
// From watcher.rs:232
let (tx, mut rx) = mpsc::channel(CHANNEL_BUFFER_SIZE); // CHANNEL_BUFFER_SIZE = 100
```

**Why Bounded?**
- **Memory Safety**: Prevents unbounded growth if frontend is slow
- **Backpressure**: If channel is full, events are dropped (with warning)
- **Size 100**: Handles burst events without blocking

### 4. IPC Layer

**Location**: `src/ipc.ts`, `src/utils/ipcTimeout.ts`

The IPC layer provides type-safe communication between frontend and backend.

#### Type-Safe Wrapper

```typescript
// From ipc.ts:465-473
export async function invokeGetChangedArtifacts(
  projectPath: string,
  changedPaths: string[]
): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_changed_artifacts', {
    projectPath,
    changedPaths,
  });
}
```

**Benefits**:
- **Type Safety**: TypeScript knows return type
- **IDE Autocomplete**: Better developer experience
- **Centralized**: All IPC calls in one place
- **Documentation**: JSDoc comments explain usage

#### Timeout Handling

```typescript
// From ipcTimeout.ts:45-59
export async function invokeWithTimeout<T>(
  command: string,
  args?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    invoke<T>(command, args),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(`Command '${command}' timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}
```

**Why Timeouts?**
- **Prevents Hangs**: Backend issues won't freeze UI indefinitely
- **Default 15s**: Reasonable for file I/O operations
- **Customizable**: Different commands can have different timeouts

### 5. Frontend State Management

**Location**: `src/pages/ProjectDetailPage.tsx`

The frontend merges incremental changes into React state.

#### State Structure

```typescript
// State is an array, but internally uses Map for efficient lookups
const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);

// During updates, converted to Map for O(1) lookups
const updated = new Map(prevArtifacts.map(a => [a.path, a]));
```

**Why Map?**
- **O(1) Lookups**: Find artifacts by path quickly
- **O(1) Updates**: Update specific artifacts efficiently
- **O(1) Deletes**: Remove artifacts by path

#### Incremental Update Logic

```typescript
// From ProjectDetailPage.tsx:115-206
const updateArtifactsIncremental = async (changedPaths: string[]) => {
  // 1. Fetch changed artifacts from backend
  const changedArtifacts = await invokeGetChangedArtifacts(project.path, changedPaths);

  // 2. Use React transition for non-blocking update
  startTransition(() => {
    setArtifacts(prevArtifacts => {
      // 3. Convert to Map for efficient operations
      const updated = new Map(prevArtifacts.map(a => [a.path, a]));
      const seenPaths = new Set<string>();

      // 4. Process changed artifacts
      changedArtifacts.forEach(newArtifact => {
        seenPaths.add(newArtifact.path);

        // 5. Detect file moves (same name, different path)
        let oldPath = Array.from(updated.keys()).find(oldPath => {
          const oldArtifact = updated.get(oldPath);
          return oldArtifact && 
                 oldArtifact.name === newArtifact.name && 
                 oldPath !== newArtifact.path &&
                 changedPaths.includes(oldPath);
        });

        if (oldPath) {
          // 6. Remove old path
          updated.delete(oldPath);
        }

        // 7. Add/update with new artifact
        updated.set(newArtifact.path, newArtifact);
      });

      // 8. Remove deleted artifacts
      changedPaths.forEach(path => {
        if (!seenPaths.has(path) && updated.has(path)) {
          // Check if moved (exists with same name but different path)
          const oldArtifact = updated.get(path);
          const wasMoved = oldArtifact && changedArtifacts.some(a => 
            a.name === oldArtifact.name && a.path !== path
          );
          
          if (!wasMoved) {
            // Actually deleted, not moved
            updated.delete(path);
          }
        }
      });

      // 9. Convert back to array
      return Array.from(updated.values());
    });
  });
};
```

#### Move Detection Algorithm

The frontend detects file moves by matching filenames:

1. **New artifact arrives** with path `B`
2. **Check changedPaths** for old path `A`
3. **Find artifact** in current state with:
   - Same name as new artifact
   - Path `A` (in changedPaths)
   - Different from new path `B`
4. **If found**: File was moved from `A` to `B`
5. **Remove** old path `A` from state
6. **Add** new path `B` to state

#### React Transition

```typescript
startTransition(() => {
  setArtifacts(/* ... */);
});
```

**Why startTransition?**
- **Non-Blocking**: Doesn't block UI rendering
- **Lower Priority**: React can interrupt for urgent updates
- **Better UX**: UI stays responsive during state updates

## Complete Data Flow

### Example: User Moves a Kit File

```
1. User Action (Frontend)
   └─> invokeMoveArtifactToFolder(
         '/project/.bluekit/kits/button.md',
         '/project/.bluekit/kits/ui-components'
       )

2. Backend File Operation (Rust)
   └─> std::fs::rename(
         '/project/.bluekit/kits/button.md',
         '/project/.bluekit/kits/ui-components/button.md'
       )

3. File System Change
   ├─> DELETE: /project/.bluekit/kits/button.md
   ├─> CREATE: /project/.bluekit/kits/ui-components/button.md
   └─> MODIFY: /project/.bluekit/kits/ui-components/config.json

4. Notify Crate Detection
   └─> Event emitted with paths:
       [
         '/project/.bluekit/kits/button.md',
         '/project/.bluekit/kits/ui-components/button.md',
         '/project/.bluekit/kits/ui-components/config.json'
       ]

5. Watcher Processing (watcher.rs)
   ├─> Filter: All paths match watched file types ✅
   ├─> Insert into HashSet:
   │   {
   │     '/project/.bluekit/kits/button.md',
   │     '/project/.bluekit/kits/ui-components/button.md',
   │     '/project/.bluekit/kits/ui-components/config.json'
   │   }
   ├─> Wait 300ms (debounce window)
   └─> Emit Tauri event: 'project-artifacts-changed-{path}'
       Payload: [
         '/project/.bluekit/kits/button.md',
         '/project/.bluekit/kits/ui-components/button.md',
         '/project/.bluekit/kits/ui-components/config.json'
       ]

6. Frontend Event Listener (ProjectDetailPage.tsx)
   └─> listen('project-artifacts-changed-{path}', (event) => {
         updateArtifactsIncremental(event.payload);
       })

7. Incremental Update (ProjectDetailPage.tsx)
   └─> invokeGetChangedArtifacts(project.path, changedPaths)

8. Backend Processing (commands.rs)
   ├─> For each path:
   │   ├─> Path 1: '/project/.bluekit/kits/button.md'
   │   │   ├─> path.exists()? → false ❌
   │   │   ├─> cache.invalidate(path) ✅
   │   │   └─> continue (skip deleted files)
   │   │
   │   ├─> Path 2: '/project/.bluekit/kits/ui-components/button.md'
   │   │   ├─> path.exists()? → true ✅
   │   │   ├─> cache.invalidate(path) ✅ (force re-read)
   │   │   ├─> cache.get_or_read(path) → reads from disk
   │   │   ├─> parse_front_matter(content)
   │   │   └─> Returns: ArtifactFile { path: '...', name: 'button', ... }
   │   │
   │   └─> Path 3: '/project/.bluekit/kits/ui-components/config.json'
   │       ├─> path.exists()? → true ✅
   │       ├─> cache.invalidate(path) ✅
   │       ├─> cache.get_or_read(path) → reads from disk
   │       ├─> parse_front_matter(content)
   │       └─> Returns: ArtifactFile { path: '...', name: 'config', ... }
   │
   └─> Returns: [
         ArtifactFile { path: '.../ui-components/button.md', ... },
         ArtifactFile { path: '.../ui-components/config.json', ... }
       ]

9. Frontend State Merge (ProjectDetailPage.tsx)
   ├─> Convert state to Map: { path → artifact }
   ├─> Process changedArtifacts:
   │   ├─> button.md (new path)
   │   │   ├─> Detect move: oldPath = '/project/.bluekit/kits/button.md'
   │   │   ├─> updated.delete(oldPath) ✅
   │   │   └─> updated.set(newPath, newArtifact) ✅
   │   │
   │   └─> config.json
   │       └─> updated.set(path, artifact) ✅
   │
   ├─> Process deletions:
   │   └─> '/project/.bluekit/kits/button.md'
   │       ├─> In seenPaths? → No
   │       ├─> In updated? → No (already removed as move)
   │       └─> Skip (already handled)
   │
   └─> Convert back to array and update state

10. UI Update
    └─> React re-renders with updated artifacts
        └─> Kit appears in 'ui-components' folder ✅
```

## Performance Characteristics

### Cache Performance

| Operation | Cache Hit | Cache Miss |
|-----------|-----------|------------|
| **Lookup** | O(1) HashMap | N/A |
| **Read** | ~1μs (string clone) | ~1-10ms (file I/O + parsing) |
| **Memory** | ~1KB per artifact | N/A |

### Watcher Performance

| Metric | Value | Notes |
|--------|-------|-------|
| **Debounce Window** | 300ms | Balances responsiveness and efficiency |
| **Channel Buffer** | 100 events | Prevents memory exhaustion |
| **Event Processing** | ~1ms per event | Filtering and HashSet insertion |
| **IPC Latency** | ~1-5ms | Tauri IPC overhead |

### Frontend Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| **State Lookup** | O(1) | Map-based lookups |
| **State Update** | O(n) where n = changed artifacts | Typically 1-3 artifacts |
| **Move Detection** | O(n) where n = artifacts | Filename matching |
| **React Render** | O(m) where m = visible artifacts | Only renders visible items |

## Key Design Decisions

### 1. Why Always Invalidate Cache?

**Decision**: Always invalidate cache for changed paths, even if mod time unchanged.

**Reasoning**:
- **File Moves**: Same inode, same mod time, different path
- **Path-Based Cache**: Cache key is path, so moved files need invalidation
- **Simplicity**: Easier than tracking inodes or content hashes
- **Correctness**: Ensures moved files are always detected

**Trade-off**: Slightly more file I/O, but guarantees correctness.

### 2. Why HashSet for Deduplication?

**Decision**: Use `HashSet<PathBuf>` instead of `Vec<PathBuf>` for pending paths.

**Reasoning**:
- **Automatic Deduplication**: OS/editor may emit duplicate events
- **O(1) Insert**: More efficient than checking Vec for duplicates
- **Simple API**: `insert()` handles everything

**Trade-off**: Slightly more memory, but prevents duplicate processing.

### 3. Why 300ms Debounce?

**Decision**: 300ms debounce window for batching events.

**Reasoning**:
- **Editor Auto-Save**: Typically saves every 500ms-2s
- **Rapid Changes**: Users may save multiple times quickly
- **Balance**: Short enough to feel responsive, long enough to batch

**Trade-off**: 300ms delay on first change, but batches subsequent changes.

### 4. Why Map-Based State Updates?

**Decision**: Convert state array to Map during updates, then back to array.

**Reasoning**:
- **Efficient Lookups**: O(1) path-based lookups
- **Efficient Updates**: O(1) insert/delete operations
- **Move Detection**: Easy to find artifacts by path

**Trade-off**: Conversion overhead, but much faster for large artifact counts.

## Error Handling

### Watcher Errors

```rust
// From watcher.rs:292-305
Some(Err(e)) => {
    consecutive_errors += 1;
    error!("Directory watcher error (#{}/{}): {}",
        consecutive_errors, MAX_CONSECUTIVE_ERRORS, e);

    // Emit error event
    let _ = app_handle.emit_all(&format!("{}-error", event_name_for_task),
        format!("Watcher error: {}", e));

    // Too many errors - trigger restart
    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
        error!("Too many consecutive errors, attempting restart");
        break;
    }
}
```

**Recovery**: Auto-restart with exponential backoff (up to 5 attempts).

### Cache Errors

```rust
// From cache.rs:50-54
if !path.exists() {
    return Err(format!("File does not exist: {}", path.display()));
}
```

**Handling**: Return error, frontend falls back to full reload.

### Frontend Errors

```typescript
// From ProjectDetailPage.tsx:201-205
catch (err) {
  console.error('[UpdateIncremental] ❌ Error updating artifacts incrementally:', err);
  // Fallback to full reload on error
  loadProjectArtifacts();
}
```

**Recovery**: Fallback to full artifact reload ensures UI stays in sync.

## Testing Considerations

### Unit Tests

- **Cache**: Test cache hit/miss, invalidation, concurrent access
- **Watcher**: Test debouncing, deduplication, event filtering
- **Frontend**: Test move detection, state merging, error handling

### Integration Tests

- **File Operations**: Create, modify, delete, move files
- **Rapid Changes**: Multiple saves within debounce window
- **Large Projects**: Hundreds of artifacts, performance testing

### Edge Cases

- **File Moves**: Same content, different path
- **Rapid Saves**: Editor auto-save triggering multiple events
- **Concurrent Access**: Multiple components watching same project
- **Network Drives**: Slow file system operations

## Related Files

### Backend (Rust)
- `src-tauri/src/watcher.rs` - File system watcher with debouncing
- `src-tauri/src/cache.rs` - Artifact content caching layer
- `src-tauri/src/commands.rs` - IPC handlers including `get_changed_artifacts`
- `src-tauri/src/main.rs` - Command registration and cache initialization
- `src-tauri/Cargo.toml` - Dependencies (notify = "6.1")

### Frontend (React + TypeScript)
- `src/pages/ProjectDetailPage.tsx` - Artifact state management and incremental updates
- `src/ipc.ts` - Type-safe IPC wrappers
- `src/utils/ipcTimeout.ts` - Timeout handling for IPC calls

### Documentation
- `.bluekit/walkthroughs/fixing-file-move-detection.md` - Bug fix walkthrough
- `.bluekit/diagrams/incremental-update-system-architecture.mmd` - Architecture diagram

## Future Improvements

### 1. Inode-Based Cache Keys

Instead of path-based cache, use inode + path:

```rust
struct CacheKey {
    inode: u64,
    path: PathBuf,
}
```

**Benefits**: Detect file moves without invalidation
**Trade-off**: More complex, platform-specific code

### 2. Content Hashing

Cache based on content hash instead of mod time:

```rust
type CacheEntry = (String, u64); // content, hash
```

**Benefits**: Detect content changes even if mod time unchanged
**Trade-off**: Hash computation overhead

### 3. Batch Invalidation

Invalidate multiple paths in one operation:

```rust
pub async fn invalidate_batch(&self, paths: &[PathBuf]) {
    let mut cache = self.cache.write().await;
    for path in paths {
        cache.remove(path);
    }
}
```

**Benefits**: More efficient for folder operations
**Trade-off**: Slightly more complex API

### 4. Frontend Debouncing

Add debouncing to frontend event listener:

```typescript
const debouncedUpdate = useMemo(
  () => debounce((paths: string[]) => {
    updateArtifactsIncremental(paths);
  }, 100),
  []
);
```

**Benefits**: Additional layer of protection against rapid events
**Trade-off**: Additional delay

## Extending the Pattern to Other Systems

The incremental update architecture described above (for kits, walkthroughs, agents, etc.) is **not artifact-specific**. The same pattern applies to any file-based content system in BlueKit.

### Unified Architecture Pattern

**Core Principle**: The component that **owns the content's lifecycle** should **own the watcher's lifecycle**.

```
┌─────────────────────────────────────────────────────────┐
│         Parent Container (Lifecycle Owner)              │
│                                                          │
│  useEffect(() => {                                       │
│    // 1. Start watching                                 │
│    await invokeWatchXFolder(id, folderPath);            │
│                                                          │
│    // 2. Listen for changes                             │
│    const unlisten = await listen(eventName, handler);   │
│                                                          │
│    // 3. Cleanup on unmount                             │
│    return () => {                                        │
│      unlisten();                                         │
│      invokeStopWatcher(eventName);                      │
│    };                                                    │
│  }, [id, folderPath]);                                  │
│                                                          │
│  ├─── Child Component A (listens to same events)        │
│  └─── Child Component B (listens to same events)        │
└─────────────────────────────────────────────────────────┘
```

### Application: Plans System

**Example Implementation** (`src/features/plans/components/PlanWorkspace.tsx`):

```typescript
// PlanWorkspace owns the plan view lifecycle
export default function PlanWorkspace({ plan, onPlanDeleted, onBack }) {
  // Load plan details
  useEffect(() => {
    loadPlanDetails(false);
  }, [loadPlanDetails]);

  // Set up file watcher for plan folder
  useEffect(() => {
    if (!planId || !planDetails?.folderPath) return;

    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    const setupWatcher = async () => {
      try {
        // Start watching the plan folder
        await invokeWatchPlanFolder(planId, planDetails.folderPath);
        const eventName = `plan-documents-changed-${planId}`;

        // Listen for file changes
        const unlisten = await listen<string[]>(eventName, (event) => {
          if (isMounted) {
            const changedPaths = event.payload;
            if (changedPaths.length > 0) {
              // Reload plan details in background
              handlePlanUpdate();
            }
          }
        });

        unlistenFn = unlisten;
      } catch (error) {
        console.error(`Failed to set up file watcher for plan ${planId}:`, error);
      }
    };

    setupWatcher();

    return () => {
      isMounted = false;
      if (unlistenFn) {
        unlistenFn();
      }

      // Stop the watcher when component unmounts
      const eventName = `plan-documents-changed-${planId}`;
      invokeStopWatcher(eventName).catch(err => {
        console.warn('Failed to stop plan folder watcher:', err);
      });
    };
  }, [planId, planDetails?.folderPath, handlePlanUpdate]);

  return (
    <Flex>
      <PlanDocViewPage /> {/* Child can also listen to events */}
      <PlanOverviewPanel /> {/* Child can also listen to events */}
    </Flex>
  );
}
```

**Children can listen independently:**

```typescript
// PlanDocViewPage.tsx
useEffect(() => {
  if (!planId || isEditMode) return;

  const unlisten = await listen(`plan-documents-changed-${planId}`, (event) => {
    // Reload current document if it changed
    if (event.payload.includes(currentDocPath)) {
      reloadDocument();
    }
  });

  return () => unlisten();
}, [planId, isEditMode, currentDocPath]);
```

### Common Anti-Pattern: Watcher in Conditional Child

❌ **INCORRECT** - Watcher lifecycle tied to child visibility:

```typescript
// PlanOverviewPanel.tsx (conditionally rendered sidebar)
export default function PlanOverviewPanel({ isPanelOpen, ... }) {
  // ❌ BAD: Watcher stops when panel closes!
  useEffect(() => {
    await invokeWatchPlanFolder(...);
    const unlisten = await listen(...);
    return () => {
      unlisten();
      invokeStopWatcher(...); // Kills watcher when panel closes!
    };
  }, [planId]);

  return <VStack>...</VStack>;
}

// PlanWorkspace.tsx
{isPanelOpen && <PlanOverviewPanel />} // Panel unmounts when closed
```

**Problem**: When `isPanelOpen = false`, `PlanOverviewPanel` unmounts, triggering cleanup that stops the watcher. Other components (like `PlanDocViewPage`) listening to the same events stop receiving updates.

✅ **CORRECT** - Watcher lifecycle matches content lifecycle:

```typescript
// PlanWorkspace.tsx (parent that owns the plan view)
export default function PlanWorkspace() {
  // ✅ GOOD: Watcher runs as long as plan is being viewed
  useEffect(() => {
    await invokeWatchPlanFolder(...);
    const unlisten = await listen(...);
    return () => {
      unlisten();
      invokeStopWatcher(...); // Only stops when leaving plan view
    };
  }, [planId]);

  return (
    <>
      <PlanDocViewPage /> {/* Always rendered */}
      {isPanelOpen && <PlanOverviewPanel />} {/* Conditionally rendered */}
    </>
  );
}
```

### Extending to New Systems

When adding file-watching to a new system (e.g., brainstorms, workflows, blueprints), follow this checklist:

**1. Backend (Rust)**

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn watch_x_folder(
    app_handle: tauri::AppHandle,
    x_id: String,
    folder_path: String,
) -> Result<(), String> {
    let event_name = format!("x-changed-{}", x_id);
    start_directory_watcher(app_handle, folder_path, event_name).await
}
```

**2. IPC Wrapper (TypeScript)**

```typescript
// src/ipc/x.ts
export async function invokeWatchXFolder(
  xId: string,
  folderPath: string
): Promise<void> {
  return await invokeWithTimeout<void>('watch_x_folder', {
    xId,
    folderPath,
  });
}
```

**3. Frontend Parent Component**

```typescript
// src/features/x/XWorkspace.tsx
export default function XWorkspace({ x }) {
  const xId = x.id;
  const folderPath = x.folderPath;

  // Watcher setup - runs as long as workspace is mounted
  useEffect(() => {
    if (!xId || !folderPath) return;

    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    const setupWatcher = async () => {
      try {
        await invokeWatchXFolder(xId, folderPath);
        const eventName = `x-changed-${xId}`;

        const unlisten = await listen<string[]>(eventName, (event) => {
          if (isMounted) {
            handleXUpdate(event.payload);
          }
        });

        unlistenFn = unlisten;
      } catch (error) {
        console.error('Failed to set up watcher:', error);
      }
    };

    setupWatcher();

    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
      invokeStopWatcher(`x-changed-${xId}`).catch(console.warn);
    };
  }, [xId, folderPath]);

  return <>{/* children */}</>;
}
```

**4. Child Components (Optional)**

Child components can independently listen to the same events:

```typescript
// src/features/x/XDetailView.tsx
useEffect(() => {
  if (!xId || isEditMode) return;

  const unlisten = await listen(`x-changed-${xId}`, (event) => {
    // React to changes specific to this view
    if (event.payload.includes(currentItemPath)) {
      reloadItem();
    }
  });

  return () => unlisten();
}, [xId, isEditMode, currentItemPath]);
```

### Decision Tree: Where to Place the Watcher

```
Is the component always rendered while content is visible?
├─ YES → ✅ Safe to place watcher here
│         Example: PlanWorkspace, ProjectDetailPage
│
└─ NO → ❌ Do NOT place watcher here
          ├─ Is it conditionally rendered?
          │  Example: PlanOverviewPanel (toggleable sidebar)
          │  → Move watcher to parent
          │
          ├─ Is it inside a tab/modal?
          │  Example: Tab content that switches
          │  → Move watcher to tab container (if applicable)
          │     or accept that watching only happens when tab is active
          │
          └─ Is it paginated/virtualized?
             Example: List item in virtualized list
             → Move watcher to list container
```

### Real-World Systems in BlueKit

| System | Parent (Watcher Owner) | Children (Event Listeners) |
|--------|------------------------|----------------------------|
| **Kits/Walkthroughs** | `ProjectDetailPage` | `KitsTabContent`, `WalkthroughsTabContent` |
| **Plans** | `PlanWorkspace` | `PlanDocViewPage`, `PlanOverviewPanel` |
| **Blueprints** | `BlueprintDetailPage` (if exists) | Blueprint viewer components |
| **Scrapbook** | `ScrapbookSection` | Scrapbook item viewers |

### Key Takeaways

1. **Watcher lifecycle = Content lifecycle**: Start watcher when entering view, stop when leaving
2. **Parent owns, children listen**: Parent sets up watcher, children can independently listen
3. **Avoid conditional watcher owners**: Never place watcher in components that unmount while content is still visible
4. **Reuse the pattern**: Same architecture for artifacts, plans, blueprints, workflows, etc.
5. **Multiple listeners OK**: Multiple components can listen to the same event independently

This unified architecture ensures consistent real-time updates across all file-based systems in BlueKit.

## Summary

The incremental update system is a sophisticated architecture that:

1. **Watches** file changes efficiently using the `notify` crate
2. **Debounces** events to batch rapid changes (300ms window)
3. **Caches** file contents with modification time tracking
4. **Invalidates** cache entries for changed paths (handles moves)
5. **Emits** events to frontend via Tauri IPC
6. **Merges** changes into React state incrementally

This design provides:
- **Performance**: Only re-reads changed files
- **Responsiveness**: UI updates within 300ms
- **Reliability**: Handles edge cases (moves, deletes, rapid saves)
- **Scalability**: Works efficiently with hundreds of artifacts

The system is production-ready and handles real-world scenarios like file moves, editor auto-save, and concurrent access gracefully.
