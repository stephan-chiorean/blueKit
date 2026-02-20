---
id: markdown-editor-architecture
alias: Markdown Editor Architecture
type: walkthrough
is_base: false
version: 1
tags:
  - codemirror
  - markdown
  - editing
description: How the CodeMirror-based markdown editor integrates with NoteViewPage and ResourceMarkdownViewer to provide live editing capabilities.
complexity: comprehensive
format: architecture
---

# Markdown Editor Architecture

This walkthrough explains how the markdown editing system works in BlueKit, covering the component hierarchy, data flow, and key implementation details.

## Component Hierarchy

```
ProjectDetailPage
└── NoteViewPage
    └── EditableMarkdownViewer
        ├── LiquidViewModeSwitcher (preview | source | edit)
        ├── Preview Mode: ReactMarkdown + Chakra UI
        ├── Source Mode: ShikiCodeBlock
        └── Edit Mode: MarkdownEditor (CodeMirror 6)
```

## File Overview

| File | Purpose |
|------|---------|
| `src/pages/NoteViewPage.tsx` | Page wrapper with glassmorphism styling |
| `src/components/workstation/EditableMarkdownViewer.tsx` | Main component with 3-mode support |
| `src/components/workstation/ResourceMarkdownViewer.tsx` | Legacy read-only viewer (still used elsewhere) |
| `src/components/editor/MarkdownEditor.tsx` | CodeMirror 6 editor component |
| `src/components/editor/codemirrorTheme.ts` | Glassmorphism theme for CodeMirror |
| `src/hooks/useAutoSave.ts` | Debounced auto-save hook |

---

## Data Flow

### 1. Content Loading

```
ProjectDetailPage
  │
  │ selects file from sidebar
  ▼
setNotebookFile({ resource, content })
  │
  ▼
NoteViewPage receives (resource, content, editable=true)
  │
  ▼
EditableMarkdownViewer receives as initialContent prop
  │
  ▼
Local state: const [content, setContent] = useState(initialContent)
```

### 2. Edit Flow

```
User types in CodeMirror
  │
  ▼
MarkdownEditor.onChange callback fires
  │
  ▼
EditableMarkdownViewer.handleContentChange()
  ├── setContent(newContent)      // Update local state
  ├── onContentChange?.(newContent) // Notify parent
  └── save(newContent)            // Trigger debounced save
```

### 3. Auto-Save Flow

```
useAutoSave hook (1500ms debounce)
  │
  │ after delay
  ▼
performSave()
  ├── invokeWriteFile(filePath, content)  // IPC to Rust backend
  ├── setStatus('saved')
  ├── setIsDirty(false)
  ├── setLastSaveTime(Date.now())         // Save protection window
  └── onSaveSuccess?.()                   // Toast notification
```

### 4. File Watcher Protection

The file watcher detects changes and tries to reload content. A 2-second protection window prevents reverting after saves:

```typescript
// EditableMarkdownViewer.tsx
useEffect(() => {
  const timeSinceLastSave = Date.now() - lastSaveTime;
  const inSaveProtectionWindow = lastSaveTime > 0 && timeSinceLastSave < 2000;

  if (initialContent !== content && !isDirty && !inSaveProtectionWindow) {
    setContent(initialContent);
  }
}, [initialContent, isDirty, lastSaveTime, content]);
```

---

## Component Details

### NoteViewPage (`src/pages/NoteViewPage.tsx`)

Simple wrapper that provides glassmorphism styling and passes props to EditableMarkdownViewer.

```typescript
interface NoteViewPageProps {
  resource: ResourceFile;    // File metadata + front matter
  content: string;           // Raw markdown content
  editable?: boolean;        // Enable editing (default: true)
  onContentChange?: (newContent: string) => void;
}
```

**Key responsibilities:**
- Apply glassmorphism background based on color mode
- Pass through all props to EditableMarkdownViewer

### EditableMarkdownViewer (`src/components/workstation/EditableMarkdownViewer.tsx`)

The main component that supports three view modes.

```typescript
type ViewMode = 'preview' | 'source' | 'edit';

interface EditableMarkdownViewerProps {
  resource: ResourceFile;
  content: string;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
  initialMode?: ViewMode;
}
```

**State management:**
```typescript
const [content, setContent] = useState(initialContent);
const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
const [scrollPositions, setScrollPositions] = useState({
  preview: 0, source: 0, edit: 0
});
```

**Features preserved from ResourceMarkdownViewer:**
- Mermaid diagram rendering
- Internal link navigation
- Backlinks/outbound links display
- Search (Cmd+F)
- YAML front matter stripping

### MarkdownEditor (`src/components/editor/MarkdownEditor.tsx`)

CodeMirror 6-based editor with ref API for external control.

```typescript
interface MarkdownEditorRef {
  focus: () => void;
  getContent: () => string;
  setContent: (content: string) => void;
  getScrollPosition: () => { top: number; left: number };
  setScrollPosition: (position: { top: number; left: number }) => void;
  getView: () => EditorView | null;
}
```

**Key features:**
- Dynamic theme switching via Compartments
- Cmd/Ctrl+S triggers onSave callback
- History (undo/redo) support
- Markdown syntax highlighting
- Code block language detection

**Compartments for dynamic reconfiguration:**
```typescript
const themeCompartment = new Compartment();      // Light/dark theme
const readOnlyCompartment = new Compartment();   // Read-only toggle
const lineNumbersCompartment = new Compartment(); // Line numbers toggle
```

### useAutoSave Hook (`src/hooks/useAutoSave.ts`)

Manages debounced saving with status tracking.

```typescript
interface UseAutoSaveResult {
  save: (content: string) => void;      // Debounced save
  saveNow: (content: string) => Promise<void>;  // Immediate save
  status: SaveStatus;                   // 'saved' | 'saving' | 'unsaved' | 'error'
  isDirty: boolean;                     // Has unsaved changes
  lastSaveTime: number;                 // For save protection window
  cancel: () => void;                   // Cancel pending save
}
```

---

## Scroll Position Synchronization

When switching between modes, scroll positions are preserved:

```typescript
// Save position before switching
const handleViewModeChange = (newMode: ViewMode) => {
  const currentScroll = getCurrentScrollPosition(viewMode);
  setScrollPositions(prev => ({ ...prev, [viewMode]: currentScroll }));
  setViewMode(newMode);
};

// Restore position after switching
useEffect(() => {
  const frame = requestAnimationFrame(() => {
    const targetScroll = scrollPositions[viewMode];
    if (viewMode === 'edit' && editorRef.current) {
      editorRef.current.setScrollPosition({ top: targetScroll, left: 0 });
    } else {
      const container = document.getElementById(containerId);
      if (container) container.scrollTop = targetScroll;
    }
  });
  return () => cancelAnimationFrame(frame);
}, [viewMode]);
```

---

## Relationship to ResourceMarkdownViewer

`ResourceMarkdownViewer` is the original **read-only** markdown viewer. `EditableMarkdownViewer` was created by:

1. Copying the full implementation of ResourceMarkdownViewer
2. Adding a third "edit" mode with CodeMirror
3. Integrating useAutoSave for persistence
4. Adding scroll position synchronization
5. Adding save status indicator

**Why two components?**
- `ResourceMarkdownViewer` is still used in places where editing isn't needed
- `EditableMarkdownViewer` adds ~200 lines for editing support
- Both share the same preview/source rendering logic

---

## Theme Integration

The CodeMirror theme (`src/components/editor/codemirrorTheme.ts`) matches the app's glassmorphism design:

```typescript
export function createGlassmorphismTheme(colorMode: 'light' | 'dark'): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: 'transparent',  // Allows glass effect to show through
      color: isLight ? '#1a1a2e' : '#e4e4e7',
    },
    '.cm-cursor': {
      borderLeftColor: isLight ? '#4287f5' : '#60a5fa',  // Primary blue
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(66, 135, 245, 0.2)',  // Semi-transparent selection
    },
    // ... heading styles, link styles, etc.
  });
}
```

---

## Key Code Paths

### Opening a file for editing
1. `ProjectDetailPage` → sidebar click → `setNotebookFile()`
2. `NoteViewPage` renders with `editable={true}`
3. `EditableMarkdownViewer` shows view mode switcher with Edit option
4. User clicks Edit → `handleViewModeChange('edit')`
5. `MarkdownEditor` mounts with content

### Saving changes
1. User types → `MarkdownEditor.onChange`
2. `handleContentChange()` → `save(content)`
3. 1500ms debounce → `useAutoSave.performSave()`
4. `invokeWriteFile()` → Rust writes to disk
5. `lastSaveTime` updated → protection window active

### Switching modes
1. User clicks Preview/Source/Edit
2. `handleViewModeChange()` saves current scroll
3. `setViewMode()` triggers re-render
4. `useEffect` restores scroll position for new mode
