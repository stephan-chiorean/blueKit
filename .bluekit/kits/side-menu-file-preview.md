---
type: kit
description: "Implementation of a file preview popover that appears on hover in the side menu"
tags: ["ui", "file-preview", "popover", "hover"]
---

# Side Menu File Preview

This kit captures the implementation of a file preview feature that shows a popover with file content when hovering over file items in the navigation tree (or other lists).

## Components

### FilePreviewPopover.tsx

The main component that renders the popover.

```tsx
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
                if (top < VIEWPORT_MARGIN) {
                    top = VIEWPORT_MARGIN;
                }
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
```

## Hook

### useSmartHover.ts

A hook to manage hover state with delays and grace periods, preventing accidental triggers and premature closing.

```ts
import { useState, useRef, useCallback } from 'react';

export interface SmartHoverOptions<T> {
    initialDelay?: number;
    smartDelay?: number;
    gracePeriod?: number;
    shouldEnter?: (item: T) => boolean;
    placement?: 'top' | 'right'; // Added to determine distinct exit direction
}

export function useSmartHover<T>(options: SmartHoverOptions<T> = {}) {
    const {
        initialDelay = 600,
        smartDelay = 50,
        gracePeriod = 500,
        shouldEnter = () => true,
        placement = 'right',
    } = options;

    const [hoveredItem, setHoveredItem] = useState<T | null>(null);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isPopoverHoveredRef = useRef(false);

    // We use a ref to track the currently hovered item for instant access in event handlers
    // This avoids dependency cycles with useCallback
    const activeItemRef = useRef<T | null>(null);

    const handleMouseEnter = useCallback((item: T, event: React.MouseEvent) => {
        if (!shouldEnter(item)) return;

        // Clear any pending dismissal
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }

        // Clear any pending hover trigger
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        const targetRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

        // Determine delay: fast if already showing something, slow if starting from scratch
        const delay = activeItemRef.current ? smartDelay : initialDelay;

        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem(item);
            setAnchorRect(targetRect);
            activeItemRef.current = item;
        }, delay);
    }, [initialDelay, smartDelay, shouldEnter]);

    const handleMouseLeave = useCallback((event: React.MouseEvent) => {
        // Clear pending open
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        // Determine if we should apply grace period based on exit direction
        let timeToClose = 0; // Default to immediate close

        if (anchorRect) {
            const { clientX, clientY } = event;
            const { top, bottom, left, right } = anchorRect;

            // Buffer to account for borderline cases
            const BUFFER = 2;

            if (placement === 'top') {
                // If exiting upwards (clientY < top), allow grace period
                if (clientY < top + BUFFER) {
                    timeToClose = gracePeriod;
                }
            } else if (placement === 'right') {
                // If exiting rightwards (clientX > right), allow grace period
                if (clientX > right - BUFFER) {
                    timeToClose = gracePeriod;
                }
            }
        } else {
            // Fallback if no anchor rect (shouldn't happen if open)
            timeToClose = 0;
        }


        // Start grace period for close
        dismissTimeoutRef.current = setTimeout(() => {
            if (!isPopoverHoveredRef.current) {
                setHoveredItem(null);
                setAnchorRect(null);
                activeItemRef.current = null;
            }
        }, timeToClose);
    }, [gracePeriod, anchorRect, placement]);

    const handlePopoverMouseEnter = useCallback(() => {
        isPopoverHoveredRef.current = true;
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }
    }, []);

    const handlePopoverMouseLeave = useCallback(() => {
        isPopoverHoveredRef.current = false;
        dismissTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
            setAnchorRect(null);
            activeItemRef.current = null;
        }, gracePeriod);
    }, [gracePeriod]);

    return {
        hoveredItem,
        anchorRect,
        handleMouseEnter,
        handleMouseLeave,
        handlePopoverMouseEnter,
        handlePopoverMouseLeave
    };
}
```

## Usage Example

Integration in `NotebookTree.tsx`.

### 1. Hook Setup

```tsx
import { useSmartHover } from '../../hooks/useSmartHover';
import FilePreviewPopover from './FilePreviewPopover';

// ... inside component

    // File Preview Popover State (via hook)
    const {
        hoveredItem: hoveredNode,
        anchorRect,
        handleMouseEnter: handleNodeMouseEnterBase,
        handleMouseLeave: handleNodeMouseLeave,
        handlePopoverMouseEnter,
        handlePopoverMouseLeave
    } = useSmartHover<FileTreeNode>({
        initialDelay: 600,
        smartDelay: 50,
        gracePeriod: 500
    });

    const handleNodeMouseEnter = (node: FileTreeNode, event: React.MouseEvent) => {
        if (!node.isFolder) {
            handleNodeMouseEnterBase(node, event);
        }
    };
```

### 2. Event Handlers

Pass event handlers to the list items (nodes).

```tsx
<TreeNode
    // ...
    onNodeMouseEnter={handleNodeMouseEnter}
    onNodeMouseLeave={handleNodeMouseLeave}
/>
```

Inside `TreeNode`:

```tsx
<HStack
    // ...
    onMouseEnter={(e) => onNodeMouseEnter(node, e)}
    onMouseLeave={(e) => onNodeMouseLeave(e)}
>
```

### 3. Rendering Popover

Render the popover at the root of the component (or via React Portal).

```tsx
{hoveredNode && anchorRect && (
    <FilePreviewPopover
        file={hoveredNode}
        anchorRect={anchorRect}
        isOpen={!!hoveredNode}
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
    />
)}
```
