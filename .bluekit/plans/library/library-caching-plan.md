# Library Catalog Caching Implementation Plan

## Executive Summary

This document outlines the implementation plan for adding **caching for library catalogs and folders** to reduce GitHub API calls, improve performance, and provide a better user experience when browsing and syncing library workspaces.

The caching system will store:
- **Directory listings** (folder structure from GitHub)
- **File metadata** (SHA hashes, paths, types)
- **Content hashes** (for sync detection)
- **Catalog structure** (what artifacts exist in each workspace)
- **Sync timestamps** (when last synced)

---

## Current State Analysis

### What's Already Implemented ✅

**Commit Cache** (src-tauri/src/integrations/github/commit_cache.rs:1)
- ✅ In-memory cache for GitHub commits
- ✅ 5-minute TTL (time-to-live)
- ✅ Project-based cache keys
- ✅ Cache invalidation on branch switch

**Artifact Cache** (src-tauri/src/cache.rs:1)
- ✅ File content caching for local files
- ✅ Modification time-based invalidation
- ✅ Thread-safe async implementation

**Database Storage** (src-tauri/src/library/sync.rs:1)
- ✅ `library_catalog` table stores artifact metadata
- ✅ `library_variation` table stores content versions
- ✅ Database persists catalog structure between sessions

### Current Problems ⚠️

**Problem 1: Excessive GitHub API Calls**

**Current Flow** (src-tauri/src/library/sync.rs:25-85):
```rust
sync_workspace_catalog()
  ↓
For each artifact directory (kits, walkthroughs, agents, diagrams):
  ↓
  GET /repos/{owner}/{repo}/contents/{dir}  // List directory
  ↓
  For each file in directory:
    ↓
    GET /repos/{owner}/{repo}/contents/{path}  // Get file contents
    ↓
    Parse YAML front matter
    ↓
    Calculate content hash
    ↓
    Store in database
```

**Issues**:
- ❌ Every sync makes **N+1 API calls** (1 for directory + N for files)
- ❌ No caching of directory listings
- ❌ No caching of file metadata (SHA, paths)
- ❌ Rate limit risk: 5,000 requests/hour (GitHub API limit)
- ❌ Slow UI when browsing library (waits for API calls)

**Example**: Workspace with 50 kits = **51 API calls** per sync!

**Problem 2: No Incremental Sync**

**Current Behavior**:
- Every sync re-fetches **all files** from GitHub
- No detection of "what changed since last sync"
- Wastes API calls on unchanged files

**Problem 3: UI Performance**

**Current Flow** (src/components/library/LibraryTabContent.tsx:171-1165):
```typescript
User opens Library tab
  ↓
Calls library_get_artifacts()  // Fast (from DB)
  ↓
User clicks "Sync Workspace"
  ↓
Calls sync_workspace_catalog()  // SLOW (many API calls)
  ↓
UI freezes until all API calls complete
```

**Issues**:
- ❌ UI blocks during sync
- ❌ No progress indication
- ❌ No way to cancel long-running sync
- ❌ User sees stale data until sync completes

---

## Proposed Solution: Multi-Layer Caching

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  - Shows cached catalog structure                            │
│  - Background sync indicator                                 │
└─────────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Rust/Tauri)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 1: In-Memory Cache (Fast, Ephemeral)           │  │
│  │  - Directory listings (HashMap)                        │  │
│  │  - File metadata (SHA, paths)                          │  │
│  │  - TTL: 5 minutes                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 2: Database Cache (Persistent)                 │  │
│  │  - library_catalog table (artifact metadata)         │  │
│  │  - library_variation table (content versions)         │  │
│  │  - last_synced_at timestamps                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 3: GitHub API (Source of Truth)                │  │
│  │  - Only called when cache stale or invalidated         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Cache Layers Explained

#### Layer 1: In-Memory Cache (Fast Lookups)

**Purpose**: Ultra-fast access to recently accessed data.

**Implementation**:
```rust
pub struct LibraryCatalogCache {
    // Directory listings: workspace_id + path → DirectoryListing
    directories: Arc<RwLock<HashMap<String, CachedDirectory>>>,
    
    // File metadata: workspace_id + path → FileMetadata
    file_metadata: Arc<RwLock<HashMap<String, CachedFileMetadata>>>,
    
    // Content hashes: workspace_id + path → ContentHash
    content_hashes: Arc<RwLock<HashMap<String, CachedHash>>>,
}

struct CachedDirectory {
    items: Vec<DirectoryItem>,
    cached_at: Instant,
    ttl: Duration,  // 5 minutes
}

struct CachedFileMetadata {
    sha: String,
    path: String,
    size: u64,
    cached_at: Instant,
    ttl: Duration,
}

struct CachedHash {
    hash: String,
    cached_at: Instant,
    ttl: Duration,
}
```

**Cache Keys**:
- Directory: `{workspace_id}:dir:{path}`
- File metadata: `{workspace_id}:file:{path}`
- Content hash: `{workspace_id}:hash:{path}`

**TTL Strategy**:
- **Directory listings**: 5 minutes (structure changes infrequently)
- **File metadata**: 5 minutes (SHA changes on file update)
- **Content hashes**: 10 minutes (only needed for sync detection)

**Invalidation**:
- On manual "Sync" button click → Clear cache for workspace
- On publish → Invalidate affected paths
- On pull → Invalidate affected paths
- TTL expiration → Auto-invalidate

#### Layer 2: Database Cache (Persistent)

**Purpose**: Persist catalog structure between app sessions.

**Current Tables** (Already exist):
- `library_catalog` - Artifact metadata
- `library_variation` - Content versions

**New Fields Needed**:
```sql
-- Add to library_workspace table
ALTER TABLE library_workspaces ADD COLUMN last_synced_at INTEGER;
ALTER TABLE library_workspaces ADD COLUMN sync_in_progress BOOLEAN DEFAULT 0;

-- Add to library_catalog table (if not exists)
ALTER TABLE library_catalog ADD COLUMN last_checked_at INTEGER;
ALTER TABLE library_catalog ADD COLUMN github_sha TEXT;  -- File SHA from GitHub
```

**Usage**:
- On app startup → Load catalog from database (fast)
- Show "Last synced: X minutes ago" in UI
- Background sync → Update database → Invalidate in-memory cache

#### Layer 3: GitHub API (Source of Truth)

**Purpose**: Fetch fresh data when cache is stale.

**Optimization Strategy**:
1. **Check cache first** → Return if fresh
2. **Check database** → Return if recent (< 1 hour)
3. **Fetch from GitHub** → Only if cache/db stale
4. **Incremental sync** → Only fetch changed files (using SHA comparison)

---

## Implementation Plan

### Phase 1: In-Memory Cache Infrastructure (Week 1)

**Goal**: Build the caching layer that stores directory listings and file metadata.

**Tasks**:

1. **Create Cache Module** (src-tauri/src/library/cache.rs)
   - [ ] Define `LibraryCatalogCache` struct
   - [ ] Implement `get_directory()` - Get cached directory listing
   - [ ] Implement `set_directory()` - Cache directory listing
   - [ ] Implement `get_file_metadata()` - Get cached file metadata
   - [ ] Implement `set_file_metadata()` - Cache file metadata
   - [ ] Implement `invalidate_workspace()` - Clear cache for workspace
   - [ ] Implement `invalidate_path()` - Clear cache for specific path
   - [ ] Add TTL checking (auto-expire stale entries)

2. **Integrate with GitHub Client**
   - [ ] Wrap `GitHubClient::get_directory_contents()` with cache
   - [ ] Wrap `GitHubClient::get_file_contents()` with cache
   - [ ] Add cache key generation helpers

3. **Testing**
   - [ ] Unit tests for cache TTL expiration
   - [ ] Unit tests for cache invalidation
   - [ ] Integration test: Cache hit vs miss

**Deliverable**: In-memory cache that reduces API calls for repeated requests.

---

### Phase 2: Incremental Sync (Week 1-2)

**Goal**: Only fetch files that changed since last sync.

**Tasks**:

1. **Add SHA Tracking to Database**
   - [ ] Migration: Add `github_sha` column to `library_catalog` table
   - [ ] Migration: Add `last_checked_at` to `library_catalog` table
   - [ ] Update sync logic to store SHA when fetching files

2. **Implement Incremental Sync Logic** (src-tauri/src/library/sync.rs)
   - [ ] Modify `sync_directory()` to:
     - Get directory listing from cache (or GitHub)
     - For each file:
       - Check if SHA changed (compare to database)
       - Only fetch content if SHA changed
       - Skip unchanged files
   - [ ] Add `sync_workspace_incremental()` function
   - [ ] Return sync stats: `{ fetched: 5, skipped: 45, updated: 2 }`

3. **Testing**
   - [ ] Test: Sync workspace → Change 1 file → Sync again → Only 1 API call
   - [ ] Test: Sync workspace → No changes → No API calls (all from cache)

**Deliverable**: Sync that only fetches changed files, reducing API calls by 90%+.

---

### Phase 3: Database Cache Integration (Week 2)

**Goal**: Use database as persistent cache between app sessions.

**Tasks**:

1. **Add Sync Timestamps**
   - [ ] Migration: Add `last_synced_at` to `library_workspaces` table
   - [ ] Migration: Add `sync_in_progress` flag to `library_workspaces` table
   - [ ] Update `sync_workspace_catalog()` to set timestamps

2. **Implement Cache-First Lookup**
   - [ ] Modify `list_workspace_catalogs()` to:
     - Check `last_synced_at` timestamp
     - If < 1 hour old → Return from database (no API calls)
     - If > 1 hour old → Show "Stale" badge, allow manual sync
   - [ ] Add `get_catalog_from_cache()` helper

3. **Background Sync Support**
   - [ ] Add `sync_workspace_background()` function
   - [ ] Runs in background thread
   - [ ] Updates database incrementally
   - [ ] Emits Tauri events for progress updates

4. **Testing**
   - [ ] Test: Close app → Reopen → Catalog loads from database (fast)
   - [ ] Test: Stale cache → Shows "Last synced: 2 hours ago" badge

**Deliverable**: Catalog loads instantly from database on app startup.

---

### Phase 4: UI Integration (Week 2-3)

**Goal**: Show cached data immediately, sync in background.

**Tasks**:

1. **Update Library Tab Component** (src/components/library/LibraryTabContent.tsx)
   - [ ] Load catalog from database on mount (fast)
   - [ ] Show "Last synced: X minutes ago" badge
   - [ ] Add "Sync" button (triggers background sync)
   - [ ] Show sync progress indicator (spinner + "Syncing...")
   - [ ] Update UI incrementally as sync progresses

2. **Add Cache Status Indicators**
   - [ ] "Fresh" badge (synced < 5 minutes ago)
   - [ ] "Stale" badge (synced > 1 hour ago)
   - [ ] "Syncing..." indicator (sync in progress)
   - [ ] "Error" badge (sync failed)

3. **Background Sync UI**
   - [ ] Toast notification: "Syncing workspace..."
   - [ ] Progress bar: "5/50 files synced"
   - [ ] Success notification: "Sync complete: 2 updates found"
   - [ ] Error notification: "Sync failed: Rate limit exceeded"

4. **Testing**
   - [ ] Test: Open Library tab → Catalog appears instantly
   - [ ] Test: Click "Sync" → Progress indicator shows
   - [ ] Test: Sync completes → UI updates with new data

**Deliverable**: UI that feels instant, with background sync.

---

### Phase 5: Advanced Optimizations (Week 3)

**Goal**: Further reduce API calls and improve performance.

**Tasks**:

1. **Batch API Calls**
   - [ ] Implement `get_multiple_files()` - Fetch multiple files in parallel
   - [ ] Use GitHub API batch endpoints (if available)
   - [ ] Limit concurrency (max 10 parallel requests)

2. **Smart Cache Warming**
   - [ ] On workspace open → Pre-fetch directory listings
   - [ ] On catalog browse → Pre-fetch file metadata for visible items
   - [ ] Background task → Warm cache for frequently accessed workspaces

3. **Cache Size Management**
   - [ ] LRU eviction (remove least recently used entries)
   - [ ] Max cache size: 100MB in-memory
   - [ ] Periodic cleanup of expired entries

4. **Rate Limit Handling**
   - [ ] Track API call count per hour
   - [ ] Show warning: "Approaching rate limit (4500/5000)"
   - [ ] Auto-throttle: Delay requests if near limit
   - [ ] Cache-first strategy reduces rate limit risk

5. **Testing**
   - [ ] Test: Large workspace (100+ files) → Sync completes in < 30 seconds
   - [ ] Test: Rate limit → Shows warning, throttles requests

**Deliverable**: Optimized caching that handles large workspaces efficiently.

---

## Database Schema Changes

### New Columns

```sql
-- library_workspaces table
ALTER TABLE library_workspaces ADD COLUMN last_synced_at INTEGER;
ALTER TABLE library_workspaces ADD COLUMN sync_in_progress BOOLEAN DEFAULT 0;

-- library_catalog table
ALTER TABLE library_catalog ADD COLUMN last_checked_at INTEGER;
ALTER TABLE library_catalog ADD COLUMN github_sha TEXT;  -- File SHA from GitHub API
```

### Migration Script

```rust
// src-tauri/src/db/migrations/add_library_cache_fields.rs
pub async fn up(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Add last_synced_at to library_workspaces
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "ALTER TABLE library_workspaces ADD COLUMN last_synced_at INTEGER;"
    )).await?;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        "ALTER TABLE library_workspaces ADD COLUMN sync_in_progress BOOLEAN DEFAULT 0;"
    )).await?;

    // Add cache fields to library_catalog
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "ALTER TABLE library_catalog ADD COLUMN last_checked_at INTEGER;"
    )).await?;

    db.execute(Statement::from_string(
        db.get_database_backend(),
        "ALTER TABLE library_catalog ADD COLUMN github_sha TEXT;"
    )).await?;

    Ok(())
}
```

---

## Cache Invalidation Strategy

### When to Invalidate

**Manual Invalidation**:
- User clicks "Sync" button → Invalidate workspace cache
- User publishes artifact → Invalidate affected paths
- User pulls artifact → Invalidate affected paths

**Automatic Invalidation**:
- TTL expiration → Auto-invalidate stale entries
- App startup → Clear in-memory cache (reload from database)
- Background sync completes → Update cache with fresh data

### Invalidation Scope

**Workspace-level**:
```rust
cache.invalidate_workspace(workspace_id);
// Clears all cache entries for this workspace
```

**Path-level**:
```rust
cache.invalidate_path(workspace_id, "kits/api-error.md");
// Clears cache for specific file/directory
```

**Selective Invalidation**:
```rust
cache.invalidate_directory(workspace_id, "kits");
// Clears cache for entire directory
```

---

## Performance Targets

### Before Caching (Current)

- **Sync 50 artifacts**: ~51 API calls, ~30 seconds
- **Browse library**: Waits for API calls, ~2-3 seconds
- **Rate limit risk**: High (5000/hour limit)

### After Caching (Target)

- **Sync 50 artifacts (unchanged)**: 0 API calls, < 1 second (from cache)
- **Sync 50 artifacts (2 changed)**: 3 API calls (1 dir + 2 files), ~2 seconds
- **Browse library**: Instant (from database cache)
- **Rate limit risk**: Low (90%+ reduction in API calls)

### Metrics to Track

- **Cache hit rate**: Target > 80%
- **API calls per sync**: Target < 10% of file count
- **Sync duration**: Target < 5 seconds for 100 files
- **UI load time**: Target < 500ms (from database)

---

## Testing Strategy

### Unit Tests

- [ ] Cache TTL expiration
- [ ] Cache invalidation (workspace, path, directory)
- [ ] Cache key generation
- [ ] Incremental sync logic (SHA comparison)

### Integration Tests

- [ ] Sync workspace → Cache populated
- [ ] Sync again (no changes) → All from cache
- [ ] Sync again (1 file changed) → Only 1 API call
- [ ] Invalidate cache → Next sync fetches from GitHub

### E2E Tests

- [ ] Open Library tab → Catalog loads instantly
- [ ] Click "Sync" → Progress indicator shows
- [ ] Sync completes → UI updates
- [ ] Close app → Reopen → Catalog still cached

### Performance Tests

- [ ] Large workspace (100+ files) → Sync completes in < 30 seconds
- [ ] Cache hit rate > 80% after warm-up
- [ ] UI load time < 500ms from database

---

## Error Handling

### Cache Errors

**Cache Miss** (Expected):
- Fall back to database
- If database stale → Fetch from GitHub
- No error to user (transparent fallback)

**Cache Corruption** (Rare):
- Clear cache for affected workspace
- Re-fetch from GitHub
- Log error for debugging

### API Errors

**Rate Limit Exceeded**:
- Show warning: "Rate limit exceeded. Please wait 1 hour."
- Use cached data (even if stale)
- Schedule retry in 1 hour

**Network Error**:
- Show error: "Failed to sync. Using cached data."
- Allow manual retry
- Cache remains valid (use stale data)

**Authentication Error**:
- Show error: "GitHub authentication required."
- Clear cache (can't refresh)
- Prompt user to re-authenticate

---

## Future Enhancements

### 1. Persistent Disk Cache

**Use Case**: Cache survives app restarts without database.

**Implementation**:
- Store cache in `~/.bluekit/cache/` directory
- Serialize cache entries to JSON/MessagePack
- Load on app startup
- Periodic cleanup of old cache files

### 2. Predictive Pre-fetching

**Use Case**: Pre-fetch likely-to-be-accessed data.

**Implementation**:
- Track user browsing patterns
- Pre-fetch artifacts user typically views
- Background sync of recently accessed workspaces

### 3. Cache Compression

**Use Case**: Reduce memory usage for large workspaces.

**Implementation**:
- Compress directory listings (gzip)
- Store only essential metadata in-memory
- Decompress on-demand

### 4. Distributed Cache (Team Workspaces)

**Use Case**: Share cache across team members.

**Implementation**:
- Store cache in shared location (team drive)
- Invalidate on team member's publish
- Requires network sync (complex, future work)

---

## Summary

### What We're Building

1. **In-Memory Cache** - Fast lookups for recently accessed data
2. **Database Cache** - Persistent catalog structure
3. **Incremental Sync** - Only fetch changed files
4. **Smart Invalidation** - Keep cache fresh
5. **UI Integration** - Show cached data immediately

### Benefits

- ✅ **90%+ reduction in API calls** (only fetch changed files)
- ✅ **Instant UI** (load from database cache)
- ✅ **Better UX** (background sync, progress indicators)
- ✅ **Rate limit safety** (fewer API calls)
- ✅ **Offline support** (use cached data when offline)

### Implementation Timeline

- **Week 1**: In-memory cache + incremental sync
- **Week 2**: Database cache integration
- **Week 3**: UI integration + optimizations

**Total**: 3 weeks for full caching system

---

**Last Updated**: 2025-01-27
**Status**: 📋 **Ready to Implement**

---

## Next Steps

1. Review this plan and confirm architectural approach
2. Start Phase 1: Create in-memory cache module
3. Integrate cache with existing sync logic
4. Test cache hit/miss scenarios
5. Measure performance improvements

Once caching is in place, library browsing will feel instant and sync operations will be much faster! 🚀

