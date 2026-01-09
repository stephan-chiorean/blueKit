/**
 * IPC commands for folder operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import type { ArtifactFolder, FolderConfig } from './types';

/**
 * Gets all folders in a specific artifact type directory.
 *
 * Scans the specified artifact directory (kits, walkthroughs, diagrams)
 * and returns all folders found. Folders are flat (no nesting) and
 * contain only basic metadata: name, path, and artifact count.
 *
 * @param projectPath - Path to the project root
 * @param artifactType - Type directory to scan ('kits', 'walkthroughs', 'diagrams')
 * @returns Promise resolving to array of folders (config is always undefined)
 *
 * @example
 * ```typescript
 * const folders = await invokeGetArtifactFolders('/path/to/project', 'kits');
 * console.log(folders); // [{ name: 'ui-components', path: '...', artifactCount: 5 }]
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
 * Creates a new empty folder in an artifact directory.
 *
 * Folders are flat (always created at root level) and no config.json is created.
 * The folder name is the only metadata.
 *
 * @param projectPath - Path to the project root
 * @param artifactType - Type directory ('kits', 'walkthroughs', 'diagrams')
 * @param parentPath - Ignored (kept for backward compatibility)
 * @param folderName - Name of the new folder
 * @param config - Ignored (kept for backward compatibility, no config.json created)
 * @returns Promise resolving to the path of the created folder
 *
 * @example
 * ```typescript
 * // Config is required for backward compatibility but ignored
 * const dummyConfig: FolderConfig = {
 *   id: '',
 *   name: folderName,
 *   tags: [],
 *   createdAt: '',
 *   updatedAt: '',
 * };
 * const path = await invokeCreateArtifactFolder('/path/to/project', 'kits', null, 'my-folder', dummyConfig);
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
 * @deprecated Folders no longer use config.json. This function does nothing.
 *
 * Updates a folder's config.json file.
 *
 * @param folderPath - Full path to the folder
 * @param config - Updated folder configuration (ignored)
 * @returns Promise resolving immediately (no-op)
 */
export async function invokeUpdateFolderConfig(
  folderPath: string,
  config: FolderConfig
): Promise<void> {
  // DEPRECATED: Folders no longer use config.json
  // This function is kept for backward compatibility but does nothing
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
 * Renames a folder.
 *
 * @param folderPath - Full path to the folder to rename
 * @param newName - New name for the folder
 * @returns Promise resolving to the new path of the renamed folder
 *
 * @example
 * ```typescript
 * const newPath = await invokeRenameArtifactFolder(
 *   '/path/to/project/.bluekit/kits/old-name',
 *   'new-name'
 * );
 * console.log(newPath); // '/path/to/project/.bluekit/kits/new-name'
 * ```
 */
export async function invokeRenameArtifactFolder(
  folderPath: string,
  newName: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'rename_artifact_folder',
    {
      folderPath,
      newName,
    },
    5000
  );
}

/**
 * @deprecated Folders are now flat (no nesting). This function should not be used.
 *
 * Moves a folder into another folder (creating nesting).
 *
 * @param sourceFolderPath - Full path to the folder being moved
 * @param targetFolderPath - Full path to the destination folder
 * @returns Promise resolving to the new path of the moved folder
 */
export async function invokeMoveFolderToFolder(
  sourceFolderPath: string,
  targetFolderPath: string
): Promise<string> {
  // DEPRECATED: Folders are now flat (no nesting)
  return await invokeWithTimeout<string>(
    'move_folder_to_folder',
    {
      sourceFolderPath,
      targetFolderPath,
    },
    5000
  );
}

