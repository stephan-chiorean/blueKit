---
id: cache-system-overview
alias: Cache System Overview
type: walkthrough
is_base: false
version: 1
tags:
  - cache
  - performance
  - file-system
description: Basic overview guide for how the ArtifactCache works in BlueKit, including hashmap structure, operations, and general purpose in the system
complexity: moderate
format: guide
---
# Cache System Overview

## Introduction

The `ArtifactCache` is a thread-safe, in-memory cache system designed to optimize file I/O operations in BlueKit. It stores artifact file contents (kits, walkthroughs, diagrams, etc.) along with their modification times to avoid unnecessary disk reads.

## Purpose in the System

The cache serves three primary purposes:

1. **Avoid re-reading unchanged files** - If a file hasn't been modified, return cached content instead of reading from disk
2. **Support incremental updates** - Only reload files that have actually changed when file watchers detect modifications
3. **Reduce file I/O operations** - Minimize expensive disk reads, especially when loading large numbers of artifacts

## Architecture

### Core Data Structure

The cache is built around a `HashMap` that maps file paths to cache entries:

**Rust Implementation:**
```rust
type CacheEntry = (String, SystemTime);

pub struct ArtifactCache {
    cache: Arc<RwLock<HashMap<PathBuf, CacheEntry>>>,
}
```

**TypeScript Equivalent Concept:**
```typescript
// TypeScript equivalent (conceptual - cache lives in Rust backend)
type CacheEntry = {
  content: string;
  modificationTime: number; // Unix timestamp in milliseconds
};

// If implemented in TypeScript, would look like:
class ArtifactCache {
  private cache: Map<string, CacheEntry> = new Map();
  // Note: TypeScript doesn't have built-in RwLock, would need a library
}
```

**Key Components:**
- **Key**: `PathBuf` (Rust) / `string` (TypeScript) - The file path (e.g., `/project/.bluekit/kits/my-kit.md`)
- **Value**: `CacheEntry` - Contains:
  - `String` (Rust) / `string` (TypeScript) - The file's content
  - `SystemTime` (Rust) / `number` (TypeScript) - The file's modification time when cached
- **Thread Safety**: `Arc<RwLock<>>` (Rust) - Allows concurrent read access with exclusive write access
  - TypeScript: Single-threaded (no locks needed), but async operations still need coordination

### Why This Design?

- **`Arc` (Atomically Reference Counted)**: Allows the cache to be shared across multiple async tasks
  - TypeScript: Objects are reference-counted automatically, but `Arc` in Rust ensures thread-safe sharing
- **`RwLock`**: Enables multiple concurrent readers (common case) with exclusive writers (rare case)
  - TypeScript: No locks needed (single-threaded), but async operations can still race
- **`HashMap` (Rust) / `Map` (TypeScript)**: O(1) average-case lookup time for fast cache hits
- **Modification Time Tracking**: Enables cache invalidation by comparing current file mtime with cached mtime

## Cache Operations

### 1. `new()` - Initialization

Creates an empty cache instance:

**Rust Implementation:**
```rust
pub fn new() -> Self {
    Self {
        cache: Arc::new(RwLock::new(HashMap::new())),
    }
}
```

**TypeScript Equivalent:**
```typescript
class ArtifactCache {
  private cache: Map<string, CacheEntry> = new Map();
  
  constructor() {
    // Cache is automatically initialized as empty Map
  }
}

// Usage
const cache = new ArtifactCache();
```

**Usage**: Called once during application startup in `main.rs`:

```rust
// src-tauri/src/main.rs
app.manage(ArtifactCache::new());
```

**TypeScript Perspective**: The frontend doesn't directly instantiate the cache - it's managed by Tauri on the backend. The frontend accesses cached data through IPC commands.

### 2. `get_or_read()` - Primary Read Operation

The main method for getting file content. Returns cached content if unchanged, otherwise reads from disk and updates cache.

**Flow:**
1. Check if file exists
2. Get current file modification time from filesystem
3. Acquire read lock and check cache
4. If cache hit (path exists AND mtime matches) → return cached content
5. If cache miss → release read lock, read from disk, acquire write lock, update cache

**Rust Implementation:**
```rust
pub async fn get_or_read(&self, path: &PathBuf) -> Result<String, String> {
    // Check existence
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }

    // Get current modification time
    let current_mtime = Self::get_file_mtime(path)?;

    // Check cache (read lock)
    let cache = self.cache.read().await;
    if let Some((cached_content, cached_mtime)) = cache.get(path) {
        if *cached_mtime == current_mtime {
            debug!("Cache hit for {}", path.display());
            return Ok(cached_content.clone());
        }
    }
    drop(cache); // Release read lock

    // Cache miss - read from disk
    debug!("Cache miss for {}, reading from disk", path.display());
    let content = fs::read_to_string(path)?;

    // Update cache (write lock)
    let mut cache = self.cache.write().await;
    cache.insert(path.clone(), (content.clone(), current_mtime));

    Ok(content)
}
```

**TypeScript Equivalent Concept:**
```typescript
async getOrRead(path: string): Promise<string> {
  // Check existence (would need Node.js fs API)
  if (!await fs.exists(path)) {
    throw new Error(`File does not exist: ${path}`);
  }

  // Get current modification time
  const stats = await fs.stat(path);
  const currentMtime = stats.mtimeMs;

  // Check cache (no lock needed in single-threaded JS)
  const cached = this.cache.get(path);
  if (cached && cached.modificationTime === currentMtime) {
    console.log(`Cache hit for ${path}`);
    return cached.content;
  }

  // Cache miss - read from disk
  console.log(`Cache miss for ${path}, reading from disk`);
  const content = await fs.readFile(path, 'utf-8');

  // Update cache
  this.cache.set(path, {
    content,
    modificationTime: currentMtime,
  });

  return content;
}
```

**Frontend Usage (TypeScript):**
```typescript
// Frontend calls backend command that uses cache internally
// src/ipc.ts
export async function invokeGetProjectArtifacts(
  projectPath: string
): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_project_artifacts', {
    projectPath,
  });
}

// Usage in component
// src/pages/ProjectDetailPage.tsx
const artifacts = await invokeGetProjectArtifacts(project.path);
// Backend's cache.get_or_read() is called internally for each file
```

**Key Points:**
- Rust: Uses `drop(cache)` to explicitly release the read lock before acquiring write lock (prevents deadlock)
- TypeScript: No locks needed (single-threaded), but async operations still need careful coordination
- Both: Clone/return content (cache retains ownership in Rust, reference in TypeScript)
- Both: Log cache hits/misses for debugging

### 3. `get_if_unchanged()` - Conditional Read

Returns cached content only if file hasn't changed. Returns `None` if file changed, doesn't exist, or isn't cached.

**Use Case**: Quick check without forcing a disk read if cache is stale.

**Rust Implementation:**
```rust
pub async fn get_if_unchanged(&self, path: &PathBuf) -> Option<String> {
    if !path.exists() {
        return None;
    }

    let current_mtime = match Self::get_file_mtime(path) {
        Ok(mtime) => mtime,
        Err(_) => return None,
    };

    let cache = self.cache.read().await;
    if let Some((cached_content, cached_mtime)) = cache.get(path) {
        if *cached_mtime == current_mtime {
            return Some(cached_content.clone());
        }
    }

    None
}
```

**TypeScript Equivalent:**
```typescript
getIfUnchanged(path: string): string | null {
  if (!this.cache.has(path)) {
    return null;
  }

  // In real implementation, would check file mtime
  // For simplicity, just check if entry exists
  const cached = this.cache.get(path);
  if (cached) {
    // Would compare with current file mtime here
    return cached.content;
  }

  return null;
}
```

**Note**: This method is used internally by the backend and not directly exposed to the frontend. The frontend sees the results through `get_or_read()` behavior.

### 4. `invalidate()` - Remove Entry

Removes a specific path from the cache. Used when files are moved, deleted, or need to be force-reloaded.

**Rust Implementation:**
```rust
pub async fn invalidate(&self, path: &PathBuf) {
    let mut cache = self.cache.write().await;
    if cache.remove(path).is_some() {
        debug!("Invalidated cache for {}", path.display());
    }
}
```

**TypeScript Equivalent:**
```typescript
invalidate(path: string): void {
  const removed = this.cache.delete(path);
  if (removed) {
    console.log(`Invalidated cache for ${path}`);
  }
}
```

**Usage in Commands**: When file watcher detects changes, cache is invalidated to force re-read:

**Rust (Backend):**
```rust
// src-tauri/src/commands.rs
// Force invalidate to handle file moves (same mtime, different path)
cache.invalidate(&path).await;
```

**TypeScript (Frontend)**: The frontend doesn't directly call `invalidate()`, but triggers it indirectly:

```typescript
// src/pages/ProjectDetailPage.tsx
// When file watcher detects changes, frontend calls:
const changedArtifacts = await invokeGetChangedArtifacts(
  project.path,
  changedPaths
);

// Backend's get_changed_artifacts command invalidates cache internally:
// cache.invalidate(&path).await; // Happens in Rust backend
```

### 5. `update()` - Manual Cache Update

Manually updates cache entry with new content. Reads modification time from filesystem.

**Rust Implementation:**
```rust
pub async fn update(&self, path: &PathBuf, content: String) -> Result<(), String> {
    let mtime = Self::get_file_mtime(path)?;
    let mut cache = self.cache.write().await;
    cache.insert(path.clone(), (content, mtime));
    Ok(())
}
```

**TypeScript Equivalent:**
```typescript
async update(path: string, content: string): Promise<void> {
  const stats = await fs.stat(path);
  const mtime = stats.mtimeMs;
  
  this.cache.set(path, {
    content,
    modificationTime: mtime,
  });
}
```

**Note**: This method is used internally by the backend when files are written. The frontend doesn't directly call it.

### 6. `clear()` - Reset Cache

Removes all entries from the cache. Useful for testing or when cache needs to be reset.

**Rust Implementation:**
```rust
pub async fn clear(&self) {
    let mut cache = self.cache.write().await;
    let count = cache.len();
    cache.clear();
    debug!("Cleared cache (removed {} entries)", count);
}
```

**TypeScript Equivalent:**
```typescript
clear(): void {
  const count = this.cache.size;
  this.cache.clear();
  console.log(`Cleared cache (removed ${count} entries)`);
}
```

**Note**: This is primarily used for testing. The frontend doesn't have direct access to this operation.

### 7. `get_modification_time()` - Get Mtime

Retrieves modification time from cache (if available) or filesystem (fallback).

**Rust Implementation:**
```rust
pub async fn get_modification_time(&self, path: &PathBuf) -> Option<SystemTime> {
    // Try cache first
    let cache = self.cache.read().await;
    if let Some((_, cached_mtime)) = cache.get(path) {
        return Some(*cached_mtime);
    }
    drop(cache);

    // Fall back to filesystem
    Self::get_file_mtime(path).ok()
}
```

**TypeScript Equivalent:**
```typescript
async getModificationTime(path: string): Promise<number | null> {
  // Try cache first
  const cached = this.cache.get(path);
  if (cached) {
    return cached.modificationTime;
  }

  // Fall back to filesystem
  try {
    const stats = await fs.stat(path);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}
```

**Note**: This is an internal method used by the cache system. The frontend doesn't directly access modification times.

## Usage in the System

### Initialization

The cache is initialized once during app startup and registered with Tauri's state management:

**Rust (Backend):**
```rust
// src-tauri/src/main.rs
app.manage(ArtifactCache::new());
```

**TypeScript (Frontend)**: The frontend doesn't initialize the cache - it's managed entirely by the backend. The frontend interacts with cached data through IPC commands.

### In Commands

Commands access the cache via Tauri's `State`:

**Rust (Backend):**
```rust
#[tauri::command]
pub async fn get_project_artifacts(
    project_path: String,
    cache: State<'_, ArtifactCache>,
) -> Result<Vec<ArtifactFile>, String> {
    // Use cache.get_or_read() to load files
    match cache.get_or_read(&path).await {
        Ok(content) => {
            // Parse and process content
        }
        Err(e) => {
            // Handle error
        }
    }
}
```

**TypeScript (Frontend):**
```typescript
// src/ipc.ts - Type-safe wrapper
export async function invokeGetProjectArtifacts(
  projectPath: string
): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_project_artifacts', {
    projectPath,
  });
}

// src/pages/ProjectDetailPage.tsx - Usage
const artifacts = await invokeGetProjectArtifacts(project.path);
// Backend's cache.get_or_read() is called internally for each file
```

### Incremental Updates

When file watchers detect changes, the cache is used to determine which files actually changed:

**Rust (Backend):**
```rust
#[tauri::command]
pub async fn get_changed_artifacts(
    project_path: String,
    changed_paths: Vec<String>,
    cache: State<'_, ArtifactCache>,
) -> Result<Vec<ArtifactFile>, String> {
    for path_str in changed_paths {
        let path = PathBuf::from(&path_str);
        
        // Invalidate cache to force re-read (handles file moves)
        cache.invalidate(&path).await;
        
        // Read file (will update cache)
        match cache.get_or_read(&path).await {
            Ok(content) => {
                // Process changed file
            }
            Err(_) => {
                // File deleted
            }
        }
    }
}
```

**TypeScript (Frontend):**
```typescript
// src/ipc.ts
export async function invokeGetChangedArtifacts(
  projectPath: string,
  changedPaths: string[]
): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_changed_artifacts', {
    projectPath,
    changedPaths,
  });
}

// src/pages/ProjectDetailPage.tsx - Usage
useEffect(() => {
  const handleArtifactChange = async (changedPaths: string[]) => {
    // Backend invalidates cache and re-reads changed files
    const changedArtifacts = await invokeGetChangedArtifacts(
      project.path,
      changedPaths
    );
    
    // Merge into existing state
    setArtifacts(prev => {
      const updated = new Map(prev.map(a => [a.path, a]));
      // ... merge logic
    });
  };
  
  // File watcher calls this when changes detected
}, [project.path]);
```

**Key Difference**: The frontend never directly accesses the cache. All cache operations happen in the Rust backend, and the frontend receives the results through IPC commands.

## Cache Invalidation Strategy

The cache uses modification time comparison to determine if a file has changed:

1. **Cache Hit**: File path exists in cache AND modification time matches → return cached content
2. **Cache Miss**: File not in cache OR modification time differs → read from disk and update cache

**Important**: When files are moved (same content, same mtime, different path), the cache must be explicitly invalidated because the modification time comparison won't detect the path change.

## Performance Characteristics

- **Lookup Time**: O(1) average case (HashMap)
- **Read Lock**: Multiple concurrent readers allowed
- **Write Lock**: Exclusive access during updates
- **Memory**: Stores full file contents in memory (trade-off for speed)

## Thread Safety

**Rust (Backend):**
All operations are async-safe:
- `RwLock` provides concurrent read access
- Write operations are exclusive
- `Arc` allows sharing across async tasks
- No data races possible due to Rust's ownership system

**TypeScript (Frontend):**
- Single-threaded (no locks needed)
- Async operations are coordinated through the event loop
- No direct access to the cache (all through IPC)
- Race conditions can occur in React state updates, but cache operations are isolated to backend

## Frontend-Backend Interaction Pattern

Understanding how the cache works requires understanding the separation between frontend and backend:

### Architecture Overview

```
┌─────────────────┐         IPC          ┌──────────────────┐
│  TypeScript     │  ──────────────────> │  Rust Backend    │
│  Frontend       │                       │  (Tauri)         │
│                 │                       │                  │
│  - React UI     │  <────────────────── │  - ArtifactCache │
│  - State Mgmt   │      Results         │  - File I/O      │
│  - IPC Calls    │                       │  - Cache Logic   │
└─────────────────┘                       └──────────────────┘
```

### Data Flow Example

**Scenario**: User opens a project, frontend needs to load all kits.

1. **Frontend (TypeScript)**:
   ```typescript
   // User action triggers
   const artifacts = await invokeGetProjectArtifacts(project.path);
   ```

2. **IPC Layer**: TypeScript → Rust
   - `invokeGetProjectArtifacts()` calls Tauri's `invoke('get_project_artifacts', ...)`
   - Tauri sends command to Rust backend

3. **Backend (Rust)**:
   ```rust
   #[tauri::command]
   pub async fn get_project_artifacts(
       project_path: String,
       cache: State<'_, ArtifactCache>,
   ) -> Result<Vec<ArtifactFile>, String> {
       // For each file:
       let content = cache.get_or_read(&path).await?;
       // Cache checks: file exists? mtime matches? return cached or read from disk
   }
   ```

4. **Cache Operations** (all in Rust):
   - Check if file in cache
   - Compare modification times
   - Return cached content OR read from disk and update cache

5. **IPC Layer**: Rust → TypeScript
   - Backend returns `Vec<ArtifactFile>` with content and metadata
   - Tauri serializes to JSON
   - Frontend receives `ArtifactFile[]`

6. **Frontend (TypeScript)**:
   ```typescript
   // Receive results
   setArtifacts(artifacts); // Update React state
   ```

### Key Takeaways

- **Cache lives entirely in Rust backend** - Frontend never directly accesses it
- **Frontend sees results, not cache operations** - Cache is an implementation detail
- **IPC is the boundary** - All cache benefits (performance, incremental updates) are transparent to frontend
- **TypeScript examples are conceptual** - They show what equivalent code would look like, but cache is Rust-only

## Summary

The `ArtifactCache` is a simple but effective caching layer that:
- Reduces disk I/O by caching file contents
- Tracks modification times for smart invalidation
- Supports concurrent reads with exclusive writes
- Integrates seamlessly with Tauri's async command system

It's a key performance optimization that enables efficient incremental updates when file watchers detect changes, avoiding full directory scans on every update.

**For TypeScript Developers**: While the cache implementation is in Rust, understanding its structure and operations helps you understand:
- Why some operations are fast (cache hits)
- Why file moves require explicit invalidation
- How incremental updates work efficiently
- The performance characteristics of artifact loading
