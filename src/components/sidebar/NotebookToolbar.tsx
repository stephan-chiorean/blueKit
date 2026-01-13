import {

    HStack,
    IconButton,
    Popover,
    Input,
    Button,
    VStack,
    Text
} from '@chakra-ui/react';
import { useState } from 'react';
import { LuFilePlus, LuFolderPlus } from 'react-icons/lu';
import { invokeWriteFile } from '../../ipc';
import { invokeCreateFolder } from '../../ipc/fileTree';
import { useColorMode } from '../../contexts/ColorModeContext';

interface NotebookToolbarProps {
    projectPath: string;
    targetPath?: string; // If set, creates inside this path (if folder) or parent (if file)
    onRefresh: () => void;
}

export default function NotebookToolbar({ projectPath, targetPath, onRefresh }: NotebookToolbarProps) {
    const { colorMode } = useColorMode();


    // Determine the base path for creation
    // If targetPath is not provided, use projectPath/.bluekit
    // If targetPath is a file, use its parent
    // If targetPath is a folder, use it

    // This logic might need strict checking if targetPath is file or folder. 
    // Assuming backend handles it or we pass isFolder properly? 
    // For now, let's assume we create at root of .bluekit if generic, 
    // or we need a way to know the context.

    // Let's rely on targetPath. If not set, use .bluekit.
    const basePath = targetPath || `${projectPath}/.bluekit`;

    return (
        <HStack gap={1}>
            <CreatePopover
                type="file"
                basePath={basePath}
                onRefresh={onRefresh}
                trigger={
                    <IconButton
                        aria-label="New File"
                        size="xs"
                        variant="ghost"
                        color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                        _hover={{ color: colorMode === 'light' ? 'black' : 'white', bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50' }}
                    >
                        <LuFilePlus />
                    </IconButton>
                }
            />
            <CreatePopover
                type="folder"
                basePath={basePath}
                onRefresh={onRefresh}
                trigger={
                    <IconButton
                        aria-label="New Folder"
                        size="xs"
                        variant="ghost"
                        color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                        _hover={{ color: colorMode === 'light' ? 'black' : 'white', bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50' }}
                    >
                        <LuFolderPlus />
                    </IconButton>
                }
            />
        </HStack>
    );
}

interface CreatePopoverProps {
    type: 'file' | 'folder';
    basePath: string;
    trigger: React.ReactNode;
    onRefresh: () => void;
}

function CreatePopover({ type, basePath, trigger, onRefresh }: CreatePopoverProps) {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            const fullPath = `${basePath}/${name.trim()}`;
            if (type === 'file') {
                // Ensure extension?
                let fileName = name.trim();
                if (!fileName.includes('.')) {
                    fileName += '.md'; // Default to markdown
                }
                const path = `${basePath}/${fileName}`;
                await invokeWriteFile(path, ''); // Empty file
            } else {
                await invokeCreateFolder(fullPath);
            }

            setName('');
            setOpen(false);
            onRefresh();
        } catch (error) {
            console.error(`Failed to create ${type}`, error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
            <Popover.Trigger asChild>
                {trigger}
            </Popover.Trigger>
            <Popover.Positioner>
                <Popover.Content width="240px">
                    <Popover.Arrow />
                    <Popover.Body p={3}>
                        <VStack gap={3} align="stretch">
                            <Text fontSize="sm" fontWeight="medium">New {type === 'file' ? 'File' : 'Folder'}</Text>
                            <Input
                                placeholder={type === 'file' ? "name.md" : "Folder Name"}
                                size="sm"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate();
                                }}
                                autoFocus
                            />
                            <HStack justify="flex-end">
                                <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button
                                    size="xs"
                                    colorPalette="primary"
                                    onClick={handleCreate}
                                    loading={isLoading}
                                    disabled={!name.trim()}
                                >
                                    Create
                                </Button>
                            </HStack>
                        </VStack>
                    </Popover.Body>
                </Popover.Content>
            </Popover.Positioner>
        </Popover.Root>
    );
}
