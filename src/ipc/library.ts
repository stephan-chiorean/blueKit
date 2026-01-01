/**
 * IPC commands for Library operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import {
  LibraryWorkspace,
  LibraryArtifact,
  LibraryResource,
  CatalogWithVariations,
  ScanResult,
  SyncResult,
  PublishResult,
  ResourceStatus,
  PullResult,
} from '../types/github';

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

// ============================================================================
// FOLDER COMMANDS (SQLite-backed virtual folders)
// ============================================================================

export interface LibraryFolder {
  id: string;
  workspace_id: string;
  name: string;
  color?: string;
  order_index: number;
  created_at: number;
  updated_at: number;
}

/**
 * Creates a folder in a library workspace (SQLite only, not in GitHub).
 *
 * @param workspaceId - Workspace ID
 * @param name - Name of the folder to create
 * @param color - Optional hex color for the folder
 * @returns Promise that resolves to the folder ID
 *
 * @example
 * ```typescript
 * const folderId = await invokeLibraryCreateFolder('workspace-id', 'UI Components', '#3B82F6');
 * ```
 */
export async function invokeLibraryCreateFolder(
  workspaceId: string,
  name: string,
  color?: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'library_create_folder',
    { workspaceId, name, color },
    5000
  );
}

/**
 * Gets all folders for a workspace from SQLite.
 *
 * @param workspaceId - Workspace ID
 * @returns Promise that resolves to an array of folders
 *
 * @example
 * ```typescript
 * const folders = await invokeLibraryGetFolders('workspace-id');
 * ```
 */
export async function invokeLibraryGetFolders(
  workspaceId: string
): Promise<LibraryFolder[]> {
  return await invokeWithTimeout<LibraryFolder[]>(
    'library_get_folders',
    { workspaceId },
    5000
  );
}

/**
 * Updates a folder's metadata.
 *
 * @param folderId - Folder ID
 * @param name - Optional new name
 * @param color - Optional new color
 * @returns Promise that resolves when update is complete
 */
export async function invokeLibraryUpdateFolder(
  folderId: string,
  name?: string,
  color?: string
): Promise<void> {
  return await invokeWithTimeout<void>(
    'library_update_folder',
    { folderId, name, color },
    5000
  );
}

/**
 * Deletes a folder from SQLite.
 *
 * @param folderId - Folder ID
 * @returns Promise that resolves when deletion is complete
 */
export async function invokeLibraryDeleteFolder(
  folderId: string
): Promise<void> {
  return await invokeWithTimeout<void>(
    'library_delete_folder',
    { folderId },
    5000
  );
}

/**
 * Adds catalogs to a folder.
 *
 * @param folderId - Folder ID
 * @param catalogIds - Array of catalog IDs to add
 * @returns Promise that resolves when catalogs are added
 */
export async function invokeLibraryAddCatalogsToFolder(
  folderId: string,
  catalogIds: string[]
): Promise<void> {
  return await invokeWithTimeout<void>(
    'library_add_catalogs_to_folder',
    { folderId, catalogIds },
    5000
  );
}

/**
 * Removes catalogs from a folder.
 *
 * @param folderId - Folder ID
 * @param catalogIds - Array of catalog IDs to remove
 * @returns Promise that resolves when catalogs are removed
 */
export async function invokeLibraryRemoveCatalogsFromFolder(
  folderId: string,
  catalogIds: string[]
): Promise<void> {
  return await invokeWithTimeout<void>(
    'library_remove_catalogs_from_folder',
    { folderId, catalogIds },
    5000
  );
}

/**
 * Gets all catalog IDs in a folder.
 *
 * @param folderId - Folder ID
 * @returns Promise that resolves to array of catalog IDs
 */
export async function invokeLibraryGetFolderCatalogIds(
  folderId: string
): Promise<string[]> {
  return await invokeWithTimeout<string[]>(
    'library_get_folder_catalog_ids',
    { folderId },
    5000
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

// ============================================================================
// RESOURCE COMMANDS
// ============================================================================

/**
 * Scans a project directory for resources and syncs them to the database.
 */
export async function invokeScanProjectResources(
  projectId: string,
  projectPath: string
): Promise<ScanResult> {
  return await invokeWithTimeout<ScanResult>(
    'scan_project_resources',
    { projectId, projectPath },
    30000
  );
}

/**
 * Gets all resources for a project.
 */
export async function invokeGetProjectResources(
  projectId: string,
  includeDeleted?: boolean
): Promise<LibraryResource[]> {
  return await invokeWithTimeout<LibraryResource[]>(
    'get_project_resources',
    { projectId, includeDeleted },
    10000
  );
}

/**
 * Gets a single resource by ID.
 */
export async function invokeGetResourceById(
  resourceId: string
): Promise<LibraryResource> {
  return await invokeWithTimeout<LibraryResource>(
    'get_resource_by_id',
    { resourceId },
    10000
  );
}

// ============================================================================
// PUBLISHING COMMANDS
// ============================================================================

/**
 * Checks publish status for a resource (doesn't publish, just checks).
 */
export async function invokeCheckPublishStatus(
  resourceId: string,
  workspaceId: string
): Promise<PublishResult> {
  return await invokeWithTimeout<PublishResult>(
    'check_publish_status',
    { resourceId, workspaceId },
    10000
  );
}

/**
 * Publishes a resource to a workspace.
 */
export async function invokePublishResource(
  resourceId: string,
  workspaceId: string,
  options?: {
    overwriteVariationId?: string;
    versionTag?: string;
  }
): Promise<PublishResult> {
  return await invokeWithTimeout<PublishResult>(
    'publish_resource',
    {
      resourceId,
      workspaceId,
      overwriteVariationId: options?.overwriteVariationId,
      versionTag: options?.versionTag,
    },
    30000
  );
}

// ============================================================================
// CATALOG SYNC COMMANDS
// ============================================================================

/**
 * Syncs workspace catalog from GitHub.
 */
export async function invokeSyncWorkspaceCatalog(
  workspaceId: string
): Promise<SyncResult> {
  return await invokeWithTimeout<SyncResult>(
    'sync_workspace_catalog',
    { workspaceId },
    60000
  );
}

/**
 * Lists workspace catalogs with variations.
 */
export async function invokeListWorkspaceCatalogs(
  workspaceId: string,
  artifactType?: string
): Promise<CatalogWithVariations[]> {
  return await invokeWithTimeout<CatalogWithVariations[]>(
    'list_workspace_catalogs',
    { workspaceId, artifactType },
    10000
  );
}

/**
 * Deletes catalogs and their variations from a workspace.
 * This removes the catalog files from the GitHub repository and deletes all associated variations.
 *
 * @param catalogIds - Array of catalog IDs to delete
 * @returns Promise that resolves to the number of catalogs deleted
 *
 * @example
 * ```typescript
 * const deletedCount = await invokeDeleteCatalogs(['catalog-id-1', 'catalog-id-2']);
 * console.log(`Deleted ${deletedCount} catalogs`);
 * ```
 */
export async function invokeDeleteCatalogs(
  catalogIds: string[]
): Promise<number> {
  return await invokeWithTimeout<number>(
    'delete_catalogs',
    { catalogIds },
    30000
  );
}

// ============================================================================
// PULL COMMANDS
// ============================================================================

/**
 * Pulls a variation to a local project.
 */
export async function invokePullVariation(
  variationId: string,
  targetProjectId: string,
  targetProjectPath: string,
  overwriteIfExists: boolean
): Promise<PullResult> {
  return await invokeWithTimeout<PullResult>(
    'pull_variation',
    { variationId, targetProjectId, targetProjectPath, overwriteIfExists },
    30000
  );
}

// ============================================================================
// UPDATE DETECTION COMMANDS
// ============================================================================

/**
 * Checks resource status for unpublished changes and available updates.
 */
export async function invokeCheckResourceStatus(
  resourceId: string,
  projectRoot: string
): Promise<ResourceStatus> {
  return await invokeWithTimeout<ResourceStatus>(
    'check_resource_status',
    { resourceId, projectRoot },
    10000
  );
}

/**
 * Checks all resources in a project for updates.
 */
export async function invokeCheckProjectForUpdates(
  projectId: string,
  projectRoot: string
): Promise<ResourceStatus[]> {
  return await invokeWithTimeout<ResourceStatus[]>(
    'check_project_for_updates',
    { projectId, projectRoot },
    30000
  );
}

