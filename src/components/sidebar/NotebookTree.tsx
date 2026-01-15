import { Box, HStack, Icon, Text, Popover, Input, Button, VStack } from '@chakra-ui/react';

import { useEffect, useState, useMemo, useRef } from 'react';
import { LuFile, LuFolder, LuFolderOpen } from 'react-icons/lu';
import { FaStar } from 'react-icons/fa';
import { AiOutlineFileText } from 'react-icons/ai';
import { BsDiagram2 } from 'react-icons/bs';
import { invokeGetBlueKitFileTree, FileTreeNode } from '../../ipc/fileTree';
import { useColorMode } from '../../contexts/ColorModeContext';
import { NotebookContextMenu } from './NotebookContextMenu';
import { invokeWriteFile, invokeReadFile } from '../../ipc';
import { invokeCreateFolder } from '../../ipc/fileTree';
import { invokeRenameArtifactFolder, invokeDeleteArtifactFolder } from '../../ipc/folders';
import { deleteResources } from '../../ipc/artifacts';
import { toaster } from '../ui/toaster';

interface NotebookTreeProps {
    projectPath: string;
    onFileSelect: (node: FileTreeNode) => void;
    selectedFileId?: string;
    className?: string;
    version?: number;
    onTreeRefresh?: () => void;
    /** Called when a new file is created (for opening in edit mode) */
    onNewFileCreated?: (node: FileTreeNode) => void;
    /** Path of node in title-edit mode (visual highlight only, no input capture) */
    titleEditPath?: string | null;
    /** External title to display for the titleEditPath node (synced from editor) */
    editingTitle?: string;
}

// Inline edit state for Obsidian-style creation
interface InlineEditState {
    nodeId: string | null;
    path: string | null;  // Path of the node being edited
    isNew: boolean;       // true if this is a newly created item
    isFolder: boolean;
    value: string;
}


// Helper function to find a node by path in the tree
function findNodeByPath(nodes: FileTreeNode[], path: string): FileTreeNode | null {
    for (const node of nodes) {
        if (node.path === path) {
            return node;
        }
        if (node.children) {
            const found = findNodeByPath(node.children, path);
            if (found) return found;
        }
    }
    return null;
}

// Sanitize filename by removing invalid characters
function sanitizeFileName(name: string): string {
    // Remove characters that are invalid in filenames across platforms
    return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}

// Helper function to find all parent folder paths for a given file node
// Returns null if target not found, or array of parent folder paths if found
function findParentFolderPaths(nodes: FileTreeNode[], targetPath: string, parentPaths: string[] = []): string[] | null {
    for (const node of nodes) {
        if (node.path === targetPath) {
            // Found the target node, return all parent folder paths
            return parentPaths;
        }
        if (node.isFolder && node.children) {
            // Add current folder to parent list if it's a folder
            const newParentPaths = [...parentPaths, node.path];
            // Recursively search in children
            const found = findParentFolderPaths(node.children, targetPath, newParentPaths);
            if (found !== null) {
                // Found the target in this branch, return the path
                return found;
            }
        }
    }
    // Target not found in this branch
    return null;
}

export default function NotebookTree({
    projectPath,
    onFileSelect,
    selectedFileId,
    className,
    version,
    onTreeRefresh,
    onNewFileCreated,
    titleEditPath,
    editingTitle
}: NotebookTreeProps) {
    const [nodes, setNodes] = useState<FileTreeNode[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const { colorMode } = useColorMode();
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        node: FileTreeNode | null;
    }>({ isOpen: false, x: 0, y: 0, node: null });
    const [renameState, setRenameState] = useState<{
        isOpen: boolean;
        node: FileTreeNode | null;
        newName: string;
    }>({ isOpen: false, node: null, newName: '' });

    // Inline edit state for Obsidian-style creation
    const [inlineEdit, setInlineEdit] = useState<InlineEditState>({
        nodeId: null,
        path: null,
        isNew: false,
        isFolder: false,
        value: ''
    });

    useEffect(() => {
        loadTree();
    }, [projectPath, version]);

    const loadTree = async () => {
        try {
            const tree = await invokeGetBlueKitFileTree(projectPath);
            setNodes(tree);
        } catch (error) {
            console.error('Failed to load file tree:', error);
        }
    };

    // Find parent folder paths when a file is selected
    const parentFolderPaths = useMemo(() => {
        if (!selectedFileId || nodes.length === 0) {
            return new Set<string>();
        }
        const parentPaths = findParentFolderPaths(nodes, selectedFileId);
        return new Set(parentPaths || []);
    }, [selectedFileId, nodes]);

    // Auto-expand parent folders when a file is selected
    // We need to find folder IDs from paths to expand them
    useEffect(() => {
        if (parentFolderPaths.size > 0 && nodes.length > 0) {
            // Helper to find folder ID by path
            const findFolderIdByPath = (nodes: FileTreeNode[], targetPath: string): string | null => {
                for (const node of nodes) {
                    if (node.path === targetPath && node.isFolder) {
                        return node.id;
                    }
                    if (node.children) {
                        const found = findFolderIdByPath(node.children, targetPath);
                        if (found) return found;
                    }
                }
                return null;
            };

            setExpandedFolders(prev => {
                const next = new Set(prev);
                parentFolderPaths.forEach(path => {
                    const folderId = findFolderIdByPath(nodes, path);
                    if (folderId) {
                        next.add(folderId);
                    }
                });
                return next;
            });
        }
    }, [parentFolderPaths, nodes]);

    const handleToggleExpand = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    const refreshTree = () => {
        loadTree();
        if (onTreeRefresh) {
            onTreeRefresh();
        }
    };

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
        if (!node.isFolder) return;
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            node,
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ isOpen: false, x: 0, y: 0, node: null });
    };

    const handleNewFile = async (folderPath: string) => {
        try {
            const tempName = 'Untitled.md';
            // Use path separator that works cross-platform (backend handles normalization)
            const separator = folderPath.includes('\\') ? '\\' : '/';
            const filePath = `${folderPath}${separator}${tempName}`;

            // Create file with placeholder content
            await invokeWriteFile(filePath, '# Untitled\n\n');

            // Expand the parent folder to show new file
            const parentNode = findNodeByPath(nodes, folderPath);
            if (parentNode) {
                setExpandedFolders(prev => new Set([...prev, parentNode.id]));
            }

            // Refresh tree to show new file
            const tree = await invokeGetBlueKitFileTree(projectPath);
            setNodes(tree);

            // Find the new node and enter inline edit mode
            const newNode = findNodeByPath(tree, filePath);
            if (newNode) {
                // For files, don't enter inline edit in tree - editor will have focus
                // Parent component manages titleEditPath for visual sync
                // Just notify parent that a new file was created
                if (onNewFileCreated) {
                    onNewFileCreated(newNode);
                }
            }
        } catch (error) {
            console.error('Failed to create file:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to create file',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    const handleNewFolder = async (folderPath: string) => {
        try {
            const tempName = 'Untitled';
            // Use path separator that works cross-platform (backend handles normalization)
            const separator = folderPath.includes('\\') ? '\\' : '/';
            const newFolderPath = `${folderPath}${separator}${tempName}`;
            await invokeCreateFolder(newFolderPath);

            // Expand the parent folder to show new folder
            const parentNode = findNodeByPath(nodes, folderPath);
            if (parentNode) {
                setExpandedFolders(prev => new Set([...prev, parentNode.id]));
            }

            // Refresh tree to show new folder
            const tree = await invokeGetBlueKitFileTree(projectPath);
            setNodes(tree);

            // Find the new node and enter inline edit mode
            const newNode = findNodeByPath(tree, newFolderPath);
            if (newNode) {
                setInlineEdit({
                    nodeId: newNode.id,
                    path: newNode.path,
                    isNew: true,
                    isFolder: true,
                    value: tempName
                });
            }
        } catch (error) {
            console.error('Failed to create folder:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to create folder',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    // Handler for inline edit value changes
    const handleInlineEditChange = (value: string) => {
        setInlineEdit(prev => ({ ...prev, value }));
    };

    // Handler for completing inline edit (blur or Enter)
    const handleInlineEditComplete = async () => {
        if (!inlineEdit.nodeId || !inlineEdit.path) return;

        const node = findNodeByPath(nodes, inlineEdit.path);
        if (!node) {
            setInlineEdit({ nodeId: null, path: null, isNew: false, isFolder: false, value: '' });
            return;
        }

        // Sanitize and prepare name
        let newName = sanitizeFileName(inlineEdit.value) || 'Untitled';

        // For files, ensure .md extension
        if (!inlineEdit.isFolder && !newName.includes('.')) {
            newName += '.md';
        }

        const currentName = node.name;

        // Only rename if name changed
        if (currentName !== newName) {
            try {
                if (inlineEdit.isFolder) {
                    await invokeRenameArtifactFolder(node.path, newName);
                } else {
                    // For files: read content, write to new path, delete old
                    const content = await invokeReadFile(node.path);
                    const lastSeparator = node.path.lastIndexOf('/') > node.path.lastIndexOf('\\')
                        ? node.path.lastIndexOf('/')
                        : node.path.lastIndexOf('\\');
                    const parentDir = lastSeparator > 0 ? node.path.slice(0, lastSeparator) : node.path;
                    const separator = node.path.includes('\\') ? '\\' : '/';
                    const newPath = `${parentDir}${separator}${newName}`;

                    // Update the first line (H1) to match new name
                    const nameWithoutExt = newName.replace(/\.(md|markdown)$/, '');
                    let updatedContent = content;
                    if (content.startsWith('# ')) {
                        updatedContent = content.replace(/^# .+/, `# ${nameWithoutExt}`);
                    }

                    await invokeWriteFile(newPath, updatedContent);
                    if (node.path !== newPath) {
                        await deleteResources([node.path]);
                    }
                }

                toaster.create({
                    type: 'success',
                    title: inlineEdit.isFolder ? 'Folder renamed' : 'File renamed',
                    description: `Renamed to ${newName}`,
                });
            } catch (error) {
                console.error('Failed to rename:', error);
                toaster.create({
                    type: 'error',
                    title: 'Failed to rename',
                    description: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        // Clear inline edit state and refresh tree
        setInlineEdit({ nodeId: null, path: null, isNew: false, isFolder: false, value: '' });
        refreshTree();
    };

    // Handler for canceling inline edit (Escape key)
    const handleInlineEditCancel = async () => {
        if (!inlineEdit.path) {
            setInlineEdit({ nodeId: null, path: null, isNew: false, isFolder: false, value: '' });
            return;
        }

        // If this was a newly created item, delete it
        if (inlineEdit.isNew) {
            try {
                if (inlineEdit.isFolder) {
                    await invokeDeleteArtifactFolder(inlineEdit.path);
                } else {
                    await deleteResources([inlineEdit.path]);
                }
            } catch (error) {
                console.error('Failed to delete cancelled item:', error);
            }
            refreshTree();
        }

        setInlineEdit({ nodeId: null, path: null, isNew: false, isFolder: false, value: '' });
    };

    const handleCopyPath = async (filePath: string) => {
        try {
            await navigator.clipboard.writeText(filePath);
            toaster.create({
                type: 'success',
                title: 'Path copied',
                description: 'Absolute path copied to clipboard',
            });
        } catch (error) {
            console.error('Failed to copy path:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to copy',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    const handleCopyRelativePath = async (relativePath: string) => {
        try {
            await navigator.clipboard.writeText(relativePath);
            toaster.create({
                type: 'success',
                title: 'Relative path copied',
                description: 'Relative path copied to clipboard',
            });
        } catch (error) {
            console.error('Failed to copy relative path:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to copy',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    const handleRename = (node: FileTreeNode) => {
        setRenameState({
            isOpen: true,
            node,
            newName: node.name,
        });
    };

    const handleRenameConfirm = async () => {
        if (!renameState.node || !renameState.newName.trim()) {
            setRenameState({ isOpen: false, node: null, newName: '' });
            return;
        }

        const { node, newName } = renameState;
        try {
            if (node.isFolder) {
                await invokeRenameArtifactFolder(node.path, newName.trim());
                toaster.create({
                    type: 'success',
                    title: 'Folder renamed',
                    description: `Renamed to ${newName.trim()}`,
                });
            } else {
                // For files: read, write to new path, delete old
                const content = await invokeReadFile(node.path);
                // Extract parent directory from path
                const lastSeparator = node.path.lastIndexOf('/') > node.path.lastIndexOf('\\')
                    ? node.path.lastIndexOf('/')
                    : node.path.lastIndexOf('\\');
                const parentDir = lastSeparator > 0 ? node.path.slice(0, lastSeparator) : node.path;
                const separator = node.path.includes('\\') ? '\\' : '/';
                const newPath = `${parentDir}${separator}${newName.trim()}`;
                await invokeWriteFile(newPath, content);
                await deleteResources([node.path]);
                toaster.create({
                    type: 'success',
                    title: 'File renamed',
                    description: `Renamed to ${newName.trim()}`,
                });
            }

            setRenameState({ isOpen: false, node: null, newName: '' });
            refreshTree();
        } catch (error) {
            console.error('Failed to rename:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to rename',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    const handleDelete = async (node: FileTreeNode) => {
        if (!confirm(`Are you sure you want to delete "${node.name}"?`)) {
            return;
        }

        try {
            if (node.isFolder) {
                await invokeDeleteArtifactFolder(node.path);
                toaster.create({
                    type: 'success',
                    title: 'Folder deleted',
                    description: `${node.name} deleted successfully`,
                });
            } else {
                await deleteResources([node.path]);
                toaster.create({
                    type: 'success',
                    title: 'File deleted',
                    description: `${node.name} deleted successfully`,
                });
            }

            refreshTree();
        } catch (error) {
            console.error('Failed to delete:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to delete',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    // Calculate relative path helper
    const getRelativePath = (nodePath: string): string => {
        if (nodePath.startsWith(projectPath)) {
            return nodePath.slice(projectPath.length).replace(/^[/\\]/, '');
        }
        return nodePath;
    };

    return (
        <>
            <Box className={className} w="100%">
                <CustomTree
                    nodes={nodes}
                    onNodeClick={onFileSelect}
                    selectedId={selectedFileId}
                    parentFolderPaths={parentFolderPaths}
                    expandedFolders={expandedFolders}
                    onToggleExpand={handleToggleExpand}
                    colorMode={colorMode}
                    onContextMenu={handleContextMenu}
                    inlineEditNodeId={inlineEdit.nodeId}
                    inlineEditValue={inlineEdit.value}
                    onInlineEditChange={handleInlineEditChange}
                    onInlineEditComplete={handleInlineEditComplete}
                    onInlineEditCancel={handleInlineEditCancel}
                    titleEditPath={titleEditPath}
                    editingTitle={editingTitle}
                />
            </Box>

            <NotebookContextMenu
                isOpen={contextMenu.isOpen}
                x={contextMenu.x}
                y={contextMenu.y}
                node={contextMenu.node}
                projectPath={projectPath}
                onClose={closeContextMenu}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
                onCopyPath={handleCopyPath}
                onCopyRelativePath={(nodePath) => {
                    handleCopyRelativePath(getRelativePath(nodePath));
                }}
                onRename={handleRename}
                onDelete={handleDelete}
            />

            {/* Rename Popover */}
            <Popover.Root
                open={renameState.isOpen}
                onOpenChange={(e) => {
                    if (!e.open) {
                        setRenameState({ isOpen: false, node: null, newName: '' });
                    }
                }}
            >
                <Popover.Positioner>
                    <Popover.Content width="280px">
                        <Popover.Arrow />
                        <Popover.Body p={3}>
                            <VStack gap={3} align="stretch">
                                <Text fontSize="sm" fontWeight="medium">
                                    Rename {renameState.node?.isFolder ? 'Folder' : 'File'}
                                </Text>
                                <Input
                                    size="sm"
                                    value={renameState.newName}
                                    onChange={(e) =>
                                        setRenameState((prev) => ({ ...prev, newName: e.target.value }))
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleRenameConfirm();
                                        } else if (e.key === 'Escape') {
                                            setRenameState({ isOpen: false, node: null, newName: '' });
                                        }
                                    }}
                                    autoFocus
                                />
                                <HStack justify="flex-end">
                                    <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => setRenameState({ isOpen: false, node: null, newName: '' })}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="xs"
                                        colorPalette="primary"
                                        onClick={handleRenameConfirm}
                                        disabled={!renameState.newName.trim()}
                                    >
                                        Rename
                                    </Button>
                                </HStack>
                            </VStack>
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Popover.Root>
        </>
    );
}

// Simple recursive tree component
interface CustomTreeProps {
    nodes: FileTreeNode[];
    onNodeClick: (node: FileTreeNode) => void;
    selectedId?: string;
    parentFolderPaths: Set<string>;
    expandedFolders: Set<string>;
    onToggleExpand: (folderId: string) => void;
    level?: number;
    colorMode: string;
    onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
    // Inline edit props (for folders)
    inlineEditNodeId: string | null;
    inlineEditValue: string;
    onInlineEditChange: (value: string) => void;
    onInlineEditComplete: () => void;
    onInlineEditCancel: () => void;
    // Title edit props (for files - visual only, no input capture)
    titleEditPath: string | null | undefined;
    editingTitle: string | undefined;
}

function CustomTree({
    nodes,
    onNodeClick,
    selectedId,
    parentFolderPaths,
    expandedFolders,
    onToggleExpand,
    level = 0,
    colorMode,
    onContextMenu,
    inlineEditNodeId,
    inlineEditValue,
    onInlineEditChange,
    onInlineEditComplete,
    onInlineEditCancel,
    titleEditPath,
    editingTitle
}: CustomTreeProps) {
    return (
        <Box pl={level > 0 ? 4 : 0}>
            {nodes.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    onNodeClick={onNodeClick}
                    selectedId={selectedId}
                    parentFolderPaths={parentFolderPaths}
                    expandedFolders={expandedFolders}
                    isExpanded={expandedFolders.has(node.id)}
                    onToggleExpand={onToggleExpand}
                    level={level}
                    colorMode={colorMode}
                    onContextMenu={onContextMenu}
                    isEditing={inlineEditNodeId === node.id}
                    editValue={inlineEditValue}
                    onEditChange={onInlineEditChange}
                    onEditComplete={onInlineEditComplete}
                    onEditCancel={onInlineEditCancel}
                    inlineEditNodeId={inlineEditNodeId}
                    titleEditPath={titleEditPath}
                    editingTitle={editingTitle}
                />
            ))}
        </Box>
    );
}

function TreeNode({
    node,
    onNodeClick,
    selectedId,
    parentFolderPaths,
    expandedFolders,
    isExpanded,
    onToggleExpand,
    level,
    colorMode,
    onContextMenu,
    isEditing,
    editValue,
    onEditChange,
    onEditComplete,
    onEditCancel,
    inlineEditNodeId,
    titleEditPath,
    editingTitle
}: {
    node: FileTreeNode,
    onNodeClick: (node: FileTreeNode) => void,
    selectedId?: string,
    parentFolderPaths: Set<string>,
    expandedFolders: Set<string>,
    isExpanded: boolean,
    onToggleExpand: (folderId: string) => void,
    level: number,
    colorMode: string,
    onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void,
    // Inline edit props (for folders)
    isEditing: boolean,
    editValue: string,
    onEditChange: (value: string) => void,
    onEditComplete: () => void,
    onEditCancel: () => void,
    inlineEditNodeId: string | null,
    // Title edit props (for files - visual only sync)
    titleEditPath: string | null | undefined,
    editingTitle: string | undefined
}) {
    // Check if this node is in title-edit mode (visual only, for files)
    const isInTitleEditMode = !node.isFolder && titleEditPath === node.path;

    // Track if text has been selected to prevent re-selecting on every render
    const hasSelectedTextRef = useRef<boolean>(false);

    // Reset selection state when exiting edit mode
    useEffect(() => {
        if (!isEditing) {
            hasSelectedTextRef.current = false;
        }
    }, [isEditing]);

    const handleClick = () => {
        // Don't handle clicks when editing
        if (isEditing) return;

        if (node.isFolder) {
            onToggleExpand(node.id);
        } else {
            onNodeClick(node);
        }
    };

    const isSelected = selectedId === node.path;

    // Check if file is a markdown file
    const isMarkdownFile = !node.isFolder && (node.name.endsWith('.md') || node.name.endsWith('.markdown'));
    // Check if file is a mermaid diagram file
    const isMermaidFile = !node.isFolder && node.name.endsWith('.mmd');

    // Helper function to strip file extension (.mmd or .md) from display name
    const getDisplayName = (fileName: string): string => {
        if (fileName.endsWith('.mmd')) {
            return fileName.slice(0, -4);
        }
        if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
            return fileName.replace(/\.(md|markdown)$/, '');
        }
        return fileName;
    };

    // Match the sidebar menu item styling (subtle blue button style) for light mode
    // Light mode: subtle blue background (blue.100), darker navy text (blue.700)
    // Dark mode: keep original styling (whiteAlpha.200 background, blue.200 text)
    const hoverBg = colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.100';
    const selectedBg = colorMode === 'light' ? 'blue.100' : 'whiteAlpha.200';
    const selectedColor = colorMode === 'light' ? 'blue.700' : 'blue.200';

    // Determine the icon to use
    const getFileIcon = () => {
        if (node.isFolder) {
            return isExpanded ? LuFolderOpen : LuFolder;
        }
        if (isMermaidFile) {
            return BsDiagram2;
        }
        return isMarkdownFile ? AiOutlineFileText : LuFile;
    };

    // Handle input key events
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onEditComplete();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onEditCancel();
        }
    };

    return (
        <Box mb={0.5}>
            <HStack
                py={1}
                px={2}
                cursor={isEditing ? 'default' : 'pointer'}
                onClick={handleClick}
                onContextMenu={(e) => onContextMenu(e, node)}
                bg={isSelected || isEditing || isInTitleEditMode ? selectedBg : 'transparent'}
                color={isSelected || isEditing || isInTitleEditMode ? selectedColor : 'inherit'}
                _hover={{ bg: isSelected || isEditing || isInTitleEditMode ? selectedBg : hoverBg }}
                borderRadius="sm"
                gap={2}
                transition="all 0.1s"
            >
                <Icon
                    as={getFileIcon()}
                    color={node.isFolder ? "blue.400" : (isSelected ? "currentColor" : "gray.500")}
                    boxSize={4}
                    flexShrink={0}
                />
                {isEditing ? (
                    <Input
                        size="xs"
                        value={editValue}
                        onChange={(e) => onEditChange(e.target.value)}
                        onBlur={onEditComplete}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        flex={1}
                        fontSize="sm"
                        py={0}
                        px={1}
                        h="auto"
                        minH="unset"
                        border="none"
                        bg="transparent"
                        _focus={{
                            boxShadow: 'none',
                            outline: 'none',
                            bg: colorMode === 'light' ? 'white' : 'whiteAlpha.100'
                        }}
                        ref={(input) => {
                            // Auto-select text when input is first focused (only once)
                            if (input && !hasSelectedTextRef.current) {
                                setTimeout(() => {
                                    input.select();
                                    hasSelectedTextRef.current = true;
                                }, 0);
                            }
                        }}
                    />
                ) : (
                    <Text fontSize="sm" truncate flex={1}>
                        {isInTitleEditMode && editingTitle ? editingTitle : (node.isFolder ? node.name : getDisplayName(node.name))}
                    </Text>
                )}
                {node.isEssential && (
                    <Icon as={FaStar} color="blue.500" boxSize={3} />
                )}
            </HStack>

            {
                node.isFolder && isExpanded && node.children && (
                    <Box mt={0.5}>
                        <CustomTree
                            nodes={node.children}
                            onNodeClick={onNodeClick}
                            selectedId={selectedId}
                            parentFolderPaths={parentFolderPaths}
                            expandedFolders={expandedFolders}
                            onToggleExpand={onToggleExpand}
                            level={level + 1}
                            colorMode={colorMode}
                            onContextMenu={onContextMenu}
                            inlineEditNodeId={inlineEditNodeId}
                            inlineEditValue={editValue}
                            onInlineEditChange={onEditChange}
                            onInlineEditComplete={onEditComplete}
                            onInlineEditCancel={onEditCancel}
                            titleEditPath={titleEditPath}
                            editingTitle={editingTitle}
                        />
                    </Box>
                )
            }
        </Box >
    );
}
