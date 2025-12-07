# Resource Edit & Delete Functionality

## Overview

Add the ability to delete and edit BlueKit resources (kits, walkthroughs, agents, diagrams, etc.) directly from the UI. This includes:
- Deleting resource files from the filesystem
- Editing metadata (title/alias, description, tags) with live updates to YAML front matter
- Supporting all resource types uniformly

## Use Cases

### Delete Resources
1. User selects one or more resources in the UI
2. User clicks delete action (from GlobalActionBar or context menu)
3. System prompts for confirmation
4. On confirm, system deletes the corresponding files
5. File watcher detects changes and updates UI automatically

### Edit Metadata
1. User selects a single resource
2. User opens edit dialog/modal (from GlobalActionBar or context menu)
3. User edits title/alias, description, and/or tags
4. On save, system updates YAML front matter in the file
5. File watcher detects changes and updates UI automatically

## Architecture

### Backend (Rust)

#### Delete Command
```rust
#[tauri::command]
async fn delete_resources(file_paths: Vec<String>) -> Result<(), String>
```

**Implementation:**
- Takes array of absolute file paths
- Uses `std::fs::remove_file()` for each path
- Returns errors if any deletions fail
- File watcher will automatically detect deletions

**Error Handling:**
- Permission denied
- File not found (already deleted)
- File in use

#### Update Metadata Command
```rust
#[tauri::command]
async fn update_resource_metadata(
    file_path: String,
    alias: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>
) -> Result<(), String>
```

**Implementation:**
1. Read existing file content
2. Parse YAML front matter (extract between `---` delimiters)
3. Update specified fields (preserve others)
4. Write back to file with updated front matter + unchanged markdown body
5. File watcher will automatically detect changes

**Special Cases:**
- **Diagrams (.mmd/.mermaid):** YAML front matter at top of file (same format)
- **No existing front matter:** Create new front matter block
- **Preserve order:** Maintain field order when possible

**Error Handling:**
- File read/write errors
- Invalid YAML parsing
- File locked/in use

### Frontend (TypeScript)

#### IPC Wrappers (`src/ipc.ts`)
```typescript
export async function deleteResources(filePaths: string[]): Promise<void> {
  return invokeWithTimeout('delete_resources', { filePaths }, 5000);
}

export async function updateResourceMetadata(
  filePath: string,
  metadata: {
    alias?: string;
    description?: string;
    tags?: string[];
  }
): Promise<void> {
  return invokeWithTimeout('update_resource_metadata', {
    filePath,
    ...metadata
  }, 5000);
}
```

#### UI Components

**Delete Functionality:**
- Add delete button to `GlobalActionBar` (already has selection context)
- Show confirmation dialog before deletion
- Support multi-delete (show count: "Delete 5 items?")
- Disable when no items selected

**Edit Functionality:**
- Add edit button to `GlobalActionBar` (only enabled for single selection)
- Create `EditResourceMetadataModal` component:
  - Text input for alias/title
  - Textarea for description
  - Tag input (chip-based, add/remove)
  - Save/Cancel buttons
- Pre-populate with current values
- Show which fields are being edited (highlight changes)

**Unified Component Structure:**
```
src/components/shared/
├── EditResourceMetadataModal.tsx  # Reusable edit dialog
└── DeleteConfirmationDialog.tsx   # Reusable delete confirmation
```

### Selection System Integration

Leverage existing `SelectionContext` (`src/contexts/SelectionContext.tsx`):
- `selectedItems`: Array of selected resources
- `clearSelection()`: Clear after delete
- Single vs. multi-selection logic already implemented

**Global Action Bar Updates:**
```typescript
// In GlobalActionBar.tsx
const handleDelete = async () => {
  const filePaths = selectedItems.map(item => item.filePath);
  const confirmed = await showDeleteConfirmation(selectedItems.length);
  if (confirmed) {
    await deleteResources(filePaths);
    clearSelection();
  }
};

const handleEdit = async () => {
  if (selectedItems.length !== 1) return; // Only single edit
  const item = selectedItems[0];
  const updated = await showEditModal(item);
  if (updated) {
    await updateResourceMetadata(item.filePath, updated);
  }
};
```

## Implementation Plan

### Phase 1: Delete Functionality
1. **Backend:**
   - Add `delete_resources` command in `src-tauri/src/commands.rs`
   - Register in `main.rs` invoke_handler
   - Add tests for edge cases (missing files, permissions)

2. **Frontend:**
   - Add `deleteResources` wrapper to `src/ipc.ts`
   - Create `DeleteConfirmationDialog` component
   - Add delete button to `GlobalActionBar`
   - Wire up selection → delete flow

3. **Testing:**
   - Test single delete
   - Test multi-delete
   - Test error cases (file locked, not found)
   - Verify file watcher updates UI

### Phase 2: Edit Metadata Functionality
1. **Backend:**
   - Add `update_resource_metadata` command
   - Implement YAML front matter parsing/updating
   - Handle all resource types (kits, walkthroughs, agents, diagrams)
   - Add tests for YAML manipulation

2. **Frontend:**
   - Add `updateResourceMetadata` wrapper to `src/ipc.ts`
   - Create `EditResourceMetadataModal` component with form fields
   - Add edit button to `GlobalActionBar`
   - Wire up selection → edit flow
   - Pre-populate form with current values

3. **Testing:**
   - Test editing each field individually
   - Test editing multiple fields at once
   - Test with/without existing front matter
   - Test all resource types
   - Verify file watcher updates UI

## Technical Considerations

### YAML Front Matter Parsing
- Use `serde_yaml` crate for Rust parsing
- Preserve comments and formatting where possible
- Handle missing front matter gracefully (create new block)
- Validate YAML syntax before writing

### File Watcher Integration
- No changes needed - existing watchers will detect file changes
- Delete: Watcher emits event → UI removes from list
- Edit: Watcher emits event → UI refreshes metadata

### Permissions & Safety
- Confirm destructive actions (delete)
- Show what will be deleted (file names + count)
- Prevent deleting files outside `.bluekit` directories (safety check)
- Handle concurrent edits gracefully (last write wins)

### UI/UX Patterns
- **Delete:**
  - Confirmation dialog with file count
  - Success toast notification
  - Error toast if any deletions fail

- **Edit:**
  - Modal dialog (not inline editing)
  - Show only editable fields (exclude `id`, `type`, `version`)
  - Validate inputs (e.g., tags must be non-empty strings)
  - Dirty state tracking (enable save only if changed)

### Resource Type Differences
- **Kits/Walkthroughs/Agents:** Standard YAML front matter in `.md` files
- **Diagrams:** YAML front matter in `.mmd`/`.mermaid` files (same format)
- **Blueprints:** Edit `blueprint.json` directly (different format, handle separately)
- **Clones:** Edit `clones.json` directly (different format, handle separately)

**Note:** Initial implementation focuses on markdown-based resources (kits, walkthroughs, agents, diagrams). Blueprints and clones may need separate edit flows due to JSON structure.

## Error Handling

### Backend Errors
```rust
// Examples
Err("Failed to delete file: permission denied".to_string())
Err("Failed to parse YAML front matter".to_string())
Err("File not found".to_string())
```

### Frontend Error Display
- Toast notifications for errors
- Specific error messages (not generic "Operation failed")
- Retry option for transient errors
- Prevent UI state corruption (don't remove item from list if delete failed)

## Future Enhancements
- Bulk edit (edit metadata for multiple items at once)
- Undo delete (trash/recycle bin instead of permanent delete)
- Edit history/versioning (git integration)
- Inline editing (edit directly in table/list view)
- Drag-and-drop file organization
- Rename files (separate from alias/title editing)

## Open Questions
1. Should delete be permanent or move to trash?
2. Should we validate tag format (kebab-case, no spaces)?
3. Should we prevent editing system-generated fields (`id`, `created_at`)?
4. Should we support editing blueprint.json and clones.json in this phase?

## Success Criteria
- User can delete single or multiple resources via UI
- User can edit title, description, and tags for any markdown-based resource
- Changes persist to filesystem correctly
- File watcher automatically updates UI
- Error cases handled gracefully with user feedback
- Works consistently across all resource types (kits, walkthroughs, agents, diagrams)
