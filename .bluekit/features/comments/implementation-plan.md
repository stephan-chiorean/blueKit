# Comments Sidebar (Block-level Anchors) — Implementation Plan

Goal: add block-level comments anchored to rendered markdown blocks, surfaced in a right sidebar. Focus on "option 1" (block-level comments) with minimal disruption to the existing viewer.

## 1) Scope + Non‑Goals
- Scope: comments attached to markdown blocks (paragraphs, headings, list items, code blocks, blockquotes, tables) in `ResourceMarkdownContent` preview mode.
- UI: comments list in sidebar, optional hover affordance in the viewer to add a comment on a block.
- Non‑goal (v1): inline text range comments, real‑time collaboration, threaded resolution workflows.

## 2) Data Model (in app memory + persisted storage)
- **CommentAnchor**
  - `resourcePath`: string
  - `blockId`: string (stable per block; derived from markdown AST + position)
  - `blockType`: string (p, h1, li, code, blockquote, table, etc.)
  - `blockPreview`: string (short excerpt for sidebar list)
- **Comment**
  - `id`: string
  - `anchor`: CommentAnchor
  - `text`: string
  - `author`: string | optional
  - `createdAt`: number
  - `resolved`: boolean

Storage options (pick 1 for v1):
- Local JSON sidecar per resource (e.g. `resource.md.comments.json`) in same folder.
- Central storage in app data directory keyed by `resourcePath`.
- If using existing IPC/file layer, add a `comments` channel for read/write.

## 3) Anchoring Strategy
- Use `react-markdown` AST position data to generate stable `blockId`.
- Proposed ID format: `block-${node.position.start.line}-${node.position.start.column}`.
- For headings, also add slug: `block-h2-<slug>-<line>`.
- Add `data-block-id` and `data-block-type` to rendered wrappers.

Note: line/column stability is good enough for v1. If content changes, comments may drift; later add a fuzzy re‑anchor using block text hash.

## 4) Viewer Integration (ResourceMarkdownContent)
- Wrap each block component with a lightweight container that attaches the `blockId`.
- For each block renderer (p, h1..h6, li, pre/code, blockquote, table):
  - Create a `BlockWrapper` component that receives `blockId`, `blockType`, and renders children.
  - Add a hover affordance (small icon/button) on the right edge to "Add comment".
  - On click, emit `onAddComment(anchor)` event to sidebar context.

Implementation details:
- Add optional props to `ResourceMarkdownContent`:
  - `onAddComment?: (anchor: CommentAnchor) => void`
  - `onHoverBlock?: (blockId: string | null) => void`
- Use `components` in `ReactMarkdown` to wrap nodes. Example for paragraph:
  - `p: ({node, children}) => <BlockWrapper blockId=... blockType="p">...</BlockWrapper>`
- The `node.position` is accessible in ReactMarkdown renderers.

## 5) Sidebar UI
- Create a sidebar panel component (e.g. `src/components/comments/CommentsSidebar.tsx`).
- Input: `resourcePath`, `comments`, `activeBlockId`, `onAddComment`, `onResolveComment`.
- Features:
  - List comments grouped by blockId, sorted by doc order.
  - Clicking a comment scrolls to block via `document.querySelector('[data-block-id=...]')`.
  - New comment composer appears when user clicks "Add comment" affordance.
  - Show block preview text for context.

## 6) State + Context
- Add a `CommentsContext` to store and fetch comments per resource.
- Minimal API:
  - `loadComments(resourcePath)`
  - `addComment(anchor, text)`
  - `toggleResolved(commentId)`
  - `setActiveBlock(blockId)`
- Keep state localized at first; add persistence after UI is stable.

## 7) Navigation + Layout Integration
- Identify where to mount sidebar (likely `Workstation` or layout wrapper used by `ResourceMarkdownViewer`).
- Ensure sidebar is only visible for markdown preview mode.
- Provide a toggle (button) in existing header or right toolbar.

## 8) Implementation Steps (ordered)
1) Add `CommentsContext` + types (models, in-memory store).
2) Add `BlockWrapper` + block ID generation helper.
3) Update `ResourceMarkdownContent` renderers to include `BlockWrapper` and emit `onAddComment`.
4) Add `CommentsSidebar` UI + simple list + composer.
5) Wire sidebar into the main layout and connect to context.
6) Add scrolling to block on sidebar click.
7) (Optional) Persist comments to file via IPC.

## 9) Risks / Edge Cases
- Block IDs shift when markdown edits occur. Mitigation: store text snippet hash to re‑anchor best match.
- Tables and lists: ensure each list item is its own block ID.
- Code blocks: decide whether to anchor to block or per line; start with block.
- Mermaid blocks: ensure wrapper does not break rendering.

## 10) Success Criteria
- User can hover a block and add a comment.
- Comment appears in sidebar and is linked to that block.
- Clicking a comment scrolls the viewer to the corresponding block.
- Comments persist across reloads (if persistence is implemented).
