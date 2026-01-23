# Vault Implementation Guide

## Quick Start

**Implementation time: 1 week (~20 hours)**

This guide walks you through implementing Phase 1 of the vault system.

---

## Step 1: Database Migration (30 minutes)

### Add `is_vault` Column

```rust
// src-tauri/src/db.rs

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    // ... existing migrations

    // Migration: Add is_vault column
    conn.execute(
        "ALTER TABLE projects ADD COLUMN is_vault INTEGER DEFAULT 0",
        [],
    ).or_else(|e| {
        // Ignore "duplicate column" error if migration already ran
        if e.to_string().contains("duplicate column") {
            Ok(0)
        } else {
            Err(e)
        }
    }).map_err(|e| format!("Failed to add is_vault column: {}", e))?;

    Ok(())
}
```

### Test Migration

```bash
# Backup database first
cp ~/.bluekit/bluekit.db ~/.bluekit/bluekit.db.backup

# Run app to apply migration
npm run tauri dev

# Verify column added
sqlite3 ~/.bluekit/bluekit.db "PRAGMA table_info(projects);"
# Should show: is_vault | INTEGER | 0 | | 0
```

---

## Step 2: Backend Commands (1 hour)

### Modify `create_project` Command

```rust
// src-tauri/src/commands.rs

#[tauri::command]
pub async fn create_project(
    path: String,
    name: String,
    description: Option<String>,
    is_vault: Option<bool>,  // ← Add this parameter
) -> Result<Project, String> {
    let project_id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    // Create .bluekit directory
    create_bluekit_directory(&path)?;

    // Insert into database
    let conn = get_db_connection()?;
    conn.execute(
        "INSERT INTO projects (id, name, path, description, is_vault, git_url, git_connected, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, 0, ?6, ?7)",
        params![
            &project_id,
            &name,
            &path,
            description.as_deref(),
            is_vault.unwrap_or(false) as i32,  // ← Default to false
            now,
            now,
        ],
    ).map_err(|e| format!("Failed to insert project: {}", e))?;

    Ok(Project {
        id: project_id,
        name,
        path,
        description,
        is_vault: is_vault.unwrap_or(false),
        git_url: None,
        git_connected: false,
        created_at: now,
        updated_at: now,
    })
}
```

### Add `get_vault_project` Command

```rust
// src-tauri/src/commands.rs

#[tauri::command]
pub async fn get_vault_project() -> Result<Option<Project>, String> {
    let conn = get_db_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, name, path, description, is_vault, git_url, git_connected, created_at, updated_at
         FROM projects
         WHERE is_vault = 1
         LIMIT 1"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let result = stmt.query_row([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            description: row.get(3)?,
            is_vault: row.get::<_, i32>(4)? == 1,
            git_url: row.get(5)?,
            git_connected: row.get::<_, i32>(6)? == 1,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    });

    match result {
        Ok(project) => Ok(Some(project)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}
```

### Register Commands

```rust
// src-tauri/src/main.rs

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            get_vault_project,  // ← Add this
            // create_project already exists, just modified
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Update TypeScript Interfaces

```typescript
// src/ipc.ts

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  is_vault: boolean;  // ← Add this
  git_url?: string;
  git_connected: boolean;
  created_at: number;
  updated_at: number;
}

// Update create_project wrapper
export async function invokeCreateProject(
  path: string,
  name: string,
  description?: string,
  isVault?: boolean  // ← Add this
): Promise<Project> {
  return await invokeWithTimeout('create_project', { path, name, description, is_vault: isVault });
}

// Add new wrapper
export async function invokeGetVaultProject(): Promise<Project | null> {
  return await invokeWithTimeout('get_vault_project', {});
}
```

---

## Step 3: Frontend Components (8-10 hours)

### 3.1 VaultSetupScreen (50 lines)

```tsx
// src/components/vault/VaultSetupScreen.tsx

import { useState } from 'react';
import { Box, VStack, Heading, Text, Button, Input } from '@chakra-ui/react';
import { open } from '@tauri-apps/api/dialog';
import { invokeCreateProject } from '../../ipc';
import type { Project } from '../../ipc';

interface VaultSetupScreenProps {
  onCreate: (project: Project) => void;
}

export default function VaultSetupScreen({ onCreate }: VaultSetupScreenProps) {
  const [vaultPath, setVaultPath] = useState('');
  const [vaultName, setVaultName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleChooseLocation = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: '~/Documents',
    });

    if (selected && typeof selected === 'string') {
      setVaultPath(selected);
    }
  };

  const handleCreate = async () => {
    if (!vaultPath || !vaultName) return;

    try {
      setIsCreating(true);
      const project = await invokeCreateProject(vaultPath, vaultName, undefined, true);
      onCreate(project);
    } catch (error) {
      console.error('Failed to create vault:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      p={8}
    >
      <VStack gap={6} maxW="500px" w="100%">
        <Heading size="2xl">Create Your Vault</Heading>
        <Text textAlign="center" color="fg.muted">
          Choose a location for your personal knowledge base
        </Text>

        <VStack gap={4} w="100%">
          <Box w="100%">
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Vault Location
            </Text>
            <Input
              value={vaultPath}
              readOnly
              placeholder="Click to choose location..."
              onClick={handleChooseLocation}
              cursor="pointer"
            />
          </Box>

          <Box w="100%">
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Vault Name
            </Text>
            <Input
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="Personal Vault"
            />
          </Box>

          <Button
            w="100%"
            colorPalette="primary"
            onClick={handleCreate}
            loading={isCreating}
            disabled={!vaultPath || !vaultName}
          >
            Create Vault
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
}
```

### 3.2 VaultPage (100 lines)

```tsx
// src/pages/VaultPage.tsx

import { useState, useEffect } from 'react';
import { VStack, Box, Splitter } from '@chakra-ui/react';
import Header from '../components/Header';
import VaultSetupScreen from '../components/vault/VaultSetupScreen';
import VaultSidebar from '../components/vault/VaultSidebar';
import VaultNotebook from '../components/vault/VaultNotebook';
import { invokeGetVaultProject } from '../ipc';
import type { Project } from '../ipc';

interface VaultPageProps {
  onProjectSelect: (project: Project) => void;
}

export default function VaultPage({ onProjectSelect }: VaultPageProps) {
  const [vaultProject, setVaultProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVault();
  }, []);

  const loadVault = async () => {
    try {
      const vault = await invokeGetVaultProject();
      setVaultProject(vault);
    } catch (error) {
      console.error('Failed to load vault:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minH="100vh"
      >
        Loading vault...
      </Box>
    );
  }

  if (!vaultProject) {
    return <VaultSetupScreen onCreate={setVaultProject} />;
  }

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
      <Box flexShrink={0} bg="transparent">
        <Header currentProject={vaultProject} />
      </Box>

      <Box flex="1" minH={0} overflow="hidden" bg="transparent">
        <Splitter.Root
          defaultSize={[18, 82]}
          panels={[
            { id: 'sidebar', minSize: 15, maxSize: 40 },
            { id: 'content', minSize: 60 },
          ]}
          h="100%"
          orientation="horizontal"
        >
          <Splitter.Panel id="sidebar">
            <VaultSidebar onProjectSelect={onProjectSelect} />
          </Splitter.Panel>

          <Splitter.ResizeTrigger id="sidebar:content" />

          <Splitter.Panel id="content">
            <VaultNotebook project={vaultProject} />
          </Splitter.Panel>
        </Splitter.Root>
      </Box>
    </VStack>
  );
}
```

### 3.3 VaultSidebar (80 lines)

```tsx
// src/components/vault/VaultSidebar.tsx

import { useState, useEffect } from 'react';
import { Box, Tabs, HStack, Icon, Text } from '@chakra-ui/react';
import { LuFolder, LuLibrary, LuWorkflow, LuListTodo } from 'react-icons/lu';
import ProjectsTabContent from '../projects/ProjectsTabContent';
import LibraryTabContent from '../library/LibraryTabContent';
import WorkflowsTabContent from '../workflows/WorkflowsTabContent';
import TasksTabContent from '../tasks/TasksTabContent';
import { invokeDbGetProjects } from '../../ipc';
import type { Project } from '../../ipc';

interface VaultSidebarProps {
  onProjectSelect: (project: Project) => void;
}

export default function VaultSidebar({ onProjectSelect }: VaultSidebarProps) {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const allProjects = await invokeDbGetProjects();
      // Filter out vault projects
      setProjects(allProjects.filter(p => !p.is_vault));
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setProjectsLoading(false);
    }
  };

  return (
    <Box h="100%" overflow="hidden">
      <Tabs.Root
        value={activeTab}
        onValueChange={(e) => setActiveTab(e.value as string)}
        h="100%"
      >
        <Tabs.List>
          <Tabs.Trigger value="projects">
            <HStack gap={2}>
              <Icon><LuFolder /></Icon>
              <Text>Projects</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="library">
            <HStack gap={2}>
              <Icon><LuLibrary /></Icon>
              <Text>Library</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="workflows">
            <HStack gap={2}>
              <Icon><LuWorkflow /></Icon>
              <Text>Workflows</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="tasks">
            <HStack gap={2}>
              <Icon><LuListTodo /></Icon>
              <Text>Tasks</Text>
            </HStack>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="projects">
          <ProjectsTabContent
            projects={projects}
            projectsLoading={projectsLoading}
            error={null}
            onProjectSelect={onProjectSelect}
            onProjectsChanged={loadProjects}
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
      </Tabs.Root>
    </Box>
  );
}
```

### 3.4 VaultNotebook (80 lines)

Copy logic from `ProjectDetailPage.tsx` content area. Load artifacts using `invokeGetProjectArtifacts(project.path)` and watch using `invokeWatchProjectArtifacts(project.path)`.

---

## Step 4: Integration (4-6 hours)

### Update App.tsx Routing

```tsx
// src/App.tsx

<Routes>
  {/* Before: */}
  {/* <Route path="/" element={<HomePage />} /> */}

  {/* After: */}
  <Route path="/" element={<VaultPage onProjectSelect={handleProjectSelect} />} />

  {/* ProjectDetailPage remains unchanged */}
  <Route path="/project/:id" element={<ProjectDetailPage ... />} />
</Routes>
```

### Update Header.tsx

```tsx
// src/components/Header.tsx

// Show vault icon when currentProject?.is_vault === true
{currentProject?.is_vault && (
  <HStack gap={2}>
    <Icon boxSize={5}>📖</Icon>
    <Text>{currentProject.name}</Text>
  </HStack>
)}
```

### Filter Vault from ProjectsTabContent

```tsx
// src/components/vault/VaultSidebar.tsx (already done above)

const projects = allProjects.filter(p => !p.is_vault);
```

---

## Step 5: Testing (2-4 hours)

### Manual Testing Checklist

- [ ] Start app → See VaultSetupScreen (if no vault)
- [ ] Create vault → Directory picker works
- [ ] Create vault → `.bluekit` directory created
- [ ] Create vault → Redirected to VaultPage
- [ ] Restart app → Vault loads automatically
- [ ] Create note in vault → File saved
- [ ] Edit note externally (VS Code) → UI updates
- [ ] Navigate: Projects tab → Click project → ProjectDetailPage
- [ ] Navigate: ProjectDetailPage → Back → VaultPage
- [ ] Verify projects list excludes vault

### Test Database

```bash
sqlite3 ~/.bluekit/bluekit.db

# Check vault exists
SELECT * FROM projects WHERE is_vault = 1;

# Verify only one vault
SELECT COUNT(*) FROM projects WHERE is_vault = 1;
# Should return: 1
```

---

## Troubleshooting

### Vault not loading

```bash
# Check database
sqlite3 ~/.bluekit/bluekit.db "SELECT * FROM projects WHERE is_vault = 1;"

# If empty, create vault from UI or manually:
INSERT INTO projects (id, name, path, is_vault, created_at, updated_at)
VALUES ('test-vault', 'Test Vault', '/path/to/vault', 1, 1234567890, 1234567890);
```

### File watcher not working

Vault uses same watcher as projects. Check `invokeWatchProjectArtifacts(vaultProject.path)` is called.

### Projects tab shows vault

Make sure VaultSidebar filters: `projects.filter(p => !p.is_vault)`

---

## Success Criteria

- [ ] User can create vault
- [ ] Vault stored as project with `is_vault = 1`
- [ ] VaultPage is default landing page
- [ ] All sidebar tabs work
- [ ] Vault notebook shows file tree + editor
- [ ] Can create/edit/delete vault notes
- [ ] File watcher updates UI
- [ ] Navigation VaultPage ↔ ProjectDetailPage works
- [ ] Projects remain fully functional
- [ ] Only ~300 lines of new code

---

## Next Steps

After Phase 1:
- **Phase 2**: Add search, wiki links, templates (benefits both vault AND projects!)
- **Phase 3**: Sync preparation
- **Phase 4**: Cloud sync

---

## Need Help?

See:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full architecture details
- [phase-1-local-vault.md](./phase-1-local-vault.md) - Complete specs
- [vision.md](./vision.md) - Big picture
