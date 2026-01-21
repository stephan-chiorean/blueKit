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

### 1. `src/components/kits/KitsTabContent.tsx`

**Line 328:** Heading
```tsx
// Old:
<Heading size="md">Folders</Heading>

// New:
<Heading size="md">Groups</Heading>
```

**Line 333-351:** New Folder button
```tsx
// Old:
<CreateFolderPopover
  // ...
  trigger={
    <Button ...>
      <HStack gap={2}>
        <Icon><LuFolderPlus /></Icon>
        <Text>New Folder</Text>
      </HStack>
    </Button>
  }
/>

// New:
<CreateFolderPopover
  // ...
  trigger={
    <Button ...>
      <HStack gap={2}>
        <Icon><LuFolderPlus /></Icon>
        <Text>New Group</Text>
      </HStack>
    </Button>
  }
/>
```

**Line 457-470:** New Folder button (no folders exist)
```tsx
// Old:
<Text>New Folder</Text>

// New:
<Text>New Group</Text>
```

**Line 486:** Empty state message
```tsx
// Old:
: 'No kits at root level. All kits are organized in folders.'

// New:
: 'No kits at root level. All kits are organized in groups.'
```

**Toast messages in handlers:**
```tsx
// handleRenameFolder (line 209-224)
toaster.create({
  type: 'success',
  title: 'Group renamed',  // Changed
  description: `Renamed to ${newName}`,
});

toaster.create({
  type: 'error',
  title: 'Failed to rename group',  // Changed
  // ...
});

// handleDeleteFolder (line 239-255)
toaster.create({
  type: 'success',
  title: 'Group deleted',  // Changed
  description: `Deleted ${deletingFolder.name}`,
});

toaster.create({
  type: 'error',
  title: 'Failed to delete group',  // Changed
  // ...
});
```

### 2. `src/components/walkthroughs/WalkthroughsTabContent.tsx`

**Same changes as KitsTabContent:**

**Line 330:** Heading
```tsx
<Heading size="md">Groups</Heading>
```

**Line 382-401:** New Folder button
```tsx
<Text>New Group</Text>
```

**Line 424:** Empty state
```tsx
No groups yet. Create one to organize your walkthroughs.
```

**Line 469:** Root-level message
```tsx
: 'No walkthroughs at root level. All walkthroughs are organized in groups.'
```

**Toast messages (lines 188-234):**
- "Group renamed" / "Failed to rename group"
- "Group deleted" / "Failed to delete group"

### 3. `src/components/shared/CreateFolderPopover.tsx`

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

### 4. `src/components/shared/DeleteFolderDialog.tsx`

**Update dialog text:**
```tsx
// Title:
<DialogHeader>Delete Group</DialogHeader>

// Body text:
<DialogBody>
  <Text>
    Are you sure you want to delete the group "{folder?.name}"?
    This will permanently delete the group and all its contents.
  </Text>
</DialogBody>

// Buttons:
<Button variant="outline" onClick={onClose}>
  Cancel
</Button>
<Button colorPalette="red" onClick={handleConfirm}>
  Delete Group
</Button>
```

### 5. `src/components/shared/SimpleFolderCard.tsx`

**Rename action tooltip/label:**
```tsx
// In popover menu:
<MenuItem onClick={() => setIsRenameOpen(true)}>
  Rename Group
</MenuItem>

<MenuItem onClick={onDeleteFolder}>
  Delete Group
</MenuItem>
```

**Component display name (optional):**
```tsx
SimpleFolderCard.displayName = 'SimpleFolderCard';
// Keep as-is (internal name) or change to SimpleGroupCard
```

### 6. `src/components/shared/ResourceSelectionBar.tsx`

**If it has folder-related actions:**
```tsx
// Move to Folder → Move to Group
<Button onClick={() => setIsMoveModalOpen(true)}>
  Move to Group
</Button>

// Modal title:
<DialogHeader>Move to Group</DialogHeader>
```

### 7. `src/components/diagrams/DiagramsTabContent.tsx`

**Apply same pattern if it uses folders:**
- "Folders" → "Groups"
- "New Folder" → "New Group"
- Toast messages updated

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
- [ ] "All kits are organized in groups" message
- [ ] "All walkthroughs are organized in groups" message

### Consistency Check
- [ ] No remaining "folder" text in UI
- [ ] Backend code still uses "folder" (IPC unchanged)
- [ ] File paths still use folder terminology

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
