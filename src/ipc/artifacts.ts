/**
 * IPC commands for artifact operations (kits, walkthroughs, diagrams, blueprints, scrapbook, plans, clones).
 */

import { invokeWithTimeout } from '@/shared/utils/ipcTimeout';
import type { ArtifactFile, Blueprint, ScrapbookItem, CloneMetadata } from './types';

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

