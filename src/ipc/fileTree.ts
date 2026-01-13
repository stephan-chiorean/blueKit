import { invoke } from '@tauri-apps/api/tauri';

export interface FileTreeNode {
    id: string;
    name: string;
    path: string;
    isFolder: boolean;
    children?: FileTreeNode[];
    artifactType?: string;
    isEssential: boolean;
    frontMatter?: any;
}

/**
 * Gets a recursive file tree of the .bluekit directory.
 * @param projectPath Path to the project root
 */
export async function invokeGetBlueKitFileTree(projectPath: string): Promise<FileTreeNode[]> {
    return await invoke<FileTreeNode[]>('get_bluekit_file_tree', { projectPath });
}

/**
 * Creates a folder at the specified path.
 * @param path Absolute path to the folder
 */
export async function invokeCreateFolder(path: string): Promise<void> {
    return await invoke('create_folder', { path });
}
