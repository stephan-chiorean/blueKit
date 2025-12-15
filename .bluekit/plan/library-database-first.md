# Library System - Database-First Architecture

## Core Principle: Database is Source of Truth

**YAML front matter is for human-readable metadata only** (tags, description, name).

**SQLite database tracks:**
- Resource identity (stable IDs)
- Publishing status (what's published, where)
- Sync state (local vs remote hashes)
- Relationships (variations, subscriptions)

---

## Why Database > YAML for Publishing Metadata

### Problems with YAML-Based Tracking

❌ **User can accidentally delete metadata**
```yaml
# Oops, user deletes library section while editing
---
id: kit-uuid
# library: {} ← GONE!
---
```

❌ **File copied without metadata**
```bash
cp .bluekit/kits/api-error.md ~/Desktop/backup.md
# Backup has no library metadata, might republish as duplicate
```

❌ **YAML parsing errors**
```yaml
---
library:
  workspace_id: "abc
  # ← Missing quote breaks parsing
---
```

❌ **Merging YAML in git conflicts is error-prone**

### Database-First Advantages

✅ **Reliable** - Database can't be accidentally edited by user
✅ **Transactional** - Updates are atomic
✅ **Queryable** - "Show all published resources" is a simple SQL query
✅ **Survives file moves** - Resource ID stays linked even if path changes
✅ **No parsing errors** - Structured data, not text

---

## Revised Database Schema

### Resources Table (Source of Truth)

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "resources")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String, // UUID - stable identifier

    pub project_id: String, // FK to projects

    // File tracking
    pub file_path: String, // Relative path (.bluekit/kits/api-error.md)
    pub resource_type: String, // "kit" | "walkthrough" | "agent" | "diagram"

    // Metadata (from YAML front matter)
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>, // JSON array

    // Content tracking
    pub content_hash: String, // SHA-256 of file content
    pub file_modified_at: i64, // OS file mtime

    // Timestamps
    pub created_at: i64,
    pub updated_at: i64,
}
```

**Key Points:**
- `id` is UUID, never changes
- `file_path` can change (file moves/renames)
- `content_hash` tracks local content
- Metadata synced from YAML on file changes (via file watcher)

### Library Artifacts Table (What's Published)

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "library_artifacts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,

    pub workspace_id: String, // FK to library_workspaces
    pub resource_id: String,  // FK to resources (stable link)

    // Remote location
    pub remote_path: String, // Path in GitHub repo

    // Snapshot metadata (at publish time)
    pub artifact_type: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>,

    // Content tracking
    pub content_hash: String, // SHA-256 of published content
    pub github_commit_sha: String, // Git commit SHA

    // Variation tracking
    pub parent_artifact_id: Option<String>, // FK to self (for variations)
    pub variation_label: Option<String>, // "Mobile", "TypeScript", etc.

    // Publishing info
    pub published_by: Option<String>,
    pub published_at: i64,
    pub last_synced_at: i64,
}
```

**Key Points:**
- Links to `resources.id` (not path!)
- Stores snapshot of metadata at publish time
- `parent_artifact_id` for variations

### Library Subscriptions Table (What User Pulled)

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "library_subscriptions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,

    pub workspace_id: String,  // FK to library_workspaces
    pub artifact_id: String,   // FK to library_artifacts
    pub resource_id: String,   // FK to resources (local copy)

    // Sync state
    pub local_content_hash: String,
    pub remote_content_hash: String,

    // Timestamps
    pub pulled_at: i64,
    pub last_checked_at: i64,
}
```

**Update Detection:**
```rust
if subscription.local_content_hash != subscription.remote_content_hash {
    // Show: "Update available"
}
```

---

## How It Works: Key Workflows

### 1. File Watcher → Database Sync

**When file changes:**
```rust
// File watcher event
file_changed(".bluekit/kits/api-error.md")
  ↓
// Find resource by path
let resource = Resources::find()
    .filter(resources::Column::FilePath.eq(".bluekit/kits/api-error.md"))
    .one(db)
    .await?;
  ↓
// Parse YAML front matter
let (metadata, content) = parse_markdown(file_content)?;
  ↓
// Calculate new hash
let new_hash = calculate_hash(&content);
  ↓
// Update resource in database
resource.name = metadata.get("alias").or(metadata.get("id"));
resource.description = metadata.get("description");
resource.tags = metadata.get("tags");
resource.content_hash = new_hash;
resource.updated_at = now();
resource.update(db).await?;
  ↓
// Check if published
let artifact = LibraryArtifacts::find()
    .filter(library_artifacts::Column::ResourceId.eq(resource.id))
    .one(db)
    .await?;
  ↓
if let Some(artifact) = artifact {
    if artifact.content_hash != new_hash {
        // Emit event: "Resource has unpublished changes"
        emit_event("resource-unpublished-changes", resource.id);
    }
}
```

**When file moved:**
```rust
// File watcher event
file_moved(
    from: ".bluekit/kits/api-error.md",
    to: ".bluekit/kits/backend/api-error.md"
)
  ↓
// Find resource by old path
let resource = Resources::find()
    .filter(resources::Column::FilePath.eq(".bluekit/kits/api-error.md"))
    .one(db)
    .await?;
  ↓
// Update path
resource.file_path = ".bluekit/kits/backend/api-error.md";
resource.updated_at = now();
resource.update(db).await?;
  ↓
// Publishing still works (uses resource.id, not path)
```

**When file deleted:**
```rust
file_deleted(".bluekit/kits/api-error.md")
  ↓
// Find resource
let resource = Resources::find()
    .filter(resources::Column::FilePath.eq(".bluekit/kits/api-error.md"))
    .one(db)
    .await?;
  ↓
// Check if published
let artifact = LibraryArtifacts::find()
    .filter(library_artifacts::Column::ResourceId.eq(resource.id))
    .one(db)
    .await?;
  ↓
if artifact.is_some() {
    // Show notification: "Published resource deleted"
    // Options: [Delete from library] [Keep in library] [Restore file]
} else {
    // Just delete resource from database
    resource.delete(db).await?;
}
```

### 2. Publishing Flow (Database-First)

**User clicks "Publish":**
```rust
#[tauri::command]
pub async fn publish_resource(
    resource_id: String,
    workspace_id: String,
) -> Result<LibraryArtifact, String> {
    let db = get_database().await?;

    // 1. Get resource from database
    let resource = Resources::find_by_id(&resource_id)
        .one(&db)
        .await?
        .ok_or("Resource not found")?;

    // 2. Check if already published
    let existing_artifact = LibraryArtifacts::find()
        .filter(library_artifacts::Column::ResourceId.eq(&resource_id))
        .filter(library_artifacts::Column::WorkspaceId.eq(&workspace_id))
        .one(&db)
        .await?;

    // 3. Determine action
    let action = if existing_artifact.is_some() {
        // Already published - ask user
        ask_user_update_or_variation()?
        // Returns: UpdateAction::Update | UpdateAction::CreateVariation
    } else {
        UpdateAction::PublishNew
    };

    // 4. Read file content
    let file_path = format!("{}/{}", get_project_path(&resource.project_id)?, resource.file_path);
    let file_content = fs::read_to_string(&file_path)?;

    // 5. Get workspace
    let workspace = LibraryWorkspaces::find_by_id(&workspace_id)
        .one(&db)
        .await?
        .ok_or("Workspace not found")?;

    // 6. Determine remote path
    let remote_path = match action {
        UpdateAction::Update => {
            existing_artifact.unwrap().remote_path
        }
        UpdateAction::CreateVariation => {
            let variation_label = ask_user_variation_label()?;
            format!("{}s/{}-{}.md",
                resource.resource_type,
                slugify(&resource.name),
                slugify(&variation_label)
            )
        }
        UpdateAction::PublishNew => {
            format!("{}s/{}.md",
                resource.resource_type,
                Path::new(&resource.file_path).file_name().unwrap().to_str().unwrap()
            )
        }
    };

    // 7. Push to GitHub
    let github_token = get_github_token_from_keychain()?;
    let github_client = GitHubClient::new(github_token);

    let commit_sha = github_client.create_or_update_file(
        &workspace.github_owner,
        &workspace.github_repo,
        &remote_path,
        &file_content,
        &format!("[BlueKit] Publish: {} by {}", resource.name, get_current_user()),
    ).await?;

    // 8. Create/update artifact in database
    let artifact = match action {
        UpdateAction::Update => {
            let mut existing = existing_artifact.unwrap();
            existing.content_hash = resource.content_hash.clone();
            existing.github_commit_sha = commit_sha;
            existing.last_synced_at = now();
            existing.update(&db).await?
        }
        UpdateAction::CreateVariation | UpdateAction::PublishNew => {
            let new_artifact = library_artifacts::ActiveModel {
                id: Set(generate_id()),
                workspace_id: Set(workspace_id),
                resource_id: Set(resource_id),
                remote_path: Set(remote_path),
                artifact_type: Set(resource.resource_type),
                name: Set(resource.name),
                description: Set(resource.description),
                tags: Set(resource.tags),
                content_hash: Set(resource.content_hash),
                github_commit_sha: Set(commit_sha),
                parent_artifact_id: Set(
                    if matches!(action, UpdateAction::CreateVariation) {
                        existing_artifact.map(|a| a.id)
                    } else {
                        None
                    }
                ),
                published_at: Set(now()),
                last_synced_at: Set(now()),
                ..Default::default()
            };
            new_artifact.insert(&db).await?
        }
    };

    Ok(artifact.into())
}
```

**No YAML modification needed!** Database tracks everything.

### 3. Discovery & Pulling

**Browse library:**
```rust
#[tauri::command]
pub async fn get_workspace_artifacts(
    workspace_id: String,
) -> Result<Vec<LibraryArtifact>, String> {
    let db = get_database().await?;

    // Option 1: From local cache (fast)
    let artifacts = LibraryArtifacts::find()
        .filter(library_artifacts::Column::WorkspaceId.eq(workspace_id))
        .all(&db)
        .await?;

    // Option 2: Sync from GitHub first (fresh)
    // sync_workspace(workspace_id).await?;
    // Then fetch from DB

    Ok(artifacts)
}
```

**Pull artifact:**
```rust
#[tauri::command]
pub async fn pull_artifact(
    artifact_id: String,
    target_project_id: String,
) -> Result<Resource, String> {
    let db = get_database().await?;

    // 1. Get artifact
    let artifact = LibraryArtifacts::find_by_id(&artifact_id)
        .one(&db)
        .await?
        .ok_or("Artifact not found")?;

    // 2. Get workspace
    let workspace = LibraryWorkspaces::find_by_id(&artifact.workspace_id)
        .one(&db)
        .await?
        .ok_or("Workspace not found")?;

    // 3. Download from GitHub
    let github_token = get_github_token_from_keychain()?;
    let github_client = GitHubClient::new(github_token);

    let content = github_client.get_file_contents(
        &workspace.github_owner,
        &workspace.github_repo,
        &artifact.remote_path,
    ).await?;

    // 4. Determine local path
    let project = Projects::find_by_id(&target_project_id)
        .one(&db)
        .await?
        .ok_or("Project not found")?;

    let local_path = format!("{}/.bluekit/{}s/{}",
        project.path,
        artifact.artifact_type,
        Path::new(&artifact.remote_path).file_name().unwrap().to_str().unwrap()
    );

    // 5. Write file
    fs::write(&local_path, &content)?;

    // 6. Create resource in database
    let content_hash = calculate_hash(&content);

    let resource = resources::ActiveModel {
        id: Set(generate_id()),
        project_id: Set(target_project_id.clone()),
        file_path: Set(format!(".bluekit/{}s/{}", artifact.artifact_type, Path::new(&artifact.remote_path).file_name().unwrap().to_str().unwrap())),
        resource_type: Set(artifact.artifact_type),
        name: Set(artifact.name),
        description: Set(artifact.description),
        tags: Set(artifact.tags),
        content_hash: Set(content_hash.clone()),
        file_modified_at: Set(now()),
        created_at: Set(now()),
        updated_at: Set(now()),
        ..Default::default()
    };

    let resource = resource.insert(&db).await?;

    // 7. Create subscription
    let subscription = library_subscriptions::ActiveModel {
        id: Set(generate_id()),
        workspace_id: Set(artifact.workspace_id),
        artifact_id: Set(artifact_id),
        resource_id: Set(resource.id.clone()),
        local_content_hash: Set(content_hash.clone()),
        remote_content_hash: Set(artifact.content_hash),
        pulled_at: Set(now()),
        last_checked_at: Set(now()),
        ..Default::default()
    };

    subscription.insert(&db).await?;

    // 8. File watcher will detect new file and update metadata

    Ok(resource.into())
}
```

### 4. Update Detection

**Check for updates:**
```rust
#[tauri::command]
pub async fn check_for_updates(
    workspace_id: String,
) -> Result<Vec<UpdateInfo>, String> {
    let db = get_database().await?;

    // Get all subscriptions for workspace
    let subscriptions = LibrarySubscriptions::find()
        .filter(library_subscriptions::Column::WorkspaceId.eq(workspace_id))
        .all(&db)
        .await?;

    let mut updates = Vec::new();

    for subscription in subscriptions {
        // Get current resource hash
        let resource = Resources::find_by_id(&subscription.resource_id)
            .one(&db)
            .await?
            .ok_or("Resource not found")?;

        // Compare hashes
        let has_local_changes = resource.content_hash != subscription.local_content_hash;
        let has_remote_updates = subscription.local_content_hash != subscription.remote_content_hash;

        if has_local_changes || has_remote_updates {
            updates.push(UpdateInfo {
                resource_id: resource.id,
                artifact_id: subscription.artifact_id,
                status: match (has_local_changes, has_remote_updates) {
                    (true, false) => UpdateStatus::LocalChanges,
                    (false, true) => UpdateStatus::RemoteUpdates,
                    (true, true) => UpdateStatus::Conflict,
                    _ => unreachable!(),
                },
            });
        }
    }

    Ok(updates)
}
```

---

## Variations: Simple Grouping

### How Variations Look in Database

**Original:**
```rust
library_artifacts {
    id: "artifact-1",
    resource_id: "resource-abc",
    remote_path: "kits/api-error.md",
    parent_artifact_id: null, // This is the original
    variation_label: null,
}
```

**Variation:**
```rust
library_artifacts {
    id: "artifact-2",
    resource_id: "resource-xyz", // Different resource ID
    remote_path: "kits/api-error-mobile.md",
    parent_artifact_id: "artifact-1", // Points to original
    variation_label: "Mobile",
}
```

### UI Presentation (Simple)

**Option 1: Flat with Labels**
```
┌─────────────────────────────────────────────────┐
│ Kits                                            │
├─────────────────────────────────────────────────┤
│ ○ API Error Handling                            │
│ ○ API Error Handling (Mobile)                   │
│ ○ API Error Handling (TypeScript)               │
│ ○ State Management Pattern                      │
└─────────────────────────────────────────────────┘
```

**Option 2: Grouped (Indented)**
```
┌─────────────────────────────────────────────────┐
│ Kits                                            │
├─────────────────────────────────────────────────┤
│ ▼ API Error Handling                            │
│   ├─ Mobile Version                             │
│   └─ TypeScript Version                         │
│ ○ State Management Pattern                      │
└─────────────────────────────────────────────────┘
```

**Option 3: Expandable (Collapsed by Default)**
```
┌─────────────────────────────────────────────────┐
│ Kits                                            │
├─────────────────────────────────────────────────┤
│ ▶ API Error Handling             (2 variations) │
│ ○ State Management Pattern                      │
└─────────────────────────────────────────────────┘

// Click to expand:
┌─────────────────────────────────────────────────┐
│ ▼ API Error Handling             (2 variations) │
│   ○ Original                                    │
│   ○ Mobile Version                              │
│   ○ TypeScript Version                          │
└─────────────────────────────────────────────────┘
```

### Query for Grouping

```rust
#[tauri::command]
pub async fn get_artifacts_with_variations(
    workspace_id: String,
) -> Result<Vec<ArtifactGroup>, String> {
    let db = get_database().await?;

    // Get all artifacts
    let artifacts = LibraryArtifacts::find()
        .filter(library_artifacts::Column::WorkspaceId.eq(workspace_id))
        .all(&db)
        .await?;

    // Group by parent
    let mut groups: HashMap<String, ArtifactGroup> = HashMap::new();

    for artifact in artifacts {
        if artifact.parent_artifact_id.is_none() {
            // This is an original
            groups.insert(artifact.id.clone(), ArtifactGroup {
                original: artifact.clone(),
                variations: Vec::new(),
            });
        }
    }

    // Add variations to groups
    for artifact in artifacts {
        if let Some(parent_id) = &artifact.parent_artifact_id {
            if let Some(group) = groups.get_mut(parent_id) {
                group.variations.push(artifact.clone());
            } else {
                // Orphaned variation (parent deleted?)
                // Treat as standalone
                groups.insert(artifact.id.clone(), ArtifactGroup {
                    original: artifact.clone(),
                    variations: Vec::new(),
                });
            }
        }
    }

    Ok(groups.into_values().collect())
}
```

**Keep it simple!** Variations are just linked artifacts. UI presents them clearly.

---

## Commit Message Convention

### Format

```
[BlueKit] <action>: <resource-name> by <user>

Examples:
[BlueKit] Publish: API Error Handling by john@acme.com
[BlueKit] Update: React Context Pattern by jane@acme.com
[BlueKit] Variation: API Error Handling (Mobile) by john@acme.com
```

### Benefits

1. **Easy to identify BlueKit commits:**
   ```bash
   git log --grep="\[BlueKit\]"
   ```

2. **Detect non-BlueKit changes:**
   ```rust
   let commits = github_client.get_commits(...).await?;
   let non_bluekit_commits = commits.iter()
       .filter(|c| !c.message.starts_with("[BlueKit]"))
       .collect();

   if !non_bluekit_commits.is_empty() {
       // Warn user: "Library modified outside BlueKit"
   }
   ```

3. **Attribution:**
   ```
   [BlueKit] Publish: API Error Handling by john@acme.com
   ```
   Shows who published (useful for teams)

4. **Automation:**
   ```yaml
   # GitHub Actions
   name: Validate BlueKit Publish
   on: [push]
   jobs:
     validate:
       runs-on: ubuntu-latest
       steps:
         - name: Check commit message
           run: |
             if [[ ! "${{ github.event.head_commit.message }}" =~ ^\[BlueKit\] ]]; then
               echo "⚠️  Non-BlueKit commit detected"
             fi
   ```

---

## Migration Path

### From Current State

**Current:**
- Resources tracked in files only
- No database yet

**Phase 1: Build Resources Table**
```rust
// On app startup
scan_all_projects()
  ↓
For each project:
  ↓
  Scan .bluekit/ directory
  ↓
  For each .md file:
    ↓
    Parse YAML front matter
    ↓
    Create resource in database:
      - id: from YAML or generate
      - file_path: relative path
      - content_hash: calculated
      - name, tags, description: from YAML
    ↓
  File watcher takes over (keeps DB in sync)
```

**Phase 2: Add Library Tables**
```rust
// Create tables
library_workspaces
library_artifacts
library_subscriptions
  ↓
// Migrate existing library data (if any)
// Otherwise start fresh
```

**Phase 3: Publishing**
```rust
// Use database-first approach (as described above)
```

---

## Summary

### Key Changes from Previous Plan

1. ✅ **Database is source of truth** (not YAML)
2. ✅ **YAML front matter for human metadata only** (tags, description)
3. ✅ **File watcher syncs YAML → Database** (one-way)
4. ✅ **Resource ID stable** (survives moves, renames)
5. ✅ **Publishing doesn't modify files** (only database)

### What Goes Where

**YAML Front Matter:**
```yaml
---
# Human-readable metadata only
id: api-error-uuid  # Stable ID
alias: API Error Handling
type: kit
tags: [backend, errors]
description: "Best practices for API errors"
---
```

**SQLite Database:**
```
resources table:
  - file_path (can change)
  - content_hash (for sync)
  - metadata (from YAML)

library_artifacts table:
  - workspace_id
  - resource_id (stable link)
  - remote_path
  - content_hash (remote)
  - parent_artifact_id (variations)

library_subscriptions table:
  - resource_id (local)
  - artifact_id (remote)
  - sync state
```

### Variations (Simple)

- **Original** has `parent_artifact_id: null`
- **Variation** has `parent_artifact_id: original_id`
- UI groups them (flat or expandable)
- No complex version trees!

### Commit Messages

```
[BlueKit] <action>: <name> by <user>
```

Clear, searchable, attributable.

---

**Next Step:** Implement resources table + file watcher sync, then build library tables on top.

---

**Last Updated**: 2025-01-27
**Status**: ✅ **Database-First Design Finalized**
