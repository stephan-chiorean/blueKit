/**
 * IPC commands for Library operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import { LibraryWorkspace, LibraryArtifact } from '../types/github';

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

