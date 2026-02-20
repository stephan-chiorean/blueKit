# BlueKit Index Engine Vision
**Status:** Draft  
**Scope:** Vault/Workspace indexing for Markdown-first knowledge + code artifacts (kits, plans, walkthroughs, etc.)  
**Core principle:** Filesystem (Markdown) is canonical. The index is a derived cache for speed, querying, and UX.

---

## 0) Why an Index Exists
BlueKit needs fast, rich, always-available answers to questions like:

- Search: “find all kits tagged `iam`”, “find `worker group` references”, “show notes with `status:in-progress`”
- Navigation: backlinks, forward links, “mentions”, tag lists, file suggestions
- Views: dashboards, filtered lists, “recently changed”, “stale plans”, “open milestones”
- Graph-ish: relationships across artifacts, “what depends on what”
- Refactors: rename a kit and update all references safely
- Plugins / automation hooks: incremental updates without re-scanning everything

The index enables instantaneous queries without rescanning the whole workspace every time.

---

## 1) Canonical Sources and Invariants
### 1.1 Canonical Truth
- **Markdown files on disk** are the canonical truth (content + frontmatter).
- The index is **derived** and can be rebuilt at any time.

### 1.2 Index Invariants
- Index must reflect the filesystem as-of a known point-in-time.
- Drift is assumed possible (watchers miss events; files change while app is closed).
- Therefore: **reconciliation is always available** and is authoritative.

### 1.3 “Never Lose Updates” Rule
File watchers are an optimization for live updates. Correctness comes from:
- reconciliation on open
- reconciliation on demand
- reconciliation after suspicious events (burst changes / watcher restart / app focus regain)

---

## 2) High-Level Architecture
### 2.1 Components
1. **Filesystem Enumerator**
   - Lists all candidate files under workspace roots
   - Applies include/exclude rules (e.g., ignore `.git`, `node_modules`, build outputs)

2. **Parser Pipeline**
   - Reads file content
   - Extracts structured signals (frontmatter, headings, tags, links, etc.)
   - Produces a normalized “Document Record”

3. **Index Store (Persistent Cache)**
   - SQLite (recommended) containing:
     - file registry + fingerprints
     - extracted metadata
     - relationships (links, tags, references)
     - search tokens

4. **In-Memory Query Layer**
   - Optional acceleration layer for frequently used queries
   - “Hot cache” for UI responsiveness

5. **Watcher / Event Stream**
   - OS file watcher events
   - Debounced + coalesced into batches
   - Feeds incremental reindex

6. **Reconciler**
   - Compares filesystem snapshot to Index Store state
   - Computes diffs and applies repairs

7. **Task Scheduler**
   - Controls concurrency, backpressure, priority (UI > background)

---

## 3) What We Index (Signals)
### 3.1 File Registry Fields (Per file)
- `file_id` (stable internal ID)
- `path` (relative to workspace root)
- `root_id` (which workspace root)
- `ext` (`.md`, optional `.mdx`)
- `size_bytes`
- `mtime_ms`
- `ctime_ms` (if available)
- `inode/file_key` (platform-dependent if available)
- `fingerprint` (see §6)
- `parse_version` (schema version for extracted fields)
- `last_indexed_at`

### 3.2 Extracted Content Signals (Per markdown file)
**From YAML frontmatter (Properties):**
- `type` (kit/plan/walkthrough/etc.)
- `tags` (normalized list)
- arbitrary key/values (string/number/bool/date/list)
- BlueKit-specific keys (examples):
  - `status`, `owner`, `stage`, `domain`, `milestones`, `takeaways`, etc.

**From Markdown body:**
- headings outline: H1/H2/H3…
- wiki links: `[[Some Note]]`, `[[Some Note#Section]]`
- markdown links: `[text](path)`
- tags inline: `#tag`, `#tag/subtag`
- mentions: plain-text references (optional; can be expensive)
- code blocks (optional):
  - language
  - extracted identifiers (optional; depends on performance goals)

### 3.3 Relationship Tables (Derived)
- `links_out`: file -> target (resolved or unresolved)
- `links_in`: computed via inverse index or materialized
- `tags`: tag -> files
- `properties`: key -> values -> files
- `headings`: heading -> file + position
- `aliases` (if supported): alias -> canonical file
- `mentions` (optional): token -> file

---

## 4) Indexing Lifecycle
### 4.1 First Open / Cold Start
Goal: build a correct index from disk.

**Steps:**
1. Enumerate all candidate files (filesystem walk).
2. For each file, compute a cheap fingerprint (mtime+size; see §6).
3. Parse all files (possibly in parallel).
4. Write results to SQLite in a single consistent transaction batch (or chunked batches).
5. Build/refresh in-memory caches from SQLite (optional).

**UX:** show progress + allow interactive partial availability:
- UI can show “partial results” while indexing continues
- avoid blocking the entire app on full completion

### 4.2 Normal Runtime (Watcher-driven incremental)
When file events happen:
1. Watcher emits raw events (create/modify/delete/rename).
2. Scheduler debounces/coalesces events per path.
3. For each changed file:
   - confirm file still exists (race-safe)
   - recompute fingerprint
   - if fingerprint unchanged and no forced parse, skip
   - else parse and upsert extracted results
4. For deletes:
   - remove document + relations
5. For rename:
   - attempt to treat as rename (stable file_key/inode helps)
   - else degrade to delete+create

### 4.3 Reopen After Being Closed
Watchers weren’t running, so drift is expected.

On open:
1. Load SQLite registry
2. Enumerate filesystem
3. Diff (new/removed/changed)
4. Reindex only diffs

---

## 5) The Drift Problem and the Correctness Strategy
### 5.1 What “Out of Sync” Means
Index drift occurs when:
- files changed while watcher was down
- watcher missed OS events
- git checkout rewrote many files quickly
- sync tools swapped files atomically

### 5.2 Correctness Strategy (Rule)
> The filesystem snapshot is always the source of truth.  
> Any suspicion of drift triggers reconciliation.

### 5.3 When We Trigger Reconciliation
- On app start / vault open (always)
- On watcher restart / error
- On app focus regain (optional)
- On “event burst” threshold (e.g., > N changes in short interval)
- On explicit user action: “Rebuild Index”
- Periodic background sanity scan (optional, low priority)

---

## 6) Fingerprints, Hashes, and Change Detection
### 6.1 Fingerprint Options
**Tier 1 (Fast):** `(mtime_ms, size_bytes)`
- Very fast
- Usually correct
- Can miss edge cases if timestamps lie or are coarse

**Tier 2 (Stronger):** add `inode/file_key` (platform dependent)
- Helps detect renames reliably
- Helps detect replacements

**Tier 3 (Definitive):** content hash (e.g., SHA-256)
- Most accurate
- More expensive (requires reading entire file)

### 6.2 Recommended Strategy: Two-Phase
1. Use `(mtime, size)` as primary.
2. If suspicious (or for critical files), compute hash:
   - if `mtime` changed but `size` same (common)
   - if OS timestamp resolution is coarse
   - if drift suspected
   - if file replaced quickly (atomic write pattern)

### 6.3 Atomic Writes
Many editors write via:
- write temp file
- rename over original

This often changes inode/file_key. Watcher may emit rename events.
We must handle this safely by:
- verifying existence at time of processing
- treating “rename+modify” bursts as a single final state update

---

## 7) Database Design (SQLite Mirror)
### 7.1 Tables (Conceptual)
- `documents`
  - `file_id`, `root_id`, `path`, `mtime_ms`, `size_bytes`, `hash`, `last_indexed_at`, `parse_version`, etc.
- `properties_kv`
  - `file_id`, `key`, `value_type`, `value_normalized`
- `tags`
  - `file_id`, `tag_normalized`
- `links`
  - `file_id`, `target_type`, `target`, `target_file_id?`, `anchor?`
- `headings`
  - `file_id`, `level`, `text`, `slug`, `line_start`, `line_end`
- `fts` (optional)
  - SQLite FTS5 virtual table for full-text search

### 7.2 Index Store Guarantees
- All updates are transactional
- Each document update replaces previous extracted relations (idempotent)
- Schema migrations are versioned via `parse_version` and `schema_version`

### 7.3 Why SQLite Mirror is Worth It
- Faster startup via cached results
- Complex filters become easy
- Supports offline advanced views (dashboards)
- Enables future analytics/graph features without abandoning markdown truth

---

## 8) Querying: What Uses the Index
### 8.1 UI Features Powered by Index
- Vault-wide search (text + properties + tags)
- File suggestions / quick switcher
- Backlinks, forward links, mentions
- Tag browser
- Properties filters (`status:`, `type:`)
- Outline pane (headings)
- Dashboards (plans by status, kits by domain, etc.)
- Refactor tooling (rename + update references)
- “Recently updated” list

### 8.2 Query Paths
- **Fast path:** in-memory caches for common UX operations
- **Authoritative path:** SQLite queries for correctness and complex filters
- **Hybrid:** in-memory caches warmed from SQLite and invalidated by updates

---

## 9) Optimization Plan
### 9.1 Startup Performance
- Enumerate first (cheap), then parse in batches
- Prioritize “important” files first:
  - recently opened
  - pinned folders
  - `.bluekit/` directory
- Show partial results early
- Persist cached extracted results (SQLite) to avoid full parse every launch

### 9.2 Incremental Parsing
- Parse only changed files based on fingerprints
- Debounce watcher events (e.g., 100–500ms window)
- Coalesce multiple events per file into one update
- Batch DB writes in transactions

### 9.3 Parallelism and Backpressure
- Use bounded worker pool (N threads)
- Avoid reading too many files simultaneously (disk thrash)
- Prioritize UI requests (user clicked search) above background reindex

### 9.4 Full-Text Search Optimization
- Prefer SQLite FTS5 for full text
- Store normalized tokens:
  - lowercased, unicode normalized
- Optionally exclude code blocks from FTS (configurable)

### 9.5 Memory Strategy
- Keep only minimal hot caches in RAM:
  - tag -> count
  - recent files
  - link graph adjacency for active note
- Everything else queryable from SQLite

---

## 10) Reindexing Modes
### 10.1 Incremental Reindex (Default)
Triggered by watcher events:
- reparse changed file only
- update relations for that file only

### 10.2 Targeted Reindex
Triggered by:
- parse version bump
- property schema change
- “Reindex folder”
- plugin setting changes (e.g., now index code blocks)

### 10.3 Full Rebuild
Triggered by:
- user action
- corruption detected
- major schema migration

**Full rebuild steps:**
1. clear derived tables
2. rescan filesystem
3. parse all
4. repopulate tables + FTS

---

## 11) Handling Renames and Reference Stability
### 11.1 The Rename Problem
If identity is `path`, renames look like delete+create.

Better: stable `file_id` based on:
- inode/file_key (where available)
- or a persistent UUID stored in frontmatter (optional and controversial)

### 11.2 Recommended Approach
- Use `inode/file_key` when available to detect renames.
- If not available, fallback to heuristics:
  - same content hash appears at new path shortly after deletion
  - same size + similar content signature (optional)

### 11.3 Reference Updates on Rename
If BlueKit supports “safe rename refactor”:
- find all references (links) to old path/title
- update links in those files
- reindex those modified files

This is a separate operation from passive indexing.

---

## 12) Failure Modes and Recovery
### 12.1 Watcher Failure
If watcher errors:
- mark watcher unhealthy
- schedule reconciliation soon
- attempt restart with exponential backoff
- show small UI warning if needed

### 12.2 Missed Events / Burst Changes
If a burst threshold is exceeded:
- stop trusting per-event updates
- schedule a reconciliation sweep
- optionally pause live updates until sweep completes

### 12.3 Partial Writes / Crashes
Because index is derived:
- on next open: reconcile and repair
- SQLite transactions prevent partial row states

### 12.4 Corruption
If DB integrity check fails:
- fallback to full rebuild from filesystem

---

## 13) Reconciliation Algorithm (Diff + Repair)
### 13.1 Snapshot Inputs
- `FS = { path -> (mtime, size, file_key?, hash?) }`
- `DB = { path -> stored fingerprint }` from `documents`

### 13.2 Diff Categories
- **Added:** in FS, not in DB
- **Removed:** in DB, not in FS
- **Changed:** in both, fingerprint differs
- **Unchanged:** fingerprint same

### 13.3 Repair Actions
- Added/Changed -> parse and upsert
- Removed -> delete doc + relations
- Unchanged -> do nothing

### 13.4 Practical Notes
- Use batched queries for speed
- Avoid hashing everything; hash on-demand
- Always verify file existence at parse time (races)

---

## 14) Parser Pipeline Design
### 14.1 Parsing Steps
1. read bytes
2. decode text (UTF-8 with safe fallback)
3. extract YAML frontmatter (if present)
4. parse markdown:
   - headings + positions
   - links + anchors
   - tags
   - optionally code fences
5. normalize:
   - lowercase tags
   - normalize property keys
   - stable slug for headings
6. output Document Record

### 14.2 Idempotency
Given the same file content and parse version:
- output must be deterministic
- upsert should replace previous extraction

### 14.3 Parse Versioning
Any change to extraction logic increments `parse_version`.
On version bump:
- targeted reindex is triggered (only files below current version)

---

## 15) Configuration and Extensibility
### 15.1 Index Scope Configuration
- include roots (workspace folders)
- exclude globs:
  - `.git/**`
  - `node_modules/**`
  - `dist/**`
  - `build/**`
- include only certain extensions (default `.md`)

### 15.2 Feature Flags
- index code blocks (on/off)
- index plain-text mentions (on/off)
- index only frontmatter + links for performance mode

### 15.3 Plugin Hooks (Future)
- allow custom extractors:
  - “extract kit tokens”
  - “extract milestones from plan markdown”
- extractor outputs are namespaced to avoid collisions

---

## 16) UX Requirements
- Show indexing progress:
  - files processed / total
  - current mode (reconciling / parsing / idle)
- Never block basic reading/editing on background indexing
- Provide user action:
  - “Rebuild index”
  - “Reindex folder”
  - “Pause indexing” (optional)
- Provide transparency:
  - last indexed time
  - watcher health status

---

## 17) Security + Privacy Considerations
- Indexing happens locally
- Never upload raw content without explicit user consent
- Allow marking folders as “do not index”
- Avoid indexing secrets by default (optional patterns):
  - `.env`, `secrets/`, etc.

---

## 18) Implementation Milestones
### Phase A: Minimal Correct Index
- enumerate files
- parse frontmatter + links + tags
- store in SQLite
- reconciliation on startup
- watcher incremental updates

### Phase B: Fast Search + UX
- add SQLite FTS5 for full-text search
- implement quick switcher + property filters
- in-memory caches for hot operations

### Phase C: Robust Drift Handling
- burst detection => reconciliation fallback
- watcher restart + health tracking
- periodic low-priority sanity scan

### Phase D: Refactor Tools
- rename safety
- update backlinks and references
- reindex impacted files

---

## 19) Summary: The Rulebook
- **Disk is truth.**
- **Index is cache.**
- On open: **reconcile**.
- During runtime: **watch + incremental update**.
- If watcher fails or changes are suspicious: **reconcile again**.
- Optimize via fingerprints, batching, FTS, and prioritization.
- Always provide a “rebuild index” escape hatch.

---