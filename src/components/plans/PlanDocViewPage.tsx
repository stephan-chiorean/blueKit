import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, VStack, HStack, Text, IconButton, Icon, Badge, Flex, Portal } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuChevronLeft, LuChevronRight, LuFileText, LuPencil, LuEye, LuCode } from 'react-icons/lu';
import { ResourceFile } from '../../types/resource';
import { PlanDocument } from '../../types/plan';
import { useColorMode } from '../../contexts/ColorModeContext';
import { ResourceMarkdownContent } from '../workstation/ResourceMarkdownContent';
import MarkdownEditor, { MarkdownEditorRef } from '../editor/MarkdownEditor';
import SearchInMarkdown from '../workstation/SearchInMarkdown';
import { useWorkstation } from '../../contexts/WorkstationContext';
import { useAutoSave } from '../../hooks/useAutoSave';
import { toaster } from '../ui/toaster';
import { invokeReadFile } from '../../ipc';
import path from 'path';

const MotionBox = motion.create(Box);
const MotionFlex = motion.create(Flex);

type ViewMode = 'preview' | 'source' | 'edit';

interface PlanDocViewPageProps {
    /** All documents in the plan */
    documents: PlanDocument[];
    /** Currently selected document index */
    currentIndex: number;
    /** Callback when navigating to a different document */
    onNavigate: (index: number, document: PlanDocument) => void;
    /** Callback when content changes */
    onContentChange?: (newContent: string) => void;
}

export default function PlanDocViewPage({
    documents,
    currentIndex,
    onNavigate,
    onContentChange,
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

    // Match NoteViewPage styling (card-like)
    const cardBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(20, 20, 25, 0.5)';

    if (!currentDoc) {
        return (
            <MotionFlex
                h="100%"
                w="100%"
                align="center"
                justify="center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                    background: cardBg,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
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
            </MotionFlex>
        );
    }

    return (
        <Box
            h="100%"
            w="100%"
            display="flex"
            flexDirection="column"
            style={{
                background: cardBg,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
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
                    {/* Left: Navigation arrows */}
                    <HStack gap={1}>
                        <IconButton
                            aria-label="Previous document"
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
                                <LuChevronLeft />
                            </Icon>
                        </IconButton>
                        <IconButton
                            aria-label="Next document"
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
                                <LuChevronRight />
                            </Icon>
                        </IconButton>
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
                        <AnimatePresence>
                            {viewMode === 'edit' && (
                                <MotionBox
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    mr={2}
                                >
                                    <Badge
                                        size="sm"
                                        variant="subtle"
                                        colorPalette={saveStatus === 'saved' ? 'green' : saveStatus === 'saving' ? 'yellow' : 'gray'}
                                        css={{ borderRadius: '6px' }}
                                    >
                                        {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
                                    </Badge>
                                </MotionBox>
                            )}
                        </AnimatePresence>

                        {/* Preview icon */}
                        <IconButton
                            aria-label="Preview mode"
                            variant="ghost"
                            size="sm"
                            px={2}
                            onClick={() => setViewMode('preview')}
                            colorPalette={viewMode === 'preview' ? 'primary' : undefined}
                            bg={viewMode === 'preview' ? { _light: 'primary.50', _dark: 'primary.900/30' } : 'transparent'}
                            _hover={{}}
                        >
                            <Icon boxSize={4}>
                                <LuEye />
                            </Icon>
                        </IconButton>

                        {/* Source icon */}
                        <IconButton
                            aria-label="Source mode"
                            variant="ghost"
                            size="sm"
                            px={2}
                            onClick={() => setViewMode('source')}
                            colorPalette={viewMode === 'source' ? 'primary' : undefined}
                            bg={viewMode === 'source' ? { _light: 'primary.50', _dark: 'primary.900/30' } : 'transparent'}
                            _hover={{}}
                        >
                            <Icon boxSize={4}>
                                <LuCode />
                            </Icon>
                        </IconButton>

                        {/* Edit icon */}
                        <IconButton
                            aria-label="Edit mode"
                            variant="ghost"
                            size="sm"
                            px={2}
                            onClick={() => setViewMode('edit')}
                            colorPalette={viewMode === 'edit' ? 'primary' : undefined}
                            bg={viewMode === 'edit' ? { _light: 'primary.50', _dark: 'primary.900/30' } : 'transparent'}
                            _hover={{}}
                        >
                            <Icon boxSize={4}>
                                <LuPencil />
                            </Icon>
                        </IconButton>
                    </HStack>
                </Flex>
            </Box>

            {/* Content area */}
            <Box flex={1} overflow={viewMode === 'edit' ? 'hidden' : 'auto'} position="relative">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <MotionBox
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            h="100%"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <VStack gap={3}>
                                <MotionBox
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                >
                                    <Icon boxSize={8} color="primary.500">
                                        <LuFileText />
                                    </Icon>
                                </MotionBox>
                                <Text color="text.secondary" fontSize="sm">
                                    Loading document...
                                </Text>
                            </VStack>
                        </MotionBox>
                    ) : viewMode === 'edit' ? (
                        <MotionBox
                            key="edit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            h="100%"
                        >
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
                        </MotionBox>
                    ) : (
                        <MotionBox
                            key={`content-${currentDoc.id}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }}
                            p={6}
                            h="100%"
                        >
                            <ResourceMarkdownContent
                                resource={resource}
                                content={content}
                                viewMode={viewMode}
                                onResolveInternalPath={resolveInternalPath}
                            />
                        </MotionBox>
                    )}
                </AnimatePresence>
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
