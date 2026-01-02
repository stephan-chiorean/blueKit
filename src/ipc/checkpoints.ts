/**
 * IPC wrappers for checkpoint operations.
 * 
 * Checkpoints are user-pinned git commits with metadata that can be used to:
 * - Track important project states (milestones, experiments, templates, backups)
 * - Create new projects from specific commit snapshots
 * - Organize and categorize project history
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import type { Checkpoint } from './types';

/**
 * Pin a commit as a checkpoint.
 * 
 * @param projectId - The project ID
 * @param gitCommitSha - The commit SHA to pin
 * @param name - Checkpoint name
 * @param checkpointType - Type: "milestone" | "experiment" | "template" | "backup"
 * @param description - Optional description
 * @param gitBranch - Optional branch name
 * @param gitUrl - Optional git URL
 * @param tags - Optional tags array
 * @returns The created checkpoint
 * 
 * @example
 * ```typescript
 * const checkpoint = await invokePinCheckpoint(
 *   'project-123',
 *   'abc123def456...',
 *   'v1.0 Release',
 *   'milestone',
 *   'First stable release',
 *   'main',
 *   'https://github.com/user/repo.git',
 *   ['release', 'stable']
 * );
 * ```
 */
export async function invokePinCheckpoint(
  projectId: string,
  gitCommitSha: string,
  name: string,
  checkpointType: 'milestone' | 'experiment' | 'template' | 'backup',
  description?: string,
  gitBranch?: string,
  gitUrl?: string,
  tags?: string[]
): Promise<Checkpoint> {
  return await invokeWithTimeout<Checkpoint>('pin_checkpoint', {
    projectId,
    gitCommitSha,
    name,
    checkpointType,
    description,
    gitBranch,
    gitUrl,
    tags,
  }, 10000);
}

/**
 * Get all checkpoints for a project.
 * 
 * @param projectId - The project ID
 * @returns Array of checkpoints, ordered by pinned date (newest first)
 * 
 * @example
 * ```typescript
 * const checkpoints = await invokeGetProjectCheckpoints('project-123');
 * console.log(`Found ${checkpoints.length} checkpoints`);
 * ```
 */
export async function invokeGetProjectCheckpoints(
  projectId: string
): Promise<Checkpoint[]> {
  return await invokeWithTimeout<Checkpoint[]>('get_project_checkpoints', {
    projectId,
  }, 5000);
}

/**
 * Unpin a checkpoint (delete it).
 * 
 * @param checkpointId - The checkpoint ID to unpin
 * 
 * @example
 * ```typescript
 * await invokeUnpinCheckpoint('checkpoint-123-456');
 * ```
 */
export async function invokeUnpinCheckpoint(
  checkpointId: string
): Promise<void> {
  return await invokeWithTimeout<void>('unpin_checkpoint', {
    checkpointId,
  }, 5000);
}

/**
 * Create a new project from a checkpoint.
 *
 * This command:
 * 1. Clones the git repository to a temporary directory
 * 2. Checks out the specific commit
 * 3. Copies files to the target location (excluding .git)
 * 4. Optionally registers the new project in the database
 * 5. Cleans up the temporary directory
 *
 * @param checkpointId - The checkpoint ID
 * @param targetPath - Absolute path where the new project should be created
 * @param projectTitle - Optional title for the new project
 * @param registerProject - Whether to automatically register the new project (default: true)
 * @param description - Optional description for the new project
 * @param projectType - Optional project type: "development" | "production" | "experiment" | "template" (for future use)
 * @returns Success message with project path
 *
 * @example
 * ```typescript
 * const result = await invokeCreateProjectFromCheckpoint(
 *   'checkpoint-123-456',
 *   '/path/to/new/project',
 *   'My New Project',
 *   true,
 *   'Development workspace from checkpoint',
 *   'development'
 * );
 * console.log(result); // "Project created successfully at: /path/to/new/project"
 * ```
 */
export async function invokeCreateProjectFromCheckpoint(
  checkpointId: string,
  targetPath: string,
  projectTitle?: string,
  registerProject: boolean = true,
  description?: string,
  projectType?: 'development' | 'production' | 'experiment' | 'template'
): Promise<string> {
  return await invokeWithTimeout<string>('create_project_from_checkpoint', {
    checkpointId,
    targetPath,
    projectTitle,
    registerProject,
    description,
    projectType,
  }, 60000); // 60 second timeout for git operations
}
