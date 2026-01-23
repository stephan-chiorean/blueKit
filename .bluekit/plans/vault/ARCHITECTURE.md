# Vault System Architecture

## TL;DR

**Vault = Project with `is_vault = true`**

That's it. Same database table, same `.bluekit` directory, same file watching, same everything. The only difference is the UI layer (VaultPage vs. ProjectDetailPage).

---

## Key Insight

```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  is_vault: boolean;  // ← Add this ONE field
  git_url?: string;
  git_connected: boolean;
  created_at: number;
  updated_at: number;
}
```

**Everything else is reused:**
- `.bluekit/` directory structure
- File watching (`watch_project_artifacts`)
- Artifact loading (`get_project_artifacts`)
- Notebook UI (`NotebookTree`, `NoteViewPage`)
- File operations (create, edit, delete)

---

## Visual Layout

### VaultPage (New Main Interface)

```
┌─────────────────────────────────────────────────────────────┐
│  Header: [📖 Personal Vault ▼] [Search] [New Note]         │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Sidebar     │  Vault Notebook (Content Area)              │
│              │                                              │
│  [Projects]  │  ┌──────────────────────────────────────┐   │
│  [Library]   │  │  NotebookTree (reused)               │   │
│  [Workflows] │  │  ├─ Daily Notes/                     │   │
│  [Tasks]     │  │  ├─ Learning/                        │   │
│              │  │  └─ Inbox/                           │   │
│              │  └──────────────────────────────────────┘   │
│              │                                              │
│              │  ┌──────────────────────────────────────┐   │
│              │  │  NoteViewPage (reused)               │   │
│              │  │                                      │   │
│              │  │  # My Learning Note                  │   │
│              │  │                                      │   │
│              │  │  Content here...                     │   │
│              │  └──────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────┘
```

**Projects Tab Active**:
```
┌─────────────────────────────────────────────────────────────┐
│  Header: [📖 Personal Vault ▼] [Search] [Add Project]      │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Sidebar     │  ProjectsTabContent (reused from HomePage)  │
│              │                                              │
│  [Projects]◀ │  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  [Library]   │  │ BlueKit │  │ Website │  │ Mobile  │     │
│  [Workflows] │  │ 📁      │  │ 📁      │  │ 📁      │     │
│  [Tasks]     │  └─────────┘  └─────────┘  └─────────┘     │
│              │                                              │
│              │  (Click project → Navigate to               │
│              │   ProjectDetailPage - unchanged)            │
└──────────────┴──────────────────────────────────────────────┘
```

---

## File System Structure

### Vault Directory (Same as Project!)

```
~/Documents/BlueKitVault/
├── .bluekit/               # Identical structure!
│   ├── kits/
│   │   └── React Patterns.md
│   ├── walkthroughs/
│   │   └── Setup Guide.md
│   ├── diagrams/
│   │   └── Architecture.mmd
│   └── config.json
├── Daily Notes/
│   ├── 2026-01-22.md
│   └── 2026-01-23.md
├── Learning/
│   └── Rust Lifetimes.md
└── Inbox/
    └── Quick Note.md
```

### Regular Project Directory

```
~/Code/blueKit/
├── src/
├── .bluekit/               # Same structure!
│   ├── kits/
│   ├── walkthroughs/
│   └── diagrams/
└── ...
```

**They're identical.** The only difference is the database flag.

---

## Database Schema

### Single Table for Both

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  is_vault INTEGER DEFAULT 0,  -- ← Only new field!
  git_url TEXT,
  git_connected INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Example data:
-- Vault:
-- ('abc-123', 'Personal Vault', '/Users/you/Documents/BlueKitVault', NULL, 1, ...)

-- Projects:
-- ('def-456', 'BlueKit', '/Users/you/Code/blueKit', 'App description', 0, ...)
-- ('ghi-789', 'Website', '/Users/you/Code/website', 'Site description', 0, ...)
```

**Query vault**: `SELECT * FROM projects WHERE is_vault = 1 LIMIT 1`
**Query projects**: `SELECT * FROM projects WHERE is_vault = 0`

---

## Rust Commands (Mostly Reused)

### New Commands (Minimal)

```rust
// src-tauri/src/commands.rs

#[tauri::command]
async fn get_vault_project() -> Result<Option<Project>, String> {
    let conn = get_db_connection()?;
    let mut stmt = conn.prepare("SELECT * FROM projects WHERE is_vault = 1 LIMIT 1")?;
    // ... return project or None
}

#[tauri::command]
async fn create_project(
    path: String,
    name: String,
    description: Option<String>,
    is_vault: Option<bool>  // ← Add this parameter
) -> Result<Project, String> {
    // ... existing logic, just set is_vault in INSERT
}
```

### Reused Commands (No Changes)

```rust
// All of these work for both vault AND projects:

#[tauri::command]
async fn get_project_artifacts(project_path: String) -> Result<Vec<ArtifactFile>, String>

#[tauri::command]
async fn watch_project_artifacts(project_path: String) -> Result<(), String>

#[tauri::command]
async fn read_file(path: String) -> Result<String, String>

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String>

// ... ALL file operations work identically
```

---

## React Components

### New Components (~300 lines total)

```typescript
// src/pages/VaultPage.tsx (100 lines)
export default function VaultPage({ onProjectSelect }: Props) {
  const [vault, setVault] = useState<Project | null>(null);

  useEffect(() => {
    invokeGetVaultProject().then(setVault);
  }, []);

  if (!vault) return <VaultSetupScreen onCreate={setVault} />;

  return (
    <VStack h="100vh">
      <Header currentProject={vault} />
      <Splitter>
        <VaultSidebar onProjectSelect={onProjectSelect} />
        <VaultNotebook project={vault} />  {/* Same as ProjectDetailPage content */}
      </Splitter>
    </VStack>
  );
}

// src/components/vault/VaultSidebar.tsx (80 lines)
// Just tabs: Projects | Library | Workflows | Tasks
// Reuses ProjectsTabContent, LibraryTabContent, etc.

// src/components/vault/VaultNotebook.tsx (80 lines)
// Copy-paste from ProjectDetailPage content area
// Uses NotebookTree + NoteViewPage

// src/components/vault/VaultSetupScreen.tsx (50 lines)
// Directory picker + name input + create button
```

### Reused Components (No Changes)

- ✅ `NotebookTree` - File tree
- ✅ `NoteViewPage` - Note editor
- ✅ `ProjectDetailPage` - Project notebooks
- ✅ `ProjectsTabContent` - Project grid
- ✅ `LibraryTabContent`, `WorkflowsTabContent`, `TasksTabContent`

**~95% of code is reused!**

---

## Navigation Flow

```
App Start
    ↓
WelcomeScreen (auth/skip)
    ↓
Query: WHERE is_vault = 1
    ├─ Found → VaultPage
    └─ Not found → VaultSetupScreen → VaultPage

VaultPage > Projects Tab > Click Project
    ↓
ProjectDetailPage (unchanged)

ProjectDetailPage > Back Button
    ↓
VaultPage
```

---

## Comparison Table

| Aspect | Project | Vault | Implementation |
|--------|---------|-------|----------------|
| **Database** | projects table | projects table | `is_vault = 0` vs `is_vault = 1` |
| **File Structure** | `.bluekit/` | `.bluekit/` | Identical |
| **Loading Files** | `get_project_artifacts` | `get_project_artifacts` | Same function |
| **File Watcher** | `watch_project_artifacts` | `watch_project_artifacts` | Same function |
| **File Tree UI** | `NotebookTree` | `NotebookTree` | Same component |
| **Note Editor** | `NoteViewPage` | `NoteViewPage` | Same component |
| **Page Component** | `ProjectDetailPage` | `VaultPage` | Different wrapper |
| **Sidebar Tabs** | Kits/Tasks/etc. | Projects/Library/etc. | Different tabs |

**Only difference**: UI wrapper (VaultPage vs. ProjectDetailPage) and sidebar tabs.

---

## Why This Works

### Benefits

1. **Minimal Code**: ~300 lines vs. 2000+ for separate system
2. **No New Infrastructure**: No new tables, no new watchers, no new file formats
3. **Battle-Tested**: Reuse existing project infrastructure (already debugged)
4. **Performance**: No overhead, same performance as projects
5. **Maintainability**: One system to maintain, not two
6. **Future-Proof**: All future features (search, sync, etc.) work for both

### Trade-offs

- **Conceptual**: Vault "feels" different but is technically a project
  - **Mitigation**: UI makes it feel special (different icon, different page)
- **Single Vault**: Only one `is_vault = 1` at a time
  - **Mitigation**: Sufficient for MVP, can relax later if needed

---

## Code Examples

### Backend: Creating a Vault

```rust
// src-tauri/src/commands.rs

#[tauri::command]
async fn create_project(
    path: String,
    name: String,
    description: Option<String>,
    is_vault: Option<bool>
) -> Result<Project, String> {
    let project_id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    // Create .bluekit directory (same for vault and projects)
    create_bluekit_directory(&path)?;

    // Insert into database
    let conn = get_db_connection()?;
    conn.execute(
        "INSERT INTO projects (id, name, path, description, is_vault, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            project_id,
            name,
            path,
            description,
            is_vault.unwrap_or(false) as i32,  // ← Default to false
            now,
            now
        ],
    )?;

    Ok(Project {
        id: project_id,
        name,
        path,
        description,
        is_vault: is_vault.unwrap_or(false),
        // ...
    })
}
```

### Frontend: Loading Vault

```typescript
// src/pages/VaultPage.tsx

useEffect(() => {
  // Load vault (WHERE is_vault = 1)
  invokeGetVaultProject().then(vaultProject => {
    if (vaultProject) {
      setVault(vaultProject);

      // Load files (same function as projects!)
      invokeGetProjectArtifacts(vaultProject.path).then(setArtifacts);

      // Watch files (same function as projects!)
      invokeWatchProjectArtifacts(vaultProject.path);
    }
  });
}, []);
```

---

## Migration Path

### Existing Users

**No migration needed!** Just:
1. Add `is_vault` column to database (defaults to 0)
2. All existing projects automatically have `is_vault = 0`
3. User creates vault → first project with `is_vault = 1`

### Database Migration

```sql
-- Run this migration on app start
ALTER TABLE projects ADD COLUMN is_vault INTEGER DEFAULT 0;

-- Done! All existing projects are is_vault = 0
```

---

## Timeline

**Phase 1: 1 week (vs. 4 weeks for separate system)**

- **Day 1** (2 hours): Backend - add column, update commands
- **Day 2-3** (10 hours): Frontend - VaultPage, VaultSidebar, VaultNotebook
- **Day 4** (6 hours): Integration - routing, navigation, filtering
- **Day 5** (4 hours): Testing, polish, documentation

**Total: ~20 hours of development**

---

## Future Enhancements

### Phase 2: Search & Linking

Both vault AND projects get:
- Full-text search
- Wiki links (`[[note]]`)
- Backlinks
- Templates

**Implementation**: Add to project infrastructure, both benefit automatically!

### Phase 3: Sync Preparation

Both vault AND projects get:
- Change tracking
- Conflict detection
- Sync metadata

**Implementation**: Add to project infrastructure, both sync!

### Phase 4: Cloud Sync

Sync both vault AND projects to Supabase.

**Implementation**: Vault is just another project in the sync queue!

---

## Summary

**Vault = Project with a flag.**

- Same table ✅
- Same `.bluekit` ✅
- Same file operations ✅
- Same UI components ✅
- Different page wrapper ✅
- Different sidebar tabs ✅

**Result**: Massive code reuse, minimal complexity, 1 week implementation instead of 4 weeks.
