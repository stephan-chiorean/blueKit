# Storage Architecture Strategy: Repos vs Gists vs Supabase Storage

**Status:** Strategic Decision
**Created:** 2026-01-08
**Context:** Evaluating storage backends for BlueKit workspaces as the product expands to iOS and social sharing

---

## Executive Summary

BlueKit currently uses GitHub repositories as the storage backend for library workspaces. As we expand to iOS apps and social sharing features, we need to evaluate whether repos remain the right choice, or if alternatives like GitHub Gists or Supabase Storage would better serve our users.

**Recommendation:** Implement a **tiered storage model**:
1. **Supabase Storage** as default for casual users (simplest onboarding)
2. **GitHub Gists** as lightweight option for sharers (easy social distribution)
3. **GitHub Repos** as power-user option (full git workflow)

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Product Vision & Constraints](#2-product-vision--constraints)
3. [Storage Options Deep Dive](#3-storage-options-deep-dive)
4. [Comparison Matrix](#4-comparison-matrix)
5. [Use Case Analysis](#5-use-case-analysis)
6. [Recommended Architecture](#6-recommended-architecture)
7. [Implementation Strategy](#7-implementation-strategy)
8. [Migration Considerations](#8-migration-considerations)
9. [Security & Access Control](#9-security--access-control)
10. [Cost Analysis](#10-cost-analysis)
11. [Best Practices](#11-best-practices)
12. [Decision Framework](#12-decision-framework)
13. [Risks & Mitigations](#13-risks--mitigations)

---

## 1. Current State

### How Workspaces Work Today

```
┌─────────────────────────────────────────────────────────────┐
│                    Current Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SQLite (Local)              GitHub (Remote)                │
│  ├─ library_workspaces       ├─ owner/repo-name             │
│  │   ├─ id                   │   ├─ kit-1.md                │
│  │   ├─ name                 │   ├─ kit-2.md                │
│  │   ├─ github_owner         │   └─ walkthrough-1.md        │
│  │   └─ github_repo          │                              │
│  │                           │                              │
│  └─ library_collections      │  (Flat structure)            │
│      └─ (DB entities only)   │                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key observations:**
- Repos are used in a **flat structure** (no nested directories)
- Collections are **database entities**, not file system folders
- GitHub is essentially a "dumb file store" with version history
- Requires `repo` OAuth scope (broad permissions)

### Pain Points

1. **Heavy onboarding** - Creating a repo feels like a big commitment
2. **Broad permissions** - `repo` scope is scary for users
3. **Two auth systems** - GitHub OAuth + (future) Supabase Auth
4. **Overkill for casual users** - Most don't need branches/PRs

---

## 2. Product Vision & Constraints

### Upcoming Features

1. **iOS App**
   - Sign in with BlueKit account (Supabase Auth)
   - Browse and pull kits from library
   - No GitHub app needed on mobile

2. **Social Sharing (Threads)**
   - Share workspace link on social media
   - One-click join for recipients
   - Viral growth potential

3. **Supabase as Identity Layer**
   - Centralized user accounts
   - Workspace membership in Supabase
   - Access control independent of GitHub

### Architectural Shift

```
Before: GitHub = Identity + Storage + Access Control
After:  Supabase = Identity + Access Control
        [Storage Backend] = Just file storage (interchangeable)
```

This decoupling means the storage backend becomes a **pluggable implementation detail**.

---

## 3. Storage Options Deep Dive

### Option A: GitHub Repositories (Current)

**How it works:**
- Each workspace = one GitHub repo
- Files stored at repo root (flat)
- GitHub API for read/write operations
- Version history via git commits

**Technical details:**
```typescript
// Current workspace creation
const workspace = {
  id: 'uuid',
  name: 'My Components',
  github_owner: 'alice',
  github_repo: 'my-components-library'
};

// File operations via GitHub API
await octokit.repos.createOrUpdateFileContents({
  owner: 'alice',
  repo: 'my-components-library',
  path: 'button-kit.md',
  message: 'Add button kit',
  content: base64Encode(kitContent)
});
```

**Pros:**
- Full git version history
- Branching and PRs available
- Users own their data
- Free unlimited storage
- Familiar to developers
- Can use git CLI directly

**Cons:**
- Requires `repo` scope (access to ALL repos)
- Heavy for simple use cases
- Complex API (rate limits, pagination)
- Slow for bulk operations
- Not mobile-friendly (no GitHub app needed ideally)

---

### Option B: GitHub Gists

**How it works:**
- Each workspace = one gist
- Multiple files per gist (flat structure)
- Simpler API than repos
- Public or secret (unlisted) visibility

**Technical details:**
```typescript
// Gist-backed workspace
const workspace = {
  id: 'uuid',
  name: 'My Components',
  gist_id: 'abc123def456'
};

// File operations via Gist API
await octokit.gists.update({
  gist_id: 'abc123def456',
  files: {
    'button-kit.md': { content: kitContent },
    'card-kit.md': { content: cardContent }
  }
});
```

**Pros:**
- Simpler API (one endpoint vs many)
- Narrower OAuth scope (`gist` only)
- Lighter weight than repos
- Easy to share (gist URLs)
- Version history (revisions)
- Can be secret (unlisted but accessible)

**Cons:**
- ~300 file limit per gist
- No directories (flat only - but we use flat anyway)
- No branching/PRs
- No collaborators (owner only)
- Less discoverable than repos

---

### Option C: Supabase Storage

**How it works:**
- Files stored in S3-compatible bucket
- Organized by workspace_id paths
- Access controlled via RLS policies
- No GitHub dependency

**Technical details:**
```typescript
// Supabase Storage workspace
const workspace = {
  id: 'uuid',
  name: 'My Components',
  storage_type: 'supabase',
  storage_path: 'workspaces/uuid'  // bucket path
};

// File operations via Supabase SDK
await supabase.storage
  .from('workspaces')
  .upload(`${workspaceId}/button-kit.md`, kitContent, {
    contentType: 'text/markdown',
    upsert: true
  });

// Reading files
const { data } = await supabase.storage
  .from('workspaces')
  .download(`${workspaceId}/button-kit.md`);
```

**Pros:**
- Single auth system (Supabase only)
- Simplest onboarding (no GitHub needed)
- Full access control via RLS
- Works perfectly with iOS app
- No rate limits from GitHub
- Cheapest at scale

**Cons:**
- No git version history
- BlueKit owns the data (not user)
- Monthly storage/bandwidth costs
- No git CLI workflow
- Vendor lock-in to Supabase

---

### Option D: Hybrid (User's Choice)

**How it works:**
- User chooses storage backend per workspace
- Supabase Storage as default
- GitHub (repo/gist) as upgrade option
- Unified API abstracts the difference

**Technical details:**
```typescript
// Workspace with storage type
interface Workspace {
  id: string;
  name: string;
  storage_type: 'supabase' | 'gist' | 'repo';

  // Supabase Storage
  storage_path?: string;

  // GitHub Gist
  gist_id?: string;

  // GitHub Repo
  github_owner?: string;
  github_repo?: string;
}

// Unified storage interface
interface StorageBackend {
  listFiles(workspaceId: string): Promise<FileInfo[]>;
  readFile(workspaceId: string, path: string): Promise<string>;
  writeFile(workspaceId: string, path: string, content: string): Promise<void>;
  deleteFile(workspaceId: string, path: string): Promise<void>;
}

// Implementation per backend
class SupabaseStorage implements StorageBackend { ... }
class GistStorage implements StorageBackend { ... }
class RepoStorage implements StorageBackend { ... }
```

---

## 4. Comparison Matrix

| Feature | GitHub Repos | GitHub Gists | Supabase Storage |
|---------|--------------|--------------|------------------|
| **Auth Required** | GitHub OAuth (`repo`) | GitHub OAuth (`gist`) | Supabase Auth only |
| **Permission Scope** | All user repos | Gists only | BlueKit only |
| **File Limit** | Unlimited | ~300 per gist | Unlimited |
| **Directory Structure** | Full | Flat only | Full |
| **Version History** | Full git | Revisions | Manual |
| **Branching** | Yes | No | No |
| **Collaborators** | Yes (native) | No | Yes (via Supabase) |
| **User Owns Data** | Yes | Yes | No (BlueKit owns) |
| **Offline Git Access** | Yes | Yes | No |
| **iOS App Simplicity** | Complex | Moderate | Simple |
| **Social Share URL** | Repo URL | Gist URL | BlueKit URL |
| **Rate Limits** | 5000/hr | 5000/hr | Generous |
| **Cost** | Free | Free | ~$0.02/GB |
| **Onboarding Friction** | High | Medium | Low |

---

## 5. Use Case Analysis

### Use Case 1: Personal Library (Power User)

**Profile:** Developer who wants full git workflow, version control, and data ownership.

**Best option:** GitHub Repository

**Reasoning:**
- Wants to use git CLI
- May want branches for experiments
- Values owning their data
- Comfortable with GitHub OAuth
- Already has GitHub account

**User journey:**
```
1. Create workspace → "Link GitHub repo"
2. Authorize repo access
3. Select existing repo OR create new
4. Full git workflow available
```

---

### Use Case 2: Casual Collector

**Profile:** Designer/PM who saves useful kits, doesn't care about git.

**Best option:** Supabase Storage

**Reasoning:**
- Doesn't use git
- Just wants to save and access kits
- Wants simple onboarding
- Will use iOS app
- Doesn't care about data portability

**User journey:**
```
1. Sign up with email
2. Start saving kits immediately
3. No GitHub setup required
```

---

### Use Case 3: Social Sharer

**Profile:** Developer who shares curated kit collections on Threads/Twitter.

**Best option:** GitHub Gist or Supabase Storage

**Reasoning:**
- Wants easy shareable URLs
- Doesn't need collaboration
- Wants quick setup
- Recipients shouldn't need GitHub

**User journey:**
```
1. Create workspace
2. Add curated kits
3. Generate share link: bluekit.dev/w/abc123
4. Share on Threads
5. Recipients click → sign in → workspace added
```

---

### Use Case 4: Team Workspace

**Profile:** Engineering team sharing patterns and standards.

**Best option:** GitHub Repository (with Supabase access control)

**Reasoning:**
- Want code review (PRs)
- Need collaboration
- Value version history
- Already use GitHub

**User journey:**
```
1. Create workspace → Link team repo
2. Invite team members (via Supabase)
3. Team members access repo through BlueKit
4. PRs for quality control
```

---

### Use Case 5: Conference Speaker

**Profile:** Shares workshop materials, wants attendees to access easily.

**Best option:** Supabase Storage or Gist

**Reasoning:**
- Attendees shouldn't need GitHub
- One-click access essential
- Read-only for attendees
- Time-limited access OK

**User journey:**
```
1. Create workspace with materials
2. Generate public link
3. Share QR code at conference
4. Attendees scan → instant access
```

---

## 6. Recommended Architecture

### Tiered Storage Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     BlueKit Storage Tiers                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tier 1: Supabase Storage (Default)                             │
│  ├─ Zero GitHub setup                                           │
│  ├─ Best for: Casual users, iOS, social sharing                 │
│  ├─ Limitations: No git workflow, BlueKit owns data             │
│  └─ When to use: 80% of users                                   │
│                                                                  │
│  Tier 2: GitHub Gist (Lightweight Git)                          │
│  ├─ Narrow OAuth scope                                          │
│  ├─ Best for: Developers who want git but not full repos        │
│  ├─ Limitations: 300 file limit, no collaboration               │
│  └─ When to use: 15% of users                                   │
│                                                                  │
│  Tier 3: GitHub Repository (Full Git)                           │
│  ├─ Full git workflow                                           │
│  ├─ Best for: Power users, teams with existing repos            │
│  ├─ Limitations: Complex setup, broad OAuth scope               │
│  └─ When to use: 5% of users                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Devices                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Desktop App │  │   iOS App   │  │  Web App    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (Central)                          │
├─────────────────────────────────────────────────────────────────┤
│  Auth              │  Database           │  Storage             │
│  ├─ User identity  │  ├─ workspaces      │  (Tier 1 files)      │
│  ├─ Sessions       │  ├─ collections     │  ├─ /workspaces/     │
│  └─ GitHub OAuth   │  ├─ catalogs        │  │   └─ {id}/        │
│     (for T2/T3)    │  └─ memberships     │  │       └─ *.md     │
└─────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Supabase      │ │  GitHub Gist    │ │  GitHub Repo    │
│   Storage       │ │  (Tier 2)       │ │  (Tier 3)       │
│   (Tier 1)      │ │                 │ │                 │
│   Default       │ │  Lightweight    │ │  Full Git       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Unified Storage Interface (Rust)

```rust
// src-tauri/src/storage/mod.rs

pub trait StorageBackend: Send + Sync {
    async fn list_files(&self, workspace_id: &str) -> Result<Vec<FileInfo>, StorageError>;
    async fn read_file(&self, workspace_id: &str, path: &str) -> Result<String, StorageError>;
    async fn write_file(&self, workspace_id: &str, path: &str, content: &str) -> Result<(), StorageError>;
    async fn delete_file(&self, workspace_id: &str, path: &str) -> Result<(), StorageError>;
    async fn get_file_history(&self, workspace_id: &str, path: &str) -> Result<Vec<FileVersion>, StorageError>;
}

pub struct SupabaseStorage {
    client: SupabaseClient,
    bucket: String,
}

pub struct GistStorage {
    client: Octocrab,
}

pub struct RepoStorage {
    client: Octocrab,
}

// Factory pattern
pub fn create_storage_backend(workspace: &Workspace) -> Box<dyn StorageBackend> {
    match workspace.storage_type.as_str() {
        "supabase" => Box::new(SupabaseStorage::new(&workspace.storage_path)),
        "gist" => Box::new(GistStorage::new(&workspace.gist_id)),
        "repo" => Box::new(RepoStorage::new(&workspace.github_owner, &workspace.github_repo)),
        _ => Box::new(SupabaseStorage::new(&workspace.storage_path)), // default
    }
}
```

---

## 7. Implementation Strategy

### Phase 1: Add Supabase Storage (Default)

**Goal:** New users get Supabase Storage by default, simplest onboarding.

**Tasks:**
1. Set up Supabase Storage bucket with RLS
2. Implement `SupabaseStorage` backend
3. Update workspace creation flow
4. Update iOS app to use Supabase-only flow
5. Migrate `storage_type` column to workspaces table

**Database changes:**
```sql
-- Add storage fields to workspaces
ALTER TABLE workspaces ADD COLUMN storage_type TEXT DEFAULT 'supabase';
ALTER TABLE workspaces ADD COLUMN storage_path TEXT;
ALTER TABLE workspaces ADD COLUMN gist_id TEXT;

-- Keep existing github_owner/github_repo for repo type

-- RLS for Supabase Storage bucket
CREATE POLICY "Users can access their workspace files"
ON storage.objects FOR ALL USING (
  bucket_id = 'workspaces' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces w
    JOIN user_workspaces uw ON uw.workspace_id = w.id
    WHERE uw.user_id = auth.uid()
  )
);
```

---

### Phase 2: Add Gist Support

**Goal:** Users who want git but not full repos can use gists.

**Tasks:**
1. Implement `GistStorage` backend
2. Add "Link GitHub Gist" option in workspace creation
3. Handle gist OAuth scope (`gist` not `repo`)
4. Support gist revisions for version history

**UI Flow:**
```
Create Workspace
├─ Quick Start (Supabase) ← Default
├─ Link GitHub Gist
└─ Link GitHub Repository
```

---

### Phase 3: Refactor Repo Support

**Goal:** Clean up existing repo code to use unified interface.

**Tasks:**
1. Migrate existing `RepoStorage` to new interface
2. Update all file operations to use factory
3. Add storage type indicator in UI
4. Implement "Export to GitHub" for Supabase workspaces

---

### Phase 4: Cross-Backend Features

**Goal:** Seamless experience regardless of backend.

**Tasks:**
1. Unified version history view (git commits OR Supabase versions)
2. "Change storage backend" migration tool
3. Backup/export for all backend types
4. Sync status indicators per backend

---

## 8. Migration Considerations

### Existing Users (Repo → Keep Repo)

**No forced migration.** Existing workspaces keep their repos.

```typescript
// Migration for existing workspaces
async function migrateExistingWorkspaces() {
  const workspaces = await db.workspaces.findMany({
    where: { storage_type: null }
  });

  for (const ws of workspaces) {
    if (ws.github_owner && ws.github_repo) {
      await db.workspaces.update({
        where: { id: ws.id },
        data: { storage_type: 'repo' }
      });
    }
  }
}
```

### Optional Migration Paths

**Repo → Supabase:**
```
1. User clicks "Migrate to BlueKit Storage"
2. Download all files from repo
3. Upload to Supabase Storage
4. Update workspace record
5. Optionally archive repo
```

**Supabase → Repo:**
```
1. User clicks "Export to GitHub"
2. Create/select target repo
3. Upload all files to repo
4. Update workspace record
5. Keep Supabase as backup (optional)
```

**Gist ↔ Anything:**
- Similar process, gists have 300 file limit check

---

## 9. Security & Access Control

### Auth Flow by Storage Type

**Supabase Storage:**
```
User → Supabase Auth → RLS Policy → Storage Access
        (email/OAuth)   (workspace membership check)
```

**GitHub Gist:**
```
User → Supabase Auth → GitHub OAuth → Gist API
        (identity)      (gist scope)   (user's gists only)
```

**GitHub Repo:**
```
User → Supabase Auth → GitHub OAuth → Repo API
        (identity)      (repo scope)   (accessible repos)
```

### Permission Comparison

| Scenario | Supabase | Gist | Repo |
|----------|----------|------|------|
| User owns data | BlueKit | User | User |
| Can revoke access | Yes (RLS) | N/A (owner only) | Yes (GitHub) |
| Audit trail | Supabase logs | Gist revisions | Git commits |
| Data portability | Export needed | Clone gist | Clone repo |
| Account deletion | Files deleted | User keeps gist | User keeps repo |

### Workspace Sharing (All Types)

```
Supabase handles workspace membership regardless of storage:

workspace_members
├─ workspace_id (FK → workspaces)
├─ user_id (FK → users)
├─ role (owner | admin | member | viewer)
└─ invited_at

RLS ensures only members can access files.
Storage backend just stores bytes.
```

---

## 10. Cost Analysis

### Per-User Cost Comparison

**Assumptions:**
- Average workspace: 50 kits × 10KB = 500KB
- Average user: 2 workspaces = 1MB
- 10,000 users = 10GB total

| Backend | Storage Cost | Bandwidth Cost | Total Monthly |
|---------|--------------|----------------|---------------|
| GitHub (Repo/Gist) | $0 | $0 | $0 |
| Supabase Storage | $0.021/GB × 10GB = $0.21 | $0.09/GB × 50GB = $4.50 | ~$5 |

**At 100,000 users (100GB storage, 500GB bandwidth):**
- GitHub: $0
- Supabase: ~$50/month

**Verdict:** Supabase Storage is extremely cheap, GitHub is free but has hidden costs (API rate limits, complexity).

### Hidden Costs of GitHub

1. **Rate limit handling** - Need caching, retry logic
2. **Token management** - Refresh tokens, handle expiry
3. **API complexity** - Pagination, error handling
4. **User support** - "Why do I need repo access?"

### Break-Even Analysis

Supabase costs are negligible until 1M+ users. Developer time saved on GitHub complexity likely exceeds storage costs.

---

## 11. Best Practices

### For Users

**Choose Supabase Storage when:**
- You're new to BlueKit
- You'll primarily use iOS app
- You don't need git workflow
- You want simplest setup

**Choose GitHub Gist when:**
- You want git version history
- You don't need 300+ files per workspace
- You prefer narrower OAuth scope than repo
- You want to share via gist URL

**Choose GitHub Repo when:**
- You need branching/PRs
- You have an existing repo to link
- Your team already uses GitHub for everything
- You want full git CLI access

### For BlueKit Development

**Storage abstraction principles:**

1. **Never leak storage type** - UI should work identically regardless of backend
2. **Graceful degradation** - If GitHub is down, cached data still works
3. **Version history abstraction** - Show unified history view
4. **Migration path** - Always allow users to change storage type

**Error handling:**

```rust
// Always handle backend-specific errors gracefully
match storage.read_file(workspace_id, path).await {
    Ok(content) => Ok(content),
    Err(StorageError::NotFound) => Err("File not found".into()),
    Err(StorageError::RateLimited) => {
        // Retry with backoff for GitHub
        tokio::time::sleep(Duration::from_secs(60)).await;
        storage.read_file(workspace_id, path).await
    },
    Err(StorageError::Unauthorized) => {
        // Trigger re-auth flow
        Err("Please reconnect your GitHub account".into())
    },
    Err(e) => Err(format!("Storage error: {}", e)),
}
```

### For Social Sharing

**URL structure:**
```
bluekit.dev/w/{workspace_id}        → Direct workspace access
bluekit.dev/w/{workspace_id}/{kit}  → Direct kit access
```

**Share flow:**
```
1. User clicks "Share Workspace"
2. Copy link: bluekit.dev/w/abc123
3. Recipient clicks link
4. If signed in → workspace added to their library
5. If not signed in → preview mode, prompt to sign up
```

---

## 12. Decision Framework

### When to Choose Each Option

```
                           ┌─────────────────────┐
                           │   New Workspace?    │
                           └──────────┬──────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              Need Git?          Casual use?       Team collab?
                    │                 │                 │
              ┌─────┴─────┐          │           ┌─────┴─────┐
              │           │          │           │           │
        Full workflow?  Simple?      │      Existing repo?   │
              │           │          │           │           │
              ▼           ▼          ▼           ▼           │
           ┌─────┐    ┌─────┐   ┌─────────┐  ┌─────┐        │
           │Repo │    │Gist │   │Supabase │  │Repo │        │
           └─────┘    └─────┘   │Storage  │  └─────┘        │
                                └─────────┘                  │
                                     ▲                       │
                                     │                       │
                                     └───────────────────────┘
                                         (Default choice)
```

### Migration Triggers

**Supabase → Gist:**
- User connects GitHub account
- User requests version history
- User wants git-based backup

**Supabase → Repo:**
- User wants PRs for quality control
- Team needs code review workflow
- User has existing repo with kits

**Gist → Repo:**
- Workspace exceeds 300 files
- User needs branching
- Team collaboration required

**Any → Supabase:**
- User deletes GitHub account
- User wants simpler management
- Privacy concerns with GitHub

---

## 13. Risks & Mitigations

### Risk: Data Loss During Migration

**Mitigation:**
- Always keep source data until migration verified
- Implement checksum validation
- Provide "undo migration" for 30 days

### Risk: GitHub API Changes

**Mitigation:**
- Storage abstraction isolates changes
- Supabase as fallback always available
- Monitor GitHub API deprecation notices

### Risk: Supabase Outages

**Mitigation:**
- Local SQLite cache for offline access
- Pending changes queue
- Git-backed workspaces unaffected

### Risk: User Confusion (Too Many Options)

**Mitigation:**
- Default to Supabase (simplest)
- Hide advanced options behind "Power User" toggle
- Clear documentation for each option

### Risk: Feature Parity Across Backends

**Mitigation:**
- Define minimum feature set all backends must support
- Document backend-specific features clearly
- UI adapts to show available features

---

## Summary

### Key Decisions

1. **Default to Supabase Storage** for new users
   - Simplest onboarding
   - Best for iOS app
   - Enables social sharing without GitHub

2. **Offer GitHub Gist** as lightweight git option
   - Narrower OAuth scope
   - Version history without full repos
   - Good for individual sharers

3. **Keep GitHub Repo** for power users
   - Full git workflow
   - Team collaboration with PRs
   - Existing repos can be linked

4. **Unified storage interface** abstracts all backends
   - UI works identically
   - Easy to add new backends later
   - Migration between backends supported

### Success Metrics

- **Onboarding completion rate** increases (Supabase simpler than repo setup)
- **iOS app adoption** (no GitHub dependency)
- **Social share click-through** (recipients don't need GitHub)
- **Power user retention** (git workflow preserved for those who want it)

### Next Steps

1. Implement Supabase Storage bucket and RLS
2. Create unified storage interface
3. Add storage type selection in workspace creation
4. Update iOS app to use Supabase-only flow
5. Document migration paths between backends
