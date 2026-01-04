import { useState, useRef, useEffect } from 'react';
import {
    Box,
    Button,
    HStack,
    Icon,
    Input,
    InputGroup,
    Menu,
    Text,
    VStack,
    Spinner,
} from '@chakra-ui/react';
import {
    LuDownload,
    LuSearch,
    LuFolder,
    LuCheck,
} from 'react-icons/lu';
import { Project } from '../../ipc';

interface PullButtonProps {
    projects: Project[];
    onConfirmPull: (projects: Project[]) => void;
    loading: boolean;
    label?: string; // Default 'Pull'
}

export function PullButton({
    projects,
    onConfirmPull,
    loading,
    label = 'Pull',
}: PullButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset state when menu closes
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSelectedProjectIds(new Set());
        }
    }, [isOpen]);

    // Focus search input when menu opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const toggleProject = (projectId: string) => {
        setSelectedProjectIds(prev => {
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
        const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
        onConfirmPull(selectedProjects);
        setIsOpen(false);
    };

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.path.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const truncatePath = (path: string, maxLength: number = 40): string => {
        if (path.length <= maxLength) return path;
        return `...${path.slice(-(maxLength - 3))}`;
    };

    return (
        <Menu.Root
            closeOnSelect={false}
            open={isOpen}
            onOpenChange={(e) => setIsOpen(e.open)}
        >
            <Menu.Trigger asChild>
                <Button
                    variant="solid"
                    colorPalette="primary"
                    size="sm"
                    disabled={loading}
                >
                    <HStack gap={2}>
                        <LuDownload />
                        <Text>{label}</Text>
                    </HStack>
                </Button>
            </Menu.Trigger>
            <Menu.Positioner zIndex={3000}>
                <Menu.Content width="400px" maxH="500px">
                    {/* Header */}
                    <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                        <Text fontSize="sm" fontWeight="semibold">
                            Pull to Project
                        </Text>
                    </Box>

                    {/* Search Input */}
                    <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                        <InputGroup startElement={<LuSearch />}>
                            <Input
                                ref={searchInputRef}
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                        </InputGroup>
                    </Box>

                    {/* Project List */}
                    <Box maxH="300px" overflowY="auto">
                        {filteredProjects.length === 0 ? (
                            <Box textAlign="center" py={4} px={3}>
                                <Text fontSize="sm" color="text.secondary">
                                    {searchQuery ? 'No projects match your search.' : 'No projects found.'}
                                </Text>
                            </Box>
                        ) : (
                            filteredProjects.map((project) => {
                                const isSelected = selectedProjectIds.has(project.id);
                                return (
                                    <Menu.Item
                                        key={project.id}
                                        value={project.id}
                                        onSelect={() => toggleProject(project.id)}
                                    >
                                        <HStack gap={2} justify="space-between" width="100%" minW={0}>
                                            <HStack gap={2} flex="1" minW={0} overflow="hidden">
                                                <Icon flexShrink={0}>
                                                    <LuFolder />
                                                </Icon>
                                                <VStack align="start" gap={0} flex="1" minW={0} overflow="hidden">
                                                    <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
                                                        {project.name}
                                                    </Text>
                                                    <Text fontSize="xs" color="text.secondary" title={project.path}>
                                                        {truncatePath(project.path, 35)}
                                                    </Text>
                                                </VStack>
                                            </HStack>
                                            {isSelected && (
                                                <Icon color="primary.500" flexShrink={0}>
                                                    <LuCheck />
                                                </Icon>
                                            )}
                                        </HStack>
                                    </Menu.Item>
                                );
                            })
                        )}
                    </Box>

                    {/* Footer with Confirm Button */}
                    <Box
                        px={3}
                        py={2}
                        borderTopWidth="1px"
                        borderColor="border.subtle"
                        bg="bg.panel"
                        opacity={selectedProjectIds.size > 0 ? 1 : 0.5}
                    >
                        <Button
                            variant="solid"
                            colorPalette="primary"
                            size="sm"
                            width="100%"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConfirm();
                            }}
                            disabled={loading || selectedProjectIds.size === 0}
                        >
                            {loading ? (
                                <HStack gap={2}>
                                    <Spinner size="xs" />
                                    <Text>Pulling...</Text>
                                </HStack>
                            ) : (
                                `Pull to ${selectedProjectIds.size} Project${selectedProjectIds.size !== 1 ? 's' : ''}`
                            )}
                        </Button>
                    </Box>
                </Menu.Content>
            </Menu.Positioner>
        </Menu.Root>
    );
}
