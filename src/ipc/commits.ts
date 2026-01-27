/**
 * IPC commands for GitHub commit fetching and management (Phase 2).
 */

import { invokeWithTimeout } from '@/shared/utils/ipcTimeout';
import type { GitHubCommit } from './types';

// ============================================================================
// COMMIT TIMELINE COMMANDS (Phase 2)
// ============================================================================

/**
 * Fetches commits for a project from GitHub API (with caching).
 *
 * This command:
 * 1. Checks the 5-minute cache first
 * 2. Validates project git connection
 * 3. Fetches commits from GitHub API
 * 4. Caches the results for 5 minutes
 *
 * @param projectId - The project ID (from database)
 * @param branch - Optional branch name (defaults to project's current branch)
 * @param page - Optional page number for pagination (default: 1)
 * @param perPage - Optional number of commits per page (default: 30, max: 100)
 * @returns A promise that resolves to an array of GitHub commits
 *
 * @example
 * ```typescript
 * // Fetch first page of commits
 * const commits = await invokeFetchProjectCommits('project-id-123');
 *
 * // Fetch second page with custom page size
 * const moreCommits = await invokeFetchProjectCommits(
 *   'project-id-123',
 *   undefined, // use project's branch
 *   2,         // page 2
 *   50         // 50 commits per page
 * );
 *
 * // Fetch commits from specific branch
 * const devCommits = await invokeFetchProjectCommits(
 *   'project-id-123',
 *   'develop'
 * );
 * ```
 */
export async function invokeFetchProjectCommits(
  projectId: string,
  branch?: string,
  page?: number,
  perPage?: number,
  accessToken?: string
): Promise<GitHubCommit[]> {
  return await invokeWithTimeout<GitHubCommit[]>(
    'fetch_project_commits',
    {
      projectId,
      branch,
      page,
      perPage,
      accessToken,
    },
    15000 // 15 second timeout for GitHub API calls
  );
}

/**
 * Opens a commit diff in GitHub (in default browser).
 *
 * This command constructs the GitHub URL from the git URL and commit SHA,
 * then opens it in the user's default browser using platform-specific commands.
 *
 * @param gitUrl - The git remote URL (e.g., "https://github.com/owner/repo.git")
 * @param commitSha - The commit SHA to view
 * @returns A promise that resolves when the browser is opened
 *
 * @example
 * ```typescript
 * await invokeOpenCommitInGitHub(
 *   'https://github.com/owner/repo.git',
 *   'abc123def456'
 * );
 * // Opens: https://github.com/owner/repo/commit/abc123def456
 * ```
 */
export async function invokeOpenCommitInGitHub(
  gitUrl: string,
  commitSha: string
): Promise<void> {
  return await invokeWithTimeout<void>(
    'open_commit_in_github',
    {
      gitUrl,
      commitSha,
    },
    5000 // 5 second timeout for opening browser
  );
}

/**
 * Invalidates the commit cache for a project, forcing a fresh fetch on next request.
 *
 * This command clears all cached commits for the specified project, ensuring that
 * the next call to `invokeFetchProjectCommits` will fetch fresh data from GitHub.
 *
 * @param projectId - The project ID (from database)
 * @returns A promise that resolves when the cache is invalidated
 *
 * @example
 * ```typescript
 * // Force refresh commits by invalidating cache first
 * await invokeInvalidateCommitCache('project-id-123');
 * const freshCommits = await invokeFetchProjectCommits('project-id-123');
 * ```
 */
export async function invokeInvalidateCommitCache(
  projectId: string
): Promise<void> {
  return await invokeWithTimeout<void>(
    'invalidate_commit_cache',
    {
      projectId,
    },
    1000 // 1 second timeout for cache operation
  );
}

/**
 * Checkout a commit in a project (either detached HEAD or new branch).
 *
 * This command:
 * 1. Gets the project from the database
 * 2. Validates the project has a git repository
 * 3. Verifies the commit SHA exists
 * 4. Checks out the commit (detached HEAD or creates new branch)
 * 5. Returns the project path on success
 *
 * @param projectId - The project ID (from database)
 * @param commitSha - The commit SHA to checkout
 * @param branchName - Optional branch name. If provided, creates a new branch from the commit. If not provided, checks out in detached HEAD state.
 * @returns A promise that resolves to the project path on success
 *
 * @example
 * ```typescript
 * // Checkout in detached HEAD
 * const projectPath = await invokeCheckoutCommitInProject(
 *   'project-id-123',
 *   'abc123def456'
 * );
 *
 * // Checkout in new branch
 * const projectPath = await invokeCheckoutCommitInProject(
 *   'project-id-123',
 *   'abc123def456',
 *   'rollback-feature-branch'
 * );
 * ```
 */
export async function invokeCheckoutCommitInProject(
  projectId: string,
  commitSha: string,
  branchName?: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'checkout_commit_in_project',
    {
      projectId,
      commitSha,
      branchName,
    },
    30000 // 30 second timeout for git operations
  );
}

// ============================================================================
// GIT WORKTREE COMMANDS
// ============================================================================

/**
 * Represents a git worktree.
 */
export interface GitWorktree {
  /** Absolute path to the worktree directory */
  path: string;
  /** Branch name (or "(detached HEAD)" if in detached state) */
  branch: string;
  /** Current commit SHA at HEAD */
  commitSha: string;
  /** Whether this is the main working tree */
  isMain: boolean;
}

/**
 * Lists all git worktrees for a project.
 *
 * Returns information about all worktrees including the main working tree.
 * Used by the Git tab's "Worktrees" view.
 *
 * @param projectId - The project ID (from database)
 * @returns A promise that resolves to an array of git worktrees
 *
 * @example
 * ```typescript
 * const worktrees = await invokeListProjectWorktrees('project-id-123');
 * // Returns: [{ path: '/path/to/main', branch: 'main', commitSha: 'abc123', isMain: true }, ...]
 * ```
 */
export async function invokeListProjectWorktrees(
  projectId: string
): Promise<GitWorktree[]> {
  // Backend uses snake_case for field names, convert to camelCase
  const result = await invokeWithTimeout<Array<{
    path: string;
    branch: string;
    commit_sha: string;
    is_main: boolean;
  }>>(
    'list_project_worktrees',
    { projectId },
    5000 // 5 second timeout for git command
  );

  // Transform snake_case to camelCase
  return result.map(worktree => ({
    path: worktree.path,
    branch: worktree.branch,
    commitSha: worktree.commit_sha,
    isMain: worktree.is_main,
  }));
}

/**
 * Opens a worktree in a new window.
 *
 * Creates a new Tauri window displaying the worktree as an ephemeral project.
 * The window shows a full ProjectDetailPage for the worktree path.
 * If the window is already open, it will be focused instead.
 *
 * @param worktreePath - Absolute path to the worktree directory
 * @param worktreeBranch - Branch name of the worktree (used in window title)
 * @returns A promise that resolves when the window is opened
 *
 * @example
 * ```typescript
 * await invokeOpenWorktreeInWindow('/path/to/worktree', 'feature-branch');
 * ```
 */
export async function invokeOpenWorktreeInWindow(
  projectId: string,
  worktreePath: string,
  worktreeBranch: string
): Promise<void> {
  return await invokeWithTimeout<void>(
    'open_worktree_in_window',
    {
      projectId,
      worktreePath,
      worktreeBranch,
    },
    5000 // 5 second timeout for window creation
  );
}
