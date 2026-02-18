---
id: obsidian-hybrid-editor-implementation
alias: Obsidian-Style Hybrid Editor Implementation
type: walkthrough
is_base: false
version: 1
tags:
  - markdown
  - codemirror
  - editor
description: Deep dive into the Obsidian-style Live Preview editor architecture with cursor-aware syntax hiding
complexity: comprehensive
format: architecture
---
# Obsidian-Style Hybrid Editor Implementation

A comprehensive walkthrough of the hybrid markdown editor with three viewing modes: Live Preview (WYSIWYG with syntax reveal), Source (raw markdown), and Reading (clean rendered view).

## Context

After extensive exploration of different approaches (documented in `.bluekit/plans/markdown-editor/`), this implementation represents a fundamental architectural shift from the existing pattern used in `NoteViewPage.tsx`. The key insight: **use CodeMirror 6's decoration system to hide/reveal syntax markers based on cursor position**, rather than switching between entirely separate components.

## Architecture Overview

```
ObsidianEditor (index.tsx)
├── Mode State Management (live-preview | source | reading)
├── LivePreviewEditor (CM6 + decorations)
│   └── livePreviewPlugin (ViewPlugin)
│       └── decorationBuilder (syntax tree → decorations)
├── MarkdownEditor (CM6 source mode - reused)
└── ReadingView (ReactMarkdown)
```

### File Structure

```
src/shared/components/editor/obsidian/
├── index.tsx                    # Main container with mode switching
├── LivePreviewEditor.tsx        # CM6 editor with live preview
├── ReadingView.tsx              # Read-only ReactMarkdown view
├── plugins/
│   └── livePreview/
│       ├── index.ts             # Plugin + theme bundle
│       ├── viewPlugin.ts        # ViewPlugin managing decorations
│       └── decorationBuilder.ts # Builds decorations from AST
└── theme/
    └── livePreviewTheme.ts      # Live Preview CSS classes
```

## Key Architectural Differences

### Existing Approach (NoteViewPage.tsx)

The current implementation in `src/pages/NoteViewPage.tsx` uses **mode-based component switching**:

```tsx
{viewMode === 'edit' ? (
  <MarkdownEditor
    content={content}
    onChange={handleContentChange}
    onSave={handleSave}
    // ... CodeMirror with markdown syntax highlighting
  />
) : (
  <ResourceMarkdownContent
    content={content}
    viewMode={viewMode}
    // ... ReactMarkdown for preview/source
  />
)}
```

**Characteristics:**
- Three distinct modes: `edit`, `preview`, `source`
- **Edit mode** = Raw CodeMirror with syntax highlighting
- **Preview mode** = ReactMarkdown rendered output
- **Source mode** = Plain text or styled markdown view
- Complete component unmount/remount on mode switch
- Auto-save integration for edit mode
- File rename on H1 title change

### New Approach (ObsidianEditor)

The hybrid editor introduces a **fourth paradigm** with Live Preview:

```tsx
{mode === 'live-preview' && (
  <LivePreviewEditor
    // CodeMirror with DECORATIONS that hide/reveal syntax
    // Based on cursor position
  />
)}
{mode === 'source' && (
  <MarkdownEditor
    // Standard CM6 markdown mode (reused from existing)
  />
)}
{mode === 'reading' && (
  <ReadingView
    // ReactMarkdown (similar to preview mode)
  />
)}
```

**Characteristics:**
- Three modes: `live-preview`, `source`, `reading`
- **Live Preview mode** = WYSIWYG editor where syntax appears/disappears
- **Source mode** = Reuses existing `MarkdownEditor` component
- **Reading mode** = Clean ReactMarkdown view with GlassCodeBlock integration
- No auto-save (intentionally simplified for demo)
- No file operations (focused on editing experience)

## The Live Preview Innovation

### Core Concept

Obsidian's Live Preview doesn't switch between components—it uses **CodeMirror 6 decorations** to:
1. Hide markdown syntax (`**`, `#`, etc.) when cursor is elsewhere
2. Reveal syntax when cursor enters that formatted region
3. Apply CSS styling to make content look formatted

This creates a seamless WYSIWYG experience while keeping the document as pure markdown.

### CodeMirror 6 Decoration System

#### ViewPlugin Architecture

`src/shared/components/editor/obsidian/plugins/livePreview/viewPlugin.ts`:

```typescript
class LivePreviewPlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    // Rebuild decorations when cursor moves or document changes
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildDecorations(update.view);
    }
  }
}
```

**Key insight**: Decorations are rebuilt on **every cursor movement**. This is what enables the instant reveal/hide behavior.

#### Decoration Builder

`decorationBuilder.ts` is where the magic happens. It:

1. **Parses the syntax tree** using `syntaxTree(state).iterate()`
2. **Checks cursor position** for each node
3. **Generates decorations** to hide markers or apply styling

Example for bold text:

```typescript
case 'StrongEmphasis': {
  const text = state.sliceDoc(node.from, node.to);
  const markerLen = text.startsWith('**') ? 2 : 0;
  
  const contentStart = node.from + markerLen;
  const contentEnd = node.to - markerLen;
  
  const cursorInside = cursorInRange(selection, node.from, node.to);
  
  if (!cursorInside) {
    // Hide opening **
    entries.push({ 
      from: node.from, 
      to: contentStart, 
      decoration: Decoration.replace({}) 
    });
    // Hide closing **
    entries.push({ 
      from: contentEnd, 
      to: node.to, 
      decoration: Decoration.replace({}) 
    });
  }
  
  // Style content as bold (always)
  entries.push({ 
    from: contentStart, 
    to: contentEnd, 
    decoration: Decoration.mark({ class: 'cm-lp-strong' }) 
  });
  break;
}
```

**Flow:**
1. Find `**bold**` node in syntax tree
2. Check if cursor is in range `[node.from, node.to]`
3. If cursor **outside**: add `Decoration.replace({})` to hide `**` markers
4. If cursor **inside**: skip hiding (markers visible)
5. Always add `Decoration.mark({ class: 'cm-lp-strong' })` for bold styling

### Supported Elements

The decoration builder handles:

- **Text Formatting**: `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``
- **Headings**: `# H1` through `###### H6` with scaling fonts
- **Links**: `[text](url)` - shows text, hides URL when cursor outside
- **Code Blocks**: ` ```lang` with fence hiding
- **Blockquotes**: `> quote` with `>` marker hiding
- **Horizontal Rules**: `---` with styling

All follow the same pattern: **detect cursor position, conditionally hide syntax, always apply formatting**.

## Styling Philosophy

### Glassmorphism Integration

The editor inherits the app's glassmorphic design language:

**Reading View** (`ReadingView.tsx`):
```tsx
<Box
  css={{
    background: 'rgba(255, 255, 255, 0.45)',
    _dark: {
      background: 'rgba(20, 20, 25, 0.5)',
    },
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  }}
>
  <ReactMarkdown
    components={{
      code({ className, children, ...props }: any) {
        // Use GlassCodeBlock for fenced code
        return <GlassCodeBlock code={codeContent} language={language} />
      }
    }}
  />
</Box>
```

**Live Preview Theme** (`theme/livePreviewTheme.ts`):
```typescript
'.cm-lp-strong': {
  fontWeight: '700',
},
'.cm-lp-emphasis': {
  fontStyle: 'italic',
},
'.cm-lp-heading-1': {
  fontSize: '2rem',
  lineHeight: '2.5',
  fontWeight: '700',
  color: isLight ? '#4287f5' : '#60a5fa',
},
// ... etc
```

**Result**: Live Preview and Reading View have **nearly identical visual styling**, but:
- **Live Preview** = Editable, syntax-aware CodeMirror
- **Reading View** = Read-only ReactMarkdown

This convergence was the goal—WYSIWYG editing that looks like the rendered output.

### Typography Consistency

Both views use the same font scale, colors, and spacing:

```typescript
// Shared styling values
const headingColors = {
  h1: { light: '#4287f5', dark: '#60a5fa' },
  h2: { light: '#4287f5', dark: '#60a5fa' },
  h3: { light: '#5b9cf5', dark: '#93c5fd' },
  // ...
};

const fontSizes = {
  h1: '2rem',
  h2: '1.625rem',
  h3: '1.375rem',
  // ...
};
```

Applied in:
- `livePreviewTheme.ts` as CSS classes
- `ReadingView.tsx` as inline styles

## Mode Switching Implementation

### State Management

`src/shared/components/editor/obsidian/index.tsx`:

```typescript
export type EditorMode = 'live-preview' | 'source' | 'reading';

const [mode, setMode] = useState<EditorMode>(defaultMode);
const [content, setContent] = useState(initialContent);

const livePreviewRef = useRef<LivePreviewEditorRef>(null);
const sourceRef = useRef<MarkdownEditorRef>(null);
```

### Mode Toggle UI

```tsx
<HStack gap={1}>
  {[
    { mode: 'live-preview', icon: LuEye, label: 'Live Preview' },
    { mode: 'source', icon: LuCode, label: 'Source' },
    { mode: 'reading', icon: LuBookOpen, label: 'Reading' },
  ].map(({ mode: btnMode, icon: Icon, label }) => (
    <Button
      key={btnMode}
      variant={mode === btnMode ? 'solid' : 'ghost'}
      colorPalette={mode === btnMode ? 'blue' : 'gray'}
      onClick={() => setMode(btnMode)}
    >
      <Icon />
      <Box as="span" display={{ base: 'none', md: 'inline' }} ml={2}>
        {label}
      </Box>
    </Button>
  ))}
</HStack>
```

**Design decision**: Show icon on mobile, icon + label on desktop.

### Content Synchronization

When switching modes, content stays in sync:

```typescript
const handleChange = useCallback((newContent: string) => {
  setContent(newContent);
  onChange?.(newContent);
}, [onChange]);

// In render:
{mode === 'live-preview' && (
  <LivePreviewEditor
    content={content}
    onChange={handleChange}
    // ...
  />
)}
```

All editors read/write the same `content` state, so switching modes preserves edits.

## Technical Challenges & Solutions

### Challenge 1: Decoration Ordering

**Problem**: CodeMirror's `RangeSetBuilder` requires decorations to be added in **document order** (ascending positions). Multiple decoration types (emphasis, headings, links) can overlap.

**Solution**: Collect all decorations in an array, sort by position, then build:

```typescript
const entries: DecorationEntry[] = [];

syntaxTree(state).iterate({
  enter: (node: SyntaxNodeRef) => {
    // Add decorations to entries array
    entries.push({ from, to, decoration });
  }
});

// Sort by position
entries.sort((a, b) => {
  if (a.from !== b.from) return a.from - b.from;
  return a.to - b.to;
});

// Build decoration set
const builder = new RangeSetBuilder<Decoration>();
for (const entry of entries) {
  builder.add(entry.from, entry.to, entry.decoration);
}
return builder.finish();
```

### Challenge 2: Cursor Range Detection

**Problem**: Determine if cursor is "inside" a formatted region for syntax reveal.

**Solution**: Check if selection overlaps with node range:

```typescript
function cursorInRange(
  selection: EditorSelection,
  from: number,
  to: number
): boolean {
  const main = selection.main;
  return main.from <= to && main.to >= from;
}
```

This handles:
- Point cursor (main.from === main.to)
- Range selections (main.from < main.to)
- Cursor at boundaries (inclusive check)

### Challenge 3: Markdown Node Names

**Problem**: CodeMirror's markdown parser uses specific node names that aren't always intuitive.

**Solution**: Map markdown elements to Lezer parser node names:

| Markdown | Node Name |
|----------|-----------|
| `**bold**` | `StrongEmphasis` |
| `*italic*` | `Emphasis` |
| `~~strike~~` | `Strikethrough` |
| `` `code` `` | `InlineCode` |
| `# H1` | `ATXHeading1` |
| `[link](url)` | `Link` |
| ` ```code``` ` | `FencedCode` |
| `> quote` | `Blockquote` |

Discovered through syntax tree inspection:

```typescript
syntaxTree(state).iterate({
  enter: (node) => {
    console.log(node.name, state.sliceDoc(node.from, node.to));
  }
});
```

### Challenge 4: Performance

**Problem**: Rebuilding decorations on every cursor movement could be slow for large documents.

**Optimization**: CodeMirror's `RangeSet` is highly optimized for:
- Incremental updates (only changed regions)
- Tree-based storage (O(log n) lookups)
- Viewport-based rendering (only visible content)

In practice, documents under 10,000 lines perform smoothly.

## Integration Points

### With Existing MarkdownEditor

The ObsidianEditor **reuses** the existing `MarkdownEditor` component for Source mode:

```tsx
{mode === 'source' && (
  <MarkdownEditor
    ref={sourceRef}
    content={content}
    onChange={handleChange}
    onSave={handleSave}
    colorMode={colorMode}
    placeholder={placeholder}
  />
)}
```

This means:
- No duplicate code for basic markdown editing
- Source mode gets all existing features (search, history, etc.)
- Consistent keybindings (Cmd+S for save)

### With GlassCodeBlock

Both Reading View and Live Preview integrate with the existing `GlassCodeBlock` component:

**Reading View** (direct):
```tsx
<ReactMarkdown
  components={{
    code({ className, children }: any) {
      const match = /language-(\w+)/.exec(className || '');
      if (!match) return <code>{children}</code>;
      
      return <GlassCodeBlock 
        code={String(children).replace(/\n$/, '')} 
        language={match[1]} 
      />;
    }
  }}
>
```

**Live Preview** (via CSS):
```typescript
'.cm-lp-code-block': {
  fontFamily: 'ui-monospace, ...',
  fontSize: '0.9em',
  lineHeight: '1.6',
}
```

This creates visual consistency across all modes.

## Design Decisions & Trade-offs

### Decision 1: No Auto-Save in Demo

**Rationale**: The HybridEditorDemo focuses on the **editing experience**, not file management. Auto-save adds complexity (debouncing, error handling, status indicators) that distracts from the core innovation.

**In production**: Integrate with `useAutoSave` hook (see `NoteViewPage.tsx:54-71`).

### Decision 2: Simplified File Operations

**Rationale**: No file rename, no sibling navigation, no H1-triggered renaming. These are **application-specific features** that belong in the page component, not the reusable editor.

**In production**: Wrap ObsidianEditor in a page component that handles:
- File I/O (`invokeReadFile`, `invokeWriteFile`)
- Navigation (`onNavigatePrev`, `onNavigateNext`)
- Metadata (`frontMatter`, resource management)

### Decision 3: Three Modes (Not Four)

**Rationale**: The existing app has `edit`, `preview`, `source`. The hybrid editor has `live-preview`, `source`, `reading`. Why not combine them?

**Answer**: Different use cases:
- **NoteViewPage** = File-centric, with auto-save and navigation
- **ObsidianEditor** = Content-centric, focused on editing experience

They serve different purposes, so mode mappings don't need to align.

### Decision 4: Consolidated Decoration Builder

**Initial approach**: Separate files for each element type (`emphasis.ts`, `headings.ts`, `links.ts`).

**Final approach**: Single `decorationBuilder.ts` with all elements.

**Rationale**: 
- Easier to manage decoration ordering
- Single place to handle cursor detection logic
- Simpler import structure
- Less file overhead (7 files → 1 file)

## Usage Example

### Basic Integration

```tsx
import ObsidianEditor from '@/shared/components/editor/obsidian';

function MyPage() {
  const [content, setContent] = useState(initialMarkdown);
  const { colorMode } = useColorMode();

  return (
    <ObsidianEditor
      initialContent={content}
      onChange={setContent}
      colorMode={colorMode}
      defaultMode="live-preview"
    />
  );
}
```

### With Save Handler

```tsx
const handleSave = async (content: string) => {
  await invokeWriteFile(filePath, content);
  toaster.create({ type: 'success', title: 'Saved' });
};

<ObsidianEditor
  initialContent={content}
  onChange={setContent}
  onSave={handleSave}
  colorMode={colorMode}
/>
```

### Programmatic Control

```tsx
const editorRef = useRef<ObsidianEditorRef>(null);

// Switch modes programmatically
editorRef.current?.setMode('reading');

// Get current content
const text = editorRef.current?.getContent();

// Set content
editorRef.current?.setContent('# New content');
```

## Future Enhancements

### 1. Interactive Elements

**Task checkboxes**: The `decorationBuilder.ts` has placeholder logic for `- [ ]` tasks, but doesn't create interactive widgets yet.

**Implementation path**:
```typescript
case 'ListItem': {
  const taskMatch = text.match(/^(\s*[-*+]\s*)(\[([ xX])\])\s*/);
  if (taskMatch) {
    const isChecked = taskMatch[3].toLowerCase() === 'x';
    
    // Replace checkbox with widget
    entries.push({
      from: checkboxStart,
      to: checkboxEnd,
      decoration: Decoration.widget({
        widget: new CheckboxWidget(isChecked, checkboxStart, view),
      }),
    });
  }
}
```

### 2. Inline Images

**Goal**: Show image thumbnails in Live Preview mode for `![alt](image.png)`.

**Challenge**: CodeMirror widgets need synchronous content, but image loading is async.

**Solution**: Use `Decoration.widget` with a React portal or preload images.

### 3. Math Rendering

**Goal**: Render LaTeX math inline and in blocks.

**Implementation**: Use KaTeX or MathJax widgets, similar to code blocks.

### 4. Collaborative Editing

**Goal**: Multi-user editing with Y.js or similar.

**Challenge**: Decorations are view-local; need to sync cursor positions across clients.

### 5. Mobile Optimization

**Current**: Toolbar shows icons only on small screens.

**Enhancement**: Touch-friendly selection handles, gesture-based mode switching.

## Comparison Matrix

| Feature | NoteViewPage | ObsidianEditor |
|---------|--------------|----------------|
| **Editing Modes** | Edit (raw CM6) | Live Preview (WYSIWYG) |
| **Preview Modes** | Preview + Source | Reading + Source |
| **Syntax Visibility** | Always visible in edit | Cursor-aware reveal |
| **Component Reuse** | Minimal | Reuses MarkdownEditor |
| **Auto-save** | ✅ Built-in | ❌ Manual (intentional) |
| **File Operations** | ✅ Rename, navigation | ❌ Content-only |
| **Search** | ✅ In preview/source | ❌ (can be added) |
| **H1 Rename** | ✅ Auto-rename file | ❌ Editor-focused |
| **Glassmorphism** | ✅ Consistent | ✅ Enhanced |
| **Mode Switch Cost** | Component unmount | Decoration rebuild |

## Key Takeaways

1. **Decorations > Component Switching**: CodeMirror 6's decoration system enables Live Preview without complex state management.

2. **Cursor-Aware UX**: Hiding/revealing syntax based on cursor position creates an intuitive WYSIWYG experience.

3. **Reusability**: By separating editor concerns (content editing) from app concerns (file I/O, navigation), the ObsidianEditor becomes a reusable primitive.

4. **Styling Convergence**: When Live Preview and Reading View look identical, users get a seamless experience across modes.

5. **Incremental Adoption**: The ObsidianEditor can coexist with NoteViewPage—use the right tool for the job.

## References

- **CodeMirror 6 Docs**: https://codemirror.net/docs/
- **Decorations Guide**: https://codemirror.net/docs/guide/#decorations
- **Obsidian Live Preview**: Inspiration for cursor-aware syntax hiding
- **Implementation**: `src/shared/components/editor/obsidian/`
- **Demo**: `src/pages/HybridEditorDemo.tsx`
- **Design Journey**: `.bluekit/plans/markdown-editor/`

---

**Built with**: CodeMirror 6, React 18, Chakra UI 3, TypeScript
**Status**: Production-ready for content-focused editing use cases
**Next Steps**: Integrate with file management, add interactive elements, optimize for mobile
