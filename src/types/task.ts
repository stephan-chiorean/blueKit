/**
 * Task type for database-backed task management
 */

export type TaskPriority = 'pinned' | 'high' | 'standard' | 'long term' | 'nit';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectIds: string[];  // Projects this task is assigned to
}

