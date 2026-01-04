import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Dialog,
    Portal,
    Button,
    HStack,
    Icon,
    Text,
    VStack,
    Badge,
    ActionBar,
    Menu,
    Input,
    InputGroup,
    Spinner,
    Box,
    Heading,
    Separator,
    Tag,
    Link,
    List,
    Code,
    Checkbox,
    Flex,
} from '@chakra-ui/react';
import {
    LuArrowLeft,
    LuChevronRight,
    LuPackage,
    LuDownload,
    LuX,
    LuFolderPlus,
    LuSearch,
    LuFolder,
    LuCheck,
} from 'react-icons/lu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CatalogWithVariations, LibraryVariation, LibraryCatalog } from '../../types/github';
import { Project } from '../../ipc';
import { artifactTypeIcon } from './CatalogCard';

// Selected variation interface (copied from LibraryTabContent for self-containment)
export interface SelectedVariation {
    variation: LibraryVariation;
    catalog: LibraryCatalog;
}

// Format relative time (copied from LibraryTabContent for self-containment)
function formatTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
}

type CatalogModalView = 'variations-picker' | 'variation-preview';

export interface CatalogDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    catalogWithVariations: CatalogWithVariations;
    onFetchVariationContent: (variation: LibraryVariation, catalog: LibraryCatalog) => Promise<string>;
    selectedVariations: Map<string, SelectedVariation>;
    onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
    projects: Project[];
    onBulkPull: (projects: Project[]) => void;
    bulkPulling: boolean;
    initialVariation?: LibraryVariation; // Optional: start directly at this variation
}

export function CatalogDetailModal({
    isOpen,
    onClose,
    catalogWithVariations,
    onFetchVariationContent,
    selectedVariations,
    onVariationToggle,
    projects,
    onBulkPull,
    bulkPulling,
    initialVariation,
}: CatalogDetailModalProps) {
    const { catalog, variations } = catalogWithVariations;
    const [currentView, setCurrentView] = useState<CatalogModalView>('variations-picker');
    const [previewVariation, setPreviewVariation] = useState<LibraryVariation | null>(null);
    const [previewContent, setPreviewContent] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState(false);

    const hasSingleVariation = variations.length === 1;

    // Helper to load variation content
    const loadVariationContent = async (variation: LibraryVariation) => {
        setPreviewVariation(variation);
        setPreviewLoading(true);
        setPreviewContent('');

        try {
            const content = await onFetchVariationContent(variation, catalog);
            setPreviewContent(content);
        } catch (error) {
            console.error('Failed to fetch variation content:', error);
            setPreviewContent('# Error\n\nFailed to load content.');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Reset state when modal opens/closes - auto-open preview for single variation or initialVariation
    useEffect(() => {
        if (isOpen) {
            if (initialVariation) {
                setCurrentView('variation-preview');
                loadVariationContent(initialVariation);
            } else if (hasSingleVariation) {
                // Single variation - go directly to preview
                setCurrentView('variation-preview');
                loadVariationContent(variations[0]);
            } else {
                // Multiple variations - show picker
                setCurrentView('variations-picker');
                setPreviewVariation(null);
                setPreviewContent('');
                setPreviewLoading(false);
            }
        }
    }, [isOpen, hasSingleVariation, initialVariation]); // Re-run if initialVariation changes

    const icon = artifactTypeIcon[catalog.artifact_type] || <LuPackage />;

    const handleVariationSelect = async (variation: LibraryVariation) => {
        setCurrentView('variation-preview');
        loadVariationContent(variation);
    };

    const handleBack = () => {
        if (hasSingleVariation) {
            // Single variation - close modal since there's no picker
            onClose();
        } else {
            // Multiple variations - go back to picker
            setCurrentView('variations-picker');
            setPreviewVariation(null);
            setPreviewContent('');
        }
    };

    const getVersionLabel = (variation: LibraryVariation, index: number): string => {
        if (variation.version_tag) return variation.version_tag;
        return `v${variations.length - index}`;
    };

    // Parse front matter from content
    const frontMatter = useMemo(() => {
        const fm: Record<string, any> = {};
        if (previewContent.trim().startsWith('---')) {
            const endIndex = previewContent.indexOf('\n---', 4);
            if (endIndex !== -1) {
                const frontMatterText = previewContent.substring(4, endIndex);
                const lines = frontMatterText.split('\n');
                lines.forEach((line) => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > 0) {
                        const key = line.substring(0, colonIndex).trim();
                        let value = line.substring(colonIndex + 1).trim();
                        if (key === 'tags' && value.startsWith('[')) {
                            fm[key] = value
                                .slice(1, -1)
                                .split(',')
                                .map((t) => t.trim().replace(/['"]/g, ''));
                        } else {
                            fm[key] = value.replace(/^["']|["']$/g, '');
                        }
                    }
                });
            }
        }
        return fm;
    }, [previewContent]);

    const contentWithoutFrontMatter = previewContent.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
    const displayName = frontMatter.title || frontMatter.name || catalog.name;

    // Get selected variations for action bar
    const selectedVariationsArray = useMemo(() => {
        return Array.from(selectedVariations.values());
    }, [selectedVariations]);

    const hasSelection = selectedVariations.size > 0;

    // Action bar handlers
    const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!hasSelection) {
            setSelectedProjectIds(new Set());
            setSearchQuery('');
            setIsAddToProjectOpen(false);
        }
    }, [hasSelection]);

    useEffect(() => {
        if (isAddToProjectOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isAddToProjectOpen]);

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

    const handleConfirmPull = () => {
        const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
        onBulkPull(selectedProjects);
        setIsAddToProjectOpen(false);
        setSelectedProjectIds(new Set());
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
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW="90vw"
                        maxH="90vh"
                        w="900px"
                        h="80vh"
                        borderRadius="16px"
                        css={{
                            background: 'rgba(255, 255, 255, 0.25)',
                            backdropFilter: 'blur(30px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                            borderColor: 'rgba(0, 0, 0, 0.08)',
                            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.06)',
                            _dark: {
                                background: 'rgba(255, 255, 255, 0.08)',
                                borderColor: 'rgba(255, 255, 255, 0.15)',
                                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                            },
                        }}
                    >
                        <Dialog.Header 
                            borderBottomWidth="1px" 
                            borderColor="border.subtle"
                        >
                            <Flex
                                width="100%"
                                justify="space-between"
                                align="center"
                                gap={4}
                            >
                                {/* Left side - Breadcrumb */}
                                <HStack gap={2} align="center" flex={1} minW={0}>
                                    {/* Back button when on preview view with multiple variations */}
                                    {currentView === 'variation-preview' && !hasSingleVariation && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBack}
                                            px={2}
                                        >
                                            <LuArrowLeft />
                                        </Button>
                                    )}

                                    {/* Breadcrumb navigation */}
                                    <HStack gap={1} align="center" flex={1} minW={0}>
                                        {currentView === 'variation-preview' ? (
                                            hasSingleVariation ? (
                                                // Single variation - just show catalog name
                                                <>
                                                    <Icon boxSize={5} color="primary.500">
                                                        {icon}
                                                    </Icon>
                                                    <Dialog.Title fontSize="lg">{catalog.name}</Dialog.Title>
                                                </>
                                            ) : (
                                                // Multiple variations - show breadcrumb
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleBack}
                                                        px={2}
                                                        fontWeight="normal"
                                                        color="text.secondary"
                                                        _hover={{ color: 'primary.500' }}
                                                    >
                                                        <Icon boxSize={4} color="primary.500" mr={1}>
                                                            {icon}
                                                        </Icon>
                                                        {catalog.name}
                                                    </Button>
                                                    <Icon color="text.tertiary" boxSize={4}>
                                                        <LuChevronRight />
                                                    </Icon>
                                                    <Dialog.Title fontSize="lg">
                                                        {previewVariation && getVersionLabel(previewVariation, variations.indexOf(previewVariation))}
                                                    </Dialog.Title>
                                                </>
                                            )
                                        ) : (
                                            // Picker view - show catalog name with version count
                                            <>
                                                <Icon boxSize={5} color="primary.500">
                                                    {icon}
                                                </Icon>
                                                <Dialog.Title fontSize="lg">{catalog.name}</Dialog.Title>
                                                <Badge
                                                    size="sm"
                                                    colorPalette="gray"
                                                    bg="transparent"
                                                    _dark={{ bg: "transparent" }}
                                                >
                                                    {variations.length} versions
                                                </Badge>
                                            </>
                                        )}
                                    </HStack>
                                </HStack>

                                {/* Right side - Action buttons */}
                                <HStack gap={2} align="center" flexShrink={0}>
                                {currentView === 'variation-preview' && previewVariation && (
                                    <>
                                        {(() => {
                                            const isSelected = selectedVariations.has(previewVariation.id);
                                            return (
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => onVariationToggle(previewVariation, catalog)}
                                                    borderWidth="1px"
                                                    borderRadius="lg"
                                                    css={isSelected ? {
                                                        background: 'rgba(59, 130, 246, 0.15)',
                                                        backdropFilter: 'blur(20px) saturate(180%)',
                                                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                                        borderColor: 'rgba(59, 130, 246, 0.3)',
                                                        boxShadow: '0 2px 8px 0 rgba(59, 130, 246, 0.1)',
                                                        color: 'var(--chakra-colors-primary-600)',
                                                        _dark: {
                                                            background: 'rgba(59, 130, 246, 0.2)',
                                                            borderColor: 'rgba(59, 130, 246, 0.4)',
                                                            boxShadow: '0 4px 16px 0 rgba(59, 130, 246, 0.2)',
                                                            color: 'var(--chakra-colors-primary-400)',
                                                        },
                                                    } : {
                                                        background: 'rgba(255, 255, 255, 0.25)',
                                                        backdropFilter: 'blur(20px) saturate(180%)',
                                                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                                        borderColor: 'rgba(0, 0, 0, 0.08)',
                                                        boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                                                        _dark: {
                                                            background: 'rgba(0, 0, 0, 0.2)',
                                                            borderColor: 'rgba(255, 255, 255, 0.15)',
                                                            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                                                        },
                                                    }}
                                                >
                                                    {isSelected ? 'Selected' : 'Select'}
                                                </Button>
                                            );
                                        })()}
                                        <Button
                                            variant="solid"
                                            colorPalette="primary"
                                            size="xs"
                                        >
                                            <HStack gap={1.5}>
                                                <LuDownload />
                                                <Text>Pull</Text>
                                            </HStack>
                                        </Button>
                                    </>
                                )}
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={onClose}
                                    borderWidth="1px"
                                    borderRadius="lg"
                                    css={{
                                        background: 'rgba(255, 255, 255, 0.25)',
                                        backdropFilter: 'blur(20px) saturate(180%)',
                                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                        borderColor: 'rgba(0, 0, 0, 0.08)',
                                        boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                                        _dark: {
                                            background: 'rgba(0, 0, 0, 0.2)',
                                            borderColor: 'rgba(255, 255, 255, 0.15)',
                                            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                                        },
                                    }}
                                >
                                    Close
                                </Button>
                                </HStack>
                            </Flex>
                        </Dialog.Header>

                        <Dialog.Body overflow="auto" position="relative" p={currentView === 'variation-preview' ? 4 : undefined}>
                            {/* Variations Picker View */}
                            {currentView === 'variations-picker' && (
                                <VStack align="stretch" gap={4}>
                                    {/* Action Bar */}
                                    {hasSelection && (
                                        <ActionBar.Root open={hasSelection} closeOnInteractOutside={false}>
                                            <Portal>
                                                <ActionBar.Positioner zIndex={1000}>
                                                    <ActionBar.Content>
                                                        <VStack align="stretch" gap={0}>
                                                            <Box pb={1} mt={-0.5}>
                                                                <HStack gap={1.5} justify="center">
                                                                    <Text fontSize="xs" color="text.secondary">
                                                                        {selectedVariationsArray.length} variation{selectedVariationsArray.length !== 1 ? 's' : ''} selected
                                                                    </Text>
                                                                </HStack>
                                                            </Box>
                                                            <HStack gap={2}>
                                                                <Button
                                                                    variant="surface"
                                                                    colorPalette="red"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        // Clear only variations from this catalog
                                                                        for (const v of variations) {
                                                                            if (selectedVariations.has(v.id)) {
                                                                                onVariationToggle(v, catalog);
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={bulkPulling}
                                                                >
                                                                    <HStack gap={2}>
                                                                        <LuX />
                                                                        <Text>Remove</Text>
                                                                    </HStack>
                                                                </Button>

                                                                <ActionBar.Separator />

                                                                <Menu.Root
                                                                    closeOnSelect={false}
                                                                    open={isAddToProjectOpen}
                                                                    onOpenChange={(e) => setIsAddToProjectOpen(e.open)}
                                                                >
                                                                    <Menu.Trigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            disabled={bulkPulling}
                                                                        >
                                                                            <HStack gap={2}>
                                                                                <LuFolderPlus />
                                                                                <Text>Add to Project</Text>
                                                                            </HStack>
                                                                        </Button>
                                                                    </Menu.Trigger>
                                                                    <Portal>
                                                                        <Menu.Positioner zIndex={2000}>
                                                                            <Menu.Content width="400px" maxH="500px" position="relative" zIndex={2000}>
                                                                                <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                                                                                    <Text fontSize="sm" fontWeight="semibold">
                                                                                        Add to Project
                                                                                    </Text>
                                                                                </Box>

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
                                                                                            handleConfirmPull();
                                                                                        }}
                                                                                        disabled={bulkPulling || selectedProjectIds.size === 0}
                                                                                    >
                                                                                        {bulkPulling ? (
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
                                                                    </Portal>
                                                                </Menu.Root>
                                                            </HStack>
                                                        </VStack>
                                                    </ActionBar.Content>
                                                </ActionBar.Positioner>
                                            </Portal>
                                        </ActionBar.Root>
                                    )}

                                    {catalog.description && (
                                        <Text fontSize="md" color="text.secondary">
                                            {catalog.description}
                                        </Text>
                                    )}

                                    <Text fontSize="sm" color="text.tertiary">
                                        Select a version to view its content
                                    </Text>

                                    <VStack align="stretch" gap={2}>
                                        {variations.map((v, index) => {
                                            const publishDate = new Date(v.published_at * 1000);
                                            const timeAgo = formatTimeAgo(publishDate);
                                            const isVariationSelected = selectedVariations.has(v.id);
                                            const versionLabel = getVersionLabel(v, index);

                                            return (
                                                <HStack
                                                    key={v.id}
                                                    justify="space-between"
                                                    align="center"
                                                    py={3}
                                                    px={4}
                                                    borderRadius="12px"
                                                    cursor="pointer"
                                                    transition="all 0.15s"
                                                    css={{
                                                        background: 'rgba(255, 255, 255, 0.15)',
                                                        _dark: {
                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                        },
                                                        _hover: {
                                                            background: 'rgba(255, 255, 255, 0.25)',
                                                            _dark: {
                                                                background: 'rgba(255, 255, 255, 0.1)',
                                                            },
                                                        },
                                                    }}
                                                    onClick={() => handleVariationSelect(v)}
                                                    gap={3}
                                                >
                                                    <HStack gap={3} flex={1}>
                                                        <Icon boxSize={5} color="primary.500">
                                                            {icon}
                                                        </Icon>
                                                        <VStack align="start" gap={0}>
                                                            <Text fontSize="md" fontWeight="medium">
                                                                {versionLabel}
                                                            </Text>
                                                            <HStack gap={2}>
                                                                <Text fontSize="sm" color="text.tertiary">
                                                                    {timeAgo}
                                                                </Text>
                                                                {v.publisher_name && (
                                                                    <Text fontSize="sm" color="text.tertiary">
                                                                        by {v.publisher_name}
                                                                    </Text>
                                                                )}
                                                            </HStack>
                                                        </VStack>
                                                    </HStack>
                                                    <HStack gap={3}>
                                                        <Icon color="text.tertiary">
                                                            <LuChevronRight />
                                                        </Icon>
                                                        <Checkbox.Root
                                                            checked={isVariationSelected}
                                                            colorPalette="primary"
                                                            variant="outline"
                                                            onCheckedChange={() => onVariationToggle(v, catalog)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            cursor="pointer"
                                                        >
                                                            <Checkbox.HiddenInput />
                                                            <Checkbox.Control 
                                                                cursor="pointer"
                                                                css={{
                                                                    borderColor: isVariationSelected ? 'primary.500' : 'border.emphasized',
                                                                    _checked: {
                                                                        borderColor: 'primary.500',
                                                                    },
                                                                }}
                                                            >
                                                                <Checkbox.Indicator 
                                                                    css={{
                                                                        color: 'primary.500',
                                                                        _dark: {
                                                                            color: 'primary.500',
                                                                        },
                                                                    }}
                                                                />
                                                            </Checkbox.Control>
                                                        </Checkbox.Root>
                                                    </HStack>
                                                </HStack>
                                            );
                                        })}
                                    </VStack>
                                </VStack>
                            )}

                            {/* Variation Preview View */}
                            {currentView === 'variation-preview' && (
                                <Box h="100%" display="flex" flexDirection="column">
                                    {previewLoading ? (
                                        <Flex justify="center" align="center" h="100%" minH="400px">
                                            <VStack gap={4}>
                                                <Spinner size="lg" />
                                                <Text color="text.secondary">Loading content...</Text>
                                            </VStack>
                                        </Flex>
                                    ) : (
                                        <Box
                                            flex="1"
                                            overflow="auto"
                                            borderRadius="12px"
                                            css={{
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                _dark: {
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                },
                                            }}
                                        >
                                            <Box p={6}>
                                                <VStack align="stretch" gap={6}>
                                                    {/* Header */}
                                                    <Box>
                                                        <Heading
                                                            size="xl"
                                                            mb={2}
                                                            css={{
                                                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                                                _dark: {
                                                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                                                },
                                                            }}
                                                        >
                                                            {displayName}
                                                        </Heading>
                                                        {frontMatter.description && (
                                                            <Text
                                                                fontSize="lg"
                                                                color="text.secondary"
                                                                mb={4}
                                                                css={{
                                                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                                                    _dark: {
                                                                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                                                    },
                                                                }}
                                                            >
                                                                {frontMatter.description}
                                                            </Text>
                                                        )}

                                                        {/* Metadata Tags */}
                                                        <HStack gap={2} flexWrap="wrap" mt={4}>
                                                            {frontMatter.tags && frontMatter.tags.map((tag: string) => (
                                                                <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                                                                    <Tag.Label>#{tag}</Tag.Label>
                                                                </Tag.Root>
                                                            ))}
                                                            {frontMatter.version && (
                                                                <Tag.Root size="sm" variant="outline">
                                                                    <Tag.Label>v{frontMatter.version}</Tag.Label>
                                                                </Tag.Root>
                                                            )}
                                                        </HStack>
                                                    </Box>

                                                    <Separator />

                                                    {/* Markdown Content */}
                                                    <Box
                                                        css={{
                                                            '& > *': { mb: 4 },
                                                            '& > *:last-child': { mb: 0 },
                                                            '& h1': { fontSize: '2xl', fontWeight: 'bold', mt: 6, mb: 4 },
                                                            '& h2': { fontSize: '2xl', fontWeight: 'semibold', mt: 5, mb: 3, color: 'primary.500' },
                                                            '& h3': { fontSize: 'lg', fontWeight: 'semibold', mt: 4, mb: 2 },
                                                            '& h4, & h5, & h6': { fontSize: 'md', fontWeight: 'semibold', mt: 3, mb: 2 },
                                                            '& p': { lineHeight: '1.75', color: 'text.primary' },
                                                            '& ul, & ol': { pl: 4, mb: 4 },
                                                            '& li': { mb: 2 },
                                                            '& pre': { mb: 4 },
                                                            '& code': { fontSize: '0.9em' },
                                                            '& a': { color: 'primary.500', textDecoration: 'underline' },
                                                            '& a:hover': { color: 'primary.600' },
                                                            '& blockquote': { borderLeft: '4px solid', borderColor: 'border.emphasized', pl: 4, py: 2, my: 4, fontStyle: 'italic' },
                                                            '& table': { width: '100%', borderCollapse: 'collapse', mb: 4 },
                                                            '& th, & td': { border: '1px solid', borderColor: 'border.subtle', px: 3, py: 2 },
                                                            '& th': { fontWeight: 'semibold' },
                                                        }}
                                                    >
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                h1: ({ children }) => (
                                                                    <Heading as="h1" size="2xl" mt={6} mb={4}>
                                                                        {children}
                                                                    </Heading>
                                                                ),
                                                                h2: ({ children }) => (
                                                                    <Heading as="h2" size="2xl" mt={5} mb={3} color="primary.500">
                                                                        {children}
                                                                    </Heading>
                                                                ),
                                                                h3: ({ children }) => (
                                                                    <Heading as="h3" size="lg" mt={4} mb={2}>
                                                                        {children}
                                                                    </Heading>
                                                                ),
                                                                h4: ({ children }) => (
                                                                    <Heading as="h4" size="md" mt={3} mb={2}>
                                                                        {children}
                                                                    </Heading>
                                                                ),
                                                                p: ({ children }) => (
                                                                    <Text mb={4} lineHeight="1.75" color="text.primary">
                                                                        {children}
                                                                    </Text>
                                                                ),
                                                                ul: ({ children }) => (
                                                                    <List.Root mb={4} pl={4}>
                                                                        {children}
                                                                    </List.Root>
                                                                ),
                                                                ol: ({ children }) => (
                                                                    <List.Root as="ol" mb={4} pl={4}>
                                                                        {children}
                                                                    </List.Root>
                                                                ),
                                                                li: ({ children }) => <List.Item mb={2}>{children}</List.Item>,
                                                                code: ({ className, children, ...props }) => {
                                                                    const match = /language-(.+)/.exec(className || '');
                                                                    const isInline = !match;
                                                                    const codeString = String(children).replace(/\n$/, '');

                                                                    if (isInline) {
                                                                        return (
                                                                            <Code px={1.5} py={0.5} borderRadius="sm" fontSize="0.9em" {...props}>
                                                                                {children}
                                                                            </Code>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <Box
                                                                            as="pre"
                                                                            p={4}
                                                                            borderRadius="md"
                                                                            overflow="auto"
                                                                            mb={4}
                                                                            css={{
                                                                                background: 'rgba(0, 0, 0, 0.1)',
                                                                                _dark: {
                                                                                    background: 'rgba(0, 0, 0, 0.3)',
                                                                                },
                                                                            }}
                                                                        >
                                                                            <Code display="block" whiteSpace="pre" fontSize="sm">
                                                                                {codeString}
                                                                            </Code>
                                                                        </Box>
                                                                    );
                                                                },
                                                                a: ({ href, children }) => (
                                                                    <Link
                                                                        href={href}
                                                                        color="primary.500"
                                                                        textDecoration="underline"
                                                                        _hover={{ color: 'primary.600' }}
                                                                    >
                                                                        {children}
                                                                    </Link>
                                                                ),
                                                                blockquote: ({ children }) => (
                                                                    <Box
                                                                        as="blockquote"
                                                                        borderLeft="4px solid"
                                                                        borderColor="border.emphasized"
                                                                        pl={4}
                                                                        py={2}
                                                                        my={4}
                                                                        fontStyle="italic"
                                                                    >
                                                                        {children}
                                                                    </Box>
                                                                ),
                                                                hr: () => <Separator my={6} />,
                                                            }}
                                                        >
                                                            {contentWithoutFrontMatter}
                                                        </ReactMarkdown>
                                                    </Box>
                                                </VStack>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
