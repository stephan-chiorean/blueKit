/**
 * IPC (Inter-Process Communication) wrapper functions.
 * 
 * This file provides type-safe wrappers around Tauri's `invoke` API.
 * Instead of calling `invoke` directly with string command names,
 * we create typed functions that provide:
 * - Type safety (TypeScript knows the return type)
 * - Better IDE autocomplete
 * - Centralized error handling
 * - Documentation via JSDoc comments
 * 
 * How IPC works:
 * 1. Frontend calls a function in this file (e.g., `invokePing()`)
 * 2. The function calls Tauri's `invoke` with the command name
 * 3. Tauri sends the request to the Rust backend
 * 4. Rust command handler processes the request
 * 5. Response is sent back to the frontend
 * 6. Promise resolves with the result
 */

import { invokeWithTimeout, TimeoutError } from './utils/ipcTimeout';
import { Task as DbTask, TaskPriority, TaskStatus, TaskComplexity } from './types/task';

// Re-export TimeoutError for convenience
export { TimeoutError };

// ============================================================================
// PROJECT REGISTRY CACHE
// ============================================================================
// Cache for project registry to prevent redundant IPC calls
// Multiple components call invokeGetProjectRegistry on mount, this deduplicates them
let projectRegistryCache: ProjectEntry[] | null = null;
let projectRegistryPromise: Promise<ProjectEntry[]> | null = null;

/**
 * Type definition for the AppInfo structure returned by `get_app_info`.
 * 
 * This interface must match the `AppInfo` struct in `src-tauri/src/commands.rs`.
 * TypeScript uses this to provide type checking and autocomplete.
 */
export interface AppInfo {
  /** Application name */
  name: string;
  /** Application version */
  version: string;
  /** Platform the app is running on (e.g., "windows", "macos", "linux") */
  platform: string;
}

/**
 * Type definition for an artifact file returned by `get_project_artifacts`.
 *
 * Artifacts represent any file in the .bluekit directory: kits, walkthroughs,
 * agents, diagrams, tasks, etc. This generic type allows us to load all
 * .bluekit resources at once and filter by type on the frontend.
 *
 * This interface must match the `ArtifactFile` struct in `src-tauri/src/commands.rs`.
 */
export interface ArtifactFile {
  /** Name of the artifact file (without extension) */
  name: string;
  /** Full path to the artifact file */
  path: string;
  /** File content (optional - populated when using cache) */
  content?: string;
  /** Parsed YAML front matter */
  frontMatter?: KitFrontMatter;
}

/**
 * YAML front matter structure for kit files.
 */
export interface KitFrontMatter {
  /** Unique identifier for the kit */
  id?: string;
  /** Display alias/name for the kit */
  alias?: string;
  /** Title (used for tasks as alternative to alias) */
  title?: string;
  /** Whether this is a base kit */
  is_base?: boolean;
  /** Version number */
  version?: number;
  /** Tags array */
  tags?: string[];
  /** Description of the kit */
  description?: string;
  /** Type of the kit (e.g., 'walkthrough', 'agent', 'task') */
  type?: string;
  /** Capabilities array (used for agents) */
  capabilities?: string[];
  /** Execution notes (used for agents) */
  executionNotes?: string;
  /** Task priority (used for tasks) */
  priority?: string;
  /** Task status (used for tasks) */
  status?: string;
  /** Task complexity score 1-10 (used for tasks) */
  complexity?: number;
}

/**
 * Folder group structure for organizing resources within a folder.
 *
 * Similar to blueprint layers, groups allow organizing artifacts into named categories.
 * This interface must match the `FolderGroup` struct in `src-tauri/src/commands.rs`.
 */
export interface FolderGroup {
  /** Unique identifier for the group */
  id: string;
  /** Display order (lower numbers appear first) */
  order: number;
  /** Display name for the group */
  name: string;
  /** Array of artifact file paths belonging to this group */
  resourcePaths: string[];
}

/**
 * Folder configuration from config.json.
 *
 * Each folder in artifact directories can contain a config.json file
 * with metadata about the folder, including optional groups for organizing resources.
 *
 * This interface must match the `FolderConfig` struct in `src-tauri/src/commands.rs`.
 */
export interface FolderConfig {
  /** Unique identifier (slugified-name-timestamp) */
  id: string;
  /** Display name for the folder */
  name: string;
  /** Optional description of the folder's purpose */
  description?: string;
  /** Tags for categorization */
  tags: string[];
  /** Optional hex color for visual grouping (e.g., "#3B82F6") */
  color?: string;
  /** Optional icon identifier (Lucide icon name) */
  icon?: string;
  /** Optional groups for organizing resources within the folder */
  groups?: FolderGroup[];
  /** Extensible custom metadata (future-proof for Postgres migration) */
  metadata?: Record<string, any>;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last updated timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Folder information for artifact organization.
 *
 * Represents a folder within an artifact type directory (kits, walkthroughs, diagrams).
 * Folders can contain artifacts and other folders (nested).
 *
 * This interface must match the `ArtifactFolder` struct in `src-tauri/src/commands.rs`.
 */
export interface ArtifactFolder {
  /** Folder name (directory name) */
  name: string;
  /** Full path to the folder */
  path: string;
  /** Parent folder path (if nested), undefined if root level */
  parentPath?: string;
  /** Parsed config.json if exists */
  config?: FolderConfig;
  /** Number of direct child artifacts */
  artifactCount: number;
  /** Number of direct child folders */
  folderCount: number;
}

/**
 * Tree node for hierarchical folder display.
 *
 * Built on the frontend from flat ArtifactFolder and ArtifactFile arrays.
 * Used for rendering nested folder structures in the UI.
 */
export interface FolderTreeNode {
  /** Folder information */
  folder: ArtifactFolder;
  /** Child folder nodes */
  children: FolderTreeNode[];
  /** Artifacts directly in this folder */
  artifacts: ArtifactFile[];
  /** Whether the folder is expanded in the UI */
  isExpanded: boolean;
}

/**
 * Type definition for a project entry in the project registry.
 *
 * This interface must match the `ProjectEntry` struct in `src-tauri/src/commands.rs`.
 */
export interface ProjectEntry {
  /** Unique identifier for the project */
  id: string;
  /** Project title/name */
  title: string;
  /** Project description */
  description: string;
  /** Absolute path to the project directory */
  path: string;
}

/**
 * Type definition for a scrapbook item (folder or file).
 *
 * This interface must match the `ScrapbookItem` struct in `src-tauri/src/commands.rs`.
 */
export interface ScrapbookItem {
  /** Name of the folder or file */
  name: string;
  /** Full path to the folder or file */
  path: string;
  /** Whether this is a folder (true) or file (false) */
  is_folder: boolean;
}

/**
 * Type definition for a blueprint task.
 *
 * This interface must match the `BlueprintTask` struct in `src-tauri/src/commands.rs`.
 */
export interface BlueprintTask {
  /** Task ID */
  id: string;
  /** Task markdown file name (e.g., "project-setup.md") */
  taskFile: string;
  /** Task description */
  description: string;
}

/**
 * Type definition for a blueprint layer.
 *
 * This interface must match the `BlueprintLayer` struct in `src-tauri/src/commands.rs`.
 */
export interface BlueprintLayer {
  /** Layer ID */
  id: string;
  /** Layer order */
  order: number;
  /** Layer name */
  name: string;
  /** Tasks in this layer */
  tasks: BlueprintTask[];
}

/**
 * Type definition for blueprint metadata from blueprint.json.
 *
 * This interface must match the `BlueprintMetadata` struct in `src-tauri/src/commands.rs`.
 */
export interface BlueprintMetadata {
  /** Blueprint ID */
  id: string;
  /** Blueprint name */
  name: string;
  /** Blueprint version */
  version: number;
  /** Blueprint description */
  description: string;
  /** Creation timestamp */
  createdAt: string;
  /** Layers in this blueprint */
  layers: BlueprintLayer[];
}

/**
 * Type definition for a blueprint with metadata.
 *
 * This interface must match the `Blueprint` struct in `src-tauri/src/commands.rs`.
 */
export interface Blueprint {
  /** Blueprint directory name */
  name: string;
  /** Full path to the blueprint directory */
  path: string;
  /** Blueprint metadata from blueprint.json */
  metadata: BlueprintMetadata;
}

/**
 * Type definition for clone metadata from clones.json.
 *
 * This interface must match the `CloneMetadata` struct in `src-tauri/src/commands.rs`.
 */
export interface CloneMetadata {
  /** Unique clone ID (format: slugified-name-YYYYMMDD) */
  id: string;
  /** Display name (e.g., "BlueKit Foundation") */
  name: string;
  /** Description of what this clone represents */
  description: string;
  /** Git repository URL */
  gitUrl: string;
  /** Full commit hash (40 chars) */
  gitCommit: string;
  /** Branch name (if not detached HEAD) */
  gitBranch?: string;
  /** Git tag (if HEAD is on a tag) */
  gitTag?: string;
  /** Array of tags for categorization */
  tags: string[];
  /** ISO 8601 timestamp */
  createdAt: string;
  /** Optional additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Type definition for task acceptance criteria.
 *
 * This interface must match the `TaskAcceptanceCriteria` struct in `src-tauri/src/commands.rs`.
 */
export interface TaskAcceptanceCriteria {
  /** Unique identifier for the acceptance criterion */
  id: string;
  /** Description of the acceptance criterion */
  description: string;
  /** Whether this criterion has been met */
  completed: boolean;
}

/**
 * Type definition for a task item.
 *
 * This interface must match the `Task` struct in `src-tauri/src/commands.rs`.
 */
export interface Task {
  /** Unique identifier for the task */
  id: string;
  /** Task title/summary */
  title: string;
  /** Detailed task description */
  description?: string;
  /** Task status: "backlog", "in_progress", "completed", "blocked" */
  status: string;
  /** Priority level: "low", "medium", "high", "critical" */
  priority: string;
  /** Complexity score (1-10, where 1 is simplest) */
  complexity: number;
  /** List of acceptance criteria */
  acceptance_criteria: TaskAcceptanceCriteria[];
  /** Optional tags for categorization */
  tags: string[];
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last updated timestamp (ISO 8601) */
  updated_at: string;
  /** Optional assignee */
  assignee?: string;
  /** Optional due date (ISO 8601) */
  due_date?: string;
}


/**
 * Simple ping command to test IPC communication.
 * 
 * This is the simplest IPC command - it takes no parameters and returns a string.
 * Use this to verify that IPC communication is working correctly.
 * 
 * @returns A promise that resolves to "pong"
 * 
 * @example
 * ```typescript
 * const result = await invokePing();
 * console.log(result); // "pong"
 * ```
 */
export async function invokePing(): Promise<string> {
  // `invoke<T>` is Tauri's function to call backend commands
  // The generic type parameter `<string>` tells TypeScript the return type
  // The first argument is the command name (must match the function name in Rust)
  // The second argument is an optional object with parameters (none needed here)
  return await invokeWithTimeout<string>('ping', {}, 5000); // Quick timeout for ping
}

/**
 * Gets application information including name, version, and platform.
 * 
 * This command demonstrates how to receive structured data (an object) from the backend.
 * The backend returns a JSON object that TypeScript automatically converts to the AppInfo interface.
 * 
 * @returns A promise that resolves to an AppInfo object
 * 
 * @example
 * ```typescript
 * const info = await invokeGetAppInfo();
 * console.log(info.name);     // "bluekit-app"
 * console.log(info.version);  // "0.1.0"
 * console.log(info.platform); // "macos" (or "windows", "linux")
 * ```
 */
export async function invokeGetAppInfo(): Promise<AppInfo> {
  // The return type is `Promise<AppInfo>`, which means TypeScript knows
  // the structure of the returned object and will provide autocomplete
  return await invokeWithTimeout<AppInfo>('get_app_info');
}

/**
 * Example command that demonstrates error handling.
 * 
 * This command shows how to handle errors from IPC calls.
 * If the backend returns an error, the promise will reject and you can catch it.
 * 
 * @param shouldFail - If true, the command will return an error
 * @returns A promise that resolves to "Success!" or rejects with an error
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await invokeExampleError(false);
 *   console.log(result); // "Success!"
 * } catch (error) {
 *   console.error('Error:', error); // Error message if shouldFail is true
 * }
 * ```
 */
export async function invokeExampleError(shouldFail: boolean): Promise<string> {
  // Commands can accept parameters by passing an object as the second argument
  // The keys must match the parameter names in the Rust function
  return await invokeWithTimeout<string>('example_error', { shouldFail });
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
 * Gets the project registry from ~/.bluekit/projectRegistry.json.
 *
 * This command reads the project registry file from the user's home directory
 * and returns a list of all registered projects.
 *
 * @returns A promise that resolves to an array of ProjectEntry objects
 *
 * @example
 * ```typescript
 * const projects = await invokeGetProjectRegistry();
 * projects.forEach(project => {
 *   console.log(project.title); // "project-name"
 *   console.log(project.path); // "/absolute/path/to/project"
 * });
 * ```
 */
export async function invokeGetProjectRegistry(): Promise<ProjectEntry[]> {
  // Return cached data if available
  if (projectRegistryCache) {
    return projectRegistryCache;
  }

  // If a request is already in flight, return that promise (deduplication)
  if (projectRegistryPromise) {
    return projectRegistryPromise;
  }

  // Make the request
  projectRegistryPromise = invokeWithTimeout<ProjectEntry[]>('get_project_registry')
    .then(result => {
      projectRegistryCache = result;
      projectRegistryPromise = null;
      return result;
    })
    .catch(error => {
      projectRegistryPromise = null; // Clear promise on error so retry is possible
      throw error;
    });

  return projectRegistryPromise;
}

/**
 * Invalidates the project registry cache.
 *
 * Call this when the project registry file changes to force a reload
 * on the next call to invokeGetProjectRegistry.
 *
 * @example
 * ```typescript
 * // In your file watcher listener:
 * listen('project-registry-changed', () => {
 *   invalidateProjectRegistryCache();
 *   loadProjects(); // This will now fetch fresh data
 * });
 * ```
 */
export function invalidateProjectRegistryCache(): void {
  projectRegistryCache = null;
  projectRegistryPromise = null;
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
 * Reads the contents of a file.
 *
 * @param filePath - The absolute path to the file to read
 * @returns A promise that resolves to the file contents as a string
 *
 * @example
 * ```typescript
 * const contents = await invokeReadFile('/path/to/file.md');
 * console.log(contents); // File contents as string
 * ```
 */
export async function invokeReadFile(filePath: string): Promise<string> {
  return await invokeWithTimeout<string>('read_file', { filePath });
}

/**
 * Writes content to a file.
 *
 * This command writes the provided content to the specified file path.
 * The file will be created if it doesn't exist, or overwritten if it does.
 *
 * @param filePath - The absolute path to the file to write
 * @param content - The content to write to the file
 * @returns Promise that resolves when the file is written
 * @throws Error if the file cannot be written
 */
export async function invokeWriteFile(filePath: string, content: string): Promise<void> {
  return await invokeWithTimeout<void>('write_file', { filePath, content });
}

/**
 * Copies a kit file to a project's .bluekit directory.
 * 
 * This command reads the source kit file and writes it to the target project's
 * .bluekit/kits directory. It creates the directory structure if it doesn't exist.
 * 
 * @param sourceFilePath - The absolute path to the source kit file
 * @param targetProjectPath - The absolute path to the target project root directory
 * @returns A promise that resolves to the path of the copied file
 * 
 * @example
 * ```typescript
 * const result = await invokeCopyKitToProject(
 *   '/path/to/source/kit.md',
 *   '/path/to/target/project'
 * );
 * console.log(result); // "/path/to/target/project/.bluekit/kits/kit.md"
 * ```
 */
export async function invokeCopyKitToProject(
  sourceFilePath: string,
  targetProjectPath: string,
): Promise<string> {
  return await invokeWithTimeout<string>('copy_kit_to_project', {
    sourceFilePath,
    targetProjectPath,
  });
}

/**
 * Copies a walkthrough file to a project's .bluekit directory.
 * 
 * This command reads the source walkthrough file and writes it to the target project's
 * .bluekit/walkthroughs directory. It creates the directory structure if it doesn't exist.
 * 
 * @param sourceFilePath - The absolute path to the source walkthrough file
 * @param targetProjectPath - The absolute path to the target project root directory
 * @returns A promise that resolves to the path of the copied file
 * 
 * @example
 * ```typescript
 * const result = await invokeCopyWalkthroughToProject(
 *   '/path/to/source/walkthrough.md',
 *   '/path/to/target/project'
 * );
 * console.log(result); // "/path/to/target/project/.bluekit/walkthroughs/walkthrough.md"
 * ```
 */
export async function invokeCopyWalkthroughToProject(
  sourceFilePath: string,
  targetProjectPath: string,
): Promise<string> {
  return await invokeWithTimeout<string>('copy_walkthrough_to_project', {
    sourceFilePath,
    targetProjectPath,
  });
}

/**
 * Copies a diagram file to a project's .bluekit directory.
 * 
 * This command reads the source diagram file (.mmd or .mermaid) and writes it to the target project's
 * .bluekit/diagrams directory. It creates the directory structure if it doesn't exist.
 * 
 * @param sourceFilePath - The absolute path to the source diagram file
 * @param targetProjectPath - The absolute path to the target project root directory
 * @returns A promise that resolves to the path of the copied file
 * 
 * @example
 * ```typescript
 * const result = await invokeCopyDiagramToProject(
 *   '/path/to/source/diagram.mmd',
 *   '/path/to/target/project'
 * );
 * console.log(result); // "/path/to/target/project/.bluekit/diagrams/diagram.mmd"
 * ```
 */
export async function invokeCopyDiagramToProject(
  sourceFilePath: string,
  targetProjectPath: string,
): Promise<string> {
  return await invokeWithTimeout<string>('copy_diagram_to_project', {
    sourceFilePath,
    targetProjectPath,
  });
}

/**
 * Copies a blueprint directory to a project's .bluekit/blueprints directory.
 *
 * This command recursively copies the entire blueprint directory (including blueprint.json
 * and all task files) to the target project's .bluekit/blueprints directory.
 *
 * @param sourceBlueprintPath - The absolute path to the source blueprint directory
 * @param targetProjectPath - The absolute path to the target project root directory
 * @returns A promise that resolves to the path of the copied blueprint directory
 *
 * @example
 * ```typescript
 * const result = await invokeCopyBlueprintToProject(
 *   '/path/to/source/blueprint',
 *   '/path/to/target/project'
 * );
 * console.log(result); // "/path/to/target/project/.bluekit/blueprints/blueprint-name"
 * ```
 */
export async function invokeCopyBlueprintToProject(
  sourceBlueprintPath: string,
  targetProjectPath: string,
): Promise<string> {
  return await invokeWithTimeout<string>('copy_blueprint_to_project', {
    sourceBlueprintPath,
    targetProjectPath,
  });
}

/**
 * Gets scrapbook items (folders and loose .md files) from the .bluekit directory.
 *
 * This command scans the .bluekit directory and returns all folders and loose .md files
 * that are not in the known subdirectories (kits, agents, walkthroughs).
 *
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves to an array of ScrapbookItem objects
 *
 * @example
 * ```typescript
 * const items = await invokeGetScrapbookItems('/path/to/project');
 * items.forEach(item => {
 *   if (item.is_folder) {
 *     console.log('Folder:', item.name);
 *   } else {
 *     console.log('File:', item.name);
 *   }
 * });
 * ```
 */
export async function invokeGetScrapbookItems(projectPath: string): Promise<ScrapbookItem[]> {
  return await invokeWithTimeout<ScrapbookItem[]>('get_scrapbook_items', { projectPath });
}

/**
 * Gets markdown files from a specific folder in the .bluekit directory.
 *
 * @param folderPath - The absolute path to the folder
 * @returns A promise that resolves to an array of ArtifactFile objects
 *
 * @example
 * ```typescript
 * const files = await invokeGetFolderMarkdownFiles('/path/to/project/.bluekit/custom');
 * files.forEach(file => {
 *   console.log(file.name); // "my-file" (without .md extension)
 *   console.log(file.path); // "/path/to/project/.bluekit/custom/my-file.md"
 * });
 * ```
 */
export async function invokeGetFolderMarkdownFiles(folderPath: string): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_folder_markdown_files', { folderPath });
}

/**
 * Gets all plan files from Claude or Cursor plans directory.
 *
 * This command reads markdown files from either `~/.claude/plans` or `~/.cursor/plans`
 * based on the source parameter.
 *
 * @param source - Either "claude" or "cursor" to specify which plans directory to read
 * @returns A promise that resolves to an array of ArtifactFile objects
 *
 * @example
 * ```typescript
 * const claudePlans = await invokeGetPlansFiles('claude');
 * const cursorPlans = await invokeGetPlansFiles('cursor');
 * ```
 */
export async function invokeGetPlansFiles(source: 'claude' | 'cursor'): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_plans_files', { source });
}

/**
 * Gets all blueprints from the .bluekit/blueprints directory.
 *
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves to an array of Blueprint objects
 *
 * @example
 * ```typescript
 * const blueprints = await invokeGetBlueprints('/path/to/project');
 * blueprints.forEach(blueprint => {
 *   console.log(blueprint.metadata.name); // "BlueKit Backend"
 *   console.log(blueprint.metadata.layers.length); // Number of layers
 * });
 * ```
 */
export async function invokeGetBlueprints(projectPath: string): Promise<Blueprint[]> {
  return await invokeWithTimeout<Blueprint[]>('get_blueprints', { projectPath });
}

/**
 * Gets the content of a task file from a blueprint directory.
 *
 * @param blueprintPath - The path to the blueprint directory
 * @param taskFile - The name of the task markdown file (e.g., "project-setup.md")
 * @returns A promise that resolves to the task file contents as a string
 *
 * @example
 * ```typescript
 * const content = await invokeGetBlueprintTaskFile(
 *   '/path/to/project/.bluekit/blueprints/backend-v1',
 *   'project-setup.md'
 * );
 * console.log(content); // Markdown content of the task file
 * ```
 */
export async function invokeGetBlueprintTaskFile(
  blueprintPath: string,
  taskFile: string,
): Promise<string> {
  return await invokeWithTimeout<string>('get_blueprint_task_file', {
    blueprintPath,
    taskFile,
  });
}

/**
 * Gets all diagram files (.mmd and .mermaid) from the .bluekit/diagrams directory.
 *
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves to an array of ArtifactFile objects
 *
 * @example
 * ```typescript
 * const diagrams = await invokeGetProjectDiagrams('/path/to/project');
 * diagrams.forEach(diagram => {
 *   console.log(diagram.name); // "my-diagram" (without extension)
 *   console.log(diagram.path); // "/path/to/project/.bluekit/diagrams/my-diagram.mmd"
 * });
 * ```
 */
export async function invokeGetProjectDiagrams(projectPath: string): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_project_diagrams', { projectPath });
}

/**
 * Gets all clones from the .bluekit/clones.json file.
 *
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves to an array of CloneMetadata objects
 *
 * @example
 * ```typescript
 * const clones = await invokeGetProjectClones('/path/to/project');
 * clones.forEach(clone => {
 *   console.log(clone.name); // "BlueKit Foundation"
 *   console.log(clone.gitUrl); // "https://github.com/user/blueKit.git"
 *   console.log(clone.gitCommit); // "1ab1a39712c2e5c765182525ccf497b0cdddc91b"
 * });
 * ```
 */
export async function invokeGetProjectClones(projectPath: string): Promise<CloneMetadata[]> {
  return await invokeWithTimeout<CloneMetadata[]>('get_project_clones', { projectPath });
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
 * How to add a new IPC command:
 *
 * 1. Add the command handler in `src-tauri/src/commands.rs`:
 *    ```rust
 *    #[tauri::command]
 *    pub async fn my_command(param: String) -> Result<String, String> {
 *        Ok(format!("Received: {}", param))
 *    }
 *    ```
 *
 * 2. Register it in `src-tauri/src/main.rs`:
 *    Add `commands::my_command` to the `invoke_handler![]` macro
 *
 * 3. Add a typed wrapper function in this file:
 *    ```typescript
 *    export async function invokeMyCommand(param: string): Promise<string> {
 *        return await invoke<string>('my_command', { param });
 *    }
 *    ```
 *
 * 4. Use it in your React components:
 *    ```typescript
 *    import { invokeMyCommand } from './ipc';
 *    const result = await invokeMyCommand('Hello');
 *    ```
 */

// ============================================================================
// DATABASE-BACKED TASK IPC WRAPPERS
// ============================================================================

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
  complexity?: TaskComplexity
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
      complexity: complexity ?? null
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
  complexity?: TaskComplexity | null
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
      complexity
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

/**
 * Delete resource files from the filesystem.
 *
 * This command deletes one or more resource files (kits, walkthroughs, agents, diagrams).
 * All paths are validated to be within `.bluekit` directories for safety.
 *
 * @param filePaths - Array of absolute file paths to delete
 * @returns Promise that resolves when all files are deleted
 * @throws Error if any deletions fail
 *
 * @example
 * ```typescript
 * await deleteResources([
 *   '/path/to/project/.bluekit/kits/my-kit.md',
 *   '/path/to/project/.bluekit/walkthroughs/my-walkthrough.md'
 * ]);
 * ```
 */
export async function deleteResources(filePaths: string[]): Promise<void> {
  return await invokeWithTimeout<void>('delete_resources', { filePaths }, 10000);
}

/**
 * Update metadata in a resource file's YAML front matter.
 *
 * This command updates the YAML front matter of a resource file (kit, walkthrough,
 * agent, or diagram) while preserving the markdown body content.
 *
 * @param filePath - Absolute path to the resource file
 * @param metadata - Object containing fields to update (alias, description, tags)
 * @returns Promise that resolves when metadata is updated
 * @throws Error if the update fails
 *
 * @example
 * ```typescript
 * await updateResourceMetadata(
 *   '/path/to/project/.bluekit/kits/my-kit.md',
 *   {
 *     alias: 'Updated Kit Name',
 *     description: 'Updated description',
 *     tags: ['tag1', 'tag2']
 *   }
 * );
 * ```
 */
export async function updateResourceMetadata(
  filePath: string,
  metadata: {
    alias?: string;
    description?: string;
    tags?: string[];
  }
): Promise<void> {
  return await invokeWithTimeout<void>(
    'update_resource_metadata',
    {
      filePath,
      alias: metadata.alias,
      description: metadata.description,
      tags: metadata.tags,
    },
    10000
  );
}

/**
 * Gets all folders in a specific artifact type directory.
 *
 * Scans the specified artifact directory (kits, walkthroughs, diagrams)
 * and returns all folders found, including their config.json metadata.
 *
 * @param projectPath - Path to the project root
 * @param artifactType - Type directory to scan ('kits', 'walkthroughs', 'diagrams')
 * @returns Promise resolving to array of folders
 *
 * @example
 * ```typescript
 * const folders = await invokeGetArtifactFolders('/path/to/project', 'kits');
 * console.log(folders); // [{ name: 'ui-components', path: '...', config: {...} }]
 * ```
 */
export async function invokeGetArtifactFolders(
  projectPath: string,
  artifactType: 'kits' | 'walkthroughs' | 'diagrams'
): Promise<ArtifactFolder[]> {
  return await invokeWithTimeout<ArtifactFolder[]>(
    'get_artifact_folders',
    {
      projectPath,
      artifactType,
    },
    5000
  );
}

/**
 * Creates a new folder with config.json in an artifact directory.
 *
 * @param projectPath - Path to the project root
 * @param artifactType - Type directory ('kits', 'walkthroughs', 'diagrams')
 * @param parentPath - Optional parent folder path (null for root level)
 * @param folderName - Name of the new folder
 * @param config - Folder configuration
 * @returns Promise resolving to the path of the created folder
 *
 * @example
 * ```typescript
 * const config: FolderConfig = {
 *   id: 'ui-components-20251207',
 *   name: 'UI Components',
 *   description: 'Reusable UI patterns',
 *   tags: ['ui', 'components'],
 *   createdAt: new Date().toISOString(),
 *   updatedAt: new Date().toISOString(),
 * };
 * const path = await invokeCreateArtifactFolder('/path/to/project', 'kits', null, 'ui-components', config);
 * ```
 */
export async function invokeCreateArtifactFolder(
  projectPath: string,
  artifactType: string,
  parentPath: string | null,
  folderName: string,
  config: FolderConfig
): Promise<string> {
  return await invokeWithTimeout<string>(
    'create_artifact_folder',
    {
      projectPath,
      artifactType,
      parentPath,
      folderName,
      config,
    },
    5000
  );
}

/**
 * Updates a folder's config.json file.
 *
 * @param folderPath - Full path to the folder
 * @param config - Updated folder configuration
 * @returns Promise resolving when update is complete
 *
 * @example
 * ```typescript
 * const updatedConfig: FolderConfig = {
 *   ...existingConfig,
 *   description: 'Updated description',
 * };
 * await invokeUpdateFolderConfig('/path/to/folder', updatedConfig);
 * ```
 */
export async function invokeUpdateFolderConfig(
  folderPath: string,
  config: FolderConfig
): Promise<void> {
  return await invokeWithTimeout<void>(
    'update_folder_config',
    {
      folderPath,
      config,
    },
    5000
  );
}

/**
 * Deletes a folder and all its contents.
 *
 * WARNING: This permanently deletes the folder and all files/subfolders inside.
 *
 * @param folderPath - Full path to the folder to delete
 * @returns Promise resolving when deletion is complete
 *
 * @example
 * ```typescript
 * await invokeDeleteArtifactFolder('/path/to/project/.bluekit/kits/ui-components');
 * ```
 */
export async function invokeDeleteArtifactFolder(
  folderPath: string
): Promise<void> {
  return await invokeWithTimeout<void>(
    'delete_artifact_folder',
    {
      folderPath,
    },
    5000
  );
}

/**
 * Moves an artifact file into a folder.
 *
 * @param artifactPath - Full path to the artifact file
 * @param targetFolderPath - Full path to the target folder
 * @returns Promise resolving to the new path of the moved artifact
 *
 * @example
 * ```typescript
 * const newPath = await invokeMoveArtifactToFolder(
 *   '/path/to/project/.bluekit/kits/button.md',
 *   '/path/to/project/.bluekit/kits/ui-components'
 * );
 * console.log(newPath); // '/path/to/project/.bluekit/kits/ui-components/button.md'
 * ```
 */
export async function invokeMoveArtifactToFolder(
  artifactPath: string,
  targetFolderPath: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'move_artifact_to_folder',
    {
      artifactPath,
      targetFolderPath,
    },
    5000
  );
}

/**
 * Moves a folder into another folder (creating nesting).
 *
 * @param sourceFolderPath - Full path to the folder being moved
 * @param targetFolderPath - Full path to the destination folder
 * @returns Promise resolving to the new path of the moved folder
 *
 * @example
 * ```typescript
 * const newPath = await invokeMoveFolderToFolder(
 *   '/path/to/project/.bluekit/kits/ui',
 *   '/path/to/project/.bluekit/kits/components'
 * );
 * console.log(newPath); // '/path/to/project/.bluekit/kits/components/ui'
 * ```
 */
export async function invokeMoveFolderToFolder(
  sourceFolderPath: string,
  targetFolderPath: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'move_folder_to_folder',
    {
      sourceFolderPath,
      targetFolderPath,
    },
    5000
  );
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
// KEYCHAIN IPC WRAPPERS
// ============================================================================

import { GitHubToken } from './types/github';

/**
 * Stores a GitHub token in the OS keychain.
 *
 * @param token - The GitHub token to store
 * @returns Promise that resolves when the token is stored
 *
 * @example
 * ```typescript
 * const token: GitHubToken = {
 *   access_token: 'gho_...',
 *   token_type: 'bearer',
 *   scope: 'repo,user',
 * };
 * await invokeKeychainStoreToken(token);
 * ```
 */
export async function invokeKeychainStoreToken(token: GitHubToken): Promise<void> {
  return await invokeWithTimeout<void>('keychain_store_token', { token }, 5000);
}

/**
 * Retrieves a GitHub token from the OS keychain.
 *
 * @returns Promise that resolves to the stored GitHub token, or rejects if not found
 *
 * @example
 * ```typescript
 * try {
 *   const token = await invokeKeychainRetrieveToken();
 *   console.log('Token found:', token.access_token);
 * } catch (error) {
 *   console.log('No token stored');
 * }
 * ```
 */
export async function invokeKeychainRetrieveToken(): Promise<GitHubToken> {
  return await invokeWithTimeout<GitHubToken>('keychain_retrieve_token', {}, 5000);
}

/**
 * Deletes a GitHub token from the OS keychain.
 *
 * @returns Promise that resolves when the token is deleted
 *
 * @example
 * ```typescript
 * await invokeKeychainDeleteToken();
 * console.log('Token deleted');
 * ```
 */
export async function invokeKeychainDeleteToken(): Promise<void> {
  return await invokeWithTimeout<void>('keychain_delete_token', {}, 5000);
}

// ============================================================================
// AUTHENTICATION IPC WRAPPERS
// ============================================================================

import { AuthStatus } from './types/github';

/**
 * Starts the GitHub authorization code flow.
 *
 * Generates authorization URL, starts local HTTP server, and returns the URL.
 * The server will listen for the OAuth callback and emit a Tauri event.
 *
 * @returns Promise that resolves to the authorization URL
 *
 * @example
 * ```typescript
 * const authUrl = await invokeAuthStartAuthorization();
 * // Open URL in browser, then listen for 'oauth-callback' event
 * ```
 */
export async function invokeAuthStartAuthorization(): Promise<string> {
  return await invokeWithTimeout<string>(
    'auth_start_authorization',
    {},
    10000
  );
}

/**
 * Exchanges the authorization code for an access token.
 *
 * @param code - The authorization code from GitHub
 * @param state - The state parameter for CSRF protection
 * @param codeVerifier - The PKCE code verifier
 * @param redirectUri - The redirect URI used in the authorization request (must match exactly)
 * @returns Promise that resolves to the authentication status
 *
 * @example
 * ```typescript
 * const status = await invokeAuthExchangeCode(code, state, codeVerifier, redirectUri);
 * if (status.type === 'authorized') {
 *   console.log('Authenticated!');
 * }
 * ```
 */
export async function invokeAuthExchangeCode(
  code: string,
  state: string,
  codeVerifier: string,
  redirectUri: string
): Promise<AuthStatus> {
  // Tauri v1.5 expects camelCase parameter names to match Rust function parameters
  const args = {
    code: code,
    state: state,
    codeVerifier: codeVerifier,
    redirectUri: redirectUri,
  };
  console.log('Invoking auth_exchange_code with args:', {
    code: code.substring(0, 10) + '...',
    state: state,
    codeVerifier: codeVerifier.substring(0, 10) + '...',
    redirectUri: redirectUri,
    argsKeys: Object.keys(args)
  });
  return await invokeWithTimeout<AuthStatus>(
    'auth_exchange_code',
    args,
    15000
  );
}

/**
 * Gets the current authentication status.
 *
 * @returns Promise that resolves to the current authentication status
 *
 * @example
 * ```typescript
 * const status = await invokeAuthGetStatus();
 * if (status.type === 'authorized') {
 *   console.log('User is authenticated');
 * }
 * ```
 */
export async function invokeAuthGetStatus(): Promise<AuthStatus> {
  return await invokeWithTimeout<AuthStatus>('auth_get_status', {}, 5000);
}

// ============================================================================
// GITHUB API IPC WRAPPERS
// ============================================================================

import { GitHubUser, GitHubRepo, GitHubFileResponse, GitHubTreeResponse } from './types/github';

/**
 * Gets the authenticated user's information from GitHub.
 *
 * @returns Promise that resolves to the GitHub user information
 *
 * @example
 * ```typescript
 * const user = await invokeGitHubGetUser();
 * console.log('Logged in as:', user.login);
 * ```
 */
export async function invokeGitHubGetUser(): Promise<GitHubUser> {
  return await invokeWithTimeout<GitHubUser>('github_get_user', {}, 10000);
}

/**
 * Gets the authenticated user's repositories from GitHub.
 *
 * @returns Promise that resolves to an array of GitHub repositories
 *
 * @example
 * ```typescript
 * const repos = await invokeGitHubGetRepos();
 * console.log('You have', repos.length, 'repositories');
 * ```
 */
export async function invokeGitHubGetRepos(): Promise<GitHubRepo[]> {
  return await invokeWithTimeout<GitHubRepo[]>('github_get_repos', {}, 15000);
}

/**
 * Gets the contents of a file from a GitHub repository.
 *
 * @param owner - Repository owner (username or org)
 * @param repo - Repository name
 * @param path - File path in repository
 * @returns Promise that resolves to the file contents
 *
 * @example
 * ```typescript
 * const content = await invokeGitHubGetFile('owner', 'repo', 'path/to/file.md');
 * ```
 */
export async function invokeGitHubGetFile(
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'github_get_file',
    { owner, repo, path },
    10000
  );
}

/**
 * Creates or updates a file in a GitHub repository.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path in repository
 * @param content - File content
 * @param message - Commit message
 * @param sha - Optional SHA of existing file (required for updates)
 * @returns Promise that resolves to the file operation response
 *
 * @example
 * ```typescript
 * const response = await invokeGitHubCreateOrUpdateFile(
 *   'owner',
 *   'repo',
 *   'path/to/file.md',
 *   '# Content',
 *   'Add new file',
 *   undefined // No SHA for new file
 * );
 * ```
 */
export async function invokeGitHubCreateOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<GitHubFileResponse> {
  return await invokeWithTimeout<GitHubFileResponse>(
    'github_create_or_update_file',
    { owner, repo, path, content, message, sha },
    15000
  );
}

/**
 * Deletes a file from a GitHub repository.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path in repository
 * @param message - Commit message
 * @param sha - SHA of file to delete (required)
 * @returns Promise that resolves to the deletion response
 *
 * @example
 * ```typescript
 * const response = await invokeGitHubDeleteFile(
 *   'owner',
 *   'repo',
 *   'path/to/file.md',
 *   'Delete file',
 *   'abc123...'
 * );
 * ```
 */
export async function invokeGitHubDeleteFile(
  owner: string,
  repo: string,
  path: string,
  message: string,
  sha: string
): Promise<GitHubFileResponse> {
  return await invokeWithTimeout<GitHubFileResponse>(
    'github_delete_file',
    { owner, repo, path, message, sha },
    15000
  );
}

/**
 * Gets a file's SHA (for checking if file exists and getting SHA for updates).
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path in repository
 * @returns Promise that resolves to the file SHA, or null if file doesn't exist
 *
 * @example
 * ```typescript
 * const sha = await invokeGitHubGetFileSha('owner', 'repo', 'path/to/file.md');
 * if (sha) {
 *   console.log('File exists, SHA:', sha);
 * } else {
 *   console.log('File does not exist');
 * }
 * ```
 */
export async function invokeGitHubGetFileSha(
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  return await invokeWithTimeout<string | null>(
    'github_get_file_sha',
    { owner, repo, path },
    10000
  );
}

/**
 * Gets a tree (directory contents) from a GitHub repository.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param treeSha - Tree SHA (can be branch name, commit SHA, or tree SHA)
 * @returns Promise that resolves to the tree response
 *
 * @example
 * ```typescript
 * const tree = await invokeGitHubGetTree('owner', 'repo', 'main');
 * console.log('Files in tree:', tree.tree.length);
 * ```
 */
export async function invokeGitHubGetTree(
  owner: string,
  repo: string,
  treeSha: string
): Promise<GitHubTreeResponse> {
  return await invokeWithTimeout<GitHubTreeResponse>(
    'github_get_tree',
    { owner, repo, treeSha },
    15000
  );
}

// ============================================================================
// LIBRARY IPC WRAPPERS
// ============================================================================

import { LibraryWorkspace, LibraryArtifact } from './types/github';

/**
 * Creates a new Library workspace.
 *
 * @param name - Workspace name
 * @param githubOwner - GitHub owner (username or org)
 * @param githubRepo - GitHub repository name
 * @returns Promise that resolves to the created workspace
 *
 * @example
 * ```typescript
 * const workspace = await invokeLibraryCreateWorkspace(
 *   'My Workspace',
 *   'username',
 *   'my-repo'
 * );
 * ```
 */
export async function invokeLibraryCreateWorkspace(
  name: string,
  githubOwner: string,
  githubRepo: string
): Promise<LibraryWorkspace> {
  return await invokeWithTimeout<LibraryWorkspace>(
    'library_create_workspace',
    { name, githubOwner, githubRepo },
    10000
  );
}

/**
 * Lists all Library workspaces.
 *
 * @returns Promise that resolves to an array of workspaces
 *
 * @example
 * ```typescript
 * const workspaces = await invokeLibraryListWorkspaces();
 * console.log('You have', workspaces.length, 'workspaces');
 * ```
 */
export async function invokeLibraryListWorkspaces(): Promise<LibraryWorkspace[]> {
  return await invokeWithTimeout<LibraryWorkspace[]>('library_list_workspaces', {}, 10000);
}

/**
 * Gets a Library workspace by ID.
 *
 * @param workspaceId - Workspace ID
 * @returns Promise that resolves to the workspace
 *
 * @example
 * ```typescript
 * const workspace = await invokeLibraryGetWorkspace('workspace-id');
 * ```
 */
export async function invokeLibraryGetWorkspace(
  workspaceId: string
): Promise<LibraryWorkspace> {
  return await invokeWithTimeout<LibraryWorkspace>(
    'library_get_workspace',
    { workspaceId },
    10000
  );
}

/**
 * Deletes a Library workspace.
 *
 * @param workspaceId - Workspace ID
 * @returns Promise that resolves when the workspace is deleted
 *
 * @example
 * ```typescript
 * await invokeLibraryDeleteWorkspace('workspace-id');
 * ```
 */
export async function invokeLibraryDeleteWorkspace(workspaceId: string): Promise<void> {
  return await invokeWithTimeout<void>(
    'library_delete_workspace',
    { workspaceId },
    10000
  );
}

/**
 * Lists all artifacts in a workspace (or all workspaces if None).
 *
 * @param workspaceId - Optional workspace ID (if not provided, returns all artifacts)
 * @returns Promise that resolves to an array of artifacts
 *
 * @example
 * ```typescript
 * const artifacts = await invokeLibraryGetArtifacts('workspace-id');
 * // or
 * const allArtifacts = await invokeLibraryGetArtifacts(undefined);
 * ```
 */
export async function invokeLibraryGetArtifacts(
  workspaceId?: string
): Promise<LibraryArtifact[]> {
  return await invokeWithTimeout<LibraryArtifact[]>(
    'library_get_artifacts',
    { workspaceId },
    10000
  );
}

