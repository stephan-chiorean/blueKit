# UX Overhaul Plan

## Overview

This plan restructures BlueKit's architecture to align with a tab-based navigation system, improving code organization and enabling persistent multi-context workflows.

## Current Status

### ✅ Phase 1: Architecture Restructure (COMPLETE)

**Goal**: Reorganize codebase into app/views/features/shared structure

**Completed**:
- ✅ Created new folder structure (app/, views/, features/, shared/, tabs/)
- ✅ Moved all feature components to `src/features/`
- ✅ Moved tab UI chrome to `src/tabs/`
- ✅ Moved shared utilities to `src/shared/`
- ✅ Moved project view to `src/views/project/`
- ✅ Deleted old `src/components/` directory
- ✅ Path aliases configured in tsconfig.json and vite.config.ts
- ✅ Zero TypeScript missing module errors (TS2307)

**Remaining Cleanup**:
- ⚠️ `src/pages/` directory still exists (should be migrated to `src/views/` or consolidated)
- Some deep relative imports may remain in pages files

**Git Commit**: `a810034` - "refactor: restructure architecture into app/views/features/shared (phase 1+2)"

---

### ✅ Phase 2: Stabilization (MOSTLY COMPLETE)

**Goal**: Stabilize import paths and complete module boundaries

**Completed**:
- ✅ Feature module boundaries established
- ✅ Sidebar components moved to views/project/
- ✅ Import hygiene improvements (many files updated to use aliases)
- ✅ No new missing-module errors introduced

**In Progress**:
- 🔄 Final import hygiene sweep (some relative imports remain in pages/)
- 🔄 Decision on final home for remaining `src/pages/` files

**Files Modified** (currently staged):
- Multiple import path updates across features/, shared/, pages/
- GitHub auth improvements
- Several component deletions (BaseTabContent, Header, Placeholder, etc.)

---

### 🔲 Phase 3: Tab Infrastructure Implementation (NOT STARTED)

**Next Major Milestone** - See `phase-3-tabs-implementation.md`

**Goal**: Implement TabManager, TabContext, and persistent tab state

**Status**:
- Current tab UI in `src/tabs/` is **presentational only** (no state management)
- Tab state in ProjectView.tsx is **local** (lost on navigation)
- Need global TabContext for persistent tabs across navigation

---

## Architecture Overview

### Current Structure

```
src/
├── app/                 # Core infrastructure (App.tsx, contexts)
├── views/              # Top-level views (home/, project/, viewer/)
├── features/           # Self-contained domain modules (kits/, walkthroughs/, etc.)
├── shared/             # Generic utilities and components
├── tabs/               # Tab UI chrome (BrowserTabs, BrowserTab, etc.)
├── pages/              # ⚠️ Legacy - needs migration/consolidation
└── [other dirs]
```

### Dependency Rules

- `app/` → can import from all
- `views/` → can import from features, shared, tabs
- `features/` → can import from shared
- `shared/` → imports nothing (except external libs)
- `tabs/` → can import from shared

---

## Key Documents

- `phase-3-tabs-implementation.md` - Next phase implementation plan
- `/Users/.../tabs-implementation.md` - Full tabs architecture specification
- `/Users/.../architecture-restructure-plan.md` - Original restructure plan

---

## Next Steps

1. **Complete Phase 2 cleanup** (optional, can defer):
   - Decide on `src/pages/` final location
   - Final import hygiene sweep

2. **Begin Phase 3** (recommended priority):
   - Implement TabManager as root container
   - Create TabContext for global tab state
   - Create TabContent renderer
   - Move tab state out of ProjectView
   - Add persistence to `.bluekit/workspace/tabs.json`

See `phase-3-tabs-implementation.md` for detailed implementation plan.
