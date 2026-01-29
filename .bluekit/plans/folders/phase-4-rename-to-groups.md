---
id: folders-phase-4-rename-to-groups
alias: "Phase 4: Rename Folders → Groups"
type: plan
tags: [frontend, ui, terminology, refactoring]
description: "Update all UI text from 'Folders' to 'Groups' while keeping backend terms unchanged"
status: pending
---

# Phase 4: Rename Folders → Groups in UI

## Overview
Replace all user-facing occurrences of "Folder" with "Group" in the UI layer. Backend code and file system structures remain unchanged (still use "folder" in paths and function names).

## Prerequisites
- ✅ Phase 3 complete (animations working)

## Goals
- ✅ Change all UI labels from "Folder" to "Group"
- ✅ Update button text, headings, and tooltips
- ✅ Update toast notifications
- ✅ Update placeholder text and help text
- ✅ Keep backend terminology unchanged (no IPC changes)
- ✅ Update component display names where appropriate

## Terminology Mapping

| Old (Folder) | New (Group) |
|--------------|-------------|
| "Folders" (heading) | "Groups" |
| "New Folder" | "New Group" |
| "Create Folder" | "Create Group" |
| "Rename Folder" | "Rename Group" |
| "Delete Folder" | "Delete Group" |
| "Folder created" | "Group created" |
| "Folder renamed" | "Group renamed" |
| "Folder deleted" | "Group deleted" |
| "No folders yet" | "No groups yet" |
| "Folder name" | "Group name" |

**Backend terms stay the same:**
- `ArtifactFolder` (type name)
- `get_artifact_folders` (command)
- `create_artifact_folder` (command)
- `.bluekit/kits/my-folder/` (directory structure)

## Files to Modify

### 1. `src/views/project/sections/KitsSection.tsx`

**Status:** ✅ ALREADY UPDATED

The following changes have already been implemented:
- Groups heading present
- New Group button text updated
- Toast messages use "Group renamed" and "Group deleted"
- Empty state message removed (was "All kits are organized in groups")
- Filter and New Group buttons moved to header as icon-only buttons

**No further changes needed** - this file is already compliant with Phase 4 goals.

### 2. `src/views/project/sections/WalkthroughsSection.tsx`

**Apply same pattern as KitsSection:**
- [ ] Heading: "Folders" → "Groups"
- [ ] Button text: "New Folder" → "New Group"
- [ ] Toast messages: "Group renamed" / "Group deleted"
- [ ] Remove empty state: "All walkthroughs are organized in groups"

### 3. `src/shared/components/CreateFolderPopover.tsx`

**Dialog title and labels:**
```tsx
// Title:
<DialogHeader>Create New Group</DialogHeader>

// Name field label:
<Field.Label>Group Name</Field.Label>

// Placeholder:
<Input placeholder="e.g., UI Components" />

// Description label:
<Field.Label>Description</Field.Label>
<Textarea placeholder="What's this group for?" />

// Submit button:
<Button colorPalette="primary" onClick={handleCreate}>
  Create Group
</Button>
```

### 4. `src/shared/components/DeleteFolderDialog.tsx`

**Update dialog text:**
- [ ] Title: "Delete Folder" → "Delete Group"
- [ ] Body text: "delete the group" and "delete the group and all its contents"
- [ ] Button: "Delete Folder" → "Delete Group"

### 5. `src/shared/components/FolderView.tsx`

**Check for any folder-related text in the folder detail view**
- [ ] Breadcrumbs or titles mentioning "folder"
- [ ] Action buttons or menus

### 6. `src/shared/components/ResourceSelectionBar.tsx`

**If it has folder-related actions:**
- [ ] "Move to Folder" → "Move to Group"
- [ ] Modal title if applicable

### 7. `src/features/diagrams/components/DiagramsTabContent.tsx`

**Apply same pattern if it uses folders:**
- [ ] "Folders" → "Groups"
- [ ] "New Folder" → "New Group"
- [ ] Toast messages updated

## Critical: Preserve Cross-Project Caching

**DO NOT MODIFY** the following files during this refactor:
- `src/app/TabContent.tsx` - Contains project registry caching logic
- `src/app/TabContext.tsx` - Tab state management
- `src/views/project/ProjectView.tsx` - Artifact loading optimization

These files implement performance-critical caching that enables smooth tab switching between projects. The refactor is **purely cosmetic** and should only touch:
- UI string literals
- JSX text content
- Toast messages
- Dialog titles

**Architecture to preserve:**
1. **Project registry caching** (TabContent.tsx) - Cache-first lookup prevents redundant API calls
2. **Optimistic artifact loading** (ProjectView.tsx) - Only shows loading on true initial load
3. **Graceful empty states** - Sections handle transitions without flicker

If you touch these files, you MUST:
- Verify project registry cache (`projectsCache`) logic remains intact
- Verify artifact loading optimization (`artifacts.length === 0` check) unchanged
- Run cross-project tab switching tests to ensure no performance regression

See `.bluekit/walkthroughs/cross-project-tab-switching-architecture.md` for details.

## Testing Checklist

### Visual Inspection
- [ ] Kits tab: "Groups" heading visible
- [ ] Walkthroughs tab: "Groups" heading visible
- [ ] Diagrams tab: "Groups" heading visible (if applicable)
- [ ] "New Group" button text correct
- [ ] Create dialog title says "Create New Group"
- [ ] Delete dialog says "Delete Group"
- [ ] Rename popover says "Rename Group"

### Toast Notifications
- [ ] Create group: "Group created"
- [ ] Rename group: "Group renamed"
- [ ] Delete group: "Group deleted"
- [ ] Error toasts say "Failed to ... group"

### Empty States
- [ ] "No groups yet" message
- [ ] "All kits are organized in groups" message (REMOVED - see note below)
- [ ] "All walkthroughs are organized in groups" message (REMOVED - see note below)

**Note:** The empty state messages "All X are organized in groups" have been removed as they add no value and create visual noise during tab switches. Only show "No kits/walkthroughs match the current filters" when filters are active.

### Consistency Check
- [ ] No remaining "folder" text in UI
- [ ] Backend code still uses "folder" (IPC unchanged)
- [ ] File paths still use folder terminology

### Performance Regression Testing
- [ ] Tab switching between different projects is instant (<200ms)
- [ ] No "Loading project..." flash when switching to cached projects
- [ ] Artifact sections don't show flicker during project switches
- [ ] Browser DevTools Network shows minimal API calls during tab switches

## Search & Replace Strategy

**Global search for UI strings (case-sensitive):**
```bash
# In src/components/ only:
grep -r "Folder" src/components/
```

**Exclude from search:**
- `src/ipc/` (backend terms)
- `src-tauri/` (backend code)
- Type names like `ArtifactFolder` (internal)
- Function names (internal)

**Safe to change:**
- String literals: `"New Folder"` → `"New Group"`
- JSX text: `<Text>Folders</Text>` → `<Text>Groups</Text>`
- Comments: `// Create folder` → `// Create group`

## Acceptance Criteria
- ✅ All user-facing text says "Group" instead of "Folder"
- ✅ Backend code and IPC unchanged
- ✅ File system paths unchanged
- ✅ Type names unchanged (internal)
- ✅ Toast notifications updated
- ✅ Dialog titles updated
- ✅ Button labels updated
- ✅ No broken functionality
- ✅ **CRITICAL:** Cross-project tab switching performance unchanged (sub-200ms)
- ✅ **CRITICAL:** Project registry caching still works (cache hits on repeated switches)
- ✅ **CRITICAL:** No loading flicker when switching between cached projects

## Dependencies
**Before:** Phase 3 (animations)
**After:** Phase 5 (testing & polish)

## Migration Notes

### Why "Groups"?
- More semantic: groups organize related items
- Less technical: "folder" implies file system
- Matches mental model: collections of related resources

### Backward Compatibility
No migration needed - this is purely cosmetic UI change. Existing folders (file system) continue to work. Users just see different terminology.

## Design Consistency

### Icon Choice
Keep `LuFolderPlus` icon despite name change:
- Folder icon is universal for organization
- Users understand folder = container
- No confusion despite "Group" label

### Alternative Icons (if desired)
- `LuLayersIcon` - stacked layers (implies grouping)
- `LuArchive` - collection container
- `LuFolders` - multiple folders (group concept)

**Recommendation:** Keep `LuFolderPlus` for familiarity

## Implementation Strategy

### Phase 4A: Remaining UI Updates (KitsSection ✅ Already Done)
1. Update WalkthroughsSection.tsx
2. Update DiagramsTabContent.tsx (if applicable)
3. Update shared components (CreateFolderPopover, DeleteFolderDialog)
4. Update ResourceSelectionBar (if applicable)

### Phase 4B: Verification
1. Visual inspection of all tabs
2. Test all folder→group operations (create, rename, delete)
3. **Performance regression test**: Switch between projects rapidly, verify no loading flicker
4. Check browser DevTools Network tab for cache hits

### Key Principle
**This is a find-and-replace operation on string literals only.** Do NOT:
- Refactor component logic
- Change state management
- Modify data loading code
- Touch TabContent.tsx or ProjectView.tsx
- Rename internal types or functions

The goal is 100% cosmetic UI change with 0% behavior change.
