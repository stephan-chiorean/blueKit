# Toolkit & Vault Specification

**Status:** Active
**Created:** 2026-01-19
**Supersedes:** personal-library-spec.md, library-flows.md, workspace-architecture-decision.md, toolkit-vault-spec.md

---

## Summary

BlueKit has two personal storage systems:

| System | Purpose | Structure | MCP Access |
|--------|---------|-----------|------------|
| **Toolkit** | Curated building blocks | Required (YAML front matter) | Full |
| **Vault** | Personal workspace, anything goes | Optional | Content search only |

Both are **local-first**. Cloud sync is an optional upgrade when you sign in.

---

## The Mental Model

```
"Toolkit is your toolbelt. Vault is your junk drawer."

Toolkit: Polished, reusable, structured for AI consumption
Vault: Messy, personal, synced for convenience
```

---

## Toolkit

### What It Is

Your curated collection of reusable building blocks:
- **Kits** (single markdown files)
- **Walkthroughs** (directories with database-backed metadata)
- **Agents** (single markdown files)
- **Diagrams** (mermaid files)

### Requirements

Every Toolkit artifact MUST have YAML front matter:

```yaml
---
id: unique-identifier
type: kit | walkthrough | agent | diagram
alias: Human Readable Name
description: One clear sentence about what this does.
tags: [auth, jwt, security]
version: 1
---

# Content here...
```

### Local Storage

```
~/.bluekit/toolkit/
├── kits/
│   ├── jwt-auth-kit.md
│   └── modal-component-kit.md
├── walkthroughs/
│   ├── react-auth-flow/
│   │   ├── walkthrough.json (metadata)
│   │   ├── 01-setup.md
│   │   ├── 02-implementation.md
│   │   └── 03-testing.md
│   └── tauri-basics/
│       └── ...
├── agents/
│   └── debugging-agent.md
└── diagrams/
    └── auth-flow.mmd
```

### Database Tracking

Toolkit catalog stored in SQLite (`~/.bluekit/bluekit.db`):

```sql
CREATE TABLE toolkit_catalog (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,        -- From YAML front matter
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,      -- kit, walkthrough, agent, diagram
  description TEXT,
  tags TEXT,                        -- JSON array
  version INTEGER DEFAULT 1,
  file_path TEXT NOT NULL,          -- Relative to ~/.bluekit/toolkit/
  content_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- For walkthroughs specifically (they're directories)
CREATE TABLE toolkit_walkthroughs (
  id TEXT PRIMARY KEY,
  catalog_id TEXT REFERENCES toolkit_catalog(id),
  directory_path TEXT NOT NULL,
  complexity TEXT,                  -- simple, moderate, comprehensive
  format TEXT,                      -- reference, guide, review, architecture, documentation
  progress INTEGER DEFAULT 0,       -- 0-100
  total_sections INTEGER DEFAULT 0,
  completed_sections INTEGER DEFAULT 0
);
```

### Why Structure Matters

1. **MCP Reliability** - AI workflows need predictable metadata
2. **Findability** - Tags, descriptions, types enable search
3. **Intentionality** - The Toolkit is curated, not dumped
4. **Publishability** - Everything is marketplace-ready

---

## Vault

### What It Is

Your personal cloud workspace. Sync anything:
- Notes
- Drafts
- References
- Random files
- Whatever you want

### Requirements

**None.** Structure is optional. If a file has YAML front matter, it gets richer features (like tag search). If not, it's still synced and searchable by content.

### Local Storage

```
~/.bluekit/vault/
├── notes/
│   ├── meeting-2026-01-19.md
│   └── random-idea.md
├── drafts/
│   └── blog-post-wip.md
├── references/
│   └── api-docs-snippet.md
└── whatever/
    └── anything.txt
```

### Database Tracking

Vault catalog in SQLite:

```sql
CREATE TABLE vault_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,          -- Relative to ~/.bluekit/vault/
  has_frontmatter INTEGER DEFAULT 0,
  -- If has frontmatter, these are populated:
  frontmatter_id TEXT,
  frontmatter_type TEXT,
  frontmatter_tags TEXT,
  frontmatter_description TEXT,
  -- Always tracked:
  content_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### The Promotion Flow

Vault → Toolkit when ready:

```
Vault note: "auth-ideas.md"
        │
        │  You decide: "This is useful, I want to reuse it"
        │
        ▼
Add YAML front matter + structure
        │
        ▼
Move to Toolkit (or "Promote to Toolkit" action)
        │
        ▼
Toolkit artifact: "jwt-auth-kit.md"
```

**The friction is intentional.** Adding front matter is the moment you say "this is ready for duty."

---

## Local-First Architecture

### Why Local-First

1. **Zero friction to start** - No account required
2. **Works offline** - Your stuff is always available
3. **No vendor lock-in** - It's just files
4. **Fast** - No network latency for basic operations

### Storage Locations

```
~/.bluekit/
├── bluekit.db              # SQLite database
├── toolkit/                # Structured artifacts
│   ├── kits/
│   ├── walkthroughs/
│   ├── agents/
│   └── diagrams/
└── vault/                  # Unstructured files
    └── (anything)
```

### Configuration

Users can optionally configure custom paths:

```json
// ~/.bluekit/config.json
{
  "toolkit_path": "~/.bluekit/toolkit",  // Default
  "vault_path": "~/.bluekit/vault"       // Default
}
```

---

## Cloud Sync (Optional)

### When You Sign In

```
┌─────────────────────────────────────────────────────────────┐
│                    Signed Out (Default)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Toolkit: Local only (~/.bluekit/toolkit/)                  │
│  Vault: Local only (~/.bluekit/vault/)                      │
│                                                              │
│  ✓ Everything works                                         │
│  ✓ No account needed                                        │
│  ✗ No cross-device sync                                     │
│  ✗ No MCP API access                                        │
│  ✗ No marketplace publishing                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Sign in with Google/GitHub/Email
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Signed In                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Toolkit: Local + synced to Supabase                        │
│  Vault: Local + synced to Supabase                          │
│                                                              │
│  ✓ Everything works                                         │
│  ✓ Cross-device sync                                        │
│  ✓ MCP API access (Toolkit only)                           │
│  ✓ Marketplace publishing (Toolkit only)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Sync Strategy

When signed in:
1. **Initial sync**: Upload local → cloud
2. **Ongoing**: Bi-directional sync with conflict resolution
3. **Conflict rule**: Most recently modified wins (with backup)

### What Syncs

| Content | Synced to Cloud |
|---------|-----------------|
| Toolkit artifacts | Yes |
| Toolkit catalog (metadata) | Yes |
| Vault files | Yes |
| Vault catalog | Yes |
| Project artifacts (.bluekit/) | **No** - git handles this |

---

## MCP Integration

### Toolkit: Full Access

AI tools can query your Toolkit via MCP:

```typescript
// MCP resources for Toolkit
const resources = [
  {
    uri: "bluekit://toolkit",
    name: "Personal Toolkit",
    description: "Your curated building blocks",
  },
  {
    uri: "bluekit://toolkit/{artifactId}",
    name: "Toolkit Artifact",
    description: "A specific kit, walkthrough, agent, or diagram",
  },
];

// MCP tools
const tools = [
  {
    name: "search_toolkit",
    description: "Search your Toolkit by tags, type, or content",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        type: { enum: ["kit", "walkthrough", "agent", "diagram"] },
        tags: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "get_artifact",
    description: "Get a specific artifact's content",
    inputSchema: {
      type: "object",
      properties: {
        artifactId: { type: "string" },
      },
      required: ["artifactId"],
    },
  },
];
```

### Vault: Limited Access

Vault is content-searchable but not metadata-queryable:

```typescript
const tools = [
  {
    name: "search_vault",
    description: "Search your Vault by content",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
];
```

**Why the difference?**

Toolkit artifacts have guaranteed structure → AI can rely on metadata.
Vault files are unpredictable → AI can only search content.

---

## Operations

### Save to Toolkit

From project artifact → Toolkit:

```typescript
async function saveToToolkit(
  projectArtifact: ProjectArtifact,
  targetType: 'kit' | 'walkthrough' | 'agent' | 'diagram'
): Promise<void> {
  // 1. Validate structure
  const frontmatter = parseFrontmatter(projectArtifact.content);
  if (!frontmatter.id || !frontmatter.type) {
    throw new Error('Artifact must have id and type in front matter');
  }

  // 2. Determine target path
  const targetDir = `~/.bluekit/toolkit/${targetType}s/`;
  const targetPath = `${targetDir}${frontmatter.id}.md`;

  // 3. Copy file
  await fs.copyFile(projectArtifact.path, targetPath);

  // 4. Update catalog
  await db.toolkitCatalog.upsert({
    artifact_id: frontmatter.id,
    name: frontmatter.alias || frontmatter.id,
    artifact_type: targetType,
    description: frontmatter.description,
    tags: JSON.stringify(frontmatter.tags || []),
    file_path: targetPath,
    content_hash: hashContent(projectArtifact.content),
  });

  // 5. If signed in, trigger cloud sync
  if (isSignedIn()) {
    await syncToCloud('toolkit', frontmatter.id);
  }
}
```

### Copy to Project

From Toolkit → project:

```typescript
async function copyToProject(
  artifactId: string,
  targetProject: Project
): Promise<void> {
  // 1. Get from catalog
  const catalog = await db.toolkitCatalog.findById(artifactId);
  if (!catalog) throw new Error('Artifact not found');

  // 2. Read content
  const content = await fs.readFile(catalog.file_path);

  // 3. Determine target path in project
  const targetPath = getProjectArtifactPath(
    targetProject,
    catalog.artifact_type,
    catalog.name
  );

  // 4. Write to project
  await fs.writeFile(targetPath, content);
}
```

### Save to Vault

Just copy to vault directory:

```typescript
async function saveToVault(
  sourcePath: string,
  vaultSubdir?: string
): Promise<void> {
  const targetDir = vaultSubdir
    ? `~/.bluekit/vault/${vaultSubdir}/`
    : '~/.bluekit/vault/';

  const fileName = path.basename(sourcePath);
  const targetPath = `${targetDir}${fileName}`;

  await fs.copyFile(sourcePath, targetPath);

  // Update catalog
  const content = await fs.readFile(targetPath);
  const frontmatter = tryParseFrontmatter(content);

  await db.vaultCatalog.upsert({
    name: fileName,
    file_path: targetPath,
    has_frontmatter: frontmatter ? 1 : 0,
    frontmatter_id: frontmatter?.id,
    frontmatter_type: frontmatter?.type,
    frontmatter_tags: JSON.stringify(frontmatter?.tags || []),
    frontmatter_description: frontmatter?.description,
    content_hash: hashContent(content),
  });

  if (isSignedIn()) {
    await syncToCloud('vault', fileName);
  }
}
```

---

## Walkthroughs: Special Handling

Walkthroughs are **directories**, not files. They need database-backed metadata.

### Structure

```
~/.bluekit/toolkit/walkthroughs/react-auth-flow/
├── walkthrough.json          # Metadata (like blueprint.json)
├── 01-introduction.md
├── 02-setup.md
├── 03-implementation.md
├── 04-testing.md
└── assets/
    └── diagram.png
```

### walkthrough.json

```json
{
  "id": "react-auth-flow",
  "alias": "React Authentication Flow",
  "description": "Complete guide to implementing auth in React",
  "tags": ["react", "auth", "jwt"],
  "version": 1,
  "complexity": "moderate",
  "format": "guide",
  "sections": [
    { "file": "01-introduction.md", "title": "Introduction" },
    { "file": "02-setup.md", "title": "Project Setup" },
    { "file": "03-implementation.md", "title": "Implementation" },
    { "file": "04-testing.md", "title": "Testing" }
  ]
}
```

### Progress Tracking

Progress is personal (not synced with content):

```sql
-- In toolkit_walkthroughs table
UPDATE toolkit_walkthroughs
SET progress = 50,
    completed_sections = 2
WHERE id = 'react-auth-flow';
```

### Converting Directory to Walkthrough

When user says "make this a walkthrough":

1. Create `walkthrough.json` from directory contents
2. Auto-detect sections from markdown files
3. Add to `toolkit_walkthroughs` table
4. Copy to `~/.bluekit/toolkit/walkthroughs/`

---

## UI Considerations

### Navigation Drawer

```
Community    → Marketplace (future)
Toolkit      → Structured artifacts, curated
Vault        → Personal files, anything
Settings     → Preferences, account
```

### Toolkit View

```
┌─────────────────────────────────────────────────────────────┐
│ Toolkit                                          [+ Add]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Filter: [All ▼] [Search...]                                 │
│                                                              │
│ ┌─ Kits (12) ───────────────────────────────────────────┐  │
│ │ 📄 jwt-auth-kit           auth, jwt, security         │  │
│ │ 📄 modal-component        react, ui, component        │  │
│ │ 📄 form-validation        forms, validation           │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Walkthroughs (3) ────────────────────────────────────┐  │
│ │ 📁 react-auth-flow        guide · 50% complete        │  │
│ │ 📁 tauri-basics           reference · not started     │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Agents (2) ──────────────────────────────────────────┐  │
│ │ 🤖 debugging-agent        debugging, errors           │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Vault View

```
┌─────────────────────────────────────────────────────────────┐
│ Vault                                            [+ Add]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Search content...]                                         │
│                                                              │
│ 📁 notes/                                                   │
│    📄 meeting-2026-01-19.md                                │
│    📄 random-idea.md                                        │
│                                                              │
│ 📁 drafts/                                                  │
│    📄 blog-post-wip.md                                     │
│                                                              │
│ 📁 references/                                              │
│    📄 api-docs-snippet.md                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1: Local Toolkit
1. [ ] Create `~/.bluekit/toolkit/` directory structure
2. [ ] SQLite tables for catalog
3. [ ] "Save to Toolkit" from project artifacts
4. [ ] Toolkit browser UI
5. [ ] "Copy to Project" from Toolkit

### Phase 2: Local Vault
1. [ ] Create `~/.bluekit/vault/` directory structure
2. [ ] SQLite table for vault catalog
3. [ ] "Save to Vault" action
4. [ ] Vault browser UI
5. [ ] "Promote to Toolkit" action

### Phase 3: Walkthroughs
1. [ ] `walkthrough.json` format
2. [ ] `toolkit_walkthroughs` table
3. [ ] "Convert to Walkthrough" action
4. [ ] Progress tracking
5. [ ] Walkthrough viewer UI

### Phase 4: Cloud Sync (When Ready)
1. [ ] Supabase Auth integration
2. [ ] Supabase Storage buckets
3. [ ] Bi-directional sync
4. [ ] Conflict resolution

### Phase 5: MCP Integration
1. [ ] MCP server for local Toolkit
2. [ ] API endpoints (when cloud enabled)
3. [ ] Documentation

---

## What We're NOT Building

- ❌ Shared workspaces (use git)
- ❌ Team libraries (use git)
- ❌ Real-time collaboration on artifacts (use git)
- ❌ Cloud-only mode (always local-first)
- ❌ Scrapbook (use Vault instead)

---

## Open Questions

1. **Sync conflict resolution** - When local and cloud differ, what wins?
   - Leaning: Most recent wins, with backup of loser

2. **Walkthrough assets** - How to handle images/files in walkthroughs?
   - Leaning: Store in walkthrough directory, sync with content

3. **Toolkit limits** - Max artifacts locally? In cloud?
   - Leaning: Local unlimited, cloud tier-based

4. **Vault organization** - Enforce folder structure or free-form?
   - Leaning: Free-form, users create their own folders
