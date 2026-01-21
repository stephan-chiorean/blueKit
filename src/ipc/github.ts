/**
 * IPC commands for GitHub API operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import { GitHubUser, GitHubRepo, GitHubFileResponse, GitHubTreeResponse } from '../types/github';

/**
 * Gets the authenticated user's information from GitHub.
 *
 * @param accessToken - GitHub access token
 * @returns Promise that resolves to the GitHub user information
 */
export async function invokeGitHubGetUser(accessToken: string): Promise<GitHubUser> {
  return await invokeWithTimeout<GitHubUser>('github_get_user', { accessToken }, 10000);
}

/**
 * Gets the authenticated user's repositories from GitHub.
 *
 * @param accessToken - GitHub access token
 * @returns Promise that resolves to an array of GitHub repositories
 */
export async function invokeGitHubGetRepos(accessToken: string): Promise<GitHubRepo[]> {
  return await invokeWithTimeout<GitHubRepo[]>('github_get_repos', { accessToken }, 15000);
}

/**
 * Gets the contents of a file from a GitHub repository.
 *
 * @param owner - Repository owner (username or org)
 * @param repo - Repository name
 * @param path - File path in repository
 * @param accessToken - GitHub access token
 * @returns Promise that resolves to the file contents
 */
export async function invokeGitHubGetFile(
  owner: string,
  repo: string,
  path: string,
  accessToken: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'github_get_file',
    { owner, repo, path, accessToken },
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
 * @param accessToken - GitHub access token
 * @param sha - Optional SHA of existing file (required for updates)
 * @returns Promise that resolves to the file operation response
 */
export async function invokeGitHubCreateOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  accessToken: string,
  sha?: string
): Promise<GitHubFileResponse> {
  return await invokeWithTimeout<GitHubFileResponse>(
    'github_create_or_update_file',
    { owner, repo, path, content, message, sha, accessToken },
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
 * @param accessToken - GitHub access token
 * @returns Promise that resolves to the deletion response
 */
export async function invokeGitHubDeleteFile(
  owner: string,
  repo: string,
  path: string,
  message: string,
  sha: string,
  accessToken: string
): Promise<GitHubFileResponse> {
  return await invokeWithTimeout<GitHubFileResponse>(
    'github_delete_file',
    { owner, repo, path, message, sha, accessToken },
    15000
  );
}

/**
 * Gets a file's SHA (for checking if file exists and getting SHA for updates).
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path in repository
 * @param accessToken - GitHub access token
 * @returns Promise that resolves to the file SHA, or null if file doesn't exist
 */
export async function invokeGitHubGetFileSha(
  owner: string,
  repo: string,
  path: string,
  accessToken: string
): Promise<string | null> {
  return await invokeWithTimeout<string | null>(
    'github_get_file_sha',
    { owner, repo, path, accessToken },
    10000
  );
}

/**
 * Gets a tree (directory contents) from a GitHub repository.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param treeSha - Tree SHA (can be branch name, commit SHA, or tree SHA)
 * @param accessToken - GitHub access token
 * @returns Promise that resolves to the tree response
 */
export async function invokeGitHubGetTree(
  owner: string,
  repo: string,
  treeSha: string,
  accessToken: string
): Promise<GitHubTreeResponse> {
  return await invokeWithTimeout<GitHubTreeResponse>(
    'github_get_tree',
    { owner, repo, treeSha, accessToken },
    15000
  );
}

