/**
 * WalkthroughDocViewPage - Markdown viewer for walkthrough documents
 * 
 * Mirrors PlanDocViewPage structure with:
 * - Header bar with view mode icons (preview/source/edit)
 * - No navigation arrows (single document)
 * - Same glassmorphic styling
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, HStack, Text, Button, Icon, Badge, Flex, Portal } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEye, FaCode, FaEdit } from 'react-icons/fa';
import { ResourceFile } from '@/types/resource';
import type { WalkthroughDetails } from '@/types/walkthrough';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { ResourceMarkdownContent } from '@/features/workstation/components/ResourceMarkdownContent';
import MarkdownEditor, { MarkdownEditorRef } from '@/shared/components/editor/MarkdownEditor';
import SearchInMarkdown from '@/features/workstation/components/SearchInMarkdown';
import { useWorkstation } from '@/app/WorkstationContext';
import { useAutoSave } from '@/hooks/useAutoSave';
import { toaster } from '@/shared/components/ui/toaster';
import path from 'path';

const MotionBox = motion.create(Box);

type ViewMode = 'preview' | 'source' | 'edit';

interface WalkthroughDocViewPageProps {
    /** Walkthrough details */
    details: WalkthroughDetails;
    /** Markdown content */
    content: string;
    /** Callback when content changes */
    onContentChange?: (newContent: string) => void;
}

export default function WalkthroughDocViewPage({
    details,
    content: initialContent,
    onContentChange,
}: WalkthroughDocViewPageProps) {
    const { colorMode } = useColorMode();
    const [viewMode, setViewMode] = useState<ViewMode>('preview');
    const [content, setContent] = useState(initialContent);
    const { isSearchOpen, setIsSearchOpen } = useWorkstation();
    const editorRef = useRef<MarkdownEditorRef>(null);

    // Sync content when prop changes
    useEffect(() => {
        setContent(initialContent);
    }, [initialContent]);

    // Create a ResourceFile from WalkthroughDetails
    const resource: ResourceFile = useMemo(() => ({
        path: details.filePath,
        name: details.name,
        frontMatter: {},
        resourceType: 'walkthrough',
    }), [details]);

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

    // Resolve relative paths for internal markdown links
    const resolveInternalPath = useCallback((href: string): string => {
        const currentDir = path.dirname(details.filePath);
        return path.resolve(currentDir, href);
    }, [details.filePath]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Search (Cmd+F / Ctrl+F)
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [setIsSearchOpen]);

    // Match PlanDocViewPage styling
    const cardBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(20, 20, 25, 0.5)';

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
            {/* Header - matching PlanDocViewPage style */}
            <Box
                position="sticky"
                top={0}
                zIndex={100}
                bg="transparent"
                px={4}
                py={2}
            >
                <Flex justify="space-between" align="center" gap={4}>
                    {/* Left: Spacer (no navigation for single doc) */}
                    <Box w="60px" />

                    {/* Center: Filename */}
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
                            title={details.name}
                        >
                            {details.name}
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
                </Flex>
            </Box>

            {/* Content area */}
            <Box flex={1} overflow={viewMode === 'edit' ? 'hidden' : 'auto'} position="relative">
                <AnimatePresence mode="wait">
                    {viewMode === 'edit' ? (
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
                            key={`content-${details.id}`}
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
