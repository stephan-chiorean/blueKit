# Git Commit Workflow & Checkpoints Implementation Plan

## Overview

This plan outlines the implementation of git-based project management features that leverage the existing GitHub authentication infrastructure. The goal is to enable users to **view commit history dynamically from GitHub**, **pin important commits as checkpoints**, and **create new projects from checkpoints** - building a lineage tree of project snapshots.

## Key Philosophy: Commits vs Checkpoints

### Commits (Dynamic, Not Persisted)
- **Retrieved dynamically** from GitHub API on demand
- **Cached** for performance (5-minute cache)
- **Paginated** for large repositories
- **NOT stored** in the database
- Users can **click commits** to see diffs in GitHub

### Checkpoints (Persisted in SQLite)
- **User-pinned commits** saved to database
- **Named snapshots** with descriptions and tags
- **Typed** (Milestone, Experiment, Template, Backup)
- **Lineage tracking** via parent-child relationships
- Can be used to **create new projects**

## Context & Prerequisites

### Completed GitHub Integration Phases

From `github-integration.md`, the following phases are **COMPLETE**:

- ✅ **Phase 1A**: Keychain Infrastructure (all platforms)
- ✅ **Phase 1B**: OAuth Authentication (PKCE flow)
- ✅ **Phase 1C**: Frontend Auth Module (GitHubAuthProvider, screens, hooks)
- ✅ **Phase 2A**: GitHub API Client Core (user info, repos)
- ✅ **Phase 2B**: GitHub API Content Operations (file CRUD)
- ✅ **Phase 3A**: Library Data Model (database schema)

### Technology Stack

- **Frontend**: React + TypeScript + Chakra UI
- **Backend**: Rust + Tauri
- **Git Operations**: libgit2 (via `git2` crate)
- **GitHub API**: Existing `GitHubClient` in `src-tauri/src/integrations/github/github.rs`
- **Database**: Sea-ORM with SQLite

### Current Capabilities

- Users can authenticate with GitHub (OAuth PKCE flow)
- GitHub access tokens stored securely in OS keychain
- GitHub API client can fetch user info, repos, file contents
- Existing clone system (`clones.json`) can create projects from git repos
- File watcher system tracks `.bluekit/` changes

## Goals

1. **Manual Git Connection**: Allow users to manually connect projects to their git repositories via UI action
2. **Database Migration**: Migrate from JSON files (`projectRegistry.json`, `clones.json`) to database storage
3. **Commit Timeline (Dynamic)**: View commit history fetched from GitHub API with caching and pagination
4. **Checkpoint System**: Pin commits as named checkpoints with types and lineage tracking
5. **Branch Management**: Switch branches, view branch history
6. **Project Creation**: Create new projects from checkpoints
7. **Diff Viewing**: Click commits to see diffs in GitHub

## Architecture Overview

### Flow Diagram

```
Project Registration → Database (projects table)
         ↓
[User Clicks "Connect Git"] → Git Detection → Update Database (git metadata)
                                      ↓
                           [Project Linked to Git]
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    ↓                                   ↓
        Commit Timeline View                   Branch Selector
        (GitHub API + Cache)                   (switch branches)
                    ↓                                   ↓
    ┌───────────────┼───────────────┐                 ↓
    ↓               ↓               ↓                 ↓
[Local Git]  [GitHub API]  [Cached Commits]   [Branch History]
                    ↓                                 ↓
                    └─────────────────────────────────┘
                                    ↓
                        Pin Commit as Checkpoint
                                    ↓
                        Database (checkpoints table)
                                    ↓
                    ┌───────────────┴───────────┐
                    ↓                           ↓
        Checkpoint Lineage Tree      Create Project from Checkpoint
                    ↓                           ↓
            Parent-Child Links          New Project Entry
```

### Component Architecture

```
ProjectDetailPage
├── ProjectGitInfo (shows current branch, remote, status)
│   ├── ConnectGitButton (manual git connection action)
│   └── BranchSelector (switch branches, view branch history)
├── CommitTimelineView (only shown if git connected)
│   ├── CommitFilterBar (branch, date range, author filter)
│   ├── CommitTimeline (list of commits from GitHub API)
│   │   └── CommitCard (commit info + checkpoint indicator)
│   │       ├── ViewDiffButton (opens GitHub diff view)
│   │       ├── PinCheckpointButton (save as checkpoint)
│   │       └── CheckpointBadge (if already pinned)
├── CheckpointsView (shows all pinned checkpoints)
│   └── CheckpointCard (pinned commit with metadata)
│       ├── CheckpointMetadata (name, type, tags, date pinned)
│       ├── CreateProjectButton (create from checkpoint)
│       ├── ViewLineageButton (show checkpoint tree)
│       └── UnpinButton (remove checkpoint)
└── CheckpointLineageTree (visual tree of checkpoint relationships)
    └── CheckpointNode (with parent-child connections)
```

## Database Schema

### Migration Strategy

**From JSON to SQLite:**

1. **`~/.bluekit/projectRegistry.json`** → `projects` table
   - All existing project metadata
   - Add new fields: `git_url`, `git_branch`, `git_connected`, `last_commit_sha`, etc.

2. **`.bluekit/clones.json`** (per project) → `checkpoints` table
   - Migrate existing clones as "Template" checkpoints
   - Add checkpoint types and lineage tracking

**NO commits.json files** - commits are fetched dynamically from GitHub API, not persisted.

### Database Entities

#### 1. Projects Table (Enhanced)

```rust
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub tags: Option<String>, // JSON array

    // Git metadata (populated when user connects git)
    pub git_connected: bool,
    pub git_url: Option<String>,
    pub git_branch: Option<String>,
    pub git_remote: Option<String>,
    pub last_commit_sha: Option<String>,
    pub last_synced_at: Option<i64>,

    // Timestamps
    pub created_at: i64,
    pub updated_at: i64,
    pub last_opened_at: Option<i64>,
}
```

#### 2. Checkpoints Table (Replaces clones.json)

**Philosophy**: Checkpoints are user-pinned git commits with metadata. They enable:
- Saving important project states
- Creating lineage trees of experiments/variations
- Using snapshots as templates for new projects

```rust
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "checkpoints")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,

    // Foreign key to projects table
    #[sea_orm(indexed)]
    pub project_id: String,

    // Git metadata
    pub git_commit_sha: String,
    pub git_branch: Option<String>,
    pub git_url: Option<String>,

    // Checkpoint metadata
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>, // JSON array: ["api-refactor", "working-auth"]

    // Checkpoint type: "milestone" | "experiment" | "template" | "backup"
    pub checkpoint_type: String,

    // Lineage tracking
    pub parent_checkpoint_id: Option<String>, // Foreign key to checkpoints.id

    // Project creation tracking
    pub created_from_project_id: Option<String>, // If created as new project, track it

    // Timestamps
    pub pinned_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::projects::Entity",
        from = "Column::ProjectId",
        to = "super::projects::Column::Id"
    )]
    Project,

    // Self-referential relation for lineage
    #[sea_orm(
        belongs_to = "Entity",
        from = "Column::ParentCheckpointId",
        to = "Column::Id"
    )]
    ParentCheckpoint,
}
```

### Checkpoint Types

1. **Milestone**: Major project achievements
   - Example: "v1.0 Release", "Authentication Complete"
   - Use case: Document important progress points

2. **Experiment**: Exploratory variations
   - Example: "Try Redux Instead", "New UI Layout"
   - Use case: Branch off to test ideas, maintain lineage

3. **Template**: Reusable starting points
   - Example: "React + Tauri Starter", "API Boilerplate"
   - Use case: Create new projects from proven patterns

4. **Backup**: Safety snapshots
   - Example: "Before Refactor", "Last Known Good"
   - Use case: Safety net before risky changes

### Migration Code

```rust
use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize)]
struct ProjectRegistryJson {
    projects: Vec<ProjectJson>,
}

#[derive(Serialize, Deserialize)]
struct ProjectJson {
    id: String,
    name: String,
    path: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    created_at: i64,
}

#[derive(Serialize, Deserialize)]
struct CloneMetadata {
    id: String,
    name: String,
    description: Option<String>,
    git_url: Option<String>,
    git_commit: Option<String>,
    git_branch: Option<String>,
    git_tag: Option<String>,
    tags: Option<Vec<String>>,
    created_at: i64,
}

#[derive(Serialize)]
pub struct MigrationSummary {
    pub projects_migrated: usize,
    pub checkpoints_migrated: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn migrate_json_to_database(
    db: State<'_, DatabaseConnection>,
) -> Result<MigrationSummary, String> {
    let mut summary = MigrationSummary {
        projects_migrated: 0,
        checkpoints_migrated: 0,
        errors: vec![],
    };

    // 1. Migrate projectRegistry.json → projects table
    let registry_path = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".bluekit/projectRegistry.json");

    if registry_path.exists() {
        let registry_json = fs::read_to_string(&registry_path)
            .map_err(|e| format!("Failed to read projectRegistry.json: {}", e))?;

        let registry: ProjectRegistryJson = serde_json::from_str(&registry_json)
            .map_err(|e| format!("Failed to parse projectRegistry.json: {}", e))?;

        for project_json in registry.projects {
            let project = projects::ActiveModel {
                id: Set(project_json.id.clone()),
                name: Set(project_json.name),
                path: Set(project_json.path.clone()),
                description: Set(project_json.description),
                tags: Set(if project_json.tags.is_empty() {
                    None
                } else {
                    Some(serde_json::to_string(&project_json.tags).unwrap())
                }),
                git_connected: Set(false),
                git_url: Set(None),
                git_branch: Set(None),
                git_remote: Set(None),
                last_commit_sha: Set(None),
                last_synced_at: Set(None),
                created_at: Set(project_json.created_at),
                updated_at: Set(chrono::Utc::now().timestamp_millis()),
                last_opened_at: Set(None),
            };

            if let Err(e) = project.insert(db.as_ref()).await {
                summary.errors.push(format!("Failed to migrate project {}: {}", project_json.id, e));
            } else {
                summary.projects_migrated += 1;
            }

            // 2. Migrate .bluekit/clones.json → checkpoints table
            let clones_path = format!("{}/.bluekit/clones.json", project_json.path);
            if Path::new(&clones_path).exists() {
                if let Ok(clones_json) = fs::read_to_string(&clones_path) {
                    if let Ok(clones) = serde_json::from_str::<Vec<CloneMetadata>>(&clones_json) {
                        for clone in clones {
                            let checkpoint = checkpoints::ActiveModel {
                                id: Set(clone.id.clone()),
                                project_id: Set(project_json.id.clone()),
                                git_commit_sha: Set(clone.git_commit.unwrap_or_default()),
                                git_branch: Set(clone.git_branch),
                                git_url: Set(clone.git_url),
                                name: Set(clone.name),
                                description: Set(clone.description),
                                tags: Set(clone.tags.and_then(|t| {
                                    if t.is_empty() { None } else { Some(serde_json::to_string(&t).unwrap()) }
                                })),
                                checkpoint_type: Set("template".to_string()), // Existing clones → templates
                                parent_checkpoint_id: Set(None),
                                created_from_project_id: Set(None),
                                pinned_at: Set(clone.created_at),
                                created_at: Set(clone.created_at),
                                updated_at: Set(chrono::Utc::now().timestamp_millis()),
                            };

                            if let Err(e) = checkpoint.insert(db.as_ref()).await {
                                summary.errors.push(format!("Failed to migrate checkpoint {}: {}", clone.id, e));
                            } else {
                                summary.checkpoints_migrated += 1;
                            }
                        }
                    }
                }
            }
        }

        // Backup original JSON files
        let backup_path = registry_path.with_extension("json.backup");
        fs::copy(&registry_path, &backup_path)
            .map_err(|e| format!("Failed to backup projectRegistry.json: {}", e))?;
    }

    Ok(summary)
}
```

## Implementation Plan

### Phase 1: Database Migration & Manual Git Connection

**Goal**: Replace JSON-based storage with SQLite, enable manual git connection.

#### Tasks

1. **Create Database Entities**
   - [ ] Create `projects` entity with git fields
   - [ ] Create `checkpoints` entity with lineage support
   - [ ] Run migrations to create tables

2. **Implement Migration Command**
   - [ ] Create `migrate_json_to_database` command
   - [ ] Test with sample data
   - [ ] Add backup/rollback functionality

3. **Manual Git Connection UI**
   - [ ] Add "Connect Git" button to ProjectDetailPage
   - [ ] Implement git detection logic (detect .git directory)
   - [ ] Fetch git metadata: remote URL, current branch, latest commit
   - [ ] Update projects table with git metadata

4. **Update Project Registry System**
   - [ ] Replace `get_project_registry` to read from database
   - [ ] Update `add_project` to write to database
   - [ ] Keep `projectRegistry.json` in sync for CLI compatibility (hybrid approach)

**Acceptance Criteria**:
- ✅ All projects migrated from JSON to database
- ✅ Users can manually connect projects to git
- ✅ Git metadata stored in database
- ✅ Backward compatibility: `projectRegistry.json` kept in sync

---

### Phase 2: Commit Timeline (GitHub API)

**Goal**: Display commit history dynamically fetched from GitHub API with caching.

#### Tasks

1. **GitHub API Commits Endpoint**
   - [ ] Implement `fetch_commits` in GitHubClient
   - [ ] Support pagination (per_page, page parameters)
   - [ ] Support branch filtering
   - [ ] Add error handling for rate limits

2. **Commit Caching System**
   - [ ] Implement in-memory cache with 5-minute TTL
   - [ ] Cache key: `{project_id}:{branch}:{page}`
   - [ ] Invalidate on branch switch

3. **Tauri Commands**
   ```rust
   #[tauri::command]
   pub async fn fetch_project_commits(
       project_id: String,
       branch: Option<String>,
       page: Option<u32>,
       per_page: Option<u32>,
   ) -> Result<Vec<GitCommit>, String>

   #[tauri::command]
   pub async fn view_commit_diff_in_github(
       git_url: String,
       commit_sha: String,
   ) -> Result<(), String> {
       // Open: {git_url}/commit/{commit_sha} in browser
   }
   ```

4. **Frontend Components**
   - [ ] Create `CommitTimelineView` component
   - [ ] Create `CommitCard` with diff button
   - [ ] Add pagination controls
   - [ ] Add loading states and error handling
   - [ ] Add "View in GitHub" button for each commit

**Acceptance Criteria**:
- ✅ Commits fetched dynamically from GitHub API
- ✅ Pagination works for large repos
- ✅ Cache reduces API calls
- ✅ Users can click commits to see diffs in GitHub
- ✅ NO commits stored in database

---

### Phase 3: Checkpoint System

**Goal**: Pin commits as checkpoints with types and lineage tracking.

#### Tasks

1. **Checkpoint CRUD Commands**
   ```rust
   #[tauri::command]
   pub async fn pin_checkpoint(
       project_id: String,
       git_commit_sha: String,
       name: String,
       description: Option<String>,
       checkpoint_type: String, // "milestone" | "experiment" | "template" | "backup"
       parent_checkpoint_id: Option<String>,
       tags: Option<Vec<String>>,
   ) -> Result<Checkpoint, String>

   #[tauri::command]
   pub async fn get_project_checkpoints(
       project_id: String,
   ) -> Result<Vec<Checkpoint>, String>

   #[tauri::command]
   pub async fn get_checkpoint_lineage(
       checkpoint_id: String,
   ) -> Result<CheckpointTree, String> {
       // Return parent-child tree structure
   }

   #[tauri::command]
   pub async fn unpin_checkpoint(
       checkpoint_id: String,
   ) -> Result<(), String>
   ```

2. **Frontend Components**
   - [ ] Create `CheckpointsView` component
   - [ ] Create `PinCheckpointModal` with type selector
   - [ ] Create `CheckpointCard` with type badge
   - [ ] Create `CheckpointLineageTree` visualization
   - [ ] Add parent checkpoint selector

3. **Checkpoint Types UI**
   - [ ] Type selector in pin modal
   - [ ] Type badges (different colors per type)
   - [ ] Type filtering in checkpoints view

4. **Lineage Tracking**
   - [ ] Support selecting parent checkpoint when pinning
   - [ ] Recursive query for checkpoint trees
   - [ ] Visualize lineage tree (D3.js or React Flow)

**Acceptance Criteria**:
- ✅ Users can pin commits as checkpoints
- ✅ Checkpoints have types (Milestone, Experiment, Template, Backup)
- ✅ Checkpoints support parent-child lineage
- ✅ Lineage tree visualized
- ✅ Users can filter checkpoints by type

---

### Phase 4: Project Creation from Checkpoints

**Goal**: Create new projects from checkpoints (template workflow).

#### Tasks

1. **Create Project from Checkpoint Command**
   ```rust
   #[tauri::command]
   pub async fn create_project_from_checkpoint(
       checkpoint_id: String,
       target_path: String,
       new_project_name: String,
       register_project: bool, // Add to projects table?
   ) -> Result<ProjectCreationResult, String> {
       // 1. Get checkpoint metadata
       // 2. Clone git repo to temp directory
       // 3. Checkout commit SHA
       // 4. Copy files to target_path (exclude .git)
       // 5. If register_project, add to projects table
       // 6. Update checkpoint.created_from_project_id
       // 7. Clean up temp directory
   }
   ```

2. **Frontend Flow**
   - [ ] "Create Project" button on CheckpointCard
   - [ ] Project creation modal (name, path picker)
   - [ ] Option to register as new project
   - [ ] Progress indicator for long operations
   - [ ] Success message with "Open Project" button

3. **Lineage Preservation**
   - [ ] When creating checkpoint in new project, support linking to parent checkpoint
   - [ ] Query to build full lineage tree across projects

**Acceptance Criteria**:
- ✅ Users can create new projects from checkpoints
- ✅ Git repo cloned at specific commit
- ✅ Files copied to target location
- ✅ New project optionally registered
- ✅ Lineage preserved across projects

---

### Phase 5: Branch Management

**Goal**: Switch branches, view branch-specific commit history.

#### Tasks

1. **Branch Operations**
   ```rust
   #[tauri::command]
   pub async fn get_project_branches(
       project_id: String,
   ) -> Result<Vec<GitBranch>, String> {
       // Fetch branches from GitHub API
   }

   #[tauri::command]
   pub async fn switch_branch(
       project_id: String,
       branch_name: String,
   ) -> Result<(), String> {
       // Update local git repo
       // Update projects.git_branch in database
   }
   ```

2. **Frontend Components**
   - [ ] `BranchSelector` dropdown in ProjectGitInfo
   - [ ] Branch indicator in CommitTimeline
   - [ ] Branch-specific commit filtering
   - [ ] Visual branch indicator on CommitCard

**Acceptance Criteria**:
- ✅ Users can view all branches
- ✅ Users can switch branches
- ✅ Commit timeline updates to show branch-specific commits
- ✅ Branch name stored in database

---

## BlueKit Init with SQLite

### Problem

The `bluekit init` CLI command currently writes to `projectRegistry.json`. With database migration, how does CLI integration work?

### Solution: Hybrid Approach

**Phase 1 (Current)**: CLI writes JSON, app syncs to database
```rust
// CLI (bluekit init) → writes to projectRegistry.json
// App on startup → syncs projectRegistry.json to SQLite

#[tauri::command]
pub async fn sync_project_registry(
    db: State<'_, DatabaseConnection>,
) -> Result<SyncSummary, String> {
    let registry_path = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".bluekit/projectRegistry.json");

    if !registry_path.exists() {
        return Ok(SyncSummary { synced: 0, skipped: 0 });
    }

    let registry_json = fs::read_to_string(&registry_path)?;
    let registry: ProjectRegistryJson = serde_json::from_str(&registry_json)?;

    let mut summary = SyncSummary { synced: 0, skipped: 0 };

    for project_json in registry.projects {
        // Check if already in database
        let existing = projects::Entity::find_by_id(&project_json.id)
            .one(db.as_ref())
            .await?;

        if existing.is_none() {
            // Insert into database
            let project = projects::ActiveModel {
                id: Set(project_json.id),
                name: Set(project_json.name),
                path: Set(project_json.path),
                // ... other fields
            };
            project.insert(db.as_ref()).await?;
            summary.synced += 1;
        } else {
            summary.skipped += 1;
        }
    }

    Ok(summary)
}
```

**Phase 2 (Future)**: CLI writes directly to SQLite
```rust
// bluekit CLI uses rusqlite to write directly to ~/.bluekit/bluekit.db
// No JSON intermediary needed
```

---

## File Watcher Integration

### Current File Watcher

The existing file watcher (`src-tauri/src/watcher.rs`) monitors `.bluekit/` directories for changes. With database migration, it needs updates:

**Before**: Watch `projectRegistry.json`, emit events
**After**: Watch database file, emit events on database changes

### Approach

Keep file watcher for `.bluekit/` resources (kits, walkthroughs, etc.), but NOT for project registry:

```rust
// On app startup
#[tauri::command]
pub async fn watch_project_registry_db(
    app_handle: AppHandle,
    db: State<'_, DatabaseConnection>,
) -> Result<(), String> {
    let db_path = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".bluekit/bluekit.db");

    // Watch database file for changes (from external edits)
    // Emit "database-changed" event to frontend
    // Frontend refreshes projects list
}
```

---

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pin_checkpoint() {
        // Test checkpoint creation
    }

    #[tokio::test]
    async fn test_checkpoint_lineage() {
        // Test parent-child relationships
    }

    #[tokio::test]
    async fn test_create_project_from_checkpoint() {
        // Test project creation workflow
    }
}
```

### Integration Tests

1. **Migration Test**: Migrate sample `projectRegistry.json` and `clones.json`
2. **GitHub API Test**: Fetch commits for known repo
3. **Checkpoint Lineage Test**: Create checkpoint tree, verify queries
4. **Project Creation Test**: Create project from checkpoint, verify files

---

## UI/UX Considerations

### Commit Timeline View

- **Empty State**: "No commits found. Connect your project to git to see commit history."
- **Loading State**: Skeleton loaders for commit cards
- **Error State**: "Failed to fetch commits. Check your GitHub connection."
- **Pagination**: "Load more" button at bottom

### Checkpoint Management

- **Type Colors**:
  - Milestone: Blue
  - Experiment: Purple
  - Template: Green
  - Backup: Orange

- **Lineage Visualization**: Tree diagram with connecting lines

### Git Connection Flow

1. User clicks "Connect Git"
2. Modal: "Detected git repository at /path/to/project"
3. Show: Remote URL, current branch, latest commit
4. Button: "Connect" or "Cancel"
5. Success: "Project connected to git! View commit history now."

---

## Security Considerations

### GitHub Token Storage

- ✅ Tokens stored in OS keychain (Phase 1B complete)
- ✅ Never logged or exposed in UI
- ✅ Automatic token refresh

### Git Operations

- ⚠️ Validate all git URLs (prevent command injection)
- ⚠️ Sanitize commit SHAs (prevent path traversal)
- ⚠️ Use libgit2 for safe git operations (no shell commands)

### Database Security

- ✅ SQLite file permissions (user-only read/write)
- ✅ Prepared statements (prevent SQL injection)
- ✅ Input validation on all commands

---

## Performance Considerations

### Commit Fetching

- **Pagination**: Fetch 30 commits per page (GitHub default)
- **Caching**: 5-minute in-memory cache per project/branch
- **Rate Limiting**: GitHub API allows 5000 requests/hour (authenticated)

### Database Queries

- **Indexes**: Add indexes on `project_id`, `git_commit_sha`, `parent_checkpoint_id`
- **Joins**: Use efficient joins for checkpoint lineage queries
- **Batch Operations**: Migrate in batches to avoid memory exhaustion

### File Operations

- **Temp Directory**: Use OS temp directory for git clones
- **Cleanup**: Always clean up temp files (use `defer` pattern)
- **Progress Events**: Emit progress events for long operations

---

## Future Enhancements

### Phase 6: Advanced Features (Post-MVP)

1. **Checkpoint Comparison**: Diff between two checkpoints
2. **Checkpoint Merging**: Combine checkpoints from different branches
3. **Checkpoint Sharing**: Export/import checkpoints across machines
4. **Commit Search**: Full-text search in commit messages
5. **Branch Visualization**: Interactive git graph (like GitKraken)
6. **Checkpoint Tags**: Add tags to checkpoints for organization
7. **Checkpoint Notes**: Markdown notes attached to checkpoints

---

## Open Questions

1. **Checkpoint Deletion**: Should we allow deleting checkpoints? Or just unpinning?
   - **Decision**: Support both. Unpin = soft delete, Delete = hard delete.

2. **Checkpoint Naming**: Auto-generate names from commit messages or require user input?
   - **Decision**: Default to commit message, allow user to customize.

3. **Lineage Limits**: Should we limit checkpoint tree depth?
   - **Decision**: No hard limit, but visualize only 3 levels deep in UI.

4. **Checkpoint Types**: Allow custom types or restrict to predefined?
   - **Decision**: Restrict to 4 predefined types for consistency.

5. **Project Registry JSON**: Keep in sync forever or deprecate after migration?
   - **Decision**: Keep for CLI compatibility until CLI uses SQLite directly.

---

## Success Metrics

- ✅ 100% of projects migrated from JSON to database
- ✅ Commit timeline loads in <2 seconds for repos with <1000 commits
- ✅ Users can pin checkpoints in <3 clicks
- ✅ Checkpoint lineage tree renders in <1 second
- ✅ Project creation from checkpoint completes in <10 seconds
- ✅ Zero data loss during migration

---

## Related Documents

- `github-integration.md` - GitHub authentication and API client implementation
- `database-schema-design.md` - Full database schema for all BlueKit features
- `library-database-first.md` - Library system design with database-first approach
- `checkpoints-system.md` - Detailed checkpoints system design

---

## Revision History

- **2025-12-14**: Complete rewrite based on clarified philosophy
  - Separated commits (dynamic, GitHub API) from checkpoints (persisted, SQLite)
  - Renamed clones → checkpoints
  - Added checkpoint types (Milestone, Experiment, Template, Backup)
  - Added lineage tracking with parent-child relationships
  - Removed commit_annotations table (not needed for MVP)
  - Removed blueprint/template references (not in use)
  - Added BlueKit init hybrid approach
  - Clarified migration strategy
