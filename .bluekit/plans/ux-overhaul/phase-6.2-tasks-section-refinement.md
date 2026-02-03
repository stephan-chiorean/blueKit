# Phase 6.2: Tasks Section Refinement

## Overview
Refactor TasksSection to follow the KitsSection pattern with improved UX for task management. This includes moving to modals for task creation/editing, implementing a dedicated selection footer, and reorganizing the UI for better usability.

## Goals
1. Align TasksSection UI with KitsSection patterns
2. Replace popovers with modals for task creation/editing
3. Implement dedicated selection footer for tasks
4. Move status field to top-level visibility
5. Improve quick add UX with right-aligned placement

## Current State
- Uses QuickTaskPopover for task creation (left-aligned)
- Edit via EditTaskDialog
- Status field hidden behind "more options"
- Generic TasksActionBar for selections
- Filter panel on left side

## Proposed Changes

### 1. Modal System
**Replace QuickTaskPopover with dedicated modals:**
- `CreateTaskDialog.tsx` - Modal for creating new tasks
  - Status field at the top (not hidden)
  - Similar structure to CreateWalkthroughDialog
  - Form layout like current QuickTaskPopover content
  - Fields: Title, Description, Status (top), Priority, Type, Complexity, Tags, Project Assignment

- Update `EditTaskDialog.tsx` - Ensure consistency
  - Status field at top level
  - Match CreateTaskDialog layout

### 2. Selection Footer
**Create dedicated TasksSelectionFooter:**
- Actions: Delete, Clear, Complete
- Replace generic TasksActionBar
- Similar to ResourceSelectionBar pattern
- Position: Fixed bottom, slides up when items selected
- Shows selected count and item types

### 3. Layout Structure
**Follow KitsSection pattern:**
```
┌─────────────────────────────────────┐
│ ToolkitHeader                       │
│  - Title: "Tasks"                   │
│  - Left: Filter Button (glass)      │
│  - Right: Add Task Button (icon)    │
└─────────────────────────────────────┘
│                                     │
│ Scrollable Content Area             │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ In Progress Section            │ │
│  │  - Heading + Count             │ │
│  │  - ElegantList (if table view) │ │
│  │  - Card Grid (if card view)    │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ Backlog Section                │ │
│  │  - Heading + Count             │ │
│  │  - ElegantList (if table view) │ │
│  │  - Card Grid (if card view)    │ │
│  └────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ TasksSelectionFooter (when selected)│
│  Delete | Clear | Complete          │
└─────────────────────────────────────┘
```

### 4. Filter Panel Position
- Filter button on left side of ToolkitHeader (glass styling)
- Panel opens below button (absolute positioning)
- Same pattern as WalkthroughsSection

### 5. View Mode Integration
- Keep card/table view switcher
- Position on right side of section headers
- Use LiquidViewModeSwitcher component

### 6. Drag-and-Drop Between Sections
**Enable dragging tasks between in-progress and backlog:**
- Inspired by NotebookTree.tsx drag-and-drop implementation
- Drag source: Any task card or table row
- Drop targets: In-progress section header/area, Backlog section header/area
- Actions:
  - Drag from backlog → drop on in-progress = Update status to `in_progress`
  - Drag from in-progress → drop on backlog = Update status to `backlog`
- Visual feedback:
  - Dragged task shows reduced opacity (0.5)
  - Drop zones highlight with blue border/background when valid
  - Drag tooltip follows cursor showing task title and target section
  - Invalid drops show red highlight
- Drag threshold: 5px movement required before drag activates (prevents accidental drags)
- Update task status via IPC on successful drop

**Drag State Interface:**
```typescript
interface DragState {
  draggedTask: Task;
  sourceSection: 'in_progress' | 'backlog';
  dropTargetSection: 'in_progress' | 'backlog' | null;
  isValidDrop: boolean;
  startPosition: { x: number; y: number };
}
```

**Drop Zone Strategy:**
- In-progress section header/container has `data-drop-zone="in_progress"`
- Backlog section header/container has `data-drop-zone="backlog"`
- Use `document.elementsFromPoint()` to find drop target at cursor position
- Highlight drop zone when hovering with valid drag

**Key Implementation Patterns from NotebookTree:**
```typescript
// 1. Drag threshold check (prevents accidental drags)
const DRAG_THRESHOLD = 5;
if (!hasDragThresholdMet) {
  const dx = Math.abs(e.clientX - dragState.startPosition.x);
  const dy = Math.abs(e.clientY - dragState.startPosition.y);
  if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
    setHasDragThresholdMet(true);
  }
  return; // Don't show drag UI until threshold met
}

// 2. Find drop target at cursor position
function findDropTargetAtPosition(x: number, y: number): 'in_progress' | 'backlog' | null {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    const dropZone = (el as HTMLElement).closest('[data-drop-zone]');
    if (dropZone) {
      return dropZone.getAttribute('data-drop-zone') as 'in_progress' | 'backlog';
    }
  }
  return null; // Not over a drop zone
}

// 3. Validate drop (can't drop on same section)
function isValidDrop(sourceSection: string, targetSection: string | null): boolean {
  if (!targetSection) return false;
  return sourceSection !== targetSection;
}

// 4. Document-level event handlers
useEffect(() => {
  if (!dragState) return;

  const handleMouseMove = (e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
    if (hasDragThresholdMet) {
      const target = findDropTargetAtPosition(e.clientX, e.clientY);
      const isValid = isValidDrop(dragState.sourceSection, target);
      setDragState(prev => prev ? { ...prev, dropTargetSection: target, isValidDrop: isValid } : null);
    }
  };

  const handleMouseUp = async () => {
    if (hasDragThresholdMet && dragState.isValidDrop && dragState.dropTargetSection) {
      await performStatusUpdate(dragState.draggedTask, dragState.dropTargetSection);
    }
    clearDragState();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') clearDragState();
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [dragState, hasDragThresholdMet]);
```

**Visual Feedback Implementation:**
```tsx
// Task card/row with drag handlers
<Card.Root
  opacity={isBeingDragged ? 0.5 : 1}
  cursor={dragState ? 'grabbing' : 'grab'}
  onMouseDown={(e) => handleDragStart(task, { x: e.clientX, y: e.clientY })}
  transition="opacity 0.15s"
>
  {/* Task content */}
</Card.Root>

// Drop zone styling
<Box
  data-drop-zone="in_progress"
  p={6}
  borderWidth={isDraggedOver ? "2px" : "1px"}
  borderStyle={isDraggedOver ? "dashed" : "solid"}
  borderColor={
    isDraggedOver
      ? (isValidDrop ? "blue.400" : "red.400")
      : "border.subtle"
  }
  bg={
    isDraggedOver
      ? (isValidDrop ? "blue.50" : "red.50")
      : "transparent"
  }
  transition="all 0.15s"
>
  {/* In-progress tasks */}
</Box>

// Drag tooltip (React Portal)
{dragState && hasDragThresholdMet && (
  <DragTooltip
    task={dragState.draggedTask}
    targetSection={dragState.dropTargetSection}
    position={mousePosition}
    isValidDrop={dragState.isValidDrop}
  />
)}
```

## Implementation Steps

### Step 1: Create TasksSelectionFooter Component
**File:** `src/features/tasks/components/TasksSelectionFooter.tsx`
- Props: selectedTasks, onClearSelection, onDelete, onClear, onComplete
- Layout: Slide-up footer with action buttons
- Styling: Match ResourceSelectionBar pattern

### Step 2: Create CreateTaskDialog Component
**File:** `src/features/tasks/components/CreateTaskDialog.tsx`
- Props: isOpen, onClose, onTaskCreated, projectId?, defaultProjectId?
- Layout: Modal with form fields
- Status field at top level
- Form validation
- Submit handler calling IPC

### Step 3: Update EditTaskDialog
**File:** `src/features/tasks/components/EditTaskDialog.tsx`
- Move Status field to top level (currently hidden)
- Match CreateTaskDialog layout consistency
- Remove "more options" pattern

### Step 4: Refactor TasksSection Layout
**File:** `src/views/project/sections/TasksSection.tsx`
- Remove QuickTaskPopover usage
- Add CreateTaskDialog integration
- Replace TasksActionBar with TasksSelectionFooter
- Restructure to match KitsSection pattern:
  - ToolkitHeader with Filter (left) and Add Task (right icon)
  - Scrollable content area with sections
  - Selection footer at bottom

### Step 5: Update Styles
- Glass filter button styling
- Right-aligned Add Task icon button
- Consistent spacing and positioning
- Selection footer slide-up animation

### Step 6: Implement Drag-and-Drop
**File:** `src/views/project/sections/TasksSection.tsx`
- Add drag state management (similar to NotebookTree pattern):
  ```typescript
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hasDragThresholdMet, setHasDragThresholdMet] = useState(false);
  ```
- Add `handleDragStart` callback on task cards/rows (mousedown event)
- Add document-level mousemove handler to track cursor and update drop target
- Add document-level mouseup handler to perform status update on drop
- Add keyboard handler (Escape to cancel drag)
- Create `DragTooltip` component to show task being dragged
- Add `data-drop-zone` attributes to section containers
- Implement `findDropTargetAtPosition()` using `elementsFromPoint()`
- Validate drop target (can't drop on same section, must be valid zone)
- On valid drop: Call IPC to update task status, refresh task list
- Visual feedback:
  - Dragged task: `opacity: 0.5`
  - Drop zones: Blue border and background when hovered with valid drag
  - Invalid drops: Red border
  - Drag tooltip: Task title + target section name

**Drop Zone Styling:**
```tsx
// In-progress section container
<Box
  data-drop-zone="in_progress"
  borderWidth={isDraggedOver ? "2px" : "0"}
  borderStyle="dashed"
  borderColor={isValidDrop ? "blue.400" : "red.400"}
  bg={isDraggedOver ? (isValidDrop ? "blue.50" : "red.50") : "transparent"}
  transition="all 0.15s"
>
  {/* In-progress tasks */}
</Box>
```

**Drag Handlers:**
```typescript
const handleDragStart = (task: Task, position: { x: number; y: number }) => {
  setDragState({
    draggedTask: task,
    sourceSection: task.status === 'in_progress' ? 'in_progress' : 'backlog',
    dropTargetSection: null,
    isValidDrop: false,
    startPosition: position,
  });
};

const performStatusUpdate = async (task: Task, newStatus: 'in_progress' | 'backlog') => {
  try {
    await invokeUpdateTask(task.id, { status: newStatus });
    toaster.create({
      type: 'success',
      title: 'Task moved',
      description: `Moved to ${newStatus === 'in_progress' ? 'In Progress' : 'Backlog'}`,
    });
    loadTasks(); // Refresh
  } catch (error) {
    toaster.create({
      type: 'error',
      title: 'Failed to move task',
      description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
```

## Component Hierarchy Changes

### Before
```
TasksSection
├── TasksActionBar (generic)
├── ToolkitHeader
├── QuickTaskPopover (left-aligned)
└── EditTaskDialog
```

### After
```
TasksSection
├── ToolkitHeader
│   ├── Filter Button (left, glass)
│   └── Add Task Button (right, icon)
├── FilterPanel (absolute positioned)
├── CreateTaskDialog (modal)
├── EditTaskDialog (modal)
├── TasksSelectionFooter (fixed bottom)
├── DragTooltip (portal, shows during drag)
└── Drag State Management
    ├── In-progress drop zone (data-drop-zone="in_progress")
    ├── Backlog drop zone (data-drop-zone="backlog")
    └── Document-level drag handlers
```

## Testing Checklist
- [ ] Create task via modal
- [ ] Edit task via modal
- [ ] Status field visible at top level
- [ ] Filter panel opens/closes correctly
- [ ] Selection footer appears with selections
- [ ] Delete multiple tasks
- [ ] Clear multiple tasks
- [ ] Complete multiple tasks
- [ ] View mode switching (card/table)
- [ ] Responsive layout
- [ ] Glass styling on filter button
- [ ] Right-aligned Add Task button
- [ ] Drag task from backlog to in-progress (updates status)
- [ ] Drag task from in-progress to backlog (updates status)
- [ ] Drag threshold prevents accidental drags (5px movement required)
- [ ] Drop zones highlight correctly during drag
- [ ] Invalid drops show red highlight
- [ ] Drag tooltip follows cursor showing task and target
- [ ] Escape key cancels drag
- [ ] Dragged task shows reduced opacity
- [ ] Tasks refresh after successful drag-drop
- [ ] Drag works in both card and table view modes

## Files to Modify
1. `src/views/project/sections/TasksSection.tsx` - Main refactor
2. `src/features/tasks/components/EditTaskDialog.tsx` - Status field positioning
3. Create `src/features/tasks/components/CreateTaskDialog.tsx` - New modal
4. Create `src/features/tasks/components/TasksSelectionFooter.tsx` - New footer

## Dependencies
- Existing: Chakra UI, SelectionContext, ElegantList
- Pattern references: KitsSection, WalkthroughsSection, ResourceSelectionBar, NotebookTree (drag-and-drop)
- React Portal (for DragTooltip)
- Document-level event listeners (mousemove, mouseup, keydown)

## Success Criteria
1. Tasks section follows KitsSection UI pattern
2. Task creation/editing uses modals (not popovers)
3. Status field always visible (top-level)
4. Dedicated selection footer with task-specific actions
5. Right-aligned Add Task button
6. Glass filter button on left
7. Consistent spacing and visual hierarchy
8. Drag-and-drop between sections works smoothly
9. Drop zones provide clear visual feedback
10. Task status updates correctly on drag-drop
11. Drag threshold prevents accidental drags
12. Drag works in both card and table view modes

## Notes
- Keep existing in-progress/backlog separation
- Maintain existing filter functionality
- Preserve view mode switching (card/table)
- Remove QuickTaskPopover dependency
- Remove generic TasksActionBar
- Drag-and-drop implementation follows NotebookTree.tsx patterns
- Drag threshold (5px) prevents accidental drags on click
- Drop zones use data attributes for clean element detection
- Drag tooltip uses React Portal to overlay document body
- Status updates via IPC maintain data integrity
- Both card and table view modes support drag-and-drop

## Drag-and-Drop UX Flow
1. User mousedown on task card/row
2. Threshold check: Movement > 5px activates drag
3. Visual feedback: Dragged task opacity 0.5, drag tooltip appears
4. Cursor moves over sections: Drop zones highlight (blue = valid, red = invalid)
5. User releases mouse:
   - If over valid drop zone: Update task status, show success toast, refresh list
   - If over invalid area or same section: Cancel drag, no changes
6. ESC key anytime: Cancel drag, no changes
