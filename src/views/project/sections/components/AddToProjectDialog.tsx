import { useState, useMemo } from 'react';
import {
    Dialog,
    Portal,
    CloseButton,
    Text,
    Button,
    Input,
    VStack,
    HStack,
    Icon,
    Box,
    Checkbox,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { LuFolderPlus, LuSearch } from 'react-icons/lu';
import { Project } from '@/ipc';

const MotionBox = motion.create(Box);

interface AddToProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    onConfirm: (selectedProjects: Project[]) => void;
    loading?: boolean;
}

export default function AddToProjectDialog({
    isOpen,
    onClose,
    projects,
    onConfirm,
    loading = false,
}: AddToProjectDialogProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Filter projects
    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const query = searchQuery.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(query));
    }, [projects, searchQuery]);

    const toggleProject = (projectId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) {
                next.delete(projectId);
            } else {
                next.add(projectId);
            }
            return next;
        });
    };

    const handleConfirm = () => {
        const selected = projects.filter(p => selectedIds.has(p.id));
        onConfirm(selected);
        handleClose();
    };

    const handleClose = () => {
        if (!loading) {
            setSearchQuery('');
            setSelectedIds(new Set());
            onClose();
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
            <Portal>
                <Dialog.Backdrop
                    asChild
                    style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    <MotionBox
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    />
                </Dialog.Backdrop>
                <Dialog.Positioner>
                    <Dialog.Content
                        asChild
                        maxW="md"
                        css={{
                            background: 'rgba(255, 255, 255, 0.85)',
                            backdropFilter: 'blur(40px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                            borderWidth: '1px',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: '24px',
                            boxShadow: '0 32px 100px -20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                            _dark: {
                                background: 'rgba(20, 20, 25, 0.9)',
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 32px 100px -20px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                            },
                        }}
                    >
                        <MotionBox
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <Dialog.Header pb={2}>
                                <HStack gap={3} align="center">
                                    <MotionBox
                                        initial={{ rotate: -15, scale: 0.8 }}
                                        animate={{ rotate: 0, scale: 1 }}
                                        transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
                                    >
                                        <Box
                                            p={3}
                                            borderRadius="16px"
                                            bg="blue.100"
                                            _dark={{ bg: 'blue.900/30' }}
                                        >
                                            <Icon boxSize={6} color="blue.500">
                                                <LuFolderPlus />
                                            </Icon>
                                        </Box>
                                    </MotionBox>
                                    <VStack align="start" gap={0}>
                                        <Dialog.Title fontSize="xl" fontWeight="bold">
                                            Add to Projects
                                        </Dialog.Title>
                                        <Text fontSize="sm" color="text.secondary">
                                            Select projects to add these kits to
                                        </Text>
                                    </VStack>
                                </HStack>
                                <Dialog.CloseTrigger asChild>
                                    <CloseButton aria-label="Close" size="sm" />
                                </Dialog.CloseTrigger>
                            </Dialog.Header>

                            <Dialog.Body pt={4}>
                                <VStack align="stretch" gap={4}>
                                    {/* Search */}
                                    <HStack gap={2}>
                                        <Icon color="text.muted">
                                            <LuSearch />
                                        </Icon>
                                        <Input
                                            placeholder="Search projects..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            variant="subtle"
                                            borderRadius="xl"
                                        />
                                    </HStack>

                                    {/* Project List */}
                                    <Box
                                        maxH="300px"
                                        overflowY="auto"
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        borderRadius="xl"
                                        bg="bg.subtle"
                                        p={2}
                                    >
                                        {filteredProjects.length === 0 ? (
                                            <Box p={4} textAlign="center">
                                                <Text fontSize="sm" color="text.muted">
                                                    {projects.length === 0
                                                        ? 'No projects available'
                                                        : 'No projects match your search'}
                                                </Text>
                                            </Box>
                                        ) : (
                                            <VStack align="stretch" gap={1}>
                                                {filteredProjects.map(project => (
                                                    <Checkbox.Root
                                                        key={project.id}
                                                        checked={selectedIds.has(project.id)}
                                                        onCheckedChange={() => toggleProject(project.id)}
                                                        size="md"
                                                        css={{
                                                            width: "100%",
                                                            p: 2,
                                                            borderRadius: "md",
                                                            transition: "background 0.2s",
                                                            _hover: { bg: "bg.muted" },
                                                        }}
                                                    >
                                                        <Checkbox.HiddenInput />
                                                        <Checkbox.Control>
                                                            <Checkbox.Indicator />
                                                        </Checkbox.Control>
                                                        <Checkbox.Label flex="1">
                                                            <HStack justify="space-between" w="100%">
                                                                <Text fontWeight="medium">{project.name}</Text>
                                                            </HStack>
                                                        </Checkbox.Label>
                                                    </Checkbox.Root>
                                                ))}
                                            </VStack>
                                        )}
                                    </Box>
                                </VStack>
                            </Dialog.Body>

                            <Dialog.Footer pt={6}>
                                <HStack gap={3} justify="flex-end" w="100%">
                                    <Button
                                        variant="ghost"
                                        onClick={handleClose}
                                        disabled={loading}
                                        size="lg"
                                        borderRadius="xl"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        colorPalette="blue"
                                        onClick={handleConfirm}
                                        loading={loading}
                                        disabled={selectedIds.size === 0}
                                        size="lg"
                                        borderRadius="xl"
                                        px={6}
                                    >
                                        Add to {selectedIds.size} Project{selectedIds.size !== 1 ? 's' : ''}
                                    </Button>
                                </HStack>
                            </Dialog.Footer>
                        </MotionBox>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
