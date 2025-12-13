/**
 * IPC commands for GitHub API operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import { GitHubUser, GitHubRepo, GitHubFileResponse, GitHubTreeResponse } from '../types/github';

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

