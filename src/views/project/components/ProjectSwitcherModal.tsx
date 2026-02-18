import { useState, useMemo } from 'react';
import { Box, VStack, Text, Input, Icon, HStack, IconButton } from '@chakra-ui/react';
import { LuFolder, LuSearch, LuCode, LuMousePointer2, LuSparkles } from 'react-icons/lu';
import { Project, invokeOpenProjectInEditor } from '@/ipc';
import GenericGlassModal from '@/shared/components/modals/GenericGlassModal';
import { motion } from 'framer-motion';

const MotionBox = motion.create(Box);

interface ProjectSwitcherModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    currentProject: Project;
    onProjectSelect: (project: Project) => void;
}

export default function ProjectSwitcherModal({
    isOpen,
    onClose,
    projects,
    currentProject,
    onProjectSelect,
}: ProjectSwitcherModalProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredProjects = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return projects.filter(
            (p) =>
                p.name.toLowerCase().includes(query) ||
                p.path.toLowerCase().includes(query)
        );
    }, [projects, searchQuery]);

    const otherProjects = filteredProjects.filter(p => p.id !== currentProject.id);
    const isCurrentProjectFilteredMatch = filteredProjects.some(p => p.id === currentProject.id);

    const handleSelect = (project: Project) => {
        onProjectSelect(project);
        onClose();
    };

    const ProjectActionButtons = ({ project, showAlways = false }: { project: Project, showAlways?: boolean }) => (
        <HStack
            className="action-buttons"
            gap={1}
            opacity={showAlways ? 1 : 0}
            transition="opacity 0.2s"
            pointerEvents={showAlways ? "auto" : "none"}
            onClick={(e) => e.stopPropagation()}
        >
            <IconButton
                variant="ghost"
                size="xs"
                aria-label="Open in Cursor"
                onClick={(e) => {
                    e.stopPropagation();
                    invokeOpenProjectInEditor(project.path, 'cursor');
                    onClose();
                }}
                color="text.secondary"
                _hover={{ color: 'blue.500', bg: 'blue.500/10' }}
            >
                <LuMousePointer2 />
            </IconButton>

            <IconButton
                variant="ghost"
                size="xs"
                aria-label="Open in VS Code"
                onClick={(e) => {
                    e.stopPropagation();
                    invokeOpenProjectInEditor(project.path, 'vscode');
                    onClose();
                }}
                color="text.secondary"
                _hover={{ color: 'blue.500', bg: 'blue.500/10' }}
            >
                <LuCode />
            </IconButton>

            <IconButton
                variant="ghost"
                size="xs"
                aria-label="Open in Antigravity"
                onClick={(e) => {
                    e.stopPropagation();
                    invokeOpenProjectInEditor(project.path, 'antigravity');
                    onClose();
                }}
                color="text.secondary"
                _hover={{ color: 'purple.500', bg: 'purple.500/10' }}
            >
                <LuSparkles />
            </IconButton>
        </HStack>
    );

    return (
        <GenericGlassModal
            isOpen={isOpen}
            onClose={onClose}
            title="Switch Project"
            subtitle="Manage and switch between projects"
            icon={<LuFolder />}
            accentColor="blue"
            size="lg"
            bodyPadding={0} // Full control of spacing
        >
            <VStack gap={0} align="stretch">
                {/* Search Header */}
                <Box px={6} pb={4}>
                    <Box position="relative">
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search projects..."
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

                {/* Scrollable Content */}
                <VStack
                    align="stretch"
                    gap={2}
                    maxH="50vh"
                    minH="300px"
                    overflowY="auto"
                    px={6}
                    pb={6}
                    css={{
                        maskImage: 'linear-gradient(to bottom, black, black calc(100% - 16px), transparent)',
                        // Custom scrollbar
                        '&::-webkit-scrollbar': { width: '4px' },
                        '&::-webkit-scrollbar-thumb': {
                            background: 'rgba(0,0,0,0.1)',
                            borderRadius: 'full',
                        },
                        _dark: {
                            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)' },
                        }
                    }}
                >
                    {/* Current Project Section */}
                    {isCurrentProjectFilteredMatch && (
                        <VStack align="stretch" gap={2} mb={2}>
                            <Text fontSize="xs" fontWeight="semibold" color="text.muted" textTransform="uppercase" letterSpacing="wider">
                                Current Project
                            </Text>
                            <MotionBox
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                p={3}
                                borderRadius="12px"
                                position="relative"
                                _hover={{
                                    bg: 'rgba(0,0,0,0.03)',
                                    _dark: { bg: 'rgba(255,255,255,0.03)' },
                                    '& .action-buttons': { opacity: 1, pointerEvents: 'auto' }
                                }}
                            >
                                <HStack justify="space-between" align="center">
                                    <HStack gap={3} flex="1" minW="0">
                                        <Icon boxSize={4} color="text.secondary"><LuFolder /></Icon>
                                        <VStack align="start" gap={0} flex="1" minW="0">
                                            <Text fontWeight="medium" fontSize="sm" truncate>{currentProject.name}</Text>
                                            <Text fontSize="xs" color="text.muted" truncate w="100%">{currentProject.path}</Text>
                                        </VStack>
                                    </HStack>

                                    {/* Actions */}
                                    <ProjectActionButtons project={currentProject} />
                                </HStack>
                            </MotionBox>
                        </VStack>
                    )}

                    {/* Separator if both sections exist */}
                    {isCurrentProjectFilteredMatch && otherProjects.length > 0 && (
                        <Box py={2}>
                            <Box h="1px" bg="rgba(0,0,0,0.1)" _dark={{ bg: "rgba(255,255,255,0.1)" }} w="full" />
                        </Box>
                    )}

                    {/* Other Projects Section */}
                    {otherProjects.length > 0 && (
                        <VStack align="stretch" gap={1}>
                            <Text fontSize="xs" fontWeight="semibold" color="text.muted" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                All Projects
                            </Text>
                            {otherProjects.map((project, i) => (
                                <MotionBox
                                    key={project.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    onClick={() => handleSelect(project)}
                                    cursor="pointer"
                                    p={3}
                                    borderRadius="12px"
                                    position="relative"
                                    _hover={{
                                        bg: 'rgba(0,0,0,0.03)',
                                        _dark: { bg: 'rgba(255,255,255,0.03)' },
                                        '& .action-buttons': { opacity: 1, pointerEvents: 'auto' }
                                    }}
                                >
                                    <HStack justify="space-between">
                                        <HStack gap={3} flex="1" minW="0">
                                            <Icon boxSize={4} color="text.secondary"><LuFolder /></Icon>
                                            <VStack align="start" gap={0} flex="1" minW="0">
                                                <Text fontWeight="medium" fontSize="sm" truncate w="100%">{project.name}</Text>
                                                <Text fontSize="xs" color="text.muted" truncate w="100%">{project.path}</Text>
                                            </VStack>
                                        </HStack>

                                        <HStack gap={3}>
                                            <ProjectActionButtons project={project} />
                                        </HStack>
                                    </HStack>
                                </MotionBox>
                            ))}
                        </VStack>
                    )}

                    {filteredProjects.length === 0 && (
                        <Box py={12} textAlign="center" color="text.muted">
                            <Text>No projects found matching "{searchQuery}"</Text>
                        </Box>
                    )}
                </VStack>
            </VStack>
        </GenericGlassModal>
    );
}
