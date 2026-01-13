import { Box, HStack, Icon, Text } from '@chakra-ui/react';

import { useEffect, useState } from 'react';
import { LuFile, LuFolder, LuFolderOpen, LuStar } from 'react-icons/lu';
import { invokeGetBlueKitFileTree, FileTreeNode } from '../../ipc/fileTree';
import { useColorMode } from '../../contexts/ColorModeContext';

interface NotebookTreeProps {
    projectPath: string;
    onFileSelect: (node: FileTreeNode) => void;
    selectedFileId?: string;
    className?: string;
    version?: number;
}

export default function NotebookTree({
    projectPath,
    onFileSelect,
    selectedFileId,
    className,
    version
}: NotebookTreeProps) {
    const [nodes, setNodes] = useState<FileTreeNode[]>([]);
    const { colorMode } = useColorMode();

    // Custom tree view implementation if Chakra TreeView is not available
    // But trusting design doc for now. If this fails, we will need a recursive component.

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



    // Note: Since I can't be 100% sure about TreeView API in this environment without checking types,
    // I'll create a simple recursive fallback component structure to be safe, 
    // or I can try to use a generic custom implementation to avoid dependency issues.

    // Let's implement a simple custom recursive tree for safety given I didn't find TreeView in grep.
    // This is safer than relying on an import that might not exist.

    return (
        <Box className={className} w="100%">
            <CustomTree
                nodes={nodes}
                onNodeClick={onFileSelect}
                selectedId={selectedFileId}
                colorMode={colorMode}
            />
        </Box>
    );
}

// Simple recursive tree component
interface CustomTreeProps {
    nodes: FileTreeNode[];
    onNodeClick: (node: FileTreeNode) => void;
    selectedId?: string;
    level?: number;
    colorMode: string;
}

function CustomTree({ nodes, onNodeClick, selectedId, level = 0, colorMode }: CustomTreeProps) {
    return (
        <Box pl={level > 0 ? 4 : 0}>
            {nodes.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    onNodeClick={onNodeClick}
                    selectedId={selectedId}
                    level={level}
                    colorMode={colorMode}
                />
            ))}
        </Box>
    );
}

function TreeNode({ node, onNodeClick, selectedId, level, colorMode }: {
    node: FileTreeNode,
    onNodeClick: (node: FileTreeNode) => void,
    selectedId?: string,
    level: number,
    colorMode: string
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand if child selected? (Can be added later)

    const handleClick = () => {
        if (node.isFolder) {
            setIsExpanded(!isExpanded);
        } else {
            onNodeClick(node);
        }
    };

    const isSelected = selectedId === node.id;
    const hoverBg = colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.100';
    const selectedBg = colorMode === 'light' ? 'blue.50' : 'whiteAlpha.200';
    const selectedColor = colorMode === 'light' ? 'blue.600' : 'blue.200';

    return (
        <Box>
            <HStack
                py={1}
                px={2}
                cursor="pointer"
                onClick={handleClick}
                bg={isSelected ? selectedBg : 'transparent'}
                color={isSelected ? selectedColor : 'inherit'}
                _hover={{ bg: isSelected ? selectedBg : hoverBg }}
                borderRadius="sm"
                gap={2}
                transition="all 0.1s"
            >
                <Icon
                    as={node.isFolder ? (isExpanded ? LuFolderOpen : LuFolder) : LuFile}
                    color={node.isFolder ? "blue.400" : (isSelected ? "currentColor" : "gray.500")}
                    boxSize={4}
                    flexShrink={0}
                />
                <Text fontSize="sm" truncate flex={1}>
                    {node.name}
                </Text>
                {node.isEssential && (
                    <Icon as={LuStar} color="yellow.400" boxSize={3} />
                )}
            </HStack>

            {node.isFolder && isExpanded && node.children && (
                <CustomTree
                    nodes={node.children}
                    onNodeClick={onNodeClick}
                    selectedId={selectedId}
                    level={level + 1}
                    colorMode={colorMode}
                />
            )}
        </Box>
    );
}
