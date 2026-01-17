import { HStack, IconButton } from '@chakra-ui/react';
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
        <HStack gap={1}>
            <IconButton
                aria-label="New File"
                size="xs"
                variant="ghost"
                color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                _hover={{ color: colorMode === 'light' ? 'black' : 'white', bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50' }}
                onClick={handleNewFile}
            >
                <LuFilePlus />
            </IconButton>
            <IconButton
                aria-label="New Folder"
                size="xs"
                variant="ghost"
                color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                _hover={{ color: colorMode === 'light' ? 'black' : 'white', bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50' }}
                onClick={handleNewFolder}
            >
                <LuFolderPlus />
            </IconButton>
        </HStack>
    );
}
