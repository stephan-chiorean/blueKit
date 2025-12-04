---
id: task-database-flow
alias: Task Database Flow
type: walkthrough
is_base: false
version: 1
tags:
  - database
  - tasks
  - architecture
description: Understanding how tasks flow from UI interactions through IPC commands to database operations
complexity: simple
format: documentation
---
# Task Database Flow

This walkthrough explains how BlueKit's task management system works from the user interface down to the database layer.

## Overview

Tasks in BlueKit are stored in a SQLite database and managed through three main layers:

1. **Frontend (React)** - UI components that display and interact with tasks
2. **IPC Commands (Tauri)** - Bridge between frontend and backend
3. **Database Operations (SeaORM)** - Rust functions that read/write to SQLite

## The Three Core Operations

### 1. Loading Tasks

**User Journey:** User opens the Tasks tab → sees their task list

**Flow:**
- `TasksTabContent` component calls `loadTasks()` on mount (src/components/tasks/TasksTabContent.tsx:56)
- Frontend calls `invokeDbGetTasks()` or `invokeDbGetProjectTasks()` (src/ipc.ts:847)
- IPC bridges to Rust command `db_get_tasks` (src-tauri/src/commands.rs:1731)
- Database operation `get_tasks()` queries the `task` table (src-tauri/src/db/task_operations.rs:24)
- Returns array of `TaskDto` objects with all metadata
- React state updates and renders task cards

**Key Detail:** If filtering by project, the database joins the `task_project` table to find tasks linked to specific projects.

### 2. Creating Tasks

**User Journey:** User clicks "Add Task" → fills form → submits

**Flow:**
- User fills `TaskCreateDialog` form with title, description, priority, tags, and projects (src/components/tasks/TaskCreateDialog.tsx:46)
- Form validation checks for required title
- Frontend calls `invokeDbCreateTask()` with task data (src/ipc.ts:868)
- IPC bridges to Rust command `db_create_task` (src-tauri/src/commands.rs:1764)
- Database operation `create_task()` (src-tauri/src/db/task_operations.rs:81):
  - Generates new UUID for task ID
  - Creates timestamp for `createdAt` and `updatedAt`
  - Inserts into `task` table
  - Creates links in `task_project` table for each selected project
- Returns newly created `TaskDto`
- Frontend reloads task list to show the new task
- Success toast notification appears

**Key Detail:** The task-to-project relationship is many-to-many. One task can belong to multiple projects through the `task_project` join table.

### 3. Deleting Tasks

**User Journey:** User opens task details → clicks delete → confirms

**Flow:**
- User clicks delete in `TaskDialog`
- Frontend calls `invokeDbDeleteTask(taskId)` (src/ipc.ts:909)
- IPC bridges to Rust command `db_delete_task` (src-tauri/src/commands.rs)
- Database operation deletes:
  - Task record from `task` table
  - Associated links from `task_project` table (cascade delete)
- Frontend removes task from selection if selected
- Frontend reloads task list
- Success toast notification appears

## Data Structure

**Task Type** (src/types/task.ts:7):
```typescript
{
  id: string           // UUID generated on creation
  title: string        // Required
  description?: string // Optional
  priority: TaskPriority // 'pinned' | 'high' | 'standard' | 'long term' | 'nit'
  tags: string[]       // Array of tags
  createdAt: string    // ISO timestamp
  updatedAt: string    // ISO timestamp
  projectIds: string[] // Associated projects
}
```

## Database Tables

**task table:**
- Stores core task data (id, title, description, priority, tags, timestamps)

**task_project table:**
- Join table creating many-to-many relationships
- Links task IDs to project IDs
- Enables tasks to belong to multiple projects

## State Management

Tasks are loaded fresh from the database each time:
- When component mounts
- After creating a task
- After deleting a task
- When switching between workspace view and project view

This ensures the UI always reflects the current database state without complex client-side caching.

## Selection System

Task selection (checkboxes) is handled purely in React state:
- `selectedTaskIds` Set tracks which tasks are selected
- Selection persists within the current view
- Selection clears after bulk operations
- Selection is independent of database state

## Timeouts

IPC calls have different timeout durations based on expected operation time:
- `get_tasks`: 15 seconds (may need to join many records)
- `create_task`: 10 seconds
- `delete_task`: 10 seconds

If operations exceed these timeouts, an error is shown to the user.
