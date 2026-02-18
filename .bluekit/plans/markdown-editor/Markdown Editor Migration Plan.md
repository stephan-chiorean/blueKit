# Markdown Editor Migration Plan

Port the `ObsidianEditor` (live-preview / source / reading modes, CodeMirror-based) to replace
all ReactMarkdown + MarkdownEditor rendering surfaces across the app.

**Goal**: Every view that currently renders markdown content uses the same renderer as
`HybridEditorDemo`. UI chrome (headers, mode-switch buttons, save status, navigation,
search, backlinks) is **unchanged**.

---

## What Changes vs What Stays
| | Before | After |
|---|---|---|
| Preview render | ReactMarkdown + Chakra components | ObsidianEditor `reading` mode |
| Source render | ShikiCodeBlock (markdown) | ObsidianEditor `source` mode |
| Edit render | MarkdownEditor (CodeMirror, raw) | ObsidianEditor `live-preview` mode |
| Mode switch buttons | Existing per-page UI | Same — ObsidianEditor `showModeToggle=false`, mode driven by parent |
| Auto-save, search, backlinks, headers | Unchanged | Unchanged |
| `headerSlot` / editable title | Demo only | Per-page decision (NoteViewPage yes, others TBD) |

Mode mapping: `preview` → `reading`, `source` → `source`, `edit` → `live-preview`

---

## Phase 1 — Make ObsidianEditor externally controllable

**File**: `src/shared/components/editor/obsidian/index.tsx`

Add a `mode` prop (controlled) alongside the existing `defaultMode` (uncontrolled):

```ts
export interface ObsidianEditorProps {
  // ...existing...
  /** If provided, the parent controls the mode (controlled). */
  mode?: EditorMode;
}
```

When `mode` prop is present, use it directly instead of internal state. Internal state
is kept for the uncontrolled case (HybridEditorDemo).

This lets every existing page drive the mode from its own state without ObsidianEditor
rendering a toolbar at all (`showModeToggle=false`).

---

## Phase 2 — Migrate NoteViewPage

**File**: `src/pages/NoteViewPage.tsx`

Current:
- `preview` / `source` → `<ResourceMarkdownContent>`
- `edit` → `<MarkdownEditor>`

After:
- All three modes → `<ObsidianEditor mode={obsidianMode} showModeToggle={false} />`
- `viewMode` maps to ObsidianEditor `EditorMode` via a small helper:
  `preview → reading`, `source → source`, `edit → live-preview`
- `headerSlot` receives the editable title input (same as HybridEditorDemo).
  On blur/Enter, title triggers file rename (existing `handleH1Exit` logic).
- Auto-save, `onSave`, `onChange` wired to ObsidianEditor props.
- All other logic (sibling navigation, file watcher, search) is untouched.

---

## Phase 3 — Migrate WalkthroughDocViewPage

**File**: `src/features/walkthroughs/components/WalkthroughDocViewPage.tsx`

Same pattern as Phase 2. Replace `ResourceMarkdownContent` + `MarkdownEditor` with
`ObsidianEditor mode={obsidianMode} showModeToggle={false}`.

No `headerSlot` — walkthroughs use the existing page header for title display.

---

## Phase 4 — Migrate PlanDocViewPage

**File**: `src/features/plans/components/PlanDocViewPage.tsx`

Same as Phase 3.

---

## Phase 5 — Migrate EditableMarkdownViewer

**File**: `src/features/workstation/components/EditableMarkdownViewer.tsx`

This component is the workstation viewer (kits, agents, etc.) with preview/source/edit modes,
backlinks, outbound links, and save status.

Replace the three conditional content branches with a single `ObsidianEditor`:
```tsx
<ObsidianEditor
  mode={obsidianMode}
  showModeToggle={false}
  initialContent={content}
  onChange={handleContentChange}
  onSave={handleSave}
  colorMode={colorMode}
/>
```

Everything above the content area (title heading, description, tags, view mode switcher,
links button, separator) stays exactly as-is.

---

## Phase 6 — Migrate ResourceMarkdownViewer

**File**: `src/features/workstation/components/ResourceMarkdownViewer.tsx`

Read-only two-mode viewer (preview + source). Replace `ResourceMarkdownContent` with
`ObsidianEditor mode={obsidianMode} showModeToggle={false}` with `onChange` omitted
(read-only via `EditorView.editable.of(false)` — already how `reading` mode works).

---

## Phase 7 — Retire old components (cleanup)

Once all pages are migrated and verified:

- Delete `src/features/workstation/components/ResourceMarkdownContent.tsx`
- Delete or archive `src/shared/components/editor/MarkdownEditor.tsx`
  (still needed by EditableMarkdownViewer in edit mode internally — keep until fully replaced)
- `KitMarkdownViewer` — evaluate whether it still has usages; retire if not

Do **not** delete:
- `ShikiCodeBlock` — still used by source-mode rendering inside ObsidianEditor (or other places)
- `MermaidDiagramViewer` — standalone diagram page, not part of this migration
- `SearchInMarkdown` — keep; may need to adapt search to target CodeMirror instead of DOM

---

## Phase 8 — Search integration

**File**: `src/features/workstation/components/SearchInMarkdown.tsx`

Currently targets `#markdown-content-preview` / `#markdown-content-source` DOM containers.
With CodeMirror, text lives in the CM view, not plain DOM text nodes.

Options (pick one):
1. Use CodeMirror's built-in search panel (`@codemirror/search`) — cleanest, wires to Cmd+F
2. Keep SearchInMarkdown but target `.cm-content` — may work if CM renders text in DOM
3. Expose a `search(term)` method via ObsidianEditorRef

Recommendation: **Option 1** — add the CM search extension to `LivePreviewEditor` and
`ReadingView`, disable the custom SearchInMarkdown for these views.

---

## Out of Scope (this migration)

- `TaskDetailModal` — blueprint task preview, no edit needed, keep ReactMarkdown for now
- `CatalogDetailModal` — library detail, keep as-is
- `HybridMarkdownEditor` — separate block-editor experiment, untouched
- Mermaid inline rendering inside ObsidianEditor — tracked separately; for now mermaid
  code blocks render as highlighted source in reading/live-preview mode

---

## Implementation Order

```
Phase 1 (ObsidianEditor controlled mode)  ← unblocks everything
Phase 2 (NoteViewPage)                    ← highest-traffic view, validates the approach
Phase 3 (WalkthroughDocViewPage)          ← same pattern
Phase 4 (PlanDocViewPage)                 ← same pattern
Phase 5 (EditableMarkdownViewer)          ← workstation, more complex (backlinks etc.)
Phase 6 (ResourceMarkdownViewer)          ← read-only, simplest
Phase 7 (cleanup)                         ← after all views verified
Phase 8 (search)                          ← can run in parallel with 5–6
```

Phases 3 and 4 can be done in parallel after Phase 2 is green.
