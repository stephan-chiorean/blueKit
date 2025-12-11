import { ArtifactFolder, ArtifactFile, FolderTreeNode } from '../ipc';

/**
 * Builds a hierarchical tree structure from flat folder and artifact lists.
 *
 * Takes flat arrays of folders and artifacts and constructs a tree where:
 * - Root folders have no parent or parent equals the root directory
 * - Each folder node contains its children folders and artifacts
 * - Artifacts are grouped by their parent directory
 *
 * @param folders - Flat list of all folders
 * @param artifacts - Flat list of all artifacts
 * @param artifactType - Type directory ("kits", "walkthroughs", "diagrams")
 * @param projectPath - Project root path
 * @returns Array of root-level tree nodes (folders + root artifacts)
 *
 * @example
 * ```typescript
 * const folders = await invokeGetArtifactFolders(projectPath, 'kits');
 * const artifacts = kits; // from get_project_artifacts
 * const tree = buildFolderTree(folders, artifacts, 'kits', projectPath);
 * // tree[0] = { folder: {...}, children: [...], artifacts: [...], isExpanded: false }
 * ```
 */
export function buildFolderTree(
  folders: ArtifactFolder[],
  artifacts: ArtifactFile[],
  artifactType: string,
  projectPath: string
): FolderTreeNode[] {
  // Build folder map for quick lookups
  const folderMap = new Map<string, ArtifactFolder>();
  folders.forEach(folder => folderMap.set(folder.path, folder));

  const rootDir = `${projectPath}/.bluekit/${artifactType}`;
  const artifactsByFolder = new Map<string, ArtifactFile[]>();

  // Group artifacts by their parent folder
  artifacts.forEach(artifact => {
    const parentDir = getParentDirectory(artifact.path);
    if (!artifactsByFolder.has(parentDir)) {
      artifactsByFolder.set(parentDir, []);
    }
    artifactsByFolder.get(parentDir)!.push(artifact);
  });

  /**
   * Recursively builds a tree node for a folder.
   *
   * @param folder - The folder to build a node for
   * @returns Complete tree node with children and artifacts
   */
  function buildNode(folder: ArtifactFolder): FolderTreeNode {
    const children: FolderTreeNode[] = [];

    // Find and build child folders
    // Match by parentPath if available, otherwise compute from path structure
    folders.forEach(f => {
      const isChild = f.parentPath === folder.path || 
        (!f.parentPath && getParentDirectory(f.path) === folder.path);
      if (isChild) {
        children.push(buildNode(f));
      }
    });

    return {
      folder,
      children,
      artifacts: artifactsByFolder.get(folder.path) || [],
      isExpanded: false,
    };
  }

  // Get root-level folders (directly under rootDir, not nested)
  // A folder is root-level if its parent directory (computed from path) equals rootDir
  const rootFolders = folders
    .filter(f => {
      const folderParentDir = getParentDirectory(f.path);
      const parentPathMatchesRoot = f.parentPath === rootDir;
      const computedParentMatchesRoot = !f.parentPath && folderParentDir === rootDir;
      return parentPathMatchesRoot || computedParentMatchesRoot;
    })
    .map(buildNode);

  return rootFolders;
}

/**
 * Extracts the parent directory path from a file path.
 *
 * @param filePath - Full path to a file
 * @returns Path to the parent directory
 *
 * @example
 * ```typescript
 * getParentDirectory('/path/to/project/.bluekit/kits/ui/button.md');
 * // Returns: '/path/to/project/.bluekit/kits/ui'
 * ```
 */
function getParentDirectory(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop(); // Remove filename
  return parts.join('/');
}

/**
 * Gets root-level artifacts (not in any folder).
 *
 * Returns artifacts that are directly in the artifact type directory
 * (e.g., `.bluekit/kits/button.md`) rather than inside a folder.
 *
 * @param artifacts - All artifacts of this type
 * @param folders - All folders in this artifact type
 * @param artifactType - Type directory ("kits", "walkthroughs", "diagrams")
 * @param projectPath - Project root path
 * @returns Artifacts not in any folder
 *
 * @example
 * ```typescript
 * const rootArtifacts = getRootArtifacts(kits, folders, 'kits', projectPath);
 * // Returns artifacts like: .bluekit/kits/button.md (not in a folder)
 * ```
 */
export function getRootArtifacts(
  artifacts: ArtifactFile[],
  folders: ArtifactFolder[],
  artifactType: string,
  projectPath: string
): ArtifactFile[] {
  const rootDir = `${projectPath}/.bluekit/${artifactType}`;
  const folderPaths = new Set(folders.map(f => f.path));

  return artifacts.filter(artifact => {
    const parentDir = getParentDirectory(artifact.path);
    // Artifact is in root dir AND not inside any folder
    return parentDir === rootDir && !folderPaths.has(parentDir);
  });
}
