/**
 * IPC commands for GitHub commit fetching and management (Phase 2).
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
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
  perPage?: number
): Promise<GitHubCommit[]> {
  return await invokeWithTimeout<GitHubCommit[]>(
    'fetch_project_commits',
    {
      projectId,
      branch,
      page,
      perPage,
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
