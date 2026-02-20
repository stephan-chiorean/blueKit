---
id: sqlite-domain-map-and-expansion-guide
alias: SQLite Domain Map & Expansion Guide
type: walkthrough
version: 1
tags:
  - database
  - sqlite
  - architecture
description: A comprehensive map of every SQLite domain in BlueKit, what each one currently tracks, and concrete expansion patterns for features like pinned projects, kit takeaways, kit reminders, and plan-to-milestone linking.
complexity: comprehensive
format: guide
is_base: false
---
# SQLite Domain Map & Expansion Guide

BlueKit's SQLite database lives at `~/.bluekit/bluekit.db` and is the backbone for everything that needs to persist across sessions — from the project registry to walkthrough takeaways. This guide maps every active domain, explains the current schema, and then gives you a clear implementation path for expanding each one.

---

## The Full Schema at a Glance

Every table in the database as of today:

```
projects                    ← project registry
  └── checkpoints           ← git snapshots per project
  └── plans                 ← plan folders per project
        └── plan_phases     ← ordered phases within a plan
              └── plan_milestones   ← completion checkboxes per phase
        └── plan_documents  ← markdown files linked to a plan/phase
        └── plan_links      ← cross-plan references (Claude / Cursor)
  └── walkthroughs          ← walkthrough registry per project
        └── walkthrough_takeaways   ← checkable key learnings
        └── walkthrough_notes       ← free-form session notes
  └── library_resources     ← indexed .bluekit files per project

tasks                       ← global task board
  └── task_projects         ← M:M bridge to projects

library_workspaces          ← GitHub-backed library sources
  └── library_catalogs      ← named artifact entries
        └── library_variations  ← version history per artifact
        └── library_subscriptions ← which local resource tracks which variation
  └── library_collections   ← named groupings of catalogs
        └── library_collection_catalogs  ← M:M bridge
```

**Timestamps:** All timestamps are stored as `i64` Unix milliseconds except in the `tasks` table which uses ISO 8601 `TEXT`. Use `datetime(col/1000, 'unixepoch')` when querying.

---

## Domain 1 — Projects

### What exists today

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT,
  tags TEXT,                    -- JSON array
  git_connected INTEGER DEFAULT 0,
  git_url TEXT,
  git_branch TEXT,
  git_remote TEXT,
  last_commit_sha TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_opened_at INTEGER,
  is_vault INTEGER DEFAULT 0    -- library vault flag
);
```

The `projects` table is the project registry — every project the user has registered lives here. `is_vault` marks the special Library Vault project. `last_opened_at` drives recency sorting.

**Entity file:** `src-tauri/src/db/entities/project.rs`
**Operations:** `src-tauri/src/db/project_operations.rs`

### Expansion: Pinned Projects

**The problem:** Power users have 20+ projects. The recency sort is good but sometimes you always want specific projects at the top regardless of when you opened them.

**What to add:**

```sql
-- Migration: add_project_pinned_at_column
ALTER TABLE projects ADD COLUMN pinned_at INTEGER;
-- NULL = not pinned, non-NULL = timestamp when user pinned it (drives pin order)
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(pinned_at);
```

**Updated sort query:**

```sql
-- Pinned projects first (ordered by pinned_at ASC so oldest pin stays on top),
-- then the rest by last_opened_at DESC
SELECT * FROM projects
ORDER BY
  CASE WHEN pinned_at IS NOT NULL THEN 0 ELSE 1 END,
  pinned_at ASC,
  last_opened_at DESC;
```

**Rust entity update:**

```rust
// src-tauri/src/db/entities/project.rs
pub struct Model {
    // ... existing fields
    #[serde(rename = "pinnedAt")]
    pub pinned_at: Option<i64>,   // NULL = not pinned
}
```

**New IPC commands to add:**

```rust
#[tauri::command]
pub async fn db_pin_project(
    db: State<'_, DatabaseConnection>,
    project_id: String,
) -> Result<ProjectDto, String>

#[tauri::command]
pub async fn db_unpin_project(
    db: State<'_, DatabaseConnection>,
    project_id: String,
) -> Result<ProjectDto, String>
```

**TypeScript IPC wrappers:**

```typescript
// src/ipc.ts
export async function invokeDbPinProject(projectId: string): Promise<Project> {
  return invokeWithTimeout('db_pin_project', { projectId }, 5000);
}

export async function invokeDbUnpinProject(projectId: string): Promise<Project> {
  return invokeWithTimeout('db_unpin_project', { projectId }, 5000);
}
```

**UI pattern:** A thumbtack icon on each project card. If `pinnedAt` is non-null, render the icon filled/colored. On click, call pin/unpin. Pinned projects render in a separate "Pinned" section above the main list, or at minimum float to the top with a visual divider.

---

## Domain 2 — Checkpoints

### What exists today

```sql
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,       -- FK → projects
  git_commit_sha TEXT NOT NULL,
  git_branch TEXT,
  git_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT,                      -- JSON array
  checkpoint_type TEXT NOT NULL,  -- 'milestone' | 'experiment' | 'template' | 'backup'
  parent_checkpoint_id TEXT,      -- self-referential lineage
  created_from_project_id TEXT,   -- if this spawned a new project
  pinned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Checkpoints are already well-modelled. They support lineage tracking via `parent_checkpoint_id` and can branch into new projects.

### Potential expansion: Checkpoint Notes

Right now a checkpoint only has a `description`. If we want richer annotation (like "this is where we fixed the auth bug, here's what broke first") we could add a `notes` child table:

```sql
CREATE TABLE IF NOT EXISTS checkpoint_notes (
  id TEXT PRIMARY KEY NOT NULL,
  checkpoint_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
);
```

This mirrors the exact pattern used by `walkthrough_notes`.

---

## Domain 3 — Tasks

### What exists today

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'nit',  -- 'pinned'|'high'|'standard'|'long term'|'nit'
  tags TEXT NOT NULL DEFAULT '[]',        -- JSON array
  created_at TEXT NOT NULL,              -- ISO 8601 (note: different from others!)
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'backlog', -- 'backlog'|'in_progress'|'completed'|'blocked'
  complexity TEXT,                        -- 'easy'|'hard'|'deep dive'
  type TEXT                               -- 'bug'|'investigation'|'feature'|'cleanup'|...
);

CREATE TABLE task_projects (
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  PRIMARY KEY (task_id, project_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**Entity:** `src-tauri/src/db/entities/task.rs`
**Operations:** `src-tauri/src/db/task_operations.rs`

### Potential expansion: Due Dates

```sql
ALTER TABLE tasks ADD COLUMN due_date TEXT;  -- ISO 8601 date, NULL = no due date
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
```

### Potential expansion: Task Dependencies

If you want to track "task B is blocked by task A":

```sql
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blocking_task_id TEXT NOT NULL,
  blocked_task_id TEXT NOT NULL,
  FOREIGN KEY (blocking_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(blocking_task_id, blocked_task_id)
);
```

---

## Domain 4 — Plans

### What exists today

The plans system is one of the most layered in the database:

```
plans
  └── plan_phases    (ordered sections, have their own status)
        └── plan_milestones  (checkboxes per phase, completion-tracked)
  └── plan_documents  (markdown files belonging to a plan or specific phase)
  └── plan_links      (references to other plan files, tagged as claude/cursor source)
```

**Plans schema:**
```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active'|'completed'|'archived'
  brainstorm_link TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Plan phases:**
```sql
CREATE TABLE plan_phases (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'in_progress'|'completed'
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Plan milestones:** These are the checkboxes within a phase. Each has `completed` (SQLite boolean), `completed_at` timestamp, and an `order_index`.

**Plan links:** Cross-plan references created when Claude or Cursor links between plan documents. The `source` field tracks who created the link (`'claude'` or `'cursor'`).

**Entity files:** `src-tauri/src/db/entities/plan*.rs`
**Operations:** `src-tauri/src/db/plan_operations.rs`

### Expansion: Plans ↔ Tasks Linking

Right now plans and tasks are completely separate. You can't say "milestone X in plan Y is tracked by task Z." Here's how to wire them together:

**Option A: Add a `task_id` FK to plan milestones (1:1 link)**

```sql
-- Migration: add_plan_milestone_task_id
ALTER TABLE plan_milestones ADD COLUMN task_id TEXT;
-- NULL = no linked task, non-NULL = linked task
CREATE INDEX IF NOT EXISTS idx_plan_milestones_task_id ON plan_milestones(task_id);
```

Completing the linked task can automatically complete the milestone (or vice versa) — but keeping them independent with just a visual link is simpler to start with.

**Option B: A bridge table (M:M, if milestones can link to many tasks)**

```sql
CREATE TABLE IF NOT EXISTS plan_milestone_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (milestone_id) REFERENCES plan_milestones(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(milestone_id, task_id)
);
```

**Recommendation:** Start with Option A. The 1:1 model covers 95% of the "I'm tracking this milestone in my task board" use case. Upgrade to M:M later if needed.

### Expansion: Plan-to-Plan Linking (already partially there)

`plan_links` already stores cross-plan references, but right now `linked_plan_path` stores a file path (string), not a `plan_id`. If the linked plan is also registered in the `plans` table, you could make this a proper FK:

```sql
ALTER TABLE plan_links ADD COLUMN linked_plan_id TEXT;
-- NULL if the linked plan isn't registered, non-NULL if it is
CREATE INDEX IF NOT EXISTS idx_plan_links_linked_plan_id ON plan_links(linked_plan_id);
```

This enables queries like "show me all plans that link to this plan" — a proper dependency graph across plans.

---

## Domain 5 — Walkthroughs

### What exists today

```sql
CREATE TABLE walkthroughs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,        -- path to the .md file
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',  -- 'not_started'|'in_progress'|'completed'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE walkthrough_takeaways (
  id TEXT PRIMARY KEY,
  walkthrough_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE walkthrough_notes (
  id TEXT PRIMARY KEY,
  walkthrough_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Walkthroughs are the most fully-featured non-library domain: they have status tracking, checkable takeaways, and freeform session notes.

**Entity files:** `src-tauri/src/db/entities/walkthrough*.rs`
**Operations:** `src-tauri/src/db/walkthrough_operations.rs`

### Expansion: Kit Takeaways

Kits (`.bluekit/*.md` files) are currently purely file-based — there's no database record per kit. If we want to add takeaways to kits (matching what walkthroughs have), we need a similar registration pattern:

**Step 1: Register kits in the database**

```sql
CREATE TABLE IF NOT EXISTS kits (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,        -- path relative to project root
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_kits_project_id ON kits(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kits_file_path ON kits(project_id, file_path);
```

**Step 2: Add kit takeaways**

```sql
CREATE TABLE IF NOT EXISTS kit_takeaways (
  id TEXT PRIMARY KEY NOT NULL,
  kit_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (kit_id) REFERENCES kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kit_takeaways_kit_id ON kit_takeaways(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_takeaways_order ON kit_takeaways(kit_id, sort_order);
```

This mirrors `walkthrough_takeaways` exactly — the same Rust CRUD operations pattern applies.

### Expansion: Kit Reminders

A reminder is a scheduled notification or "revisit prompt" attached to a kit. Useful for: "remind me to use this pattern next time I'm building auth."

```sql
CREATE TABLE IF NOT EXISTS kit_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  kit_id TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  remind_at INTEGER,              -- Unix ms timestamp, NULL = no scheduled time
  dismissed INTEGER NOT NULL DEFAULT 0,
  dismissed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (kit_id) REFERENCES kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kit_reminders_kit_id ON kit_reminders(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_reminders_remind_at ON kit_reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_kit_reminders_active ON kit_reminders(dismissed, remind_at);
```

**Query: upcoming/active reminders across all kits**

```sql
SELECT kr.*, k.name as kit_name, k.file_path
FROM kit_reminders kr
JOIN kits k ON kr.kit_id = k.id
WHERE kr.dismissed = 0
ORDER BY kr.remind_at ASC NULLS LAST;
```

**Note:** Since Tauri doesn't have background timers, you'd surface reminders reactively — e.g. a "Reminders" section in the header popover (similar to the task manager) that loads on mount and shows any active reminders.

### Expansion: Walkthrough Reminders (same pattern)

By the same token, you could attach reminders to walkthroughs: "come back and finish this walkthrough in 3 days."

```sql
CREATE TABLE IF NOT EXISTS walkthrough_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  walkthrough_id TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  remind_at INTEGER,
  dismissed INTEGER NOT NULL DEFAULT 0,
  dismissed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (walkthrough_id) REFERENCES walkthroughs(id) ON DELETE CASCADE
);
```

Or — if you want a unified reminders system — use a polymorphic approach:

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,   -- 'kit' | 'walkthrough' | 'plan' | 'task'
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  remind_at INTEGER,
  dismissed INTEGER NOT NULL DEFAULT 0,
  dismissed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_entity ON reminders(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(dismissed, remind_at);
```

The polymorphic approach gives you a single "Reminders" IPC command surface and a single UI component. The tradeoff is no FK integrity (can't cascade-delete from entity deletion), so you'd clean up orphaned reminders manually in the delete operations.

---

## Domain 6 — Library

### What exists today

The library domain is the most complex — it models a GitHub-backed artifact distribution system:

```
library_workspaces      ← a GitHub repo (owner/repo)
  └── library_catalogs  ← a named, typed artifact within the workspace
        └── library_variations  ← published versions (commit-tracked)
        └── library_subscriptions  ← local resource currently subscribed to a variation
  └── library_collections  ← user-defined groupings of catalogs
        └── library_collection_catalogs  ← M:M bridge

library_resources       ← indexed local .bluekit files (per project)
```

Notable: `library_workspaces.pinned` already exists (added via migration) to pin workspaces in the UI.

---

## The Migration Pattern (Reference)

Every expansion above follows the same three patterns. Here they are consolidated:

### Pattern 1: New table (for new child entities)

```rust
async fn create_kit_takeaways_table(db: &DatabaseConnection) -> Result<(), DbErr> {
    let sql = r#"
        CREATE TABLE IF NOT EXISTS kit_takeaways (
            id TEXT PRIMARY KEY NOT NULL,
            kit_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            completed_at INTEGER,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (kit_id) REFERENCES kits(id) ON DELETE CASCADE
        )
    "#;
    db.execute(Statement::from_string(db.get_database_backend(), sql.to_string())).await?;

    let index_sql = r#"
        CREATE INDEX IF NOT EXISTS idx_kit_takeaways_kit_id ON kit_takeaways(kit_id);
        CREATE INDEX IF NOT EXISTS idx_kit_takeaways_order ON kit_takeaways(kit_id, sort_order);
    "#;
    db.execute(Statement::from_string(db.get_database_backend(), index_sql.to_string())).await?;

    info!("Kit takeaways table and indexes created or already exist");
    Ok(())
}
```

### Pattern 2: New column on existing table (idempotent check)

```rust
async fn add_project_pinned_at_column(db: &DatabaseConnection) -> Result<(), DbErr> {
    let check_sql = r#"
        SELECT COUNT(*) as count
        FROM pragma_table_info('projects')
        WHERE name='pinned_at'
    "#;
    let result = db.query_one(Statement::from_string(db.get_database_backend(), check_sql.to_string())).await?;
    let column_exists = if let Some(row) = result {
        row.try_get::<i32>("", "count").unwrap_or(0) > 0
    } else { false };

    if !column_exists {
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "ALTER TABLE projects ADD COLUMN pinned_at INTEGER".to_string(),
        )).await?;
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(pinned_at)".to_string(),
        )).await?;
        info!("Added pinned_at column to projects table");
    }
    Ok(())
}
```

### Pattern 3: Register in run_migrations()

Always add the new migration function call at the end of `run_migrations` in `src-tauri/src/db/migrations.rs`:

```rust
pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    // ... all existing migrations ...

    // New: pinned projects
    add_project_pinned_at_column(db).await?;

    // New: kit registration + takeaways + reminders
    create_kits_table(db).await?;
    create_kit_takeaways_table(db).await?;
    create_kit_reminders_table(db).await?;

    // New: plan-to-task linking
    add_plan_milestone_task_id(db).await?;

    Ok(())
}
```

---

## Expansion Checklist

For any new expansion, run through this checklist:

```
Migration
  [ ] Migration function created with IF NOT EXISTS / pragma_table_info check
  [ ] Appropriate indexes added
  [ ] Migration function added to run_migrations() at the end

Rust
  [ ] Entity model updated (src-tauri/src/db/entities/)
  [ ] DTO struct updated with #[serde(rename_all = "camelCase")]
  [ ] CRUD operations implemented in *_operations.rs
  [ ] Tauri commands created in commands.rs
  [ ] Commands registered in main.rs invoke_handler![]

TypeScript
  [ ] Interface updated in src/types/
  [ ] IPC wrappers added to src/ipc.ts (camelCase object keys!)
  [ ] UI components wired to IPC calls
  [ ] Error handling with toaster

Verification
  [ ] sqlite3 ~/.bluekit/bluekit.db ".schema <new_table>" confirms structure
  [ ] App starts without migration errors
  [ ] CRUD operations work end-to-end
```

---

## Summary Table: What We Rely on SQLite For

| Domain | Tables | Currently Tracked | Natural Expansions |
|--------|--------|-------------------|-------------------|
| Projects | `projects` | Registry, git metadata, vault flag | Pinned projects, project color/icon |
| Checkpoints | `checkpoints` | Git snapshots, types, lineage | Checkpoint notes |
| Tasks | `tasks`, `task_projects` | Priority, status, complexity, type, M:M projects | Due dates, task dependencies |
| Plans | `plans`, `plan_phases`, `plan_milestones`, `plan_documents`, `plan_links` | Phases, milestones, file links, cross-plan refs | Plan↔task linking, linked plan FK |
| Walkthroughs | `walkthroughs`, `walkthrough_takeaways`, `walkthrough_notes` | Status, checkable takeaways, session notes | Reminders, kit-style takeaways |
| Kits | *(file-only today)* | Nothing — purely .md files | DB registration, takeaways, reminders |
| Library | `library_workspaces`, `library_catalogs`, `library_variations`, `library_subscriptions`, `library_resources`, `library_collections` | GitHub artifact distribution, versioning, subscriptions | — |
