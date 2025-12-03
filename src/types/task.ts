/**
 * Task type for frontend-only task management
 */

export interface Task {
  id: string;
  name: string;
  description?: string;
  priority?: 'pinned' | 'high' | 'long term' | 'standard';
  status?: 'pending' | 'in_progress' | 'blocked' | 'completed';
  complexity?: number; // 1-10
  tags?: string[];
  acceptanceCriteria?: string; // The AC text that will be shown in the dialog
  createdAt?: string; // ISO date string for sorting by time
  updatedAt?: string; // ISO date string for sorting by time
}

