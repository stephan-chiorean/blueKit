/**
 * IPC commands for project management, registry, artifacts, and watchers.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import type { ProjectEntry, ArtifactFile, Project } from './types';

// ============================================================================
// PROJECT REGISTRY (Now uses database backend)
// ============================================================================

/**
 * Gets all projects from the database.
 *
 * @deprecated Use invokeDbGetProjects() directly instead. This function is kept for backwards compatibility.
 * @returns A promise that resolves to an array of Project objects
 *
 * @example
 * ```typescript
 * const projects = await invokeGetProjectRegistry();
 * projects.forEach(project => {
 *   console.log(project.name); // "project-name"
 *   console.log(project.path); // "/absolute/path/to/project"
 * });
 * ```
 */
export async function invokeGetProjectRegistry(): Promise<Project[]> {
  return await invokeDbGetProjects();
}

/**
 * @deprecated This function is no longer needed as projects are now stored in the database.
 * Database queries don't need cache invalidation - just refetch the data.
 */
export function invalidateProjectRegistryCache(): void {
  // No-op: Database-backed, no cache to invalidate
}

/**
 * Gets all artifact files from a project's .bluekit directory.
 *
 * This command loads ALL resources from .bluekit/ in one shot: kits, walkthroughs,
 * agents, diagrams, tasks, etc. Frontend filters by `frontMatter.type` to separate them.
 *
 * This "load everything, filter later" approach:
 * - Keeps backend simple (one function, one watcher)
 * - Powers the Scrapbook tab (which needs everything)
 * - Avoids multiple watchers and duplicate loading logic
 * - Frontend filtering is cheap compared to file I/O
 *
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves to an array of ArtifactFile objects
 *
 * @example
 * ```typescript
 * const artifacts = await invokeGetProjectArtifacts('/path/to/project');
 * const kits = artifacts.filter(a => !a.frontMatter?.type || a.frontMatter.type === 'kit');
 * const walkthroughs = artifacts.filter(a => a.frontMatter?.type === 'walkthrough');
 * ```
 */
export async function invokeGetProjectArtifacts(projectPath: string): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_project_artifacts', { projectPath });
}

/**
 * Gets only changed artifacts based on file paths (incremental updates).
 *
 * This command is used when the file watcher detects changes - it returns
 * only those artifacts that have actually changed, with content and frontMatter
 * already populated from the backend cache.
 *
 * @param projectPath - The path to the project root directory
 * @param changedPaths - Array of file paths that were detected as changed
 * @returns A promise that resolves to an array of changed ArtifactFile objects
 *
 * @example
 * ```typescript
 * const changedArtifacts = await invokeGetChangedArtifacts(
 *   '/path/to/project',
 *   ['/path/to/project/.bluekit/kits/new-kit.md']
 * );
 * ```
 */
export async function invokeGetChangedArtifacts(
  projectPath: string,
  changedPaths: string[]
): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_changed_artifacts', {
    projectPath,
    changedPaths,
  });
}

/**
 * Starts watching a project's .bluekit directory for artifact file changes.
 *
 * This command sets up a file watcher that monitors the .bluekit directory
 * in the specified project path. When any artifact file (.md, .mmd, etc.) is
 * added, modified, or removed, it emits a Tauri event that the frontend can listen to.
 *
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves when the watcher is set up
 *
 * @example
 * ```typescript
 * await invokeWatchProjectArtifacts('/path/to/project');
 * // Then listen for 'project-artifacts-changed-{sanitized-path}' events
 * ```
 */
export async function invokeWatchProjectArtifacts(projectPath: string): Promise<void> {
  return await invokeWithTimeout<void>('watch_project_artifacts', { projectPath }, 5000); // Shorter timeout for watcher setup
}

/**
 * Gets the health status of all active file watchers.
 *
 * @returns A promise that resolves to a map of watcher names to their health status
 *
 * @example
 * ```typescript
 * const health = await invokeGetWatcherHealth();
 * Object.entries(health).forEach(([name, isAlive]) => {
 *   console.log(`${name}: ${isAlive ? 'alive' : 'dead'}`);
 * });
 * ```
 */
export async function invokeGetWatcherHealth(): Promise<Record<string, boolean>> {
  return await invokeWithTimeout<Record<string, boolean>>('get_watcher_health', {}, 3000); // Quick health check
}

/**
 * Stops a file watcher by event name.
 *
 * This function gracefully stops a running file watcher task by sending a
 * cancellation signal and waiting for the task to complete (with 5s timeout).
 *
 * @param eventName - The event name of the watcher to stop (e.g., 'project-artifacts-changed-foo')
 * @returns A promise that resolves when the watcher is stopped
 *
 * @example
 * ```typescript
 * await invokeStopWatcher('project-artifacts-changed-foo');
 * console.log('Watcher stopped successfully');
 * ```
 */
export async function invokeStopWatcher(eventName: string): Promise<void> {
  return await invokeWithTimeout<void>('stop_watcher', { eventName }, 5000); // Allow time for graceful shutdown
}

/**
 * Creates a new project from a clone.
 *
 * This command:
 * 1. Finds the clone by ID across all projects
 * 2. Clones the git repository to a temporary directory
 * 3. Checks out the specific commit
 * 4. Copies files to the target location (excluding .git)
 * 5. Optionally registers the new project in the registry
 * 6. Cleans up the temporary directory
 *
 * @param cloneId - The unique clone ID
 * @param targetPath - Absolute path where the new project should be created
 * @param projectTitle - Optional title for the new project (used if registering)
 * @param registerProject - Whether to automatically register the new project (default: true)
 * @returns A promise that resolves to a success message with project path
 *
 * @example
 * ```typescript
 * const result = await invokeCreateProjectFromClone(
 *   'bluekit-foundation-20251201',
 *   '/path/to/new/project',
 *   'My New Project',
 *   true
 * );
 * console.log(result); // "Project created successfully at: /path/to/new/project"
 * ```
 */
export async function invokeCreateProjectFromClone(
  cloneId: string,
  targetPath: string,
  projectTitle?: string,
  registerProject: boolean = true
): Promise<string> {
  return await invokeWithTimeout<string>('create_project_from_clone', {
    cloneId,
    targetPath,
    projectTitle,
    registerProject,
  }, 60000); // 60 second timeout for git operations
}

/**
 * Creates a new project directory and copies files to it.
 *
 * This command:
 * 1. Creates a new project directory at the specified path
 * 2. Creates .bluekit directory structure
 * 3. Copies source files to appropriate subdirectories based on file type
 * 4. Optionally registers the project in the registry
 *
 * @param targetPath - The absolute path where the new project should be created
 * @param projectTitle - Title for the new project
 * @param sourceFiles - Array of tuples containing (filePath, fileType) where fileType is "kit", "walkthrough", or "diagram"
 * @param registerProject - Whether to automatically register the new project (default: true)
 * @returns A promise that resolves to the project path
 *
 * @example
 * ```typescript
 * const result = await invokeCreateNewProject(
 *   '/path/to/new/project',
 *   'My New Project',
 *   [
 *     ['/path/to/kit.md', 'kit'],
 *     ['/path/to/walkthrough.md', 'walkthrough']
 *   ],
 *   true
 * );
 * ```
 */
export async function invokeCreateNewProject(
  targetPath: string,
  projectTitle: string,
  sourceFiles: Array<[string, string]>,
  registerProject: boolean = true
): Promise<string> {
  return await invokeWithTimeout<string>('create_new_project', {
    targetPath,
    projectTitle,
    sourceFiles,
    registerProject,
  });
}

/**
 * Opens a project in the specified editor (Cursor or VSCode).
 *
 * @param projectPath - Absolute path to the project directory
 * @param editor - The editor to use: 'cursor' or 'vscode'
 * @returns Promise that resolves when the editor is opened
 *
 * @example
 * ```typescript
 * await invokeOpenProjectInEditor('/path/to/project', 'cursor');
 * await invokeOpenProjectInEditor('/path/to/project', 'vscode');
 * ```
 */
export async function invokeOpenProjectInEditor(
  projectPath: string,
  editor: 'cursor' | 'vscode'
): Promise<void> {
  return await invokeWithTimeout<void>(
    'open_project_in_editor',
    {
      projectPath,
      editor,
    },
    10000 // 10 second timeout for opening editor
  );
}

// ============================================================================
// DATABASE-BACKED PROJECT MANAGEMENT (Phase 1)
// ============================================================================

/**
 * Gets all projects from the database.
 *
 * @returns A promise that resolves to an array of Project objects from the database
 *
 * @example
 * ```typescript
 * const projects = await invokeDbGetProjects();
 * projects.forEach(project => {
 *   console.log(project.name, project.gitConnected);
 * });
 * ```
 */
export async function invokeDbGetProjects(): Promise<Project[]> {
  return await invokeWithTimeout<Project[]>('db_get_projects');
}

/**
 * Creates a new project in the database.
 *
 * @param name - Project name
 * @param path - Absolute path to project directory
 * @param description - Optional project description
 * @param tags - Optional array of tags
 * @returns A promise that resolves to the created Project object
 *
 * @example
 * ```typescript
 * const project = await invokeDbCreateProject(
 *   'My Project',
 *   '/path/to/project',
 *   'A description',
 *   ['tag1', 'tag2']
 * );
 * ```
 */
export async function invokeDbCreateProject(
  name: string,
  path: string,
  description?: string,
  tags?: string[]
): Promise<Project> {
  return await invokeWithTimeout<Project>('db_create_project', {
    name,
    path,
    description,
    tags,
  });
}

/**
 * Updates a project's name and/or description in the database.
 *
 * @param projectId - The project ID
 * @param name - Optional new name for the project
 * @param description - Optional new description for the project
 * @returns A promise that resolves to the updated Project object
 *
 * @example
 * ```typescript
 * const project = await invokeDbUpdateProject('project-id-123', 'New Name', 'New description');
 * console.log(project.name, project.description);
 * ```
 */
export async function invokeDbUpdateProject(
  projectId: string,
  name?: string,
  description?: string
): Promise<Project> {
  return await invokeWithTimeout<Project>('db_update_project', {
    projectId,
    name,
    description,
  });
}

/**
 * Deletes a project from the database.
 *
 * @param projectId - The project ID to delete
 * @returns A promise that resolves when the project is deleted
 *
 * @example
 * ```typescript
 * await invokeDbDeleteProject('project-id-123');
 * console.log('Project deleted');
 * ```
 */
export async function invokeDbDeleteProject(projectId: string): Promise<void> {
  return await invokeWithTimeout<void>('db_delete_project', { projectId });
}

/**
 * Connects a project to git by detecting git metadata.
 *
 * This command automatically detects git remote URL, current branch,
 * and latest commit SHA from the project directory.
 *
 * @param projectId - The project ID
 * @returns A promise that resolves to the updated Project object
 *
 * @example
 * ```typescript
 * const project = await invokeConnectProjectGit('project-id-123');
 * console.log(project.gitUrl, project.gitBranch, project.lastCommitSha);
 * ```
 */
export async function invokeConnectProjectGit(projectId: string): Promise<Project> {
  return await invokeWithTimeout<Project>('connect_project_git', { projectId });
}

/**
 * Disconnects a project from git by clearing git metadata.
 *
 * @param projectId - The project ID
 * @returns A promise that resolves to the updated Project object
 *
 * @example
 * ```typescript
 * const project = await invokeDisconnectProjectGit('project-id-123');
 * console.log(project.gitConnected); // false
 * ```
 */
export async function invokeDisconnectProjectGit(projectId: string): Promise<Project> {
  return await invokeWithTimeout<Project>('disconnect_project_git', { projectId });
}

