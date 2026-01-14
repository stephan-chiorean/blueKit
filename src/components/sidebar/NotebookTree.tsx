import { Box, HStack, Icon, Text } from '@chakra-ui/react';

import { useEffect, useState, useMemo } from 'react';
import { LuFile, LuFolder, LuFolderOpen, LuStar } from 'react-icons/lu';
import { AiOutlineFileText } from 'react-icons/ai';
import { invokeGetBlueKitFileTree, FileTreeNode } from '../../ipc/fileTree';
import { useColorMode } from '../../contexts/ColorModeContext';

interface NotebookTreeProps {
    projectPath: string;
    onFileSelect: (node: FileTreeNode) => void;
    selectedFileId?: string;
    className?: string;
    version?: number;
}

// Helper function to find a node by ID in the tree
function findNodeById(nodes: FileTreeNode[], id: string): FileTreeNode | null {
    for (const node of nodes) {
        if (node.id === id) {
            return node;
        }
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
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
    version
}: NotebookTreeProps) {
    const [nodes, setNodes] = useState<FileTreeNode[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const { colorMode } = useColorMode();

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

    return (
        <Box className={className} w="100%">
            <CustomTree
                nodes={nodes}
                onNodeClick={onFileSelect}
                selectedId={selectedFileId}
                parentFolderPaths={parentFolderPaths}
                expandedFolders={expandedFolders}
                onToggleExpand={handleToggleExpand}
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
    parentFolderPaths: Set<string>;
    expandedFolders: Set<string>;
    onToggleExpand: (folderId: string) => void;
    level?: number;
    colorMode: string;
}

function CustomTree({ 
    nodes, 
    onNodeClick, 
    selectedId, 
    parentFolderPaths,
    expandedFolders,
    onToggleExpand,
    level = 0, 
    colorMode 
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
    colorMode 
}: {
    node: FileTreeNode,
    onNodeClick: (node: FileTreeNode) => void,
    selectedId?: string,
    parentFolderPaths: Set<string>,
    expandedFolders: Set<string>,
    isExpanded: boolean,
    onToggleExpand: (folderId: string) => void,
    level: number,
    colorMode: string
}) {
    const handleClick = () => {
        if (node.isFolder) {
            onToggleExpand(node.id);
        } else {
            onNodeClick(node);
        }
    };

    const isSelected = selectedId === node.path;
    
    // Check if file is a markdown file
    const isMarkdownFile = !node.isFolder && (node.name.endsWith('.md') || node.name.endsWith('.markdown'));
    
    const hoverBg = colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.100';
    const selectedBg = colorMode === 'light' ? 'blue.50' : 'whiteAlpha.200';
    const selectedColor = colorMode === 'light' ? 'blue.600' : 'blue.200';

    // Determine the icon to use
    const getFileIcon = () => {
        if (node.isFolder) {
            return isExpanded ? LuFolderOpen : LuFolder;
        }
        return isMarkdownFile ? AiOutlineFileText : LuFile;
    };

    return (
        <Box mb={0.5}>
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
                    as={getFileIcon()}
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
                    parentFolderPaths={parentFolderPaths}
                    expandedFolders={expandedFolders}
                    onToggleExpand={onToggleExpand}
                    level={level + 1}
                    colorMode={colorMode}
                />
            )}
        </Box>
    );
}
