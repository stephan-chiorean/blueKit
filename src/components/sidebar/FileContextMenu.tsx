import { Menu, Portal, HStack, Icon, Text } from '@chakra-ui/react';
import { LuCopy, LuPencil, LuTrash2, LuFiles } from 'react-icons/lu';
import { FileTreeNode } from '../../ipc/fileTree';

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
}

/**
 * Context menu for files in the notebook tree.
 * Provides options for: duplicate, copy path, rename, delete.
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
}: FileContextMenuProps) {
    if (!isOpen || !node || node.isFolder) return null;

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
                            left: `${x}px`,
                            top: `${y}px`,
                        }}
                    >
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
