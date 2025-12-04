---
id: task-management-system-v2
alias: Task Management System Architecture v2
type: walkthrough
is_base: false
version: 2
tags:
  - task-management
  - database
  - react-tauri
description: Complete architecture and data flow for the database-backed task management system with status tracking, priority management, and real-time UI updates
complexity: comprehensive
format: architecture
---
# Task Management System Architecture v2

## Overview

The BlueKit task management system is a full-stack feature built with React frontend, Rust backend, and SQLite database. It supports creating, editing, and organizing tasks with priority levels, status tracking, complexity estimates, and project associations.

**Key Capabilities:**
- Database-backed persistence with SQLite
- Status workflow: backlog → in_progress → completed/blocked
- Priority system with pinned tasks
- Complexity estimation (optional)
- Multi-project task associations
- Real-time UI updates via IPC
- Batch operations (set in progress, complete, delete)
- Global task manager accessible from header

---

## Data Model

### Task Type Definition

**File**: `src/types/task.ts`

```typescript
export type TaskPriority = 'pinned' | 'high' | 'standard' | 'long term' | 'nit';
export type TaskStatus = 'backlog' | 'in_progress' | 'completed' | 'blocked';
export type TaskComplexity = 'easy' | 'hard' | 'deep dive';

export interface Task {
  id: string;                    // UUID
  title: string;                 // Required
  description?: string;          // Optional details
  priority: TaskPriority;        // Required, default 'standard'
  tags: string[];                // Array of tag strings
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  projectIds: string[];          // Associated project UUIDs
  status: TaskStatus;            // Required, default 'backlog'
  complexity?: TaskComplexity;   // Optional estimation
}
```

### Database Schema

**Table**: `tasks`

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'nit',
  tags TEXT NOT NULL,              -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'backlog',
  complexity TEXT                  -- NULL allowed
);
```

**Migration**: Added in `src-tauri/src/db/migrations.rs:add_task_status_and_complexity_columns()`
- Idempotent: Checks if columns exist before adding
- Uses `pragma_table_info` to verify schema

**Bridge Table**: `task_projects`
```sql
CREATE TABLE task_projects (
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  PRIMARY KEY (task_id, project_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES project_registry(id) ON DELETE CASCADE
);
```

---

## Architecture Layers

### Layer 1: Database Operations (Rust)

**File**: `src-tauri/src/db/task_operations.rs`

**Key Functions:**

```rust
pub async fn create_task(
    db: &DatabaseConnection,
    title: String,
    description: Option<String>,
    priority: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
    status: Option<String>,         // Defaults to 'backlog'
    complexity: Option<String>,
) -> Result<TaskDto, DbErr>
```

**Implementation Details:**
1. Generates UUID for task ID
2. Serializes tags to JSON
3. Inserts task into `tasks` table
4. Creates associations in `task_projects` table
5. Returns `TaskDto` with all fields

```rust
pub async fn update_task(
    db: &DatabaseConnection,
    task_id: String,
    title: Option<String>,
    description: Option<String>,
    priority: Option<String>,
    tags: Option<Vec<String>>,
    project_ids: Option<Vec<String>>,
    status: Option<String>,
    complexity: Option<String>,
) -> Result<TaskDto, DbErr>
```

**Implementation Details:**
1. Loads existing task by ID
2. Updates only provided fields (partial update)
3. Handles project associations:
   - Deletes old associations
   - Creates new associations
4. Updates `updated_at` timestamp
5. Returns updated `TaskDto`

**Other Operations:**
- `get_tasks()` - Load all tasks
- `get_project_tasks(project_id)` - Load tasks for specific project
- `delete_task(task_id)` - Delete task and associations

### Layer 2: IPC Commands (Rust)

**File**: `src-tauri/src/commands.rs`

Commands are Rust functions marked with `#[tauri::command]` that expose backend functionality to frontend.

**Create Task:**
```rust
#[tauri::command]
pub async fn db_create_task(
    title: String,
    description: Option<String>,
    priority: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
    status: Option<String>,
    complexity: Option<String>,
    state: State<'_, AppState>,
) -> Result<TaskDto, String>
```

**Update Task:**
```rust
#[tauri::command]
pub async fn db_update_task(
    task_id: String,
    title: Option<String>,
    description: Option<String>,
    priority: Option<String>,
    tags: Option<Vec<String>>,
    project_ids: Option<Vec<String>>,
    status: Option<String>,
    complexity: Option<String>,
    state: State<'_, AppState>,
) -> Result<TaskDto, String>
```

**Registration**: Commands registered in `src-tauri/src/main.rs`:
```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        db_create_task,
        db_update_task,
        db_get_tasks,
        db_get_project_tasks,
        db_delete_task,
        // ... other commands
    ])
```

### Layer 3: IPC Wrappers (TypeScript)

**File**: `src/ipc.ts`

Type-safe TypeScript wrappers around Tauri's `invoke()` function with timeout handling.

```typescript
export async function invokeDbCreateTask(
  title: string,
  description: string | undefined,
  priority: TaskPriority,
  tags: string[],
  project_ids: string[],
  status?: TaskStatus,
  complexity?: TaskComplexity
): Promise<Task> {
  return invokeWithTimeout<Task>('db_create_task', {
    title,
    description,
    priority,
    tags,
    project_ids,  // Note: snake_case for Rust
    status,
    complexity,
  }, 5000);
}
```

**Key Pattern**: Parameter names use `snake_case` to match Rust conventions, even though TypeScript typically uses `camelCase`.

### Layer 4: React Components

#### TasksTabContent (Main View)

**File**: `src/components/tasks/TasksTabContent.tsx`

**Responsibilities:**
- Loads tasks from database via IPC
- Filters out completed tasks (status !== 'completed')
- Sorts by priority or time
- Manages selection state
- Renders task cards with priority badges

**Key Features:**

**Loading Tasks:**
```typescript
const loadTasks = async () => {
  try {
    setLoading(true);
    const loadedTasks: Task[] = context === 'workspace'
      ? await invokeDbGetTasks()
      : await invokeDbGetProjectTasks((context as ProjectEntry).id);
    setTasks(loadedTasks);
  } catch (error) {
    // Error handling with toast
  } finally {
    setLoading(false);
  }
};
```

**Filtering & Sorting:**
```typescript
const sortedTasks = useMemo(() => {
  // Filter out completed tasks first
  const visibleTasks = tasks.filter(task => task.status !== 'completed');
  const tasksCopy = [...visibleTasks];

  if (sortBy === 'priority') {
    return tasksCopy.sort((a, b) => {
      const orderA = getPriorityOrder(a.priority);
      const orderB = getPriorityOrder(b.priority);
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by updatedAt
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }
  // ... time sorting
}, [tasks, sortBy]);
```

**Priority Order:**
```typescript
const getPriorityOrder = (priority: string): number => {
  switch (priority) {
    case 'pinned': return 0;
    case 'high': return 1;
    case 'standard': return 2;
    case 'long term': return 3;
    case 'nit': return 4;
    default: return 5;
  }
};
```

**Task Cards:**
- Display title with pin icon for pinned tasks
- Show priority badge (hidden for 'nit')
- Show project badges
- Truncated description (2 lines)
- Clickable to open edit dialog
- Checkbox for multi-select

#### TaskCreateDialog

**File**: `src/components/tasks/TaskCreateDialog.tsx`

Modal form for creating new tasks with all fields.

**Form Fields:**
- Title (required, Input)
- Description (optional, Textarea)
- Priority (required, NativeSelect with 5 options)
- Complexity (optional, NativeSelect with 3 options + "Not specified")
- Status (required, NativeSelect with 4 options, defaults to 'backlog')
- Projects (optional, ProjectMultiSelect component)
- Tags (optional, comma-separated Input)

**Submission Flow:**
1. Validate title is not empty
2. Parse tags from comma-separated string
3. Call `invokeDbCreateTask()` with all fields
4. Show success toast
5. Call `onTaskCreated()` callback to reload parent list
6. Reset form and close dialog

**NativeSelect Pattern** (Chakra UI v3):
```typescript
<NativeSelect.Root>
  <NativeSelect.Field
    value={status}
    onChange={(e) => setStatus(e.currentTarget.value as TaskStatus)}
  >
    <option value="backlog">Backlog</option>
    <option value="in_progress">In Progress</option>
    <option value="completed">Completed</option>
    <option value="blocked">Blocked</option>
  </NativeSelect.Field>
</NativeSelect.Root>
```

**Note**: `value` and `onChange` go on `NativeSelect.Field`, not `NativeSelect.Root`.

#### TaskDialog (Edit Dialog)

**File**: `src/components/tasks/TaskDialog.tsx`

Modal form for editing existing tasks. Fully editable version with form state.

**Key Implementation:**
```typescript
const [title, setTitle] = useState('');
const [description, setDescription] = useState('');
const [priority, setPriority] = useState<TaskPriority>('standard');
const [status, setStatus] = useState<TaskStatus>('backlog');
const [complexity, setComplexity] = useState<TaskComplexity | ''>('');
const [tags, setTags] = useState<string>('');

// Initialize form when task changes
useEffect(() => {
  if (task) {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setStatus(task.status);
    setComplexity(task.complexity || '');
    setTags(task.tags.join(', '));
  }
}, [task]);
```

**Save Handler:**
```typescript
const handleSave = async () => {
  await invokeDbUpdateTask(
    task.id,
    title.trim(),
    description.trim() || undefined,
    priority,
    tags.split(',').map(t => t.trim()).filter(Boolean),
    task.projectIds, // Keep existing project associations
    status,
    complexity || undefined
  );
  
  if (onTaskUpdated) {
    onTaskUpdated(); // Trigger parent reload
  }
  onClose();
};
```

#### TasksActionBar

**File**: `src/components/tasks/TasksActionBar.tsx`

Floating action bar for batch operations on selected tasks.

**Actions:**

1. **Set to In Progress** (Blue button with LuPlay icon)
   - Updates all selected tasks to `status: 'in_progress'`
   - Preserves all other fields
   - Shows success toast with count

2. **Complete** (Green button with LuCircleCheck icon)
   - Updates all selected tasks to `status: 'completed'`
   - Tasks disappear from view (filtered out)
   - Preserved in database for record-keeping

3. **Delete** (Red button with LuTrash2 icon)
   - Calls `invokeDbDeleteTask()` for each selected task
   - Permanently removes from database
   - Shows red toast: "X tasks deleted"

**Implementation Pattern:**
```typescript
const handleSetInProgress = async () => {
  setLoading(true);
  try {
    await Promise.all(
      selectedTasks.map(task =>
        invokeDbUpdateTask(
          task.id,
          task.title,
          task.description,
          task.priority,
          task.tags,
          task.projectIds,
          'in_progress',  // New status
          task.complexity
        )
      )
    );
    toaster.create({
      type: "success",
      title: "Tasks updated",
      description: `Set ${selectedTasks.length} task${
        selectedTasks.length !== 1 ? "s" : ""
      } to In Progress`,
    });
    clearSelection();
    onTasksUpdated(); // Reload parent list
  } catch (error) {
    // Error toast
  } finally {
    setLoading(false);
  }
};
```

#### TaskManagerPopover (Header Integration)

**File**: `src/components/tasks/TaskManagerPopover.tsx`

Popover component accessible from header showing in-progress tasks.

**Features:**
- Loads all workspace tasks, filters for `status === 'in_progress'`
- Shows badge with count of in-progress tasks
- Displays list of in-progress tasks (clickable)
- "Add Task" button at bottom

**Loading Logic:**
```typescript
const loadInProgressTasks = async () => {
  try {
    const allTasks = await invokeDbGetTasks();
    const inProgressTasks = allTasks.filter(
      task => task.status === 'in_progress'
    );
    setTasks(inProgressTasks);
  } catch (error) {
    console.error('Failed to load in-progress tasks:', error);
  }
};
```

**Integration in Header:**

**File**: `src/components/Header.tsx`

```typescript
<TaskManagerPopover
  onOpenTaskDialog={handleOpenTaskDialog}
  onOpenCreateDialog={handleOpenCreateDialog}
/>

{/* Dialogs rendered at Header level */}
<TaskDialog
  task={selectedTask}
  isOpen={isTaskDialogOpen}
  onClose={() => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
  }}
  onTaskUpdated={handleTaskUpdated}
/>

<TaskCreateDialog
  isOpen={isCreateDialogOpen}
  onClose={() => setIsCreateDialogOpen(false)}
  onTaskCreated={handleTaskUpdated}
  projects={[]} // No project preselection from header
/>
```

---

## Data Flow Diagrams

### Creating a Task

```
User clicks "Add Task" button
  ↓
TaskCreateDialog opens with empty form
  ↓
User fills form fields:
  - Title (required)
  - Description (optional)
  - Priority (dropdown, default 'standard')
  - Complexity (dropdown, optional)
  - Status (dropdown, default 'backlog')
  - Projects (multi-select)
  - Tags (comma-separated)
  ↓
User clicks "Add Task" button
  ↓
Frontend validates title is not empty
  ↓
Frontend calls invokeDbCreateTask(...)
  ↓
IPC layer serializes parameters to JSON
  ↓
Rust command db_create_task receives call
  ↓
task_operations::create_task() executes:
  1. Generate UUID
  2. Serialize tags to JSON
  3. Insert into tasks table
  4. Insert associations into task_projects table
  5. Query to get TaskDto with all fields
  ↓
TaskDto returned to frontend as JSON
  ↓
Frontend shows success toast
  ↓
Calls onTaskCreated() callback
  ↓
Parent component reloads tasks from database
  ↓
UI updates with new task visible in list
```

### Editing a Task

```
User clicks on task card
  ↓
TaskDialog opens with task data
  ↓
useEffect initializes form fields from task:
  - title → setTitle(task.title)
  - description → setDescription(task.description || '')
  - priority → setPriority(task.priority)
  - status → setStatus(task.status)
  - complexity → setComplexity(task.complexity || '')
  - tags → setTags(task.tags.join(', '))
  ↓
User modifies fields (all editable)
  ↓
User clicks "Save Changes" button
  ↓
Frontend validates title is not empty
  ↓
Frontend calls invokeDbUpdateTask(task.id, ...)
  ↓
IPC layer sends update to Rust
  ↓
Rust command db_update_task receives call
  ↓
task_operations::update_task() executes:
  1. Load existing task by ID
  2. Update only provided fields
  3. Handle project associations (delete old, insert new)
  4. Update updated_at timestamp
  5. Return updated TaskDto
  ↓
Frontend shows success toast
  ↓
Calls onTaskUpdated() callback
  ↓
Parent component reloads tasks
  ↓
UI updates with edited task
  ↓
Dialog closes
```

### Completing Tasks (Batch)

```
User selects multiple tasks via checkboxes
  ↓
TasksActionBar appears at bottom
  ↓
User clicks "Complete" button (green)
  ↓
Frontend calls handleComplete()
  ↓
Promise.all() executes updates in parallel:
  - For each selected task:
    - invokeDbUpdateTask(task.id, ..., status: 'completed')
  ↓
Each IPC call updates task status to 'completed'
  ↓
All promises resolve
  ↓
Frontend shows success toast: "Marked X tasks as completed"
  ↓
Calls clearSelection()
  ↓
Calls onTasksUpdated() → loadTasks()
  ↓
Parent reloads all tasks from database
  ↓
sortedTasks useMemo filters out completed:
  - filter(task => task.status !== 'completed')
  ↓
Completed tasks disappear from UI
  ↓
Tasks still exist in database (for record-keeping)
```

### Deleting Tasks (Batch)

```
User selects multiple tasks
  ↓
TasksActionBar appears
  ↓
User clicks "Delete" button (red)
  ↓
Frontend calls handleDelete()
  ↓
Promise.all() executes deletions in parallel:
  - For each selected task:
    - invokeDbDeleteTask(task.id)
  ↓
Each IPC call triggers Rust command
  ↓
Rust executes task_operations::delete_task():
  1. Delete from task_projects table (foreign key cascade)
  2. Delete from tasks table
  ↓
All promises resolve
  ↓
Frontend shows RED toast: "X tasks deleted"
  ↓
Calls clearSelection()
  ↓
Calls onTasksUpdated() → loadTasks()
  ↓
Parent reloads tasks
  ↓
Deleted tasks no longer in database
  ↓
UI updates to remove deleted tasks
```

### Header Task Manager Flow

```
User opens app
  ↓
Header component renders
  ↓
TaskManagerPopover mounts
  ↓
useEffect calls loadInProgressTasks():
  - invokeDbGetTasks() loads all workspace tasks
  - filter(task => task.status === 'in_progress')
  - setTasks(inProgressTasks)
  ↓
Badge shows count: inProgressTasks.length
  ↓
User clicks "Tasks" button in header
  ↓
Popover opens showing:
  - List of in-progress tasks (clickable)
  - "Add Task" button
  ↓
User clicks on an in-progress task
  ↓
Calls onOpenTaskDialog(task)
  ↓
Header state updates:
  - setSelectedTask(task)
  - setIsTaskDialogOpen(true)
  ↓
TaskDialog opens with task data
  ↓
User edits and saves
  ↓
TaskDialog calls onTaskUpdated()
  ↓
Header's handleTaskUpdated() is called
  ↓
Popover should refresh (needs reload mechanism)
```

---

## Priority System

### Priority Levels

1. **Pinned** (`'pinned'`)
   - Highest priority
   - Always appears at top of list
   - Shows purple pin icon (LuPin) next to title
   - Badge color: purple
   - Sort order: 0

2. **High** (`'high'`)
   - Important tasks requiring attention
   - Badge color: orange
   - Sort order: 1

3. **Standard** (`'standard'`)
   - Default priority for new tasks
   - Badge color: green
   - Sort order: 2

4. **Long Term** (`'long term'`)
   - Future or non-urgent tasks
   - Badge color: blue
   - Sort order: 3

5. **Nit** (`'nit'`)
   - Minor improvements or polish
   - Badge color: gray
   - **Badge not displayed in UI** (priority badge hidden for nit)
   - Sort order: 4

### Visual Indicators

**Pin Icon** (for pinned tasks):
```typescript
{task.priority === 'pinned' && (
  <Icon color="purple.500">
    <LuPin />
  </Icon>
)}
```

**Priority Badge** (hidden for nit):
```typescript
{task.priority !== 'nit' && (
  <Badge colorPalette={priorityColor} size="sm">
    {task.priority}
  </Badge>
)}
```

---

## Status Workflow

### Status Transitions

```
[Backlog] ──→ [In Progress] ──→ [Completed]
                    ↓
                [Blocked]
```

### Status Details

1. **Backlog** (`'backlog'`)
   - Default status for new tasks
   - Task is queued but not started
   - Visible in main task list

2. **In Progress** (`'in_progress'`)
   - Task actively being worked on
   - Shows in header task manager popover
   - Visible in main task list
   - Can be set via action bar

3. **Completed** (`'completed'`)
   - Task is finished
   - **Hidden from UI** (filtered out in sortedTasks)
   - **Preserved in database** for record-keeping
   - Cannot be edited unless status changed back

4. **Blocked** (`'blocked'`)
   - Task cannot proceed due to dependencies
   - Visible in main task list
   - User must manually change status

### Filtering Logic

**File**: `src/components/tasks/TasksTabContent.tsx:191-193`

```typescript
const sortedTasks = useMemo(() => {
  // Filter out completed tasks first
  const visibleTasks = tasks.filter(task => task.status !== 'completed');
  // ... sorting logic
}, [tasks, sortBy]);
```

**Important**: There is no UI to view completed tasks. Once completed, they are permanently hidden but remain in the database.

---

## Complexity Estimation (Optional)

### Complexity Levels

1. **Easy** (`'easy'`)
   - Simple, straightforward tasks
   - Quick to implement

2. **Hard** (`'hard'`)
   - Complex tasks requiring significant effort
   - May involve multiple components

3. **Deep Dive** (`'deep dive'`)
   - Extensive research or learning required
   - Major architectural changes
   - Long-term effort

### Field Behavior

- **Optional**: Can be left empty (NULL in database, '' in UI)
- **Not displayed** in task cards (currently)
- **Stored for reference** and future analytics
- **Editable** in both create and edit dialogs

---

## Project Associations

### Multi-Project Support

Tasks can be associated with multiple projects via the `task_projects` bridge table.

**Data Model:**
```typescript
interface Task {
  projectIds: string[];  // Array of project UUIDs
}
```

**UI Component:**

**File**: `src/components/tasks/ProjectMultiSelect.tsx`

Multi-select component allowing users to associate tasks with projects.

**Display in Task Cards:**
```typescript
{task.projectIds.length > 0 && (
  <HStack gap={1} flexWrap="wrap">
    {task.projectIds.map(projectId => {
      const project = projects.find(p => p.id === projectId);
      return project ? (
        <Badge key={projectId} size="xs" colorPalette="blue" variant="outline">
          <HStack gap={1}>
            <LuFolder size={10} />
            <Text>{project.title}</Text>
          </HStack>
        </Badge>
      ) : null;
    })}
  </HStack>
)}
```

**Context-Aware Loading:**

When viewing tasks in workspace view:
```typescript
const loadedTasks = await invokeDbGetTasks(); // All tasks
```

When viewing tasks in project detail view:
```typescript
const loadedTasks = await invokeDbGetProjectTasks(projectId); // Filtered
```

---

## Selection System

### Multi-Select

Users can select multiple tasks via checkboxes on task cards.

**State Management:**
```typescript
const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

const handleTaskToggle = (task: Task) => {
  setSelectedTaskIds((prev) => {
    const next = new Set(prev);
    if (next.has(task.id)) {
      next.delete(task.id);
    } else {
      next.add(task.id);
    }
    return next;
  });
};
```

**Derived State:**
```typescript
const selectedTasks = useMemo(() => {
  return tasks.filter(task => selectedTaskIds.has(task.id));
}, [tasks, selectedTaskIds]);
```

### Visual Feedback

Selected task cards have:
- Border: `borderWidth: "2px"` and `borderColor: "primary.500"`
- Background: `bg: "primary.50"`

---

## Error Handling

### Frontend Error Handling

All IPC calls wrapped in try-catch with toast notifications:

```typescript
try {
  await invokeDbCreateTask(...);
  toaster.create({
    type: 'success',
    title: 'Task created',
    description: `Created task: ${title}`,
  });
} catch (error) {
  console.error('Failed to create task:', error);
  toaster.create({
    type: 'error',
    title: 'Failed to create task',
    description: String(error),
    closable: true,
  });
}
```

### Backend Error Handling

Rust commands return `Result<T, String>`:

```rust
pub async fn db_create_task(...) -> Result<TaskDto, String> {
    match create_task(...).await {
        Ok(task_dto) => Ok(task_dto),
        Err(e) => Err(format!("Failed to create task: {}", e)),
    }
}
```

Errors automatically propagated to frontend as rejected promises.

---

## Performance Considerations

### Database Queries

- **Indexes**: Primary key on `id`, foreign keys on `task_projects`
- **Cascade Deletes**: Deleting task automatically removes associations
- **JSON Serialization**: Tags stored as JSON array in single column

### Frontend Optimizations

- **useMemo**: Sorting/filtering memoized to prevent unnecessary recalculations
- **Batch Operations**: `Promise.all()` for parallel updates/deletes
- **Controlled Loading**: Loading states prevent multiple simultaneous loads

### IPC Timeouts

All IPC calls have 5-second timeout (configurable in `src/utils/ipcTimeout.ts`).

---

## Future Enhancements

### Potential Improvements

1. **Task Dependencies**
   - Link tasks as blockers/blocked-by
   - Visualize dependency graph

2. **Due Dates**
   - Add `due_date` field
   - Calendar view
   - Overdue warnings

3. **Assignees**
   - Multi-user support
   - User avatars on task cards

4. **Activity Log**
   - Track status changes
   - History of edits
   - Audit trail

5. **Completed Tasks View**
   - Toggle to show/hide completed
   - Completed tasks archive page
   - Statistics and analytics

6. **Real-Time Sync**
   - WebSocket updates
   - Multi-device sync
   - Optimistic UI updates

7. **Task Templates**
   - Create tasks from templates
   - Common task patterns
   - Checklist items

8. **Search & Filters**
   - Full-text search in title/description
   - Filter by status, priority, complexity
   - Filter by tags
   - Filter by projects

---

## Testing Checklist

### Manual Testing

- [ ] Create task with all fields
- [ ] Create task with minimal fields (title only)
- [ ] Edit task and save
- [ ] Change task status via edit dialog
- [ ] Set single task to in progress via action bar
- [ ] Set multiple tasks to in progress via action bar
- [ ] Complete single task
- [ ] Complete multiple tasks (verify they disappear)
- [ ] Delete single task
- [ ] Delete multiple tasks
- [ ] Open task manager from header
- [ ] View in-progress tasks in popover
- [ ] Click task in popover to edit
- [ ] Create task from header popover
- [ ] Verify pin icon shows for pinned tasks
- [ ] Verify priority sorting works
- [ ] Verify time sorting works
- [ ] Associate task with multiple projects
- [ ] View tasks filtered by project

### Edge Cases

- [ ] Create task with empty description
- [ ] Create task with no tags
- [ ] Create task with no projects
- [ ] Edit task and clear optional fields
- [ ] Select all tasks and delete
- [ ] Complete task, then reload page (verify still hidden)
- [ ] Very long title/description handling
- [ ] Special characters in title/description
- [ ] Multiple rapid creates/updates

---

## Key Files Reference

### Frontend
- `src/types/task.ts` - TypeScript type definitions
- `src/ipc.ts` - IPC wrapper functions
- `src/components/tasks/TasksTabContent.tsx` - Main task list view
- `src/components/tasks/TaskDialog.tsx` - Edit task modal
- `src/components/tasks/TaskCreateDialog.tsx` - Create task modal
- `src/components/tasks/TasksActionBar.tsx` - Batch operations
- `src/components/tasks/TaskManagerPopover.tsx` - Header popover
- `src/components/tasks/ProjectMultiSelect.tsx` - Project selector
- `src/components/Header.tsx` - Header integration

### Backend
- `src-tauri/src/db/entities/task.rs` - Task entity definition
- `src-tauri/src/db/task_operations.rs` - CRUD operations
- `src-tauri/src/db/migrations.rs` - Database migrations
- `src-tauri/src/commands.rs` - IPC command handlers
- `src-tauri/src/main.rs` - Command registration

---

## Summary

The task management system is a comprehensive full-stack feature with:

- **5 priority levels** (pinned, high, standard, long term, nit)
- **4 status states** (backlog, in_progress, completed, blocked)
- **3 complexity estimates** (easy, hard, deep dive) - optional
- **Multi-project associations** via bridge table
- **Batch operations** (set in progress, complete, delete)
- **Global access** via header task manager
- **Real-time filtering** (completed tasks hidden)
- **Type-safe architecture** across Rust and TypeScript

The system follows a clean layered architecture: Database → Rust Operations → IPC Commands → TypeScript Wrappers → React Components, with clear data flow and error handling at each layer.
