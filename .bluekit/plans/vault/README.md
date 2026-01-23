# Vault System - Planning Documents

This directory contains the complete vision and phased implementation plan for BlueKit's vault system.

---

## ⚡ Key Insight

**Vault = Project with `is_vault = true`**

No new infrastructure needed! Vault reuses ALL existing project code:
- Same database table (`projects` with one extra column)
- Same `.bluekit` directory structure
- Same file watching, artifact loading, notebook UI
- Only ~300 lines of new code (vs. 2000+ for separate system)
- **1 week implementation** instead of 4 weeks

## Overview

The vault system adds a **personal knowledge base** to BlueKit - a central notebook that complements existing project notebooks. This enables cross-project knowledge management while keeping project-specific work organized.

**Current State**: Projects have isolated `.bluekit` directories, HomePage shows project grid
**Target State**: VaultPage (sidebar + notebook) as main interface, vault + projects coexist
**Implementation**: Vault is literally just a special project

---

## Documents

### 🚀 [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - START HERE!
**Step-by-step guide to implement Phase 1**
- Database migration (30 min)
- Backend commands (1 hour)
- Frontend components (8-10 hours)
- Integration (4-6 hours)
- Testing checklist
- Code examples for every step

**Start here if you're implementing vault!**

---

### 📘 [vision.md](./vision.md)
**Complete roadmap and ultimate vision**
- Core principles (local-first, privacy-focused, cross-platform)
- Phase 1-7 overview
- Technical architecture decisions
- Success metrics
- Open questions

---

### 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
**Vault = Project architecture explained**
- TL;DR: Vault is just a project with `is_vault = true`
- Visual layouts (ASCII diagrams)
- Database schema (one new column!)
- Comparison tables
- Why this works (benefits & trade-offs)

**Read this to understand the architecture.**

**Read this to understand the big picture.**

---

### 🚀 Phase 1: [phase-1-local-vault.md](./phase-1-local-vault.md)
**Local Vault Foundation** (Pre-Cloud)

**Goal**: Add VaultPage as main interface. **Vault = Project with `is_vault = true`**

**Key Insight**: Reuse ALL existing project infrastructure - same table, same `.bluekit`, same everything!

**Key Features**:
- VaultPage with sidebar tabs (Projects/Library/Workflows/Tasks)
- Vault initialization flow (VaultSetupScreen)
- Vault notebook (reuse NotebookTree + NoteViewPage from projects)
- Projects tab shows ProjectsTabContent (unchanged)
- Navigate between VaultPage ↔ ProjectDetailPage
- Vault = row in projects table with `is_vault = 1`

**Deliverables**:
- Add ONE column to projects table: `is_vault`
- VaultPage, VaultSidebar, VaultNotebook (~300 lines total)
- VaultSetupScreen (50 lines)
- One new Rust command: `get_vault_project()`
- Modify `create_project()` to accept `is_vault` param
- Reuse ALL existing: file watching, artifact loading, notebook UI

**Timeline**: 1 week

**Status**: 📝 Ready to implement

---

### ⚡ Phase 2: [phase-2-enhanced-features.md](./phase-2-enhanced-features.md)
**Enhanced Local Vault Features**

**Goal**: Make local vault a powerful standalone knowledge management tool

**Key Features**:
- Full-text search (SQLite FTS5)
- Wiki-style linking (`[[Note Title]]`)
- Backlinks panel
- Note templates
- Daily notes (hotkey: Cmd+D)
- Smart folders (auto-filtering)
- Command palette (Cmd+K)

**Deliverables**:
- Search system with <100ms latency
- Linking and autocomplete
- Template system with built-in templates
- Smart folder engine
- Command palette
- Keyboard shortcuts

**Timeline**: 1 week

**Status**: 📝 Ready to implement (requires Phase 1)

---

### 🔄 Phase 3: [phase-3-sync-preparation.md](./phase-3-sync-preparation.md)
**Cloud Sync Preparation** (Local + Metadata)

**Goal**: Prepare architecture for cloud sync without implementing full sync

**Key Features**:
- Sync metadata layer (manifest.json, changelog.json)
- UUID-based file identification
- Change tracking (all file operations logged)
- Checksum calculation (SHA-256)
- Conflict detection (local simulation)
- Sync state machine (local only)

**Deliverables**:
- Sync metadata system (manifest, changelog, conflicts)
- File watcher integration with change logging
- Conflict detection engine
- Local sync simulation (two vaults)
- Data integrity checks
- Sync settings UI

**Timeline**: 3 weeks

**Status**: 📝 Planning (requires Phase 2)

---

## Phased Approach Summary

| Phase | Focus | Duration | Cloud? | Mobile? |
|-------|-------|----------|--------|---------|
| **Phase 1** | Local vault (vault = project!) | 1 week | ❌ No | ❌ No |
| **Phase 2** | Search, linking, templates | 4 weeks | ❌ No | ❌ No |
| **Phase 3** | Sync preparation (metadata) | 3 weeks | ⚠️ Prep only | ❌ No |
| **Phase 4** | Cloud sync (Supabase) | 5 weeks | ✅ Yes | ❌ No |
| **Phase 5** | Mobile companion app | 6 weeks | ✅ Yes | ✅ Yes |
| **Phase 6** | Collaboration features | 4 weeks | ✅ Yes | ✅ Yes |
| **Phase 7** | AI-powered features | 6 weeks | ✅ Yes | ✅ Yes |

**Total to MVP (Phase 1-3)**: 8 weeks (was 11, saved 3 weeks!)
**Total to Cloud Sync (Phase 1-4)**: 13 weeks
**Total to Mobile (Phase 1-5)**: 19 weeks

---

## Quick Links

### Prerequisites
- [Supabase Integration Plan](./../supabase/) - Authentication and storage
- [Walkthroughs Revamp](./../walkthroughs-revamp/) - Educational content system
- [Folders Plan](./../folders/) - File organization patterns

### Related Components
- `src/pages/HomePage.tsx` - Will become VaultPage
- `src/pages/ProjectDetailPage.tsx` - Reference for notebook UI
- `src/components/WelcomeScreen.tsx` - Entry point before vault setup
- `src-tauri/src/watcher.rs` - File watching infrastructure

### Technical References
- [CLAUDE.md](../../../CLAUDE.md) - Project overview and architecture
- [product.md](../../../product.md) - Product vision

---

## Decision Log

### Key Architectural Decisions

1. **Local-First, Not Cloud-First**
   - **Decision**: Build fully functional local vault before adding cloud sync
   - **Rationale**: Users own their data, offline-first is better UX, simpler to implement incrementally
   - **Trade-off**: Delayed multi-device sync, but better foundation

2. **SQLite FTS5 for Search (Phase 2)**
   - **Decision**: Use built-in SQLite full-text search instead of external engine
   - **Rationale**: Already using SQLite, fast for <100K notes, no external dependencies
   - **Trade-off**: Tantivy would be more powerful, but overkill for initial version

3. **UUID-Based Sync (Phase 3)**
   - **Decision**: Use UUIDs for files instead of paths
   - **Rationale**: Paths change (moves, renames), UUIDs are stable
   - **Trade-off**: Extra metadata overhead, but essential for conflict resolution

4. **File-Based Sync, Not CRDT (Phase 4)**
   - **Decision**: Sync entire files, not operational transforms
   - **Rationale**: Simpler to implement, matches git model, good enough for single-user editing
   - **Trade-off**: No real-time collaboration, but easier conflict resolution

5. **Tauri Mobile for Mobile App (Phase 5)**
   - **Decision**: Wait for Tauri Mobile to mature, or use React Native as fallback
   - **Rationale**: Code reuse is valuable, but React Native is proven
   - **Trade-off**: TBD based on Tauri Mobile maturity in 6 months

---

## Success Metrics

### Phase 1 (Local Vault)
- 80% of new users complete vault setup
- Average 50+ notes created in first month
- <1% request old project mode

### Phase 2 (Enhanced Features)
- Search used in 60% of sessions
- Average 10 internal links per note
- 50% of notes created from templates

### Phase 3 (Sync Prep)
- 100% of changes tracked in changelog
- Zero data loss in conflict detection tests
- Manifest rebuild works in <5 seconds

### Phase 4 (Cloud Sync)
- 50% of authenticated users enable sync
- <5% of syncs encounter conflicts
- Sync completes in <10 seconds

### Phase 5 (Mobile)
- 30% of users install mobile app
- Mobile app used weekly by 60% of installers
- Read-only mode sufficient for 80% of mobile use

---

## Open Questions

### Phase 1
- [ ] Should vault be portable? (USB drive, Dropbox folder)
- [ ] Default vault location: `~/Documents` or `~/.bluekit/vaults/`?
- [ ] Support multiple vaults or single vault with workspaces?

### Phase 2
- [ ] Use Tantivy for search or stick with SQLite FTS5?
- [ ] Support custom templates from community?
- [ ] Graph view in Phase 2 or defer to Phase 6?

### Phase 3
- [ ] Encrypt manifest locally (for privacy)?
- [ ] Support LAN sync (without cloud)?
- [ ] Conflict resolution strategy: last-write-wins or manual?

### Phase 4
- [ ] Use Supabase Storage or Realtime for sync?
- [ ] How to handle large files (images, PDFs)?
- [ ] Selective sync (folders, file types)?

### Phase 5
- [ ] Tauri Mobile or React Native?
- [ ] Read-only or full editing on mobile?
- [ ] Offline queue for sync?

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Finalize Phase 1 scope** (ensure no scope creep)
3. **Set up project tracking** (GitHub issues, milestones)
4. **Begin Phase 1 implementation**:
   - Week 1: Backend (vault.rs, database schema)
   - Week 2: File tree & watcher
   - Week 3: Frontend (VaultSetupScreen, VaultPage)
   - Week 4: Integration, migration, polish
5. **Ship Phase 1** and gather feedback before starting Phase 2

---

## Resources

### Inspiration
- **Obsidian**: Local-first markdown vault with wiki links
- **Notion**: Unified workspace with templates and databases
- **Roam Research**: Networked thought with backlinks
- **Logseq**: Open-source Roam alternative
- **VS Code**: Command palette, file tree, search UX

### Technical References
- [Tauri Docs](https://tauri.app/v1/guides/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [React Window](https://github.com/bvaughn/react-window) - Virtualization
- [Meilisearch](https://www.meilisearch.com/) - Alternative search engine

---

## Contributing

When implementing features from these plans:
1. Read the full phase document before starting
2. Follow success criteria exactly
3. Update this README with status changes
4. Log decisions in "Decision Log" section
5. Add learnings to phase documents

---

## Questions or Feedback?

- Open an issue in the BlueKit repo
- Tag with `vault-system` label
- Reference the specific phase document

---

**Last Updated**: 2026-01-22
**Maintained By**: BlueKit Team
**Status**: Phase 1-3 in planning, ready for implementation
