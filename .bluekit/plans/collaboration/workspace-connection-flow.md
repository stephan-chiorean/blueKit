# Workspace Connection Flow

## Overview

Enable users to connect to any GitHub repository as a read-only workspace in their library. This allows browsing and pulling kits from repositories they don't own, enabling collaboration and sharing of reusable patterns.

## Core Concept

**Current behavior:** Create Workspace = creates a new GitHub repo you own
**New behavior:** Connect to Workspace = reference any existing repo (read-only access)

---

## Architecture: SQLite + Supabase Hybrid

### Why Hybrid?

- **Collections need to be shared** - If Alice creates collections in her workspace, Bob should see them when he connects
- **Syncing SQLite ↔ GitHub is messy** - Error-prone, conflict resolution nightmare
- **Supabase is cheap** - Free tier for beta, $25/month covers significant scale

### Data Separation

```
┌─────────────────────────────────────────────────────────────────┐
│                         SQLite (Local)                          │
├─────────────────────────────────────────────────────────────────┤
│ • Projects (folders on your machine)                            │
│ • Local resources (files in .bluekit/)                          │
│ • App settings/preferences                                      │
│ • Cache/offline data                                            │
│ • Anything that doesn't need to be shared                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       Supabase (Cloud)                          │
├─────────────────────────────────────────────────────────────────┤
│ • Workspaces (shared repos)                                     │
│ • Collections (shared organization)                             │
│ • Catalog metadata (synced from GitHub)                         │
│ • Variations (versions of catalogs)                             │
│ • Subscriptions (who pulled what)                               │
│ • User identity (via Supabase Auth + GitHub OAuth)              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        GitHub (Files)                           │
├─────────────────────────────────────────────────────────────────┤
│ • Actual kit content (markdown files)                           │
│ • Version history (git commits)                                 │
│ • Source of truth for file contents                             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Local Project (.bluekit/)
       │
       │ publish
       ▼
Supabase (catalog metadata) ←──sync──→ GitHub (actual files)
       │
       │ pull
       ▼
Another user's Local Project
```

---

## Supabase Schema

### Tables

```sql
-- Users (managed by Supabase Auth, linked to GitHub)
-- Uses built-in auth.users table

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id), -- NULL for connected (not owned)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(github_owner, github_repo)
);

-- User's connected workspaces (many-to-many)
CREATE TABLE user_workspaces (
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID REFERENCES workspaces(id),
  pinned BOOLEAN DEFAULT FALSE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id)
);

-- Catalogs (kit metadata, synced from GitHub)
CREATE TABLE catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL, -- 'kit', 'walkthrough', 'agent', 'diagram'
  remote_path TEXT NOT NULL, -- path in GitHub repo
  tags JSONB DEFAULT '[]',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, remote_path)
);

-- Variations (versions of catalogs)
CREATE TABLE variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID REFERENCES catalogs(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  github_commit_sha TEXT,
  version_tag TEXT,
  publisher_id UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections (shared organization within workspace)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]',
  color TEXT,
  order_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection membership (many-to-many)
CREATE TABLE collection_catalogs (
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES catalogs(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  PRIMARY KEY (collection_id, catalog_id)
);

-- Subscriptions (tracks what users have pulled)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  catalog_id UUID REFERENCES catalogs(id),
  variation_id UUID REFERENCES variations(id),
  pulled_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  UNIQUE(user_id, catalog_id)
);
```

### Row Level Security (RLS)

```sql
-- Workspaces: anyone can read, only owner can update
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspaces are viewable by everyone"
  ON workspaces FOR SELECT USING (true);

CREATE POLICY "Workspaces are editable by owner"
  ON workspaces FOR UPDATE USING (auth.uid() = owner_id);

-- Collections: anyone can read workspace collections, only workspace owner can modify
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collections are viewable by everyone"
  ON collections FOR SELECT USING (true);

CREATE POLICY "Collections are editable by workspace owner"
  ON collections FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- User workspaces: users can only see/modify their own connections
ALTER TABLE user_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workspace connections"
  ON user_workspaces FOR ALL USING (auth.uid() = user_id);
```

### Supabase Cost Estimate

| Tier | Price | Storage | Bandwidth | Notes |
|------|-------|---------|-----------|-------|
| Free | $0 | 500 MB | 2 GB | Pauses after 1 week inactivity |
| Pro | $25/mo | 8 GB | 250 GB | No pause, daily backups |

**BlueKit estimate:**
- 1,000 users × 5 workspaces × 10 collections × 50 catalogs ≈ 2.5M rows
- ~1KB per row average = ~2.5 GB storage
- Fits comfortably in Pro tier

---

## Implementation Plan

### Phase 0: Supabase Setup

**Create Supabase project:**
1. Create project at supabase.com
2. Enable GitHub OAuth in Auth settings
3. Run schema migrations (tables above)
4. Configure RLS policies
5. Generate TypeScript types from schema

**Add Supabase client to frontend:**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types' // generated

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**Environment variables:**
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

### Phase 1: Authentication Migration

**Current:** GitHub OAuth token stored in keychain (Rust-side)
**New:** Supabase Auth with GitHub provider (handles OAuth flow)

```typescript
// Sign in with GitHub
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    scopes: 'repo read:user',
  }
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Get GitHub token for API calls
const { data: { session } } = await supabase.auth.getSession()
const githubToken = session?.provider_token
```

**Backward compatibility:**
- Keep keychain storage as fallback
- Migrate existing users on next login
- GitHub token still needed for file operations

---

### Phase 2: Workspace Migration to Supabase

**Move workspace data from SQLite to Supabase:**

```typescript
// src/lib/workspaces.ts

export async function createWorkspace(name: string, githubOwner: string, githubRepo: string) {
  const { data: { user } } = await supabase.auth.getUser()

  // Create workspace in Supabase
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({
      name,
      github_owner: githubOwner,
      github_repo: githubRepo,
      owner_id: user.id
    })
    .select()
    .single()

  if (error) throw error

  // Auto-connect creator to their workspace
  await supabase
    .from('user_workspaces')
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      pinned: false
    })

  // Still create GitHub repo via Rust backend
  await invoke('create_github_repo', { githubRepo, description: `BlueKit: ${name}` })

  return workspace
}

export async function connectWorkspace(githubOwner: string, githubRepo: string) {
  const { data: { user } } = await supabase.auth.getUser()

  // Check if workspace exists in Supabase
  let { data: workspace } = await supabase
    .from('workspaces')
    .select()
    .eq('github_owner', githubOwner)
    .eq('github_repo', githubRepo)
    .single()

  // If not, create it (without owner - it's someone else's)
  if (!workspace) {
    // Verify repo exists via GitHub API first
    await invoke('verify_github_repo', { githubOwner, githubRepo })

    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: githubRepo, // default name
        github_owner: githubOwner,
        github_repo: githubRepo,
        owner_id: null // not owned by connector
      })
      .select()
      .single()

    if (error) throw error
    workspace = data
  }

  // Connect user to workspace
  await supabase
    .from('user_workspaces')
    .insert({
      user_id: user.id,
      workspace_id: workspace.id
    })

  return workspace
}

export async function listMyWorkspaces() {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('user_workspaces')
    .select(`
      pinned,
      connected_at,
      workspace:workspaces(*)
    `)
    .eq('user_id', user.id)

  if (error) throw error
  return data
}
```

---

### Phase 3: Collections in Supabase

**Move collections from SQLite to Supabase:**

```typescript
// src/lib/collections.ts

export async function createCollection(workspaceId: string, name: string, description?: string) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('collections')
    .insert({
      workspace_id: workspaceId,
      name,
      description,
      created_by: user.id
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getWorkspaceCollections(workspaceId: string) {
  const { data, error } = await supabase
    .from('collections')
    .select(`
      *,
      catalogs:collection_catalogs(
        catalog:catalogs(*)
      )
    `)
    .eq('workspace_id', workspaceId)
    .order('order_index')

  if (error) throw error
  return data
}
```

**Key benefit:** When Bob connects to Alice's workspace, he sees Alice's collections automatically.

---

### Phase 4: Catalog Sync

**Sync catalog metadata from GitHub to Supabase:**

```typescript
export async function syncWorkspaceCatalogs(workspaceId: string) {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select()
    .eq('id', workspaceId)
    .single()

  // Fetch .bluekit/ contents from GitHub (via Rust backend)
  const files = await invoke('scan_github_bluekit', {
    owner: workspace.github_owner,
    repo: workspace.github_repo
  })

  // Upsert catalogs in Supabase
  for (const file of files) {
    await supabase
      .from('catalogs')
      .upsert({
        workspace_id: workspaceId,
        name: file.name,
        artifact_type: file.type,
        remote_path: file.path,
        tags: file.tags,
        description: file.description
      }, {
        onConflict: 'workspace_id,remote_path'
      })
  }
}
```

---

### Phase 5: Backend Adjustments (Rust)

**Keep in Rust (file operations):**
- `create_github_repo` - create new repos
- `verify_github_repo` - check repo exists
- `scan_github_bluekit` - scan repo for .bluekit files
- `fetch_file_content` - get raw file from GitHub
- `publish_file` - push file to GitHub
- Local file operations (read/write .bluekit in projects)

**Remove from Rust (move to Supabase):**
- Workspace CRUD → Supabase
- Collection CRUD → Supabase
- Catalog metadata → Supabase
- Subscription tracking → Supabase

**Update commands.rs:**
```rust
// Remove these (now in Supabase):
// - create_workspace
// - list_workspaces
// - delete_workspace
// - create_collection
// - list_collections

// Keep these (file operations):
#[tauri::command]
pub async fn create_github_repo(repo: String, description: String) -> Result<(), String> { ... }

#[tauri::command]
pub async fn verify_github_repo(owner: String, repo: String) -> Result<bool, String> { ... }

#[tauri::command]
pub async fn scan_github_bluekit(owner: String, repo: String) -> Result<Vec<CatalogFile>, String> { ... }

#[tauri::command]
pub async fn fetch_github_file(owner: String, repo: String, path: String) -> Result<String, String> { ... }

#[tauri::command]
pub async fn publish_to_github(owner: String, repo: String, path: String, content: String) -> Result<(), String> { ... }
```

---

### Phase 6: SQLite Cleanup

**Keep in SQLite:**

```sql
-- Projects (local folders)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at INTEGER,
  updated_at INTEGER
);

-- Local resources (files in .bluekit/)
CREATE TABLE local_resources (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  relative_path TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  content_hash TEXT,
  yaml_metadata TEXT, -- JSON
  created_at INTEGER,
  updated_at INTEGER
);

-- App settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Cache (optional, for offline)
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value TEXT,
  expires_at INTEGER
);
```

**Remove from SQLite:**
- `library_workspaces` → Supabase
- `library_collections` → Supabase
- `library_catalogs` → Supabase
- `library_variations` → Supabase
- `library_subscriptions` → Supabase

---

### Phase 7: Frontend UI Updates

**Connect to Workspace flow:**

```
┌─────────────────────────────────────────┐
│ Add Workspace                           │
├─────────────────────────────────────────┤
│ ○ Create new repository                 │
│ ● Connect to existing repository        │
├─────────────────────────────────────────┤
│ Owner/Repo: [alice/cool-kits          ] │
│                                         │
│              [Cancel]  [Connect]        │
└─────────────────────────────────────────┘
```

**Workspace list with ownership indicators:**

```
┌─────────────────────────────────────────┐
│ 📁 My Patterns         you/patterns     │  ← owned (can publish)
│ 🔗 Alice's Components  alice/comps      │  ← connected (read-only)
│ 🔗 Design System       acme/design      │  ← connected (read-only)
└─────────────────────────────────────────┘
```

**Shared collections visible:**

When viewing Alice's workspace, Bob sees:
- Alice's collections (created by workspace owner)
- All catalogs Alice has published
- Can pull any kit to his local projects

---

## Migration Strategy

### For Existing Users

1. **On app update:**
   - Detect existing SQLite library data
   - Prompt: "Sign in with GitHub to sync your library"

2. **On sign in:**
   - Create Supabase user (linked to GitHub)
   - Migrate workspaces: SQLite → Supabase
   - Migrate collections: SQLite → Supabase
   - Keep local projects in SQLite (no change)

3. **Post-migration:**
   - SQLite library tables can be dropped
   - Or kept as offline cache

### Migration Script

```typescript
async function migrateToSupabase() {
  // 1. Get existing data from SQLite (via Rust)
  const sqliteWorkspaces = await invoke('get_sqlite_workspaces')
  const sqliteCollections = await invoke('get_sqlite_collections')

  // 2. Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // 3. Migrate workspaces
  for (const ws of sqliteWorkspaces) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .upsert({
        name: ws.name,
        github_owner: ws.github_owner,
        github_repo: ws.github_repo,
        owner_id: user.id // assume owned since it was in their SQLite
      })
      .select()
      .single()

    // Connect user
    await supabase
      .from('user_workspaces')
      .upsert({
        user_id: user.id,
        workspace_id: workspace.id,
        pinned: ws.pinned
      })
  }

  // 4. Migrate collections
  // ... similar pattern

  // 5. Mark migration complete
  await invoke('set_setting', { key: 'supabase_migrated', value: 'true' })
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/supabase.ts` | New - Supabase client setup |
| `src/lib/workspaces.ts` | New - Workspace operations via Supabase |
| `src/lib/collections.ts` | New - Collection operations via Supabase |
| `src/lib/auth.ts` | New - Supabase Auth with GitHub |
| `src/contexts/AuthContext.tsx` | New - Auth state management |
| `src-tauri/src/commands.rs` | Remove library commands, keep file ops |
| `src-tauri/src/library/` | Simplify to file operations only |
| `src/ipc/library.ts` | Update to use Supabase for metadata |
| Database migrations | Add Supabase schema |

---

## Open Questions

1. **Offline support?** Cache Supabase data locally for offline browsing?
2. **Real-time updates?** Use Supabase Realtime for live collection updates?
3. **Rate limiting?** Supabase has generous limits, but monitor usage
4. **GitHub token storage?** Supabase session has provider_token, but expires - need refresh strategy

---

## Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Local files | Filesystem | Actual kit content in projects |
| Local metadata | SQLite | Projects, local resources, settings |
| Shared metadata | Supabase | Workspaces, collections, catalogs |
| File storage | GitHub | Kit content in repos, version history |
| Auth | Supabase Auth | User identity via GitHub OAuth |

This hybrid approach gives us:
- **Fast local operations** (SQLite)
- **Shared collaboration** (Supabase)
- **Version control** (GitHub)
- **Simple auth** (Supabase + GitHub OAuth)
- **Low cost** ($0-25/month)
