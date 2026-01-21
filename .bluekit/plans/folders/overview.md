---
id: folders-system-reimplement
alias: "Folders → Groups System Reimplementation"
type: plan
tags: [folders, groups, config, animations, ux]
description: "Complete reimplementation of folder system with config.json support and beautiful animations"
status: active
---

# Folders → Groups System Reimplementation

## Executive Summary
Reimplementing the folder system for Kits, Walkthroughs, and Diagrams to:
1. Support rich metadata (description, tags) via `config.json`
2. Add beautiful animations matching Plans quality
3. Rename "Folders" to "Groups" in UI (user-facing terminology)
4. Maintain backward compatibility with existing folders

## Current State (Problems)

### Backend
- `create_artifact_folder()` ignores `config` parameter
- `get_artifact_folders()` never reads `config.json`
- `ArtifactFolder.config` always returns `None`
- Comments say config is "deprecated" but it's not - it was never implemented

### Frontend
- Folder creation only collects name (no description/tags)
- Folders appear as plain directory cards
- No animations (static grid)
- Terminology inconsistent with user mental model

### UX Gap
PlansTabContent has beautiful glass morphism cards with smooth animations, but Kits/Walkthroughs have static basic folder cards. Quality disparity is noticeable.

## Desired End State

### Backend
- ✅ Reads `config.json` when loading folders
- ✅ Writes `config.json` when creating folders
- ✅ Updates `config.json` when renaming folders
- ✅ Gracefully handles folders without config (backward compatible)

### Frontend
- ✅ Folder creation dialog collects: name, description, tags
- ✅ Folder cards display: name, description, tags, artifact count
- ✅ Smooth entrance animations (staggered by index)
- ✅ Glass morphism styling matching Plans
- ✅ Hover effects (lift + shadow)
- ✅ Renamed to "Groups" throughout UI

### File Structure
```
.bluekit/
  kits/
    ui-components/           # Group directory
      config.json           # Group metadata
      button.md             # Kit file
      card.md               # Kit file
    database-patterns/
      config.json
      connection-pool.md
  walkthroughs/
    setup-guides/
      config.json
      initial-setup.md
```

### Config.json Format
```json
{
  "id": "ui-components-1737504920123",
  "name": "UI Components",
  "description": "Reusable React components for the design system",
  "tags": ["react", "ui", "components"],
  "createdAt": "2025-01-21T12:34:56.789Z",
  "updatedAt": "2025-01-21T12:34:56.789Z"
}
```

## Implementation Phases

### Phase 1: Backend Config.json Support
**Duration:** 1-2 days
**Files:** `src-tauri/src/commands.rs`

**Key Changes:**
- Update `get_artifact_folders()` to read config.json
- Update `create_artifact_folder()` to write config.json
- Implement `update_folder_config()` (undeprecate)
- Update `rename_artifact_folder()` to update config.name

**Deliverable:** Backend reads/writes config.json, folders without config still work

[See phase-1-backend-config.md](./phase-1-backend-config.md)

### Phase 2: Frontend Folder Creation UI
**Duration:** 1 day
**Files:** `CreateFolderPopover.tsx`, `folders.ts`, `types.ts`

**Key Changes:**
- Add description and tags fields to creation dialog
- Generate full FolderConfig with timestamps
- Update IPC documentation (remove "ignored" warnings)
- Pass config to backend

**Deliverable:** Users can add description/tags when creating folders

[See phase-2-frontend-creation-ui.md](./phase-2-frontend-creation-ui.md)

### Phase 3: Animations & Beautiful UX
**Duration:** 1-2 days
**Files:** `SimpleFolderCard.tsx`, `KitsTabContent.tsx`, `WalkthroughsTabContent.tsx`, `ResourceCard.tsx`

**Key Changes:**
- Add framer-motion animations (entrance, exit, hover)
- Glass morphism styling matching Plans
- Staggered entrance (50ms per card)
- AnimatePresence for layout transitions

**Deliverable:** Folder cards animated and visually polished like Plans

[See phase-3-animations-ux.md](./phase-3-animations-ux.md)

### Phase 4: Rename Folders → Groups
**Duration:** 0.5 day
**Files:** All component files with "Folder" text

**Key Changes:**
- Replace "Folder" → "Group" in all UI strings
- Update button labels, headings, toasts
- Keep backend terminology unchanged
- Update documentation

**Deliverable:** User-facing terminology is "Groups" everywhere

[See phase-4-rename-to-groups.md](./phase-4-rename-to-groups.md)

### Phase 5: Testing & Polish
**Duration:** 2-3 days
**Files:** All modified files + tests

**Key Changes:**
- Comprehensive integration testing
- Edge case handling
- Performance validation
- Accessibility audit
- Documentation updates

**Deliverable:** Production-ready feature with <0.1% error rate

[See phase-5-testing-polish.md](./phase-5-testing-polish.md)

## Total Timeline
**Estimated:** 6-8 days
- Phase 1: 1-2 days
- Phase 2: 1 day
- Phase 3: 1-2 days
- Phase 4: 0.5 day
- Phase 5: 2-3 days

## Dependencies

```
Phase 1 (Backend)
    ↓
Phase 2 (Frontend Creation)
    ↓
Phase 3 (Animations)
    ↓
Phase 4 (Rename)
    ↓
Phase 5 (Testing)
```

Each phase can start once previous completes. No parallelization.

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Corrupt JSON crashes app | High | Low | Graceful parsing with try-catch, fallback to folder name |
| File watcher doesn't detect config.json | Medium | Medium | Add "config.json" to watcher patterns, test thoroughly |
| Performance with 100+ folders | Medium | Low | Config files are tiny (~200 bytes), acceptable overhead |
| Breaking change for existing users | High | Low | Backward compatible: folders without config still work |
| Animation jank on slow devices | Low | Medium | Respect prefers-reduced-motion, 60fps target |

## Success Criteria

### Functional
- ✅ Config.json read/written correctly
- ✅ Folders without config work (backward compatible)
- ✅ Animations smooth (60fps)
- ✅ File watcher updates in real-time

### Quality
- ✅ Zero console errors
- ✅ <0.1% error rate
- ✅ WCAG AA accessibility compliance
- ✅ Performance: <500ms load time for 50 folders

### UX
- ✅ Feels polished and professional
- ✅ Matches Plans quality
- ✅ Consistent terminology ("Groups")
- ✅ Intuitive workflow

## Acceptance Testing

Before marking complete:
1. Create group with all metadata → verify config.json
2. Create group with name only → verify minimal config
3. Load existing folder without config → works
4. Rename group → config.name updates
5. Delete group → directory and config removed
6. Animations smooth and polished
7. All UI says "Groups" not "Folders"
8. No console errors/warnings
9. Accessibility audit passes
10. Performance benchmarks met

## Rollback Plan

If critical issues arise:
1. **Immediate:** Revert UI changes (Phase 4 - rename)
2. **Within 24h:** Revert animations (Phase 3)
3. **Keep:** Backend changes (Phase 1) - backward compatible

Config.json is additive - existing folders without config continue to work.

## Future Enhancements (Out of Scope)

- Drag & drop artifacts between groups
- Group color coding
- Custom icons per group
- Nested groups (requires architecture change)
- Group permissions
- Bulk operations
- Group templates

## References

### Design Reference
- `PlansTabContent.tsx` - Animation timing and glass morphism
- Chakra UI v3 - Component patterns
- Framer Motion - Animation library

### Code Patterns
- IPC timeout: `src/utils/ipcTimeout.ts`
- File watching: `src-tauri/src/watcher.rs`
- Context API: `src/contexts/SelectionContext.tsx`

## Notes

### Why "Groups" not "Folders"?
- More semantic for organizing related items
- Less technical (folder = file system)
- Matches user mental model of collections
- Differentiates from OS file folders

### Why config.json not Database?
- File-based storage aligns with BlueKit philosophy
- Config lives with artifacts (portable)
- Version controlled with code
- No migration needed for existing projects

### Why Glass Morphism?
- Modern, polished aesthetic
- Matches Plans design language
- Differentiates from basic cards
- Depth perception (hover lift)

## Stakeholders

- **Product:** Confirm "Groups" terminology
- **Design:** Review glass morphism styling
- **Engineering:** Code review each phase
- **QA:** Test Phase 5 checklist

## Documentation Updates

Files to update after completion:
- `CLAUDE.md` - Architecture notes
- `product.md` - Features list
- README (if public) - User-facing features
- JSDoc comments - API documentation
