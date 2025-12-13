/**
 * IPC commands for folder operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import type { ArtifactFolder, FolderConfig } from './types';

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

