# Phase 4: Migrate Pages

**Status:** Not Started
**Duration:** 1-2 days
**Dependencies:** Phase 3 complete

## Overview

Replace the old editor with the new hybrid editor in each page, one at a time. All changes are behind the feature flag for safety. Start with simpler pages and progress to more complex ones.

## Goals

- Migrate all pages using markdown editors
- Maintain feature parity
- Keep feature flag for rollback
- Test each migration thoroughly
- No breaking changes to UX

## Pages to Migrate

### 1. NoteViewPage (Simplest - Start Here)

**Location:** `src/pages/NoteViewPage.tsx`

**Current State:**
- Displays notebook files from `.bluekit/` directory
- Uses `MarkdownEditor` component
- Auto-save on edit
- H1-based file renaming (will skip this)

**Migration:**

```tsx
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { HybridEditorWithFeatures } from '@/shared/components/hybridEditor';
import { MarkdownEditor } from '@/shared/components/editor/MarkdownEditor';

export default function NoteViewPage() {
  const { flags } = useFeatureFlags();
  const { note } = useNote(); // Existing hook

  // Prepare resource for new editor
  const resource: ResourceFile = {
    path: note.path,
    projectPath: note.projectPath,
    content: note.content,
    name: note.name,
    type: 'note',
  };

  return (
    <Box h="100%" display="flex" flexDirection="column">
      <NoteViewHeader note={note} />

      {/* Conditional editor rendering */}
      <Box flex={1} overflowY="auto" px={6} py={4}>
        {flags.useHybridEditor ? (
          <HybridEditorWithFeatures
            resource={resource}
            showSearch={false}
            showBacklinks={false}
          />
        ) : (
          <MarkdownEditor
            value={note.content}
            onChange={(value) => {
              // Existing save logic
            }}
          />
        )}
      </Box>
    </Box>
  );
}
```

**Changes:**
- ✅ Add feature flag check
- ✅ Wrap old editor in conditional
- ✅ Add new editor in conditional
- ❌ Remove H1 title syncing (skip this logic in both modes)

**Testing:**
- [ ] Flag OFF → Old editor works
- [ ] Flag ON → New editor works
- [ ] Switching flag → No state corruption
- [ ] Auto-save works in both modes
- [ ] Sibling navigation works

---

### 2. ResourceViewPage (Kits/Walkthroughs)

**Location:** `src/pages/ResourceViewPage.tsx`

**Current State:**
- Displays kits, walkthroughs, agents
- Uses `EditableMarkdownViewer` component
- Three modes: preview, source, edit
- Has metadata display, links, backlinks

**Migration Strategy:**

```tsx
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { HybridEditorWithFeatures } from '@/shared/components/hybridEditor';
import { EditableMarkdownViewer } from '@/features/workstation/components/EditableMarkdownViewer';

export default function ResourceViewPage() {
  const { flags } = useFeatureFlags();
  const { resource } = useWorkstation(); // Existing hook

  return (
    <Box h="100%">
      <ResourceHeader resource={resource} />

      <Box flex={1} overflowY="auto">
        {flags.useHybridEditor ? (
          <HybridEditorWithFeatures
            resource={resource}
            showSearch={true}
            showBacklinks={true}
          />
        ) : (
          <EditableMarkdownViewer
            resource={resource}
            mode={viewMode}
            onModeChange={setViewMode}
            // ... other existing props
          />
        )}
      </Box>
    </Box>
  );
}
```

**Changes:**
- ✅ Add feature flag check
- ✅ Wrap old viewer in conditional
- ✅ Add new editor in conditional
- ⚠️ Note: Hybrid editor always shows preview (no source mode toggle)

**Testing:**
- [ ] Flag OFF → Old viewer works with all 3 modes
- [ ] Flag ON → New editor works (always in preview/edit hybrid)
- [ ] Metadata display works
- [ ] Links work
- [ ] Backlinks work
- [ ] Search (Cmd+F) works

---

### 3. PlanWorkspace (Plan Documents)

**Location:** `src/features/plans/components/PlanWorkspace.tsx`

**Current State:**
- Displays plan markdown files
- Uses `MarkdownEditor` or `EditableMarkdownViewer`
- Plan-specific features (task tracking, etc.)

**Migration Strategy:**

```tsx
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { HybridEditorWithFeatures } from '@/shared/components/hybridEditor';

export function PlanWorkspace({ plan }: { plan: Plan }) {
  const { flags } = useFeatureFlags();

  const resource: ResourceFile = {
    path: plan.path,
    projectPath: plan.projectPath,
    content: plan.content,
    name: plan.name,
    type: 'plan',
  };

  return (
    <VStack align="stretch" h="100%">
      <PlanHeader plan={plan} />

      <Box flex={1} overflowY="auto">
        {flags.useHybridEditor ? (
          <HybridEditorWithFeatures
            resource={resource}
            showSearch={false}
            showBacklinks={false}
          />
        ) : (
          {/* Existing editor component */}
        )}
      </Box>

      <PlanFooter plan={plan} />
    </VStack>
  );
}
```

**Testing:**
- [ ] Flag OFF → Old editor works
- [ ] Flag ON → New editor works
- [ ] Plan-specific features preserved
- [ ] Task tracking still works (if applicable)

---

### 4. PlanDocViewPage (If Separate)

**Location:** `src/features/plans/components/PlanDocViewPage.tsx`

**Similar migration pattern as above.**

---

## Migration Checklist

### Pre-Migration (Per Page)

- [ ] Identify current editor component used
- [ ] Identify all props passed to editor
- [ ] Identify all features used (search, backlinks, etc.)
- [ ] Map props to `HybridEditorWithFeatures` API
- [ ] Identify any custom logic to preserve

### During Migration (Per Page)

- [ ] Add `useFeatureFlags` hook import
- [ ] Add conditional rendering with feature flag
- [ ] Keep old editor in `false` branch
- [ ] Add new editor in `true` branch
- [ ] Preserve all surrounding UI (headers, footers)
- [ ] Test with flag OFF
- [ ] Test with flag ON
- [ ] Test switching flag while page open

### Post-Migration (Per Page)

- [ ] Code review
- [ ] Test all features
- [ ] Test keyboard shortcuts
- [ ] Test auto-save
- [ ] Test file watching
- [ ] Verify no regressions
- [ ] Merge to main

---

## Common Props Mapping

**Old `MarkdownEditor` props → New editor:**

| Old Prop | New Equivalent |
|----------|---------------|
| `value` | `resource.content` |
| `onChange` | Handled by adapter (auto-save) |
| `readOnly` | Not supported yet (add if needed) |
| `onSave` | `HybridEditorWithFeatures.onSave` |

**Old `EditableMarkdownViewer` props → New editor:**

| Old Prop | New Equivalent |
|----------|---------------|
| `resource` | `resource` (same) |
| `mode` | N/A (hybrid always preview/edit) |
| `onModeChange` | N/A |
| `showSearch` | `showSearch` (same) |
| `showBacklinks` | `showBacklinks` (same) |

---

## Feature Parity Matrix

| Feature | Old Editor | Hybrid Editor | Notes |
|---------|-----------|---------------|-------|
| Auto-save | ✅ | ✅ | Via adapter |
| Manual save (Cmd+S) | ✅ | ✅ | Via useAutoSave |
| File watcher | ✅ | ✅ | Via adapter |
| Search (Cmd+F) | ✅ | ✅ | Via SearchInMarkdown |
| Syntax highlighting | ✅ | ✅ | Via Shiki |
| Backlinks | ✅ | ✅ | Via BacklinksPanel |
| Preview mode | ✅ | ✅ | Always on (hybrid) |
| Source mode | ✅ | ❌ | Removed (edit inline instead) |
| Edit mode | ✅ | ✅ | Click blocks |
| Multi-cursor | ✅ | ❌ | Not supported |
| Find/replace | ✅ | ⚠️ | Find only (replace later) |

---

## Migration Order

**Recommended sequence:**

1. **NoteViewPage** (Simplest)
   - Single editor
   - No complex features
   - Good test case

2. **ResourceViewPage** (Medium complexity)
   - Most used page
   - Has backlinks and search
   - Representative of full features

3. **PlanWorkspace** (If applicable)
   - Similar to ResourceViewPage
   - May have plan-specific logic

4. **Any other pages** (Discover via search)
   - Search codebase: `import.*MarkdownEditor`
   - Search codebase: `import.*EditableMarkdownViewer`
   - Migrate any remaining instances

---

## Search for Remaining Instances

**After migrating known pages:**

```bash
# Find all imports of old editors
rg "import.*MarkdownEditor" --type tsx
rg "import.*EditableMarkdownViewer" --type tsx

# Find all usages
rg "<MarkdownEditor" --type tsx
rg "<EditableMarkdownViewer" --type tsx
```

**Ensure all usages are behind feature flag.**

---

## Testing Strategy

### Smoke Test (Each Page)

1. Open page with flag OFF
2. Edit content → Verify save
3. Toggle flag ON (refresh if needed)
4. Edit content → Verify save
5. Compare content → Should be identical
6. Toggle flag back OFF → Verify still works

### Full Regression Test (After All Migrations)

**Test matrix:**

| Page | Feature | Flag OFF | Flag ON |
|------|---------|----------|---------|
| NoteViewPage | Edit & save | ✅ | ✅ |
| NoteViewPage | Auto-save | ✅ | ✅ |
| NoteViewPage | Navigation | ✅ | ✅ |
| ResourceViewPage | Edit & save | ✅ | ✅ |
| ResourceViewPage | Search | ✅ | ✅ |
| ResourceViewPage | Backlinks | ✅ | ✅ |
| PlanWorkspace | Edit & save | ✅ | ✅ |

---

## Rollback Plan

**If issues found during migration:**

1. Feature flag allows immediate rollback (toggle OFF)
2. Fix bug in hybrid editor
3. Test fix in isolation
4. Re-enable feature flag

**If migration breaks a page:**

1. Revert the specific commit for that page
2. Keep other pages migrated
3. Fix issue
4. Re-migrate page

---

## Acceptance Criteria

- [ ] NoteViewPage migrated and tested
- [ ] ResourceViewPage migrated and tested
- [ ] PlanWorkspace migrated (if applicable)
- [ ] All other pages using old editors identified and migrated
- [ ] Feature flag works for all pages
- [ ] No regressions in any existing features
- [ ] Both editors work without conflicts
- [ ] Code reviewed and approved

---

## Next Steps

After Phase 4 completion:
- Tag commit: `hybrid-editor-phase-4-complete`
- Move to Phase 5: Stabilize
- Begin dogfooding with flag ON
- Collect feedback and fix bugs

---

**Files Modified:**
- `src/pages/NoteViewPage.tsx`
- `src/pages/ResourceViewPage.tsx`
- `src/features/plans/components/PlanWorkspace.tsx`
- Any other pages discovered via search

**No files deleted** (old editors still in codebase for rollback)
