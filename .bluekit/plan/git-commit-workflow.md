# Git Commit Workflow Implementation Plan

## Overview

This plan outlines the implementation of git-based project management features that leverage the existing GitHub authentication infrastructure. The goal is to enable users to view, annotate, and create projects from commit history - building a "template tree" of project snapshots.

## Context & Prerequisites

### Completed GitHub Integration Phases

From `github-integration.md`, the following phases are **COMPLETE**:

- ✅ **Phase 1A**: Keychain Infrastructure (all platforms)
- ✅ **Phase 1B**: OAuth Authentication (PKCE flow instead of device flow)
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
- Existing clone system can create projects from git repos
- File watcher system tracks `.bluekit/` changes

## Goals

1. **Manual Git Connection**: Allow users to manually connect projects to their git repositories via UI action
2. **Database Migration**: Migrate from JSON files (`projectRegistry.json`, `clones.json`) to database storage for richer project metadata
3. **Commit Timeline with Pinned Nodes**: View commit history with ability to pin commits as saved checkpoints/clones
4. **Commit Annotations**: Add metadata, notes, and tags to commits (stored in database)
5. **Branch Management**: Switch branches, visualize branch history, manage branch-specific annotations
6. **Checkpoint System**: Pin commits as "clones" - saved snapshots that can be revisited or used as project templates
7. **Project Config Templates**: Support publishing entire project configurations to Library
8. **Enhanced Discovery**: Use commit history to understand project evolution and create template trees

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
        (with pinned nodes)                    (switch branches)
                    ↓                                   ↓
    ┌───────────────┼───────────────┐                 ↓
    ↓               ↓               ↓                 ↓
[Local Git]  [GitHub API]  [Pinned Commits]    [Branch History]
                    ↓               ↓                 ↓
                    └───────────────┴─────────────────┘
                                    ↓
                        Commit Annotation System
                                    ↓
                  Tag/Note/Metadata Storage (Database)
                                    ↓
                        ┌───────────┴───────────┐
                        ↓                       ↓
            "Pin Commit as Checkpoint"  "Annotate Commit"
                        ↓                       ↓
                Database (project_clones)  Database (commit_annotations)
                        ↓
            ┌───────────┴───────────┐
            ↓                       ↓
  "Create Project from Pin"  "Create Template"
            ↓                       ↓
    Template Tree View      Library Publishing
```

### Component Architecture

```
ProjectDetailPage
├── ProjectGitInfo (shows current branch, remote, status)
│   ├── ConnectGitButton (manual git connection action)
│   └── BranchSelector (switch branches, view branch history)
├── CommitTimelineView (only shown if git connected)
│   ├── CommitFilterBar (branch, author, date range, show pinned only)
│   ├── BranchVisualization (visual branch tree, optional)
│   ├── CommitTimeline (list of commits with visual indicators)
│   │   └── CommitCard (commit info + annotation badge + pin indicator from DB)
│   │       ├── PinButton (pin/unpin commit as checkpoint)
│   │       ├── AnnotationBadge (shows tags, bookmark, template-worthy)
│   │       └── BranchLabel (which branch this commit is on)
│   └── CommitDetailModal
│       ├── CommitMetadata (author, date, sha, parents, branch)
│       ├── CommitDiff (files changed)
│       ├── CommitAnnotation (notes/tags - saved to DB)
│       ├── PinAsCheckpointButton (save as named checkpoint in DB)
│       ├── CreateProjectButton (create from this commit/checkpoint)
│       └── PublishAsTemplateButton (publish to Library)
├── PinnedCommitsView (shows all pinned checkpoints)
│   └── CheckpointCard (pinned commit with custom name/description)
│       ├── CheckpointMetadata (when pinned, by who, notes)
│       ├── CreateProjectButton (create from checkpoint)
│       └── UnpinButton (remove checkpoint)
└── TemplateTreeView (shows project lineage from DB)
    └── TemplateNode (project with parent relationships)
        ├── ProjectInfo (name, description, commit SHA)
        └── ChildNodes (recursive tree structure)
```

### Database Migration Strategy

**Why Database?**
- ✅ Richer project metadata (git info, publishing status, Library associations)
- ✅ Relational queries (find all projects from a commit, all commits with specific tag)
- ✅ Better performance for large datasets (many commits, annotations, checkpoints)
- ✅ Support for Library publishing (track what's been published, sync status)
- ✅ Enable team collaboration features (shared annotations, templates)
- ✅ Atomic transactions for data integrity
- ✅ **Pin/checkpoint management** - track pinned commits as saved nodes
- ✅ **Branch management** - track branch-specific data and relationships
- ✅ **Clone lineage** - parent-child relationships for template trees

**What Gets Migrated:**
1. **`~/.bluekit/projectRegistry.json`** → `projects` table
   - All existing projects with metadata
   - Git connection info (if previously connected)

2. **`.bluekit/clones.json`** (per project) → `project_clones` table
   - All existing clone metadata
   - Parent project relationships
   - Converted to "pinned commits" concept

3. **`.bluekit/commits.json`** (per project) → `commit_annotations` table
   - All commit annotations, tags, notes
   - Bookmark and template-worthy flags

**Migration Path:**
1. Keep existing JSON file support for backward compatibility
2. On app startup, detect if migration is needed
3. Run migration automatically: JSON → Database
4. Validate migrated data integrity
5. New data always written to database
6. Eventually deprecate JSON files (with user warning/opt-in)

**Database Schema** (using Sea-ORM with SQLite):

```rust
// Projects table (replaces projectRegistry.json)
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub name: String,
    pub path: String,
    pub date_added: i64,
    pub last_opened: i64,

    // Git connection (nullable - only if user connects)
    pub git_connected: bool,
    pub git_url: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub git_remote_name: Option<String>,
    pub git_connected_at: Option<i64>,

    // Library publishing
    pub published_to_library: bool,
    pub library_workspace_id: Option<String>,
    pub last_published_at: Option<i64>,

    // Project config template metadata
    pub is_template: bool,
    pub template_description: Option<String>,
    pub template_tags: Option<String>, // JSON array
}

// Commit annotations table (replaces .bluekit/commits.json)
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "commit_annotations")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub project_id: String, // Foreign key to projects
    pub commit_sha: String,

    // Annotation data
    pub tags: Option<String>, // JSON array
    pub notes: Option<String>,
    pub is_bookmarked: bool,
    pub is_template_worthy: bool,
    pub metadata: Option<String>, // JSON object

    pub created_at: i64,
    pub updated_at: i64,
}

// Pinned commits / Clone metadata table (replaces .bluekit/clones.json)
// This table serves dual purpose:
// 1. Pinned commits within a project (checkpoints)
// 2. Cloned projects created from commits (new projects)
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "project_clones")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub project_id: String, // Foreign key to projects (the project this belongs to)
    pub name: String,       // User-defined name for checkpoint/clone
    pub description: Option<String>,

    // Checkpoint/Pin metadata
    pub is_pinned: bool,           // Is this a pinned checkpoint?
    pub checkpoint_label: Option<String>, // Custom label for checkpoint
    pub pinned_at: Option<i64>,    // When this commit was pinned
    pub pinned_by: Option<String>, // User who pinned (for team features)

    // Source information
    pub source_type: String, // "commit", "git_url", "github_repo", "checkpoint"
    pub git_url: Option<String>,
    pub git_commit: String,  // Required - commit SHA
    pub git_branch: Option<String>,
    pub git_tag: Option<String>,

    // Parent tracking for template tree (when creating new projects)
    pub parent_project_id: Option<String>, // Foreign key to projects (source project)
    pub parent_commit_sha: Option<String>, // Commit this was created from

    // New project tracking (if clone was converted to full project)
    pub cloned_project_id: Option<String>, // Foreign key to projects (if created as new project)

    pub tags: Option<String>, // JSON array
    pub created_at: i64,
    pub updated_at: i64,
}

// Project config templates table (for Library publishing)
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "project_templates")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub project_id: String, // Foreign key to projects
    pub name: String,
    pub description: Option<String>,

    // Template configuration
    pub config_snapshot: String, // JSON snapshot of project structure
    pub commit_sha: Option<String>, // If based on specific commit

    // Publishing
    pub published_to_library: bool,
    pub library_artifact_id: Option<String>,

    pub tags: Option<String>, // JSON array
    pub created_at: i64,
    pub updated_at: i64,
}
```

**Migration Command**:

```rust
#[derive(Debug, Serialize)]
pub struct MigrationSummary {
    pub projects_migrated: usize,
    pub annotations_migrated: usize,
    pub clones_migrated: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn migrate_json_to_database() -> Result<MigrationSummary, String> {
    let mut summary = MigrationSummary::default();
    let db = get_database().await?;

    // 1. Migrate projectRegistry.json → projects table
    if let Ok(registry_path) = get_registry_path() {
        if Path::new(&registry_path).exists() {
            let registry_json = fs::read_to_string(&registry_path)?;
            let registry: ProjectRegistry = serde_json::from_str(&registry_json)?;

            for project_entry in registry.projects {
                // Insert into projects table
                let project = projects::ActiveModel {
                    id: Set(project_entry.id),
                    name: Set(project_entry.name),
                    path: Set(project_entry.path),
                    date_added: Set(project_entry.date_added),
                    last_opened: Set(project_entry.last_opened),
                    git_connected: Set(false), // User must reconnect manually
                    // ... other fields
                };

                match project.insert(&db).await {
                    Ok(_) => summary.projects_migrated += 1,
                    Err(e) => summary.errors.push(format!("Project {}: {}", project_entry.name, e)),
                }
            }
        }
    }

    // 2. Migrate .bluekit/clones.json files → project_clones table
    let projects = Projects::find().all(&db).await?;
    for project in projects {
        let clones_path = format!("{}/.bluekit/clones.json", project.path);
        if Path::new(&clones_path).exists() {
            let clones_json = fs::read_to_string(&clones_path)?;
            let clones: Vec<CloneMetadata> = serde_json::from_str(&clones_json)?;

            for clone in clones {
                // Convert to pinned commit/checkpoint
                let project_clone = project_clones::ActiveModel {
                    id: Set(generate_id()),
                    project_id: Set(project.id.clone()),
                    name: Set(clone.name),
                    description: Set(clone.description),
                    is_pinned: Set(true), // Existing clones are treated as pinned
                    checkpoint_label: Set(Some(format!("Migrated: {}", clone.name))),
                    pinned_at: Set(Some(clone.created_at)),
                    git_commit: Set(clone.git_commit.unwrap_or_default()),
                    source_type: Set("checkpoint".to_string()),
                    // ... other fields
                };

                match project_clone.insert(&db).await {
                    Ok(_) => summary.clones_migrated += 1,
                    Err(e) => summary.errors.push(format!("Clone {}: {}", clone.name, e)),
                }
            }
        }
    }

    // 3. Migrate .bluekit/commits.json files → commit_annotations table
    for project in projects {
        let commits_path = format!("{}/.bluekit/commits.json", project.path);
        if Path::new(&commits_path).exists() {
            let commits_json = fs::read_to_string(&commits_path)?;
            let annotations: HashMap<String, CommitAnnotation> = serde_json::from_str(&commits_json)?;

            for (commit_sha, annotation) in annotations {
                let commit_annotation = commit_annotations::ActiveModel {
                    id: Set(generate_id()),
                    project_id: Set(project.id.clone()),
                    commit_sha: Set(commit_sha),
                    tags: Set(Some(serde_json::to_string(&annotation.tags)?)),
                    notes: Set(Some(annotation.notes)),
                    is_bookmarked: Set(annotation.is_bookmarked),
                    is_template_worthy: Set(annotation.is_template_worthy),
                    // ... other fields
                };

                match commit_annotation.insert(&db).await {
                    Ok(_) => summary.annotations_migrated += 1,
                    Err(e) => summary.errors.push(format!("Annotation {}: {}", commit_sha, e)),
                }
            }
        }
    }

    // 4. Mark migration as complete
    // Store migration flag in database or config

    Ok(summary)
}
```

## Pinning & Checkpoint Concept

**Checkpoints = Pinned Commits**

Instead of separate "clone" and "commit" systems, we unify them into a **checkpoint system**:

- **Pinned Commit**: A commit you've marked as important (saved as checkpoint)
- **Checkpoint**: A named snapshot of a specific commit with optional notes
- **Create Project from Pin**: Turn any checkpoint into a full new project
- **Visual Indicators**: Timeline shows pins as special nodes/markers

**Use Cases:**
1. **Milestone Marking**: Pin commits that represent completed features
2. **Experimentation**: Pin before trying risky changes, easy rollback
3. **Template Creation**: Pin commits that represent good starting points
4. **Team Coordination**: Share pinned checkpoints with team (future)
5. **Project Variants**: Create multiple projects from different pinned commits

**Data Model:**
- `is_pinned = true` → This is a checkpoint within current project
- `cloned_project_id != null` → This checkpoint was used to create a new project
- Parent relationships track template tree lineage

## Phase 0: Database Migration (Days 1-2)

### Goal

Migrate from JSON file storage (`projectRegistry.json`, `clones.json`, `commits.json`) to SQLite database for richer project metadata and better query performance.

### 0.1. Database Schema Setup

**Location**: `src-tauri/src/db/entities/`

Create entity files for:
- `projects.rs` - Project entity
- `commit_annotations.rs` - Commit annotation entity
- `project_clones.rs` - Clone metadata entity
- `project_templates.rs` - Project config template entity

**Location**: `src-tauri/src/db/migrations/`

Create migration files:
- `m20250101_create_projects.rs`
- `m20250101_create_commit_annotations.rs`
- `m20250101_create_project_clones.rs`
- `m20250101_create_project_templates.rs`

### 0.2. Migration Logic

**Location**: `src-tauri/src/db/migration.rs`

```rust
pub async fn migrate_from_json(db: &DatabaseConnection) -> Result<MigrationSummary, String> {
    let mut summary = MigrationSummary::default();

    // 1. Migrate projectRegistry.json
    if let Ok(registry) = read_project_registry_json() {
        for project_entry in registry.projects {
            let project = projects::ActiveModel {
                id: Set(project_entry.id),
                name: Set(project_entry.name),
                path: Set(project_entry.path),
                date_added: Set(project_entry.date_added),
                last_opened: Set(project_entry.last_opened),
                git_connected: Set(project_entry.git.is_some()),
                git_url: Set(project_entry.git.as_ref().and_then(|g| g.git_url.clone())),
                // ... map other fields
                ..Default::default()
            };

            project.insert(db).await?;
            summary.projects_migrated += 1;
        }
    }

    // 2. Migrate commits.json files for each project
    // 3. Migrate clones.json files

    Ok(summary)
}
```

### 0.3. Backward Compatibility Layer

Keep existing JSON-based commands working during transition:

```rust
#[tauri::command]
pub async fn get_project_registry() -> Result<ProjectRegistry, String> {
    // Check if database exists and has data
    if database_initialized().await? {
        // Return data from database
        get_projects_from_db().await
    } else {
        // Fallback to JSON file
        read_project_registry_json()
    }
}
```

### 0.4. Testing

**Manual Testing Checklist**:
- [ ] Run migration on existing BlueKit installation with JSON data
- [ ] Verify all projects migrated correctly
- [ ] Verify commit annotations preserved
- [ ] Verify clone metadata preserved
- [ ] Test that app works with database
- [ ] Test fallback to JSON if database not initialized

## Phase A: Manual Git Connection (Days 3-4)

### Goal

Allow users to manually connect their projects to git repositories via a UI button, detecting git metadata only when explicitly requested.

### A.1. Backend: Git Detection Module

**Location**: `src-tauri/src/git_operations.rs`

**Dependencies to Add** (`Cargo.toml`):
```toml
[dependencies]
git2 = { version = "0.18", features = ["https", "ssh"] }
```

**Data Structures**:

```rust
use git2::{Repository, Error as GitError};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitRepoInfo {
    pub has_git: bool,
    pub git_url: Option<String>,        // Remote origin URL
    pub current_branch: Option<String>, // HEAD branch name
    pub current_commit: Option<String>, // HEAD commit SHA
    pub is_dirty: bool,                 // Has uncommitted changes
    pub remote_name: Option<String>,    // Usually "origin"
}

impl GitRepoInfo {
    pub fn from_path(path: &str) -> Result<Self, String> {
        // Implementation below
    }
}
```

**Functions to Implement**:

```rust
pub struct GitOperations;

impl GitOperations {
    /// Detect if path is a git repository and extract metadata
    pub fn get_repo_info(path: &str) -> Result<GitRepoInfo, String> {
        let repo = match Repository::discover(path) {
            Ok(r) => r,
            Err(_) => {
                return Ok(GitRepoInfo {
                    has_git: false,
                    git_url: None,
                    current_branch: None,
                    current_commit: None,
                    is_dirty: false,
                    remote_name: None,
                });
            }
        };

        let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;

        let current_branch = head
            .shorthand()
            .map(|s| s.to_string());

        let current_commit = head
            .target()
            .map(|oid| oid.to_string());

        let remote_name = Self::get_default_remote(&repo)?;
        let git_url = remote_name.as_ref().and_then(|name| {
            repo.find_remote(name).ok().and_then(|remote| {
                remote.url().map(|url| url.to_string())
            })
        });

        let is_dirty = Self::has_uncommitted_changes(&repo)?;

        Ok(GitRepoInfo {
            has_git: true,
            git_url,
            current_branch,
            current_commit,
            is_dirty,
            remote_name,
        })
    }

    /// Get default remote (usually "origin")
    fn get_default_remote(repo: &Repository) -> Result<Option<String>, String> {
        let remotes = repo.remotes()
            .map_err(|e| format!("Failed to get remotes: {}", e))?;

        // Prefer "origin", fall back to first remote
        if remotes.iter().any(|r| r == Some("origin")) {
            Ok(Some("origin".to_string()))
        } else {
            Ok(remotes.get(0).map(|s| s.to_string()))
        }
    }

    /// Check if repository has uncommitted changes
    fn has_uncommitted_changes(repo: &Repository) -> Result<bool, String> {
        let statuses = repo.statuses(None)
            .map_err(|e| format!("Failed to get status: {}", e))?;

        Ok(!statuses.is_empty())
    }

    /// List commits for a repository
    pub fn get_commits(
        path: &str,
        branch: Option<String>,
        limit: Option<usize>,
    ) -> Result<Vec<CommitInfo>, String> {
        let repo = Repository::discover(path)
            .map_err(|e| format!("Not a git repository: {}", e))?;

        let reference = if let Some(branch_name) = branch {
            format!("refs/heads/{}", branch_name)
        } else {
            "HEAD".to_string()
        };

        let mut revwalk = repo.revwalk()
            .map_err(|e| format!("Failed to create revwalk: {}", e))?;

        revwalk.push_ref(&reference)
            .map_err(|e| format!("Failed to push ref: {}", e))?;

        let limit = limit.unwrap_or(100);
        let mut commits = Vec::new();

        for (i, oid_result) in revwalk.enumerate() {
            if i >= limit {
                break;
            }

            let oid = oid_result
                .map_err(|e| format!("Failed to get OID: {}", e))?;

            let commit = repo.find_commit(oid)
                .map_err(|e| format!("Failed to find commit: {}", e))?;

            commits.push(CommitInfo::from_git_commit(&commit));
        }

        Ok(commits)
    }

    /// Get details for a specific commit
    pub fn get_commit_details(path: &str, sha: &str) -> Result<CommitDetails, String> {
        let repo = Repository::discover(path)
            .map_err(|e| format!("Not a git repository: {}", e))?;

        let oid = git2::Oid::from_str(sha)
            .map_err(|e| format!("Invalid commit SHA: {}", e))?;

        let commit = repo.find_commit(oid)
            .map_err(|e| format!("Commit not found: {}", e))?;

        let tree = commit.tree()
            .map_err(|e| format!("Failed to get tree: {}", e))?;

        let parent_tree = if commit.parent_count() > 0 {
            Some(commit.parent(0)
                .map_err(|e| format!("Failed to get parent: {}", e))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {}", e))?)
        } else {
            None
        };

        let diff = repo.diff_tree_to_tree(
            parent_tree.as_ref(),
            Some(&tree),
            None,
        ).map_err(|e| format!("Failed to create diff: {}", e))?;

        let mut files_changed = Vec::new();
        diff.foreach(
            &mut |delta, _progress| {
                if let Some(path) = delta.new_file().path() {
                    files_changed.push(path.to_string_lossy().to_string());
                }
                true
            },
            None,
            None,
            None,
        ).map_err(|e| format!("Failed to process diff: {}", e))?;

        Ok(CommitDetails {
            sha: sha.to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parent_shas: commit.parents().map(|p| p.id().to_string()).collect(),
            files_changed,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitInfo {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub timestamp: i64, // Unix timestamp
}

impl CommitInfo {
    fn from_git_commit(commit: &git2::Commit) -> Self {
        Self {
            sha: commit.id().to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitDetails {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_shas: Vec<String>,
    pub files_changed: Vec<String>,
}
```

**Tauri Commands**:

```rust
#[tauri::command]
pub fn get_repo_info(path: String) -> Result<GitRepoInfo, String> {
    GitOperations::get_repo_info(&path)
}

#[tauri::command]
pub fn get_commits(
    path: String,
    branch: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<CommitInfo>, String> {
    GitOperations::get_commits(&path, branch, limit)
}

#[tauri::command]
pub fn get_commit_details(path: String, sha: String) -> Result<CommitDetails, String> {
    GitOperations::get_commit_details(&path, &sha)
}
```

**Register Commands** (`src-tauri/src/main.rs`):

Add to `invoke_handler![]`:
```rust
get_repo_info,
get_commits,
get_commit_details,
```

### A.2. Backend: Manual Git Connection Command

**NEW Command** (`src-tauri/src/commands.rs`):

Connect git manually when user clicks button:

```rust
#[tauri::command]
pub async fn connect_project_to_git(
    project_id: String,
) -> Result<GitRepoInfo, String> {
    let db = get_database().await?;

    // Get project from database
    let project = Projects::find_by_id(&project_id)
        .one(&db)
        .await?
        .ok_or("Project not found")?;

    // Detect git metadata
    let git_info = GitOperations::get_repo_info(&project.path)?;

    if !git_info.has_git {
        return Err("No git repository found at project path".to_string());
    }

    // Update project in database with git metadata
    let mut project: projects::ActiveModel = project.into();
    project.git_connected = Set(true);
    project.git_url = Set(git_info.git_url.clone());
    project.git_branch = Set(git_info.current_branch.clone());
    project.git_commit = Set(git_info.current_commit.clone());
    project.git_remote_name = Set(git_info.remote_name.clone());
    project.git_connected_at = Set(Some(current_timestamp()));

    project.update(&db).await?;

    Ok(git_info)
}

#[tauri::command]
pub async fn disconnect_project_from_git(
    project_id: String,
) -> Result<(), String> {
    let db = get_database().await?;

    let project = Projects::find_by_id(&project_id)
        .one(&db)
        .await?
        .ok_or("Project not found")?;

    // Clear git metadata in database
    let mut project: projects::ActiveModel = project.into();
    project.git_connected = Set(false);
    project.git_url = Set(None);
    project.git_branch = Set(None);
    project.git_commit = Set(None);
    project.git_remote_name = Set(None);
    project.git_connected_at = Set(None);

    project.update(&db).await?;

    Ok(())
}
```

### A.3. Frontend: IPC Bindings

**Location**: `src/ipc.ts`

```typescript
import { invokeWithTimeout } from './utils/ipcTimeout';

export interface GitRepoInfo {
  hasGit: boolean;
  gitUrl?: string;
  currentBranch?: string;
  currentCommit?: string;
  isDirty?: boolean;
  remoteName?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: number;
}

export interface CommitDetails {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: number;
  parentShas: string[];
  filesChanged: string[];
}

// NEW: Manual git connection commands
export async function connectProjectToGit(
  projectId: string
): Promise<GitRepoInfo> {
  return invokeWithTimeout<GitRepoInfo>(
    'connect_project_to_git',
    { projectId },
    5000
  );
}

export async function disconnectProjectFromGit(
  projectId: string
): Promise<void> {
  return invokeWithTimeout<void>(
    'disconnect_project_from_git',
    { projectId },
    3000
  );
}

export async function getRepoInfo(path: string): Promise<GitRepoInfo> {
  return invokeWithTimeout<GitRepoInfo>('get_repo_info', { path }, 5000);
}

export async function getCommits(
  path: string,
  branch?: string,
  limit?: number
): Promise<CommitInfo[]> {
  return invokeWithTimeout<CommitInfo[]>(
    'get_commits',
    { path, branch, limit },
    10000
  );
}

export async function getCommitDetails(
  path: string,
  sha: string
): Promise<CommitDetails> {
  return invokeWithTimeout<CommitDetails>(
    'get_commit_details',
    { path, sha },
    5000
  );
}
```

### A.4. Frontend: UI Integration

**Location**: `src/components/projects/ConnectGitButton.tsx`

New component for manual git connection:

```typescript
import { useState } from 'react';
import { Button, useToast, Icon, HStack, Text } from '@chakra-ui/react';
import { GoMarkGithub } from 'react-icons/go';
import { FaPlug, FaUnlink } from 'react-icons/fa';
import { connectProjectToGit, disconnectProjectFromGit } from '../../ipc';

interface ConnectGitButtonProps {
  project: ProjectEntry;
  onConnected: (gitInfo: GitRepoInfo) => void;
  onDisconnected: () => void;
}

export function ConnectGitButton({
  project,
  onConnected,
  onDisconnected,
}: ConnectGitButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const gitInfo = await connectProjectToGit(project.id);
      toast({
        title: 'Git Connected',
        description: `Connected to ${gitInfo.gitUrl || 'local repository'}`,
        status: 'success',
      });
      onConnected(gitInfo);
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'No git repository found',
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await disconnectProjectFromGit(project.id);
      toast({
        title: 'Git Disconnected',
        status: 'info',
      });
      onDisconnected();
    } catch (error) {
      toast({
        title: 'Disconnection Failed',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (project.gitConnected) {
    return (
      <HStack spacing={2}>
        <HStack spacing={2} fontSize="sm" color="gray.600">
          <Icon as={GoMarkGithub} />
          <Text>{project.gitRemoteName || 'Local'}</Text>
          {project.gitBranch && (
            <>
              <Text>•</Text>
              <Text>{project.gitBranch}</Text>
            </>
          )}
        </HStack>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<FaUnlink />}
          onClick={handleDisconnect}
          isLoading={isLoading}
        >
          Disconnect
        </Button>
      </HStack>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      leftIcon={<FaPlug />}
      onClick={handleConnect}
      isLoading={isLoading}
    >
      Connect Git
    </Button>
  );
}
```

**Location**: `src/pages/ProjectDetailPage.tsx`

Integrate connect button in project header:

```typescript
import { ConnectGitButton } from '../components/projects/ConnectGitButton';

export function ProjectDetailPage({ project }: ProjectDetailPageProps) {
  const [gitInfo, setGitInfo] = useState<GitRepoInfo | null>(
    project.gitConnected ? {
      hasGit: true,
      gitUrl: project.gitUrl,
      currentBranch: project.gitBranch,
      currentCommit: project.gitCommit,
      remoteName: project.gitRemoteName,
    } : null
  );

  return (
    <Box>
      {/* Project Header */}
      <HStack spacing={4} mb={4} justify="space-between">
        <Heading size="lg">{project.name}</Heading>

        <ConnectGitButton
          project={project}
          onConnected={(info) => setGitInfo(info)}
          onDisconnected={() => setGitInfo(null)}
        />
      </HStack>

      {/* Tabs - Commits tab only visible if git connected */}
      <Tabs>
        <TabList>
          <Tab>Kits</Tab>
          {gitInfo?.hasGit && <Tab>Commits</Tab>}
        </TabList>
        {/* ... */}
      </Tabs>
    </Box>
  );
}
```

**Location**: `src/components/projects/ProjectCard.tsx`

Add git badge to project cards:

```typescript
export function ProjectCard({ project }: { project: ProjectEntry }) {
  return (
    <Card>
      <CardHeader>
        <HStack justify="space-between">
          <Heading size="md">{project.name}</Heading>
          {project.gitConnected && (
            <Icon as={GoMarkGithub} color="green.500" />
          )}
        </HStack>
      </CardHeader>
      {/* Rest of card */}
    </Card>
  );
}
```

### A.5. Testing

**Manual Testing Checklist**:
- [ ] Click "Connect Git" button on project with git repo → connection succeeds
- [ ] Click "Connect Git" on project without git → shows error toast
- [ ] Git info displays correctly (branch, remote)
- [ ] Click "Disconnect" button → clears git connection
- [ ] Project card shows git icon when connected (green)
- [ ] Git connection persists in database across app restarts
- [ ] Commits tab only appears when git is connected

**Edge Cases**:
- Project in subdirectory of git repo (discovers parent .git)
- Detached HEAD state
- No remote configured
- Multiple remotes (origin, upstream)
- Reconnecting after disconnect

## Phase B: Commit Notebook Component (Days 5-8)

### Goal

Create a timeline view of commits with filtering, detail modal, and annotation system for adding metadata to commits. **All annotations stored in database** for better querying and relational data.

### B.1. Backend: Database-Based Commit Annotations

**Using Schema from Phase 0**: `commit_annotations` table

**Tauri Commands** (`src-tauri/src/commands.rs`):

```rust
use sea_orm::{DatabaseConnection, EntityTrait, Set, QueryFilter, ColumnTrait};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitAnnotation {
    pub id: String,
    pub project_id: String,
    pub commit_sha: String,
    pub tags: Vec<String>,
    pub notes: String,
    pub is_bookmarked: bool,
    pub is_template_worthy: bool,
    pub metadata: HashMap<String, String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn get_commit_annotations(
    project_id: String,
) -> Result<Vec<CommitAnnotation>, String> {
    let db = get_database().await?;

    let annotations = CommitAnnotations::find()
        .filter(commit_annotations::Column::ProjectId.eq(project_id))
        .all(&db)
        .await
        .map_err(|e| format!("Failed to fetch annotations: {}", e))?;

    // Convert from database model to response DTO
    Ok(annotations
        .into_iter()
        .map(|a| CommitAnnotation {
            id: a.id,
            project_id: a.project_id,
            commit_sha: a.commit_sha,
            tags: a.tags
                .map(|t| serde_json::from_str(&t).unwrap_or_default())
                .unwrap_or_default(),
            notes: a.notes.unwrap_or_default(),
            is_bookmarked: a.is_bookmarked,
            is_template_worthy: a.is_template_worthy,
            metadata: a.metadata
                .map(|m| serde_json::from_str(&m).unwrap_or_default())
                .unwrap_or_default(),
            created_at: a.created_at,
            updated_at: a.updated_at,
        })
        .collect())
}

#[tauri::command]
pub async fn get_commit_annotation(
    project_id: String,
    commit_sha: String,
) -> Result<Option<CommitAnnotation>, String> {
    let db = get_database().await?;

    let annotation = CommitAnnotations::find()
        .filter(commit_annotations::Column::ProjectId.eq(project_id))
        .filter(commit_annotations::Column::CommitSha.eq(commit_sha))
        .one(&db)
        .await
        .map_err(|e| format!("Failed to fetch annotation: {}", e))?;

    Ok(annotation.map(|a| CommitAnnotation {
        // Same conversion as above
    }))
}

#[tauri::command]
pub async fn save_commit_annotation(
    project_id: String,
    commit_sha: String,
    tags: Vec<String>,
    notes: String,
    is_bookmarked: bool,
    is_template_worthy: bool,
    metadata: HashMap<String, String>,
) -> Result<CommitAnnotation, String> {
    let db = get_database().await?;

    // Check if annotation exists
    let existing = CommitAnnotations::find()
        .filter(commit_annotations::Column::ProjectId.eq(&project_id))
        .filter(commit_annotations::Column::CommitSha.eq(&commit_sha))
        .one(&db)
        .await?;

    let now = current_timestamp();

    let annotation = if let Some(existing) = existing {
        // Update existing
        let mut active: commit_annotations::ActiveModel = existing.into();
        active.tags = Set(Some(serde_json::to_string(&tags)?));
        active.notes = Set(Some(notes));
        active.is_bookmarked = Set(is_bookmarked);
        active.is_template_worthy = Set(is_template_worthy);
        active.metadata = Set(Some(serde_json::to_string(&metadata)?));
        active.updated_at = Set(now);

        active.update(&db).await?
    } else {
        // Create new
        let new_annotation = commit_annotations::ActiveModel {
            id: Set(generate_id()),
            project_id: Set(project_id.clone()),
            commit_sha: Set(commit_sha.clone()),
            tags: Set(Some(serde_json::to_string(&tags)?)),
            notes: Set(Some(notes)),
            is_bookmarked: Set(is_bookmarked),
            is_template_worthy: Set(is_template_worthy),
            metadata: Set(Some(serde_json::to_string(&metadata)?)),
            created_at: Set(now),
            updated_at: Set(now),
        };

        new_annotation.insert(&db).await?
    };

    // Convert to response DTO
    Ok(CommitAnnotation {
        // ... conversion
    })
}

#[tauri::command]
pub async fn delete_commit_annotation(
    project_id: String,
    commit_sha: String,
) -> Result<(), String> {
    let db = get_database().await?;

    CommitAnnotations::delete_many()
        .filter(commit_annotations::Column::ProjectId.eq(project_id))
        .filter(commit_annotations::Column::CommitSha.eq(commit_sha))
        .exec(&db)
        .await
        .map_err(|e| format!("Failed to delete annotation: {}", e))?;

    Ok(())
}

// NEW: Query commits by annotation criteria
#[tauri::command]
pub async fn find_commits_by_tag(
    project_id: String,
    tag: String,
) -> Result<Vec<String>, String> {
    let db = get_database().await?;

    let annotations = CommitAnnotations::find()
        .filter(commit_annotations::Column::ProjectId.eq(project_id))
        .all(&db)
        .await?;

    // Filter by tag (tags stored as JSON array)
    let commit_shas: Vec<String> = annotations
        .into_iter()
        .filter(|a| {
            if let Some(tags_json) = &a.tags {
                let tags: Vec<String> = serde_json::from_str(tags_json).unwrap_or_default();
                tags.contains(&tag)
            } else {
                false
            }
        })
        .map(|a| a.commit_sha)
        .collect();

    Ok(commit_shas)
}

#[tauri::command]
pub async fn get_template_worthy_commits(
    project_id: String,
) -> Result<Vec<String>, String> {
    let db = get_database().await?;

    let annotations = CommitAnnotations::find()
        .filter(commit_annotations::Column::ProjectId.eq(project_id))
        .filter(commit_annotations::Column::IsTemplateWorthy.eq(true))
        .all(&db)
        .await?;

    Ok(annotations.into_iter().map(|a| a.commit_sha).collect())
}
```

### B.2. Frontend: IPC Bindings

**Location**: `src/ipc.ts`

```typescript
export interface CommitAnnotation {
  id: string;
  projectId: string;
  commitSha: string;
  tags: string[];
  notes: string;
  isBookmarked: boolean;
  isTemplateWorthy: boolean;
  metadata: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// Get all annotations for a project
export async function getCommitAnnotations(
  projectId: string
): Promise<CommitAnnotation[]> {
  return invokeWithTimeout<CommitAnnotation[]>(
    'get_commit_annotations',
    { projectId },
    5000
  );
}

// Get single annotation for a specific commit
export async function getCommitAnnotation(
  projectId: string,
  commitSha: string
): Promise<CommitAnnotation | null> {
  return invokeWithTimeout<CommitAnnotation | null>(
    'get_commit_annotation',
    { projectId, commitSha },
    3000
  );
}

// Save annotation (create or update)
export async function saveCommitAnnotation(
  projectId: string,
  commitSha: string,
  tags: string[],
  notes: string,
  isBookmarked: boolean,
  isTemplateWorthy: boolean,
  metadata: Record<string, string>
): Promise<CommitAnnotation> {
  return invokeWithTimeout<CommitAnnotation>(
    'save_commit_annotation',
    { projectId, commitSha, tags, notes, isBookmarked, isTemplateWorthy, metadata },
    3000
  );
}

// Delete annotation
export async function deleteCommitAnnotation(
  projectId: string,
  commitSha: string
): Promise<void> {
  return invokeWithTimeout<void>(
    'delete_commit_annotation',
    { projectId, commitSha },
    3000
  );
}

// NEW: Query by annotations
export async function findCommitsByTag(
  projectId: string,
  tag: string
): Promise<string[]> {
  return invokeWithTimeout<string[]>(
    'find_commits_by_tag',
    { projectId, tag },
    5000
  );
}

export async function getTemplateWorthyCommits(
  projectId: string
): Promise<string[]> {
  return invokeWithTimeout<string[]>(
    'get_template_worthy_commits',
    { projectId },
    5000
  );
}
```

### B.3. Frontend: Commit Timeline Components

**Location**: `src/components/commits/`

#### CommitTimelineView.tsx

```typescript
import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Spinner,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { getCommits, getCommitAnnotations } from '../../ipc';
import { CommitFilterBar } from './CommitFilterBar';
import { CommitTimeline } from './CommitTimeline';
import { CommitDetailModal } from './CommitDetailModal';

interface CommitTimelineViewProps {
  projectPath: string;
  gitInfo: GitRepoInfo;
}

export function CommitTimelineView({ projectPath, gitInfo }: CommitTimelineViewProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [annotations, setAnnotations] = useState<Record<string, CommitAnnotation>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(gitInfo.currentBranch || 'HEAD');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    loadCommits();
    loadAnnotations();
  }, [projectPath, selectedBranch]);

  const loadCommits = async () => {
    setIsLoading(true);
    try {
      const data = await getCommits(projectPath, selectedBranch, 100);
      setCommits(data);
    } catch (error) {
      console.error('Failed to load commits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnnotations = async () => {
    try {
      const data = await getCommitAnnotations(projectPath);
      setAnnotations(data);
    } catch (error) {
      console.error('Failed to load annotations:', error);
    }
  };

  const handleCommitClick = (sha: string) => {
    setSelectedCommit(sha);
    onOpen();
  };

  const handleAnnotationUpdate = () => {
    loadAnnotations(); // Reload annotations after update
  };

  return (
    <Box>
      <VStack align="stretch" spacing={4}>
        <Heading size="md">Commit Timeline</Heading>

        <CommitFilterBar
          currentBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
        />

        {isLoading ? (
          <Spinner />
        ) : commits.length === 0 ? (
          <Text color="gray.500">No commits found</Text>
        ) : (
          <CommitTimeline
            commits={commits}
            annotations={annotations}
            onCommitClick={handleCommitClick}
          />
        )}
      </VStack>

      {selectedCommit && (
        <CommitDetailModal
          isOpen={isOpen}
          onClose={onClose}
          projectPath={projectPath}
          commitSha={selectedCommit}
          annotation={annotations[selectedCommit]}
          onAnnotationUpdate={handleAnnotationUpdate}
        />
      )}
    </Box>
  );
}
```

#### CommitTimeline.tsx

```typescript
import { VStack } from '@chakra-ui/react';
import { CommitCard } from './CommitCard';
import { CommitInfo, CommitAnnotation } from '../../ipc';

interface CommitTimelineProps {
  commits: CommitInfo[];
  annotations: Record<string, CommitAnnotation>;
  onCommitClick: (sha: string) => void;
}

export function CommitTimeline({
  commits,
  annotations,
  onCommitClick,
}: CommitTimelineProps) {
  return (
    <VStack align="stretch" spacing={2}>
      {commits.map((commit) => (
        <CommitCard
          key={commit.sha}
          commit={commit}
          annotation={annotations[commit.sha]}
          onClick={() => onCommitClick(commit.sha)}
        />
      ))}
    </VStack>
  );
}
```

#### CommitCard.tsx

```typescript
import {
  Card,
  CardBody,
  HStack,
  VStack,
  Text,
  Badge,
  Icon,
  Box,
} from '@chakra-ui/react';
import { FaBookmark, FaStar } from 'react-icons/fa';
import { CommitInfo, CommitAnnotation } from '../../ipc';

interface CommitCardProps {
  commit: CommitInfo;
  annotation?: CommitAnnotation;
  onClick: () => void;
}

export function CommitCard({ commit, annotation, onClick }: CommitCardProps) {
  const formattedDate = new Date(commit.timestamp * 1000).toLocaleDateString();
  const shortSha = commit.sha.substring(0, 7);

  return (
    <Card
      cursor="pointer"
      onClick={onClick}
      _hover={{ bg: 'gray.50', _dark: { bg: 'gray.700' } }}
    >
      <CardBody>
        <HStack justify="space-between" align="start">
          <VStack align="start" spacing={1} flex={1}>
            <Text fontWeight="medium">{commit.message}</Text>
            <HStack spacing={2} fontSize="sm" color="gray.600">
              <Text>{commit.author}</Text>
              <Text>•</Text>
              <Text>{formattedDate}</Text>
              <Text>•</Text>
              <Text fontFamily="mono">{shortSha}</Text>
            </HStack>

            {annotation && annotation.tags.length > 0 && (
              <HStack spacing={1} mt={1}>
                {annotation.tags.map((tag) => (
                  <Badge key={tag} colorScheme="blue" size="sm">
                    {tag}
                  </Badge>
                ))}
              </HStack>
            )}
          </VStack>

          <HStack spacing={2}>
            {annotation?.isBookmarked && (
              <Icon as={FaBookmark} color="yellow.500" />
            )}
            {annotation?.isTemplateWorthy && (
              <Icon as={FaStar} color="purple.500" />
            )}
          </HStack>
        </HStack>
      </CardBody>
    </Card>
  );
}
```

#### CommitDetailModal.tsx

```typescript
import { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Textarea,
  Input,
  Icon,
  Divider,
  Box,
  Switch,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { FaCodeBranch, FaCalendar, FaUser } from 'react-icons/fa';
import {
  getCommitDetails,
  saveCommitAnnotation,
  CommitDetails,
  CommitAnnotation,
} from '../../ipc';

interface CommitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  commitSha: string;
  annotation?: CommitAnnotation;
  onAnnotationUpdate: () => void;
}

export function CommitDetailModal({
  isOpen,
  onClose,
  projectPath,
  commitSha,
  annotation: initialAnnotation,
  onAnnotationUpdate,
}: CommitDetailModalProps) {
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [annotation, setAnnotation] = useState<CommitAnnotation>(
    initialAnnotation || {
      tags: [],
      notes: '',
      isBookmarked: false,
      isTemplateWorthy: false,
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  );
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCommitDetails();
  }, [commitSha]);

  const loadCommitDetails = async () => {
    setIsLoading(true);
    try {
      const data = await getCommitDetails(projectPath, commitSha);
      setDetails(data);
    } catch (error) {
      console.error('Failed to load commit details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCommitAnnotation(projectPath, commitSha, {
        ...annotation,
        updatedAt: Date.now(),
      });
      onAnnotationUpdate();
    } catch (error) {
      console.error('Failed to save annotation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setAnnotation({
        ...annotation,
        tags: [...annotation.tags, newTag.trim()],
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setAnnotation({
      ...annotation,
      tags: annotation.tags.filter((t) => t !== tag),
    });
  };

  if (isLoading || !details) {
    return null;
  }

  const formattedDate = new Date(details.timestamp * 1000).toLocaleString();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Commit Details</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={4}>
            {/* Commit Metadata */}
            <Box>
              <Text fontWeight="bold" mb={2}>{details.message}</Text>
              <VStack align="start" spacing={1} fontSize="sm" color="gray.600">
                <HStack>
                  <Icon as={FaUser} />
                  <Text>{details.author} ({details.authorEmail})</Text>
                </HStack>
                <HStack>
                  <Icon as={FaCalendar} />
                  <Text>{formattedDate}</Text>
                </HStack>
                <HStack>
                  <Icon as={FaCodeBranch} />
                  <Text fontFamily="mono">{details.sha.substring(0, 7)}</Text>
                </HStack>
              </VStack>
            </Box>

            <Divider />

            {/* Files Changed */}
            <Box>
              <Text fontWeight="bold" mb={2}>
                Files Changed ({details.filesChanged.length})
              </Text>
              <VStack align="start" spacing={1} maxH="150px" overflowY="auto">
                {details.filesChanged.map((file) => (
                  <Text key={file} fontSize="sm" fontFamily="mono">
                    {file}
                  </Text>
                ))}
              </VStack>
            </Box>

            <Divider />

            {/* Annotations */}
            <Box>
              <Text fontWeight="bold" mb={2}>Annotations</Text>

              {/* Tags */}
              <FormControl mb={3}>
                <FormLabel fontSize="sm">Tags</FormLabel>
                <HStack mb={2}>
                  <Input
                    size="sm"
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="sm" onClick={handleAddTag}>
                    Add
                  </Button>
                </HStack>
                <HStack spacing={2} wrap="wrap">
                  {annotation.tags.map((tag) => (
                    <Badge
                      key={tag}
                      colorScheme="blue"
                      cursor="pointer"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </HStack>
              </FormControl>

              {/* Notes */}
              <FormControl mb={3}>
                <FormLabel fontSize="sm">Notes</FormLabel>
                <Textarea
                  size="sm"
                  placeholder="Add notes about this commit..."
                  value={annotation.notes}
                  onChange={(e) =>
                    setAnnotation({ ...annotation, notes: e.target.value })
                  }
                  rows={4}
                />
              </FormControl>

              {/* Flags */}
              <HStack spacing={4}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel fontSize="sm" mb={0}>
                    Bookmark
                  </FormLabel>
                  <Switch
                    isChecked={annotation.isBookmarked}
                    onChange={(e) =>
                      setAnnotation({
                        ...annotation,
                        isBookmarked: e.target.checked,
                      })
                    }
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel fontSize="sm" mb={0}>
                    Template Worthy
                  </FormLabel>
                  <Switch
                    colorScheme="purple"
                    isChecked={annotation.isTemplateWorthy}
                    onChange={(e) =>
                      setAnnotation({
                        ...annotation,
                        isTemplateWorthy: e.target.checked,
                      })
                    }
                  />
                </FormControl>
              </HStack>
            </Box>

            {/* Actions */}
            <HStack justify="flex-end" spacing={2}>
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={handleSave}
                isLoading={isSaving}
              >
                Save Annotations
              </Button>
              {annotation.isTemplateWorthy && (
                <Button size="sm" colorScheme="purple">
                  Create Project from Commit
                </Button>
              )}
            </HStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
```

#### CommitFilterBar.tsx

```typescript
import { HStack, Select, Input } from '@chakra-ui/react';

interface CommitFilterBarProps {
  currentBranch: string;
  onBranchChange: (branch: string) => void;
}

export function CommitFilterBar({
  currentBranch,
  onBranchChange,
}: CommitFilterBarProps) {
  return (
    <HStack spacing={4}>
      <Select
        size="sm"
        value={currentBranch}
        onChange={(e) => onBranchChange(e.target.value)}
        maxW="200px"
      >
        <option value="HEAD">Current Branch</option>
        <option value="main">main</option>
        <option value="master">master</option>
        <option value="develop">develop</option>
      </Select>

      <Input
        size="sm"
        placeholder="Search commits..."
        maxW="300px"
      />
    </HStack>
  );
}
```

### B.4. Integration into ProjectDetailPage

**Location**: `src/pages/ProjectDetailPage.tsx`

Add new tab for commit timeline:

```typescript
export function ProjectDetailPage({ project }: ProjectDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'kits' | 'commits'>('kits');
  const [gitInfo, setGitInfo] = useState<GitRepoInfo | null>(null);

  return (
    <Box>
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value)}>
        <TabList>
          <Tab>Kits</Tab>
          {gitInfo?.hasGit && <Tab>Commits</Tab>}
        </TabList>

        <TabPanels>
          <TabPanel>{/* Existing kits view */}</TabPanel>
          {gitInfo?.hasGit && (
            <TabPanel>
              <CommitTimelineView
                projectPath={project.path}
                gitInfo={gitInfo}
              />
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </Box>
  );
}
```

### B.5. Testing

**Manual Testing Checklist**:
- [ ] Commit timeline loads successfully from git history
- [ ] Commit cards display correctly with author, date, message
- [ ] Click commit card opens detail modal
- [ ] Commit details show files changed
- [ ] Can add/remove tags
- [ ] Can add notes
- [ ] Can toggle bookmark and template-worthy flags
- [ ] **Save annotations persists to database**
- [ ] **Annotations reload correctly from database on app restart**
- [ ] Filter by branch works
- [ ] **Query commits by tag works**
- [ ] **Filter by template-worthy commits works**

**Edge Cases**:
- Very long commit messages
- Commits with no files changed (merge commits)
- Repositories with thousands of commits (pagination needed?)
- **Database query performance with many annotations**
- **Annotation tags with special characters**

### B.6. Pin/Checkpoint Management Commands

**Tauri Commands** (`src-tauri/src/commands.rs`):

```rust
#[tauri::command]
pub async fn pin_commit_as_checkpoint(
    project_id: String,
    commit_sha: String,
    name: String,
    description: Option<String>,
    checkpoint_label: Option<String>,
) -> Result<ProjectClone, String> {
    let db = get_database().await?;

    // Create checkpoint entry
    let checkpoint = project_clones::ActiveModel {
        id: Set(generate_id()),
        project_id: Set(project_id),
        name: Set(name),
        description: Set(description),
        is_pinned: Set(true),
        checkpoint_label: Set(checkpoint_label),
        pinned_at: Set(Some(current_timestamp())),
        git_commit: Set(commit_sha),
        source_type: Set("checkpoint".to_string()),
        created_at: Set(current_timestamp()),
        updated_at: Set(current_timestamp()),
        ..Default::default()
    };

    let result = checkpoint.insert(&db).await?;
    Ok(result.into())
}

#[tauri::command]
pub async fn unpin_checkpoint(
    checkpoint_id: String,
) -> Result<(), String> {
    let db = get_database().await?;

    ProjectClones::delete_by_id(checkpoint_id)
        .exec(&db)
        .await
        .map_err(|e| format!("Failed to unpin checkpoint: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_pinned_commits(
    project_id: String,
) -> Result<Vec<ProjectClone>, String> {
    let db = get_database().await?;

    let checkpoints = ProjectClones::find()
        .filter(project_clones::Column::ProjectId.eq(project_id))
        .filter(project_clones::Column::IsPinned.eq(true))
        .order_by_desc(project_clones::Column::PinnedAt)
        .all(&db)
        .await?;

    Ok(checkpoints.into_iter().map(|c| c.into()).collect())
}

#[tauri::command]
pub async fn update_checkpoint(
    checkpoint_id: String,
    name: Option<String>,
    description: Option<String>,
    checkpoint_label: Option<String>,
) -> Result<ProjectClone, String> {
    let db = get_database().await?;

    let checkpoint = ProjectClones::find_by_id(&checkpoint_id)
        .one(&db)
        .await?
        .ok_or("Checkpoint not found")?;

    let mut active: project_clones::ActiveModel = checkpoint.into();

    if let Some(name) = name {
        active.name = Set(name);
    }
    if let Some(desc) = description {
        active.description = Set(Some(desc));
    }
    if let Some(label) = checkpoint_label {
        active.checkpoint_label = Set(Some(label));
    }
    active.updated_at = Set(current_timestamp());

    let result = active.update(&db).await?;
    Ok(result.into())
}
```

### B.7. Branch Management Commands

**Tauri Commands** (`src-tauri/src/commands.rs`):

```rust
#[tauri::command]
pub fn get_branches(project_path: String) -> Result<Vec<String>, String> {
    let repo = Repository::discover(&project_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let branches = repo.branches(None)
        .map_err(|e| format!("Failed to get branches: {}", e))?;

    let mut branch_names = Vec::new();
    for branch in branches {
        let (branch, _) = branch.map_err(|e| format!("Failed to read branch: {}", e))?;
        if let Some(name) = branch.name().ok().flatten() {
            branch_names.push(name.to_string());
        }
    }

    Ok(branch_names)
}

#[tauri::command]
pub fn get_current_branch(project_path: String) -> Result<Option<String>, String> {
    let repo = Repository::discover(&project_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    Ok(head.shorthand().map(|s| s.to_string()))
}

#[tauri::command]
pub fn checkout_branch(
    project_path: String,
    branch_name: String,
) -> Result<String, String> {
    let repo = Repository::discover(&project_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Find the branch reference
    let branch_ref = format!("refs/heads/{}", branch_name);
    let reference = repo.find_reference(&branch_ref)
        .map_err(|e| format!("Branch not found: {}", e))?;

    // Get the commit the branch points to
    let commit = reference.peel_to_commit()
        .map_err(|e| format!("Failed to get commit: {}", e))?;

    // Checkout the branch
    repo.checkout_tree(commit.as_object(), None)
        .map_err(|e| format!("Failed to checkout: {}", e))?;

    repo.set_head(&branch_ref)
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;

    Ok(format!("Switched to branch '{}'", branch_name))
}

// Get commit history for specific branch
#[tauri::command]
pub fn get_branch_commits(
    project_path: String,
    branch_name: String,
    limit: Option<usize>,
) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::discover(&project_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let branch_ref = format!("refs/heads/{}", branch_name);
    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    revwalk.push_ref(&branch_ref)
        .map_err(|e| format!("Failed to push ref: {}", e))?;

    let limit = limit.unwrap_or(100);
    let mut commits = Vec::new();

    for (i, oid_result) in revwalk.enumerate() {
        if i >= limit {
            break;
        }

        let oid = oid_result
            .map_err(|e| format!("Failed to get OID: {}", e))?;

        let commit = repo.find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        commits.push(CommitInfo::from_git_commit(&commit));
    }

    Ok(commits)
}
```

### B.8. Frontend: IPC Bindings for Pins & Branches

**Location**: `src/ipc.ts`

```typescript
// Checkpoint/Pin management
export interface ProjectClone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isPinned: boolean;
  checkpointLabel?: string;
  pinnedAt?: number;
  gitCommit: string;
  gitBranch?: string;
  tags?: string[];
  createdAt: number;
}

export async function pinCommitAsCheckpoint(
  projectId: string,
  commitSha: string,
  name: string,
  description?: string,
  checkpointLabel?: string
): Promise<ProjectClone> {
  return invokeWithTimeout<ProjectClone>(
    'pin_commit_as_checkpoint',
    { projectId, commitSha, name, description, checkpointLabel },
    5000
  );
}

export async function unpinCheckpoint(checkpointId: string): Promise<void> {
  return invokeWithTimeout<void>('unpin_checkpoint', { checkpointId }, 3000);
}

export async function getPinnedCommits(
  projectId: string
): Promise<ProjectClone[]> {
  return invokeWithTimeout<ProjectClone[]>(
    'get_pinned_commits',
    { projectId },
    5000
  );
}

export async function updateCheckpoint(
  checkpointId: string,
  name?: string,
  description?: string,
  checkpointLabel?: string
): Promise<ProjectClone> {
  return invokeWithTimeout<ProjectClone>(
    'update_checkpoint',
    { checkpointId, name, description, checkpointLabel },
    3000
  );
}

// Branch management
export async function getBranches(projectPath: string): Promise<string[]> {
  return invokeWithTimeout<string[]>('get_branches', { projectPath }, 5000);
}

export async function getCurrentBranch(
  projectPath: string
): Promise<string | null> {
  return invokeWithTimeout<string | null>(
    'get_current_branch',
    { projectPath },
    3000
  );
}

export async function checkoutBranch(
  projectPath: string,
  branchName: string
): Promise<string> {
  return invokeWithTimeout<string>(
    'checkout_branch',
    { projectPath, branchName },
    10000
  );
}

export async function getBranchCommits(
  projectPath: string,
  branchName: string,
  limit?: number
): Promise<CommitInfo[]> {
  return invokeWithTimeout<CommitInfo[]>(
    'get_branch_commits',
    { projectPath, branchName, limit },
    10000
  );
}
```

## Phase C: Checkpoint System & Template Tree (Days 9-11)

### Goal

Enable creating projects from any commit in the timeline and visualize the lineage of projects as a "template tree."

### C.1. Backend: Clone from Commit

**Location**: `src-tauri/src/commands.rs`

Add new command that creates project from a specific commit:

```rust
#[tauri::command]
pub async fn create_project_from_commit(
    source_project_path: String,
    commit_sha: String,
    target_path: String,
    project_name: String,
    register_project: bool,
) -> Result<ProjectEntry, String> {
    // Use existing git2 operations to checkout specific commit
    let repo = Repository::discover(&source_project_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let oid = git2::Oid::from_str(&commit_sha)
        .map_err(|e| format!("Invalid commit SHA: {}", e))?;

    let commit = repo.find_commit(oid)
        .map_err(|e| format!("Commit not found: {}", e))?;

    // Create temp directory for checkout
    let temp_dir = std::env::temp_dir().join(format!("bluekit-clone-{}", commit_sha));
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    // Clone repo to temp
    let temp_repo = Repository::clone(
        &source_project_path,
        &temp_dir,
    ).map_err(|e| format!("Failed to clone: {}", e))?;

    // Checkout specific commit (detached HEAD)
    let object = temp_repo.find_object(oid, None)
        .map_err(|e| format!("Failed to find object: {}", e))?;

    temp_repo.checkout_tree(&object, None)
        .map_err(|e| format!("Failed to checkout tree: {}", e))?;

    temp_repo.set_head_detached(oid)
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;

    // Copy files to target (exclude .git)
    copy_dir_excluding(&temp_dir, &target_path, &[".git"])?;

    // Clean up temp directory
    fs::remove_dir_all(&temp_dir).ok();

    // Get commit metadata for clone record
    let commit_info = CommitInfo::from_git_commit(&commit);

    // Create clone metadata
    let clone_metadata = CloneMetadata {
        id: format!("{}-{}", slugify(&project_name), chrono::Utc::now().format("%Y%m%d")),
        name: project_name.clone(),
        description: Some(format!("Created from commit: {}", commit_info.message)),
        git_url: None, // Local clone
        git_commit: Some(commit_sha.clone()),
        git_branch: None,
        git_tag: None,
        tags: vec!["clone".to_string(), "from-commit".to_string()],
        parent_project: Some(source_project_path.clone()),
        parent_commit: Some(commit_sha),
        created_at: current_timestamp(),
    };

    // Save clone metadata to .bluekit/clones.json in target
    let bluekit_dir = format!("{}/.bluekit", target_path);
    fs::create_dir_all(&bluekit_dir)
        .map_err(|e| format!("Failed to create .bluekit: {}", e))?;

    let clones_file = format!("{}/clones.json", bluekit_dir);
    let mut clones: Vec<CloneMetadata> = if Path::new(&clones_file).exists() {
        let contents = fs::read_to_string(&clones_file)?;
        serde_json::from_str(&contents).unwrap_or_default()
    } else {
        Vec::new()
    };

    clones.push(clone_metadata.clone());
    fs::write(&clones_file, serde_json::to_string_pretty(&clones)?)?;

    // Register project if requested
    if register_project {
        let project = add_project_to_registry(project_name, target_path)?;
        Ok(project)
    } else {
        Ok(ProjectEntry {
            id: clone_metadata.id,
            name: clone_metadata.name,
            path: target_path,
            date_added: current_timestamp(),
            last_opened: current_timestamp(),
            git: None,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CloneMetadata {
    id: String,
    name: String,
    description: Option<String>,
    git_url: Option<String>,
    git_commit: Option<String>,
    git_branch: Option<String>,
    git_tag: Option<String>,
    tags: Vec<String>,
    parent_project: Option<String>, // NEW: Source project path
    parent_commit: Option<String>,  // NEW: Source commit SHA
    created_at: i64,
}
```

### C.2. Frontend: Create Project from Commit Button

**Location**: `src/components/commits/CommitDetailModal.tsx`

Add handler for "Create Project from Commit":

```typescript
const handleCreateProject = async () => {
  // Show file picker for target location
  const targetPath = await open({
    directory: true,
    title: 'Choose location for new project',
  });

  if (!targetPath) return;

  try {
    await createProjectFromCommit(
      projectPath,
      commitSha,
      targetPath as string,
      `Project from ${details.sha.substring(0, 7)}`,
      true // register project
    );

    // Show success message
    toast({
      title: 'Project created',
      description: `New project created from commit ${details.sha.substring(0, 7)}`,
      status: 'success',
    });

    onClose();
  } catch (error) {
    console.error('Failed to create project:', error);
    toast({
      title: 'Error',
      description: 'Failed to create project from commit',
      status: 'error',
    });
  }
};
```

### C.3. Frontend: Template Tree Visualization

**Location**: `src/components/projects/TemplateTreeView.tsx`

Create a tree visualization showing parent-child relationships:

```typescript
import { useState, useEffect } from 'react';
import { Box, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { FaCodeBranch } from 'react-icons/fa';

interface TemplateNode {
  project: ProjectEntry;
  children: TemplateNode[];
  commitSha?: string;
}

export function TemplateTreeView() {
  const [tree, setTree] = useState<TemplateNode[]>([]);

  useEffect(() => {
    buildTemplateTree();
  }, []);

  const buildTemplateTree = async () => {
    // Load all projects
    const registry = await getProjectRegistry();

    // Load clone metadata for each project
    const nodes: Map<string, TemplateNode> = new Map();
    const parentMap: Map<string, string[]> = new Map();

    for (const project of registry.projects) {
      const clones = await getProjectClones(project.path);

      nodes.set(project.path, {
        project,
        children: [],
        commitSha: clones[0]?.gitCommit,
      });

      if (clones[0]?.parentProject) {
        const children = parentMap.get(clones[0].parentProject) || [];
        children.push(project.path);
        parentMap.set(clones[0].parentProject, children);
      }
    }

    // Build tree structure
    const roots: TemplateNode[] = [];

    nodes.forEach((node, path) => {
      const childPaths = parentMap.get(path) || [];
      node.children = childPaths
        .map((childPath) => nodes.get(childPath))
        .filter((child) => child !== undefined) as TemplateNode[];

      // Check if this is a root (no parent)
      const hasParent = Array.from(parentMap.values()).some((children) =>
        children.includes(path)
      );

      if (!hasParent) {
        roots.push(node);
      }
    });

    setTree(roots);
  };

  return (
    <Box>
      <VStack align="stretch" spacing={4}>
        {tree.map((node) => (
          <TreeNode key={node.project.id} node={node} depth={0} />
        ))}
      </VStack>
    </Box>
  );
}

function TreeNode({ node, depth }: { node: TemplateNode; depth: number }) {
  return (
    <Box pl={depth * 4}>
      <HStack spacing={2}>
        <Icon as={FaCodeBranch} color="gray.500" />
        <Text fontWeight={depth === 0 ? 'bold' : 'normal'}>
          {node.project.name}
        </Text>
        {node.commitSha && (
          <Text fontSize="sm" color="gray.500" fontFamily="mono">
            {node.commitSha.substring(0, 7)}
          </Text>
        )}
      </HStack>

      {node.children.length > 0 && (
        <Box mt={2}>
          {node.children.map((child) => (
            <TreeNode key={child.project.id} node={child} depth={depth + 1} />
          ))}
        </Box>
      )}
    </Box>
  );
}
```

### C.4. Integration into ProjectDetailPage

Add "Template Tree" tab:

```typescript
<Tabs>
  <TabList>
    <Tab>Kits</Tab>
    {gitInfo?.hasGit && <Tab>Commits</Tab>}
    <Tab>Template Tree</Tab>
  </TabList>

  <TabPanels>
    <TabPanel>{/* Kits */}</TabPanel>
    {gitInfo?.hasGit && <TabPanel>{/* Commits */}</TabPanel>}
    <TabPanel>
      <TemplateTreeView />
    </TabPanel>
  </TabPanels>
</Tabs>
```

### C.5. Testing

**Manual Testing Checklist**:
- [ ] "Create Project from Commit" button works
- [ ] File picker opens for target location
- [ ] Project created successfully at target path
- [ ] New project registered in project registry
- [ ] Clone metadata saved with parent reference
- [ ] Template tree displays parent-child relationships
- [ ] Tree visualization shows correct hierarchy

## Phase D: Project Config Templates for Library (Days 10-12)

### Goal

Enable users to create and publish entire project configuration templates to the Library, supporting project scaffolding and team-wide template sharing.

### D.1. Project Config Snapshot

**What to Capture**:
- `.bluekit/` directory structure
- Kits, walkthroughs, agents, diagrams
- Project metadata (tags, description)
- Optional: file structure snapshot (for scaffolding)
- Git commit SHA (if based on specific commit)

**Tauri Commands**:

```rust
#[tauri::command]
pub async fn create_project_template(
    project_id: String,
    name: String,
    description: Option<String>,
    tags: Vec<String>,
    include_file_structure: bool,
    commit_sha: Option<String>,
) -> Result<ProjectTemplate, String> {
    let db = get_database().await?;

    // Get project from database
    let project = Projects::find_by_id(&project_id)
        .one(&db)
        .await?
        .ok_or("Project not found")?;

    // Create config snapshot
    let config_snapshot = if include_file_structure {
        capture_full_project_structure(&project.path)?
    } else {
        capture_bluekit_structure(&project.path)?
    };

    // Store in database
    let template = project_templates::ActiveModel {
        id: Set(generate_id()),
        project_id: Set(project_id),
        name: Set(name),
        description: Set(description),
        config_snapshot: Set(serde_json::to_string(&config_snapshot)?),
        commit_sha: Set(commit_sha),
        published_to_library: Set(false),
        library_artifact_id: Set(None),
        tags: Set(Some(serde_json::to_string(&tags)?)),
        created_at: Set(current_timestamp()),
        updated_at: Set(current_timestamp()),
    };

    let template = template.insert(&db).await?;

    Ok(template.into())
}

#[tauri::command]
pub async fn publish_template_to_library(
    template_id: String,
    workspace_id: String,
) -> Result<String, String> {
    let db = get_database().await?;

    // Get template
    let template = ProjectTemplates::find_by_id(&template_id)
        .one(&db)
        .await?
        .ok_or("Template not found")?;

    // Publish to Library (uses existing Library publishing system)
    let artifact_id = library::publish_template(workspace_id, &template).await?;

    // Update template with published status
    let mut active: project_templates::ActiveModel = template.into();
    active.published_to_library = Set(true);
    active.library_artifact_id = Set(Some(artifact_id.clone()));
    active.updated_at = Set(current_timestamp());
    active.update(&db).await?;

    Ok(artifact_id)
}

fn capture_bluekit_structure(project_path: &str) -> Result<ConfigSnapshot, String> {
    let bluekit_dir = format!("{}/.bluekit", project_path);

    let mut snapshot = ConfigSnapshot {
        kits: Vec::new(),
        walkthroughs: Vec::new(),
        agents: Vec::new(),
        diagrams: Vec::new(),
        blueprints: Vec::new(),
    };

    // Read all kits
    let kits_glob = format!("{}/*.md", bluekit_dir);
    for entry in glob(&kits_glob).unwrap() {
        if let Ok(path) = entry {
            let content = fs::read_to_string(&path)?;
            snapshot.kits.push(ArtifactSnapshot {
                path: path.to_string_lossy().to_string(),
                content,
            });
        }
    }

    // Read walkthroughs, agents, diagrams...
    // Similar pattern for other artifact types

    Ok(snapshot)
}
```

### D.2. Frontend: Template Creation UI

**Location**: `src/components/templates/CreateTemplateDialog.tsx`

```typescript
export function CreateTemplateDialog({
  project,
  commitSha,
}: {
  project: ProjectEntry;
  commitSha?: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [includeFileStructure, setIncludeFileStructure] = useState(false);

  const handleCreate = async () => {
    const template = await createProjectTemplate(
      project.id,
      name,
      description,
      tags,
      includeFileStructure,
      commitSha
    );

    // Option to publish immediately
    // ... or save for later publishing
  };

  return (
    <Modal>
      {/* Template creation form */}
      <FormControl>
        <FormLabel>Template Name</FormLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Description</FormLabel>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormControl>

      <FormControl display="flex" alignItems="center">
        <FormLabel>Include File Structure</FormLabel>
        <Switch
          isChecked={includeFileStructure}
          onChange={(e) => setIncludeFileStructure(e.target.checked)}
        />
        <FormHelperText>
          Capture full project structure for scaffolding new projects
        </FormHelperText>
      </FormControl>

      {commitSha && (
        <Alert status="info">
          This template will be linked to commit {commitSha.substring(0, 7)}
        </Alert>
      )}

      <Button onClick={handleCreate}>Create Template</Button>
    </Modal>
  );
}
```

### D.3. Integration with Commit Detail Modal

Add "Create Template" button in `CommitDetailModal`:

```typescript
{annotation?.isTemplateWorthy && (
  <Button
    size="sm"
    colorScheme="purple"
    onClick={() => setShowCreateTemplate(true)}
  >
    Create Template from Commit
  </Button>
)}

{showCreateTemplate && (
  <CreateTemplateDialog project={project} commitSha={commitSha} />
)}
```

## Implementation Timeline

| Phase | Days | Features |
|-------|------|----------|
| **Phase 0** | 1-2 | Database migration (JSON → SQLite) |
| **Phase A** | 3-4 | Manual git connection, database-backed projects |
| **Phase B** | 5-8 | Commit timeline, database-backed annotations, queries |
| **Phase C** | 9-11 | Create from commit, template tree visualization |
| **Phase D** | 12-14 | Project config templates, Library publishing integration |
| **Testing & Polish** | 15 | End-to-end testing, bug fixes, documentation |

**Total Estimated Time**: 15 days

## Dependencies

### Rust Crates (Cargo.toml)

```toml
[dependencies]
git2 = { version = "0.18", features = ["https", "ssh"] }
chrono = "0.4"  # For timestamps (if not already present)
```

### Frontend Packages (package.json)

```json
{
  "dependencies": {
    "react-icons": "^4.12.0"  // For git/commit icons (if not already present)
  }
}
```

## Future Enhancements

### Phase D: GitHub Integration (Optional)

If project has GitHub remote, enhance commit timeline with:

- **Remote commits**: Fetch commits from GitHub API (already have `GitHubClient`)
- **Commit metadata**: Show GitHub PR associations, check runs, reviews
- **Diff visualization**: Use GitHub API to show rich diffs
- **Collaboration**: Show who else has annotated commits (if team sharing implemented)

### Phase E: Diff Viewer

Add rich diff visualization:

- **Syntax highlighting**: Use Monaco Editor or similar
- **Side-by-side diff**: Show before/after for each file
- **Inline comments**: Annotate specific lines in diff

### Phase F: Search & Filter

Advanced filtering:

- **Search commit messages**: Full-text search
- **Filter by author**: Show commits from specific developers
- **Filter by date range**: Time-based queries
- **Filter by annotations**: Show only bookmarked/template-worthy commits

## Summary of Key Changes from Original Plan

### What Changed

1. **Manual Git Connection Instead of Automatic**
   - Original: Automatically detect git on project registration
   - Updated: User clicks "Connect Git" button to manually link project to git
   - Why: Gives users explicit control, clearer UX, better for projects with multiple git repos

2. **Database Migration (JSON → SQLite) - BOTH FILES**
   - Original: Store project registry in `projectRegistry.json`, commits in `.bluekit/commits.json`
   - **Updated**: Migrate **THREE JSON files** to database:
     - `~/.bluekit/projectRegistry.json` → `projects` table
     - **`.bluekit/clones.json` → `project_clones` table** (NEW)
     - `.bluekit/commits.json` → `commit_annotations` table
   - Why: Better queries, relational data, checkpoint system, Library publishing support, team collaboration

3. **Checkpoint/Pinning System (Unifies Clones)**
   - Original: Separate "clone" system
   - **Updated**: Unified checkpoint system where you can:
     - Pin commits as saved checkpoints within current project
     - Create new projects from any pinned commit
     - Track template tree lineage via parent relationships
     - Visual indicators on timeline for pinned nodes
   - Why: More intuitive UX, better for experimentation/milestones, supports template variants

4. **Branch Management**
   - Original: No branch management
   - **Updated**: Full branch support:
     - Switch branches via UI
     - View branch-specific commit history
     - Checkout branches (changes working directory)
     - Visual branch indicators on commits
   - Why: Essential for multi-branch workflows, feature development, experimentation

5. **Project Config Templates**
   - Original: Only create projects from commits
   - Updated: Full project template system with Library publishing
   - Why: Supports entire project scaffolding, team-wide templates, Library integration

6. **Timeline Extended**
   - Original: 10 days
   - Updated: 15 days (added Phase 0 for migration, Phase D for templates)

## Next Steps

1. **Review this updated plan** and confirm:
   - Database migration approach (3 JSON files → SQLite)
   - Checkpoint/pinning system design
   - Branch management features
2. **Start with Phase 0**: Database migration infrastructure
   - Migrate `projectRegistry.json` → `projects` table
   - **Migrate `clones.json` → `project_clones` table** (with checkpoint fields)
   - Migrate `commits.json` → `commit_annotations` table
3. **Phase A**: Implement manual git connection with "Connect Git" button
4. **Phase B**: Build commit timeline with:
   - Pin/unpin commit buttons
   - Branch selector dropdown
   - Visual indicators for pinned nodes
   - Database-backed annotations
5. **Test incrementally**: Validate each phase before moving to next
6. **User feedback**: Get early feedback on:
   - Manual git connection UX
   - Checkpoint/pinning workflow
   - Branch management UX
   - Commit annotation workflow
   - Template creation from pinned commits
7. **Iterate**: Refine based on usage patterns

## Migration Considerations

**Backward Compatibility**:
- Existing **3 JSON files** will be migrated automatically on first launch:
  - `~/.bluekit/projectRegistry.json`
  - `.bluekit/clones.json` (converted to checkpoints)
  - `.bluekit/commits.json`
- Keep reading JSON as fallback during transition period
- Document migration process for users with warnings

**Data Integrity**:
- Use transactions for database operations
- Validate migrated data matches original JSON
- Provide rollback mechanism if migration fails
- **Clone-to-checkpoint conversion**:
  - All existing clones marked as `is_pinned = true`
  - `checkpoint_label` set to "Migrated: {clone.name}"
  - Parent relationships preserved for template tree

---

**Last Updated**: 2025-12-12
**Status**: Planning Phase - Complete with Checkpoint System & Branch Management
**Key Features**:
- Manual git connection (click-to-connect)
- Database migration (projectRegistry.json + clones.json + commits.json → SQLite)
- Checkpoint/pinning system (unified clones)
- Branch management (switch branches, branch-specific history)
- Commit timeline with visual pinned nodes
- Template tree from checkpoints
- Library publishing integration
**Dependencies**:
- Requires completed GitHub authentication infrastructure (Phase 1A-3A from github-integration.md)
- Requires Sea-ORM and SQLite database setup
- Requires libgit2 (via git2 crate) for git operations
**Owner**: Development Team
