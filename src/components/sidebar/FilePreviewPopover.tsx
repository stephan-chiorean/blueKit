import { Box, VStack, Spinner, Portal, HStack } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { FileTreeNode, invokeReadFile } from '../../ipc';
import yaml from 'js-yaml';
import { useColorMode } from '../../contexts/ColorModeContext';
import { ResourceMarkdownContent } from '../workstation/ResourceMarkdownContent';

const MotionBox = motion.create(Box);

interface FilePreviewPopoverProps {
    file: FileTreeNode | null;
    anchorRect: DOMRect | null;
    isOpen: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    placement?: 'right' | 'top';
}

interface FileMetadata {
    title?: string;
    description?: string;
    tags?: string[];
    [key: string]: any;
}

export default function FilePreviewPopover({
    file,
    anchorRect,
    isOpen,
    onMouseEnter,
    onMouseLeave,
    placement = 'right',
}: FilePreviewPopoverProps) {
    const { colorMode } = useColorMode();
    const [content, setContent] = useState<string>('');
    const [metadata, setMetadata] = useState<FileMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when file changes or closes
    useEffect(() => {
        if (!isOpen || !file) {
            setContent('');
            setMetadata(null);
            return;
        }

        const fetchContent = async () => {
            setIsLoading(true);
            try {
                // Only fetch for text-based files
                const isTextFile = /\.(md|markdown|txt|json|yml|yaml|ts|tsx|js|jsx)$/i.test(
                    file.path
                );
                if (!isTextFile) {
                    setContent('Binary or unsupported file type');
                    setMetadata(null);
                    setIsLoading(false);
                    return;
                }

                const fileContent = await invokeReadFile(file.path);

                // Parse frontmatter if it exists
                if (fileContent.startsWith('---')) {
                    const match = fileContent.match(/^---\n([\s\S]*?)\n---/);
                    if (match) {
                        try {
                            const parsed = yaml.load(match[1]) as FileMetadata;
                            setMetadata(parsed);
                            // Remove frontmatter from content preview
                            const bodyContent = fileContent
                                .slice(match[0].length)
                                .trim();
                            setContent(bodyContent); // Show full content
                        } catch (e) {
                            console.warn('Failed to parse frontmatter', e);
                            setMetadata(null);
                            setContent(fileContent);
                        }
                    } else {
                        setMetadata(null);
                        setContent(fileContent);
                    }
                } else {
                    setMetadata(null);
                    setContent(fileContent);
                }
            } catch (error) {
                console.error('Failed to read file for preview', error);
                setContent('Error loading preview');
            } finally {
                setIsLoading(false);
            }
        };

        fetchContent();
    }, [isOpen, file]);

    // Calculate position
    const [position, setPosition] = useState<{ top: number; left: number }>({
        top: 0,
        left: 0,
    });
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!anchorRect) return;

        const calculatePosition = () => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const POPOVER_HEIGHT = placement === 'top' ? 400 : 500;
            const POPOVER_WIDTH = placement === 'top' ? 400 : 500;
            const MARGIN = 10;
            const VIEWPORT_MARGIN = 16;

            let top = 0;
            let left = 0;

            if (placement === 'right') {
                top = anchorRect.top + anchorRect.height / 2 - POPOVER_HEIGHT / 2;
                left = anchorRect.right + MARGIN;
            } else if (placement === 'top') {
                // Position above the anchor, centered horizontally
                top = anchorRect.top - POPOVER_HEIGHT - MARGIN;
                left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2;
            }

            // --- Boundary Constraints ---

            // Vertical Overflow Check
            if (placement === 'top') {
                // If top placement causes top overflow, consider flipping to bottom (if implementing full Popper.js logic)
                // For now, just ensure it doesn't go off-screen top.
                if (top < VIEWPORT_MARGIN) {
                    // If it doesn't fit on top, try anchoring to bottom of viewport?
                    // Or just clamp to margin?
                    // If we clamp to margin, it might cover the card.
                    // Let's just clamp for now, or maybe push it down if it's too high.
                    top = VIEWPORT_MARGIN;
                }

                // If scrolling down, might need to check bottom?
                // if (top + POPOVER_HEIGHT > viewportHeight - VIEWPORT_MARGIN) ...
            } else {
                // Right placement logic (existing)
                if (top + POPOVER_HEIGHT > viewportHeight - VIEWPORT_MARGIN) {
                    top = viewportHeight - POPOVER_HEIGHT - VIEWPORT_MARGIN;
                }
                if (top < VIEWPORT_MARGIN) {
                    top = VIEWPORT_MARGIN;
                }
            }

            // Horizontal Overflow Check
            if (left + POPOVER_WIDTH > viewportWidth - VIEWPORT_MARGIN) {
                left = viewportWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
            }
            if (left < VIEWPORT_MARGIN) {
                left = VIEWPORT_MARGIN;
            }

            setPosition({ top, left });
        };

        calculatePosition();
    }, [anchorRect, placement]);

    if (!anchorRect) return null;

    const bgColor =
        colorMode === 'light'
            ? 'rgba(255, 255, 255, 0.95)'
            : 'rgba(20, 20, 25, 0.95)';
    const borderColor =
        colorMode === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    return (
        <Portal>
            <AnimatePresence>
                {isOpen && file && (
                    <MotionBox
                        ref={popoverRef}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        initial={{ opacity: 0, x: placement === 'right' ? -10 : 0, y: placement === 'top' ? 10 : 0, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{
                            opacity: 0,
                            scale: 0.95,
                            transition: { duration: 0.1 },
                        }}
                        transition={{
                            duration: 0.2,
                            ease: 'easeOut'
                        }}
                        position="fixed"
                        top={`${position.top}px`}
                        left={`${position.left}px`}
                        width={`${placement === 'top' ? 400 : 500}px`}
                        height={`${placement === 'top' ? 400 : 500}px`}
                        zIndex={9999}
                        borderRadius="xl"
                        overflow="hidden"
                        css={{
                            backdropFilter: 'blur(16px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                            border: `1px solid ${borderColor}`,
                        }}
                        bg={bgColor}
                    >
                        <VStack align="stretch" gap={0} h="100%">
                            {/* Content Preview */}
                            <Box
                                px={4}
                                pb={4}
                                pt={0}
                                flex="1"
                                overflowY="auto"
                                overflowX="hidden"
                            >
                                {isLoading ? (
                                    <HStack justify="center" py={10}>
                                        <Spinner size="md" color="blue.500" />
                                    </HStack>
                                ) : (
                                    <ResourceMarkdownContent
                                        resource={{
                                            name: file.name,
                                            path: file.path,
                                            // Mocking ResourceFile properties needed for display
                                            frontMatter: metadata || undefined,
                                        }}
                                        content={content}
                                        viewMode="preview"
                                        onResolveInternalPath={() => ''} // Disable link navigation in preview
                                    />
                                )}
                            </Box>
                        </VStack>
                    </MotionBox>
                )}
            </AnimatePresence>
        </Portal>
    );
}
