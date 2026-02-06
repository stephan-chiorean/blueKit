# Phase 6: Remove Old Code

**Status:** Not Started
**Duration:** 1 day
**Dependencies:** Phase 5 complete

## Overview

Make the hybrid editor the default, remove old editor components, uninstall CodeMirror dependencies, and clean up feature flag infrastructure. This is the final step before the new editor becomes the permanent solution.

## Goals

- Make hybrid editor default (flag ON)
- Monitor for issues for 2-3 days
- Delete old editor components
- Remove CodeMirror dependencies
- Simplify conditional rendering (remove flag)
- Clean commit history

## Implementation Steps

### Step 1: Make Hybrid Editor Default

**Location:** `src/shared/contexts/FeatureFlagsContext.tsx`

**Change:**
```typescript
const defaultFlags: FeatureFlags = {
  useHybridEditor: true,  // ✅ Change from false to true
};
```

**Commit:**
```bash
git add src/shared/contexts/FeatureFlagsContext.tsx
git commit -m "feat: make hybrid editor default"
```

**Deploy:**
- Merge to main branch
- Deploy to staging (if applicable)
- Monitor for 2-3 days

**Monitor:**
- Check error logs
- Watch for user reports
- Review analytics (if available)

**Rollback plan:**
- If critical issues: revert commit
- Users can still toggle flag OFF in settings

---

### Step 2: Soak Period (2-3 Days)

**Activities:**
- Use app normally with hybrid editor as default
- Encourage team to report any issues
- Monitor Sentry/logs for crashes
- Check save success rate

**Criteria to proceed:**
- No critical bugs reported
- No data loss incidents
- Performance acceptable
- Team confident in stability

**If issues found:**
- Fix bugs
- Deploy fixes
- Restart soak period

---

### Step 3: Delete Old Editor Components

**Files to delete:**

```bash
# Core editor components
git rm src/shared/components/editor/MarkdownEditor.tsx
git rm src/features/workstation/components/EditableMarkdownViewer.tsx

# Any related files (check for dependencies)
# Example:
# git rm src/shared/components/editor/CodeMirrorConfig.ts
```

**Before deleting, verify not used anywhere:**

```bash
# Search for imports
rg "MarkdownEditor" --type tsx
rg "EditableMarkdownViewer" --type tsx

# Should only show:
# - Feature flag conditionals (will be removed next)
# - Old comments/docs
```

**Commit:**
```bash
git commit -m "refactor: remove legacy markdown editors

- Delete MarkdownEditor.tsx (CodeMirror-based)
- Delete EditableMarkdownViewer.tsx (3-mode viewer)
- Hybrid editor is now the only editor

Closes #[issue-number]"
```

---

### Step 4: Remove CodeMirror Dependencies

**Packages to uninstall:**

```bash
npm uninstall \
  @codemirror/state \
  @codemirror/view \
  @codemirror/commands \
  @codemirror/lang-markdown \
  @codemirror/language-data \
  @codemirror/search
```

**Verify removal:**
```bash
# Check package.json
cat package.json | grep codemirror
# Should return nothing

# Check lock file
cat package-lock.json | grep codemirror
# Should return nothing (after npm install)
```

**Rebuild to verify no import errors:**
```bash
npm install
npm run build
```

**Commit:**
```bash
git add package.json package-lock.json
git commit -m "chore: remove CodeMirror dependencies

Hybrid editor uses react-markdown instead of CodeMirror.
This reduces bundle size by ~80KB."
```

---

### Step 5: Remove Feature Flag Conditionals

**Update all pages to use hybrid editor directly:**

**Before:**
```tsx
const { flags } = useFeatureFlags();

return (
  <Box>
    {flags.useHybridEditor ? (
      <HybridEditorWithFeatures resource={resource} />
    ) : (
      <MarkdownEditor value={content} onChange={onChange} />
    )}
  </Box>
);
```

**After:**
```tsx
return (
  <Box>
    <HybridEditorWithFeatures resource={resource} />
  </Box>
);
```

**Files to update:**
- `src/pages/NoteViewPage.tsx`
- `src/pages/ResourceViewPage.tsx`
- `src/features/plans/components/PlanWorkspace.tsx`
- Any other pages with conditionals

**Remove unused imports:**
```tsx
// ❌ Remove
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { MarkdownEditor } from '@/shared/components/editor/MarkdownEditor';
import { EditableMarkdownViewer } from '@/features/workstation/components/EditableMarkdownViewer';
```

**Commit:**
```bash
git add src/pages/*.tsx src/features/**/*.tsx
git commit -m "refactor: remove hybrid editor feature flag conditionals

Hybrid editor is now always used. Simplifies code and removes
technical debt from migration period."
```

---

### Step 6: Remove Feature Flag Infrastructure (Optional)

**If `useHybridEditor` was the only flag:**

**Delete flag from context:**
```typescript
export interface FeatureFlags {
  // useHybridEditor: boolean; ❌ Remove
}

const defaultFlags: FeatureFlags = {
  // useHybridEditor: true, ❌ Remove
};
```

**Remove toggle UI:**
- Delete from settings page
- Delete from dev menu

**If keeping flag system for future flags:**

Just remove the `useHybridEditor` flag but keep the infrastructure.

**Commit:**
```bash
git add src/shared/contexts/FeatureFlagsContext.tsx src/pages/SettingsPage.tsx
git commit -m "chore: remove hybrid editor feature flag

Flag served its purpose during migration. No longer needed."
```

---

### Step 7: Update Documentation

**Files to update:**

**CLAUDE.md:**
```markdown
## Architecture Overview

### Markdown Editing

BlueKit uses a hybrid block-based markdown editor:
- Click any content block to edit inline
- Glassmorphic code block styling
- Auto-save with 1.5s debounce
- Real-time file watching

**Components:**
- `HybridMarkdownEditor`: Core editor with block parsing
- `HybridEditorWithFeatures`: Adapter with auto-save, search, backlinks
- Location: `src/shared/components/hybridEditor/`

**No longer used:**
- ~~MarkdownEditor (CodeMirror-based)~~ - Removed in v2.0
- ~~EditableMarkdownViewer~~ - Removed in v2.0
```

**README.md:**
```markdown
## Recent Changes

### v2.0 - Hybrid Block Editor

Replaced CodeMirror-based editor with hybrid block editor:
- Click-to-edit blocks for better UX
- 80KB smaller bundle size
- Glassmorphic code blocks
- Same auto-save and file watching

Migration was completed in Q1 2026.
```

**CHANGELOG.md:**
```markdown
## [2.0.0] - 2026-02-XX

### Added
- Hybrid block-based markdown editor
- Glassmorphic code block styling
- Click-to-edit blocks for smoother UX

### Removed
- CodeMirror-based MarkdownEditor component
- EditableMarkdownViewer component
- CodeMirror dependencies (~80KB bundle reduction)

### Changed
- All markdown editing now uses hybrid editor
- Title handled separately from content (no H1 syncing)

### Migration
- Old editor removed after successful 2-week testing period
- All existing features preserved (auto-save, search, backlinks)
```

**Commit:**
```bash
git add CLAUDE.md README.md CHANGELOG.md
git commit -m "docs: update for hybrid editor migration

Document removal of old editors and CodeMirror dependencies."
```

---

### Step 8: Bundle Size Analysis

**Measure impact:**

```bash
# Build production bundle
npm run build

# Check bundle sizes
ls -lh dist/assets/*.js

# Compare to previous build (from git history)
git checkout HEAD~20  # Before migration
npm run build
ls -lh dist/assets/*.js
git checkout main
```

**Expected:**
- Main bundle: ~50-100KB smaller
- Lazy chunks: Potentially smaller (no CodeMirror)

**Document results:**
```markdown
## Bundle Size Impact

Before hybrid editor migration:
- Main bundle: 1.2 MB
- Total: 2.5 MB

After hybrid editor migration:
- Main bundle: 1.1 MB (-100KB, -8%)
- Total: 2.4 MB (-100KB, -4%)

CodeMirror removal saved ~80KB gzipped.
```

---

## Rollback Plan

### If Critical Bug Found After Step 3

**Problem:** Old editors deleted but critical bug discovered

**Solution 1: Quick fix**
```bash
# Fix the bug in hybrid editor
# Deploy fix immediately
```

**Solution 2: Full rollback**
```bash
# Revert all commits from Phase 6
git revert HEAD~5..HEAD

# Reinstall CodeMirror
npm install @codemirror/state @codemirror/view ...

# Deploy rollback
npm run build
```

**Solution 3: Restore old editor temporarily**
```bash
# Checkout old editor files from git history
git checkout HEAD~10 -- src/shared/components/editor/MarkdownEditor.tsx
git checkout HEAD~10 -- src/features/workstation/components/EditableMarkdownViewer.tsx

# Reinstall CodeMirror
npm install @codemirror/state @codemirror/view ...

# Add feature flag back
# Default to false (old editor)
```

---

## Verification Checklist

**Before proceeding to next step:**

- [ ] Step 1: Hybrid editor is default, no issues reported
- [ ] Step 2: Soak period complete (2-3 days), stable
- [ ] Step 3: Old components deleted, build succeeds
- [ ] Step 4: CodeMirror uninstalled, build succeeds
- [ ] Step 5: Feature flag conditionals removed, build succeeds
- [ ] Step 6: Flag infrastructure cleaned (if applicable)
- [ ] Step 7: Documentation updated
- [ ] Step 8: Bundle size measured and documented

**Final verification:**

- [ ] App builds without errors
- [ ] All pages load correctly
- [ ] Markdown editing works in all contexts
- [ ] Auto-save works
- [ ] File watching works
- [ ] No console errors
- [ ] Bundle size reduced
- [ ] Git history clean

---

## Acceptance Criteria

- [ ] Hybrid editor is default in production
- [ ] Old editor components deleted from codebase
- [ ] CodeMirror dependencies removed from package.json
- [ ] Feature flag conditionals removed (or flag removed entirely)
- [ ] Documentation updated (CLAUDE.md, README, CHANGELOG)
- [ ] Bundle size reduction measured and documented
- [ ] All tests pass
- [ ] No critical bugs reported
- [ ] Code reviewed and approved

---

## Next Steps

After Phase 6 completion:
- Tag release: `v2.0.0-hybrid-editor`
- Move to Phase 7: Cleanup & Polish
- Celebrate! 🎉

---

**Git Tags:**

```bash
# After Step 1 (default changed)
git tag -a hybrid-editor-default -m "Hybrid editor is now default"

# After Step 8 (all done)
git tag -a hybrid-editor-complete -m "Migration complete, old code removed"
```

**Branch Strategy:**

```bash
# Work in feature branch throughout Phases 1-5
git checkout -b feature/hybrid-markdown-editor

# Merge to main after Phase 5 (while still behind flag)
git checkout main
git merge feature/hybrid-markdown-editor

# Phase 6 commits directly to main (or short-lived branch)
```
