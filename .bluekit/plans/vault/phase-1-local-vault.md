# Phase 1: Local Vault Foundation

## Goal
Add VaultPage as the new main interface with a personal vault notebook. **Vault is literally just a project with `is_vault = true`** - reuse all existing project infrastructure.

---

## Key Insight: Vault = Special Project

```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  is_vault: boolean;  // ← Add this flag, that's it!
  git_url?: string;
  git_connected: boolean;
  created_at: number;
  updated_at: number;
}
```

**Everything else is reused:**
- Same `.bluekit` directory structure
- Same file watching (`watch_project_artifacts`)
- Same artifact loading (`get_project_artifacts`)
- Same notebook UI (`NotebookTree`, `NoteViewPage`)
- Same file operations (create, edit, delete)

---

## User Stories

### US-1: First-Time Vault Setup
**As a** new user
**I want to** create my first vault after signing in
**So that** I have a central place for my personal knowledge

**Acceptance Criteria**:
- After WelcomeScreen, if no vault exists, show VaultSetupScreen
- User can choose vault location (default: `~/Documents/BlueKitVault`)
- User can name their vault
- Vault is created as a project with `is_vault = true`
- User is redirected to VaultPage after setup

### US-2: Vault as Home
**As a** returning user
**I want to** land on VaultPage when opening BlueKit
**So that** I can access both my vault and projects

**Acceptance Criteria**:
- App opens directly to VaultPage
- Vault project is automatically loaded (query `WHERE is_vault = 1`)
- Sidebar shows Projects/Library/Workflows/Tasks tabs
- Vault notebook (file tree + editor) visible in content area

### US-3: Note Management
**As a** user
**I want to** create, edit, and organize notes in my vault
**So that** I can capture knowledge

**Acceptance Criteria**:
- Can create new markdown notes via UI
- Can edit notes with NoteViewPage (same as projects)
- Can organize notes into folders
- Changes saved to disk immediately
- File watcher updates UI when external changes occur

### US-4: Project Access from Vault
**As a** user
**I want to** access my projects from the vault sidebar
**So that** I can navigate between vault and project notebooks

**Acceptance Criteria**:
- Projects tab shows ProjectsTabContent (unchanged)
- Click project → Navigate to ProjectDetailPage
- Back button → Return to VaultPage
- Projects remain fully functional

---

## Implementation Checklist

### Backend Tasks (30 minutes)

#### Database Migration
- [ ] Add `is_vault` column to projects table:
  ```sql
  ALTER TABLE projects ADD COLUMN is_vault INTEGER DEFAULT 0;
  ```

#### Command Updates
- [ ] Modify `create_project` to accept optional `is_vault` parameter
  ```rust
  #[tauri::command]
  async fn create_project(
      path: String,
      name: String,
      description: Option<String>,
      is_vault: Option<bool>  // ← Add this
  ) -> Result<Project, String>
  ```

- [ ] Add `get_vault_project` command:
  ```rust
  #[tauri::command]
  async fn get_vault_project() -> Result<Option<Project>, String> {
      // SELECT * FROM projects WHERE is_vault = 1 LIMIT 1
  }
  ```

- [ ] Add `set_vault_project` command (optional - for switching vaults):
  ```rust
  #[tauri::command]
  async fn set_vault_project(project_id: String) -> Result<(), String> {
      // UPDATE projects SET is_vault = 0 WHERE is_vault = 1
      // UPDATE projects SET is_vault = 1 WHERE id = ?
  }
  ```

**That's it for backend!** Everything else already exists.

---

### Frontend Tasks (2-3 days)

#### New Components

##### 1. VaultSetupScreen.tsx (50 lines)
```typescript
export default function VaultSetupScreen({ onCreate }: Props) {
  const [vaultPath, setVaultPath] = useState('');
  const [vaultName, setVaultName] = useState('');

  const handleChooseLocation = async () => {
    const path = await invokeSelectDirectory();
    setVaultPath(path);
  };

  const handleCreate = async () => {
    // Create project with is_vault = true
    const project = await invokeCreateProject(vaultPath, vaultName, null, true);
    onCreate(project);
  };

  return (
    <Dialog>
      <Heading>Create Your Vault</Heading>
      <Input value={vaultPath} readOnly onClick={handleChooseLocation} />
      <Input value={vaultName} onChange={(e) => setVaultName(e.target.value)} />
      <Button onClick={handleCreate}>Create Vault</Button>
    </Dialog>
  );
}
```

##### 2. VaultPage.tsx (100 lines)
```typescript
export default function VaultPage({ onProjectSelect }: Props) {
  const [vaultProject, setVaultProject] = useState<Project | null>(null);

  useEffect(() => {
    invokeGetVaultProject().then(setVaultProject);
  }, []);

  if (!vaultProject) {
    return <VaultSetupScreen onCreate={setVaultProject} />;
  }

  return (
    <VStack h="100vh">
      <Header currentProject={vaultProject} />
      <Splitter>
        <VaultSidebar onProjectSelect={onProjectSelect} />

        {/* Reuse ProjectDetailPage notebook logic */}
        <VaultNotebook project={vaultProject} />
      </Splitter>
    </VStack>
  );
}
```

##### 3. VaultSidebar.tsx (80 lines)
```typescript
export default function VaultSidebar({ onProjectSelect }: Props) {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    invokeDbGetProjects().then(projs => {
      // Filter out vault projects
      setProjects(projs.filter(p => !p.is_vault));
    });
  }, []);

  return (
    <Box>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="projects">Projects</Tabs.Trigger>
          <Tabs.Trigger value="library">Library</Tabs.Trigger>
          <Tabs.Trigger value="workflows">Workflows</Tabs.Trigger>
          <Tabs.Trigger value="tasks">Tasks</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="projects">
          <ProjectsTabContent
            projects={projects}
            onProjectSelect={onProjectSelect}
          />
        </Tabs.Content>

        <Tabs.Content value="library">
          <LibraryTabContent />
        </Tabs.Content>

        <Tabs.Content value="workflows">
          <WorkflowsTabContent />
        </Tabs.Content>

        <Tabs.Content value="tasks">
          <TasksTabContent context="workspace" projects={projects} />
        </Tabs.Content>
      </Tabs>
    </Box>
  );
}
```

##### 4. VaultNotebook.tsx (80 lines)
```typescript
export default function VaultNotebook({ project }: { project: Project }) {
  // Copy logic from ProjectDetailPage content area
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);

  useEffect(() => {
    // Load vault files (same as project files)
    invokeGetProjectArtifacts(project.path).then(setArtifacts);

    // Watch for changes (same as project)
    invokeWatchProjectArtifacts(project.path);

    const unlisten = listen(`project-artifacts-changed-${sanitizePath(project.path)}`, () => {
      invokeGetProjectArtifacts(project.path).then(setArtifacts);
    });

    return () => unlisten();
  }, [project.path]);

  return (
    <Splitter>
      <NotebookTree
        projectPath={project.path}
        artifacts={artifacts}
        onFileSelect={setSelectedFile}
      />
      {selectedFile && (
        <NoteViewPage
          resource={selectedFile}
          // ... same props as ProjectDetailPage
        />
      )}
    </Splitter>
  );
}
```

#### Modified Components

- [ ] **App.tsx** (5 line change):
  ```typescript
  // Before:
  <Route path="/" element={<HomePage />} />

  // After:
  <Route path="/" element={<VaultPage onProjectSelect={handleProjectSelect} />} />
  ```

- [ ] **Header.tsx** (10 lines):
  ```typescript
  // Show vault name when currentProject.is_vault = true
  {currentProject?.is_vault && (
    <Text>📖 {currentProject.name}</Text>
  )}
  ```

- [ ] **ProjectsTabContent.tsx** (2 lines):
  ```typescript
  // Filter out vault from project list
  const regularProjects = projects.filter(p => !p.is_vault);
  ```

#### Reused Components (No Changes)
- ✅ `NotebookTree` - File tree (works with vault path)
- ✅ `NoteViewPage` - Note editor (works with vault files)
- ✅ `ProjectDetailPage` - Project notebooks (unchanged)
- ✅ `LibraryTabContent`, `WorkflowsTabContent`, `TasksTabContent`

---

## Data Flow Diagrams

### App Start Flow
```
User opens app
    ↓
WelcomeScreen (auth/skip)
    ↓
Query: SELECT * FROM projects WHERE is_vault = 1
    ├─ Found → Load VaultPage with vault project
    └─ Not found → Show VaultSetupScreen
```

### Vault Creation Flow
```
VaultSetupScreen
    ↓
User picks location + enters name
    ↓
IPC: invokeCreateProject(path, name, null, true)  // is_vault = true
    ↓
Rust: INSERT INTO projects (..., is_vault = 1)
    ↓
Create .bluekit directory (same as any project)
    ↓
Return Project object
    ↓
Navigate to VaultPage
```

### File Operations (Same as Projects)
```
User creates note in vault
    ↓
Write to <vault-path>/<file>.md
    ↓
File watcher detects change
    ↓
Emit event: project-artifacts-changed-<vault-path>
    ↓
Frontend reloads artifacts via get_project_artifacts
    ↓
UI updates
```

---

## Comparison: Vault vs. Project

| Feature | Project | Vault | Difference |
|---------|---------|-------|------------|
| Database storage | `projects` table | `projects` table | `is_vault = 1` |
| Directory structure | `.bluekit/` | `.bluekit/` | None |
| File watching | `watch_project_artifacts` | `watch_project_artifacts` | None |
| Loading files | `get_project_artifacts` | `get_project_artifacts` | None |
| UI components | `NotebookTree`, `NoteViewPage` | `NotebookTree`, `NoteViewPage` | None |
| Sidebar | Project-specific tabs | Projects/Library/Workflows/Tasks | Different tabs |
| Navigation | ProjectDetailPage | VaultPage | Different page component |

**99% of infrastructure is shared!**

---

## Testing Strategy

### Manual Testing (1 hour)
- [ ] Create vault from VaultSetupScreen
- [ ] Verify `.bluekit` directory created
- [ ] Create note in vault, verify file saved
- [ ] Edit note externally (VS Code), verify UI updates
- [ ] Navigate: VaultPage → Projects tab → Click project → ProjectDetailPage
- [ ] Navigate back: ProjectDetailPage → VaultPage
- [ ] Restart app, verify vault loads automatically

### Edge Cases
- [ ] What if user creates multiple vaults? (Only one `is_vault = 1` allowed)
- [ ] What if vault directory is deleted? (Handle gracefully, prompt to recreate)
- [ ] Can vault be deleted? (Yes, via projects management, but warn user)

---

## Timeline

### Day 1: Backend (1-2 hours)
- Add `is_vault` column migration
- Update `create_project` command
- Add `get_vault_project` command
- Test with SQLite CLI

### Day 2-3: Frontend Components (8-10 hours)
- Build VaultSetupScreen
- Build VaultPage (copy ProjectDetailPage layout)
- Build VaultSidebar
- Build VaultNotebook (copy ProjectDetailPage content logic)

### Day 4: Integration (4-6 hours)
- Update App.tsx routing
- Update Header.tsx
- Filter vault from ProjectsTabContent
- Test navigation flows

### Day 5: Polish & Testing (2-4 hours)
- Fix bugs
- Add loading states
- Add error handling
- Manual testing checklist
- Documentation

**Total: 1 week (instead of 4 weeks!)**

---

## Success Criteria (Phase 1 Complete)

- [ ] User can create vault from VaultSetupScreen
- [ ] Vault is stored as `projects` row with `is_vault = 1`
- [ ] VaultPage is default landing page
- [ ] Sidebar tabs work (Projects/Library/Workflows/Tasks)
- [ ] Vault notebook displays file tree + note editor
- [ ] Can create/edit/delete vault notes (same as projects)
- [ ] File watcher updates vault UI in real-time
- [ ] Navigation: VaultPage ↔ ProjectDetailPage works
- [ ] Projects remain fully functional (no regression)
- [ ] Only ~300 lines of new code (vs. 2000+ if separate system)

**Definition of Done**: A user can create a vault, add 10 notes, navigate between vault and project notebooks, and use both for a week without bugs.

---

## Why This Architecture Works

### Benefits of Vault = Project

1. **Minimal Code**: ~300 lines of new code vs. 2000+ for separate system
2. **Consistency**: Same UX as projects (familiar to users)
3. **Reliability**: Reuse battle-tested infrastructure
4. **Performance**: No new database tables, no new file watchers
5. **Maintainability**: One codebase to maintain, not two

### Trade-offs

- **Conceptual Clarity**: Vault "feels" special but is technically a project
  - Mitigation: UI treats it differently (VaultPage vs. ProjectDetailPage)
- **Single Vault Constraint**: Only one project can be `is_vault = 1`
  - Mitigation: Sufficient for MVP, multi-vault in Phase 2 if needed

---

## Next Steps

After Phase 1 completes:
- **Phase 2**: Add search, wiki links, templates (enhance both vault AND projects)
- **Phase 3**: Sync preparation (metadata applies to vault AND projects)
- **Phase 4**: Cloud sync (sync vault AND projects to Supabase)

The beauty of this architecture: All future features benefit both vault and projects!
