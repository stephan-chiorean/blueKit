/**
 * IPC commands for database-backed task operations.
 */

import { invokeWithTimeout } from '@/shared/utils/ipcTimeout';
import { Task as DbTask, TaskPriority, TaskStatus, TaskComplexity, TaskType } from '@/types/task';

/**
 * Get all tasks, optionally filtered by project IDs
 */
export async function invokeDbGetTasks(projectIds?: string[]): Promise<DbTask[]> {
  return await invokeWithTimeout<DbTask[]>('db_get_tasks', { projectIds }, 15000);
}

/**
 * Get tasks for a specific project
 */
export async function invokeDbGetProjectTasks(projectId: string): Promise<DbTask[]> {
  return await invokeWithTimeout<DbTask[]>('db_get_project_tasks', { projectId }, 15000);
}

/**
 * Get a single task by ID
 */
export async function invokeDbGetTask(taskId: string): Promise<DbTask | null> {
  return await invokeWithTimeout<DbTask | null>('db_get_task', { taskId }, 10000);
}

/**
 * Create a new task
 */
export async function invokeDbCreateTask(
  title: string,
  description: string | undefined,
  priority: TaskPriority,
  tags: string[],
  projectIds: string[],
  status?: TaskStatus,
  complexity?: TaskComplexity,
  type?: TaskType
): Promise<DbTask> {
  return await invokeWithTimeout<DbTask>(
    'db_create_task',
    {
      title,
      description: description ?? null,
      priority: priority || 'standard',
      tags,
      projectIds,
      status: status ?? null,
      complexity: complexity ?? null,
      type: type && type.trim().length > 0 ? type : null
    },
    10000
  );
}

/**
 * Update an existing task
 */
export async function invokeDbUpdateTask(
  taskId: string,
  title?: string,
  description?: string | null,
  priority?: TaskPriority,
  tags?: string[],
  projectIds?: string[],
  status?: TaskStatus,
  complexity?: TaskComplexity | null,
  type?: TaskType | null
): Promise<DbTask> {
  return await invokeWithTimeout<DbTask>(
    'db_update_task',
    {
      taskId,
      title,
      description,
      priority,
      tags,
      projectIds,
      status,
      complexity,
      type: type
    },
    10000
  );
}

/**
 * Delete a task
 */
export async function invokeDbDeleteTask(taskId: string): Promise<void> {
  return await invokeWithTimeout<void>('db_delete_task', { taskId }, 10000);
}

