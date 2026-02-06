# Hybrid Glassmorphic Markdown Editor - Implementation Plan

> **Status:** Planning Complete - Ready for Implementati
>
> **See:** [README.md](./README.md) for high-level overview and phase links

## Executive Summary

This plan outlines the complete rebuild of BlueKit's markdown editing system using a hybrid block-based approach inspired by the `hybrid-glassmorphic-markdown-editor` kit. The goal is to create a seamless editing experience where users can click individual content blocks to edit them inline, while maintaining glassmorphic preview styling and all existing features.

## Key Clarifications

- **No mode separation**: Preview styling persists while editing (hybrid approach)
- **Title separate from content**: No H1 syncing hacks, title handled via creation modal
- **Zero backend changes**: Pure frontend implementation using existing IPC
- **No complex additions**: No new backlinks logic, use existing features
- **Glassmorphic preview**: Maintain frosted glass aesthetic throughout

## Current State Analysis

### Existing Components

1. **MarkdownEditor.tsx** (CodeMirror-based)

   - Location: `src/shared/components/editor/MarkdownEditor.tsx`
   - Full-featured code editor with syntax highlighting
   - ~400 lines of complex state management
   - Heavy dependency: CodeMirror 6 with multiple extensions
   - Used in: NoteViewPage, EditableMarkdownViewer

2. **EditableMarkdownViewer.tsx**

   - Location: `src/features/workstation/components/EditableMarkdownViewer.tsx`
   - Three-mode viewer: preview/source/edit
   - ~1000 lines including links, backlinks, metadata display
   - Integrations: auto-save, search, file watching, navigation
   - Used in: ResourceViewPage for kits/walkthroughs

3. **NoteViewPage.tsx**
   - Location: `src/pages/NoteViewPage.tsx`
   - Simpler notebook-focused viewer
   - H1-based file renaming
   - Sibling file navigation
   - Used in: Notebook tree navigation

### Integration Points to Preserve

```
Current Markdown System
├── Auto-save (useAutoSave hook)
├── Search (SearchInMarkdown component)
├── File watching (Tauri events)
├── Link resolution (internal .md links)
├── Backlinks (bidirectional linking)
├── Code highlighting (ShikiCodeBlock)
├── Mermaid diagrams (InlineMermaidDiagram)
├── Front matter parsing
├── View mode switching (preview/source/edit)
├── Keyboard shortcuts (Cmd+S, Cmd+F)
├── Scroll position preservation
└── H1 title renaming
```

## Proposed Architecture

### Component Hierarchy

```
HybridMarkdownEditor (new root component)
├── HybridEditorHeader (metadata, mode switcher)
├── HybridEditorContent (main editing area)
│   ├── MarkdownBlock (repeating, one per content block)
│   │   ├── BlockPreview (ReactMarkdown + Chakra)
│   │   └── BlockEditor (TextareaAutosize)
│   └── GlassCodeBlock (specialized code fence renderer)
└── HybridEditorFooter (links, backlinks, status)
```

### New Components to Build

1. **HybridMarkdownEditor** - Main entry point

   - Props: `value: string`, `onChange: (value: string) => void`, `resource: ResourceFile`
   - Manages block state and parsing
   - Handles save coordination
   - Preserves all current integration points

2. **MarkdownBlock** - Smart block component

   - State: `isEditing: boolean`
   - Detects click → switches to edit mode
   - Blur/Enter → switches back to preview
   - Typography matching between modes (line-height: 1.75)

3. **BlockParser** - Utility module

   - Splits markdown by `\n\n` into blocks
   - Identifies block types (h1, h2, p, code, list)
   - Reconstructs markdown from block array

4. **GlassCodeBlock** - Glassmorphic code renderer
   - Uses exact token values from theme.ts
   - `backdrop-filter: blur(24px) saturate(180%)`
   - Integrates with existing ShikiCodeBlock

## Implementation Strategy

### Phase 1: Build in Isolation (2-3 days)

**Goal:** Create the hybrid editor as a standalone component without touching existing code.

**Training Ground Strategy:**
The `src/pages/HybridEditorDemo.tsx` page will serve as the exclusive training ground for this phase. All styling, interaction polish, and feature development must be perfected here first. We will port over styling from the main app to this page to ensure we are testing against a realistic environment before validating the implementation.

1. Create new directory: `src/shared/components/hybridEditor/`
2. Implement core components:
   ```
   src/shared/components/hybridEditor/
   ├── HybridMarkdownEditor.tsx
   ├── MarkdownBlock.tsx
   ├── BlockParser.ts
   ├── GlassCodeBlock.tsx
   └── index.ts
   ```
3. Build demo page: `src/pages/HybridEditorDemo.tsx` (The "Training Ground")
4. Test in isolation with sample markdown files
5. Verify:
   - Block splitting/reconstruction accuracy
   - Edit mode transitions are smooth
   - Typography matches between preview/edit
   - Glassmorphic styling works in light/dark mode

**Acceptance Criteria:**

- [ ] Click paragraph → textarea appears
- [ ] Click away → markdown renders
- [ ] Code blocks have frosted glass effect
- [ ] H1/H2 render with correct sizes
- [ ] Content preservation: no markdown syntax loss
- [ ] Dark mode toggle works correctly

### Phase 2: Integration Layer (1-2 days)

**Goal:** Create adapter components that bridge the hybrid editor to existing features.

1. Create integration wrappers:
   ```
   src/shared/components/hybridEditor/
   ├── HybridEditorWithAutoSave.tsx
   ├── HybridEditorWithSearch.tsx
   └── HybridEditorWithLinks.tsx
   ```
2. Wire up existing hooks:
   - `useAutoSave` for save functionality
   - `useWorkstation` for search state
   - `useProjectArtifacts` for backlinks
3. Test integrations individually
4. Verify no regressions in existing features

**Acceptance Criteria:**

- [ ] Auto-save triggers on content change (1.5s delay)
- [ ] Cmd+S saves immediately
- [ ] Cmd+F opens search
- [ ] Internal links navigate correctly
- [ ] Backlinks display and function
- [ ] File watching updates content

### Phase 3: Parallel Deployment (1 day)

**Goal:** Run both editors side-by-side for A/B comparison.

1. Add feature flag: `ENABLE_HYBRID_EDITOR`
2. Create toggle in UI settings
3. Modify NoteViewPage to conditionally render:
   ```tsx
   {ENABLE_HYBRID_EDITOR ? (
     <HybridMarkdownEditor ... />
   ) : (
     <MarkdownEditor ... />
   )}
   ```
4. Extensive testing with real BlueKit content
5. Gather feedback on UX differences

**Acceptance Criteria:**

- [ ] Both editors work without conflicts
- [ ] Feature flag toggle is reliable
- [ ] All features work in both modes
- [ ] Performance is comparable or better

### Phase 4: Migration (1 day)

**Goal:** Replace CodeMirror editor with hybrid editor as default.

1. Update `NoteViewPage.tsx` to use HybridMarkdownEditor
2. Update `EditableMarkdownViewer.tsx` to use HybridMarkdownEditor
3. Mark `MarkdownEditor.tsx` as deprecated (add comment)
4. Update tests to use new component
5. Update documentation in CLAUDE.md

**Acceptance Criteria:**

- [ ] All pages use HybridMarkdownEditor
- [ ] No console errors or warnings
- [ ] All tests pass
- [ ] Documentation updated

### Phase 5: Cleanup (0.5 days)

**Goal:** Remove old code and dependencies.

1. Delete or archive `MarkdownEditor.tsx`
2. Remove CodeMirror dependencies from package.json:
   ```
   @codemirror/state
   @codemirror/view
   @codemirror/commands
   @codemirror/lang-markdown
   @codemirror/language-data
   @codemirror/search
   ```
3. Add new dependencies:
   ```
   react-textarea-autosize (if not already present)
   ```
4. Run bundle size analysis
5. Update CHANGELOG.md

**Acceptance Criteria:**

- [ ] Bundle size reduced (estimated 50-100KB savings)
- [ ] No unused dependencies remain
- [ ] Clean build with no warnings
- [ ] Git history preserved

## Rollback Strategy

If critical issues arise, we can roll back in two ways:

### Quick Rollback (5 minutes)

1. Toggle feature flag: `ENABLE_HYBRID_EDITOR = false`
2. Revert to CodeMirror editor immediately
3. File bug report for issues found

### Full Rollback (30 minutes)

1. Revert Git commits from Phase 4 and 5
2. Restore CodeMirror dependencies
3. Rebuild and test
4. Keep hybrid editor code for future refinement

## Risk Mitigation

### Technical Risks

1. **Block Parsing Accuracy**

   - Risk: Complex markdown (nested lists, tables) may not split correctly
   - Mitigation: Extensive test suite with edge cases
   - Fallback: Add "raw edit" mode for complex documents

2. **Performance with Large Files**

   - Risk: Many blocks (>100) may cause render lag
   - Mitigation: Virtual scrolling or lazy rendering
   - Fallback: Auto-switch to CodeMirror for files >10KB

3. **Keyboard Shortcut Conflicts**
   - Risk: New editor may not capture all shortcuts
   - Mitigation: Comprehensive keyboard shortcut testing
   - Fallback: Global keyboard handler at page level

### UX Risks

1. **User Confusion**

   - Risk: Block-based editing is unfamiliar
   - Mitigation: Add tooltips/onboarding hints
   - Fallback: Keep feature flag for opt-in

2. **Feature Parity**
   - Risk: Missing advanced CodeMirror features (search/replace, multi-cursor)
   - Mitigation: Document feature differences
   - Fallback: Offer "power user" mode with CodeMirror

## Success Metrics

### Performance

- [ ] First render < 100ms for typical kit file
- [ ] Edit mode transition < 50ms
- [ ] Bundle size reduction > 50KB
- [ ] Memory usage comparable or lower

### UX

- [ ] Zero markdown syntax corruption bugs
- [ ] Smooth animations (no layout shift)
- [ ] Glassmorphic styling matches design system
- [ ] All keyboard shortcuts work

### Compatibility

- [ ] Works with all existing kits/walkthroughs
- [ ] File watching triggers updates correctly
- [ ] Auto-save preserves cursor position
- [ ] Links/backlinks function identically

## Dependencies

### New NPM Packages

- `react-textarea-autosize` - Auto-growing textareas for edit mode

### Existing Dependencies (to keep)

- `react-markdown` - Preview rendering
- `remark-gfm` - GitHub Flavored Markdown support
- `@chakra-ui/react` - Component library
- `shiki` - Code syntax highlighting

### Dependencies to Remove (Phase 6)

- `@codemirror/*` - Full CodeMirror 6 suite

## Implementation Phases

This plan is organized into 7 phases, each documented in detail:

1. **[Phase 1: Build in Parallel](./phase-1-build-in-parallel.md)** (3-5 days)

   - Build hybrid editor components in isolation
   - No changes to existing code
   - Test with demo page

2. **[Phase 2: Integration Adapter](./phase-2-integration-adapter.md)** (2-3 days)

   - Wire up existing features (auto-save, file watching)
   - Create adapter component
   - Preserve all functionality

3. **[Phase 3: Feature Flag](./phase-3-feature-flag.md)** (1 day)

   - Add toggle for A/B testing
   - Deploy both editors side-by-side
   - Enable safe rollback

4. **[Phase 4: Migrate Pages](./phase-4-migrate-pages.md)** (1-2 days)

   - Replace editor in each page one-by-one
   - Behind feature flag for safety
   - Maintain feature parity

5. **[Phase 5: Stabilize](./phase-5-stabilize.md)** (3-5 days)

   - Dogfood with flag ON
   - Fix bugs, optimize performance
   - Gather feedback

6. **[Phase 6: Remove Old Code](./phase-6-remove-old-code.md)** (1 day)

   - Make hybrid editor default
   - Delete old components
   - Remove CodeMirror dependencies

7. **[Phase 7: Cleanup & Polish](./phase-7-cleanup.md)** (0.5 days)
   - Remove demo code
   - Final documentation
   - Release notes

## Timeline Estimate

| Phase                        | Duration           | Dependencies     |
| ---------------------------- | ------------------ | ---------------- |
| Phase 1: Build in Parallel   | 3-5 days           | None             |
| Phase 2: Integration Adapter | 2-3 days           | Phase 1 complete |
| Phase 3: Feature Flag        | 1 day              | Phase 2 complete |
| Phase 4: Migrate Pages       | 1-2 days           | Phase 3 complete |
| Phase 5: Stabilize           | 3-5 days           | Phase 4 complete |
| Phase 6: Remove Old Code     | 1 day              | Phase 5 stable   |
| Phase 7: Cleanup & Polish    | 0.5 days           | Phase 6 complete |
| **Total**                    | **11.5-16.5 days** |                  |

## Key Decisions (Resolved)

1. **Block Splitting Algorithm**: Split on `\n\n` with special handling for code blocks
2. **Edit Mode Activation**: Single click to enter edit mode (faster UX)
3. **Toolbar/Actions**: No toolbar, keep minimal (markdown syntax only)
4. **Mobile Support**: Deferred to post-launch (desktop-first)
5. **Title Handling**: Separate from content, no H1 syncing

## Next Steps

1. ✅ Review plan with stakeholders
2. ✅ Answer open questions
3. → Begin Phase 1: Build in Parallel
4. → Create feature branch: `feature/hybrid-markdown-editor`
