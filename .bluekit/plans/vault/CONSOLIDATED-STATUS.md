# Vault System - Consolidated Status & Next Steps

**Last Updated**: 2026-01-28
**Author**: Assessment based on codebase analysis

---

## Executive Summary

The vault system has **significant progress** on the foundational infrastructure, but **no user-facing vault features** are complete yet. The tab system is implemented, the database schema is ready, but the vault UI and workflow need to be built.

### What's ✅ Done
- ✅ **Tab system** (Phase 0 equivalent) - Fully implemented
- ✅ **Database schema** - `is_vault` column exists
- ✅ **Backend data model** - `Project.is_vault` field in Rust
- ✅ **Architecture migration** - Browser tabs, TabManager, TabContext all working
- ✅ **App structure** - Modern view-based architecture with ProjectView/HomeView

### What's ❌ Not Done
- ❌ **VaultPage** - Doesn't exist (no dedicated vault UI)
- ❌ **Vault creation flow** - No VaultSetupScreen
- ❌ **Vault-specific sidebar** - No "Library" concept distinct from projects
- ❌ **Vault commands** - No `get_vault_project()` or vault-specific operations
- ❌ **Phase 1 features** - Search, linking, templates (Phase 2)
- ❌ **Sync preparation** - Metadata, change tracking (Phase 3)

---

## Achievement Analysis

### Phase 0: UI Overhaul ✅ COMPLETE

**Original Goal**: Obsidian-inspired layout with tabs above content

**Status**: ✅ Achieved (different approach than planned)
- Browser-style tabs implemented via `BrowserTabs` component
- TabManager handles global tab state
- TabContext provides tab lifecycle management
- Tabs persist across navigation (HomeView ↔ ProjectView)
- Tab state saved (debounced, 500ms)

**Differences from original plan**:
- Used browser tabs instead of "tabs above sidebar"
- Kept existing sidebar design (didn't move project switcher above sidebar)
- Result: **Better than planned** - more familiar browser UX

**Files**:
- ✅ `src/app/TabManager.tsx` - Global tab orchestrator
- ✅ `src/app/TabContext.tsx` - Tab state management
- ✅ `src/app/TabContent.tsx` - Routes tabs to views
- ✅ `src/tabs/BrowserTabs.tsx` - UI component
- ✅ Integration in `App.tsx` (line 76)

---

### Phase 1: Local Vault Foundation ⚠️ PARTIAL

**Original Goal**: Vault as special project with dedicated UI

**Status**: ⚠️ Backend ready, frontend missing (10% complete)

#### ✅ What's Done (Backend)

1. **Database schema** - Ready for vaults
   ```sql
   -- projects table has is_vault column
   14|is_vault|INTEGER|1|0|0
   ```

2. **Rust data model** - Vault field exists
   ```rust
   // src-tauri/src/db/entities/project.rs:37-39
   #[serde(rename = "isVault")]
   #[sea_orm(default_value = "false")]
   pub is_vault: bool,
   ```

3. **Frontend awareness** - `isVault` passed to ProjectView
   ```tsx
   // src/app/TabContent.tsx:136
   <ProjectView
     project={activeProject}
     isVault={activeProject.isVault ?? false}
   />
   ```

#### ❌ What's Missing (Frontend + Commands)

1. **No VaultPage component** - Should exist at `src/views/vault/VaultPage.tsx`
2. **No VaultSetupScreen** - First-run vault creation flow
3. **No vault-specific sidebar** - "Library" tab doesn't exist
4. **No Rust commands**:
   - `get_vault_project()` - Query for vault
   - `create_vault()` - Simplified vault creation
5. **No vault detection** - App doesn't check if vault exists
6. **No vault routing** - Tab system doesn't handle vault tabs

**Key Insight**: The infrastructure exists, but no one is **using** it to create a vault.

---

### Phase 2: Enhanced Features ❌ NOT STARTED

**Status**: ❌ 0% complete

All advanced features blocked until Phase 1 is complete:
- Search (SQLite FTS5)
- Wiki-style linking (`[[note]]`)
- Templates & daily notes
- Smart folders
- Command palette

**Dependencies**: Requires working vault from Phase 1

---

### Phase 3: Sync Preparation ❌ NOT STARTED

**Status**: ❌ 0% complete

No sync metadata infrastructure exists:
- No `.bluekit/sync/` directory
- No manifest.json, changelog.json
- No file change tracking
- No conflict detection

**Dependencies**: Requires Phase 1 + Phase 2

---

## What You Actually Have

### Current App Flow

```
App.tsx
└── TabManager (✅ implemented)
    └── TabContent (✅ routes based on tab.type)
        ├── tab.type === 'home' → HomeView (✅)
        └── tab.type === 'project' → ProjectView (✅)
            └── isVault prop (✅ passed but unused)
```

**Missing**: No vault-specific rendering. The app treats vault projects the same as regular projects.

### Current Database State

Check if you have any vaults:
```bash
sqlite3 ~/.bluekit/bluekit.db "SELECT * FROM projects WHERE is_vault = 1;"
```

**Likely result**: Empty (no vaults created yet)

---

## Simplified Path Forward

### Option 1: Complete Original Vision (Ambitious)

Follow the original 7-phase plan. **Estimated effort: 9+ weeks**

**Pros**: Full-featured vault system
**Cons**: Long timeline, high complexity

**Recommended?** ❌ No - too ambitious for current state

---

### Option 2: Minimal Vault MVP (Pragmatic) ⭐ **RECOMMENDED**

Build the absolute minimum to have a functional vault. **Estimated effort: 3-5 days**

#### What to Build

1. **Vault Creation** (Day 1)
   - Add `get_vault_project()` command to Rust
   - Add `create_vault()` command (wrapper around `create_project` with `is_vault=true`)
   - Build basic VaultSetupScreen component

2. **Vault Detection** (Day 1)
   - In TabManager, check if vault exists on app start
   - If no vault, show VaultSetupScreen
   - If vault exists, open it as the default "home" tab

3. **Vault UI** (Day 2-3)
   - Create VaultPage (copy ProjectView, different sidebar)
   - Add "Library" sidebar section (show vault's kits/notes)
   - Wire up vault project to existing notebook infrastructure

4. **Vault Navigation** (Day 3-4)
   - Add vault tab type (`tab.type === 'vault'`)
   - Update TabContent to render VaultPage
   - Add "Library" button to HomeView sidebar

5. **Testing & Polish** (Day 4-5)
   - Test vault creation flow
   - Test note creation in vault
   - Test navigation between vault and projects
   - Fix bugs

#### What NOT to Build (For MVP)

- ❌ Search (use browser Cmd+F for now)
- ❌ Wiki links (use markdown links)
- ❌ Templates (copy-paste for now)
- ❌ Daily notes automation
- ❌ Smart folders
- ❌ Sync preparation
- ❌ Multiple vaults

#### Success Criteria

- User can create a vault on first run
- Vault shows up as "Library" in sidebar
- Can create/edit notes in vault
- Can navigate: Vault ↔ Projects
- Vault notes persist and reload

---

### Option 3: Skip Vault Entirely (Radical Simplification)

**Question**: Do you actually need a central vault, or can you use projects for everything?

**Consider**: You already have:
- ✅ Project notebooks (working)
- ✅ File watching (working)
- ✅ Multi-project tabs (working)

**Alternative**: Treat your "personal vault" as just another project. Create a project called "Personal Knowledge Base" and use that.

**Pros**: Zero development needed
**Cons**: No "special" vault UX, no cross-project library view

**Recommended?** ⚠️ Only if you're willing to abandon the vault vision

---

## Recommended Next Steps

### Immediate Actions (Choose One)

#### A. Build Minimal Vault MVP (3-5 days)

**Day 1**: Backend + vault detection
1. Add `get_vault_project()` Rust command
2. Add `create_vault()` Rust command (wrapper)
3. Register commands in `main.rs`
4. Build VaultSetupScreen (50 lines)
5. Add vault detection to TabManager

**Day 2-3**: Vault UI
6. Create VaultPage component (copy ProjectView layout)
7. Create VaultSidebar with "Notes" section
8. Wire up vault to ProjectView infrastructure
9. Add "Library" button to HomeView sidebar

**Day 4-5**: Integration & testing
10. Add vault tab type to TabContent
11. Test vault creation → notes → navigation
12. Fix bugs, polish UX

#### B. Consolidate Documentation (1 day)

If you're not ready to build, at least **clean up the planning docs**:
1. **Archive** Phase 2-7 plans (move to `.bluekit/plans/vault/future/`)
2. **Create** `NEXT-STEPS.md` with just the minimal MVP
3. **Delete** outdated implementation guides
4. **Update** README with current status

This prevents future confusion and keeps focus on what's actually achievable.

---

## Key Decisions Needed

Before proceeding, decide:

1. **Do you want a vault?**
   - Yes → Proceed with Option 2 (Minimal MVP)
   - No → Delete vault plans, use projects only

2. **When do you want to build it?**
   - Now → Start Day 1 tasks above
   - Later → Archive plans, consolidate docs
   - Never → Delete vault directory

3. **What scope?**
   - Minimal (3-5 days) → Follow Option 2
   - Full-featured (9+ weeks) → Follow original 7-phase plan
   - None → Skip vault

---

## What to Delete/Archive

### Immediate Cleanup (Recommended)

**Archive to `.bluekit/plans/vault/archive/`:**
- `phase-2-enhanced-features.md` (future work)
- `phase-3-sync-preparation.md` (future work)
- `IMPLEMENTATION_GUIDE.md` (outdated - doesn't reflect current arch)

**Keep:**
- `ARCHITECTURE.md` (still valid concept)
- `vision.md` (long-term vision)
- `phase-0-ui-overhaul.md` (reference only - already done differently)
- `phase-1-local-vault.md` (active work)
- `README.md` (update to reflect current status)

**Create:**
- `CONSOLIDATED-STATUS.md` (this document)
- `NEXT-STEPS-MINIMAL.md` (simplified plan)

---

## Questions for You

1. **Do you still want a central "vault" separate from projects?**
   - If yes: Continue with minimal MVP
   - If no: Delete vault plans, use existing project system

2. **What problem are you solving with the vault?**
   - Cross-project knowledge management?
   - Personal learning notes?
   - Daily journaling?
   - **Answer determines whether vault is needed or if projects suffice**

3. **What's your timeline?**
   - This week: Start minimal MVP
   - This month: Plan more carefully
   - Someday: Archive for later
   - Never: Delete plans

---

## Summary

You've built excellent infrastructure (tabs, database, architecture) but haven't implemented the vault **user experience** yet. The path forward is to either:

1. **Build minimal vault** (3-5 days, high value)
2. **Consolidate docs** (1 day, reduces confusion)
3. **Skip vault** (0 days, use projects only)

**Recommendation**: Option 1 (Minimal MVP) - You're 80% there on infrastructure, just need the UI.

Would you like me to:
- Create the minimal MVP implementation plan?
- Help you consolidate/archive the docs?
- Build the vault creation flow?
