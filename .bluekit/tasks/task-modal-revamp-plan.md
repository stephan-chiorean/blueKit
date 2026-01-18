# Task Modal Revamp - Glassmorphic Design

Revamp the Add Task flow to support a centralized glassmorphic modal design with multi-step wizard functionality, replacing the current popover + separate dialogs approach.

## User Review Required

> [!IMPORTANT]
> **Breaking Change**: This revamp will significantly restructure the task management UI. The current popover-based flow will be replaced with a centralized modal. All existing functionality will be preserved but the UX will change.

> [!NOTE]
> **Naming Convention Change**: `TaskCreateDialog.tsx` and `EditTaskDialog.tsx` will be consolidated into a unified `TaskModal.tsx` component with internal step management.

---

## Current State Analysis

The current implementation consists of:

1. **[Header.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/Header.tsx)** - Contains the task list icon button that triggers `TaskManagerPopover`
2. **[TaskManagerPopover.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/TaskManagerPopover.tsx)** - A popover showing in-progress tasks with an "Add Task" button
3. **[TaskCreateDialog.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/TaskCreateDialog.tsx)** - Standalone dialog for creating tasks
4. **[EditTaskDialog.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/EditTaskDialog.tsx)** - Standalone dialog for editing tasks

### Pain Points
- Disjointed UX: popover → new dialog interrupts flow
- No glassmorphic styling on task dialogs
- Inconsistent naming convention (Create vs Edit prefix patterns)
- No "create and continue" workflow

---

## Proposed Architecture

### New Component Structure

```
src/components/tasks/
├── TaskModal.tsx              # [NEW] Main orchestrating component (unified modal)
├── TaskModalViews/            # [NEW] Directory for modal view components
│   ├── TaskListView.tsx       # [NEW] In-progress tasks + expandable all tasks
│   ├── TaskFormView.tsx       # [NEW] Create/Edit task form (shared)
│   └── index.ts               # [NEW] Barrel export
├── TaskManagerPopover.tsx     # [DELETE] Replaced by TaskModal
├── TaskCreateDialog.tsx       # [DELETE] Replaced by TaskFormView
├── EditTaskDialog.tsx         # [DELETE] Replaced by TaskFormView
├── ProjectMultiSelect.tsx     # Keep as-is
├── TasksActionBar.tsx         # Keep as-is
└── TasksTabContent.tsx        # Keep as-is
```

---

## Proposed Changes

### Component: `tasks/`

#### [DELETE] [TaskManagerPopover.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/TaskManagerPopover.tsx)
- Remove popover-based approach entirely
- Functionality absorbed into `TaskModal`

#### [DELETE] [TaskCreateDialog.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/TaskCreateDialog.tsx)
- Remove standalone create dialog
- Form logic absorbed into `TaskFormView`

#### [DELETE] [EditTaskDialog.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/EditTaskDialog.tsx)
- Remove standalone edit dialog
- Form logic absorbed into `TaskFormView`

---

#### [NEW] [TaskModal.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/TaskModal.tsx)

Main orchestrating component with step-based navigation:

```typescript
type ModalStep = 'task-list' | 'task-form';
type FormMode = 'create' | 'edit';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject?: Project;
  onNavigateToTasks?: () => void;
  // Optional: pre-select a task for editing
  initialTask?: Task | null;
}
```

**Features:**
- Glassmorphic backdrop with `blur(30px) saturate(180%)`
- Centrally positioned modal (not attached to trigger)
- Animated transitions between views using CSS transforms
- Keyboard navigation (Escape to go back/close)
- Project filter dropdown for task list

**Glassmorphic Styling Pattern (from project conventions):**
```css
/* Light mode */
background: rgba(255, 255, 255, 0.85);
backdropFilter: blur(30px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.4);
boxShadow: 0 8px 32px rgba(0, 0, 0, 0.1);

/* Dark mode */
background: rgba(30, 30, 40, 0.85);
backdropFilter: blur(30px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.1);
boxShadow: 0 8px 32px rgba(0, 0, 0, 0.4);
```

---

#### [NEW] [TaskModalViews/TaskListView.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/TaskModalViews/TaskListView.tsx)

Displays tasks within the modal:

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Tasks                        [Project ▼]  │
├─────────────────────────────────────────────┤
│  In Progress (3)                    [⌄]    │
│  ┌─────────────────────────────────────┐   │
│  │ • Task title here                   │   │
│  │   Project Name • 2 days ago         │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ • Another task                      │   │
│  │   Project Name                      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  All Tasks (12)                     [⌄]    │
│  (collapsed by default, click to expand)   │
├─────────────────────────────────────────────┤
│  [+ Add Task]              [See All Tasks] │
└─────────────────────────────────────────────┘
```

**Features:**
- Project filter dropdown (multi-select or single)
- Collapsible sections: "In Progress" (expanded) and "All Tasks" (collapsed)
- Click task card → animated transition to edit form
- "Add Task" button → animated transition to create form
- "See All Tasks" → navigates out of modal to tasks tab

---

#### [NEW] [TaskModalViews/TaskFormView.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/tasks/TaskModalViews/TaskFormView.tsx)

Unified form for create and edit:

```typescript
interface TaskFormViewProps {
  mode: 'create' | 'edit';
  task?: Task | null;
  projects: Project[];
  defaultProjectId?: string;
  onSave: (task: Task) => void;
  onBack: () => void;
  onClose: () => void;
}
```

**Layout:**
```
┌─────────────────────────────────────────────┐
│  [←]  Add Task              (or Edit Task) │
├─────────────────────────────────────────────┤
│                                             │
│  Title *                                    │
│  ┌─────────────────────────────────────┐   │
│  │ Enter task title...                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Tags                                       │
│  ┌─────────────────────────────────────┐   │
│  │ [tag1] [tag2] + Add tag             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Description                                │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Priority    [Pinned][High][Standard]...   │
│  Complexity  [Easy][Hard][Deep dive]       │
│  Type        [Bug][Feature][Cleanup]...    │
│  Status      [Backlog][In Progress]...     │
│  Projects    [Multi-select dropdown]       │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [Create & Add Another] [Create Task]      │
│                                             │
│  (or for edit mode:)                        │
│  [Cancel]               [Save Changes]     │
└─────────────────────────────────────────────┘
```

**Button Semantics (Create Mode):**
| Button | Action | Modal State |
|--------|--------|-------------|
| **Create Task** (Primary) | Creates task and closes modal | Closes |
| **Create & Add Another** (Secondary) | Creates task, resets form, stays in form view | Stays open |

**Button Semantics (Edit Mode):**
| Button | Action | Modal State |
|--------|--------|-------------|
| **Save Changes** (Primary) | Updates task and returns to list view | Returns to list |
| **Cancel** (Ghost) | Discards changes, returns to list view | Returns to list |

---

### Component: `Header.tsx`

#### [MODIFY] [Header.tsx](file:///Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/Header.tsx)

**Changes:**
1. Remove `TaskManagerPopover`, `EditTaskDialog`, and `TaskCreateDialog` imports
2. Add `TaskModal` import
3. Replace popover state with single `isTaskModalOpen` state
4. Remove `selectedTask`, `isTaskDialogOpen`, `isCreateDialogOpen` states
5. Keep the task list icon button but wire it to open `TaskModal`

```diff
- import TaskManagerPopover from './tasks/TaskManagerPopover';
- import EditTaskDialog from './tasks/EditTaskDialog';
- import TaskCreateDialog from './tasks/TaskCreateDialog';
+ import TaskModal from './tasks/TaskModal';

  // State changes
- const [selectedTask, setSelectedTask] = useState<Task | null>(null);
- const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
- const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
+ const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // JSX changes
- <TaskManagerPopover ... />
- <EditTaskDialog ... />
- <TaskCreateDialog ... />
+ <IconButton
+   variant="ghost"
+   size="sm"
+   aria-label="Task Manager"
+   onClick={() => setIsTaskModalOpen(true)}
+ >
+   <LuListTodo />
+   {/* Badge for in-progress count */}
+ </IconButton>
+ <TaskModal
+   isOpen={isTaskModalOpen}
+   onClose={() => setIsTaskModalOpen(false)}
+   currentProject={currentProject}
+   onNavigateToTasks={onNavigateToTasks}
+ />
```

---

## Animation & Transition Details

### Modal Opening
- Use Chakra Dialog with custom positioning (centered, not attached to trigger)
- Backdrop fade in with `blur(8px)`
- Content scales up from 0.95 → 1.0 with opacity 0 → 1

### View Transitions (List ↔ Form)
- Sliding transition: 
  - List → Form: List slides left while Form slides in from right
  - Form → List: Form slides right while List slides in from left
- Duration: 200-300ms ease-out
- Consider using `framer-motion` or CSS transforms with `translateX`

```css
/* Example transition classes */
.slide-left-exit {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-right-enter {
  transform: translateX(100%);
  opacity: 0;
}
.slide-right-enter-active {
  transform: translateX(0);
  opacity: 1;
  transition: all 250ms ease-out;
}
```

---

## Verification Plan

### Automated Tests
- Run existing TypeScript compilation: `npm run build`
- Run existing tests if available: `npm run test`

### Manual Verification
1. **Task List View:**
   - Open modal from header → Displays in-progress tasks
   - Project filter works correctly
   - Expand/collapse sections work
   - Click task → transitions to edit form
   
2. **Task Create Flow:**
   - Click "Add Task" → transitions to create form
   - Fill form → "Create Task" → modal closes, task appears in list
   - Fill form → "Create & Add Another" → form resets, modal stays open
   - Back button → returns to list without creating

3. **Task Edit Flow:**
   - Click existing task → form pre-populated
   - Edit fields → "Save Changes" → returns to list with updates
   - "Cancel" → returns to list without saving

4. **Glassmorphic Styling:**
   - Verify blur/transparency in both light and dark modes
   - Check transitions are smooth and consistent

5. **Edge Cases:**
   - Empty task list state
   - Error handling for failed API calls
   - Keyboard navigation (Escape to close/back)

---

## Implementation Order

1. **Phase 1: Core Modal Structure**
   - Create `TaskModal.tsx` with basic open/close
   - Create `TaskModalViews/` directory structure
   - Implement glassmorphic styling

2. **Phase 2: Task List View**
   - Create `TaskListView.tsx`
   - Implement project filter dropdown
   - Implement collapsible sections

3. **Phase 3: Task Form View**
   - Create `TaskFormView.tsx`
   - Port form logic from existing dialogs
   - Implement "Create & Add Another" flow

4. **Phase 4: Transitions**
   - Add sliding animations between views
   - Polish modal enter/exit animations

5. **Phase 5: Integration**
   - Update `Header.tsx` to use new modal
   - Remove old components
   - Test end-to-end

---

## Files Summary

| Action | File |
|--------|------|
| NEW | `src/components/tasks/TaskModal.tsx` |
| NEW | `src/components/tasks/TaskModalViews/TaskListView.tsx` |
| NEW | `src/components/tasks/TaskModalViews/TaskFormView.tsx` |
| NEW | `src/components/tasks/TaskModalViews/index.ts` |
| MODIFY | `src/components/Header.tsx` |
| DELETE | `src/components/tasks/TaskManagerPopover.tsx` |
| DELETE | `src/components/tasks/TaskCreateDialog.tsx` |
| DELETE | `src/components/tasks/EditTaskDialog.tsx` |
