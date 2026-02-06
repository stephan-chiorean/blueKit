import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, VStack, HStack, Text, Button, Icon, Badge, Flex, Portal, IconButton } from '@chakra-ui/react';
import { LuArrowLeft, LuArrowRight, LuFileText, LuPanelRightOpen, LuPanelRightClose } from 'react-icons/lu';
import { FaEye, FaCode, FaEdit } from 'react-icons/fa';
import { listen } from '@tauri-apps/api/event';
import { ResourceFile } from '@/types/resource';
import { PlanDocument } from '@/types/plan';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { ResourceMarkdownContent } from '@/features/workstation/components/ResourceMarkdownContent';
import MarkdownEditor, { MarkdownEditorRef } from '@/shared/components/editor/MarkdownEditor';
import SearchInMarkdown from '@/features/workstation/components/SearchInMarkdown';
import { useWorkstation } from '@/app/WorkstationContext';
import { useAutoSave } from '@/hooks/useAutoSave';
import { toaster } from '@/shared/components/ui/toaster';
import { invokeReadFile } from '@/ipc';
import path from 'path';

type ViewMode = 'preview' | 'source' | 'edit';

interface PlanDocViewPageProps {
    /** All documents in the plan */
    documents: PlanDocument[];
    /** Currently selected document index */
    currentIndex: number;
    /** Plan ID for file watcher events */
    planId?: string;
    /** Callback when navigating to a different document */
    onNavigate: (index: number, document: PlanDocument) => void;
    /** Callback when content changes */
    onContentChange?: (newContent: string) => void;
    /** Whether the overview panel is open */
    isPanelOpen?: boolean;
    /** Callback to toggle the overview panel */
    onTogglePanel?: () => void;
    /** Callback to navigate back to plans list */
    onBack?: () => void;
}

export default function PlanDocViewPage({
    documents,
    currentIndex,
    planId,
    onNavigate,
    onContentChange,
    isPanelOpen = true,
    onTogglePanel,
    onBack,
}: PlanDocViewPageProps) {
    const { colorMode } = useColorMode();
    const [viewMode, setViewMode] = useState<ViewMode>('preview');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const { isSearchOpen, setIsSearchOpen } = useWorkstation();
    const editorRef = useRef<MarkdownEditorRef>(null);

    const currentDoc = documents[currentIndex];
    const canNavigatePrev = currentIndex > 0;
    const canNavigateNext = currentIndex < documents.length - 1;

    // Create a ResourceFile from PlanDocument
    const resource: ResourceFile = useMemo(() => ({
        path: currentDoc?.filePath || '',
        name: currentDoc?.fileName || '',
        frontMatter: {},
        resourceType: 'plan',
    }), [currentDoc]);

    // Auto-save hook for edit mode
    const { save, saveNow, status: saveStatus } = useAutoSave(resource.path, {
        delay: 1500,
        enabled: viewMode === 'edit',
        onSaveSuccess: () => {
            toaster.create({
                type: 'success',
                title: 'Saved',
                duration: 2000,
            });
        },
        onSaveError: (error) => {
            toaster.create({
                type: 'error',
                title: 'Save failed',
                description: error.message,
            });
        },
    });

    // Load document content when current document changes
    useEffect(() => {
        if (!currentDoc) {
            setLoading(false);
            return;
        }

        const loadContent = async () => {
            setLoading(true);
            try {
                const fileContent = await invokeReadFile(currentDoc.filePath);
                setContent(fileContent);
                // Reset to preview mode when switching documents
                setViewMode('preview');
            } catch (error) {
                console.error('Failed to load document:', error);
                toaster.create({
                    type: 'error',
                    title: 'Failed to load document',
                    description: String(error),
                });
                setContent('');
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [currentDoc?.filePath]);

    // Listen for file changes from the plan folder watcher
    // Reload content if the current document is modified externally (e.g., by AI tools)
    useEffect(() => {
        if (!planId || !currentDoc) return;
        // Skip if in edit mode - don't disrupt user edits
        if (viewMode === 'edit') return;

        const eventName = `plan-documents-changed-${planId}`;
        let isMounted = true;
        // Capture current filePath for comparison inside the async callback
        const currentFilePath = currentDoc.filePath;

        const setupListener = async () => {
            const unlisten = await listen<string[]>(eventName, async (event) => {
                if (!isMounted) return;

                const changedPaths = event.payload;
                // Check if the current document's file was changed
                const currentFileChanged = changedPaths.some(
                    changedPath => changedPath === currentFilePath
                );

                if (currentFileChanged) {
                    try {
                        const fileContent = await invokeReadFile(currentFilePath);
                        if (isMounted) {
                            setContent(fileContent);
                        }
                    } catch (error) {
                        console.error('Failed to reload document after file change:', error);
                    }
                }
            });

            return unlisten;
        };

        const unlistenPromise = setupListener();

        return () => {
            isMounted = false;
            unlistenPromise.then(unlisten => unlisten?.());
        };
    }, [planId, currentDoc?.filePath, viewMode]);

    // Handle content changes from editor
    const handleContentChange = useCallback((newContent: string) => {
        setContent(newContent);
        onContentChange?.(newContent);
        if (viewMode === 'edit') {
            save(newContent);
        }
    }, [onContentChange, save, viewMode]);

    // Handle manual save (Cmd+S)
    const handleSave = useCallback(async (contentToSave: string) => {
        try {
            await saveNow(contentToSave);
        } catch {
            // Error handled in hook
        }
    }, [saveNow]);

    // Navigate to previous document
    const handleNavigatePrev = useCallback(() => {
        if (!canNavigatePrev) return;
        const prevDoc = documents[currentIndex - 1];
        onNavigate(currentIndex - 1, prevDoc);
    }, [canNavigatePrev, currentIndex, documents, onNavigate]);

    // Navigate to next document
    const handleNavigateNext = useCallback(() => {
        if (!canNavigateNext) return;
        const nextDoc = documents[currentIndex + 1];
        onNavigate(currentIndex + 1, nextDoc);
    }, [canNavigateNext, currentIndex, documents, onNavigate]);

    // Resolve relative paths for internal markdown links
    const resolveInternalPath = useCallback((href: string): string => {
        if (!currentDoc) return href;
        const currentDir = path.dirname(currentDoc.filePath);
        return path.resolve(currentDir, href);
    }, [currentDoc]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Search (Cmd+F / Ctrl+F)
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            // Navigate with arrow keys when not editing
            if (viewMode !== 'edit') {
                if (e.key === 'ArrowLeft' && canNavigatePrev) {
                    e.preventDefault();
                    handleNavigatePrev();
                }
                if (e.key === 'ArrowRight' && canNavigateNext) {
                    e.preventDefault();
                    handleNavigateNext();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [setIsSearchOpen, viewMode, canNavigatePrev, canNavigateNext, handleNavigatePrev, handleNavigateNext]);

    if (!currentDoc) {
        return (
            <Flex
                h="100%"
                w="100%"
                align="center"
                justify="center"
                style={{
                    background: 'transparent',
                }}
            >
                <VStack gap={3}>
                    <Icon boxSize={12} color="text.tertiary">
                        <LuFileText />
                    </Icon>
                    <Text color="text.secondary" fontSize="lg">
                        No documents in this plan
                    </Text>
                    <Text color="text.tertiary" fontSize="sm">
                        Add markdown files to the plan folder to get started
                    </Text>
                </VStack>
            </Flex>
        );
    }

    return (
        <Box
            h="100%"
            w="100%"
            display="flex"
            flexDirection="column"
            style={{
                background: 'transparent',
            }}
        >
            {/* Header - matching NoteViewHeader style */}
            <Box
                position="sticky"
                top={0}
                zIndex={100}
                bg="transparent"
                px={4}
                py={2}
            >
                <Flex justify="space-between" align="center" gap={4}>
                    {/* Left: Back button + Document navigation arrows */}
                    <HStack gap={2}>
                        {/* Back to Plans button */}
                        {onBack && (
                            <Button
                                variant="ghost"
                                size="sm"
                                px={2}
                                bg="transparent"
                                onClick={onBack}
                                _hover={{
                                    bg: colorMode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
                                }}
                                borderRightWidth="1px"
                                borderColor="border.subtle"
                                borderRadius="md"
                                mr={1}
                            >
                                <HStack gap={1}>
                                    <Icon boxSize={4}>
                                        <LuArrowLeft />
                                    </Icon>
                                    <Text fontSize="sm" fontWeight="medium">Plans</Text>
                                </HStack>
                            </Button>
                        )}

                        {/* Document navigation arrows */}
                        <HStack gap={1}>
                            <Button
                                variant="ghost"
                                size="sm"
                                px={2}
                                bg="transparent"
                                disabled={!canNavigatePrev}
                                opacity={canNavigatePrev ? 1 : 0.5}
                                cursor={canNavigatePrev ? 'pointer' : 'not-allowed'}
                                onClick={handleNavigatePrev}
                                _hover={{}}
                            >
                                <Icon boxSize={4}>
                                    <LuArrowLeft />
                                </Icon>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                px={2}
                                bg="transparent"
                                disabled={!canNavigateNext}
                                opacity={canNavigateNext ? 1 : 0.5}
                                cursor={canNavigateNext ? 'pointer' : 'not-allowed'}
                                onClick={handleNavigateNext}
                                _hover={{}}
                            >
                                <Icon boxSize={4}>
                                    <LuArrowRight />
                                </Icon>
                            </Button>
                        </HStack>
                    </HStack>

                    {/* Center: Filename with (N/M) indicator */}
                    <HStack
                        gap={2}
                        flex={1}
                        justify="center"
                        minW={0}
                    >
                        <Text
                            fontSize="sm"
                            color="text.primary"
                            fontWeight="medium"
                            lineClamp={1}
                            title={currentDoc.fileName}
                        >
                            {currentDoc.fileName.replace(/\.md$/, '')}
                        </Text>
                        <Text
                            fontSize="sm"
                            color="text.tertiary"
                            fontWeight="normal"
                        >
                            ({currentIndex + 1}/{documents.length})
                        </Text>
                    </HStack>

                    {/* Right: View mode icons */}
                    <HStack gap={1}>
                        {/* Save status indicator */}
                        {viewMode === 'edit' && (
                            <Box mr={2}>
                                <Badge
                                    size="sm"
                                    variant="subtle"
                                    colorPalette={saveStatus === 'saved' ? 'green' : saveStatus === 'saving' ? 'yellow' : 'gray'}
                                    css={{ borderRadius: '6px' }}
                                >
                                    {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
                                </Badge>
                            </Box>
                        )}

                        {/* Preview icon */}
                        <Button
                            variant="ghost"
                            size="sm"
                            px={2}
                            onClick={() => setViewMode('preview')}
                            colorScheme={viewMode === 'preview' ? 'primary' : undefined}
                            bg={viewMode === 'preview' ? 'primary.50' : 'transparent'}
                            _hover={{}}
                            _dark={{
                                bg: viewMode === 'preview' ? 'primary.900/30' : 'transparent',
                            }}
                        >
                            <Icon boxSize={4}>
                                <FaEye />
                            </Icon>
                        </Button>

                        {/* Source icon */}
                        <Button
                            variant="ghost"
                            size="sm"
                            px={2}
                            onClick={() => setViewMode('source')}
                            colorScheme={viewMode === 'source' ? 'primary' : undefined}
                            bg={viewMode === 'source' ? 'primary.50' : 'transparent'}
                            _hover={{}}
                            _dark={{
                                bg: viewMode === 'source' ? 'primary.900/30' : 'transparent',
                            }}
                        >
                            <Icon boxSize={4}>
                                <FaCode />
                            </Icon>
                        </Button>

                        {/* Edit icon */}
                        <Button
                            variant="ghost"
                            size="sm"
                            px={2}
                            onClick={() => setViewMode('edit')}
                            colorScheme={viewMode === 'edit' ? 'primary' : undefined}
                            bg={viewMode === 'edit' ? 'primary.50' : 'transparent'}
                            _hover={{}}
                            _dark={{
                                bg: viewMode === 'edit' ? 'primary.900/30' : 'transparent',
                            }}
                        >
                            <Icon boxSize={4}>
                                <FaEdit />
                            </Icon>
                        </Button>
                    </HStack>

                    <IconButton
                        variant="ghost"
                        size="sm"
                        onClick={onTogglePanel}
                        aria-label={isPanelOpen ? "Close side panel" : "Open side panel"}
                        css={{
                            borderRadius: '10px',
                            color: "text.secondary",
                            _hover: {
                                bg: colorMode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
                            },
                        }}
                    >
                        <Icon boxSize={4}>
                            {isPanelOpen ? <LuPanelRightClose /> : <LuPanelRightOpen />}
                        </Icon>
                    </IconButton>
                </Flex>
            </Box>

            {/* Content area - No animations */}
            <Box flex={1} overflow={viewMode === 'edit' ? 'hidden' : 'auto'} position="relative">
                {loading ? (
                    <Box
                        h="100%"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                    >
                        <VStack gap={3}>
                            <Icon boxSize={8} color="primary.500">
                                <LuFileText />
                            </Icon>
                            <Text color="text.secondary" fontSize="sm">
                                Loading document...
                            </Text>
                        </VStack>
                    </Box>
                ) : viewMode === 'edit' ? (
                    <Box h="100%">
                        <MarkdownEditor
                            ref={editorRef}
                            content={content}
                            onChange={handleContentChange}
                            onSave={handleSave}
                            colorMode={colorMode}
                            readOnly={false}
                            showLineNumbers={true}
                            placeholder="Start writing..."
                        />
                    </Box>
                ) : (
                    <Box p={6} h="100%">
                        <ResourceMarkdownContent
                            resource={resource}
                            content={content}
                            viewMode={viewMode}
                            onResolveInternalPath={resolveInternalPath}
                        />
                    </Box>
                )}
            </Box>

            {/* Search Component */}
            <Portal>
                {isSearchOpen && viewMode !== 'edit' && (
                    <SearchInMarkdown
                        isOpen={isSearchOpen}
                        onClose={() => setIsSearchOpen(false)}
                        containerId={viewMode === 'source' ? 'markdown-content-source' : 'markdown-content-preview'}
                        viewMode={viewMode as 'preview' | 'source'}
                    />
                )}
            </Portal>
        </Box>
    );
}
