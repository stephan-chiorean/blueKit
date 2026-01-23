# Vault System - Vision & Roadmap

## Overview

Add a **personal vault system** to BlueKit - a central notebook that complements project-specific notebooks, enabling cross-project knowledge management and personal learning notes.

### Current State
- Each project has its own `.bluekit` directory with isolated notebooks
- HomePage (tabs: Projects, Library, Workflows, Tasks) is the entry point
- ProjectDetailPage provides notebook interface per project (sidebar + content)
- No centralized personal knowledge base

### Target Vision
- **VaultPage** as new main interface (similar layout to ProjectDetailPage)
- **Left Sidebar**: Projects | Library | Workflows | Tasks tabs
- **Right Content**: Vault notebook (personal knowledge base)
- **Projects remain separate**: Each project keeps its own notebook
- **Cross-pollination**: Interface connects vault notes ↔ project notes
- Vault location persisted (like Obsidian) via SQLite vault registry
- Local-first with optional cloud sync (Supabase)
- Mobile companion app for read/reference on-the-go

---

## Core Principles

1. **Local-First**: Vault lives on disk, works fully offline
2. **Privacy-Focused**: Cloud sync is opt-in, requires authentication
3. **Cross-Platform**: Desktop (Tauri) → Mobile (React Native/Tauri Mobile)
4. **Project-Aware**: Link notes to projects without siloing them
5. **Markdown-Native**: Plain markdown files, git-friendly
6. **Extensible**: Plugin system for custom workflows (future)

---

## Phase 1: Local Vault Foundation (Pre-Cloud)

**Goal**: Add VaultPage with sidebar layout, create one central personal notebook alongside existing project notebooks

### Features

#### 1.1 Vault Initialization Flow
- **First-run experience**: After WelcomeScreen, detect if vault exists
- **Vault setup screen** (if no vault configured):
  - Choose vault location (default: `~/Documents/BlueKitVault`)
  - Vault name input
  - Create project with `is_vault = true` flag
  - Initialize `.bluekit` directory (same as any project)
- **Vault storage**: Just a row in projects table with `is_vault = 1`
- **Persistent vault**: Remember active vault via project_id

#### 1.2 Vault Structure (Identical to Project)
```
~/Documents/BlueKitVault/
├── .bluekit/               # Same as any project!
│   ├── kits/
│   ├── walkthroughs/
│   ├── diagrams/
│   └── config.json
├── Daily Notes/
├── Learning/
├── Inbox/
└── Projects/
```

**Key Insight**: Vault = Project with `is_vault = true`. No new infrastructure needed.

#### 1.3 VaultPage Layout (Similar to ProjectDetailPage)
- **Left Sidebar** (toolkit):
  - **Projects Tab**: Shows ProjectsTabContent (project grid)
  - **Library Tab**: Global library view
  - **Workflows Tab**: Workflow management
  - **Tasks Tab**: Task management
- **Right Content Area**:
  - Vault notebook (file tree + note editor)
  - Initially empty if no vault configured
- **Header**:
  - Vault name/switcher
  - Quick actions (new note, search, settings)

#### 1.4 Project Integration (Cross-Pollination)
- **Projects remain separate**: Each has its own ProjectDetailPage
- **Navigation**:
  - Click project in sidebar → Navigate to ProjectDetailPage
  - ProjectDetailPage back button → Return to VaultPage
- **Cross-referencing**:
  - Vault notes can link to project notes (future: wiki links)
  - Projects can be tagged in vault notes via YAML:
    ```yaml
    ---
    related_projects: [bluekit, personal-site]
    tags: [react, architecture]
    ---
    ```

#### 1.5 File System Operations (Reuse Existing!)
- **Reused Rust commands**:
  - `create_project(path, name, is_vault)` - Create vault (is_vault = true)
  - `db_get_projects()` - Returns all projects, filter for `is_vault = 1`
  - `get_project_artifacts(path)` - Load vault files (same as project)
  - `watch_project_artifacts(path)` - Watch vault directory (same as project)
- **Storage**:
  - Vault = Row in projects table with `is_vault = 1`
  - Active vault ID in `settings` table (key: `active_vault_id`)
  - No new tables, no new file formats!

#### 1.6 No Migration Needed
- **Additive approach**: Vault is a new feature, not a replacement
- **Vault = Special project**: Same infrastructure, just flagged differently
- **Vault is optional**: Users can continue using projects without vault
- **Future**: Option to copy notes from projects into vault (manual)

### Success Criteria
- ✅ User can create a local vault on first run
- ✅ VaultPage is default landing page (with sidebar layout)
- ✅ Projects tab in sidebar shows existing ProjectsTabContent
- ✅ All vault markdown files accessible via notebook
- ✅ File watcher updates vault UI in real-time
- ✅ Projects remain fully functional (separate notebooks)
- ✅ Can navigate: VaultPage ↔ ProjectDetailPage
- ✅ No cloud dependency (fully offline)
- ✅ Vault location persisted in SQLite registry

### Technical Implementation

#### Frontend Changes
1. **New Components** (Minimal):
   - `VaultSetupScreen.tsx` - Directory picker + create vault (50 lines)
   - `VaultPage.tsx` - Copy of ProjectDetailPage layout, different sidebar (100 lines)
   - `VaultSidebar.tsx` - Tabs: Projects/Library/Workflows/Tasks (80 lines)
2. **Modified Components**:
   - `App.tsx` - Route to VaultPage as default (5 lines changed)
   - `Header.tsx` - Show vault name when on VaultPage (10 lines)
3. **Reused Components** (No changes):
   - `NotebookTree`, `NoteViewPage` - Vault notebook UI
   - `ProjectsTabContent`, `LibraryTabContent`, etc. - Sidebar content
4. **Contexts**: Reuse existing ProjectArtifactsContext (no new contexts!)

#### Backend Changes (Trivial)
1. **Database Migration**:
   ```sql
   -- Add ONE column to existing projects table
   ALTER TABLE projects ADD COLUMN is_vault INTEGER DEFAULT 0;
   ```

2. **Command Changes** (extend existing):
   ```rust
   // Modify existing create_project to accept is_vault flag
   #[tauri::command]
   async fn create_project(path: String, name: String, is_vault: bool) -> Result<Project, String>

   // Add helper to get vault project
   #[tauri::command]
   async fn get_vault_project() -> Result<Option<Project>, String> {
       // SELECT * FROM projects WHERE is_vault = 1 LIMIT 1
   }
   ```

3. **No new modules needed!** Everything reuses existing project infrastructure.

---

## Phase 2: Enhanced Local Vault Features

**Goal**: Make the local vault a powerful standalone knowledge management tool

### Features

#### 2.1 Advanced File Organization
- **Nested folders**: Full directory tree support
- **Drag-and-drop**: Move files between folders
- **Favorites/Starred**: Pin important notes
- **Smart folders**: Auto-filter by criteria (e.g., "All React notes")

#### 2.2 Powerful Search
- **Full-text search**: Index all markdown content (using `tantivy` or `meilisearch`)
- **Tag search**: Filter by tags (autocomplete)
- **Project search**: Filter by linked projects
- **Date range**: Find notes by creation/modification date
- **Search as you type**: Instant results

#### 2.3 Linking & Backlinks
- **Wiki-style links**: `[[Note Title]]` syntax
- **Backlinks panel**: See all notes linking to current note
- **Graph view**: Visual relationship map (future)
- **Auto-complete**: Suggest note titles while typing

#### 2.4 Templates & Quick Capture
- **Note templates**: Predefined structures (daily note, meeting note, project kickoff)
- **Quick capture**: Global hotkey to create note without opening app
- **Daily notes**: Auto-create/open today's note

#### 2.5 Multi-Vault Support
- **Vault switcher**: Quick switch between vaults
- **Vault library**: Manage multiple vaults
- **Import/Export**: Vault backup, share with team

### Success Criteria
- ✅ User can organize 1000+ notes without performance issues
- ✅ Search returns results in <100ms
- ✅ Linking between notes is seamless
- ✅ Templates accelerate note creation

---

## Phase 3: Cloud Sync Preparation (Local + Metadata)

**Goal**: Prepare architecture for cloud sync without implementing full sync

### Features

#### 3.1 Sync Metadata Layer
- **File versioning**: Track changes locally (git-like)
- **Conflict detection**: Identify potential sync conflicts
- **Change tracking**: Log all file operations (create, update, delete)
- **Sync manifest**: JSON file listing all vault files + checksums

#### 3.2 Identity Integration
- **Supabase auth**: Link vault to authenticated user
- **Vault ownership**: Associate vault with user ID
- **Sync status indicator**: Show "Sync available" if authenticated

#### 3.3 Data Structure for Sync
- **Normalized storage**: Separate content from metadata
- **UUID-based IDs**: Use UUIDs instead of file paths for sync
- **Conflict resolution strategy**: Last-write-wins vs. manual merge
- **Delta sync**: Only sync changed files (not entire vault)

#### 3.4 Local Sync Simulation
- **Test sync engine locally**: Sync between two local vaults
- **Conflict scenarios**: Test merge strategies
- **Performance testing**: Sync 10,000 files

### Success Criteria
- ✅ Vault structure supports future cloud sync
- ✅ File changes are tracked with metadata
- ✅ Conflicts can be detected (not yet resolved)
- ✅ Authenticated users see "Sync ready" indicator

---

## Future Phases (Post-Phase 3)

### Phase 4: Cloud Sync (Supabase Integration)
- Real-time sync via Supabase Storage + Realtime
- Conflict resolution UI
- Sync history/audit log
- Selective sync (folders, file types)

### Phase 5: Mobile Companion App
- React Native or Tauri Mobile
- Read-only mode (initially)
- Offline-first with sync queue
- Share notes to mobile

### Phase 6: Collaboration Features
- Shared vaults (team knowledge base)
- Comments & annotations
- Version history
- Activity feed

### Phase 7: AI-Powered Features
- Semantic search (vector embeddings)
- Auto-tagging
- Related notes suggestions
- Q&A over vault content (RAG)

---

## Technical Considerations

### File Watching at Scale
- Current watcher monitors per-project `.bluekit` directories
- Vault watcher must handle entire vault tree
- Use debouncing (300ms) and event batching
- Consider indexing strategy (SQLite FTS5 vs. Tantivy)

### Sync Architecture (Future)
- **Option 1: File-based sync** (Supabase Storage)
  - Upload markdown files directly
  - Simple, but limited conflict resolution
  - Good for <10K files
- **Option 2: Operational Transform** (CRDT)
  - Like Figma's multiplayer
  - Complex, but handles real-time collaboration
  - Overkill for initial sync
- **Recommended: Hybrid**
  - Use Supabase Storage for files
  - Use Supabase Realtime for presence/notifications
  - Conflict resolution via 3-way merge (similar to git)

### Mobile Strategy
- **Tauri Mobile** (Rust + WebView)
  - Reuse existing codebase
  - iOS + Android from one codebase
  - Still early (alpha as of 2024)
- **React Native**
  - Mature ecosystem
  - Separate codebase, but shared UI components
  - Easier to implement read-only mode

---

## Rollout Plan (Additive, No Migration)

### Step 1: Non-Breaking Introduction (Phase 1)
- Add VaultPage **alongside** existing project workflow
- HomePage → VaultPage (new default landing page)
- Projects tab in vault sidebar shows familiar ProjectsTabContent
- ProjectDetailPage remains unchanged (project notebooks)

### Step 2: Gradual Adoption
- New users see VaultPage first, create vault on first run
- Existing users see VaultPage, prompted to create vault
- Projects work exactly as before (no changes)
- Vault is optional (can skip setup and just use projects tab)

### No Deprecation Planned
- Projects remain first-class citizens (not deprecated)
- Vault complements projects, doesn't replace them
- Both vault and project notebooks coexist
- Interface provides seamless navigation between them

---

## Success Metrics

### Phase 1
- 80% of new users complete vault setup
- Average vault contains 50+ notes in first month
- <1% of users request old project mode

### Phase 2
- Search used in 60% of sessions
- Average 10 internal links per note
- Users organize into 5+ folders

### Phase 3
- 50% of authenticated users enable sync
- <5% of syncs encounter conflicts
- Sync completes in <10 seconds for typical vault

---

## Open Questions

1. **Vault portability**: Should vaults be portable (USB drive, Dropbox folder)?
2. **Git integration**: Should vault be git-friendly (plain files) or use database?
3. **Multi-device without cloud**: Support local network sync (LAN)?
4. **Vault sharing**: Allow read-only vault sharing without full collaboration?
5. **Plugin system**: When to introduce plugins/extensions?

---

## Conclusion

The vault system transforms BlueKit from a **project management tool** into a **personal knowledge management system**. By going local-first with optional cloud sync, we give users full ownership of their data while enabling modern sync/collaboration features.

**Phase 1-3 focus**: Build a rock-solid local vault that works beautifully offline. Cloud sync is a feature, not a requirement.

This positions BlueKit as:
- **Obsidian for code**: Personal knowledge base for developers
- **Notion for engineers**: Structured notes with project context
- **Roam Research for learning**: Networked thought for code patterns

**Next steps**: Begin Phase 1 implementation with vault initialization flow.
