# Publishing Flow

## Overview

A streamlined publishing experience that lets users deliberately choose where each resource goes in the workspace - either as a new catalog or as a version of an existing catalog.

## Core Principles

1. **Deliberate placement** - No blind publishing; user explicitly chooses destination for each resource
2. **Catalog-focused** - Collections are separate (organize after publish)
3. **Familiar UI** - Same catalog view as LibraryTabContent, just in a modal context
4. **PR support** - Repos with branch protection create PRs instead of direct commits

---

## Terminology

| Term | Definition |
|------|------------|
| **Catalog** | A named container for versions of a resource (e.g., "Button", "useAuth Hook") |
| **Version** | A specific published snapshot of a resource within a catalog (v1, v2, v2-dark-mode) |

---

## User Flow

### Entry Point

User selects resources in KitsTabContent (or WalkthroughsTabContent, etc.) and clicks "Publish to Library"

### Step 1: Publish Modal Opens

Shows:
- Workspace selector (if multiple workspaces)
- List of resources being published
- Catalog browser (same UI as LibraryTabContent)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Publish to Library                                              [X]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Workspace: [My Components ▾]                                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ PUBLISHING (3 resources)                                        │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ Button.md                                               │   │   │
│  │  │ ○ New Catalog                    [Button         ]      │   │   │
│  │  │ ● Add to existing               [UI / Button   ▾]       │   │   │
│  │  │   ○ Create new version (v3)                             │   │   │
│  │  │   ● Overwrite existing    [v2 - dark mode ▾]            │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ Card.md                                                 │   │   │
│  │  │ ● New Catalog                    [Card           ]      │   │   │
│  │  │ ○ Add to existing               [Search...      ▾]      │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ Modal.md                                                │   │   │
│  │  │ ○ New Catalog                    [Modal          ]      │   │   │
│  │  │ ● Add to existing               [UI / Modal    ▾]       │   │   │
│  │  │   ● Create new version (v3)                             │   │   │
│  │  │   ○ Overwrite existing    [v2           ▾]              │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  BROWSE CATALOGS                                    [Filter] [Card|Table]│
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │ │ Button  │  │ Modal   │  │ Form    │  │ Table   │             │   │
│  │ │ 2 vers  │  │ 2 vers  │  │ 1 ver   │  │ 3 vers  │             │   │
│  │ └─────────┘  └─────────┘  └─────────┘  └─────────┘             │   │
│  │                                                                 │   │
│  │ ┌─────────┐  ┌─────────┐  ┌─────────┐                          │   │
│  │ │ Hooks   │  │ Utils   │  │ Theme   │                          │   │
│  │ │ 5 vers  │  │ 2 vers  │  │ 1 ver   │                          │   │
│  │ └─────────┘  └─────────┘  └─────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                                    [Cancel] [Publish]   │
│                                                              ↑ green    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Interaction Details

**For each resource being published:**

1. **Default state**: "New Catalog" selected, name pre-filled from resource name
2. **Switch to existing**: Click "Add to existing" radio
   - Dropdown shows searchable list of existing catalogs
   - Grouped by collection (if any) for context
   - Shows current version count
3. **When "Add to existing" is selected**, choose version strategy:
   - **Create new version** (default): Adds as v{n+1}
   - **Overwrite existing**: Select which version to replace from dropdown

**Catalog browser (bottom section):**
- Same card/table view as LibraryTabContent
- Click a catalog card = quick-assign selected resource to that catalog
- Filter by name/tags
- Visual indicator on catalogs that are targets for current publish

**Smart matching (optional enhancement):**
- If resource name matches existing catalog name, pre-suggest it
- Show "Suggested" badge on likely matches

### Step 2: Publish Execution

User clicks green "Publish" button:

1. **Validate**: Check all resources have valid destinations
2. **For each resource**:
   - If "New Catalog": Create catalog + first version (v1)
   - If "Add to existing" + "Create new version": Create new version
   - If "Add to existing" + "Overwrite": Update existing version in place
3. **Commit strategy**:
   - Direct push (default): Single commit with all changes
   - PR mode (if branch protected): Create PR with all changes

```
Publishing 3 resources...
├─ Button.md → UI / Button (overwrite v2)   ✓
├─ Card.md → Card (new catalog, v1)         ✓
└─ Modal.md → UI / Modal (new version, v3)  ✓

✓ Published successfully
  1 new version created
  1 version overwritten
  1 new catalog created
```

---

## PR Mode for Protected Repos

When the target branch has protection rules:

1. **Detection**: Check repo settings via GitHub API on modal open
2. **UI indicator**: Show "This will create a Pull Request" message
3. **PR creation**:
   - Branch: `bluekit/publish-{timestamp}`
   - Title: "BlueKit: Publish {n} resources"
   - Body: List of resources and their destinations
4. **Post-publish**: Show link to created PR

```
┌─────────────────────────────────────────────────────────────────┐
│ ℹ️ This workspace has branch protection enabled.                │
│    Publishing will create a Pull Request for review.            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Publish Item State

```typescript
interface PublishItem {
  // Source
  resourcePath: string;
  resourceName: string;
  resourceType: 'kit' | 'walkthrough' | 'agent' | 'diagram';
  content: string;
  frontMatter: Record<string, any>;

  // Destination
  destinationType: 'new' | 'existing';

  // If new catalog
  newCatalogName?: string;

  // If existing catalog
  existingCatalogId?: string;
  existingCatalogName?: string;

  // Version strategy (only when destinationType === 'existing')
  versionStrategy: 'create' | 'overwrite';

  // If create new version
  newVersionTag?: string; // Auto-calculated: v2, v3, etc. or custom

  // If overwrite existing
  overwriteVersionId?: string;
  overwriteVersionTag?: string;
}

interface PublishModalState {
  workspaceId: string;
  items: PublishItem[];
  catalogs: CatalogWithVersions[]; // For browser
  isLoading: boolean;
  isPRMode: boolean;
}
```

### Catalog With Versions

```typescript
interface CatalogWithVersions {
  catalog: LibraryCatalog;
  versions: LibraryVersion[];
}

interface LibraryVersion {
  id: string;
  catalog_id: string;
  content_hash: string;
  github_commit_sha: string;
  version_tag: string; // v1, v2, v2-dark-mode, etc.
  publisher_id: string;
  published_at: number;
  remote_path: string;
}
```

### Publish Result

```typescript
interface PublishResult {
  success: boolean;
  mode: 'direct' | 'pr';
  prUrl?: string; // If PR mode
  results: {
    resourcePath: string;
    catalogId: string;
    versionId: string;
    versionTag: string;
    action: 'new_catalog' | 'new_version' | 'overwrite';
  }[];
  errors: {
    resourcePath: string;
    error: string;
  }[];
}
```

---

## Component Structure

```
src/components/library/
├── PublishModal.tsx              # Main modal container
├── PublishItemList.tsx           # List of resources being published
├── PublishItemRow.tsx            # Single resource row with destination picker
├── CatalogPicker.tsx             # Searchable dropdown for existing catalogs
├── VersionPicker.tsx             # Dropdown for selecting version to overwrite
├── PublishCatalogBrowser.tsx     # Reuses catalog card/table view
└── PublishConfirmation.tsx       # Success/error state after publish
```

### PublishModal.tsx

```typescript
interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: ResourceFile[];
  projectPath: string;
  onPublishComplete?: (result: PublishResult) => void;
}

function PublishModal({ isOpen, onClose, resources, projectPath, onPublishComplete }: PublishModalProps) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [items, setItems] = useState<PublishItem[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogWithVersions[]>([]);
  const [isPRMode, setIsPRMode] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Initialize items from resources
  useEffect(() => {
    const initialItems = resources.map(r => ({
      resourcePath: r.path,
      resourceName: r.frontMatter?.alias || r.name,
      resourceType: r.resourceType,
      content: '', // Load on demand
      frontMatter: r.frontMatter || {},
      destinationType: 'new' as const,
      newCatalogName: r.frontMatter?.alias || r.name,
      versionStrategy: 'create' as const,
    }));
    setItems(initialItems);
  }, [resources]);

  // Load catalogs when workspace changes
  useEffect(() => {
    if (workspaceId) {
      loadCatalogs(workspaceId);
      checkBranchProtection(workspaceId);
    }
  }, [workspaceId]);

  // Handle destination change for an item
  const handleDestinationChange = (index: number, update: Partial<PublishItem>) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, ...update } : item
    ));
  };

  // Handle quick-assign from catalog browser
  const handleCatalogClick = (catalog: LibraryCatalog) => {
    // Find first item that's set to "new" and assign it
    const firstNewIndex = items.findIndex(i => i.destinationType === 'new');
    if (firstNewIndex >= 0) {
      const catalogWithVersions = catalogs.find(c => c.catalog.id === catalog.id);
      const nextVersion = `v${(catalogWithVersions?.versions.length || 0) + 1}`;
      handleDestinationChange(firstNewIndex, {
        destinationType: 'existing',
        existingCatalogId: catalog.id,
        existingCatalogName: catalog.name,
        versionStrategy: 'create',
        newVersionTag: nextVersion,
      });
    }
  };

  // Execute publish
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await executePublish(workspaceId, items, isPRMode);
      onPublishComplete?.(result);
      if (result.success) {
        onClose();
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // ... render
}
```

---

## Backend Changes

### New IPC Commands

```rust
// Check if repo has branch protection
#[tauri::command]
pub async fn check_branch_protection(
    workspace_id: String,
) -> Result<BranchProtectionInfo, String> {
    // GET /repos/{owner}/{repo}/branches/{branch}/protection
    // Returns whether PR is required
}

// Bulk publish resources
#[tauri::command]
pub async fn publish_resources(
    workspace_id: String,
    items: Vec<PublishItemRequest>,
    create_pr: bool,
) -> Result<PublishResult, String> {
    // 1. Load workspace info
    // 2. For each item:
    //    - If new catalog: create catalog + first version
    //    - If existing + create: create new version
    //    - If existing + overwrite: update version in place
    // 3. If create_pr:
    //    - Create branch
    //    - Commit all changes
    //    - Create PR
    // 4. Else:
    //    - Commit directly to main
}

#[derive(Deserialize)]
pub struct PublishItemRequest {
    pub resource_path: String,
    pub destination_type: String, // "new" | "existing"
    pub new_catalog_name: Option<String>,
    pub existing_catalog_id: Option<String>,
    pub version_strategy: String, // "create" | "overwrite"
    pub new_version_tag: Option<String>,
    pub overwrite_version_id: Option<String>,
}
```

---

## Version Numbering

**Auto-versioning rules:**

1. **New catalog**: Always `v1`
2. **Create new version**: `v{n+1}` where `n` is current version count
3. **Overwrite**: Keeps same version tag (content changes, tag stays)
4. **Manual override**: User can type custom version tag (e.g., `v2-dark-mode`)

**Display in UI:**

```
Add to existing: [UI / Button ▾]
  ● Create new version      [v3    ] ← editable
  ○ Overwrite existing      [v2 - dark mode ▾]
```

---

## Overwrite Behavior

When overwriting a version:

1. **Content replaced**: New file content replaces old
2. **Metadata updated**: `published_at`, `publisher_id`, `content_hash` updated
3. **Version tag preserved**: Unless user explicitly changes it
4. **Git history**: Shows as file update in same path (not delete + create)

**Use cases for overwrite:**
- Fix typo in published kit
- Update code example without creating new version
- Correct documentation error

**Use cases for new version:**
- Significant changes to the kit
- Breaking changes
- Want to preserve old version for reference

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Workspace not selected | Disable publish button, show helper text |
| Resource has no destination | Show validation error on that row |
| Catalog name already exists | Show warning, suggest "Add to existing" |
| Version tag already exists | Show error, prompt for different tag |
| GitHub API error | Show error toast, allow retry |
| PR creation fails | Show error, offer "try direct push" if permissions allow |
| Partial failure | Show which succeeded/failed, allow retry for failed items |

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/library/PublishModal.tsx` | New - main modal |
| `src/components/library/PublishItemList.tsx` | New - resource list |
| `src/components/library/PublishItemRow.tsx` | New - single row with version strategy |
| `src/components/library/CatalogPicker.tsx` | New - searchable dropdown |
| `src/components/library/VersionPicker.tsx` | New - version dropdown for overwrite |
| `src/components/kits/KitsTabContent.tsx` | Add "Publish" button in action bar |
| `src/ipc/library.ts` | Add `publishResources`, `checkBranchProtection` |
| `src-tauri/src/commands.rs` | Add new commands |
| `src-tauri/src/library/publishing.rs` | Bulk publish logic with overwrite support |
| `src/types/github.ts` | Rename `LibraryVariation` → `LibraryVersion` |

---

## Migration Notes

### Renaming Variation → Version

Database tables and columns to rename:
- `library_variations` → `library_versions`
- `variation_id` → `version_id`
- Related foreign keys

Frontend types to rename:
- `LibraryVariation` → `LibraryVersion`
- `CatalogWithVariations` → `CatalogWithVersions`
- `selectedVariations` → `selectedVersions`

Backend structs to rename:
- Similar pattern in Rust code

---

## Future Enhancements

1. **Drag & drop**: Drag resources onto catalog cards to assign
2. **Batch assign**: "Set all to new" / "Set all to existing [X]"
3. **Template memory**: Remember last publish choices for similar resources
4. **Diff preview**: Show what will change when overwriting
5. **Publish history**: See recent publishes with undo option
6. **Version comparison**: Side-by-side diff of versions

---

## Summary

The publishing flow is:

1. **Select resources** in project view
2. **Open publish modal** - see workspace selector + resource list + catalog browser
3. **Choose destination** for each resource:
   - New catalog (creates v1)
   - Add to existing → Create new version (v2, v3...)
   - Add to existing → Overwrite existing version
4. **Click Publish** - creates catalogs/versions, handles PR if needed
5. **Organize later** - add to collections in the library view

This keeps publishing focused on **content placement** and **versioning**, while separating **organization** into a distinct workflow.
