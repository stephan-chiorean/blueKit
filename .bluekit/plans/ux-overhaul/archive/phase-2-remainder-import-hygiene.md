# Phase 2 Remainder: Import Hygiene + Final Cleanup

## Goal

Finish the remaining Phase 2 stabilization work without changing behavior:
- Standardize deep relative imports to `@/` aliases
- Decide the final home for the last `src/components/*` files
- Clean up leftover legacy structure where safe

This is still a refactor-only phase.

---

## What Still Looks Phase-2-ish (Observed)

No legacy `@/components/*` imports remain, and there are no new missing-module errors (TS2307).

However, deep relative imports still exist in a few clusters:
- `src/pages/*` (e.g., `../components/Header`, `../ipc`, `../types`)
- `src/shared/components/*` (e.g., `../../ipc`, `../../types`)
- A few internal feature files (mostly assets)

---

## Steps

### Step 1: Capture Current Import State

```bash
# Deep relative imports report
rg "from '\.\./|from \"\.\./" src

# Confirm no missing-module regressions
npx tsc --noEmit --pretty false 2>&1 | rg "TS2307|Cannot find module" || true
```

---

### Step 2: Normalize Deep Relative Imports to Aliases

Prioritize high-churn/shared areas first:

1. Update shared components:
- `src/shared/components/SimpleFolderCard.tsx`: `../../ipc` → `@/ipc`
- `src/shared/components/DraggableArtifactCard.tsx`: `../../ipc` → `@/ipc`
- `src/shared/components/ResourceCard.tsx`: `../../ipc` → `@/ipc`
- `src/shared/components/DeleteFolderDialog.tsx`: `../../ipc` → `@/ipc`
- `src/shared/components/FolderCard.tsx`: `../../ipc` → `@/ipc`
- `src/shared/components/CreateFolderDialog.tsx`: `../../ipc` → `@/ipc`
- `src/shared/components/PlanResourceCard.tsx`: `../../types/plan` → `@/types/plan`

2. Update cross-cutting modules:
- `src/types/resource.ts`: `../ipc` → `@/ipc`
- `src/hooks/useAutoSave.ts`: `../ipc/files` → `@/ipc/files`

3. Update pages:
- Prefer alias imports like `@/components/Header`, `@/ipc`, `@/types`, `@/hooks`
- Files currently flagged:
  - `src/pages/WalkthroughViewPage.tsx`
  - `src/pages/EditorPlansPage.tsx`
  - `src/pages/KitViewPage.tsx`
  - `src/pages/ResourceViewPage.tsx`
  - `src/pages/PreviewWindowPage.tsx`
  - `src/pages/DiagramViewPage.tsx`
  - `src/pages/LibrarySetupScreen.tsx`
  - `src/pages/NoteViewPage.tsx`

Notes:
- Asset imports like `../../assets/...` can remain as-is unless an `@/assets` alias already exists.
- Avoid broad regex replacements; update clusters intentionally.

---

### Step 3: Decide the Final Home for `src/components/*`

Current remaining files:
- `src/components/Header.tsx`
- `src/components/BaseTabContent.tsx`
- `src/components/Placeholder.tsx`
- `src/components/ProjectDetailsModal.tsx`
- `src/components/TaskManagerDialog.tsx`

Options (pick one and apply consistently):

Option A (likely best for Phase 2):
- Move generic/infra UI to `src/shared/components/*`
- Update callers to `@/shared/components/...`
- Refresh `src/shared/components/index.ts`

Option B (defer movement, still stabilize imports):
- Keep these in `src/components/*`
- Still update all imports to alias form: `@/components/...`

---

### Step 4: Final Cleanup Sweep

```bash
# Remaining deep relative imports
rg "from '\.\./|from \"\.\./" src

# Any lingering legacy component paths
rg "@/components/" src

# Empty dirs (remove selectively)
find src -type d -empty | sort
```

If `src/components/` becomes empty after Step 3, remove it.

---

## Verification Checklist

```bash
# Missing modules
npx tsc --noEmit --pretty false 2>&1 | rg "TS2307|Cannot find module" || true

# Syntax issues
npx tsc --noEmit --pretty false 2>&1 | rg "TS1005|TS1109|TS1128|TS1135|TS1144|TS1160|TS1161" || true

# Barrel/default-export issues
npx tsc --noEmit --pretty false 2>&1 | rg "is not a module|has no exported member 'default'" || true
```

Success is: no new missing-module errors and no import corruption introduced by the hygiene pass.
