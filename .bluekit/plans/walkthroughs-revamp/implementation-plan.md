# Walkthroughs Revamp: Plans UX for Understanding

This plan transforms walkthroughs to mirror the Plans UX—same structure, same patterns, but focused on **understanding** rather than execution.

## Vision

Walkthroughs are single `.md` files with **Takeaways** (understanding checkpoints) instead of Milestones. Like plans, you can create a walkthrough upfront with name, description, and takeaways. The content is the document; the takeaways track what you've learned.

**Key Simplification**: No section splitting. No YAML changes. Just borrow the Plans UX with:
- Takeaways instead of Milestones
- 1 file instead of folder
- No "Documents" tab

---

## Plans vs Walkthroughs

| Aspect | Plans | Walkthroughs |
|--------|-------|--------------|
| **Structure** | Folder with docs | Single .md file |
| **Progress unit** | Milestones (tasks) | Takeaways (understanding) |
| **Content** | Multiple documents | One document |
| **Notes** | DB-backed | DB-backed |
| **Status** | DB-backed | DB-backed |
| **Creation** | Name + description + milestones | Name + description + takeaways |

---

## Data Architecture

### SQLite Schema

```sql
-- Walkthrough registration
CREATE TABLE walkthroughs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,           -- Path to .md file
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'not_started', -- not_started | in_progress | completed
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Takeaways (like milestones, but for understanding)
CREATE TABLE walkthrough_takeaways (
  id TEXT PRIMARY KEY,
  walkthrough_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (walkthrough_id) REFERENCES walkthroughs(id)
);

-- Takeaway progress (per-user)
CREATE TABLE walkthrough_takeaway_progress (
  id TEXT PRIMARY KEY,
  takeaway_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  completed INTEGER DEFAULT 0,       -- 0 or 1
  completed_at INTEGER,
  FOREIGN KEY (takeaway_id) REFERENCES walkthrough_takeaways(id)
);

-- Notes (like plan notes)
CREATE TABLE walkthrough_notes (
  id TEXT PRIMARY KEY,
  walkthrough_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (walkthrough_id) REFERENCES walkthroughs(id)
);
```

### Data Model Philosophy

**Breathing Document Principle**: Walkthroughs are living documents that separate immutable properties from personal state.

| Location | Data Type | Examples | Characteristics |
|----------|-----------|----------|-----------------|
| **YAML Front Matter** | Objective properties | `format`, `complexity`, `tags`, `description` | Version-controlled, set in stone, shared across copies |
| **SQLite Database** | Personal/fluid state | Notes, takeaway progress, status | Per-user, project-specific, not version-controlled |

**Why this matters**:
- When you copy a walkthrough to another project, the YAML travels with it—same format, same tags, same complexity
- But your notes and takeaway progress stay in the source project's database—each reader has their own journey
- The file is the "textbook"; the database is your "notebook margins"

### YAML Front Matter (Unchanged)

The walkthrough `.md` file keeps its existing front matter. These are **read-only display properties**—the UI shows them but doesn't modify them.

```yaml
---
id: github-auth-flow
alias: GitHub Auth Flow
type: walkthrough
description: Complete OAuth implementation walkthrough
complexity: comprehensive    # → Shown as badge/icon in UI
format: architecture         # → Shown as badge/icon in UI
tags: [github, authentication]
---

# GitHub Auth Flow

[Full markdown content - no section metadata needed]
```

### UI Display of YAML Metadata

When present in the front matter, display as read-only indicators:

| Field | UI Treatment |
|-------|--------------|
| `complexity` | Badge: "Simple" / "Moderate" / "Comprehensive" |
| `format` | Icon or label: 📚 Reference, 🔧 Guide, 👁️ Review, 🏗️ Architecture, 📖 Documentation |
| `tags` | Chips/pills for filtering and display |

---

## Creation Flow

### "Create Walkthrough" Dialog

Mirrors "Create Plan" dialog.

```
┌──────────────────────────────────────────────────────────────────┐
│ Create Walkthrough                                            [×] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Name:        [GitHub Authentication Guide            ]         │
│                                                                  │
│  Description: [Understand the OAuth flow, token storage,]        │
│               [and security architecture.              ]         │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│  Takeaways                                             [+ Add]   │
│  ─────────────────────────────────────────────────────────────   │
│  │ ○ │ Understand PKCE flow and why it's needed      │ [×] │   │
│  │ ○ │ Know where tokens are stored on each platform │ [×] │   │
│  │ ○ │ Understand token injection points             │ [×] │   │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│                                        [Cancel] [Create]         │
└──────────────────────────────────────────────────────────────────┘
```

**Creation Result**:
1. Creates `.bluekit/walkthroughs/<name>.md` with basic front matter + placeholder content
2. Registers walkthrough in SQLite with status, takeaways
3. Opens WalkthroughViewPage

---

## Dedicated Walkthrough Page

### WalkthroughViewPage

Mirrors PlanDocViewPage layout.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back                                        [Edit] [Status ▼] [···]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  GitHub Authentication Guide                                            │
│  Understand the OAuth flow, token storage, and security architecture.  │
│                                                                         │
├───────────────────────────────┬─────────────────────────────────────────┤
│                               │                                         │
│  Takeaways                    │  # GitHub Auth Flow                     │
│  ━━━━━━━━━━━━━━ 1/3          │                                         │
│                               │  BlueKit implements GitHub's            │
│  ┌───────────────────────┐    │  Authorization Code Flow with PKCE      │
│  │ ✓ Understand PKCE     │    │  (Proof Key for Code Exchange)...       │
│  │   flow and why it's   │    │                                         │
│  │   needed              │    │  ## Part 1: Authentication              │
│  └───────────────────────┘    │                                         │
│  ┌───────────────────────┐    │  The flow works as follows:             │
│  │ ○ Know where tokens   │    │  1. Generate PKCE parameters            │
│  │   are stored          │    │  2. Start OAuth server                  │
│  └───────────────────────┘    │  3. User authorizes...                  │
│  ┌───────────────────────┐    │                                         │
│  │ ○ Understand token    │    │  ```rust                                │
│  │   injection points    │    │  pub fn generate_verifier() {           │
│  └───────────────────────┘    │      // ...                             │
│                               │  }                                      │
│  ─────────────────────────    │  ```                                    │
│                               │                                         │
│  Notes                        │  ## Part 2: API Integration             │
│  ─────────────────────────    │  ...                                    │
│  ┌───────────────────────┐    │                                         │
│  │ Remember to check the │    │                                         │
│  │ keychain docs for     │    │                                         │
│  │ Linux support...      │    │                                         │
│  └───────────────────────┘    │                                         │
│  [+ Add Note]                 │                                         │
│                               │                                         │
└───────────────────────────────┴─────────────────────────────────────────┘
```

### Layout

| Left Sidebar | Right Content |
|--------------|---------------|
| Takeaways (checkable) | Full markdown document |
| Progress indicator | Scrollable content |
| Notes section | Standard markdown viewer |

### Status

Like plans: `Not Started` → `In Progress` → `Completed`

- Status dropdown in header
- Auto-updates based on takeaway completion (optional)

---

## Implementation Phases

### Phase 1: Database Schema

**Goal**: Tables for walkthroughs, takeaways, progress, notes

1. Add migration for new tables
2. Match plan tables structure where possible

### Phase 2: IPC Commands

**Goal**: CRUD operations for walkthroughs

```rust
// Walkthrough CRUD
create_walkthrough(project_id, name, description, takeaways) -> Walkthrough
get_project_walkthroughs(project_id) -> Vec<Walkthrough>
get_walkthrough(id) -> Walkthrough
update_walkthrough(id, updates) -> Walkthrough
delete_walkthrough(id)

// Takeaway operations
add_takeaway(walkthrough_id, title, description)
update_takeaway(id, updates)
delete_takeaway(id)
reorder_takeaways(walkthrough_id, takeaway_ids)

// Progress
get_takeaway_progress(walkthrough_id) -> Vec<TakeawayProgress>
toggle_takeaway_complete(takeaway_id) -> TakeawayProgress

// Notes
get_walkthrough_notes(walkthrough_id) -> Vec<Note>
add_walkthrough_note(walkthrough_id, content) -> Note
update_walkthrough_note(id, content) -> Note
delete_walkthrough_note(id)

// Status
update_walkthrough_status(id, status)
```

### Phase 3: Frontend IPC Wrappers

**Goal**: TypeScript wrappers in `src/ipc/walkthroughs.ts`

Mirror the structure of `src/ipc/plans.ts`.

### Phase 4: Creation Flow

**Goal**: CreateWalkthroughDialog

1. Borrow from CreatePlanDialog
2. Name, description, takeaways inputs
3. Generate file + register in DB

### Phase 5: WalkthroughViewPage

**Goal**: Dedicated page mirroring PlanDocViewPage

1. Route: `/project/:id/walkthrough/:walkthroughId`
2. Layout: Sidebar (takeaways + notes) + Content (markdown)
3. Takeaway checkboxes
4. Notes section
5. Status dropdown

### Phase 6: List View Updates

**Goal**: WalkthroughsTabContent shows DB-backed walkthroughs

1. Fetch from DB instead of scanning files
2. Show status, takeaway progress
3. Link to WalkthroughViewPage

---

## Copy/Move Across Projects

> [!IMPORTANT]
> The existing `copy_walkthrough_to_project` command only copies the file—it doesn't register the walkthrough in the target project's database. This must be updated.

### Current Behavior (Problem)

```
ResourceSelectionBar → "Add to Project" → invokeCopyWalkthroughToProject()
                                                     ↓
                                          File copied to target/.bluekit/walkthroughs/
                                                     ↓
                                          NO database registration ❌
                                          Silent overwrite if name exists ❌
```

### Required Behavior

```
Copy Walkthrough
       ↓
   ┌───────────────────────────────────────┐
   │ 1. Check if name exists in target DB  │
   │    → Error if collision               │
   └───────────────────────────────────────┘
       ↓
   ┌───────────────────────────────────────┐
   │ 2. Copy .md file to target project    │
   │    (YAML travels with file)           │
   └───────────────────────────────────────┘
       ↓
   ┌───────────────────────────────────────┐
   │ 3. Register in target project's DB    │
   │    - Create walkthrough record        │
   │    - Copy takeaway definitions        │
   │    - Reset progress to 0              │
   │    - Empty notes (fresh start)        │
   └───────────────────────────────────────┘
```

### What Transfers vs What Stays

| Transfers (with file) | Stays in Source Project |
|-----------------------|-------------------------|
| YAML front matter (format, complexity, tags) | Your notes |
| Markdown content | Your takeaway progress |
| Takeaway *definitions* (titles, descriptions) | Your status |

### Implementation

Update `copy_walkthrough_to_project` in `src-tauri/src/commands.rs`:

```rust
pub async fn copy_walkthrough_to_project(
    source_file_path: String,
    target_project_path: String,
    db: State<'_, DbPool>,  // NEW: need DB access
) -> Result<String, String> {
    // 1. Get source walkthrough from DB (for takeaway definitions)
    // 2. Check if name exists in target project
    // 3. Copy file
    // 4. Register walkthrough in target project's DB
    // 5. Copy takeaway definitions (with 0 progress)
}
```

Add corresponding IPC command:
```rust
copy_walkthrough_to_project_with_registration(...)
```

### Collision Handling

If a walkthrough with the same `file_path` basename exists in the target:
- **Option A (Recommended)**: Return error with message: "A walkthrough named 'X' already exists in this project"
- **Option B**: Auto-rename to `X-copy-1.md`, `X-copy-2.md`, etc.

Phase 2 should handle this as part of IPC Commands implementation.

---

## File Changes

### New Files

```
src/
├── pages/
│   └── WalkthroughViewPage.tsx        # Mirrors PlanDocViewPage
├── components/walkthroughs/
│   ├── CreateWalkthroughDialog.tsx    # Creation flow
│   ├── TakeawaysSidebar.tsx           # Takeaways list (like milestones)
│   ├── TakeawayItem.tsx               # Single takeaway with checkbox
│   └── WalkthroughNotes.tsx           # Notes section
├── ipc/
│   └── walkthroughs.ts                # IPC wrappers
└── types/
    └── walkthrough.ts                 # Updated types

src-tauri/src/
├── db/
│   └── walkthroughs.rs                # SQLite operations
└── main.rs                            # Register commands
```

### Modified Files

```
src/App.tsx                            # Add route
src/components/walkthroughs/WalkthroughsTabContent.tsx  # Fetch from DB
src-tauri/src/commands.rs              # Update copy_walkthrough_to_project
```

---

## What We're NOT Doing

- ❌ Section splitting in markdown
- ❌ YAML front matter changes
- ❌ Section boundary editing
- ❌ Reading progress per-section
- ❌ Collapsible cards
- ❌ Multiple view modes

---

## Success Criteria

1. **"Create Walkthrough"** works like "Create Plan"
2. **Takeaways** are checkable understanding goals
3. **Notes** persist alongside walkthrough
4. **Status** tracks overall progress
5. **WalkthroughViewPage** mirrors PlanDocViewPage UX
6. **Existing walkthroughs** still viewable (just without takeaways until converted)
