# Phase 7: Instant Title Editing for New Notes

## Problem Statement

When creating a new note through either the Empty Tab State or the NotebookTree sidebar, the system creates an `Untitled.md` file but provides no immediate way to edit the title. Users must manually navigate to rename the file through context menus or separate rename operations, which breaks the creative flow.

**Current Behavior:**
1. User clicks "Create new note" (⌘N) or uses tree context menu
2. System creates `Untitled.md` with content `# Untitled\n\n`
3. File opens in edit mode BUT the H1 title is not pre-selected
4. User must manually select the text to rename it
5. Title doesn't update in sidebar/breadcrumb until manual file rename

## Desired Behavior (Obsidian-Style)

1. User creates new note → system creates `Untitled.md`
2. File appears in tree **immediately** showing "Untitled"
3. File opens in **edit mode** with the H1 heading **pre-selected**
4. User can **immediately type** to replace "Untitled" with their desired title
5. While typing, tree/breadcrumb/tab **continue showing "Untitled"** (no real-time sync)
6. On **Enter** or **blur** from H1 line:
   - File is renamed from `Untitled.md` to `<new-title>.md`
   - Content H1 is updated to match
   - Tree, breadcrumb, and tab all update to show new title
   - Editor stays in edit mode (user continues writing)

## Technical Implementation Plan

### 1. Create New Note Flow Enhancement

**File:** `src/views/project/components/NotebookTree.tsx` (handleNewFile, ~line 567)

**Current code:**
```typescript
const filePath = `${folderPath}${separator}${tempName}`;
await invokeWriteFile(filePath, '# Untitled\n\n');
// ...
if (onNewFileCreated) {
    onNewFileCreated(newNode); // Parent opens in edit mode
}
```

**Changes:**
- Keep existing logic (file creation works correctly)
- Ensure `onNewFileCreated` callback is always called with the new node
- Parent component (ProjectView) should open the file in **edit mode** (already does this via `initialViewMode='edit'`)

### 2. Pre-Select H1 Heading on Mount

**File:** `src/pages/NoteViewPage.tsx`

**Current behavior:**
- `initialViewMode='edit'` prop already exists
- `selectH1OnMount={initialViewMode === 'edit'}` (line 229) is passed to MarkdownEditor
- This should already select the H1, but may need verification

**Investigation needed:**
- Check if `MarkdownEditor` component properly implements `selectH1OnMount` behavior
- Ensure it selects the **entire H1 text** (excluding the `# ` prefix)
- Example: `# Untitled` → select only "Untitled" portion

**File:** `src/shared/components/editor/MarkdownEditor.tsx`

**Expected implementation:**
```typescript
useEffect(() => {
    if (selectH1OnMount && editorView) {
        const firstLine = editorView.state.doc.line(1);
        const h1Match = firstLine.text.match(/^#\s+(.+)$/);

        if (h1Match) {
            const titleStart = firstLine.from + 2; // Skip "# "
            const titleEnd = firstLine.to;

            editorView.dispatch({
                selection: { anchor: titleStart, head: titleEnd },
            });
            editorView.focus();
        }
    }
}, [selectH1OnMount, editorView]);
```

### 3. File Rename on Title Finalization

**No real-time sync needed!** Tree, breadcrumb, and tab continue showing "Untitled" until rename is finalized.

**File:** `src/views/project/ProjectView.tsx` (parent component)

**Required changes:**
1. When new file is created, open it in edit mode (already implemented via `initialViewMode='edit'`)
2. No need to track live editing state - just refresh tree after rename
3. Parent component handles the `onFileRenamed` callback to refresh tree

**Note:** The existing `titleEditPath` and `editingTitle` props in NotebookTree (lines 38-40) can be **removed** or **ignored** for files. They are only needed for inline editing of folders.

### 4. Finalize Title on Enter/Blur

**File:** `src/pages/NoteViewPage.tsx` or `MarkdownEditor.tsx`

**Trigger conditions:**
- User presses **Enter** on H1 line
- User clicks/focuses **outside** the H1 line (blur)

**Action on trigger:**
1. Extract current H1 text from editor content
2. Sanitize filename (remove invalid characters)
3. If H1 text changed from "Untitled":
   - Read current file content
   - Update H1 in content to match new title
   - Write to new file path (`<new-title>.md`)
   - Delete old file (`Untitled.md`)
   - Notify parent to refresh tree (via callback or file watcher)
4. **Keep editor in edit mode** (don't switch to preview)

**Implementation:**
```typescript
const handleH1LineExit = async () => {
    // Extract H1 from current editor state
    const currentContent = editorView.state.doc.toString();
    const h1Match = currentContent.match(/^#\s+(.+)$/m);

    if (!h1Match) return; // No H1 found

    const newTitle = h1Match[1].trim();
    if (newTitle === 'Untitled') return; // No change needed

    const sanitizedName = sanitizeFileName(newTitle) || 'Untitled';
    const newFileName = `${sanitizedName}.md`;

    const parentDir = path.dirname(currentFilePath);
    const newPath = `${parentDir}/${newFileName}`;

    if (newPath !== currentFilePath) {
        // Update H1 in content to match sanitized filename
        const updatedContent = currentContent.replace(/^#\s+.+$/m, `# ${sanitizedName}`);

        await invokeWriteFile(newPath, updatedContent);
        await deleteResources([currentFilePath]);

        // File watcher will auto-refresh tree, or call explicit refresh
        onFileRenamed?.(currentFilePath, newPath);
    }
};
```

### 5. Editor Integration: Detect H1 Line Exit

**File:** `src/shared/components/editor/MarkdownEditor.tsx`

**Options:**

**Option A: Keymap Extension**
```typescript
import { keymap } from '@codemirror/view';

const h1ExitKeymap = keymap.of([
    {
        key: 'Enter',
        run: (view) => {
            const line = view.state.doc.lineAt(view.state.selection.main.head);
            if (line.number === 1 && line.text.startsWith('# ')) {
                onH1LineExit?.();
                return false; // Allow Enter to proceed normally
            }
            return false;
        }
    }
]);
```

**Option B: Selection Change Listener**
```typescript
EditorView.updateListener.of((update) => {
    if (update.selectionSet) {
        const currentLine = update.state.doc.lineAt(update.state.selection.main.head);
        const wasOnH1 = previousLine === 1;
        const isOnH1 = currentLine.number === 1;

        if (wasOnH1 && !isOnH1) {
            onH1LineExit?.();
        }
    }
});
```

**Recommendation:** Use **Option B** (selection change) for blur detection + **Option A** (keymap) for explicit Enter handling.

## UI/UX Considerations

### Visual Feedback

1. **Tree Display:** Shows filename (e.g., "Untitled") until rename is finalized
   - No special indicator needed during editing
   - File appears in tree immediately after creation

2. **Breadcrumb Display:** Shows filename (e.g., "Untitled") until rename is finalized
   - Updates automatically after file rename

3. **Tab Title:** Shows filename (e.g., "Untitled") until rename is finalized
   - Updates automatically after file rename (if tabs are implemented)

4. **Editor Focus:** H1 is pre-selected and ready for immediate typing
   - Clear visual indication that text is selected

### Edge Cases

1. **Empty H1:** If user deletes all text and exits, revert to "Untitled"
2. **Invalid Characters:** Sanitize `/ \ : * ? " < > |` from filename
3. **Duplicate Names:** If `<title>.md` already exists, append ` 2`, ` 3`, etc.
4. **Multi-line H1:** Only capture first line of H1 (before first `\n`)

### Escape Hatch

- **ESC key:** Cancel rename, revert to "Untitled.md" (delete file if user wants?)
- **⌘W (close tab):** Save current title state before closing

## Testing Checklist

- [ ] Create new note via "Create new note" button → file appears in tree as "Untitled"
- [ ] Create new note via tree context menu → file appears in tree as "Untitled"
- [ ] New file opens in editor with H1 "Untitled" pre-selected
- [ ] Can immediately type to replace "Untitled" text
- [ ] While typing, tree/breadcrumb/tab continue showing "Untitled" (no live sync)
- [ ] Press Enter on H1 line → file renamed, tree/breadcrumb/tab update, cursor moves to line 2
- [ ] Click to line 2 (blur H1) → file renamed, tree/breadcrumb/tab update
- [ ] Edge case: Empty title → defaults to "Untitled.md" (no rename)
- [ ] Edge case: Invalid chars (`test/file`) → sanitized to `test-file.md`
- [ ] Edge case: Duplicate name → appends number (`Title 2.md`)
- [ ] Press ESC during editing → (define behavior: revert to "Untitled" or keep changes?)
- [ ] Close tab with unsaved title changes → (define behavior: save or discard?)
- [ ] Rename works on macOS, Windows, Linux (path separator handling)
- [ ] Folder creation still uses inline edit in tree (not affected by file changes)

## Dependencies

**Files to modify:**
- `src/views/project/ProjectView.tsx` - Handle file rename callback and tree refresh
- `src/pages/NoteViewPage.tsx` - Handle H1 exit events and trigger rename
- `src/shared/components/editor/MarkdownEditor.tsx` - Detect H1 line changes (Enter/blur)
- `src/views/project/components/NotebookTree.tsx` - Already correct (no changes needed)

**IPC commands needed:**
- `invokeReadFile`, `invokeWriteFile`, `deleteResources` - Already exist
- File watcher already handles tree refresh automatically

**No new dependencies required** - uses existing React state and CodeMirror extensions.

## Success Criteria

✅ User creates new note → appears in tree immediately as "Untitled"
✅ Editor opens with H1 pre-selected → user can **immediately type** to set title
✅ Tree/breadcrumb/tab show "Untitled" **until rename is finalized** (no confusing live updates)
✅ File rename happens **seamlessly** on Enter or blur from H1 line
✅ After rename, tree/breadcrumb/tab all update to new title
✅ User **stays in edit mode** after renaming (no mode switching)
✅ Behavior matches **Obsidian's UX** for note creation (simple and predictable)

## Future Enhancements

- **Template Support:** New notes could use a template instead of `# Untitled\n\n`
- **Title Suggestions:** Auto-suggest titles based on folder context
- **Quick Rename:** Double-click title in tree to enter rename mode (already exists?)
