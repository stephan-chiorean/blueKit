import { useState, useEffect, useMemo } from 'react';
import { Box, VStack, Text, Input, Icon, HStack, Badge } from '@chakra-ui/react';
import { LuFileText, LuSearch, LuFolder } from 'react-icons/lu';
import { motion } from 'framer-motion';
import GenericGlassModal from '@/shared/components/modals/GenericGlassModal';
import { invokeGetBlueKitFileTree, FileTreeNode } from '@/ipc/fileTree';

const MotionBox = motion.create(Box);

interface NoteSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectPath: string;
    onNoteSelect: (node: FileTreeNode) => void;
}

function flattenTree(nodes: FileTreeNode[], parentPath = ''): (FileTreeNode & { displayPath: string })[] {
    const result: (FileTreeNode & { displayPath: string })[] = [];
    for (const node of nodes) {
        if (node.isFolder) {
            if (node.children?.length) {
                result.push(...flattenTree(node.children, parentPath ? `${parentPath}/${node.name}` : node.name));
            }
        } else {
            result.push({ ...node, displayPath: parentPath });
        }
    }
    return result;
}

function getArtifactBadge(node: FileTreeNode & { displayPath: string }) {
    const type = node.artifactType || node.frontMatter?.type;
    if (!type) return null;

    const colorMap: Record<string, string> = {
        walkthrough: 'orange',
        agent: 'purple',
        diagram: 'teal',
        kit: 'blue',
        plan: 'green',
        task: 'yellow',
    };

    return { label: type, color: colorMap[type] || 'gray' };
}

export default function NoteSearchModal({
    isOpen,
    onClose,
    projectPath,
    onNoteSelect,
}: NoteSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [allFiles, setAllFiles] = useState<(FileTreeNode & { displayPath: string })[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setSearchQuery('');
        invokeGetBlueKitFileTree(projectPath)
            .then((tree) => setAllFiles(flattenTree(tree)))
            .catch(() => setAllFiles([]))
            .finally(() => setLoading(false));
    }, [isOpen, projectPath]);

    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return allFiles;
        const q = searchQuery.toLowerCase();
        return allFiles.filter(
            (f) =>
                f.name.toLowerCase().includes(q) ||
                (f.frontMatter?.alias || '').toLowerCase().includes(q) ||
                f.displayPath.toLowerCase().includes(q)
        );
    }, [allFiles, searchQuery]);

    const handleSelect = (node: FileTreeNode) => {
        onNoteSelect(node);
        onClose();
    };

    return (
        <GenericGlassModal
            isOpen={isOpen}
            onClose={onClose}
            title="Go to Note"
            subtitle="Search notes and files in this project"
            icon={<LuSearch />}
            accentColor="blue"
            size="lg"
            bodyPadding={0}
        >
            <VStack gap={0} align="stretch">
                {/* Search input */}
                <Box px={6} pb={4}>
                    <Box position="relative">
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notes..."
                            pl={10}
                            size="lg"
                            autoFocus
                            variant="subtle"
                            fontSize="sm"
                            css={{
                                borderRadius: '12px',
                                bg: 'rgba(0,0,0,0.03)',
                                _dark: { bg: 'rgba(255,255,255,0.05)' },
                                border: 'none',
                                _focus: {
                                    bg: 'transparent',
                                    boxShadow: 'none',
                                    outline: 'none',
                                },
                            }}
                        />
                        <Icon
                            position="absolute"
                            left={3}
                            top="50%"
                            transform="translateY(-50%)"
                            color="text.secondary"
                            boxSize={4}
                        >
                            <LuSearch />
                        </Icon>
                    </Box>
                </Box>

                {/* Results list */}
                <VStack
                    align="stretch"
                    gap={1}
                    maxH="50vh"
                    minH="280px"
                    overflowY="auto"
                    px={6}
                    pb={6}
                    css={{
                        maskImage: 'linear-gradient(to bottom, black, black calc(100% - 16px), transparent)',
                        '&::-webkit-scrollbar': { width: '4px' },
                        '&::-webkit-scrollbar-thumb': {
                            background: 'rgba(0,0,0,0.1)',
                            borderRadius: 'full',
                        },
                        _dark: {
                            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)' },
                        },
                    }}
                >
                    {loading && (
                        <Box py={12} textAlign="center" color="text.muted">
                            <Text fontSize="sm">Loading notes...</Text>
                        </Box>
                    )}

                    {!loading && filteredFiles.length === 0 && (
                        <Box py={12} textAlign="center" color="text.muted">
                            <Text fontSize="sm">
                                {searchQuery
                                    ? `No notes found matching "${searchQuery}"`
                                    : 'No notes found in this project'}
                            </Text>
                        </Box>
                    )}

                    {!loading && filteredFiles.map((file, i) => {
                        const displayName = file.frontMatter?.alias || file.name;
                        const badge = getArtifactBadge(file);
                        return (
                            <MotionBox
                                key={file.id || file.path}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: Math.min(i * 0.02, 0.15) }}
                                onClick={() => handleSelect(file)}
                                cursor="pointer"
                                p={3}
                                borderRadius="12px"
                                _hover={{
                                    bg: 'rgba(0,0,0,0.04)',
                                    _dark: { bg: 'rgba(255,255,255,0.05)' },
                                }}
                            >
                                <HStack gap={3} align="center">
                                    <Icon boxSize={4} color="text.secondary" flexShrink={0}>
                                        <LuFileText />
                                    </Icon>
                                    <VStack align="start" gap={0} flex="1" minW="0">
                                        <HStack gap={2} w="100%">
                                            <Text fontWeight="medium" fontSize="sm" truncate flex="1" minW="0">
                                                {displayName}
                                            </Text>
                                            {badge && (
                                                <Badge
                                                    size="xs"
                                                    colorPalette={badge.color}
                                                    variant="subtle"
                                                    flexShrink={0}
                                                    textTransform="capitalize"
                                                    fontSize="10px"
                                                >
                                                    {badge.label}
                                                </Badge>
                                            )}
                                        </HStack>
                                        {file.displayPath && (
                                            <HStack gap={1} color="text.muted">
                                                <Icon boxSize={3}>
                                                    <LuFolder />
                                                </Icon>
                                                <Text fontSize="xs" truncate>
                                                    {file.displayPath}
                                                </Text>
                                            </HStack>
                                        )}
                                    </VStack>
                                </HStack>
                            </MotionBox>
                        );
                    })}
                </VStack>
            </VStack>
        </GenericGlassModal>
    );
}
