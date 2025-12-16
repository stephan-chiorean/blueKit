# Library Implementation - Current State Plan (2025-12)

## Executive Summary

This document outlines the **current implementation plan** for the BlueKit Library system, updated to reflect what's already built and what remains to be implemented. The Library system enables users to publish kits/walkthroughs/agents to GitHub-backed workspaces and discover/sync artifacts across projects.

---

## What's Already Implemented ✅

### 1. Database Infrastructure

**Projects Table** (src-tauri/src/db/entities/project.rs:1)
- ✅ Full project metadata in SQLite
- ✅ Git connection fields (`git_connected`, `git_url`, `git_branch`, `git_remote`, `last_commit_sha`)
- ✅ Timestamps (`created_at`, `updated_at`, `last_opened_at`)
- ✅ Relations to checkpoints

**Library Workspaces Table** (src-tauri/src/db/entities/library_workspace.rs:1)
- ✅ Basic workspace metadata (`id`, `name`, `github_owner`, `github_repo`)
- ✅ Timestamps (`created_at`, `updated_at`)
- ✅ Relations to library artifacts

**Library Artifacts Table** (src-tauri/src/db/entities/library_artifact.rs:1)
- ✅ Basic artifact tracking (`id`, `workspace_id`, `local_path`, `library_path`, `artifact_type`)
- ✅ Publishing metadata (`published_at`, `last_synced_at`)
- ⚠️ **LIMITATION**: Uses path-based tracking (`local_path`) instead of stable resource IDs

### 2. GitHub Integration

**OAuth Authentication** (src-tauri/src/integrations/github/auth.rs:1)
- ✅ PKCE flow for secure authentication
- ✅ State parameter for CSRF protection
- ✅ Code exchange for access token

**Keychain Storage** (src-tauri/src/integrations/github/keychain.rs:1)
- ✅ Secure token storage using OS keychain
- ✅ Token retrieval and deletion
- ✅ Cross-platform support (macOS Keychain, Windows Credential Manager, Linux Secret Service)

**OAuth Callback Server** (src-tauri/src/integrations/github/oauth_server.rs:1)
- ✅ Local HTTP server for OAuth redirect
- ✅ Automatic code extraction and exchange

**GitHub API Client** (src-tauri/src/integrations/github/github.rs:1)
- ✅ Authenticated requests with Bearer token
- ✅ Rate limit handling (429 responses)
- ✅ Error handling for authentication failures
- ⚠️ **NEEDS**: File creation/update methods, repo listing, commit creation

**Commit Cache** (src-tauri/src/integrations/github/commit_cache.rs:1)
- ✅ In-memory caching for commit details
- ✅ Reduces GitHub API calls

### 3. Library Workspace Management

**Workspace Operations** (src-tauri/src/library/library.rs:1)
- ✅ `create_workspace()` - Create new workspace linked to GitHub repo
- ✅ `list_workspaces()` - List all user's workspaces
- ✅ `get_workspace()` - Get workspace by ID
- ❌ **MISSING**: Delete workspace, update workspace

---

## Critical Gaps & Architectural Issues ⚠️

### Issue 1: No Resource Tracking

**Problem**: The current `library_artifacts` table uses `local_path` to identify resources. This breaks when files are moved/renamed.

**From old plan** (library-database-first.md:89):
> Resource ID is source of truth, not path. Every resource has a stable UUID that never changes.

**What's Needed**: New `resources` table that:
- Assigns stable UUIDs to every kit/walkthrough/agent
- Tracks current file path (can change)
- Stores content hash for sync detection
- Links to projects table via `project_id`

### Issue 2: No Publishing Flow

**What's Missing**:
- ❌ Commands to publish local kits to workspace
- ❌ GitHub API integration for file creation/updates
- ❌ Content hash calculation
- ❌ Variation vs Update logic
- ❌ Commit message formatting (`[BlueKit] Publish: <name> by <user>`)

### Issue 3: No Subscriptions System

**What's Missing**:
- ❌ `library_subscriptions` table to track what user pulled from library
- ❌ Commands to pull artifacts into local projects
- ❌ Update detection (comparing local vs remote hashes)
- ❌ Sync workflow

### Issue 4: No File Watcher Integration

**What's Missing**:
- ❌ File watcher hooks to detect when published resources change locally
- ❌ "Unpublished changes" badge in UI
- ❌ Auto-update of resource metadata in database when files change

---

## Revised Database Schema (What We Need to Build)

### Resources Table (NEW - Top Priority)

**Purpose**: Track ALL resources (kits, walkthroughs, agents, diagrams) across all projects with stable IDs.

```sql
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY NOT NULL,          -- UUID - stable identifier
    project_id TEXT NOT NULL,              -- FK to projects

    -- File tracking
    file_path TEXT NOT NULL,               -- Relative path (.bluekit/kits/api-error.md)
    resource_type TEXT NOT NULL,           -- "kit" | "walkthrough" | "agent" | "diagram"

    -- Metadata (synced from YAML front matter)
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT,                             -- JSON array

    -- Content tracking
    content_hash TEXT NOT NULL,            -- SHA-256 of file content
    file_modified_at INTEGER NOT NULL,     -- OS file mtime

    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_resources_project_id ON resources(project_id);
CREATE INDEX idx_resources_file_path ON resources(file_path);
CREATE INDEX idx_resources_type ON resources(resource_type);
```

**Why This Matters**:
- `id` is UUID - **never changes** even if file moves
- `file_path` can change freely
- `content_hash` enables sync detection
- File watcher updates this table when files change

### Library Artifacts Table (UPGRADE EXISTING)

**Current Schema** (src-tauri/src/db/entities/library_artifact.rs:1):
```sql
-- Current (path-based, breaks on moves)
CREATE TABLE library_artifacts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    local_path TEXT NOT NULL,              -- ⚠️ PROBLEM: Not stable
    library_path TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    published_at INTEGER NOT NULL,
    last_synced_at INTEGER NOT NULL
);
```

**Upgraded Schema** (resource ID-based, survives moves):
```sql
CREATE TABLE library_artifacts (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,            -- FK to library_workspaces
    resource_id TEXT NOT NULL,             -- FK to resources (stable link!)

    -- Remote location
    remote_path TEXT NOT NULL,             -- Path in GitHub repo

    -- Snapshot metadata (at publish time)
    artifact_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT,                             -- JSON array

    -- Content tracking
    content_hash TEXT NOT NULL,            -- SHA-256 of published content
    github_commit_sha TEXT NOT NULL,       -- Git commit SHA

    -- Variation tracking
    parent_artifact_id TEXT,               -- FK to self (for variations)
    variation_label TEXT,                  -- "Mobile", "TypeScript", etc.

    -- Publishing info
    published_by TEXT,
    published_at INTEGER NOT NULL,
    last_synced_at INTEGER NOT NULL,

    FOREIGN KEY (workspace_id) REFERENCES library_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_artifact_id) REFERENCES library_artifacts(id)
);

CREATE INDEX idx_library_artifacts_workspace_id ON library_artifacts(workspace_id);
CREATE INDEX idx_library_artifacts_resource_id ON library_artifacts(resource_id);
CREATE INDEX idx_library_artifacts_parent_id ON library_artifacts(parent_artifact_id);
```

**Key Changes**:
- ✅ Uses `resource_id` instead of `local_path` (survives file moves)
- ✅ Stores snapshot of metadata at publish time
- ✅ Tracks GitHub commit SHA
- ✅ Supports variations via `parent_artifact_id`
- ✅ Tracks who published (`published_by`)

### Library Subscriptions Table (NEW)

**Purpose**: Track which library artifacts the user has pulled into local projects.

```sql
CREATE TABLE IF NOT EXISTS library_subscriptions (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,            -- FK to library_workspaces
    artifact_id TEXT NOT NULL,             -- FK to library_artifacts
    resource_id TEXT NOT NULL,             -- FK to resources (local copy)

    -- Sync state
    local_content_hash TEXT NOT NULL,
    remote_content_hash TEXT NOT NULL,

    -- Timestamps
    pulled_at INTEGER NOT NULL,
    last_checked_at INTEGER NOT NULL,

    FOREIGN KEY (workspace_id) REFERENCES library_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (artifact_id) REFERENCES library_artifacts(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE INDEX idx_library_subscriptions_workspace_id ON library_subscriptions(workspace_id);
CREATE INDEX idx_library_subscriptions_artifact_id ON library_subscriptions(artifact_id);
CREATE INDEX idx_library_subscriptions_resource_id ON library_subscriptions(resource_id);
```

**Update Detection Logic**:
```rust
if subscription.local_content_hash != subscription.remote_content_hash {
    // Show: "Update available from library"
}

if resource.content_hash != subscription.local_content_hash {
    // Show: "You have unpublished local changes"
}
```

---

## Implementation Roadmap

### Phase 1: Foundation - Resources Tracking (Week 1-2)

**Goal**: Build stable resource tracking system that survives file moves/renames.

**Tasks**:
1. **Create Resources Table Migration**
   - [ ] Add `create_resources_table()` to migrations.rs
   - [ ] Create `src-tauri/src/db/entities/resource.rs`
   - [ ] Add relation from projects to resources

2. **Implement Resource Scanning**
   - [ ] Create `scan_project_resources(project_id)` command
   - [ ] Parse YAML front matter from all .md/.mmd files in `.bluekit/`
   - [ ] Generate UUIDs for resources that don't have them
   - [ ] Calculate SHA-256 content hashes
   - [ ] Insert into resources table
   - [ ] Run on project open (if resources table empty for project)

3. **File Watcher Integration**
   - [ ] Hook into existing file watcher (src-tauri/src/watcher.rs)
   - [ ] On file create: Insert into resources table
   - [ ] On file modify: Update content_hash and updated_at
   - [ ] On file move: Update file_path (ID stays same)
   - [ ] On file delete: Delete from resources table (or soft delete if published)

4. **Tauri Commands**
   - [ ] `get_project_resources(project_id)` - List all resources for a project
   - [ ] `get_resource_by_id(resource_id)` - Get single resource
   - [ ] `get_resource_by_path(project_id, file_path)` - Lookup by path

**Testing**:
- Create kit → Resource appears in database with UUID
- Move kit to subfolder → Resource ID stays same, path updates
- Edit kit → content_hash updates
- Delete kit → Resource removed from database

**Deliverable**: Resources table fully populated and kept in sync via file watcher.

---

### Phase 2: GitHub API Extensions (Week 2-3)

**Goal**: Extend GitHub client to support file operations needed for publishing.

**Tasks**:
1. **Add GitHub File Operations** (src-tauri/src/integrations/github/github.rs)
   - [ ] `create_or_update_file()` - Create/update file in repo
     ```rust
     pub async fn create_or_update_file(
         &self,
         owner: &str,
         repo: &str,
         path: &str,
         content: &str,
         message: &str,
     ) -> Result<String, String>  // Returns commit SHA
     ```
   - [ ] `get_file_contents()` - Download file from repo
   - [ ] `get_file_sha()` - Get SHA for sync detection (lightweight)
   - [ ] `list_repo_files()` - List files in repo directory
   - [ ] `delete_file()` - Delete file from repo

2. **Add GitHub Repo Operations**
   - [ ] `create_repo()` - Create new GitHub repository
   - [ ] `get_repo()` - Get repository metadata
   - [ ] `list_user_repos()` - List user's repositories
   - [ ] `update_branch_protection()` - Configure branch protection (optional, for team workspaces)

3. **Content Hash Utilities**
   - [ ] Create `src-tauri/src/utils/hash.rs`
   - [ ] `calculate_content_hash(content: &str) -> String` - SHA-256 hash
   - [ ] Use same hashing in resources table and GitHub sync

**Testing**:
- Create file in test repo → File appears on GitHub
- Update file → New commit created
- Get file SHA → Matches local hash
- List files → Returns expected files

**Deliverable**: Full GitHub API client capable of all library operations.

---

### Phase 3: Publishing Flow (Week 3-4)

**Goal**: Enable users to publish local resources to library workspaces.

**Tasks**:
1. **Upgrade Library Artifacts Table**
   - [ ] Create migration to add missing columns (`resource_id`, `content_hash`, `github_commit_sha`, `parent_artifact_id`, `variation_label`, `published_by`, `name`, `description`, `tags`)
   - [ ] Update `src-tauri/src/db/entities/library_artifact.rs` entity
   - [ ] Add indexes for `resource_id` and `parent_artifact_id`

2. **Implement Publishing Command**
   - [ ] Create `publish_resource()` command in src-tauri/src/library/library.rs
     ```rust
     #[tauri::command]
     pub async fn publish_resource(
         db: &DatabaseConnection,
         resource_id: String,
         workspace_id: String,
     ) -> Result<LibraryArtifact, String>
     ```
   - [ ] Logic flow:
     1. Get resource from database by ID
     2. Check if already published (query library_artifacts by resource_id + workspace_id)
     3. If published → Ask user: [Update] or [Create Variation]?
     4. Read file content from disk
     5. Calculate content hash
     6. Push to GitHub via `create_or_update_file()`
     7. Create/update library_artifacts record with GitHub commit SHA
     8. Return artifact details

3. **Variation Handling**
   - [ ] If user selects "Create Variation":
     - Prompt for variation label ("Mobile", "TypeScript", etc.)
     - Generate new remote_path: `kits/<name>-<variation>.md`
     - Create new artifact with `parent_artifact_id` pointing to original
   - [ ] Query to get variations:
     ```sql
     SELECT * FROM library_artifacts
     WHERE parent_artifact_id = ?
     ```

4. **Commit Message Convention**
   - [ ] Format: `[BlueKit] Publish: <resource_name> by <user_email>`
   - [ ] Get user email from GitHub API (`/user` endpoint)
   - [ ] Store in commit message for attribution

**Testing**:
- Publish new kit → Appears in GitHub repo
- Publish again → Shows [Update] or [Variation] dialog
- Create variation → Two artifacts in database, linked by parent_artifact_id
- Commit message follows `[BlueKit]` convention

**Deliverable**: Full publishing workflow from local resource to GitHub.

---

### Phase 4: Discovery & Pulling (Week 4-5)

**Goal**: Enable users to browse library and pull artifacts into local projects.

**Tasks**:
1. **Create Library Subscriptions Table**
   - [ ] Add `create_library_subscriptions_table()` to migrations.rs
   - [ ] Create `src-tauri/src/db/entities/library_subscription.rs`
   - [ ] Add indexes for workspace_id, artifact_id, resource_id

2. **Implement Discovery Commands**
   - [ ] `sync_workspace_artifacts(workspace_id)` - Fetch artifact metadata from GitHub
     - List all files in repo via GitHub API
     - Parse YAML front matter from each file
     - Insert/update library_artifacts table
     - Return list of artifacts
   - [ ] `get_workspace_artifacts(workspace_id)` - Get cached artifacts from database
   - [ ] `search_artifacts(query, workspace_id)` - Search by name/tags/description

3. **Implement Pulling Command**
   - [ ] Create `pull_artifact()` command
     ```rust
     #[tauri::command]
     pub async fn pull_artifact(
         db: &DatabaseConnection,
         artifact_id: String,
         target_project_id: String,
     ) -> Result<Resource, String>
     ```
   - [ ] Logic flow:
     1. Get artifact from database
     2. Get workspace details
     3. Download content from GitHub via `get_file_contents()`
     4. Determine local path (`.bluekit/<type>s/<filename>`)
     5. Write file to disk
     6. Create resource in resources table
     7. Create subscription in library_subscriptions table
     8. Return resource details

4. **Duplicate Detection**
   - [ ] Before pulling, check if resource already exists:
     ```sql
     SELECT * FROM library_subscriptions
     WHERE artifact_id = ? AND resource_id IN (
         SELECT id FROM resources WHERE project_id = ?
     )
     ```
   - [ ] If exists → Show warning: "Already pulled. [View Local] [Pull Anyway]"

**Testing**:
- Sync workspace → Artifacts appear in database
- Pull artifact → File appears in local project
- Pull same artifact twice → Shows duplicate warning
- Subscription created with correct hashes

**Deliverable**: Full discovery and pulling workflow.

---

### Phase 5: Update Detection & Sync (Week 5-6)

**Goal**: Detect when library has updates or user has local changes.

**Tasks**:
1. **Implement Sync Check Command**
   - [ ] Create `check_for_updates(workspace_id)` command
     ```rust
     pub async fn check_for_updates(
         db: &DatabaseConnection,
         workspace_id: String,
     ) -> Result<Vec<UpdateInfo>, String>
     ```
   - [ ] For each subscription:
     - Fetch remote content hash from GitHub (via `get_file_sha()`)
     - Compare to `subscription.remote_content_hash`
     - If different → Remote has updates
     - Get local resource's current hash
     - Compare to `subscription.local_content_hash`
     - If different → User has local changes
   - [ ] Return update status:
     - `UpdateStatus::LocalChanges` - User modified locally
     - `UpdateStatus::RemoteUpdates` - Library has updates
     - `UpdateStatus::Conflict` - Both changed

2. **Implement Pull Update Command**
   - [ ] Create `pull_update(subscription_id)` command
   - [ ] Logic:
     1. Get subscription details
     2. Download new content from GitHub
     3. Show diff to user (frontend handles this)
     4. User approves → Overwrite local file
     5. Update resource content_hash
     6. Update subscription local_content_hash and remote_content_hash
     7. Update subscription.last_checked_at

3. **File Watcher Integration for Published Resources**
   - [ ] When resource changes:
     - Check if resource has library_artifact record
     - If yes → Compare current hash to artifact.content_hash
     - If different → Emit event `resource-has-unpublished-changes`
     - Frontend shows badge: "Unpublished changes"

4. **Background Sync (Optional)**
   - [ ] Create periodic task to check for updates (every 30 minutes)
   - [ ] Only fetch metadata (hashes), not full content
   - [ ] Store update count in memory
   - [ ] Emit event if updates available

**Testing**:
- Team member updates kit in GitHub → User sees "Update available" badge
- User clicks "View update" → Shows diff
- User pulls update → Local file updated
- User edits pulled kit → "Unpublished changes" badge appears

**Deliverable**: Full bidirectional sync detection.

---

### Phase 6: UI Integration (Week 6-7)

**Goal**: Build React components for library management.

**Tasks**:
1. **Library Sidebar Component** (src/components/library/)
   - [ ] `LibrarySidebar.tsx` - Main library navigation
   - [ ] `WorkspaceList.tsx` - List of user's workspaces
   - [ ] `WorkspaceCard.tsx` - Single workspace display
   - [ ] `CreateWorkspaceDialog.tsx` - Create new workspace

2. **Discovery Components**
   - [ ] `ArtifactBrowser.tsx` - Browse artifacts in workspace
   - [ ] `ArtifactCard.tsx` - Single artifact display
   - [ ] `ArtifactPreviewModal.tsx` - Preview artifact content
   - [ ] `PullButton.tsx` - Pull artifact into project

3. **Publishing Components**
   - [ ] `PublishDialog.tsx` - Publish resource to workspace
   - [ ] `UpdateOrVariationDialog.tsx` - Choose update vs variation
   - [ ] `VariationLabelInput.tsx` - Input variation name
   - [ ] `PublishedBadge.tsx` - Show "Published" badge on resources

4. **Sync Components**
   - [ ] `UpdateBadge.tsx` - Show "Updates available" badge
   - [ ] `UpdateDiffModal.tsx` - Show diff before pulling update
   - [ ] `UnpublishedChangesBadge.tsx` - Show "Unpublished changes" badge
   - [ ] `SyncButton.tsx` - Manual sync trigger

5. **Context Providers**
   - [ ] `LibraryContext.tsx` - Global library state
   - [ ] Store workspaces, artifacts, subscriptions
   - [ ] Listen to Tauri events for real-time updates

**Testing**:
- Create workspace via UI → Workspace appears
- Browse artifacts → See list with metadata
- Pull artifact → File appears in project, subscription created
- Publish resource → GitHub updated, artifact created
- See update badge → Click to view diff

**Deliverable**: Full UI for library management.

---

### Phase 7: Polish & Edge Cases (Week 7-8)

**Goal**: Handle edge cases and improve UX.

**Tasks**:
1. **Error Handling**
   - [ ] GitHub API errors (rate limits, auth failures)
   - [ ] Network errors during publish/pull
   - [ ] Disk write failures
   - [ ] Invalid file formats

2. **Conflict Resolution**
   - [ ] Both local and remote changed → Show merge options
   - [ ] Published resource deleted locally → Prompt [Delete from library] or [Restore]
   - [ ] Subscription points to deleted resource → Clean up orphaned subscriptions

3. **Performance Optimization**
   - [ ] Batch artifact syncing (don't fetch one by one)
   - [ ] Cache GitHub API responses (use commit_cache)
   - [ ] Lazy load artifact content (only when viewing)
   - [ ] Debounce file watcher events

4. **User Experience**
   - [ ] Loading states during GitHub operations
   - [ ] Progress bars for bulk operations
   - [ ] Toast notifications for success/failure
   - [ ] Keyboard shortcuts (Cmd+P for publish)

5. **Documentation**
   - [ ] Update CLAUDE.md with library system architecture
   - [ ] Document database schema changes
   - [ ] Add library commands to IPC documentation
   - [ ] Create user guide for library workflows

**Deliverable**: Production-ready library system.

---

## Key Architectural Decisions

### 1. Database is Source of Truth

**YAML front matter** → Human-readable metadata only (name, tags, description)
**SQLite database** → All publishing/sync state (resource IDs, hashes, relationships)

**Benefits**:
- ✅ Reliable (database can't be accidentally edited)
- ✅ Transactional (atomic updates)
- ✅ Queryable (SQL for complex queries)
- ✅ Survives file moves (resource ID is stable)

### 2. Resource ID Stability

**Every resource has a UUID** that never changes, even when:
- File is moved to different folder
- File is renamed
- File is copied

**File path is NOT source of truth!**

### 3. Variations Over Versions

**Simple model**:
- Original artifact (parent_artifact_id = null)
- Variations (parent_artifact_id = original_id)

**No complex version trees!** Just:
- Update (overwrites original)
- Variation (creates new linked artifact)

### 4. Commit Message Convention

**Format**: `[BlueKit] <action>: <name> by <user>`

**Examples**:
- `[BlueKit] Publish: API Error Handling by john@acme.com`
- `[BlueKit] Update: React Context Pattern by jane@acme.com`
- `[BlueKit] Variation: API Error Handling (Mobile) by john@acme.com`

**Benefits**:
- Easy to filter BlueKit commits: `git log --grep="\[BlueKit\]"`
- Detect non-BlueKit changes and warn user
- Attribution for team collaboration

### 5. Manual Sync (MVP)

**No automatic background sync** in MVP. User triggers sync manually.

**Later**: Optional periodic background polling (every 30 minutes).

---

## Migration from Current State

### Step 1: Add Resources Table

**One-time migration**:
```rust
// On app startup (or via manual command)
scan_all_projects().await?;
  ↓
For each project:
  Scan .bluekit/ directory
  For each .md/.mmd file:
    Parse YAML front matter
    Generate UUID if missing
    Calculate content hash
    Insert into resources table
  File watcher takes over (keeps in sync)
```

### Step 2: Upgrade Library Artifacts Table

**Add columns** via migration:
- `resource_id` (link to resources)
- `content_hash`, `github_commit_sha`
- `parent_artifact_id`, `variation_label`
- `published_by`, `name`, `description`, `tags`

**Migrate existing artifacts**:
- For each existing artifact:
  - Find corresponding resource by matching local_path
  - Set resource_id
  - If resource not found → Mark as orphaned

### Step 3: Add Library Subscriptions Table

**Fresh start** - no existing subscriptions to migrate.

---

## Testing Strategy

### Unit Tests
- [ ] Resource hash calculation
- [ ] YAML front matter parsing
- [ ] Update detection logic
- [ ] Variation linking queries

### Integration Tests
- [ ] Publish → GitHub → Database flow
- [ ] Pull → GitHub → Local file → Database flow
- [ ] Sync → GitHub → Update detection
- [ ] File watcher → Resource updates

### E2E Tests
- [ ] Full publish workflow (user clicks publish → appears in GitHub)
- [ ] Full pull workflow (browse → pull → appears locally)
- [ ] Update workflow (library changes → user sees update → pulls)
- [ ] Variation workflow (publish variation → linked in database)

---

## Open Questions / Future Enhancements

### 1. GitHub Pages Support

**Optional**: Auto-enable GitHub Pages when creating workspace.

**Benefit**: Library becomes browsable website at `https://<owner>.github.io/<repo>/`

**Implementation**:
- Use GitHub API to enable Pages
- Add `index.md` with kit listing
- Auto-update index when artifacts change

### 2. Team Workspaces with Branch Protection

**Use Case**: Require PR approval before publishing to team library.

**Implementation**:
- Configure branch protection via GitHub API
- BlueKit creates branch → PR instead of direct commit
- Team member reviews → Merges PR
- BlueKit detects merge → Updates artifact

### 3. Collection Publishing

**Use Case**: Publish entire folder of kits at once.

**Implementation**:
- Select folder in UI
- Publish all resources in folder
- Preserve folder structure in GitHub
- Single commit with all changes

### 4. Private Workspaces

**Use Case**: Private libraries for personal use or teams.

**Implementation**:
- GitHub API supports creating private repos
- No changes needed to BlueKit (just uses private repo)
- GitHub token permissions need `repo` scope (not just `public_repo`)

---

## Summary

### What We Have ✅
- Projects in database with Git metadata
- GitHub OAuth authentication + keychain storage
- Basic workspace management (create, list, get)
- Library workspace and artifact tables (path-based)

### What We Need ⚠️
- **Resources table** - Stable resource tracking (TOP PRIORITY)
- **Library subscriptions table** - Track what user pulled
- **Upgraded library artifacts table** - Resource ID-based instead of path-based
- **GitHub API extensions** - File create/update/delete operations
- **Publishing commands** - Publish local resources to GitHub
- **Pulling commands** - Pull artifacts into local projects
- **Update detection** - Compare hashes to detect changes
- **File watcher hooks** - Sync resources table on file changes
- **UI components** - React components for library management

### Implementation Timeline
- **Phase 1-2** (Weeks 1-3): Foundation (resources + GitHub API)
- **Phase 3** (Week 3-4): Publishing
- **Phase 4** (Week 4-5): Discovery & Pulling
- **Phase 5** (Week 5-6): Update Detection
- **Phase 6** (Week 6-7): UI Integration
- **Phase 7** (Week 7-8): Polish & Edge Cases

**Estimated Total**: 8 weeks for full library system

---

**Last Updated**: 2025-12-15
**Status**: 🔄 **Ready to Implement Phase 1** (Resources Table)

---

## Next Steps

1. Review this plan and confirm architectural approach
2. Start Phase 1: Create resources table migration
3. Implement resource scanning on project open
4. Hook file watcher to update resources table
5. Verify resource IDs stay stable when files move

Once resources tracking is solid, we can build publishing/pulling on top with confidence.
