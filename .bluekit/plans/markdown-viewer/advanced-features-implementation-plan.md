# Advanced Markdown Viewer Features - Implementation Plan

## Overview

Transform `ResourceMarkdownViewer` from a read-only viewer into a full-featured WYSIWYG editor with seamless markdown editing, preview toggling, and file persistence.

---

## Features Sorted by Complexity

| Feature | Complexity | Dependencies | Estimated LOC |
|---------|------------|--------------|---------------|
| 1. Copy to Clipboard | Low | None | ~30 |
| 2. View as Markdown Toggle | Low-Medium | None | ~80 |
| 3. Save to File | Medium | New IPC command | ~120 |
| 4. Edit in Preview (WYSIWYG) | High | Rich text editor lib | ~500+ |

---

## Phase 1: Copy to Clipboard (Low Complexity)

### Implementation

Add a toolbar with a copy button that copies the raw markdown content.

### Tasks

1. **Create Toolbar Component**
   - Add `ViewerToolbar.tsx` with action buttons
   - Position fixed at top-right of viewer
   - Glassmorphism styling to match existing UI

2. **Implement Copy Logic**
   - Use `navigator.clipboard.writeText()` for web
   - Use Tauri's clipboard API for native: `import { writeText } from '@tauri-apps/api/clipboard'`
   - Show toast notification on success

### Code Location
- `src/components/workstation/ViewerToolbar.tsx` (new)
- Modify `ResourceMarkdownViewer.tsx` to include toolbar

### API Required
```typescript
// Already available via Tauri
import { writeText } from '@tauri-apps/api/clipboard';
```

---

## Phase 2: View as Markdown Toggle (Low-Medium Complexity)

### Implementation

Toggle between rendered preview and raw markdown source view.

### Tasks

1. **Add View Mode State**
   ```typescript
   type ViewMode = 'preview' | 'source';
   const [viewMode, setViewMode] = useState<ViewMode>('preview');
   ```

2. **Create Source View Component**
   - Display raw markdown with syntax highlighting via ShikiCodeBlock
   - Preserve scroll position when toggling
   - Show line numbers for reference

3. **Update Toolbar**
   - Add toggle button with icons (Eye/Code icons)
   - Visual indicator for current mode

4. **Keyboard Shortcut**
   - `Cmd/Ctrl + Shift + M` to toggle view mode

### Code Changes
- Add state management in `ResourceMarkdownViewer.tsx`
- Conditional rendering based on `viewMode`
- Update `ViewerToolbar.tsx` with toggle button

---

## Phase 3: Save to File (Medium Complexity)

### Implementation

Write modified content back to the source file via Tauri IPC.

### Tasks

1. **Create Rust IPC Command**
   ```rust
   // src-tauri/src/commands.rs
   #[tauri::command]
   pub async fn write_resource_file(
       path: String,
       content: String,
   ) -> Result<(), String> {
       std::fs::write(&path, content)
           .map_err(|e| format!("Failed to write file: {}", e))
   }
   ```

2. **Register Command in main.rs**
   - Add `write_resource_file` to `invoke_handler![]`

3. **Create TypeScript IPC Wrapper**
   ```typescript
   // src/ipc.ts
   export async function writeResourceFile(
       path: string,
       content: string
   ): Promise<void> {
       return invokeWithTimeout('write_resource_file', { path, content }, 5000);
   }
   ```

4. **Track Dirty State**
   - Compare current content with original
   - Show unsaved indicator in toolbar
   - Warn on navigation if unsaved changes

5. **Save Button & Keyboard Shortcut**
   - `Cmd/Ctrl + S` to save
   - Disable when no changes
   - Show loading state during save

6. **Preserve Front Matter**
   - When saving, reconstruct full content with front matter
   - Validate front matter integrity before save

### File Changes
- `src-tauri/src/commands.rs` - Add `write_resource_file`
- `src-tauri/src/main.rs` - Register command
- `src/ipc.ts` - Add TypeScript wrapper
- `ResourceMarkdownViewer.tsx` - Add save logic

---

## Phase 4: Edit in Preview / WYSIWYG (High Complexity)

### Approach Options

#### Option A: TipTap (Recommended)
- **Pros**: Headless, highly customizable, great React support, markdown extensions
- **Cons**: Learning curve for extensions
- **Package**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-markdown`

#### Option B: Milkdown
- **Pros**: Purpose-built for markdown, plugin system
- **Cons**: Less mature ecosystem
- **Package**: `@milkdown/react`, `@milkdown/preset-commonmark`

#### Option C: MDXEditor
- **Pros**: Drop-in markdown editor, MDX support
- **Cons**: Heavier bundle, less customizable
- **Package**: `@mdxeditor/editor`

### Recommended: TipTap Implementation

### Tasks

1. **Install Dependencies**
   ```bash
   npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
   npm install @tiptap/extension-code-block-lowlight @tiptap/extension-link
   npm install @tiptap/extension-table @tiptap/extension-task-list
   npm install lowlight turndown @types/turndown
   ```

2. **Create WYSIWYG Editor Component**
   - `src/components/workstation/WysiwygEditor.tsx`
   - Configure TipTap with markdown-relevant extensions
   - Style to match existing Chakra UI theme

3. **Markdown ↔ HTML Conversion**
   - **HTML → Markdown**: Use `turndown` library
   - **Markdown → HTML**: Use existing `react-markdown` parsing or TipTap's built-in
   - Preserve code block languages
   - Handle mermaid blocks specially (keep as code)

4. **Implement Editor Toolbar**
   - Bold, Italic, Strikethrough
   - Headings (H1-H6)
   - Lists (bullet, numbered, task)
   - Code (inline, block)
   - Links
   - Tables
   - Blockquotes

5. **Handle Special Content**
   - **Mermaid Diagrams**: Render preview, edit as code
   - **Code Blocks**: Syntax highlighting, language selector
   - **Front Matter**: Separate editable section or locked

6. **State Management**
   ```typescript
   type EditorMode = 'view' | 'edit' | 'source';
   const [mode, setMode] = useState<EditorMode>('view');
   const [content, setContent] = useState(originalContent);
   const [isDirty, setIsDirty] = useState(false);
   ```

7. **Integration with Existing Components**
   - Replace/augment ReactMarkdown rendering
   - Keep InlineMermaidDiagram for diagram preview
   - Maintain ShikiCodeBlock for code highlighting in view mode

### Component Architecture

```
ResourceMarkdownViewer.tsx (container)
├── ViewerToolbar.tsx
│   ├── Copy button
│   ├── View mode toggle (Preview/Source/Edit)
│   ├── Save button (when dirty)
│   └── Edit button
├── MarkdownPreview.tsx (current ReactMarkdown logic, extracted)
├── MarkdownSource.tsx (raw markdown with syntax highlighting)
└── WysiwygEditor.tsx (TipTap-based WYSIWYG)
    ├── EditorToolbar.tsx (formatting buttons)
    └── EditorContent.tsx (TipTap editor instance)
```

### Key Challenges

1. **Markdown Fidelity**
   - Ensure round-trip conversion preserves original formatting
   - Handle edge cases: nested lists, complex tables, HTML in markdown

2. **Mermaid Integration**
   - In edit mode: show code editor for mermaid blocks
   - In preview: render diagram
   - Consider split-pane for mermaid editing

3. **Performance**
   - Large documents may be slow to convert
   - Consider debounced conversion for live preview

4. **Undo/Redo**
   - TipTap has built-in history
   - Track "original" state for revert functionality

---

## Implementation Order

```
Week 1: Phase 1 + Phase 2
├── Day 1-2: Create ViewerToolbar with copy functionality
├── Day 3-4: Implement source view toggle
└── Day 5: Polish, keyboard shortcuts, testing

Week 2: Phase 3
├── Day 1-2: Create Rust IPC command and TypeScript wrapper
├── Day 3: Implement dirty state tracking
├── Day 4: Save button with loading states
└── Day 5: Front matter preservation, testing

Week 3-4: Phase 4
├── Day 1-3: TipTap setup and basic editor
├── Day 4-6: Markdown conversion utilities
├── Day 7-8: Editor toolbar and formatting
├── Day 9-10: Special content handling (mermaid, code)
└── Day 11-14: Integration, polish, edge cases
```

---

## File Structure (Final)

```
src/components/workstation/
├── ResourceMarkdownViewer.tsx      # Container, orchestrates modes
├── ViewerToolbar.tsx               # NEW: Action buttons
├── MarkdownPreview.tsx             # NEW: Extracted preview logic
├── MarkdownSource.tsx              # NEW: Raw markdown view
├── WysiwygEditor/
│   ├── index.tsx                   # NEW: TipTap editor wrapper
│   ├── EditorToolbar.tsx           # NEW: Formatting toolbar
│   ├── extensions/                 # NEW: Custom TipTap extensions
│   │   ├── MermaidBlock.tsx
│   │   └── CodeBlockWithLanguage.tsx
│   └── utils/
│       ├── markdownToHtml.ts       # NEW: Conversion utility
│       └── htmlToMarkdown.ts       # NEW: Conversion utility
├── ShikiCodeBlock.tsx              # Existing
└── InlineMermaidDiagram.tsx        # Will extract from current file
```

---

## Success Criteria

- [ ] Copy button works and shows confirmation
- [ ] Can toggle between Preview and Source views
- [ ] Can toggle into Edit mode with WYSIWYG editor
- [ ] Formatting toolbar works (bold, italic, headings, lists, etc.)
- [ ] Save button writes content back to file
- [ ] Dirty indicator shows when unsaved changes exist
- [ ] Mermaid diagrams render correctly in all modes
- [ ] Code blocks preserve language and highlighting
- [ ] Front matter is preserved on save
- [ ] Keyboard shortcuts work (Cmd+S, Cmd+Shift+M)
- [ ] No data loss on round-trip markdown conversion

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Markdown conversion loses formatting | Extensive test suite, manual review before save |
| Large file performance | Virtualized rendering, lazy conversion |
| TipTap bundle size | Dynamic import, code splitting |
| Mermaid edit UX | Split-pane with live preview |
| Concurrent edits (file changed externally) | File watcher notification, merge dialog |

---

## Dependencies to Add

```json
{
  "@tiptap/react": "^2.1.0",
  "@tiptap/starter-kit": "^2.1.0",
  "@tiptap/extension-placeholder": "^2.1.0",
  "@tiptap/extension-code-block-lowlight": "^2.1.0",
  "@tiptap/extension-link": "^2.1.0",
  "@tiptap/extension-table": "^2.1.0",
  "@tiptap/extension-task-list": "^2.1.0",
  "@tiptap/extension-task-item": "^2.1.0",
  "lowlight": "^3.1.0",
  "turndown": "^7.1.2",
  "@types/turndown": "^5.0.4"
}
```
