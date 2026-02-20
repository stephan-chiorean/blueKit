import { Menu, Portal, HStack, Icon, Text } from '@chakra-ui/react';
import { useMemo } from 'react';
import { LuCopy, LuPencil, LuTrash2, LuFiles, LuBookmark, LuExternalLink } from 'react-icons/lu';
import { FileTreeNode } from '@/ipc/fileTree';
import { invokeOpenResourceInWindow } from '@/ipc/files';
import { toaster } from '@/shared/components/ui/toaster';

// Estimated height of the file context menu (8 items + 4 separators)
const ESTIMATED_MENU_HEIGHT = 360;
// Margin from viewport edge
const VIEWPORT_MARGIN = 16;

const toWindowId = (path: string) => {
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;

    for (let i = 0; i < path.length; i += 1) {
        hash ^= BigInt(path.charCodeAt(i));
        hash = BigInt.asUintN(64, hash * prime);
    }

    return `file-${hash.toString(16).padStart(16, '0')}`;
};

interface FileContextMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    node: FileTreeNode | null;
    projectPath: string;
    onClose: () => void;
    onDuplicate: (node: FileTreeNode) => void;
    onCopyPath: (path: string) => void;
    onCopyRelativePath: (relativePath: string) => void;
    onRename: (node: FileTreeNode) => void;
    onDelete: (node: FileTreeNode) => void;
    onAddToBookmarks: (node: FileTreeNode) => void;
    onNewNote: (folderPath: string) => void;
}

/**
 * Context menu for files in the notebook tree.
 * Provides options for: duplicate, copy path, rename, delete.
 * Includes smart positioning to stay within viewport bounds.
 */
export function FileContextMenu({
    isOpen,
    x,
    y,
    node,
    onClose,
    onDuplicate,
    onCopyPath,
    onCopyRelativePath,
    onRename,
    onDelete,
    onAddToBookmarks,
    onNewNote,
}: FileContextMenuProps) {
    // Calculate adjusted position to keep menu within viewport
    const adjustedPosition = useMemo(() => {
        const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

        let adjustedY = y;
        let adjustedX = x;

        // Check if menu would overflow below viewport
        if (y + ESTIMATED_MENU_HEIGHT > windowHeight - VIEWPORT_MARGIN) {
            // Position menu so its bottom edge is above the viewport bottom
            adjustedY = windowHeight - ESTIMATED_MENU_HEIGHT - VIEWPORT_MARGIN;
            // Ensure we don't go above the top of the viewport
            adjustedY = Math.max(VIEWPORT_MARGIN, adjustedY);
        }

        // Check if menu would overflow right of viewport
        const estimatedMenuWidth = 200;
        if (x + estimatedMenuWidth > windowWidth - VIEWPORT_MARGIN) {
            adjustedX = windowWidth - estimatedMenuWidth - VIEWPORT_MARGIN;
        }

        return { x: adjustedX, y: adjustedY };
    }, [x, y]);

    if (!isOpen || !node || node.isFolder) return null;

    const handleNewNote = () => {
        // Create in same folder as file
        const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
        onNewNote(parentPath);
        onClose();
    };

    const handleDuplicate = () => {
        onDuplicate(node);
        onClose();
    };

    const handleCopyPath = () => {
        onCopyPath(node.path);
        onClose();
    };

    const handleCopyRelativePath = () => {
        onCopyRelativePath(node.path);
        onClose();
    };

    const handleRename = () => {
        onRename(node);
        onClose();
    };

    const handleDelete = () => {
        onDelete(node);
        onClose();
    };

    const handleAddToBookmarks = () => {
        onAddToBookmarks(node);
        onClose();
    };

    const handleOpenInNewWindow = async () => {
        try {
            const displayName = node.name;

            const windowId = toWindowId(node.path);

            // Open in Tauri window
            await invokeOpenResourceInWindow({
                windowId,
                resourceId: node.path,
                resourceType: 'file',
                title: displayName,
                width: 1200,
                height: 900,
            });

            toaster.create({
                type: 'success',
                title: 'Window opened',
                description: `${displayName} opened in new window`,
            });

            onClose();
        } catch (err) {
            console.error('Failed to open file in new window:', err);
            toaster.create({
                type: 'error',
                title: 'Failed to open window',
                description: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    };

    return (
        <Portal>
            <Menu.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
                <Menu.Positioner>
                    <Menu.Content
                        minW="200px"
                        borderWidth="1px"
                        borderRadius="lg"
                        css={{
                            background: 'rgba(255, 255, 255, 0.65)',
                            backdropFilter: 'blur(20px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                            borderColor: 'rgba(0, 0, 0, 0.08)',
                            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.1)',
                            _dark: {
                                background: 'rgba(20, 20, 25, 0.8)',
                                borderColor: 'rgba(255, 255, 255, 0.15)',
                                boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                            },
                        }}
                        style={{
                            position: 'fixed',
                            left: `${adjustedPosition.x}px`,
                            top: `${adjustedPosition.y}px`,
                        }}
                    >
                        <Menu.Item value="open-window" onSelect={handleOpenInNewWindow}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuExternalLink />
                                </Icon>
                                <Text fontSize="sm">Open in new window</Text>
                            </HStack>
                        </Menu.Item>

                        <Menu.Separator />

                        <Menu.Item value="new-note" onSelect={handleNewNote}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuFiles />
                                </Icon>
                                <Text fontSize="sm">New note</Text>
                            </HStack>
                        </Menu.Item>

                        <Menu.Item value="duplicate" onSelect={handleDuplicate}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuFiles />
                                </Icon>
                                <Text fontSize="sm">Duplicate</Text>
                            </HStack>
                        </Menu.Item>

                        <Menu.Separator />

                        <Menu.Item value="copy-path" onSelect={handleCopyPath}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuCopy />
                                </Icon>
                                <Text fontSize="sm">Copy path</Text>
                            </HStack>
                        </Menu.Item>

                        <Menu.Item value="copy-relative-path" onSelect={handleCopyRelativePath}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuCopy />
                                </Icon>
                                <Text fontSize="sm">Copy relative path</Text>
                            </HStack>
                        </Menu.Item>

                        <Menu.Separator />

                        <Menu.Item value="add-to-bookmarks" onSelect={handleAddToBookmarks}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuBookmark />
                                </Icon>
                                <Text fontSize="sm">Add to Bookmarks</Text>
                            </HStack>
                        </Menu.Item>

                        <Menu.Separator />

                        <Menu.Item value="rename" onSelect={handleRename}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuPencil />
                                </Icon>
                                <Text fontSize="sm">Rename</Text>
                            </HStack>
                        </Menu.Item>

                        <Menu.Item value="delete" onSelect={handleDelete}>
                            <HStack gap={2} width="100%">
                                <Icon>
                                    <LuTrash2 />
                                </Icon>
                                <Text fontSize="sm">Delete</Text>
                            </HStack>
                        </Menu.Item>
                    </Menu.Content>
                </Menu.Positioner>
            </Menu.Root>
        </Portal>
    );
}
