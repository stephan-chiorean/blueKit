/**
 * Type definitions for IPC communication.
 * 
 * These interfaces must match the corresponding Rust structs in `src-tauri/src/commands.rs`.
 * TypeScript uses these to provide type checking and autocomplete.
 */

// Re-export TimeoutError for convenience
export { TimeoutError } from '../utils/ipcTimeout';

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
 * Folders are flat (no nesting) and contain only the folder name as metadata.
 *
 * This interface must match the `ArtifactFolder` struct in `src-tauri/src/commands.rs`.
 */
export interface ArtifactFolder {
  /** Folder name (directory name) */
  name: string;
  /** Full path to the folder */
  path: string;
  /** @deprecated Always undefined - flat folder structure */
  parentPath?: string;
  /** Parsed config.json if exists, undefined otherwise */
  config?: FolderConfig;
  /** Number of direct child artifacts */
  artifactCount: number;
  /** @deprecated Always 0 - flat folder structure */
  folderCount: number;
}

/**
 * @deprecated Use flat folder structure instead.
 *
 * Tree node for hierarchical folder display.
 * This is kept for backward compatibility but folders are now flat.
 */
export interface FolderTreeNode {
  /** Folder information */
  folder: ArtifactFolder;
  /** @deprecated Always empty - flat folder structure */
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
 * Type definition for a project in the database.
 *
 * This interface must match the `project::Model` struct in `src-tauri/src/db/entities/project.rs`.
 */
export interface Project {
  /** Unique identifier for the project */
  id: string;
  /** Project name */
  name: string;
  /** Absolute path to the project directory */
  path: string;
  /** Optional project description */
  description?: string;
  /** Tags for categorization (JSON array) */
  tags?: string;
  /** Whether the project is connected to git */
  gitConnected: boolean;
  /** Git remote URL (if connected) */
  gitUrl?: string;
  /** Current git branch (if connected) */
  gitBranch?: string;
  /** Git remote name (if connected) */
  gitRemote?: string;
  /** Latest commit SHA (if connected) */
  lastCommitSha?: string;
  /** Last sync timestamp in milliseconds (if connected) */
  lastSyncedAt?: number;
  /** Creation timestamp in milliseconds */
  createdAt: number;
  /** Last updated timestamp in milliseconds */
  updatedAt: number;
  /** Last opened timestamp in milliseconds (optional) */
  lastOpenedAt?: number;
}

/**
 * Type definition for GitHub commit author information.
 *
 * This interface must match the `GitHubCommitAuthor` struct in `src-tauri/src/integrations/github/github.rs`.
 */
export interface GitHubCommitAuthor {
  /** Author name */
  name: string;
  /** Author email */
  email: string;
  /** Commit date (ISO 8601) */
  date: string;
}

/**
 * Type definition for GitHub commit details.
 *
 * This interface must match the `GitHubCommitDetails` struct in `src-tauri/src/integrations/github/github.rs`.
 */
export interface GitHubCommitInfo {
  /** Commit message */
  message: string;
  /** Commit author */
  author: GitHubCommitAuthor;
  /** Committer */
  committer: GitHubCommitAuthor;
}

/**
 * Type definition for a checkpoint (pinned commit).
 *
 * This interface must match the `checkpoint::Model` struct in `src-tauri/src/db/entities/checkpoint.rs`.
 */
export interface Checkpoint {
  /** Unique identifier for the checkpoint */
  id: string;
  /** Project ID this checkpoint belongs to */
  projectId: string;
  /** Git commit SHA (40-char hex string) */
  gitCommitSha: string;
  /** Git branch name (optional) */
  gitBranch?: string;
  /** Git remote URL (optional) */
  gitUrl?: string;
  /** Checkpoint name */
  name: string;
  /** Optional description */
  description?: string;
  /** Tags as JSON array string (optional) */
  tags?: string;
  /** Checkpoint type: "milestone" | "experiment" | "template" | "backup" */
  checkpointType: string;
  /** Parent checkpoint ID for lineage tracking (optional, Phase 4) */
  parentCheckpointId?: string;
  /** Project ID if this checkpoint was used to create a new project (optional) */
  createdFromProjectId?: string;
  /** Timestamp when checkpoint was pinned (milliseconds) */
  pinnedAt: number;
  /** Creation timestamp (milliseconds) */
  createdAt: number;
  /** Last updated timestamp (milliseconds) */
  updatedAt: number;
}

/**
 * Type definition for GitHub user information (simplified version from commit responses).
 *
 * This interface must match the `GitHubCommitUser` struct in `src-tauri/src/integrations/github/github.rs`.
 */
export interface GitHubUser {
  /** GitHub user login (username) */
  login: string;
  /** User ID */
  id: number;
  /** Avatar URL */
  avatar_url: string;
  /** HTML URL to user profile */
  html_url: string;
}

/**
 * Type definition for GitHub commit from API.
 *
 * This interface must match the `GitHubCommit` struct in `src-tauri/src/integrations/github/github.rs`.
 */
export interface GitHubCommit {
  /** Commit SHA */
  sha: string;
  /** Commit details */
  commit: GitHubCommitInfo;
  /** Commit author (GitHub user) */
  author?: GitHubUser;
  /** Committer (GitHub user) */
  committer?: GitHubUser;
  /** URL to commit on GitHub */
  html_url: string;
  /** Files changed in commit */
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

// ============================================================================
// BOOKMARKS
// ============================================================================

/**
 * A bookmark item - can be either a file bookmark or a group containing other items.
 * This is a discriminated union type where `type` determines the variant.
 */
export type BookmarkItem = BookmarkFile | BookmarkGroup;

/**
 * A file bookmark - bookmarks a specific file.
 */
export interface BookmarkFile {
  type: 'file';
  /** Creation timestamp in milliseconds */
  ctime: number;
  /** Absolute path to the bookmarked file */
  path: string;
  /** Display title for the bookmark */
  title: string;
}

/**
 * A bookmark group - contains nested bookmark items.
 */
export interface BookmarkGroup {
  type: 'group';
  /** Creation timestamp in milliseconds */
  ctime: number;
  /** Display title for the group */
  title: string;
  /** Nested bookmark items within this group */
  items: BookmarkItem[];
}

/**
 * Root structure for bookmarks data.
 */
export interface BookmarksData {
  items: BookmarkItem[];
}

