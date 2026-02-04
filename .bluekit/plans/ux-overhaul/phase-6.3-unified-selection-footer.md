# Phase 6.3: Unified Selection Footer with Spotlight Popover

**Status**: Planning
**Dependencies**: Phase 6.2 (Tasks Section Refinement)
**Scope**: Unify selection footer pattern across Library and FolderView components with spotlight popover flow

## Problem Statement

Currently, we have two different selection footer patterns:

1. **LibrarySelectionBar** (`src/features/library/components/LibrarySelectionBar.tsx`):
   - Sophisticated spotlight popover flow for actions
   - Beautiful glassmorphic styling with blur backdrop
   - Position modes (fixed/absolute)
   - Ref-based blur state management to prevent flicker
   - SelectorPopover components for "Add to Collection" and "Pull to Project"

2. **TasksSelectionFooter** (`src/features/tasks/components/TasksSelectionFooter.tsx`):
   - Simple sticky footer with grid collapse animation
   - Basic action buttons
   - Less sophisticated styling

3. **FolderView** (`src/shared/components/FolderView.tsx`):
   - Currently has NO selection footer
   - Needs similar functionality to LibrarySelectionBar

**Goal**: Create one unified component that can handle all selection footer use cases while maintaining split logic (separate state) and applying the LibrarySelectionBar's spotlight popover pattern everywhere.

---

## Design Principles

### 1. Component Unification
- **One component** to rule them all: `SelectionBar` base component
- **Split logic**: Each consumer (Library, FolderView, Tasks) manages its own state
- **Configurable actions**: Actions passed as render props or config objects
- **Visual consistency**: All selection footers use same glassmorphic styling

### 2. Spotlight Popover Pattern
The spotlight effect (from LibrarySelectionBar lines 182-206) creates visual focus:
- Backdrop blur when popover opens
- Z-index layering: backdrop (1300) → bar (1400) → popover (1500)
- Ref-based state tracking prevents flicker during rapid transitions
- Click-through backdrop closes popover

This pattern should be available to all selection footers.

### 3. Positioning Modes
Support both modes from LibrarySelectionBar:
- **Fixed**: Bottom of screen (global actions)
- **Absolute**: Within container (modal footers, sticky sections)

---

## Implementation Plan

### Step 1: Create Base SelectionBar Component

**File**: `src/shared/components/SelectionBar.tsx`

**Props Interface**:
```typescript
interface SelectionBarAction {
  id: string;
  type: 'button' | 'popover' | 'separator';

  // Button config
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: string;
  colorPalette?: string;
  disabled?: boolean;

  // Popover config
  popover?: {
    trigger: React.ReactNode;
    content: React.ReactNode;
    onOpenChange?: (isOpen: boolean) => void;
  };
}

interface SelectionBarProps {
  isOpen: boolean;
  selectionCount: number;
  selectionSummary: React.ReactNode; // Custom summary render
  actions: SelectionBarAction[];

  // Position config
  position?: 'fixed' | 'absolute';
  bottomOffset?: string;

  // Loading state
  isLoading?: boolean;
}
```

**Core Features**:
- Glassmorphic styling (extracted from LibrarySelectionBar lines 218-235)
- Backdrop blur management (lines 182-206)
- Ref-based popover state tracking (lines 104-162)
- Configurable action buttons/separators (lines 277-366)
- Position mode switching (lines 165-177)

**Animation**:
- Slide up from bottom with opacity fade
- Smooth transitions (300ms cubic-bezier)

---

### Step 2: Extract Spotlight Popover Logic

**File**: `src/shared/components/SpotlightPopover.tsx`

**Purpose**: Reusable popover with backdrop blur effect

**Props**:
```typescript
interface SpotlightPopoverProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode; // Popover content
  placement?: 'top' | 'bottom' | 'left' | 'right';
  gutter?: number;

  // Z-index config (for layering with selection bar)
  zIndex?: {
    backdrop: number;
    popover: number;
  };
}
```

**Behavior**:
- Manages blur backdrop visibility
- Handles click-outside to close
- Uses refs to prevent state flicker
- Renders backdrop in Portal
- Coordinates with parent SelectionBar z-index

---

### Step 3: Refactor LibrarySelectionBar

**File**: `src/features/library/components/LibrarySelectionBar.tsx`

**Changes**:
1. Wrap with new `SelectionBar` base component
2. Use `SpotlightPopover` for "Add to Collection" and "Pull to Project"
3. Build selection summary from variations (keep existing logic lines 75-99)
4. Define actions array:

```typescript
const actions: SelectionBarAction[] = [
  {
    id: 'remove',
    type: 'button',
    label: 'Remove',
    icon: <LuTrash2 />,
    onClick: onRemoveFromCollection,
    variant: 'subtle',
    colorPalette: 'red',
  },
  { id: 'sep1', type: 'separator' },
  {
    id: 'clear',
    type: 'button',
    label: 'Clear',
    icon: <LuX />,
    onClick: onClearSelection,
    variant: 'surface',
    colorPalette: 'gray',
  },
  { id: 'sep2', type: 'separator' },
  {
    id: 'add-collection',
    type: 'popover',
    popover: {
      trigger: <Button>Add</Button>,
      content: <SelectorPopover {...} />,
      onOpenChange: handleAddPopoverChange,
    },
  },
  { id: 'sep3', type: 'separator' },
  {
    id: 'pull',
    type: 'popover',
    popover: {
      trigger: <Button>Pull</Button>,
      content: <PullButton {...} />,
      onOpenChange: handlePullPopoverChange,
    },
  },
];
```

5. Remove internal blur backdrop logic (now in SelectionBar)
6. Keep all domain-specific logic (variation summaries, collection operations)

**Result**: ~50% less code, reusable foundation

---

### Step 4: Create FolderViewSelectionBar

**File**: `src/features/library/components/FolderViewSelectionBar.tsx`
(Could also be `src/shared/components/FolderViewSelectionBar.tsx` if more generic)

**Purpose**: Selection footer for artifact files in FolderView

**Props**:
```typescript
interface FolderViewSelectionBarProps {
  isOpen: boolean;
  selectedArtifacts: ArtifactFile[]; // From FolderView
  onClearSelection: () => void;
  onDeleteArtifacts?: () => void;
  onAddToProject?: (projects: Project[]) => void;
  onPullToProject?: (projects: Project[]) => void;
  projects: Project[];
  position?: 'fixed' | 'absolute';
}
```

**Selection Summary**:
Build summary from artifact types (similar to LibrarySelectionBar lines 75-99):
- Count by artifact type (kit, walkthrough, agent, diagram)
- Show icons for each type
- Example: "3 kits • 2 walkthroughs selected"

**Actions**:
```typescript
const actions: SelectionBarAction[] = [
  {
    id: 'delete',
    type: 'button',
    label: 'Delete',
    icon: <LuTrash2 />,
    onClick: onDeleteArtifacts,
    variant: 'subtle',
    colorPalette: 'red',
  },
  { id: 'sep1', type: 'separator' },
  {
    id: 'clear',
    type: 'button',
    label: 'Clear',
    icon: <LuX />,
    onClick: onClearSelection,
    variant: 'surface',
    colorPalette: 'gray',
  },
  { id: 'sep2', type: 'separator' },
  {
    id: 'add-to-project',
    type: 'popover',
    popover: {
      trigger: <Button>Add to Project</Button>,
      content: <ProjectSelectorPopover />, // New component
      onOpenChange: handleAddPopoverChange,
    },
  },
  { id: 'sep3', type: 'separator' },
  {
    id: 'pull-to-project',
    type: 'popover',
    popover: {
      trigger: <Button>Pull to Project</Button>,
      content: <ProjectSelectorPopover mode="pull" />,
      onOpenChange: handlePullPopoverChange,
    },
  },
];
```

**New Component Needed**: `ProjectSelectorPopover`
- Similar to `SelectorPopover` but for Project selection
- Two modes: "add" (copy to project) vs "pull" (link/import)
- Multi-select projects
- Confirm button triggers action with selected projects

---

### Step 5: Integrate FolderViewSelectionBar into FolderView

**File**: `src/shared/components/FolderView.tsx`

**Changes**:
1. Import `FolderViewSelectionBar`
2. Add selection state tracking (already exists via `selectedIds` prop)
3. Add action handlers:
   - `handleDeleteArtifacts`: Delete selected files from disk
   - `handleAddToProject`: Copy files to project(s)
   - `handlePullToProject`: Create symbolic links or import references

4. Render selection bar:
```tsx
<Box width="100%" h="100%" position="relative">
  {/* Existing content */}
  <Box width="100%" h="100%" overflowY="auto" pb={20}>
    {/* Header */}
    {/* Artifact list */}
  </Box>

  {/* Selection footer - absolute positioned within container */}
  <FolderViewSelectionBar
    isOpen={selectedIds.size > 0}
    selectedArtifacts={artifacts.filter(a => selectedIds.has(a.path))}
    onClearSelection={() => onSelectionChange(new Set())}
    onDeleteArtifacts={handleDeleteArtifacts}
    onAddToProject={handleAddToProject}
    onPullToProject={handlePullToProject}
    projects={projects}
    position="absolute"
  />
</Box>
```

5. Update padding/overflow to prevent content from being hidden behind footer

---

### Step 6: Refactor TasksSelectionFooter (Optional Enhancement)

**File**: `src/features/tasks/components/TasksSelectionFooter.tsx`

**Changes**:
1. Replace with `SelectionBar` base component
2. Keep task-specific actions (Complete, Delete, Clear)
3. Apply glassmorphic styling for visual consistency
4. Consider spotlight popover for future task operations

**Actions**:
```typescript
const actions: SelectionBarAction[] = [
  {
    id: 'complete',
    type: 'button',
    label: 'Complete',
    icon: <LuCheck />,
    onClick: handleComplete,
    variant: 'ghost',
    colorPalette: 'green',
  },
  {
    id: 'delete',
    type: 'button',
    label: 'Delete',
    icon: <LuTrash2 />,
    onClick: handleDelete,
    variant: 'ghost',
    colorPalette: 'red',
  },
  {
    id: 'clear',
    type: 'button',
    label: 'Clear',
    icon: <LuX />,
    onClick: onClearSelection,
    variant: 'ghost',
    colorPalette: 'gray',
  },
];
```

**Result**: All three selection footers share same visual language and behavior patterns

---

## Visual Design Specifications

### Glassmorphic Styling (from LibrarySelectionBar)
```css
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(0, 0, 0, 0.08);
box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);

/* Dark mode */
background: rgba(30, 30, 30, 0.85);
border-color: rgba(255, 255, 255, 0.15);
box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
```

### Backdrop Blur (when popover open)
```css
backdrop-filter: blur(8px) saturate(120%);
-webkit-backdrop-filter: blur(8px) saturate(120%);
background: rgba(0, 0, 0, 0.2);

/* Dark mode */
background: rgba(0, 0, 0, 0.4);
```

### Z-Index Layering
- Backdrop: 1300
- Selection Bar: 1400
- Popover: 1500
- Spotlight Clone: 1401 (if needed for visual spotlight effect)

### Animations
- Slide up: `transform: translateY(100%)` → `translateY(0)`
- Fade in: `opacity: 0` → `opacity: 1`
- Timing: 300ms cubic-bezier(0.4, 0, 0.2, 1)

---

## Testing Checklist

### Unit Tests
- [ ] SelectionBar renders with different action configs
- [ ] SpotlightPopover manages blur state correctly
- [ ] Ref-based state tracking prevents flicker
- [ ] Position modes (fixed/absolute) work correctly

### Integration Tests
- [ ] LibrarySelectionBar maintains existing functionality
- [ ] FolderViewSelectionBar shows correct artifact summary
- [ ] TasksSelectionFooter works with new base component
- [ ] Spotlight popovers open/close correctly
- [ ] Backdrop clicks close popovers

### Visual Tests
- [ ] Glassmorphic styling matches design
- [ ] Blur backdrop appears/disappears smoothly
- [ ] Z-index layering correct (no flickering)
- [ ] Animations smooth (no jank)
- [ ] Dark mode styling correct
- [ ] Responsive layout (doesn't break on small screens)

### Accessibility
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces selection count
- [ ] Focus management when popover opens/closes
- [ ] ARIA labels on all interactive elements

---

## Implementation Order

1. **Day 1**: Create `SelectionBar` base component
   - Extract styling from LibrarySelectionBar
   - Build action renderer (buttons, separators)
   - Implement position modes
   - Test in isolation

2. **Day 2**: Create `SpotlightPopover` component
   - Extract blur backdrop logic
   - Implement ref-based state tracking
   - Add z-index coordination
   - Test with different placements

3. **Day 3**: Refactor LibrarySelectionBar
   - Replace internals with SelectionBar
   - Migrate actions to new config format
   - Verify existing functionality intact
   - Test spotlight popovers

4. **Day 4**: Create FolderViewSelectionBar
   - Build artifact summary logic
   - Create ProjectSelectorPopover component
   - Implement action handlers
   - Test in isolation

5. **Day 5**: Integrate into FolderView
   - Add selection bar to component
   - Implement delete/add/pull actions
   - Test full user flow
   - Fix layout issues (padding, overflow)

6. **Day 6** (Optional): Refactor TasksSelectionFooter
   - Migrate to SelectionBar base
   - Test existing task operations
   - Verify visual consistency

---

## Success Criteria

### Functional
- [x] All selection footers use unified component
- [x] Spotlight popover flow works in Library and FolderView
- [x] Separate state management per consumer
- [x] Actions configurable via props
- [x] Position modes work correctly

### Visual
- [x] Consistent glassmorphic styling across all footers
- [x] Smooth blur backdrop transitions
- [x] No visual flicker during popover state changes
- [x] Responsive layout on all screen sizes
- [x] Dark mode fully supported

### Code Quality
- [x] ~50% reduction in LibrarySelectionBar code
- [x] Reusable components (SelectionBar, SpotlightPopover)
- [x] Type-safe action configuration
- [x] No duplicate styling code
- [x] Clean separation of concerns

---

## Future Enhancements

1. **Animation Presets**: Pre-configured animation styles (slide, fade, scale)
2. **Tooltip Support**: Hover tooltips on action buttons
3. **Keyboard Shortcuts**: Quick actions via keyboard (Cmd+A for select all, etc.)
4. **Accessibility Improvements**: Focus trap, ARIA live regions
5. **Mobile Support**: Touch-friendly gestures, bottom sheet on mobile
6. **Customizable Themes**: Allow consumers to override colors/styles
7. **Action Groups**: Group related actions in dropdowns
8. **Undo/Redo**: Support undo for destructive actions

---

## Notes

- **Backwards Compatibility**: Existing LibrarySelectionBar consumers should not need changes
- **Performance**: Ref-based blur state prevents unnecessary re-renders
- **Flexibility**: Action config allows any combination of buttons/popovers/separators
- **Maintainability**: One source of truth for selection footer behavior
- **Consistency**: Users see same patterns everywhere (muscle memory)

This phase consolidates our selection footer UX into a cohesive, reusable system that maintains the polish of LibrarySelectionBar while extending it to new contexts.
