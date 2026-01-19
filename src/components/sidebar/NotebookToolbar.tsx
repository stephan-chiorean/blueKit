import { HStack, IconButton, Portal, Tooltip } from '@chakra-ui/react';
import { LuFilePlus, LuFolderPlus } from 'react-icons/lu';
import { useColorMode } from '../../contexts/ColorModeContext';

interface NotebookToolbarProps {
    projectPath: string;
    onNewFile?: (folderPath: string) => void;
    onNewFolder?: (folderPath: string) => void;
}

export default function NotebookToolbar({ projectPath, onNewFile, onNewFolder }: NotebookToolbarProps) {
    const { colorMode } = useColorMode();

    // Root path for .bluekit directory
    const rootPath = `${projectPath}/.bluekit`;

    const handleNewFile = () => {
        if (onNewFile) {
            onNewFile(rootPath);
        }
    };

    const handleNewFolder = () => {
        if (onNewFolder) {
            onNewFolder(rootPath);
        }
    };

    return (
        <HStack gap={2}>
            <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                <Tooltip.Trigger asChild>
                    <IconButton
                        aria-label="New File"
                        size="xs"
                        variant="ghost"
                        color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                        _hover={{ color: colorMode === 'light' ? 'black' : 'white', bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50' }}
                        onClick={handleNewFile}
                        minW={5}
                        h={5}
                        px={0}
                    >
                        <LuFilePlus />
                    </IconButton>
                </Tooltip.Trigger>
                <Portal>
                    <Tooltip.Positioner zIndex={1500}>
                        <Tooltip.Content
                            px={3}
                            py={1.5}
                            borderRadius="md"
                            fontSize="xs"
                            fontWeight="medium"
                            color={colorMode === 'light' ? 'gray.700' : 'gray.100'}
                            css={{
                                background: colorMode === 'light' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(20, 20, 25, 0.7)',
                                backdropFilter: 'blur(12px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                border: colorMode === 'light'
                                    ? '1px solid rgba(0, 0, 0, 0.08)'
                                    : '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow: colorMode === 'light'
                                    ? '0 6px 18px rgba(0, 0, 0, 0.12)'
                                    : '0 8px 20px rgba(0, 0, 0, 0.4)',
                            }}
                        >
                            New note
                        </Tooltip.Content>
                    </Tooltip.Positioner>
                </Portal>
            </Tooltip.Root>
            <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                <Tooltip.Trigger asChild>
                    <IconButton
                        aria-label="New Folder"
                        size="xs"
                        variant="ghost"
                        color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                        _hover={{ color: colorMode === 'light' ? 'black' : 'white', bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50' }}
                        onClick={handleNewFolder}
                        minW={5}
                        h={5}
                        px={0}
                    >
                        <LuFolderPlus />
                    </IconButton>
                </Tooltip.Trigger>
                <Portal>
                    <Tooltip.Positioner zIndex={1500}>
                        <Tooltip.Content
                            px={3}
                            py={1.5}
                            borderRadius="md"
                            fontSize="xs"
                            fontWeight="medium"
                            color={colorMode === 'light' ? 'gray.700' : 'gray.100'}
                            css={{
                                background: colorMode === 'light' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(20, 20, 25, 0.7)',
                                backdropFilter: 'blur(12px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                border: colorMode === 'light'
                                    ? '1px solid rgba(0, 0, 0, 0.08)'
                                    : '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow: colorMode === 'light'
                                    ? '0 6px 18px rgba(0, 0, 0, 0.12)'
                                    : '0 8px 20px rgba(0, 0, 0, 0.4)',
                            }}
                        >
                            New folder
                        </Tooltip.Content>
                    </Tooltip.Positioner>
                </Portal>
            </Tooltip.Root>
        </HStack>
    );
}
