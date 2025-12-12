/**
 * Task type for database-backed task management
 */

export type TaskPriority = 'pinned' | 'high' | 'standard' | 'long term' | 'nit';
export type TaskStatus = 'backlog' | 'in_progress' | 'completed' | 'blocked';
export type TaskComplexity = 'easy' | 'hard' | 'deep dive';
export type TaskType = 'bug' | 'investigation' | 'feature' | 'cleanup' | 'optimization' | 'chore';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectIds: string[];  // Projects this task is assigned to
  status: TaskStatus;
  complexity?: TaskComplexity;
  type?: TaskType;
}

