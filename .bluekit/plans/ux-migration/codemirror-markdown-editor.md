# CodeMirror Markdown Editor Implementation Plan

## Goal

Implement Obsidian-style live preview markdown editing for `NoteViewPage.tsx` using CodeMirror 6. Users should be able to edit markdown directly in the preview while maintaining WYSIWYG-like formatting, with seamless switching between editing and pure preview modes.

---

## Current State Analysis

### Existing Components

- **`NoteViewPage.tsx`**: Wrapper with glassmorphism styling, renders `ResourceMarkdownViewer`
- **`ResourceMarkdownViewer.tsx`**: Read-only markdown viewer using `react-markdown` with:
  - View mode switcher (preview/source)
  - YAML front matter stripping
  - Mermaid diagram support
  - Syntax highlighting via Shiki
  - Link navigation (internal + external)
  - Backlinks/outbound links display
  - Search functionality (Cmd+F)

### Backend Capabilities

| Command | Purpose | Status |
|---------|---------|--------|
| `read_file` | Read file content | ✅ Exists |
| `write_file` | Write file content | ✅ Exists |
| `parseFrontMatter` | Parse YAML front matter | ✅ Exists (frontend utility) |
| `updateFrontMatter` | Update front matter | ❌ Does not exist |
| `serializeMarkdown` | Combine front matter + body | ❌ Does not exist |

### Styling System

- Glassmorphism backgrounds with `backdrop-filter: blur()`
- Light mode: `rgba(255, 255, 255, 0.45)`
- Dark mode: `rgba(20, 20, 25, 0.5)`
- Theme tokens defined in `src/theme.ts`
- Color mode via `ColorModeContext`

---

## Required Dependencies

```bash
npm install @codemirror/state @codemirror/view @codemirror/commands
npm install @codemirror/lang-markdown @codemirror/language-data
npm install @codemirror/theme-one-dark  # For dark mode
npm install @lezer/highlight
```

Optional for enhanced experience:
```bash
npm install @codemirror/autocomplete  # For wiki-link autocomplete
npm install @codemirror/search        # For search/replace
```

---

## Implementation Phases

### Phase 1: Core Infrastructure

#### 1.1 Create Markdown Serialization Utilities

**File:** `src/utils/markdownSerializer.ts`

```typescript
import yaml from 'js-yaml';
import { KitFrontMatter, parseFrontMatter } from './parseFrontMatter';

export function stripFrontMatter(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

export function extractFrontMatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  return match ? match[1] : null;
}

export function serializeMarkdown(
  frontMatter: KitFrontMatter | null,
  body: string
): string {
  if (!frontMatter || Object.keys(frontMatter).length === 0) {
    return body;
  }
  const yamlStr = yaml.dump(frontMatter, {
    indent: 2,
    lineWidth: -1,
    quotingType: '"'
  });
  return `---\n${yamlStr}---\n\n${body}`;
}

export function updateFrontMatterField<K extends keyof KitFrontMatter>(
  content: string,
  field: K,
  value: KitFrontMatter[K]
): string {
  const frontMatter = parseFrontMatter(content) || {};
  const body = stripFrontMatter(content);
  frontMatter[field] = value;
  return serializeMarkdown(frontMatter, body);
}
```

#### 1.2 Create CodeMirror Theme for Glassmorphism

**File:** `src/components/editor/codemirrorTheme.ts`

```typescript
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export function createGlassmorphismTheme(colorMode: 'light' | 'dark'): Extension {
  const isLight = colorMode === 'light';

  const theme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: isLight ? '#1a1a2e' : '#e4e4e7',
      fontFamily: 'inherit',
    },
    '.cm-content': {
      caretColor: isLight ? '#4287f5' : '#60a5fa',
      padding: '16px 24px',
    },
    '.cm-cursor': {
      borderLeftColor: isLight ? '#4287f5' : '#60a5fa',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: isLight
        ? 'rgba(66, 135, 245, 0.2)'
        : 'rgba(96, 165, 250, 0.3)',
    },
    '.cm-activeLine': {
      backgroundColor: isLight
        ? 'rgba(0, 0, 0, 0.03)'
        : 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      borderRight: 'none',
      color: isLight ? '#9ca3af' : '#6b7280',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 8px',
    },
    // Markdown-specific styling
    '.cm-header-1': {
      fontSize: '1.875rem',
      fontWeight: '700',
      color: isLight ? '#4287f5' : '#60a5fa',
    },
    '.cm-header-2': {
      fontSize: '1.5rem',
      fontWeight: '600',
      color: isLight ? '#4287f5' : '#60a5fa',
    },
    '.cm-header-3': {
      fontSize: '1.25rem',
      fontWeight: '600',
      color: isLight ? '#5b9cf5' : '#93c5fd',
    },
    '.cm-link': {
      color: isLight ? '#4287f5' : '#60a5fa',
      textDecoration: 'underline',
    },
    '.cm-url': {
      color: isLight ? '#6b7280' : '#9ca3af',
    },
    '.cm-emphasis': {
      fontStyle: 'italic',
    },
    '.cm-strong': {
      fontWeight: '700',
    },
    '.cm-strikethrough': {
      textDecoration: 'line-through',
    },
    '.cm-code': {
      backgroundColor: isLight
        ? 'rgba(0, 0, 0, 0.05)'
        : 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      padding: '2px 6px',
      fontFamily: 'monospace',
    },
  }, { dark: !isLight });

  return theme;
}
```

### Phase 2: CodeMirror Editor Component

#### 2.1 Create Base Editor Component

**File:** `src/components/editor/MarkdownEditor.tsx`

Key responsibilities:
- Initialize CodeMirror with markdown language support
- Apply glassmorphism theme based on color mode
- Handle document changes with debounced save
- Support read-only mode toggle
- Expose ref for external control (scroll position, focus)

```typescript
interface MarkdownEditorProps {
  content: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  colorMode: 'light' | 'dark';
  placeholder?: string;
}
```

#### 2.2 Implement Live Preview Extensions

For Obsidian-style editing, use CodeMirror decorations to render formatted output:

- **Heading Decorations**: Render `# ` syntax but show formatted heading
- **Link Decorations**: Show clickable links while editing
- **Bold/Italic**: Apply styling inline while preserving markdown syntax
- **Code Blocks**: Syntax highlight within editor
- **Images**: Show inline image previews

Consider using `@codemirror/view` decoration system:
```typescript
import { Decoration, DecorationSet, ViewPlugin, WidgetType } from '@codemirror/view';
```

### Phase 3: Integration with NoteViewPage

#### 3.1 Create EditableMarkdownViewer Component

**File:** `src/components/workstation/EditableMarkdownViewer.tsx`

This component should:
1. Accept same props as `ResourceMarkdownViewer`
2. Add `onContentChange` callback prop
3. Support three modes:
   - **Preview**: Pure read-only (current behavior)
   - **Edit**: Full CodeMirror editing
   - **Live Preview**: Obsidian-style WYSIWYG editing
4. Preserve all existing features (links, mermaid, search, backlinks)

#### 3.2 Update NoteViewPage

```typescript
interface NoteViewPageProps {
  resource: ResourceFile;
  content: string;
  onContentChange?: (newContent: string) => void; // NEW
  editable?: boolean; // NEW
}
```

### Phase 4: Save & Sync Logic

#### 4.1 Debounced Auto-Save

```typescript
// src/hooks/useAutoSave.ts
import { useCallback, useRef } from 'react';
import { invokeWriteFile } from '../ipc/files';

export function useAutoSave(filePath: string, delay = 1000) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>('');

  const save = useCallback(async (content: string) => {
    if (content === lastSavedRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await invokeWriteFile(filePath, content);
        lastSavedRef.current = content;
      } catch (error) {
        console.error('Auto-save failed:', error);
        // Emit error event or show toast
      }
    }, delay);
  }, [filePath, delay]);

  return { save };
}
```

#### 4.2 Handle File Watcher Conflicts

When external changes detected:
1. Compare local changes vs incoming changes
2. If local has unsaved changes, prompt user
3. Options: Overwrite, Keep Local, Merge (manual)

### Phase 5: Front Matter Editor (Optional Enhancement)

#### 5.1 Structured Front Matter Panel

Instead of editing YAML directly, provide a form UI:

```typescript
interface FrontMatterEditorProps {
  frontMatter: KitFrontMatter;
  onChange: (fm: KitFrontMatter) => void;
  resourceType: 'kit' | 'walkthrough' | 'agent';
}
```

Fields:
- Tags (multi-select/creatable)
- Description (text input)
- Type-specific fields (capabilities for agents, etc.)

---

## Component Architecture

```
NoteViewPage
└── EditableMarkdownViewer
    ├── ViewModeSwitcher (preview | edit | live)
    ├── FrontMatterPanel (collapsible)
    │   └── FrontMatterEditor (form UI)
    ├── MarkdownEditor (CodeMirror)
    │   ├── GlassmorphismTheme
    │   ├── MarkdownLanguage
    │   └── LivePreviewDecorations
    ├── LinksPanel
    │   ├── OutboundLinks
    │   └── Backlinks
    └── SearchOverlay
```

---

## Styling Preservation Checklist

- [ ] Transparent editor background for glassmorphism
- [ ] Match heading colors to `primary.500` (#4287f5)
- [ ] Consistent font sizes with existing markdown styles
- [ ] Selection highlight using theme blue with transparency
- [ ] Cursor color matching primary blue
- [ ] Code block styling with subtle background
- [ ] Dark mode support via `_dark` overrides
- [ ] Blur effect maintained on parent container
- [ ] Scrollbar styling consistent with app

---

## File Watcher Considerations

The existing file watcher in `src-tauri/src/watcher.rs` will detect changes. Need to:

1. **Distinguish local vs external changes**: Track "dirty" state
2. **Suppress watcher during save**: Brief ignore period after `write_file`
3. **Conflict resolution UI**: Modal for external change detection

---

## Testing Plan

### Unit Tests
- [ ] Markdown serialization (front matter + body)
- [ ] Front matter field updates
- [ ] Theme generation for both color modes

### Integration Tests
- [ ] Edit → Save → File written correctly
- [ ] External change → Reload prompt
- [ ] Mode switching preserves content
- [ ] Undo/redo works correctly

### Manual Testing
- [ ] Long documents performance
- [ ] Large code blocks
- [ ] Complex mermaid diagrams
- [ ] Multiple concurrent edits
- [ ] Network/file system errors

---

## Open Questions

1. **Live preview fidelity**: How close to Obsidian's rendering do we need? Full WYSIWYG with hidden syntax, or visible syntax with formatting applied?

2. **Mermaid in editor**: Render diagrams inline during editing, or only in preview mode?

3. **Table editing**: Use a table plugin or keep as raw markdown?

4. **Image handling**: Support drag-drop image upload to `.bluekit/assets/`?

5. **Vim keybindings**: Add optional vim mode via `@codemirror/vim`?

---

## Estimated Scope

| Phase | Components |
|-------|------------|
| Phase 1 | Serialization utils, theme configuration |
| Phase 2 | MarkdownEditor component, basic editing |
| Phase 3 | Integration, mode switching, UI updates |
| Phase 4 | Auto-save, conflict resolution |
| Phase 5 | Front matter panel (optional) |

---

## References

- [CodeMirror 6 Documentation](https://codemirror.net/docs/)
- [Obsidian Live Preview Approach](https://forum.obsidian.md/t/live-preview-technical-details/)
- [CodeMirror Markdown Example](https://codemirror.net/examples/lang-markdown/)
- [Lezer Markdown Parser](https://github.com/lezer-parser/markdown)
