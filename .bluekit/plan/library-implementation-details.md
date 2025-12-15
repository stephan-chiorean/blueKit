# Library Implementation Details

## Critical Problems to Solve

### Problem 1: Resources Move Locally
**Scenario:**
```
User publishes: .bluekit/kits/api-error.md
  ↓
Later moves to: .bluekit/kits/backend/api-error.md
  ↓
BlueKit needs to know: "This is the same resource, just moved"
```

**Path is NOT source of truth!**

### Problem 2: Updates vs New Resources
**Scenario:**
```
User publishes kit → Library has v1
User edits kit locally
User clicks "Publish" again

Is this:
  A) Update to v1? (overwrite)
  B) New variation? (v2)
  C) Completely separate resource?
```

### Problem 3: Detecting Out-of-Sync
**Scenario:**
```
User publishes kit → Library updated
User edits kit locally → Local changed
Team member edits in GitHub → Remote changed

User needs to see: "You have unpublished changes"
User needs to see: "Library has updates"
```

---

## Solution: Stable Resource IDs + Metadata Tracking

### Core Principle

**Resource ID is source of truth, not path.**

Every resource has:
1. **Stable ID** (in YAML front matter) - never changes
2. **Publishing metadata** (in YAML front matter) - tracks library connection
3. **Local path** (can change freely)

### Resource YAML with Publishing Metadata

```yaml
---
# Core identity (never changes)
id: api-error-handling-uuid-abc123
alias: API Error Handling
type: kit
description: "Best practices for handling API errors"
tags: [backend, errors, api]

# Publishing metadata (added when published)
library:
  workspace_id: acme-team-library
  remote_path: kits/backend/api-error-handling.md
  published_at: 1706304000
  published_by: john@acme.com
  content_hash: sha256:abc123def456...
  version_id: v1  # Optional: Track which version this is
---

## API Error Handling

Best practices...
```

### How This Solves Problems

**Problem 1 (Resources Move):**
```
.bluekit/kits/api-error.md
  id: api-error-handling-uuid-abc123
  library.remote_path: kits/api-error.md
  ↓
User moves to: .bluekit/kits/backend/api-error.md
  ↓
File watcher detects file move
  ↓
ID stays same: api-error-handling-uuid-abc123
  ↓
BlueKit knows: "Same resource, just moved locally"
  ↓
Publishing still works (uses ID, not path)
```

**Problem 2 (Updates vs New):**
```
User clicks "Publish" on edited resource
  ↓
BlueKit checks YAML front matter
  ↓
If library.workspace_id exists:
  → "This was published before"
  → Show options: [Update Existing] [Create Variation]
  ↓
If library.workspace_id missing:
  → "New resource"
  → Publish as new
```

**Problem 3 (Out-of-sync detection):**
```
File watcher detects resource changed
  ↓
Calculate new content hash
  ↓
Compare to library.content_hash in YAML
  ↓
If different:
  → Show badge: "Unpublished changes"
  → User can publish update
```

---

## Database Schema Relationships

### Projects Table (Local)

```rust
projects {
    id: "project-uuid",
    name: "My App",
    path: "/Users/john/my-app",
    // ... other fields
}
```

**Does NOT track library publishing** - that's in resource metadata!

### Library Workspaces Table (User's Workspaces)

```rust
library_workspaces {
    id: "workspace-uuid",
    name: "ACME Team Library",
    github_owner: "acme-corp",
    github_repo: "engineering-patterns",
    workspace_type: "team", // personal | team | public
}
```

**Represents**: GitHub repositories configured as Libraries

### Library Artifacts Table (What's Published)

**Purpose**: Index of what exists in library workspaces

```rust
library_artifacts {
    id: "artifact-uuid",
    workspace_id: "workspace-uuid", // FK to library_workspaces

    // Identity (stable across renames)
    resource_id: "api-error-handling-uuid-abc123", // Matches resource YAML id

    // Remote location
    remote_path: "kits/backend/api-error-handling.md",

    // Metadata snapshot
    artifact_type: "kit",
    name: "API Error Handling",
    description: "...",
    tags: '["backend", "errors"]', // JSON

    // Version tracking
    content_hash: "sha256:abc123...",
    version_label: "v1", // Optional: "v1", "v2", "variation-mobile", etc.
    parent_artifact_id: null, // FK to self (for variations)

    // Publishing info
    published_by_github_user: "john",
    published_at: 1706304000,
    last_synced_at: 1706404000,

    // GitHub metadata
    github_commit_sha: "def456", // Git commit when published
}
```

### Library Subscriptions Table (What User Pulled)

**Purpose**: Track which library artifacts user pulled locally

```rust
library_subscriptions {
    id: "subscription-uuid",
    workspace_id: "workspace-uuid",
    artifact_id: "artifact-uuid",

    // Local tracking
    project_id: "project-uuid", // FK to projects
    local_resource_id: "api-error-handling-uuid-abc123", // Matches resource YAML id
    local_file_path: ".bluekit/kits/api-error.md", // Current path (can change)

    // Sync status
    local_content_hash: "sha256:abc123...",
    remote_content_hash: "sha256:abc123...",

    pulled_at: 1706304000,
    last_checked_at: 1706404000,
}
```

**Update Detection:**
```rust
if subscription.local_content_hash != subscription.remote_content_hash {
    // Show: "Update available from library"
}
```

---

## Versioning & Variations Flow

### Scenario 1: Simple Update (Overwrite)

```
User publishes kit (v1) → Library
  ↓
User edits locally → Changes content
  ↓
User clicks "Publish"
  ↓
BlueKit detects: library.workspace_id exists
  ↓
Shows dialog:
  ┌─────────────────────────────────────┐
  │ This kit was published before       │
  │                                     │
  │ [●] Update existing (overwrite)     │
  │ [ ] Create variation                │
  │                                     │
  │          [Cancel] [Publish]         │
  └─────────────────────────────────────┘
  ↓
User selects "Update existing"
  ↓
BlueKit:
  - Pushes to same remote_path
  - Updates library.content_hash in YAML
  - Updates library_artifacts.content_hash in DB
  - Creates new GitHub commit
  ↓
Library now has updated version (overwrites v1)
```

### Scenario 2: Create Variation

```
User publishes kit (v1) → Library
  ↓
User creates modified version for mobile
  ↓
User clicks "Publish"
  ↓
BlueKit detects: library.workspace_id exists
  ↓
User selects "Create variation"
  ↓
Shows dialog:
  ┌─────────────────────────────────────┐
  │ Create Variation                    │
  │                                     │
  │ Variation name:                     │
  │ ┌─────────────────────────────────┐ │
  │ │ Mobile Version                  │ │
  │ └─────────────────────────────────┘ │
  │                                     │
  │ This will create a separate copy   │
  │ in the library.                     │
  │                                     │
  │          [Cancel] [Create]          │
  └─────────────────────────────────────┘
  ↓
BlueKit:
  - Generates new remote_path: kits/api-error-handling-mobile.md
  - Publishes to new path
  - Creates NEW artifact in library_artifacts
  - Links to parent: parent_artifact_id = original_artifact_id
  - Does NOT update original resource's YAML
  - Creates NEW resource locally with new ID (or keeps same ID but updates library metadata)
  ↓
Library now has TWO artifacts:
  - api-error-handling.md (original)
  - api-error-handling-mobile.md (variation)
```

**Variation Linking:**
```rust
// Original
library_artifacts {
    id: "artifact-1",
    resource_id: "api-error-abc",
    remote_path: "kits/api-error.md",
    version_label: "v1",
    parent_artifact_id: null,
}

// Variation
library_artifacts {
    id: "artifact-2",
    resource_id: "api-error-mobile-xyz", // Different resource ID
    remote_path: "kits/api-error-mobile.md",
    version_label: "Mobile",
    parent_artifact_id: "artifact-1", // Links to original
}
```

### Scenario 3: Publishing Collection

```
User selects folder: .bluekit/kits/authentication/
  ├── jwt-handling.md
  ├── oauth-flow.md
  └── session-management.md
  ↓
Right-clicks folder → "Publish Collection"
  ↓
Shows dialog:
  ┌─────────────────────────────────────┐
  │ Publish Collection                  │
  │                                     │
  │ Collection: Authentication          │
  │ Resources: 3 kits                   │
  │                                     │
  │ Workspace:                          │
  │ ┌─────────────────────────────────┐ │
  │ │ ACME Team Library       ▼       │ │
  │ └─────────────────────────────────┘ │
  │                                     │
  │ [×] Maintain folder structure       │
  │                                     │
  │          [Cancel] [Publish]         │
  └─────────────────────────────────────┘
  ↓
BlueKit publishes all 3 kits:
  - Preserves folder structure in GitHub
  - Updates each kit's YAML with library metadata
  - Creates 3 library_artifact records
  - Single GitHub commit with all changes
  ↓
GitHub repo structure:
  kits/
    authentication/
      ├── jwt-handling.md
      ├── oauth-flow.md
      └── session-management.md
```

---

## Conflict Resolution Scenarios

### Scenario 1: Local Changed, Remote Unchanged

```
User has kit pulled from library
  ↓
User edits locally
  ↓
library.content_hash in YAML != current file hash
  ↓
Show badge: "Unpublished changes"
  ↓
User can:
  - Publish update (overwrite remote)
  - Discard changes (revert to library version)
  - Keep both (create variation)
```

### Scenario 2: Local Unchanged, Remote Changed

```
Team member updates kit in GitHub
  ↓
User's local version outdated
  ↓
library_subscriptions.remote_content_hash updated (via sync)
  ↓
local_hash != remote_hash
  ↓
Show badge: "Update available"
  ↓
User can:
  - Pull update (overwrite local)
  - Keep local version
  - View diff before deciding
```

### Scenario 3: Both Changed (Conflict)

```
User edits locally
Team member edits in GitHub
Both changed since last sync
  ↓
User clicks "Publish"
  ↓
BlueKit detects: Both local and remote changed
  ↓
Show conflict dialog:
  ┌─────────────────────────────────────┐
  │ Conflict Detected                   │
  │                                     │
  │ This kit changed both locally and   │
  │ in the library since your last sync.│
  │                                     │
  │ Your version:                       │
  │ ┌─────────────────────────────────┐ │
  │ │ Added error boundaries          │ │
  │ └─────────────────────────────────┘ │
  │                                     │
  │ Library version:                    │
  │ ┌─────────────────────────────────┐ │
  │ │ Added retry logic               │ │
  │ └─────────────────────────────────┘ │
  │                                     │
  │ [ ] Overwrite library (lose remote)│
  │ [ ] Keep library (lose local)       │
  │ [●] Create variation                │
  │ [ ] View full diff                  │
  │                                     │
  │          [Cancel] [Resolve]         │
  └─────────────────────────────────────┘
```

**Recommendation**: Default to "Create variation" for conflicts. Simple, safe.

---

## Library Update Mechanism

### Option A: Manual Sync (Recommended for MVP)

**How it works:**
```
User clicks "Sync Library" button
  ↓
For each subscription:
  - Fetch latest content hash from GitHub
  - Compare to local subscription.remote_content_hash
  - If different → Mark as "Update available"
  ↓
Show notification: "2 updates available"
```

**Pros:**
- ✅ User controls when to check
- ✅ No background processes
- ✅ Simple implementation

**Cons:**
- ❌ User might miss updates
- ❌ Requires manual action

### Option B: Periodic Background Polling

**How it works:**
```
Every 30 minutes (configurable):
  ↓
Background task fetches library metadata
  ↓
Compares hashes
  ↓
If updates found:
  - Show notification badge
  - No automatic downloads
```

**Pros:**
- ✅ User sees updates without manual sync
- ✅ Still user-controlled (no auto-updates)

**Cons:**
- ❌ Background process overhead
- ❌ API rate limits

### Option C: Hybrid (Best UX)

**Combine both:**
- Manual "Sync" button always available
- Background check every hour (lightweight)
- Check on app startup (if >1 day since last check)

**Implementation:**
```rust
#[tauri::command]
pub async fn sync_library_workspace(workspace_id: String) -> Result<SyncResult, String> {
    let workspace = get_workspace(&workspace_id).await?;
    let subscriptions = get_subscriptions(&workspace_id).await?;

    let mut updates_available = Vec::new();

    for subscription in subscriptions {
        // Fetch latest hash from GitHub (lightweight API call)
        let remote_hash = get_remote_content_hash(
            &workspace.github_owner,
            &workspace.github_repo,
            &subscription.artifact_remote_path,
        ).await?;

        if remote_hash != subscription.remote_content_hash {
            updates_available.push(UpdateInfo {
                artifact_id: subscription.artifact_id,
                local_hash: subscription.local_content_hash,
                remote_hash,
            });

            // Update subscription record
            update_subscription_remote_hash(subscription.id, remote_hash).await?;
        }
    }

    Ok(SyncResult {
        updates_available,
        last_synced_at: current_timestamp(),
    })
}
```

**UI:**
```
Library Sidebar:
  ┌─────────────────────────────────────┐
  │ Library                  [↻ Sync]   │
  ├─────────────────────────────────────┤
  │ ACME Team Library                   │
  │   Last synced: 5 mins ago      (2)  │ ← Badge shows update count
  │                                     │
  │ Personal Library                    │
  │   Last synced: Never         [Sync] │
  └─────────────────────────────────────┘
```

---

## GitHub Pages (Static Site Hosting)

### What is GitHub Pages?

**GitHub Pages** = Free static website hosting from GitHub repo

**How it works:**
```
Enable in repo settings:
  Settings → Pages → Source: main branch
  ↓
GitHub generates website:
  https://acme-corp.github.io/engineering-patterns/
  ↓
Markdown files auto-render as HTML
  kits/api-error.md → /kits/api-error.html
```

### Use Cases for BlueKit Library

#### Use Case 1: Public Discovery

```
ACME publishes library to GitHub
  ↓
Enables GitHub Pages
  ↓
Website available at:
  https://acme-corp.github.io/engineering-patterns/
  ↓
Non-BlueKit users can:
  - Browse kits as web pages
  - Read walkthroughs
  - Copy code snippets
  ↓
BlueKit users can:
  - Discover via web search
  - Preview before pulling into BlueKit
```

#### Use Case 2: Documentation Site

```
Add custom theme/layout to repo:
  _layouts/default.html (custom template)
  index.md (homepage)
  ↓
GitHub Pages renders beautiful docs site
  ↓
Kits/walkthroughs become searchable documentation
```

#### Use Case 3: Team Portal

```
Team library with GitHub Pages:
  ↓
New hires visit:
  https://acme-corp.github.io/engineering-patterns/
  ↓
Browse company patterns
  ↓
Click "Open in BlueKit" button (custom link)
  ↓
BlueKit app opens, pulls resource
```

**Not Required for BlueKit**, but nice bonus feature!

---

## GitHub API Capabilities for Workspace Creation

### What We Can Configure Programmatically

```rust
#[tauri::command]
pub async fn create_library_workspace(
    name: String,
    workspace_type: String, // "personal" | "team"
    create_new_repo: bool,
    github_repo_name: Option<String>,
) -> Result<LibraryWorkspace, String> {
    let github_token = get_github_token_from_keychain()?;
    let github_client = GitHubClient::new(github_token);

    let repo = if create_new_repo {
        // Create new repo via GitHub API
        github_client.create_repo(CreateRepoOptions {
            name: github_repo_name.unwrap(),
            description: Some(format!("{} - BlueKit Library", name)),
            private: workspace_type == "team", // Team workspaces default to private
            auto_init: true, // Create with README

            // Configure repo settings
            has_issues: true,
            has_projects: false,
            has_wiki: false,

            // Default branch
            default_branch: "main",
        }).await?
    } else {
        // Use existing repo
        github_client.get_repo(/* ... */).await?
    };

    // Configure branch protection (if team workspace)
    if workspace_type == "team" {
        github_client.update_branch_protection(
            &repo.owner,
            &repo.name,
            "main",
            BranchProtectionOptions {
                // Require PR reviews
                required_pull_request_reviews: Some(RequiredReviews {
                    required_approving_review_count: 1,
                    dismiss_stale_reviews: true,
                }),

                // Enforce rules for admins too
                enforce_admins: true,

                // Require status checks (optional)
                required_status_checks: None,

                // Restrict who can push (can't enforce "BlueKit only")
                restrictions: None, // GitHub doesn't support app-based restrictions
            }
        ).await?;
    }

    // Create initial structure
    github_client.create_file(
        &repo.owner,
        &repo.name,
        "README.md",
        &format!("# {}\n\nBlueKit Library workspace", name),
        "Initialize BlueKit Library",
    ).await?;

    github_client.create_file(
        &repo.owner,
        &repo.name,
        ".bluekit-workspace.json",
        &serde_json::to_string(&WorkspaceMetadata {
            created_by: "BlueKit",
            version: "1.0",
            workspace_type,
        })?,
        "Add BlueKit workspace metadata",
    ).await?;

    // Create workspace record in local DB
    let workspace = library_workspaces::ActiveModel {
        id: Set(generate_id()),
        name: Set(name),
        github_owner: Set(repo.owner),
        github_repo: Set(repo.name),
        workspace_type: Set(workspace_type),
        created_at: Set(current_timestamp()),
        updated_at: Set(current_timestamp()),
        ..Default::default()
    };

    let workspace = workspace.insert(db).await?;

    Ok(workspace.into())
}
```

### What We CANNOT Configure

**"BlueKit-only pushes":**
- ❌ GitHub doesn't have app-specific push restrictions
- ❌ Can't prevent direct git pushes from command line
- ✅ Can use commit message conventions: `[BlueKit] Publish: Kit name`
- ✅ Can detect non-BlueKit commits and show warning

**Workaround:**
```
BlueKit commit message format: "[BlueKit] Published by john@acme.com"
  ↓
When syncing, check commits:
  ↓
If commit doesn't match "[BlueKit]" pattern:
  → Show warning: "Library modified outside BlueKit"
  → Show diff
  → User can review changes
```

### Branch Protection Rules (Team Workspaces)

**Can Configure:**
- ✅ Require pull request reviews (1-2 approvers)
- ✅ Dismiss stale reviews on push
- ✅ Require status checks (optional CI)
- ✅ Enforce for admins

**Result:**
```
User publishes to team workspace:
  ↓
BlueKit creates branch: publish-api-error-kit
  ↓
BlueKit commits to branch
  ↓
BlueKit creates PR
  ↓
Team member reviews PR on GitHub
  ↓
Approves → Merges
  ↓
Kit now in library
```

---

## File Watching & Sync Integration

### File Watcher → Resource Tracking

**When file created/modified:**
```
File watcher detects: .bluekit/kits/api-error.md changed
  ↓
Parse YAML front matter
  ↓
Extract: id, library metadata
  ↓
If library.workspace_id exists:
  - Calculate new content hash
  - Compare to library.content_hash
  - If different:
    → Update UI: Show "unpublished changes" badge
    → Store in memory: pending_changes[resource_id] = true
```

**When file moved:**
```
File watcher detects: MOVE
  From: .bluekit/kits/api-error.md
  To: .bluekit/kits/backend/api-error.md
  ↓
Parse YAML in new location
  ↓
Extract ID: api-error-handling-uuid-abc123
  ↓
Check if library.workspace_id exists:
  → Yes: "Published resource moved"
  → Update library_subscriptions.local_file_path in DB
  → No action needed (library metadata stays in YAML)
```

**When file renamed:**
```
File watcher might detect as DELETE + CREATE
  ↓
Handle same as move:
  - ID stays the same (in YAML)
  - Publishing still works
  - Subscription updated
```

**When file deleted:**
```
File watcher detects: DELETE
  ↓
Check if resource was published (check DB for subscription)
  ↓
If published:
  → Show notification: "Published resource deleted locally"
  → Options:
    - [Delete from library too]
    - [Keep in library]
    - [Undo delete]
```

---

## Low-Level Implementation Plan

### Phase 1: Foundation (Week 1)

**Goals:**
- Create workspace
- Link to GitHub repo
- Store in DB

**Tasks:**
- [ ] Create `library_workspaces` table migration
- [ ] Create `library_artifacts` table migration
- [ ] Create `library_subscriptions` table migration
- [ ] Implement `create_workspace` command
  - [ ] GitHub API: create repo (optional)
  - [ ] GitHub API: configure branch protection (team only)
  - [ ] Create initial README
  - [ ] Store workspace in DB
- [ ] UI: "Create Workspace" dialog
- [ ] UI: Workspace list view

**Testing:**
- Create personal workspace → GitHub repo created
- Create team workspace → Branch protection enabled

### Phase 2: Publishing (Week 2)

**Goals:**
- Publish single kit to workspace
- Update resource YAML with metadata
- Track in DB

**Tasks:**
- [ ] Implement resource ID generation (if missing)
- [ ] Implement "Publish" command
  - [ ] Read resource file
  - [ ] Check for existing `library` metadata
  - [ ] If exists: Show [Update] vs [Variation] dialog
  - [ ] Push to GitHub via API
  - [ ] Update resource YAML front matter
  - [ ] Create/update `library_artifacts` record
- [ ] UI: "Publish to Library" context menu
- [ ] UI: Publishing dialog

**Testing:**
- Publish new kit → YAML updated with metadata
- Publish again → Shows update dialog
- Create variation → New artifact created

### Phase 3: Update Detection (Week 3)

**Goals:**
- Detect local changes (unpublished)
- Show badges in UI

**Tasks:**
- [ ] File watcher integration
  - [ ] On change: Calculate hash
  - [ ] Compare to `library.content_hash`
  - [ ] Update UI badge
- [ ] UI: "Unpublished changes" badge
- [ ] UI: Publish button shows in resource card

**Testing:**
- Edit published kit → Badge appears
- Publish update → Badge disappears

### Phase 4: Discovery & Pulling (Week 4)

**Goals:**
- Browse library artifacts
- Pull into local project

**Tasks:**
- [ ] Implement "Fetch workspace artifacts" command
  - [ ] GitHub API: list files
  - [ ] Parse YAML from GitHub
  - [ ] Store in `library_artifacts` table
- [ ] Implement "Pull artifact" command
  - [ ] Download from GitHub
  - [ ] Write to local project
  - [ ] Add `library` metadata to YAML
  - [ ] Create `library_subscriptions` record
- [ ] UI: Library browser view
- [ ] UI: Artifact preview modal
- [ ] UI: "Pull into Project" button

**Testing:**
- Browse workspace → See published kits
- Pull kit → Appears in local project
- Pull same kit twice → Shows warning

### Phase 5: Remote Updates (Week 5)

**Goals:**
- Detect library updates
- Pull updates with diff

**Tasks:**
- [ ] Implement "Sync workspace" command
  - [ ] For each subscription:
    - Fetch remote hash
    - Compare to local
    - Mark as update available
- [ ] Implement "Pull update" command
  - [ ] Fetch new content
  - [ ] Show diff
  - [ ] User approves
  - [ ] Update local file
  - [ ] Update subscription
- [ ] UI: "Updates available" badge
- [ ] UI: Update diff viewer

**Testing:**
- Team member updates kit → User sees badge
- User clicks "View updates" → Sees diff
- User pulls update → Local file updated

### Phase 6: Collections (Week 6)

**Goals:**
- Publish multiple resources at once
- Maintain folder structure

**Tasks:**
- [ ] Implement "Publish collection" command
  - [ ] Select folder
  - [ ] Publish all resources in folder
  - [ ] Preserve folder structure
  - [ ] Single GitHub commit
- [ ] UI: Folder context menu "Publish Collection"
- [ ] UI: Collection publishing progress

**Testing:**
- Publish folder with 5 kits → All published
- GitHub repo has matching folder structure

---

## Simplified Versioning Strategy

### Keep It Simple (MVP)

**Rules:**
1. **Update overwrites** (default)
2. **Variations are separate** (manual)
3. **No linear version numbers** (just variations)

**User Mental Model:**
```
"I have a kit published to the library.

 When I edit and publish again:
   - Default: Update the library version
   - Optional: Create a variation (like a fork)

 Variations are separate kits that share ancestry."
```

**No complex version trees!** Just:
- Original
- Variations (if created)

**Metadata:**
```yaml
library:
  workspace_id: acme-team
  remote_path: kits/api-error.md
  parent_artifact_id: null  # This is the original

  # If variation:
  # parent_artifact_id: artifact-uuid-123
  # variation_label: "Mobile Version"
```

---

## Summary

**Key Decisions:**

1. ✅ **Resource ID = Source of Truth** (not path)
2. ✅ **Library metadata in YAML** (survives moves/renames)
3. ✅ **Manual sync** (user-controlled, simple)
4. ✅ **Variations, not versions** (no linear versioning)
5. ✅ **Collections = folders** (publish multiple at once)
6. ✅ **GitHub Pages = optional bonus** (not required)
7. ✅ **Branch protection for teams** (via GitHub API)
8. ✅ **File watcher integration** (detects local changes)

**Schema Finalized:**
- `library_workspaces` - User's workspaces
- `library_artifacts` - What's in library
- `library_subscriptions` - What user pulled

**Implementation:** 6-week plan, incremental phases

**Next Step:** Start Phase 1 (Foundation) - Create workspace table and basic GitHub integration

---

**Last Updated**: 2025-01-27
**Status**: ✅ **Ready to Implement**
