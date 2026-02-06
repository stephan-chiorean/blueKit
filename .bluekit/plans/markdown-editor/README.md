# Hybrid Markdown Editor - Implementation Plan

## Overview

Replace the CodeMirror-based markdown editor with a hybrid block-based editor that allows clicking individual content blocks to edit them inline while maintaining glassmorphic preview styling.

## Goals

- **Block-based editing**: Click any paragraph/heading/list to edit it as a textarea
- **Glassmorphic preview**: Maintain frosted glass styling for code blocks and UI
- **Simplified architecture**: No H1 title syncing, title separate from content
- **Zero backend changes**: Pure frontend implementation
- **Bundle size reduction**: Remove CodeMirror (~50-100KB savings)

## Non-Goals

- Complex backlinks or wiki-link logic (use existing)
- H1-based file renaming (title handled separately via modal)
- Multi-cursor editing or advanced CodeMirror features
- Real-time collaboration

## Implementation Phases

### Phase 1: Build in Parallel (Week 1)
**Status:** Not Started
**File:** [phase-1-build-in-parallel.md](./phase-1-build-in-parallel.md)

Build hybrid editor components in isolation without touching existing code.

**Deliverables:**
- `HybridMarkdownEditor.tsx`
- `MarkdownBlock.tsx`
- `BlockParser.ts`
- `GlassCodeBlock.tsx`
- Demo page for testing

---

### Phase 2: Integration Adapter (Week 1-2)
**Status:** Not Started
**File:** [phase-2-integration-adapter.md](./phase-2-integration-adapter.md)

Create adapter component that wraps new editor with existing features (auto-save, file watching, search).

**Deliverables:**
- `HybridEditorWithFeatures.tsx`
- Integration with `useAutoSave`, `useFileWatcher`
- Existing search/backlinks components wired up

---

### Phase 3: Feature Flag (Week 2)
**Status:** Not Started
**File:** [phase-3-feature-flag.md](./phase-3-feature-flag.md)

Deploy both editors side-by-side with toggle for A/B testing.

**Deliverables:**
- `useHybridEditor` feature flag
- Toggle UI in settings
- Conditional rendering in pages

---

### Phase 4: Migrate Pages (Week 2)
**Status:** Not Started
**File:** [phase-4-migrate-pages.md](./phase-4-migrate-pages.md)

Swap editor in each page one-by-one behind feature flag.

**Deliverables:**
- NoteViewPage updated
- ResourceViewPage updated
- PlanWorkspace updated (if applicable)

---

### Phase 5: Stabilize (Week 2-3)
**Status:** Not Started
**File:** [phase-5-stabilize.md](./phase-5-stabilize.md)

Dogfood with flag ON, fix bugs, performance test.

**Deliverables:**
- Bug fixes
- Performance optimizations
- Edge case handling

---

### Phase 6: Remove Old Code (Week 3-4)
**Status:** Not Started
**File:** [phase-6-remove-old-code.md](./phase-6-remove-old-code.md)

Make hybrid editor default, delete MarkdownEditor/EditableMarkdownViewer, remove CodeMirror.

**Deliverables:**
- Old components deleted
- CodeMirror dependencies removed
- Feature flag made default

---

### Phase 7: Cleanup & Polish (Week 4)
**Status:** Not Started
**File:** [phase-7-cleanup.md](./phase-7-cleanup.md)

Remove demo code, update docs, bundle analysis.

**Deliverables:**
- Documentation updated
- Demo code removed
- Bundle size analysis

---

## Current Architecture

### What's Being Replaced

**MarkdownEditor.tsx** (`src/shared/components/editor/MarkdownEditor.tsx`)
- CodeMirror 6 integration
- ~400 lines of state management
- Syntax highlighting, search, commands

**EditableMarkdownViewer.tsx** (`src/features/workstation/components/EditableMarkdownViewer.tsx`)
- Three-mode viewer (preview/source/edit)
- ~1000 lines including links, backlinks, metadata
- Auto-save, search, file watching

### New Architecture

```
HybridMarkdownEditor
├── BlockParser (splits markdown on \n\n)
├── MarkdownBlock[] (each toggles preview ↔ edit)
│   ├── Preview: ReactMarkdown + Chakra
│   └── Edit: TextareaAutosize
└── GlassCodeBlock (frosted glass code fences)
```

**Integration:**
```
HybridEditorWithFeatures (adapter)
├── HybridMarkdownEditor (core)
├── useAutoSave hook
├── useFileWatcher hook
├── SearchInMarkdown component
└── BacklinksPanel component
```

## Success Metrics

- [ ] Bundle size reduced by >50KB
- [ ] First render <100ms for typical kit file
- [ ] Edit mode transition <50ms
- [ ] Zero markdown syntax corruption bugs
- [ ] All existing features work (auto-save, search, links, backlinks)
- [ ] Works in light and dark mode
- [ ] Glassmorphic styling matches design system

## Dependencies

### New (Added)
- `react-textarea-autosize` - Auto-growing textareas

### Existing (Kept)
- `react-markdown` - Preview rendering
- `remark-gfm` - GitHub Flavored Markdown
- `@chakra-ui/react` - Component library
- `shiki` - Code syntax highlighting

### Removed (Phase 6)
- `@codemirror/state`
- `@codemirror/view`
- `@codemirror/commands`
- `@codemirror/lang-markdown`
- `@codemirror/language-data`
- `@codemirror/search`

## Rollback Strategy

### Quick Rollback (Any phase before Phase 6)
1. Toggle `useHybridEditor` flag to `false`
2. Old editor immediately active
3. Fix bug, toggle back ON

### Full Rollback (After Phase 6)
1. `git revert` deletion commits
2. `npm install` to restore CodeMirror
3. Re-add feature flag infrastructure
4. Default to OFF while debugging

## Key Decisions

### Title Handling
- **Decision**: Title separate from markdown content
- **Rationale**: No H1 syncing hacks, cleaner separation of concerns
- **Implementation**: Note creation modal captures title + content separately

### Block Splitting
- **Decision**: Split on `\n\n` (double newline)
- **Rationale**: Simple, works for most markdown, predictable
- **Edge Cases**: Code blocks with `\n\n` must be handled specially

### Edit Mode Activation
- **Decision**: Single click enters edit mode
- **Rationale**: Faster than double-click, matches modern editors (Notion, Craft)
- **Accessibility**: Enter key also activates edit mode for keyboard users

### Preview Styling
- **Decision**: Glassmorphic code blocks, standard text rendering
- **Rationale**: Matches existing design system, premium feel
- **Implementation**: Use exact tokens from `theme.ts`

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Build in Parallel | 3-5 days | None |
| Phase 2: Integration Adapter | 2-3 days | Phase 1 |
| Phase 3: Feature Flag | 1 day | Phase 2 |
| Phase 4: Migrate Pages | 1-2 days | Phase 3 |
| Phase 5: Stabilize | 3-5 days | Phase 4 |
| Phase 6: Remove Old Code | 1 day | Phase 5 |
| Phase 7: Cleanup | 0.5 days | Phase 6 |
| **Total** | **11.5-16.5 days** | |

## Next Steps

1. Review this plan with stakeholders
2. Create feature branch: `feature/hybrid-markdown-editor`
3. Begin Phase 1: Build in Parallel
4. Daily progress updates in this README

---

**Last Updated:** 2026-02-06
**Current Phase:** Planning
**Branch:** TBD
