import { Box, HStack, Icon, Text, Popover, Input, Button, VStack } from '@chakra-ui/react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { LuFile, LuChevronRight, LuArrowRight, LuX } from 'react-icons/lu';
import { FaBookmark } from 'react-icons/fa';
import { AiOutlineFileText } from 'react-icons/ai';
import { RxFileText } from 'react-icons/rx';
import { invokeGetBlueKitFileTree, FileTreeNode } from '@/ipc/fileTree';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { DirectoryContextMenu } from './DirectoryContextMenu';
import { FileContextMenu } from './FileContextMenu';
import { listen } from '@tauri-apps/api/event';
import { invokeWriteFile, invokeReadFile, invokeAddBookmark, invokeGetBookmarks } from '@/ipc';
import { BookmarkItem } from '@/ipc/types';
import { invokeCreateFolder } from '@/ipc/fileTree';
import { invokeRenameArtifactFolder, invokeDeleteArtifactFolder, invokeMoveArtifactToFolder } from '@/ipc/folders';
import { deleteResources } from '@/ipc/artifacts';
import { toaster } from '@/shared/components/ui/toaster';


const MotionBox = motion.create(Box);

// ... (inside component)


interface NotebookTreeProps {
    projectPath: string;
    onFileSelect: (node: FileTreeNode) => void;
    selectedFileId?: string;
    className?: string;
    version?: number;
    onTreeRefresh?: () => void;
    /** Called when a new file is created (for opening in edit mode) */
    onNewFileCreated?: (node: FileTreeNode) => void;
    /** Called with handlers for creating files/folders (for toolbar) */
    onHandlersReady?: (handlers: { onNewFile: (folderPath: string) => void; onNewFolder: (folderPath: string) => void }) => void;
    onNewNote: (parentPath?: string) => void;
}

// Inline edit state for Obsidian-style creation
interface InlineEditState {
    nodeId: string | null;
    path: string | null;  // Path of the node being edited
    isNew: boolean;       // true if this is a newly created item
    isFolder: boolean;
    value: string;
}

// Drag state for file/folder movement
interface DragState {
    draggedNode: FileTreeNode;
    originalParentPath: string | null;
    dropTargetPath: string | null | undefined; // null = root, undefined = invalid area
    isValidDrop: boolean;
    startPosition: { x: number; y: number };
}

// Constants for drag behavior
const DRAG_THRESHOLD = 5; // Pixels before drag activates
const AUTO_EXPAND_DELAY = 500; // ms before auto-expanding folder on hover

// Check if targetPath is inside sourcePath (for folder-into-itself prevention)
function isDescendantOf(targetPath: string, sourcePath: string): boolean {
    const normalizedTarget = targetPath.replace(/\\/g, '/');
    const normalizedSource = sourcePath.replace(/\\/g, '/');
    return normalizedTarget.startsWith(normalizedSource + '/');
}

// Get parent folder path from a file path
function getParentPath(nodePath: string): string | null {
    const lastSep = Math.max(nodePath.lastIndexOf('/'), nodePath.lastIndexOf('\\'));
    return lastSep > 0 ? nodePath.slice(0, lastSep) : null;
}

// Validate if drop is allowed
function isValidDropTarget(
    draggedNode: FileTreeNode,
    targetPath: string | null | undefined,
    originalParentPath: string | null
): boolean {
    // Not over a valid area
    if (targetPath === undefined) return false;

    // Same parent = no-op
    if (targetPath === originalParentPath) return false;

    // Cannot drop folder into itself or its descendants
    if (draggedNode.isFolder && targetPath !== null) {
        if (targetPath === draggedNode.path) return false;
        if (isDescendantOf(targetPath, draggedNode.path)) return false;
    }

    return true;
}

// Find drop target at cursor position using data attributes
function findDropTargetAtPosition(x: number, y: number): string | null | undefined {
    const elements = document.elementsFromPoint(x, y);

    for (const el of elements) {
        const droppableEl = (el as HTMLElement).closest('[data-droppable-folder]');
        if (droppableEl) {
            const path = droppableEl.getAttribute('data-droppable-folder');
            // Empty string means root drop zone
            return path === '' ? null : path;
        }
    }

    // Check if over tree area for root drop
    const treeArea = document.querySelector('[data-notebook-tree-root]');
    if (treeArea) {
        const rect = treeArea.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return null; // Root
        }
    }

    return undefined; // Not a valid drop area
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

// Extract all bookmarked file paths from the nested bookmark structure
function extractBookmarkedPaths(items: BookmarkItem[]): Set<string> {
    const paths = new Set<string>();
    const traverse = (items: BookmarkItem[]) => {
        for (const item of items) {
            if (item.type === 'file') {
                paths.add(item.path);
            } else if (item.type === 'group') {
                traverse(item.items);
            }
        }
    };
    traverse(items);
    return paths;
}

export default function NotebookTree({
    projectPath,
    onFileSelect,
    selectedFileId,
    className,
    version,
    onTreeRefresh,
    onHandlersReady,
    onNewNote,
}: NotebookTreeProps) {
    const [nodes, setNodes] = useState<FileTreeNode[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const { colorMode } = useColorMode();
    const [directoryContextMenu, setDirectoryContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        node: FileTreeNode | null;
    }>({ isOpen: false, x: 0, y: 0, node: null });
    const [fileContextMenu, setFileContextMenu] = useState<{
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

    // Drag state for file/folder movement
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [hasDragThresholdMet, setHasDragThresholdMet] = useState(false);
    const [pendingExpandFolderId, setPendingExpandFolderId] = useState<string | null>(null);
    const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Bookmarked paths state for showing bookmark icons
    const [bookmarkedPaths, setBookmarkedPaths] = useState<Set<string>>(new Set());







    // Load bookmarks and extract paths
    const loadBookmarks = useCallback(async () => {
        try {
            const data = await invokeGetBookmarks(projectPath);
            const paths = extractBookmarkedPaths(data.items);
            setBookmarkedPaths(paths);
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
        }
    }, [projectPath]);

    // Initial load of bookmarks
    useEffect(() => {
        loadBookmarks();
    }, [loadBookmarks]);

    // Listen for file changes to refresh bookmarks
    useEffect(() => {
        let unlisten: (() => void) | null = null;
        let isCancelled = false;

        const setupListener = async () => {
            // Generate the event name (must match the Rust code)
            const sanitizedPath = projectPath
                .replace(/\//g, '_')
                .replace(/\\/g, '_')
                .replace(/:/g, '_')
                .replace(/\./g, '_')
                .replace(/ /g, '_');
            const eventName = `project-artifacts-changed-${sanitizedPath}`;

            const unlistenFn = await listen<string[]>(eventName, (event) => {
                // Check if bookmarks.json was changed
                const changedPaths = event.payload;
                const bookmarksChanged = changedPaths.some(p => p.endsWith('bookmarks.json'));
                if (bookmarksChanged) {
                    loadBookmarks();
                }
            });

            // If effect was cleaned up while waiting for listen(), clean up immediately
            if (isCancelled) {
                unlistenFn();
            } else {
                unlisten = unlistenFn;
            }
        };

        setupListener();

        return () => {
            isCancelled = true;
            if (unlisten) unlisten();
        };
    }, [projectPath, loadBookmarks]);

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

    // Track previous selectedFileId to detect actual selection changes
    const prevSelectedFileIdRef = useRef<string | undefined>(undefined);

    // Find parent folder paths when a file is selected
    const parentFolderPaths = useMemo(() => {
        if (!selectedFileId || nodes.length === 0) {
            return new Set<string>();
        }
        const parentPaths = findParentFolderPaths(nodes, selectedFileId);
        return new Set(parentPaths || []);
    }, [selectedFileId, nodes]);

    // Auto-expand parent folders when a file is selected
    // Only runs when selectedFileId actually changes (not on tree refresh)
    useEffect(() => {
        // Only expand if selectedFileId changed (not just tree refresh)
        if (selectedFileId !== prevSelectedFileIdRef.current) {
            prevSelectedFileIdRef.current = selectedFileId;

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
        }
    }, [selectedFileId, parentFolderPaths, nodes]);

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

    // Clear drag state helper
    const clearDragState = useCallback(() => {
        setDragState(null);
        setHasDragThresholdMet(false);
        setPendingExpandFolderId(null);
        if (hoverExpandTimerRef.current) {
            clearTimeout(hoverExpandTimerRef.current);
            hoverExpandTimerRef.current = null;
        }
    }, []);

    // Perform move operation
    const performMove = useCallback(async (node: FileTreeNode, targetFolderPath: string | null) => {
        try {
            const blukitRoot = `${projectPath}/.bluekit`;
            const targetPath = targetFolderPath ?? blukitRoot;
            await invokeMoveArtifactToFolder(node.path, targetPath);

            const targetName = targetFolderPath === null
                ? 'root'
                : findNodeByPath(nodes, targetFolderPath)?.name || 'folder';

            toaster.create({
                type: 'success',
                title: 'File moved',
                description: `Moved "${node.name}" to ${targetName}`,
            });

            refreshTree();
        } catch (error) {
            console.error('Failed to move file:', error);
            toaster.create({
                type: 'error',
                title: 'Move failed',
                description: error instanceof Error ? error.message : 'An error occurred',
            });
        }
    }, [projectPath, nodes, refreshTree]);

    // Handle drag start from a tree node
    const handleDragStart = useCallback((node: FileTreeNode, position: { x: number; y: number }) => {
        // Don't allow dragging essential files
        if (node.isEssential) return;

        setDragState({
            draggedNode: node,
            originalParentPath: getParentPath(node.path),
            dropTargetPath: undefined,
            isValidDrop: false,
            startPosition: position,
        });
        setMousePosition(position);
    }, []);

    // Document-level mouse event handlers for drag
    useEffect(() => {
        if (!dragState) return;

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });

            // Check drag threshold
            if (!hasDragThresholdMet) {
                const dx = Math.abs(e.clientX - dragState.startPosition.x);
                const dy = Math.abs(e.clientY - dragState.startPosition.y);
                if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                    setHasDragThresholdMet(true);
                }
                return;
            }

            // Find drop target at cursor position
            const dropTarget = findDropTargetAtPosition(e.clientX, e.clientY);
            const isValid = isValidDropTarget(dragState.draggedNode, dropTarget, dragState.originalParentPath);

            setDragState(prev => prev ? {
                ...prev,
                dropTargetPath: dropTarget,
                isValidDrop: isValid
            } : null);
        };

        const handleMouseUp = async () => {
            if (hasDragThresholdMet && dragState.isValidDrop && dragState.dropTargetPath !== undefined) {
                await performMove(dragState.draggedNode, dragState.dropTargetPath);
            }
            clearDragState();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                clearDragState();
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [dragState, hasDragThresholdMet, clearDragState, performMove]);

    // Auto-expand folders on hover while dragging
    useEffect(() => {
        // Only relevant during active drag
        if (!dragState || !hasDragThresholdMet) {
            if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current);
                hoverExpandTimerRef.current = null;
            }
            setPendingExpandFolderId(null);
            return;
        }

        const targetPath = dragState.dropTargetPath;

        // Clear timer if not hovering a folder
        if (!targetPath) {
            if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current);
                hoverExpandTimerRef.current = null;
            }
            setPendingExpandFolderId(null);
            return;
        }

        // Find the folder being hovered
        const hoveredFolder = findNodeByPath(nodes, targetPath);
        if (!hoveredFolder?.isFolder) return;

        // Already expanded? No timer needed
        if (expandedFolders.has(hoveredFolder.id)) {
            setPendingExpandFolderId(null);
            return;
        }

        // New folder hover - start timer
        if (pendingExpandFolderId !== hoveredFolder.id) {
            if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current);
            }

            setPendingExpandFolderId(hoveredFolder.id);

            hoverExpandTimerRef.current = setTimeout(() => {
                setExpandedFolders(prev => new Set([...prev, hoveredFolder.id]));
                setPendingExpandFolderId(null);
                hoverExpandTimerRef.current = null;
            }, AUTO_EXPAND_DELAY);
        }
    }, [dragState?.dropTargetPath, hasDragThresholdMet, nodes, expandedFolders, pendingExpandFolderId]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current);
            }
        };
    }, []);

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
        e.preventDefault();
        e.stopPropagation();

        if (node.isFolder) {
            setDirectoryContextMenu({
                isOpen: true,
                x: e.clientX,
                y: e.clientY,
                node,
            });
        } else {
            setFileContextMenu({
                isOpen: true,
                x: e.clientX,
                y: e.clientY,
                node,
            });
        }
    };

    const closeDirectoryContextMenu = () => {
        setDirectoryContextMenu({ isOpen: false, x: 0, y: 0, node: null });
    };

    const closeFileContextMenu = () => {
        setFileContextMenu({ isOpen: false, x: 0, y: 0, node: null });
    };



    const handleNewFolder = useCallback(async (folderPath: string) => {
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
    }, [nodes, projectPath]);

    // Expose handlers to parent component (for toolbar)
    // Re-register whenever handlers change to ensure callbacks are up-to-date
    useEffect(() => {
        if (onHandlersReady) {
            onHandlersReady({
                onNewFile: (path) => onNewNote(path),
                onNewFolder: handleNewFolder
            });
        }
    }, [onHandlersReady, onNewNote, handleNewFolder]);

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

    // Handle adding file to bookmarks
    const handleAddToBookmarks = async (node: FileTreeNode) => {
        if (node.isFolder) return; // Only bookmark files

        try {
            // Extract title from filename (without extension)
            const title = node.name.replace(/\.(md|markdown|mmd)$/, '');

            await invokeAddBookmark(projectPath, {
                type: 'file',
                ctime: Date.now(),
                path: node.path,
                title,
            });

            toaster.create({
                type: 'success',
                title: 'Bookmarked',
                description: `Added "${title}" to bookmarks`,
            });
        } catch (error) {
            console.error('Failed to add bookmark:', error);
            // Check if it's a duplicate error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('already bookmarked')) {
                toaster.create({
                    type: 'info',
                    title: 'Already bookmarked',
                    description: 'This file is already in your bookmarks',
                });
            } else {
                toaster.create({
                    type: 'error',
                    title: 'Failed to bookmark',
                    description: errorMessage,
                });
            }
        }
    };

    // Handle file duplication
    const handleDuplicate = async (node: FileTreeNode) => {
        if (node.isFolder) return; // Only duplicate files

        try {
            // Read the original file content
            const content = await invokeReadFile(node.path);

            // Generate new filename with " copy" suffix
            const lastSeparator = node.path.lastIndexOf('/') > node.path.lastIndexOf('\\')
                ? node.path.lastIndexOf('/')
                : node.path.lastIndexOf('\\');
            const parentDir = lastSeparator > 0 ? node.path.slice(0, lastSeparator) : node.path;
            const separator = node.path.includes('\\') ? '\\' : '/';

            // Extract name and extension
            const baseName = node.name.replace(/\.(md|markdown|mmd)$/, '');
            const extension = node.name.match(/\.(md|markdown|mmd)$/)?.[0] || '.md';

            // Create new filename with " copy" suffix
            let copyName = `${baseName} copy${extension}`;
            let newPath = `${parentDir}${separator}${copyName}`;

            // Check if the copy already exists, increment copy number if needed
            let copyNumber = 1;
            let existingNode = findNodeByPath(nodes, newPath);
            while (existingNode) {
                copyNumber++;
                copyName = `${baseName} copy ${copyNumber}${extension}`;
                newPath = `${parentDir}${separator}${copyName}`;
                existingNode = findNodeByPath(nodes, newPath);
            }

            // Update the first line (H1) if it's a markdown file
            let duplicatedContent = content;
            const nameWithoutExt = copyName.replace(/\.(md|markdown|mmd)$/, '');
            if (content.startsWith('# ')) {
                duplicatedContent = content.replace(/^# .+/, `# ${nameWithoutExt}`);
            }

            // Write the duplicated file
            await invokeWriteFile(newPath, duplicatedContent);

            toaster.create({
                type: 'success',
                title: 'File duplicated',
                description: `Created "${copyName}"`,
            });

            refreshTree();
        } catch (error) {
            console.error('Failed to duplicate file:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to duplicate',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    // Get target folder name for drag tooltip
    const getDropTargetName = (): string | null | undefined => {
        if (!dragState) return undefined;
        if (dragState.dropTargetPath === undefined) return undefined;
        if (dragState.dropTargetPath === null) return null;
        return findNodeByPath(nodes, dragState.dropTargetPath)?.name ?? null;
    };

    return (
        <>
            <Box className={className} w="100%" data-notebook-tree-root>
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
                    onDragStart={handleDragStart}
                    draggedNodePath={dragState?.draggedNode.path}
                    dropTargetPath={hasDragThresholdMet ? dragState?.dropTargetPath : undefined}
                    isValidDrop={dragState?.isValidDrop ?? false}
                    bookmarkedPaths={bookmarkedPaths}
                />

                {/* Root drop zone - visible during drag */}
                {dragState && hasDragThresholdMet && (
                    <Box
                        data-droppable-folder=""
                        mt={3}
                        py={3}
                        borderRadius="md"
                        border="2px dashed"
                        borderColor={
                            dragState.dropTargetPath === null && dragState.isValidDrop
                                ? 'blue.400'
                                : colorMode === 'light' ? 'gray.300' : 'gray.600'
                        }
                        bg={
                            dragState.dropTargetPath === null && dragState.isValidDrop
                                ? colorMode === 'light' ? 'blue.50' : 'blue.900'
                                : 'transparent'
                        }
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        transition="all 0.15s"
                    >
                        <Text fontSize="xs" color={colorMode === 'light' ? 'gray.500' : 'gray.400'}>
                            Drop here to move to root
                        </Text>
                    </Box>
                )}
            </Box>

            {/* Drag Tooltip */}
            {dragState && hasDragThresholdMet && (
                <DragTooltip
                    node={dragState.draggedNode}
                    targetFolderName={getDropTargetName()}
                    position={mousePosition}
                    isValidDrop={dragState.isValidDrop}
                    colorMode={colorMode}
                />
            )}

            <DirectoryContextMenu
                isOpen={directoryContextMenu.isOpen}
                x={directoryContextMenu.x}
                y={directoryContextMenu.y}
                node={directoryContextMenu.node}
                projectPath={projectPath}
                onClose={closeDirectoryContextMenu}
                onNewFile={onNewNote}
                onNewFolder={handleNewFolder}
                onCopyPath={handleCopyPath}
                onCopyRelativePath={(nodePath: string) => {
                    handleCopyRelativePath(getRelativePath(nodePath));
                }}
                onRename={handleRename}
                onDelete={handleDelete}
            />

            <FileContextMenu
                isOpen={fileContextMenu.isOpen}
                x={fileContextMenu.x}
                y={fileContextMenu.y}
                node={fileContextMenu.node}
                projectPath={projectPath}
                onClose={closeFileContextMenu}
                onDuplicate={handleDuplicate}
                onCopyPath={handleCopyPath}
                onCopyRelativePath={(nodePath: string) => {
                    handleCopyRelativePath(getRelativePath(nodePath));
                }}
                onRename={handleRename}
                onDelete={handleDelete}
                onAddToBookmarks={handleAddToBookmarks}
                onNewNote={onNewNote}
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

// Drag tooltip component
interface DragTooltipProps {
    node: FileTreeNode;
    targetFolderName: string | null | undefined; // null = "root", undefined = invalid area
    position: { x: number; y: number };
    isValidDrop: boolean;
    colorMode: string;
}

function DragTooltip({ node, targetFolderName, position, isValidDrop, colorMode }: DragTooltipProps) {
    // Determine action text
    let actionText: string;
    let actionColor: string;

    if (targetFolderName === undefined) {
        actionText = 'Release to cancel';
        actionColor = colorMode === 'light' ? 'gray.500' : 'gray.400';
    } else if (!isValidDrop) {
        actionText = 'Cannot move here';
        actionColor = 'red.400';
    } else if (targetFolderName === null) {
        actionText = 'Move to root';
        actionColor = 'blue.500';
    } else {
        actionText = `Move to ${targetFolderName}`;
        actionColor = 'blue.500';
    }

    const IconComponent = node.isFolder ? LuChevronRight :
        (node.name.endsWith('.md') || node.name.endsWith('.markdown') ? AiOutlineFileText : LuFile);

    // Strip extension from display name
    const displayName = node.name.replace(/\.(md|markdown|mmd)$/, '');

    return createPortal(
        <Box
            position="fixed"
            left={`${position.x + 16}px`}
            top={`${position.y + 8}px`}
            pointerEvents="none"
            zIndex={9999}
            bg={colorMode === 'light' ? 'white' : 'gray.800'}
            borderRadius="md"
            boxShadow="lg"
            px={3}
            py={2}
            border="2px solid"
            borderColor={isValidDrop ? 'blue.400' : 'red.400'}
            minW="180px"
            maxW="280px"
        >
            <HStack gap={2}>
                <Icon as={IconComponent} color="blue.400" boxSize={4} />
                <Text fontSize="sm" fontWeight="medium" truncate>
                    {displayName}
                </Text>
            </HStack>
            <HStack gap={1} mt={1.5}>
                <Icon
                    as={isValidDrop ? LuArrowRight : LuX}
                    boxSize={3}
                    color={actionColor}
                />
                <Text fontSize="xs" color={actionColor}>
                    {actionText}
                </Text>
            </HStack>
        </Box>,
        document.body
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
    // Drag props
    onDragStart: (node: FileTreeNode, position: { x: number; y: number }) => void;
    draggedNodePath?: string;
    dropTargetPath?: string | null;
    isValidDrop: boolean;
    // Bookmark props
    bookmarkedPaths: Set<string>;
    // Hover props

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
    onDragStart,
    draggedNodePath,
    dropTargetPath,
    isValidDrop,
    bookmarkedPaths
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
                    onDragStart={onDragStart}
                    isBeingDragged={draggedNodePath === node.path}
                    isDraggedOver={dropTargetPath === node.path}
                    isDraggedOverInvalid={dropTargetPath === node.path && !isValidDrop}
                    draggedNodePath={draggedNodePath}
                    dropTargetPath={dropTargetPath}
                    isValidDrop={isValidDrop}
                    bookmarkedPaths={bookmarkedPaths}
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
    onDragStart,
    isBeingDragged,
    isDraggedOver,
    isDraggedOverInvalid,
    draggedNodePath,
    dropTargetPath,
    isValidDrop,
    bookmarkedPaths
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
    // Drag props
    onDragStart: (node: FileTreeNode, position: { x: number; y: number }) => void,
    isBeingDragged: boolean,
    isDraggedOver: boolean,
    isDraggedOverInvalid: boolean,
    draggedNodePath?: string,
    dropTargetPath?: string | null,
    isValidDrop: boolean,
    // Bookmark props
    bookmarkedPaths: Set<string>,
    // Hover props

}) {
    // Check if this file is bookmarked
    const isBookmarked = !node.isFolder && bookmarkedPaths.has(node.path);

    // Track hover state for blue square opacity
    const [isHovered, setIsHovered] = useState(false);

    // Track if text has been selected to prevent re-selecting on every render
    const hasSelectedTextRef = useRef<boolean>(false);

    // Reset selection state when exiting edit mode
    useEffect(() => {
        if (!isEditing) {
            hasSelectedTextRef.current = false;
        }
    }, [isEditing]);

    const handleClick = () => {
        // Don't handle clicks when editing or dragging
        if (isEditing || isBeingDragged) return;

        if (node.isFolder) {
            onToggleExpand(node.id);
        } else {
            onNodeClick(node);
        }
    };

    // Handle mouse down for drag initiation
    const handleMouseDown = (e: React.MouseEvent) => {
        // Only start drag on left mouse button
        if (e.button !== 0) return;
        // Don't start drag when editing
        if (isEditing) return;
        // Don't drag essential files
        if (node.isEssential) return;

        onDragStart(node, { x: e.clientX, y: e.clientY });
    };

    const isSelected = selectedId === node.path;

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

    // Match the sidebar menu item styling (subtle blue button style) for both modes
    // Light mode: subtle blue background (blue.100), darker navy text (blue.700)
    // Dark mode: use blue.900 for consistency instead of whiteAlpha which creates visible borders
    const hoverBg = colorMode === 'light' ? 'blackAlpha.50' : 'rgba(66, 135, 245, 0.08)';
    const selectedBg = colorMode === 'light' ? 'blue.100' : 'blue.900';
    const selectedColor = colorMode === 'light' ? 'blue.700' : 'blue.200';

    // Drag over styling
    const dragOverBg = isDraggedOverInvalid
        ? (colorMode === 'light' ? 'red.50' : 'red.900')
        : (colorMode === 'light' ? 'blue.50' : 'blue.900');
    const dragOverBorderColor = isDraggedOverInvalid ? 'red.400' : 'blue.400';

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

    // Determine cursor style
    const getCursor = () => {
        return 'default';
    };

    return (
        <Box mb={0.5}>
            <HStack
                py={1}
                pl={2}
                pr={0}
                cursor={getCursor()}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onContextMenu={(e) => onContextMenu(e, node)}
                bg={
                    isDraggedOver ? dragOverBg :
                        (isSelected || isEditing ? selectedBg : 'transparent')
                }
                color={isSelected || isEditing ? selectedColor : 'inherit'}
                _hover={{
                    bg: isDraggedOver ? dragOverBg :
                        (isSelected || isEditing ? selectedBg : hoverBg)
                }}
                borderRadius="sm"
                gap={2}
                transition="all 0.15s"
                opacity={isBeingDragged ? 0.5 : 1}
                borderWidth={isDraggedOver && node.isFolder ? '2px' : '0'}
                borderStyle="dashed"
                borderColor={isDraggedOver && node.isFolder ? dragOverBorderColor : 'transparent'}
                data-droppable-folder={node.isFolder ? node.path : undefined}
                userSelect="none"
            >
                {node.isFolder && (
                    <Icon
                        as={LuChevronRight}
                        color={colorMode === 'light' ? 'gray.600' : 'gray.400'}
                        boxSize={3.5}
                        flexShrink={0}
                        transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
                        transition="transform 0.2s"
                    />
                )}
                {!node.isFolder && (
                    <Icon
                        as={RxFileText}
                        color="blue.500"
                        boxSize={3.5}
                        opacity={isHovered ? 1 : 0.6}
                        flexShrink={0}
                        transition="opacity 0.15s"
                    />
                )}
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
                            bg: colorMode === 'light' ? 'white' : 'transparent'
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
                    <Text fontSize={node.isFolder ? "sm" : "xs"} fontWeight={node.isFolder ? "semibold" : "normal"} truncate flex={1}>
                        {node.isFolder ? node.name : getDisplayName(node.name)}
                    </Text>
                )}
                {isBookmarked && (
                    <Icon as={FaBookmark} color="orange.400" boxSize={3} />
                )}
            </HStack>

            <AnimatePresence initial={false}>
                {node.isFolder && isExpanded && node.children && (
                    <MotionBox
                        key={`folder-content-${node.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                            height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                            opacity: { duration: 0.15, delay: 0.05 }
                        }}
                        style={{ overflow: 'hidden' }}
                        mt={0.5}
                    >
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
                            onDragStart={onDragStart}
                            draggedNodePath={draggedNodePath}
                            dropTargetPath={dropTargetPath}
                            isValidDrop={isValidDrop}
                            bookmarkedPaths={bookmarkedPaths}
                        />
                    </MotionBox>
                )}
            </AnimatePresence>
        </Box>
    );
}
