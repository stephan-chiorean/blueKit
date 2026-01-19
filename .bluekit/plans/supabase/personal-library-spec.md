# Personal Library Specification

**Status:** Core Architecture Decision
**Created:** 2026-01-19
**Supersedes:** Previous workspace-based library concepts

---

## Summary

The Library is **personal**. One library per user. No shared workspaces, no team libraries, no collaborative cloud storage.

```
┌─────────────────────────────────────────────────────────────┐
│                    What the Library IS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  • Personal to each user (like your bookmarks)              │
│  • Curated collection of YOUR building blocks               │
│  • Accessible from any device via login                     │
│  • Exposed via API for MCP integration                      │
│  • Source of truth for what you publish to marketplace      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    What the Library is NOT                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  • NOT a shared workspace                                   │
│  • NOT for team collaboration (use git repos for that)      │
│  • NOT a place for unstructured notes                       │
│  • NOT project-specific (it spans all your projects)        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                   Community Marketplace                      │
│              (Published artifacts, discovery)                │
└─────────────────────────────────────────────────────────────┘
                          ↑ publish
                          ↓ import
┌─────────────────────────────────────────────────────────────┐
│                    Personal Library                          │
│                 (Supabase - one per user)                   │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Collections                                         │   │
│   │  ├── "Auth Patterns"                                │   │
│   │  │   ├── jwt-auth-kit.md                           │   │
│   │  │   └── oauth-walkthrough.md                      │   │
│   │  │                                                  │   │
│   │  ├── "React Components"                            │   │
│   │  │   ├── modal-kit.md                              │   │
│   │  │   └── form-validation-kit.md                    │   │
│   │  │                                                  │   │
│   │  └── "Uncategorized"                               │   │
│   │       └── debugging-agent.md                       │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   All artifacts have YAML front matter (structured)         │
│   Exposed via API → MCP integration                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          ↑ "save to library"
                          ↓ "copy to project"
┌─────────────────────────────────────────────────────────────┐
│                    Project Artifacts                         │
│              (Git repos - .bluekit directories)             │
│                                                              │
│   Shared with teammates via git push/pull                   │
│   Version controlled with code                              │
│   This is where collaboration happens                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Structured Artifacts Only

The library contains **structured artifacts only**. No loose notes, no scratch files, no drafts.

### Why Structured?

1. **MCP Reliability** - AI workflows need predictable metadata
2. **Findability** - Tags, descriptions, types enable search
3. **Intentionality** - The library is curated, not dumped
4. **Publishability** - Everything is marketplace-ready

### What "Structured" Means

Every library artifact has YAML front matter:

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

### The Promotion Model

Notes don't belong in the library. They belong in:
- Project scrapbook (`project/.bluekit/scrapbook/`)
- Local drafts (wherever you want)

When a note is ready to be a building block:

```
Scrapbook note: "auth-ideas.md"
        │
        │  User decides: "This is useful, I want to reuse it"
        │
        ▼
Add YAML front matter + structure
        │
        ▼
Save to Personal Library
        │
        ▼
Library artifact: "jwt-auth-kit.md"
```

**The friction is intentional.** Adding front matter is the moment you say "this is ready for duty."

---

## Collections

Within your personal library, you organize artifacts into **collections**.

### Collections Are Folders

```
My Library
├── Auth Patterns (collection)
│   ├── jwt-auth-kit.md
│   ├── oauth-walkthrough.md
│   └── session-management-kit.md
│
├── React Components (collection)
│   ├── modal-kit.md
│   └── form-validation-kit.md
│
└── Uncategorized (default collection)
    └── random-utility-kit.md
```

### Collections Are Personal

- You create them
- You name them
- You organize them
- Nobody else sees them (unless you share individual artifacts)

### Collections vs Tags

| Feature | Collections | Tags |
|---------|-------------|------|
| Purpose | Organization | Discovery |
| Structure | Hierarchical | Flat |
| Assignment | One per artifact | Many per artifact |
| Visibility | Personal | On artifact (visible in marketplace) |

**Use collections for:** "Where do I put this?"
**Use tags for:** "What is this about?"

---

## Library Operations

### Save to Library

From a project artifact → Personal Library

```typescript
// User clicks "Save to Library" on a kit in their project
async function saveToLibrary(artifact: ProjectArtifact, collectionId?: string) {
  // 1. Validate structure
  if (!artifact.frontMatter.id || !artifact.frontMatter.type) {
    throw new Error('Artifact must have id and type in front matter');
  }

  // 2. Upload content to Supabase Storage
  const storagePath = `${user.id}/library/${artifact.frontMatter.id}.md`;
  await supabase.storage
    .from('library')
    .upload(storagePath, artifact.content, { upsert: true });

  // 3. Create/update catalog entry
  await supabase
    .from('library_catalog')
    .upsert({
      user_id: user.id,
      artifact_id: artifact.frontMatter.id,
      name: artifact.frontMatter.alias || artifact.fileName,
      artifact_type: artifact.frontMatter.type,
      description: artifact.frontMatter.description,
      tags: artifact.frontMatter.tags || [],
      collection_id: collectionId,
      storage_path: storagePath,
      source_project: project.name, // For reference
    });
}
```

### Copy to Project

From Personal Library → Project artifact

```typescript
// User clicks "Copy to Project" on a library artifact
async function copyToProject(artifactId: string, targetProject: Project) {
  // 1. Get artifact from library
  const { data: catalog } = await supabase
    .from('library_catalog')
    .select()
    .eq('user_id', user.id)
    .eq('artifact_id', artifactId)
    .single();

  // 2. Download content
  const { data: content } = await supabase.storage
    .from('library')
    .download(catalog.storage_path);

  // 3. Write to project's .bluekit directory
  const targetPath = getArtifactPath(targetProject, catalog.artifact_type, catalog.name);
  await invoke('write_file', {
    path: targetPath,
    content: await content.text(),
  });
}
```

### Publish to Marketplace

From Personal Library → Community Marketplace

```typescript
// User clicks "Publish" on a library artifact
async function publishToMarketplace(artifactId: string) {
  const { data: catalog } = await supabase
    .from('library_catalog')
    .select()
    .eq('artifact_id', artifactId)
    .single();

  // Create marketplace listing
  await supabase
    .from('marketplace_listings')
    .insert({
      artifact_id: catalog.artifact_id,
      name: catalog.name,
      description: catalog.description,
      artifact_type: catalog.artifact_type,
      tags: catalog.tags,
      publisher_id: user.id,
      storage_path: catalog.storage_path, // Reference same storage
      // ... licensing, pricing, etc.
    });
}
```

---

## Data Model

### Supabase Schema

```sql
-- Personal library catalog
-- One row per artifact in user's library
CREATE TABLE library_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Artifact identity (from YAML front matter)
  artifact_id TEXT NOT NULL,

  -- Metadata (parsed from front matter)
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,  -- kit, walkthrough, agent, diagram
  description TEXT,
  tags JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1,

  -- Organization
  collection_id UUID REFERENCES library_collections(id) ON DELETE SET NULL,

  -- Storage
  storage_path TEXT NOT NULL,
  content_hash TEXT,

  -- Provenance
  source_project TEXT,  -- Which project this came from (optional)
  imported_from TEXT,   -- Marketplace listing ID if imported (optional)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique artifact per user
  UNIQUE(user_id, artifact_id)
);

-- Library collections (personal organization)
CREATE TABLE library_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Collection info
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  order_index INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique name per user
  UNIQUE(user_id, name)
);

-- RLS: Users can only access their own library
ALTER TABLE library_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own library catalog"
  ON library_catalog FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own collections"
  ON library_collections FOR ALL
  USING (user_id = auth.uid());
```

### Storage Structure

```
Supabase Storage: library bucket
├── {user_id}/
│   └── library/
│       ├── jwt-auth-kit.md
│       ├── oauth-walkthrough.md
│       └── modal-kit.md
```

### TypeScript Types

```typescript
interface LibraryArtifact {
  id: string;
  artifactId: string;  // From YAML front matter
  name: string;
  artifactType: 'kit' | 'walkthrough' | 'agent' | 'diagram';
  description?: string;
  tags: string[];
  version: number;
  collectionId?: string;
  storagePath: string;
  sourceProject?: string;
  importedFrom?: string;
  createdAt: string;
  updatedAt: string;
}

interface LibraryCollection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  orderIndex: number;
  artifactCount: number;  // Computed
}

interface LibrarySummary {
  totalArtifacts: number;
  byType: {
    kit: number;
    walkthrough: number;
    agent: number;
    diagram: number;
  };
  collections: LibraryCollection[];
  recentlyAdded: LibraryArtifact[];
}
```

---

## MCP Integration

The library is exposed via API for MCP (Model Context Protocol) integration.

### Why This Matters

When users connect BlueKit to AI tools (Claude, etc.), they want:
- Their personal building blocks available to AI
- Curated, high-quality artifacts (not random notes)
- Consistent structure AI can parse

### API Endpoints

```typescript
// List all artifacts in user's library
GET /api/library
Response: LibraryArtifact[]

// Get specific artifact content
GET /api/library/:artifactId
Response: { metadata: LibraryArtifact, content: string }

// Search library
GET /api/library/search?q=auth&type=kit&tags=jwt
Response: LibraryArtifact[]

// Get collections
GET /api/library/collections
Response: LibraryCollection[]

// Get artifacts in collection
GET /api/library/collections/:collectionId
Response: LibraryArtifact[]
```

### MCP Server Configuration

```json
{
  "mcpServers": {
    "bluekit": {
      "url": "https://api.bluekit.app/mcp",
      "auth": {
        "type": "bearer",
        "token": "${BLUEKIT_API_KEY}"
      }
    }
  }
}
```

### MCP Resources

```typescript
// MCP resources exposed by BlueKit
const resources = [
  {
    uri: "bluekit://library",
    name: "Personal Library",
    description: "Your curated collection of kits, walkthroughs, and agents",
    mimeType: "application/json",
  },
  {
    uri: "bluekit://library/{artifactId}",
    name: "Library Artifact",
    description: "A specific artifact from your library",
    mimeType: "text/markdown",
  },
];
```

---

## What We're NOT Building

### NOT: Shared Workspaces

❌ No team libraries
❌ No workspace invites (for library)
❌ No collaborative editing of library artifacts
❌ No workspace permissions

**Why:** Teams share via git repos. The library is personal.

### NOT: Cloud-Synced Project Artifacts

❌ No syncing .bluekit/ folders to Supabase
❌ No cloud storage for project files
❌ No real-time collaboration on project kits

**Why:** Git already does this. Don't reinvent version control.

### NOT: Unstructured Content

❌ No notes without front matter
❌ No "quick save" without structure
❌ No draft system in library

**Why:** The library is curated. Use scrapbook for drafts.

### NOT: Cross-User Library Sharing

❌ No "share this collection with Bob"
❌ No library visibility settings
❌ No collaborative collections

**Why:** Share via marketplace (public) or git (team). Library is personal.

---

## Migration from Old Model

The previous plans talked about "workspaces" with Supabase storage for team collaboration. That's going away.

### What Changes

| Old Model | New Model |
|-----------|-----------|
| Workspaces (cloud storage, shared) | Personal Library (cloud, individual) |
| Workspace invites | Project invites (git-based) |
| Workspace members | Project collaborators (via repo access) |
| Cloud-synced kits | Library artifacts (personal only) |

### What Stays

- Auth (Supabase Auth with Google/GitHub/email)
- Project collaboration (via git repos + synced metadata)
- Marketplace (for public sharing)
- MCP integration (now via personal library)

### Files to Update

1. `implementation-roadmap.md` - Remove workspace collaboration, add library phases
2. `project-collab.md` - Still relevant for git-based project sharing
3. `invite-flow.md` - Still relevant for project invites (not library)

---

## Implementation Phases

### Phase 1: Library Foundation

- [ ] Create `library_catalog` and `library_collections` tables
- [ ] Supabase Storage bucket for library content
- [ ] RLS policies (user can only access own library)
- [ ] Basic CRUD operations

### Phase 2: Library UI

- [ ] Library view in app (sidebar or dedicated page)
- [ ] Collection management (create, rename, delete)
- [ ] Artifact browser with search/filter
- [ ] "Save to Library" action from project artifacts

### Phase 3: Copy Operations

- [ ] "Copy to Project" from library
- [ ] "Import from Marketplace" to library
- [ ] Handle duplicate artifact IDs

### Phase 4: MCP Integration

- [ ] API endpoints for library access
- [ ] MCP resource definitions
- [ ] API key generation for users
- [ ] Documentation for MCP setup

### Phase 5: Marketplace

- [ ] "Publish" action from library
- [ ] Marketplace listing flow
- [ ] Discovery/search
- [ ] Import to library

---

## Open Questions

1. **Offline access** - Should library sync locally for offline?
   - Leaning: No, keep it simple. Library requires connection.

2. **Version history** - Track versions of library artifacts?
   - Leaning: Yes, but simple (store previous versions, not full git-style history)

3. **Bulk operations** - Import entire project's .bluekit to library?
   - Leaning: Yes, with selection UI

4. **Default collection** - "Uncategorized" or no collection?
   - Leaning: "Uncategorized" default collection

5. **Artifact limits** - Max artifacts per library?
   - Leaning: Generous limit (1000+), revisit based on usage
