# Glossary

## Core Concepts

**Vault** - Your personal workspace that lives outside of projects. Same UI layout as a project detail page (notebook, sidebar, etc.) but serves as a central hub across all your work. Contains your Toolkit and personal notes. Configured to a local path (`~/.bluekit/vault/`). Eventually syncs to cloud as one unified thing.

**Toolkit** - A section within your Vault containing structured, reusable building blocks. Accessed via submenu: Kits, Walkthroughs, Agents, Skills. All items have YAML front matter. Exposed via MCP for AI integration.

**Gallery** - A curated (sponsored + community) collection of resources like kits, walkthroughs, and skills that can be ingested into vaults and projects.

**Project** - A git repository with a `.bluekit/` directory. Shared with teammates via git push/pull. Has its own notebook, kits, plans, etc.

---

## Artifact Types

**Kits** - Single markdown files with YAML front matter. Templates/building blocks for reuse. Meant to be consumed primarily by AI. Never folders.

**Walkthroughs** - Directories of files with database-backed metadata. Allow progressive disclosure. Always contained within a folder. Track progress, complexity, and format. Created by converting a directory. Have a `walkthrough.json` metadata file.

**Agents** - Single markdown files defining AI agent behaviors. Have capabilities, instructions, and triggers.

**Skills** - Reusable actions/commands. (TBD - may be similar to kits but action-oriented)

**Diagrams** - Mermaid files (`.mmd`) with YAML front matter. Visual representations of architecture, flows, etc.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         VAULT                                │
│              (Your personal workspace)                       │
│                                                              │
│  Same UI as project detail page:                            │
│  ├── Notebook (notes, drafts)                               │
│  ├── Toolkit                                                │
│  │   ├── Kits                                               │
│  │   ├── Walkthroughs                                       │
│  │   ├── Agents                                             │
│  │   └── Skills                                             │
│  └── Plans, Diagrams, etc.                                  │
│                                                              │
│  Local: ~/.bluekit/vault/                                   │
│  Cloud: Syncs as one unified thing when signed in           │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        PROJECTS                              │
│              (Git repos with .bluekit/)                     │
│                                                              │
│  Each project has same layout as Vault                      │
│  Shared via git, NOT synced to cloud                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Navigation

```
Sidebar:
├── Projects Dashboard
├── Vault (your personal workspace)
│   └── Toolkit submenu → Kits / Walkthroughs / Agents / Skills
└── Community (marketplace, future)
```

---

## Key Distinctions

| Location | Purpose | Sharing | Sync |
|----------|---------|---------|------|
| Vault | Personal central hub | Private (cloud sync optional) | Unified |
| Vault → Toolkit | Reusable building blocks | Private (publishable to marketplace) | Part of Vault |
| Project `.bluekit/` | Project-specific artifacts | Via git | None (git handles) |
