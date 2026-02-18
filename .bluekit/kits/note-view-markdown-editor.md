---
id: note-view-markdown-editor
alias: Note View Markdown Editor
type: kit
is_base: false
version: 1
tags:
  - markdown
  - editor
  - codemirror
description: Obsidian-style three-mode markdown editor (reading, live-preview, source) with Shiki syntax highlighting, auto-save, sibling navigation, and file rename — built on CodeMirror 6 and ReactMarkdown.
---
# Note View Markdown Editor

## End State

After applying this kit, the application will have a full-featured markdown note viewer and editor driven by a single page component (`NoteViewPage`) with three distinct rendering modes, a persistent title input, auto-save, sibling file navigation, and file rename-on-commit. All modes share the same visual language (font, colors, spacing) so switching is seamless.

---

### Mode System

The page exposes three view modes. Two types map them:

```
NoteViewPage ViewMode   →   ObsidianEditor EditorMode
─────────────────────────────────────────────────────
'preview'               →   'reading'
'edit'                  →   'live-preview'
'source'                →   'source'
```

Externally the header cycles only between `'preview'` and `'edit'` via a single text toggle ("Mode: Reader" / "Mode: Editor"). The `'source'` mode exists in `ObsidianEditor` but is not surfaced in `NoteViewPage`'s header cycle.

---

### Component Hierarchy

```
NoteViewPage
├── NoteViewHeader          — breadcrumbs, prev/next arrows, mode toggle
└── ObsidianEditor          — multi-mode editor shell (controlled by NoteViewPage)
    ├── headerSlot          — title <input> rendered above all editor content
    ├── LivePreviewEditor   — (mode === 'edit') CodeMirror 6, cursor-aware decorations
    ├── ReadingView         — (mode === 'preview') ReactMarkdown, fully rendered HTML
    └── MarkdownEditor      — (mode === 'source') raw CodeMirror with syntax highlighting
```

---

### Content Split: Title + Body

`NoteViewPage` splits the raw markdown file into two independent pieces:

- **Title**: extracted from the first `# H1` line via `extractTitle()`
- **Body**: everything after that first line via `extractBody()`

These are stored as separate state variables. The header renders the title as a bare `<input>` that sits _above_ the editor area (injected via `ObsidianEditor`'s `headerSlot` prop). Editing the title or body both call `buildFullContent(title, body)` = `` `# ${title}\n\n${body}` `` before triggering `onContentChange` and the auto-save.

---

### Auto-Save

- Library: custom `useAutoSave` hook
- Delay: 1 500 ms debounce after last change
- Active only when `viewMode !== 'preview'` (i.e., in edit or source mode)
- Writes via `invokeWriteFile(path, content)` IPC call
- Shows a `'Saved'` toaster on success, `'Save failed'` on error
- Cmd+S fires `saveNow()` immediately (no debounce)

---

### File Watcher

A Tauri event listener (`@tauri-apps/api/event` → `listen`) watches the project's `.bluekit` directory for external file changes. It is **disabled while in edit mode** to avoid overwriting in-flight edits. On receiving an event that includes the current file path, it re-reads the file and re-derives title/body.

---

### Sibling Navigation

On mount (and on file path change), `NoteViewPage` fetches all markdown files in the current directory via `invokeGetFolderMarkdownFiles(dir)`, sorts them alphabetically, and tracks the current file's index. The `NoteViewHeader` renders prev/next arrow buttons that are enabled/disabled based on this index. Navigation calls `invokeReadFile()` on the target file and passes it to the parent's `onNavigate` callback.

---

### File Rename

When the user commits the title input (Enter key or blur), `handleTitleCommit` fires:
1. Sanitizes the title (strips `/\:*?"<>|` → `-`)
2. Derives `newPath = dir + sanitizedTitle + '.md'`
3. Writes the new file via `invokeWriteFile(newPath, content)`
4. Deletes the old file via `deleteResources([oldPath])`
5. Calls `onFileRenamed(oldPath, newPath)` so the parent (tree/tabs) can update

A `isRenamingRef` guard prevents concurrent rename operations.

---

### NoteViewHeader

Sticky header at the top of the page. Contains three sections:

- **Left**: prev/next arrow buttons (ghost, disabled + dimmed when at boundary)
- **Center**: breadcrumb trail derived from the file's path relative to `.bluekit/`; each path segment is a `Text` separated by `>`
- **Right**: mode toggle — a ghost `Button` that reads "Mode: Reader" or "Mode: Editor"; cycles `'preview'` ↔ `'edit'` on click via `MODE_CYCLE = ['preview', 'edit']`

---

### ObsidianEditor

The editor shell is a `forwardRef` component that:
- Accepts a `mode?: EditorMode` prop for controlled mode (used by `NoteViewPage`)
- Falls back to internal `useState` when uncontrolled
- Maintains a single `content` state synced from `initialContent`
- Renders only one of three children depending on `mode`
- Passes `headerSlot` (title input) above the active editor — placed inside the scrollable container so title scrolls with content
- When `headerSlot` is present, sets `.cm-scroller { overflow: hidden }` and `.cm-editor { height: auto }` so the outer `Box` controls scroll; title and body move as one document
- Has optional built-in toolbar (`showModeToggle`) with Live Preview / Source / Reading buttons + fullscreen toggle — hidden in `NoteViewPage` (set to `false`)

Exposed `ref` interface (`ObsidianEditorRef`):
- `focus()` — delegates to active sub-editor
- `getContent()` — returns current content string
- `setContent(str)` — updates content and syncs to active sub-editor
- `getMode()` — returns current mode
- `setMode(mode)` — switches internal mode

---

### LivePreviewEditor (Edit Mode)

CodeMirror 6 editor (`@codemirror/view` + `@codemirror/state`) with cursor-aware decoration hiding. When cursor is away from a markdown syntax element, the raw markers are hidden and replaced with styled renderings. When cursor enters, raw syntax reappears for editing.

**Extension stack** (assembled in `createLivePreviewExtension(colorMode)`):
- `livePreviewPlugin` — ViewPlugin for inline decorations (bold, italic, strikethrough, inline code, headings, links, blockquotes, horizontal rules)
- `livePreviewTableField` — StateField for GFM table widgets (multi-line)
- `createLivePreviewCodeBlockField(colorMode)` — StateField factory for fenced code block widgets with Shiki highlighting
- `createLivePreviewTheme(colorMode)` — `EditorView.theme(...)` for all visual styles

**Compartment pattern**: The entire extension bundle lives inside a `themeCompartment` (a `Compartment`). When `colorMode` changes, `themeCompartment.reconfigure(createLivePreviewExtension(newColorMode))` swaps all four extensions atomically — including recreating the code block StateField with the new Shiki theme.

**Instant decoration on mount**: After `new EditorView()`, `forceParsing(view, doc.length, 200)` is called to synchronously parse the full document before first paint. This ensures all decoration plugins see a complete lezer syntax tree immediately, preventing the "headers show `**`" flash when entering edit mode.

**Content sync**: A `useEffect` watching `content` prop detects drift between prop and editor doc, then dispatches a full-document replacement. Does not recreate the view.

**Save keymap**: Cmd+S / Ctrl+S dispatches the current doc string to `onSave`.

---

### Decoration Builder

`buildDecorations(view, readingMode)` — drives the `LivePreviewPlugin` ViewPlugin. Iterates the lezer syntax tree and builds a `RangeSetBuilder<Decoration>`:

| Syntax node | Decoration behavior |
|---|---|
| `StrongEmphasis` (`**...**`) | Hides `**` markers; marks content with `.cm-lp-strong` |
| `Emphasis` (`*...*`) | Hides `*` markers; marks content with `.cm-lp-emphasis` |
| `Strikethrough` (`~~...~~`) | Hides `~~` markers; marks content with `.cm-lp-strikethrough` |
| `InlineCode` (`` `...` ``) | Hides backticks; marks content with `.cm-lp-inline-code` |
| `ATXHeading1–6` (`# H`) | Hides `# ` marker; marks content with `.cm-lp-heading cm-lp-heading-N` |
| `Link` (`[text](url)`) | Hides `[`, `](url)` parts; marks link text with `.cm-lp-link` + `data-url` |
| `Blockquote` (`> ...`) | Marks block with `.cm-lp-blockquote`; hides `> ` markers per line |
| `HorizontalRule` (`---`) | Replaces with `<hr>` widget (`.cm-lp-hr-widget`) |

All hiding decorations use `Decoration.replace({})` (zero-width replacement). Cursor awareness: `cursorInRange(selection, node.from, node.to)` — if the cursor is inside a node, hide decorations are skipped and the raw syntax is visible.

**Why ViewPlugin for inline, StateField for blocks**: CodeMirror's ViewPlugin forbids `Decoration.replace` that spans a line break. Tables and fenced code blocks span multiple lines, so they use `StateField` which has no such restriction.

---

### Code Block Widget (`CodeBlockWidget`)

Replaces raw fenced code syntax with a rendered block widget:

```
┌──────────────────────────────────┐
│ typescript                ← lang │  (.cm-lp-code-lang)
├──────────────────────────────────┤
│ const x = 1;  ← Shiki-colored   │  (Shiki <pre> or plain <pre>)
└──────────────────────────────────┘
```

**Shiki HTML cache** (`shikiHtmlCache: Map<string, string>` — module-level): key is `"colorMode:lang:code"`. On `toDOM()`, if the cache has an entry, the highlighted Shiki `<pre>` is applied synchronously — zero flash on decoration rebuilds. On first render, a plain-text `<code>` is shown immediately while `highlightAsync()` fetches Shiki asynchronously, then replaces the `<pre>` DOM in place and stores the result in the cache.

The widget's `eq()` compares `lang`, `code`, and `colorMode` — CodeMirror reuses DOM when all three match, avoiding unnecessary re-renders.

---

### Table Widget (`TableWidget`)

Replaces GFM table syntax with a `<table>` DOM element (`.cm-lp-table-widget`). Parses pipe-delimited rows manually: first non-separator row → `<thead>`, subsequent rows → `<tbody>`. When cursor enters the table node, the raw syntax is restored (widget removed).

---

### Live Preview Theme (`createLivePreviewTheme`)

`EditorView.theme(...)` block covering every styled element. Color-mode-aware (accepts `'light' | 'dark'`). Key CSS classes:

- `.cm-lp-strong`, `.cm-lp-emphasis`, `.cm-lp-strikethrough`, `.cm-lp-inline-code`
- `.cm-lp-heading`, `.cm-lp-heading-1` … `.cm-lp-heading-6`
- `.cm-lp-link`, `.cm-lp-blockquote`
- `.cm-lp-code-block-container`, `.cm-lp-code-lang`, `.cm-lp-code-block-pre`
- `.cm-lp-table-widget`, `.cm-lp-hr-widget`

Typography palette (both modes mirror `ReadingView`):
- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- H1: `1.875rem / 700` | H2: `1.875rem / 600 / accent blue` | H3: `1.125rem / 600`
- Accent: `#4287f5` (light+dark) | dark text: `#e4e4e7` | muted: `#9ca3af`

---

### ReadingView (Preview Mode)

`ReactMarkdown` with `remark-gfm` plugin. Every HTML element is overridden with a Chakra `Box` (or native element) to:
- Apply explicit `listStyleType: 'disc'` / `'decimal'` (Chakra CSS reset strips browser defaults)
- Match the same font, color, and spacing palette as `livePreviewTheme`
- Render code blocks via `ShikiCodeBlock` (same Shiki-highlighted appearance as editor mode)
- Render `mermaid` code blocks via `InlineMermaid` (async `mermaid.render()` into a `<div>`)
- Open external `http(s)://` links via Tauri's `shell.open()` (no browser nav)

Inline vs block code detection: `isBlock = !!match || codeStr.includes('\n')` — since inline backtick code never contains newlines.

---

### ShikiCodeBlock

React component used by `ReadingView` for fenced code blocks. Visual structure matches `CodeBlockWidget` exactly:

```
background: rgba(0,0,0,0.03) light / rgba(255,255,255,0.05) dark
border: 1px solid rgba(0,0,0,0.06) / rgba(255,255,255,0.08)
borderRadius: 6px
```

- Optional language label bar at top
- Calls `codeToHtml(code, { lang, theme })` from `shiki`
- Overrides Shiki's `<pre>` background to `transparent` via regex on the HTML string
- Shows plain-text `<code>` while loading; replaces with highlighted HTML on resolve
- `isMountedRef` guard prevents state updates after unmount

Language normalization: `LANG_MAP` aliases (`ts→typescript`, `sh→bash`, `yml→yaml`, `rs→rust`, `py→python`). File-path-style lang hints (e.g., `src/foo.ts`) are normalized by extracting the extension.

---

## Implementation Principles

- **Split title from body**: Store them separately so the title can be a styled `<input>` visually distinct from editor content, while the reconstructed full markdown remains the source of truth for saving.
- **Content flows down, events flow up**: `NoteViewPage` owns the canonical content state; `ObsidianEditor` and its children receive it as props and emit changes upward via `onChange`/`onSave`.
- **Disable file watcher during editing**: External file changes should never overwrite in-progress edits; gate the watcher listener on `viewMode !== 'edit'`.
- **Cursor awareness via `cursorInRange`**: Check `selection.main.from <= node.to && selection.main.to >= node.from` for any node — if true, skip hide decorations so raw syntax is visible and editable.
- **ViewPlugin for inline, StateField for block**: Any `Decoration.replace` spanning a line break must live in a `StateField`. Inline decorations (bold, italic, etc.) can safely use `ViewPlugin`.
- **Factory pattern for color-mode-aware StateFields**: A `StateField` instance captures its config at creation. Wrap in a factory function called inside the `themeCompartment` so color mode changes recreate the field with the correct Shiki theme.
- **`forceParsing` before first paint**: Always call `forceParsing(view, doc.length, budget)` immediately after `new EditorView()` to pre-populate the lezer syntax tree. This eliminates the flash where decorations haven't applied yet on first edit-mode entry.
- **Module-level Shiki cache**: Cache highlighted HTML at module scope (keyed by `colorMode:lang:code`). `toDOM()` applies cached HTML synchronously; only first-time renders require the async Shiki import.
- **Compartment for theme swapping**: Place the entire live-preview extension bundle (plugin + StateFields + theme) inside one `Compartment`. Reconfigure it atomically when color mode changes — never destroy and recreate the editor.
- **Match visual styles across modes**: `ReadingView` and `livePreviewTheme` must use identical font, color, and spacing values so switching modes feels like the same document, not a different renderer.

---

## Verification Criteria

After generation, verify:

- ✓ Switching from "Mode: Reader" to "Mode: Editor" is instant with full decorations applied — no `**` or `##` visible on first entry
- ✓ Fenced code blocks in editor mode render as styled widgets with Shiki syntax highlighting; raw syntax restores when cursor enters the block
- ✓ Fenced code blocks in reading mode match editor mode visually (same container, lang bar, and Shiki theme)
- ✓ Bold, italic, strikethrough, and inline code hide their markers when cursor is elsewhere; markers reappear when cursor enters
- ✓ Headings hide `# ` prefix when cursor is elsewhere and apply the correct size/weight/color
- ✓ Tables render as `<table>` widgets in editor mode; raw pipe syntax restores on cursor entry
- ✓ Bullet lists show disc markers in reading mode (`listStyleType: 'disc'`)
- ✓ Ordered lists show decimal markers in reading mode (`listStyleType: 'decimal'`)
- ✓ Title input is visually distinct (large, bold) and sits above the editor scroll area; editing title + body both trigger auto-save
- ✓ Committing the title (Enter / blur) renames the file on disk and fires `onFileRenamed`
- ✓ Prev/next arrows navigate to sibling files in the same directory
- ✓ External `http(s)://` links in reading mode open via shell (no browser navigation)
- ✓ Mermaid fenced code blocks render as diagrams in reading mode
- ✓ Color mode toggle reconfigures the editor (Shiki theme + CSS classes) without destroying the editor instance
- ✓ Auto-save fires 1 500 ms after last keystroke in edit/source mode; Cmd+S triggers immediate save
- ✓ File watcher does not overwrite content while in edit mode

---

## Interface Contracts

**Provides:**
- `NoteViewPage` — page-level component; props: `resource`, `content`, `editable?`, `onContentChange?`, `onNavigate?`, `initialViewMode?`, `onFileRenamed?`
- `ObsidianEditor` (+ `ObsidianEditorRef`) — multi-mode editor shell; controlled via `mode` prop or internal state
- `LivePreviewEditor` (+ `LivePreviewEditorRef`) — CodeMirror 6 live preview editor
- `ReadingView` — read-only ReactMarkdown renderer
- `ShikiCodeBlock` — Shiki-highlighted code block for reading view
- `createLivePreviewExtension(colorMode)` — full CodeMirror extension bundle for live preview
- `createReadingExtension(colorMode)` — full CodeMirror extension bundle for reading mode
- `buildDecorations(view, readingMode?)` — inline decoration builder (ViewPlugin use)
- `buildTableDecorations(state, readingMode?)` — table decoration builder (StateField use)
- `buildCodeBlockDecorations(state, readingMode?, colorMode?)` — code block decoration builder (StateField use)
- `CodeBlockWidget`, `TableWidget` — exported WidgetType classes

**Requires:**
- CodeMirror 6: `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/language-data`, `@codemirror/search`
- `@lezer/common` — `SyntaxNodeRef` type
- `react-markdown` + `remark-gfm` — reading view rendering
- `shiki` — async syntax highlighting (`codeToHtml`)
- `mermaid` — diagram rendering in reading mode
- `@tauri-apps/api/event` — file watcher listener
- `@tauri-apps/api/shell` — external link handling
- Tauri IPC: `invokeReadFile`, `invokeWriteFile`, `invokeGetFolderMarkdownFiles`, `deleteResources`
- Custom hook: `useAutoSave(path, options)` — debounced file save
- `useColorMode()` context — `'light' | 'dark'` color mode

**Compatible With:**
- Any file-tree or tab system that passes `ResourceFile` and listens for `onNavigate` / `onFileRenamed`
- Any auto-save hook exposing `{ save(content), saveNow(content) }` interface
- Chakra UI v3 — all layout uses `Box`, `HStack`, `Button`, `Portal`
