# Project Collaboration with Supabase

**Status:** Still Valid
**Updated:** 2026-01-19
**Context:** Git-based project collaboration (separate from Personal Library)

> **Note:** This document covers **project collaboration** - sharing tasks, checkpoints, and
> activity between teammates who share a git repository. This is separate from the
> **Personal Library** (see `personal-library-spec.md`), which is individual to each user.
>
> Key distinction:
> - **Projects** = Git repos with `.bluekit` folders, shared via git
> - **Library** = Personal cloud storage, not shared

---

## Problem Statement

BlueKit projects have associated data (plans, tasks, checkpoints) stored in SQLite locally. When multiple teammates collaborate on the same project, this data needs to sync between them. The challenge is that some data (like plans) has both:

1. **Database records** (metadata, status, progress)
2. **File-based content** (markdown documents in `.bluekit/plans/`)

This creates a sync problem: database records can sync via Supabase instantly, but files only sync when users pull latest from git.

## Current Architecture

```
Local SQLite
├── projects (id, name, path, gitUrl, gitConnected)
├── tasks (id, projectIds[], title, status, priority, tags)
├── plans (id, projectId, name, description, status, progress, filePath)
└── checkpoints (id, projectId, gitCommitSha, name, type, tags)

File System (.bluekit/plans/)
├── feature-auth.md
├── refactor-api.md
└── implementation-roadmap.md
```

## The Sync Challenge

### Scenario: User 1 Creates a Plan

1. User 1 creates plan "Auth Implementation" locally
2. Database record created in local SQLite
3. Markdown file created at `.bluekit/plans/supabase/auth-implementation.md`
4. User 1 commits and pushes

### What User 2 Sees (Before Git Pull)

**If we sync DB records via Supabase:**
- User 2 immediately sees "Auth Implementation" plan in PlansTabContent
- User 2 clicks to view → **File not found** (hasn't pulled yet)
- Confusing UX: "Why can I see this plan but not open it?"

**If we don't sync DB records:**
- User 2 pulls latest from git
- User 2 sees new files but **no database record**
- Plan doesn't appear in UI until... what? Auto-discovery? Manual import?

## Proposed Solutions

### Option A: Database-First with Ghost States

Sync database records via Supabase, but handle missing files gracefully.

```typescript
interface Plan {
  id: string;
  projectId: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  progress: number;
  filePath: string;

  // New fields for sync
  syncStatus: 'synced' | 'pending_files' | 'local_only';
  createdBy: string; // Supabase user ID
  lastSyncedAt: number;
}
```

**UI Treatment:**
- Plans with `syncStatus: 'pending_files'` show a "Pull Latest" indicator
- Clicking opens a prompt: "This plan was created by {teammate}. Pull latest to view content."
- Progress/status still visible, just can't read the markdown content

**Pros:**
- Teammates see activity immediately
- Clear indication of what's happening
- Database remains source of truth for metadata

**Cons:**
- Added complexity in UI state handling
- "Ghost" plans could be confusing
- Still need to handle file deletion scenarios

### Option B: File-First with Auto-Discovery

Don't sync plan records via Supabase. Instead, auto-discover plans from files.

```typescript
// On project load or file change
async function syncPlansFromFiles(projectPath: string) {
  const planFiles = await glob(`${projectPath}/.bluekit/plans/**/*.md`);

  for (const file of planFiles) {
    const frontmatter = parseFrontmatter(file);
    const existingPlan = await db.plans.findByFilePath(file);

    if (!existingPlan) {
      // Create record from file
      await db.plans.create({
        id: frontmatter.id || generateId(),
        name: frontmatter.name || basename(file),
        filePath: file,
        syncStatus: 'discovered',
        // ...
      });
    }
  }

  // Mark orphaned records
  const dbPlans = await db.plans.findByProject(projectId);
  for (const plan of dbPlans) {
    if (!planFiles.includes(plan.filePath)) {
      plan.syncStatus = 'orphaned';
    }
  }
}
```

**Pros:**
- Files are always in sync with DB (can't have ghost records)
- Simple mental model: "If you can see it, you have it"
- Works offline without Supabase

**Cons:**
- Teammates don't see each other's work until git sync
- Metadata (status, progress) stored in frontmatter, duplicated
- File parsing on every load (performance?)

### Option C: Hybrid - Sync Metadata, Lazy-Load Content

Sync lightweight metadata via Supabase, but content comes from files.

```typescript
// Supabase table: project_plans
{
  id: string,
  project_id: string, // references shared project
  name: string,
  description: string,
  status: 'active' | 'completed' | 'archived',
  progress: number,
  file_path: string, // relative path within .bluekit/
  created_by: string,
  created_at: timestamp,
  updated_at: timestamp
}

// Local handling
interface LocalPlanState {
  supabaseRecord: SupabasePlan;
  localFileExists: boolean;
  localContent: string | null;
  needsPull: boolean;
}
```

**Sync Flow:**
1. User 1 creates plan → Supabase record + local file
2. User 2 subscribes to project plans → sees record immediately
3. User 2's UI shows plan with `needsPull: true`
4. User 2 pulls from git → file exists → full plan available

**Conflict Resolution:**
- Supabase record wins for metadata (status, progress)
- File content is source of truth for actual plan content
- If file deleted locally but Supabase record exists: show "Restore from git" option

## Tasks - Different Approach

Tasks are simpler because they're **database-only** (no file component).

```typescript
// Supabase table: project_tasks
{
  id: string,
  project_ids: string[], // can belong to multiple projects
  title: string,
  description: string,
  status: 'pending' | 'in_progress' | 'completed',
  priority: 'pinned' | 'high' | 'standard' | 'long term' | 'nit',
  type: 'bug' | 'feature' | 'cleanup' | 'investigation' | 'optimization' | 'chore',
  complexity: 'easy' | 'hard' | 'deep dive',
  tags: string[],
  created_by: string,
  assigned_to: string[], // collaboration feature!
  created_at: timestamp,
  updated_at: timestamp
}
```

**Sync Strategy:**
- Full real-time sync via Supabase Realtime
- Optimistic updates locally
- Conflict resolution: last-write-wins with timestamps
- Offline support: queue changes, sync when online

## Checkpoints - Git-Centric

Checkpoints are tied to git commits, so they inherently require git sync.

```typescript
// Supabase table: project_checkpoints
{
  id: string,
  project_id: string,
  git_commit_sha: string,
  git_branch: string,
  name: string,
  description: string,
  checkpoint_type: 'milestone' | 'stable' | 'experiment' | 'review',
  tags: string[],
  created_by: string,
  created_at: timestamp
}
```

**Sync Consideration:**
- Checkpoint references a commit that teammate might not have yet
- Similar to plans: show checkpoint metadata, but "View Diff" requires having the commit
- Could show: "Commit abc1234 - Pull to view"

## Recommended Approach

### Phase 1: Tasks (Easiest Win)

1. Create Supabase `project_tasks` table
2. Add real-time subscription for project tasks
3. Implement optimistic local updates
4. Add `assigned_to` for task collaboration
5. Handle offline/online transitions

### Phase 2: Checkpoints (Medium)

1. Create Supabase `project_checkpoints` table
2. Sync checkpoint metadata in real-time
3. Handle "commit not available locally" gracefully
4. Show teammate activity: "Alice pinned checkpoint 'v2.0 release'"

### Phase 3: Plans (Complex)

1. Create Supabase `project_plans` table
2. Implement hybrid sync (metadata via Supabase, content via files)
3. Add UI states for `pending_files` plans
4. Handle orphaned plans (DB record but file deleted)
5. Consider: Should plan progress sync in real-time? Or only on save?

## Open Questions

1. **Project Sharing Model**
   - How do users share a project? Invite by email? Share link?
   - Do we need project-level permissions (owner, editor, viewer)?

2. **Conflict Resolution**
   - What if two users update the same task simultaneously?
   - Last-write-wins? Or merge with conflict UI?

3. **Offline Support**
   - How long should offline changes queue?
   - What if changes conflict when coming back online?

4. **File Sync Notification**
   - Should we show "X has new files - pull to see" notifications?
   - Or just mark individual items as needing pull?

5. **Plan Content Editing**
   - If User 2 edits plan content locally but User 1 also edited...
   - Git will handle file conflicts, but what about DB metadata?

## Database Schema Draft

```sql
-- Projects are shared via a project_members table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Tasks scoped to projects
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_ids UUID[] NOT NULL, -- array of project IDs
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'standard',
  type TEXT,
  complexity TEXT,
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans with file reference
CREATE TABLE project_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  progress FLOAT DEFAULT 0,
  file_path TEXT, -- relative to .bluekit/
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checkpoints with git reference
CREATE TABLE project_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  git_commit_sha TEXT NOT NULL,
  git_branch TEXT,
  name TEXT NOT NULL,
  description TEXT,
  checkpoint_type TEXT NOT NULL DEFAULT 'milestone',
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access projects they're members of
CREATE POLICY "Users can view their projects' tasks"
  ON project_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.project_id = ANY(project_tasks.project_ids)
    )
  );
```

## Next Steps

1. [ ] Decide on project sharing model (invite flow)
2. [ ] Finalize sync strategy for each data type
3. [ ] Design UI states for "pending sync" items
4. [ ] Implement tasks sync as proof of concept
5. [ ] Test offline scenarios
6. [ ] Design conflict resolution UX
