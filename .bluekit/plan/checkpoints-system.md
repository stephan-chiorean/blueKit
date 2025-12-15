# Checkpoints System

## Core Philosophy

**Commits:**
- Retrieved dynamically from GitHub API
- Cached/paginated for performance
- Displayed in timeline view
- NOT persisted in database

**Checkpoints:**
- User-pinned commits (saved snapshots)
- Stored in SQLite database
- Can be used to create new projects
- Support lineage tracking (checkpoint tree)

---

## Database Schema

### Checkpoints Table

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "checkpoints")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,

    pub project_id: String, // FK to projects

    // Git metadata
    pub git_commit_sha: String, // The commit this checkpoint represents
    pub git_branch: Option<String>,
    pub git_url: Option<String>,

    // Checkpoint metadata
    pub name: String, // User-defined name
    pub description: Option<String>,
    pub checkpoint_type: String, // "milestone" | "experiment" | "template" | "backup"

    // Lineage tracking
    pub parent_checkpoint_id: Option<String>, // FK to self (for checkpoint trees)
    pub created_from_project_id: Option<String>, // Original project (if checkpoint → new project)

    // User tracking
    pub pinned_by: Option<String>, // For team features
    pub pinned_at: i64,

    // Tags
    pub tags: Option<String>, // JSON array

    pub created_at: i64,
    pub updated_at: i64,
}
```

### Checkpoint Types

```rust
pub enum CheckpointType {
    Milestone,   // "Completed user auth feature"
    Experiment,  // "Before trying new state management"
    Template,    // "Good starting point for similar projects"
    Backup,      // "Before major refactor"
}
```

**Why types?**
- UI can filter/badge: 🏁 Milestone, 🧪 Experiment, 📋 Template, 💾 Backup
- Different workflows for each type
- User intent is clear

---

## Workflows

### 1. View Commits (Dynamic, GitHub API)

**User Experience:**
```
User opens Project Detail → Commits tab
  ↓
BlueKit fetches commits from GitHub API:
  - First 20 commits (paginated)
  - Cached for 5 minutes
  ↓
Display in timeline:
  ┌─────────────────────────────────────────────┐
  │ Commits                         [↻ Refresh] │
  ├─────────────────────────────────────────────┤
  │ ○ feat: Add user authentication        📌  │
  │   abc123 • john • 2 days ago           diff │
  │                                             │
  │ ● feat: Setup database schema          📌  │ ← Checkpoint
  │   def456 • jane • 3 days ago           diff │
  │                                             │
  │ ○ chore: Initial commit                📌  │
  │   ghi789 • john • 1 week ago           diff │
  │                                             │
  │              [Load More (10)]               │
  └─────────────────────────────────────────────┘
```

**Implementation:**
```rust
#[tauri::command]
pub async fn get_project_commits(
    project_id: String,
    branch: Option<String>,
    page: u32,
    per_page: u32,
) -> Result<CommitsPage, String> {
    let project = Projects::find_by_id(&project_id)
        .one(&db)
        .await?
        .ok_or("Project not found")?;

    // Check cache first
    let cache_key = format!("commits:{}:{}:{}", project_id, branch.as_ref().unwrap_or(&"HEAD".to_string()), page);
    if let Some(cached) = get_cache(&cache_key) {
        if cached.timestamp + 300 > now() { // 5 min cache
            return Ok(cached.data);
        }
    }

    // Fetch from GitHub API
    let github_token = get_github_token_from_keychain()?;
    let github_client = GitHubClient::new(github_token);

    let commits = github_client.get_commits(
        &extract_owner(&project.git_url?),
        &extract_repo(&project.git_url?),
        &branch.unwrap_or_else(|| project.git_branch.clone().unwrap_or("main".to_string())),
        page,
        per_page,
    ).await?;

    // Check which commits are pinned as checkpoints
    let checkpoints = Checkpoints::find()
        .filter(checkpoints::Column::ProjectId.eq(&project_id))
        .all(&db)
        .await?;

    let checkpoint_shas: HashSet<String> = checkpoints
        .iter()
        .map(|c| c.git_commit_sha.clone())
        .collect();

    // Enrich commits with checkpoint status
    let enriched_commits: Vec<CommitWithCheckpoint> = commits
        .into_iter()
        .map(|commit| CommitWithCheckpoint {
            sha: commit.sha.clone(),
            message: commit.message,
            author: commit.author,
            date: commit.date,
            is_checkpoint: checkpoint_shas.contains(&commit.sha),
            checkpoint_id: checkpoints
                .iter()
                .find(|c| c.git_commit_sha == commit.sha)
                .map(|c| c.id.clone()),
        })
        .collect();

    // Cache result
    set_cache(&cache_key, &enriched_commits, 300);

    Ok(CommitsPage {
        commits: enriched_commits,
        page,
        has_more: enriched_commits.len() == per_page as usize,
    })
}
```

### 2. Pin Commit as Checkpoint

**User Experience:**
```
User clicks 📌 button on commit
  ↓
Shows dialog:
  ┌─────────────────────────────────────────────┐
  │ Pin Checkpoint                              │
  ├─────────────────────────────────────────────┤
  │ Commit: feat: Add user authentication       │
  │ SHA: abc123                                 │
  │                                             │
  │ Checkpoint Name:                            │
  │ ┌─────────────────────────────────────────┐ │
  │ │ User Auth Complete                      │ │
  │ └─────────────────────────────────────────┘ │
  │                                             │
  │ Description (optional):                     │
  │ ┌─────────────────────────────────────────┐ │
  │ │ JWT + refresh tokens implemented        │ │
  │ └─────────────────────────────────────────┘ │
  │                                             │
  │ Type:                                       │
  │ [●] Milestone    [ ] Experiment             │
  │ [ ] Template     [ ] Backup                 │
  │                                             │
  │ Tags:                                       │
  │ ┌─────────────────────────────────────────┐ │
  │ │ [auth] [jwt] [+]                        │ │
  │ └─────────────────────────────────────────┘ │
  │                                             │
  │                      [Cancel]  [Pin]       │
  └─────────────────────────────────────────────┘
  ↓
Checkpoint saved to database
  ↓
Commit shows ● icon in timeline
```

**Implementation:**
```rust
#[tauri::command]
pub async fn pin_checkpoint(
    project_id: String,
    commit_sha: String,
    name: String,
    description: Option<String>,
    checkpoint_type: String,
    tags: Vec<String>,
) -> Result<Checkpoint, String> {
    let db = get_database().await?;

    // Get project
    let project = Projects::find_by_id(&project_id)
        .one(&db)
        .await?
        .ok_or("Project not found")?;

    // Check if checkpoint already exists
    let existing = Checkpoints::find()
        .filter(checkpoints::Column::ProjectId.eq(&project_id))
        .filter(checkpoints::Column::GitCommitSha.eq(&commit_sha))
        .one(&db)
        .await?;

    if existing.is_some() {
        return Err("Checkpoint already exists for this commit".to_string());
    }

    // Create checkpoint
    let checkpoint = checkpoints::ActiveModel {
        id: Set(generate_id()),
        project_id: Set(project_id),
        git_commit_sha: Set(commit_sha),
        git_branch: Set(project.git_branch),
        git_url: Set(project.git_url),
        name: Set(name),
        description: Set(description),
        checkpoint_type: Set(checkpoint_type),
        parent_checkpoint_id: Set(None), // Will be set if creating project from checkpoint
        created_from_project_id: Set(None),
        pinned_by: Set(Some(get_current_user())),
        pinned_at: Set(now()),
        tags: Set(Some(serde_json::to_string(&tags)?)),
        created_at: Set(now()),
        updated_at: Set(now()),
        ..Default::default()
    };

    let checkpoint = checkpoint.insert(&db).await?;

    // Invalidate commits cache
    invalidate_cache(&format!("commits:{}:*", project_id));

    Ok(checkpoint.into())
}
```

### 3. View Checkpoints

**User Experience:**
```
Project Detail → Checkpoints tab
  ↓
  ┌─────────────────────────────────────────────┐
  │ Checkpoints                  [Filter ▼]     │
  ├─────────────────────────────────────────────┤
  │ 🏁 User Auth Complete                       │
  │    abc123 • Pinned 2 days ago               │
  │    [View Commit] [Create Project] [Delete]  │
  │                                             │
  │ 🧪 Before State Refactor                    │
  │    def456 • Pinned 1 week ago               │
  │    [View Commit] [Create Project] [Delete]  │
  │                                             │
  │ 📋 Next.js Starter                          │
  │    ghi789 • Pinned 2 weeks ago              │
  │    [View Commit] [Create Project] [Delete]  │
  └─────────────────────────────────────────────┘
```

**Implementation:**
```rust
#[tauri::command]
pub async fn get_project_checkpoints(
    project_id: String,
    checkpoint_type: Option<String>,
) -> Result<Vec<Checkpoint>, String> {
    let db = get_database().await?;

    let mut query = Checkpoints::find()
        .filter(checkpoints::Column::ProjectId.eq(project_id));

    if let Some(type_filter) = checkpoint_type {
        query = query.filter(checkpoints::Column::CheckpointType.eq(type_filter));
    }

    let checkpoints = query
        .order_by_desc(checkpoints::Column::PinnedAt)
        .all(&db)
        .await?;

    Ok(checkpoints)
}
```

### 4. Create Project from Checkpoint

**User Experience:**
```
User clicks "Create Project" on checkpoint
  ↓
Shows dialog:
  ┌─────────────────────────────────────────────┐
  │ Create Project from Checkpoint              │
  ├─────────────────────────────────────────────┤
  │ Checkpoint: User Auth Complete              │
  │ Commit: abc123                              │
  │                                             │
  │ Project Name:                               │
  │ ┌─────────────────────────────────────────┐ │
  │ │ Customer Portal                         │ │
  │ └─────────────────────────────────────────┘ │
  │                                             │
  │ Location:                                   │
  │ ┌─────────────────────────────────────────┐ │
  │ │ /Users/john/projects/customer-portal   │ │
  │ └─────────────────────────────────────────┘ │
  │ [Browse...]                                 │
  │                                             │
  │ [×] Register in BlueKit                     │
  │                                             │
  │                      [Cancel]  [Create]    │
  └─────────────────────────────────────────────┘
  ↓
BlueKit:
  1. Clone git repo at specific commit
  2. Copy files to target location
  3. Create new project in database
  4. Create new checkpoint in database (linked to parent)
  ↓
New project created!
  ↓
Checkpoint tree:
  Original Checkpoint (Project A)
    └── Child Checkpoint (Project B) ← New project
```

**Implementation:**
```rust
#[tauri::command]
pub async fn create_project_from_checkpoint(
    checkpoint_id: String,
    new_project_name: String,
    target_path: String,
    register_in_bluekit: bool,
) -> Result<Project, String> {
    let db = get_database().await?;

    // Get checkpoint
    let checkpoint = Checkpoints::find_by_id(&checkpoint_id)
        .one(&db)
        .await?
        .ok_or("Checkpoint not found")?;

    // Clone repo at specific commit
    let temp_dir = create_temp_dir()?;

    git_clone(
        &checkpoint.git_url.ok_or("No git URL")?,
        &temp_dir,
    )?;

    git_checkout(&temp_dir, &checkpoint.git_commit_sha)?;

    // Copy to target location (excluding .git)
    copy_directory(&temp_dir, &target_path, &[".git"])?;

    // Clean up temp directory
    fs::remove_dir_all(&temp_dir)?;

    // Create new project
    let new_project = if register_in_bluekit {
        let project = projects::ActiveModel {
            id: Set(generate_id()),
            name: Set(new_project_name.clone()),
            path: Set(target_path.clone()),
            created_at: Set(now()),
            updated_at: Set(now()),
            ..Default::default()
        };

        Some(project.insert(&db).await?)
    } else {
        None
    };

    // Create checkpoint in new project (linked to parent)
    if let Some(ref project) = new_project {
        let child_checkpoint = checkpoints::ActiveModel {
            id: Set(generate_id()),
            project_id: Set(project.id.clone()),
            git_commit_sha: Set(checkpoint.git_commit_sha.clone()),
            git_branch: Set(checkpoint.git_branch.clone()),
            git_url: Set(checkpoint.git_url.clone()),
            name: Set(format!("Created from: {}", checkpoint.name)),
            description: Set(Some(format!("Created from checkpoint in original project"))),
            checkpoint_type: Set("template".to_string()),
            parent_checkpoint_id: Set(Some(checkpoint_id)), // Link to parent!
            created_from_project_id: Set(Some(checkpoint.project_id.clone())),
            pinned_at: Set(now()),
            created_at: Set(now()),
            updated_at: Set(now()),
            ..Default::default()
        };

        child_checkpoint.insert(&db).await?;
    }

    Ok(new_project.unwrap_or_else(|| {
        // Return dummy project if not registered
        Project {
            id: String::new(),
            name: new_project_name,
            path: target_path,
            ..Default::default()
        }
    }))
}
```

### 5. Checkpoint Tree Visualization

**Query for Tree:**
```rust
#[tauri::command]
pub async fn get_checkpoint_tree(
    root_checkpoint_id: String,
) -> Result<CheckpointTree, String> {
    let db = get_database().await?;

    // Get root checkpoint
    let root = Checkpoints::find_by_id(&root_checkpoint_id)
        .one(&db)
        .await?
        .ok_or("Checkpoint not found")?;

    // Recursively get children
    let children = get_checkpoint_children(&db, &root_checkpoint_id).await?;

    Ok(CheckpointTree {
        checkpoint: root,
        children,
    })
}

async fn get_checkpoint_children(
    db: &DatabaseConnection,
    parent_id: &str,
) -> Result<Vec<CheckpointTree>, String> {
    let children = Checkpoints::find()
        .filter(checkpoints::Column::ParentCheckpointId.eq(parent_id))
        .all(db)
        .await?;

    let mut trees = Vec::new();

    for child in children {
        let subtree = CheckpointTree {
            checkpoint: child.clone(),
            children: get_checkpoint_children(db, &child.id).await?,
        };
        trees.push(subtree);
    }

    Ok(trees)
}
```

**UI Visualization:**
```
┌─────────────────────────────────────────────┐
│ Checkpoint Lineage                          │
├─────────────────────────────────────────────┤
│ 🏁 User Auth Complete (Project A)           │
│   ├── 📋 Customer Portal (Project B)        │
│   │   └── 🧪 Before Redesign (Project B)   │
│   └── 📋 Admin Dashboard (Project C)        │
└─────────────────────────────────────────────┘
```

### 6. View Commit Diff in GitHub

**User Experience:**
```
User clicks "diff" link on commit
  ↓
BlueKit opens browser:
  https://github.com/owner/repo/commit/abc123
  ↓
GitHub shows full diff
```

**Implementation:**
```rust
#[tauri::command]
pub async fn open_commit_in_github(
    project_id: String,
    commit_sha: String,
) -> Result<(), String> {
    let db = get_database().await?;

    let project = Projects::find_by_id(&project_id)
        .one(&db)
        .await?
        .ok_or("Project not found")?;

    let git_url = project.git_url.ok_or("Project not connected to git")?;

    // Parse GitHub URL
    let (owner, repo) = parse_github_url(&git_url)?;

    // Construct GitHub commit URL
    let url = format!("https://github.com/{}/{}/commit/{}", owner, repo, commit_sha);

    // Open in default browser
    open_url(&url)?;

    Ok(())
}
```

---

## Migration: clones.json → Checkpoints

### Current clones.json Format

```json
{
  "clones": [
    {
      "id": "bluekit-foundation-20250127",
      "name": "BlueKit Foundation",
      "description": "Initial project structure",
      "gitUrl": "https://github.com/user/bluekit.git",
      "gitCommit": "abc123",
      "gitBranch": "main",
      "tags": ["foundation", "starter"],
      "created_at": 1706304000
    }
  ]
}
```

### Migration Script

```rust
#[tauri::command]
pub async fn migrate_clones_to_checkpoints() -> Result<MigrationSummary, String> {
    let db = get_database().await?;
    let mut summary = MigrationSummary {
        projects_migrated: 0,
        checkpoints_created: 0,
        errors: Vec::new(),
    };

    // Get all projects
    let projects = Projects::find().all(&db).await?;

    for project in projects {
        let clones_path = format!("{}/.bluekit/clones.json", project.path);

        if !Path::new(&clones_path).exists() {
            continue;
        }

        // Read clones.json
        let json_content = match fs::read_to_string(&clones_path) {
            Ok(content) => content,
            Err(e) => {
                summary.errors.push(format!("Failed to read {}: {}", clones_path, e));
                continue;
            }
        };

        let clones_data: ClonesJson = match serde_json::from_str(&json_content) {
            Ok(data) => data,
            Err(e) => {
                summary.errors.push(format!("Failed to parse {}: {}", clones_path, e));
                continue;
            }
        };

        // Migrate each clone to checkpoint
        for clone in clones_data.clones {
            let checkpoint = checkpoints::ActiveModel {
                id: Set(clone.id),
                project_id: Set(project.id.clone()),
                git_commit_sha: Set(clone.git_commit),
                git_branch: Set(Some(clone.git_branch)),
                git_url: Set(Some(clone.git_url)),
                name: Set(clone.name),
                description: Set(Some(clone.description)),
                checkpoint_type: Set("template".to_string()), // Default type for migrated clones
                parent_checkpoint_id: Set(None),
                created_from_project_id: Set(None),
                pinned_by: Set(None),
                pinned_at: Set(clone.created_at),
                tags: Set(Some(serde_json::to_string(&clone.tags)?)),
                created_at: Set(clone.created_at),
                updated_at: Set(clone.created_at),
                ..Default::default()
            };

            match checkpoint.insert(&db).await {
                Ok(_) => summary.checkpoints_created += 1,
                Err(e) => summary.errors.push(format!("Failed to insert checkpoint {}: {}", clone.name, e)),
            }
        }

        summary.projects_migrated += 1;

        // Optional: Backup and remove clones.json
        // fs::rename(&clones_path, format!("{}.backup", clones_path))?;
    }

    Ok(summary)
}
```

---

## BlueKit Init Integration

### The Challenge

**Current Flow:**
```
Terminal: bluekit init
  ↓
Writes to: ~/.bluekit/projectRegistry.json
  ↓
App reads: projectRegistry.json on startup
```

**New Flow (with SQLite):**
```
Terminal: bluekit init
  ↓
Needs to write to: SQLite database
  ↓
But CLI doesn't have Sea-ORM...
```

### Solution Options

#### Option 1: CLI Writes JSON, App Migrates (Recommended)

**Hybrid Approach:**
```
Terminal: bluekit init
  ↓
Writes to: ~/.bluekit/projectRegistry.json (still)
  ↓
App on startup:
  - Reads projectRegistry.json
  - Syncs to SQLite
  - Marks as migrated
  ↓
App uses SQLite for everything
```

**Implementation:**
```rust
// On app startup
#[tauri::command]
pub async fn sync_project_registry() -> Result<SyncSummary, String> {
    let db = get_database().await?;
    let registry_path = get_registry_path()?;

    if !registry_path.exists() {
        return Ok(SyncSummary { synced: 0 });
    }

    // Read JSON
    let json_content = fs::read_to_string(&registry_path)?;
    let registry: ProjectRegistry = serde_json::from_str(&json_content)?;

    let mut synced = 0;

    for project_entry in registry.projects {
        // Check if project already in DB
        let existing = Projects::find()
            .filter(projects::Column::Path.eq(&project_entry.path))
            .one(&db)
            .await?;

        if existing.is_some() {
            continue; // Already synced
        }

        // Add to database
        let project = projects::ActiveModel {
            id: Set(project_entry.id),
            name: Set(project_entry.name),
            path: Set(project_entry.path),
            created_at: Set(project_entry.date_added),
            updated_at: Set(project_entry.last_opened),
            ..Default::default()
        };

        project.insert(&db).await?;
        synced += 1;
    }

    Ok(SyncSummary { synced })
}
```

**Pros:**
- ✅ CLI stays simple (no DB dependency)
- ✅ Backward compatible
- ✅ Gradual migration

**Cons:**
- ❌ Dual source of truth (temporary)

#### Option 2: CLI Calls IPC Command

**If App is Running:**
```
Terminal: bluekit init
  ↓
CLI detects: App is running (check port or process)
  ↓
CLI calls: IPC command (via HTTP/WebSocket)
  ↓
App: Adds project to SQLite
```

**If App is NOT Running:**
```
Terminal: bluekit init
  ↓
CLI detects: App not running
  ↓
CLI writes to: projectRegistry.json (fallback)
  ↓
App syncs on next startup
```

**Pros:**
- ✅ Direct to database when possible
- ✅ Fallback for offline

**Cons:**
- ❌ More complex CLI
- ❌ Requires IPC setup

#### Option 3: CLI Uses SQLite Directly

**Add rusqlite to CLI:**
```toml
# In CLI Cargo.toml
[dependencies]
rusqlite = "0.30"
```

```rust
// bluekit init command
fn init_project(path: String) {
    let db_path = get_db_path()?; // ~/.bluekit/bluekit.db

    let conn = rusqlite::Connection::open(db_path)?;

    conn.execute(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            generate_id(),
            extract_project_name(&path),
            path,
            now(),
            now(),
        ],
    )?;

    println!("✓ Project registered in BlueKit");
}
```

**Pros:**
- ✅ Direct to database
- ✅ No dual source
- ✅ Works offline

**Cons:**
- ❌ Schema must match exactly (use same migration version)
- ❌ Potential for DB locking conflicts (if app is running)

### Recommended Approach

**Use Option 1 for now** (CLI writes JSON, app syncs):
1. Simple to implement
2. Backward compatible
3. No risk of DB locking
4. Can migrate to Option 3 later

**Later, add Option 3** when database schema is stable:
1. CLI checks if DB exists
2. If yes: Write directly to SQLite
3. If no: Create DB and write
4. Handle locking gracefully (retry or fallback to JSON)

---

## Summary

### Checkpoints System

**Core Concepts:**
- ✅ Commits = Dynamic (GitHub API)
- ✅ Checkpoints = Pinned commits (SQLite)
- ✅ Checkpoint types: Milestone, Experiment, Template, Backup
- ✅ Lineage tracking via `parent_checkpoint_id`
- ✅ Create projects from checkpoints
- ✅ View diffs in GitHub

**Database:**
```rust
checkpoints {
    id: "uuid",
    project_id: "project-uuid",
    git_commit_sha: "abc123",
    name: "User Auth Complete",
    checkpoint_type: "milestone",
    parent_checkpoint_id: null,  // For tree
    tags: '["auth", "jwt"]',
}
```

**Migration:**
- Migrate `clones.json` → checkpoints table
- Type = "template" for all migrated clones

### BlueKit Init

**Recommended:**
- CLI writes to `projectRegistry.json`
- App syncs to SQLite on startup
- Gradual migration path
- Later: CLI can write directly to SQLite

---

**Last Updated**: 2025-01-27
**Status**: ✅ **Checkpoints System Finalized**
