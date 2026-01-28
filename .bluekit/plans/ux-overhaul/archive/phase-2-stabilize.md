# Phase 2: Stabilize Refactor + Complete Module Boundaries

## Goal

Finish the architecture restructure started in Phase 1 by:
- Stabilizing refactor fallout (imports, barrels, stray paths)
- Moving remaining domain components into `features/` and `views/`
- Consolidating truly generic code into `shared/`

This phase should still avoid visual changes and avoid intentional behavior changes.

**Success Criteria**:
- ✅ No new missing-module errors (TS2307)
- ✅ No syntax/import corruption from batch replacements
- ✅ Remaining `src/components/*` folders are either shared/generic or clearly scoped
- ✅ Project view owns its sidebar internals
- ✅ App runs the same as before
- ✅ Build errors are not increased by this refactor (baseline issues may still exist)

---

## Pre-Migration Checklist

### 1. Capture Current Refactor Health

Use these as guardrails while refactoring:

```bash
# Missing modules only
npx tsc --noEmit --pretty false 2>&1 | rg "TS2307|Cannot find module"

# Syntax/parse issues only
npx tsc --noEmit --pretty false 2>&1 | rg "TS1005|TS1109|TS1128|TS1135|TS1144|TS1160|TS1161"

# Find any corrupted alias imports like from "@/";
rg "from \"@/\";|from '@/';" src
```

### 2. Inventory Remaining Legacy Structure

```bash
# What still lives under components/
find src/components -maxdepth 2 -type d | sort

# Old-style component imports that should become feature/shared imports
rg "@/components/(auth|bookmarks|commits|library|sidebar|logo|workspace)" src
```

---

## Migration Steps

### Step 1: Lock In Safe Barrel Generation

Phase 1 uncovered that barrel files must not assume default exports.

**Requirements**:
- Only generate `export { default as X }` when a default export exists
- Always include `export * from './X'`
- Ensure empty barrels are still modules via `export {}`

**Verify**:

```bash
npx tsc --noEmit --pretty false 2>&1 | rg "is not a module|has no exported member 'default'"
```

---

### Step 2: Finish Project View Ownership of Sidebar Internals

Several sidebar helper components remain in `src/components/sidebar` but are project-view-specific.

**Move into project view**:
- `src/components/sidebar/DirectoryContextMenu.tsx` → `src/views/project/components/DirectoryContextMenu.tsx`
- `src/components/sidebar/FileContextMenu.tsx` → `src/views/project/components/FileContextMenu.tsx`
- `src/components/sidebar/NotebookToolbar.tsx` → `src/views/project/components/NotebookToolbar.tsx`
- `src/components/sidebar/SidebarMenuItem.tsx` → `src/views/project/components/SidebarMenuItem.tsx`

**Update imports**:
- `NotebookTree.tsx` should import these via `./DirectoryContextMenu`, `./FileContextMenu`
- `SidebarContent.tsx` should import `NotebookToolbar` and `SidebarMenuItem` locally

**Verify**:

```bash
npx tsc --noEmit --pretty false 2>&1 | rg "TS2307|Cannot find module"
```

---

### Step 3: Move Remaining Domain Components into `features/`

These folders still represent domain features and should be feature modules.

**Create missing features**:
- `src/features/auth/components`
- `src/features/bookmarks/components`
- `src/features/commits/components`
- `src/features/library/components`

**Move components**:
- `src/components/auth/*` → `src/features/auth/components/`
- `src/components/bookmarks/*` → `src/features/bookmarks/components/`
- `src/components/commits/*` → `src/features/commits/components/`
- `src/components/library/*` → `src/features/library/components/`

**Update imports across the codebase**:
- `@/components/auth/...` → `@/features/auth/...`
- `@/components/bookmarks/...` → `@/features/bookmarks/...`
- `@/components/commits/...` → `@/features/commits/...`
- `@/components/library/...` → `@/features/library/...`

**Add/refresh barrels**:
- `src/features/<feature>/components/index.ts`
- `src/features/<feature>/index.ts`

**Verify**:

```bash
npx tsc --noEmit --pretty false 2>&1 | rg "TS2307|Cannot find module"
```

---

### Step 4: Consolidate Generic UI into `shared/`

These are not domain features and should move to shared infrastructure.

**Candidates**:
- `src/components/editor/*` → `src/shared/components/editor/*`
- `src/components/ui/*` → `src/shared/components/ui/*`
- `src/components/logo/*` → `src/shared/components/logo/*`
- `src/components/NavigationDrawer.tsx` → `src/shared/components/navigation/NavigationDrawer.tsx`

**Guidelines**:
- Preserve external API surface where possible (barrels help)
- Use aliases for clarity (`@/shared/components/...`)

**Verify**:

```bash
rg "@/components/(editor|ui|logo|NavigationDrawer)" src
npx tsc --noEmit --pretty false 2>&1 | rg "TS2307|Cannot find module"
```

---

### Step 5: Import Hygiene Sweep (No Behavior Changes)

Now that modules live in clearer places, standardize imports.

**Goals**:
- Prefer aliases over deep relative imports
- Prefer feature/shared barrels when it reduces churn
- Avoid partial/corrupted alias replacements

**Useful reports**:

```bash
# Deep relative imports still present
rg "from '\.\./|from \"\.\./" src

# Legacy components paths that should be features/shared
rg "@/components/" src
```

---

### Step 6: Cleanup Empty Directories

After moves, remove empty legacy folders.

```bash
find src -type d -empty | sort

# Remove the empty ones that are legacy leftovers
# (Run rmdir selectively; avoid deleting placeholder folders you still want)
```

---

## Post-Migration Checklist

### 1. Missing-Module + Syntax Checks

```bash
npx tsc --noEmit --pretty false 2>&1 | rg "TS2307|Cannot find module"
npx tsc --noEmit --pretty false 2>&1 | rg "TS1005|TS1109|TS1128|TS1135|TS1144|TS1160|TS1161"
```

### 2. Full Build (Expect Baseline Errors)

```bash
npm run build
```

Interpretation guidance:
- It is acceptable for the build to fail due to pre-existing baseline errors.
- It is not acceptable for the build to fail due to missing modules introduced by this refactor.

### 3. Manual App Verification

- Launch dev server / Tauri app
- Navigate: Welcome → Home → Project
- Use the project sidebar and switch sections
- Open kits / walkthroughs / plans / tasks / diagrams / git / bookmarks
- Confirm file watchers still update content

---

## Notes / Guardrails

- Do not use git operations in this phase.
- Avoid visual/styling changes.
- Avoid intentionally changing behavior; if behavior must change to stabilize the refactor, keep it minimal and document it inline.
