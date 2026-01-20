import { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Flex,
    Text,
    Icon,
    HStack,
    VStack,
    Menu,
    Portal,
    Badge,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuFolder, LuChevronDown, LuChevronRight, LuTrash2 } from 'react-icons/lu';
import { FaBookmark } from 'react-icons/fa';
import { AiOutlineFileText } from 'react-icons/ai';
import { BsDiagram2 } from 'react-icons/bs';
import { listen } from '@tauri-apps/api/event';

import { useColorMode } from '../../contexts/ColorModeContext';
import { invokeGetBookmarks, invokeRemoveBookmark, invokeReconcileBookmarks } from '../../ipc';
import { BookmarksData, BookmarkItem, BookmarkFile, BookmarkGroup } from '../../ipc/types';
import { FileTreeNode } from '../../ipc/fileTree';
import { toaster } from '../ui/toaster';

interface BookmarksTabContentProps {
    projectPath: string;
    onViewBookmark: (node: FileTreeNode) => void;
}

export default function BookmarksTabContent({
    projectPath,
    onViewBookmark,
}: BookmarksTabContentProps) {
    const [bookmarks, setBookmarks] = useState<BookmarksData>({ items: [] });
    const [bookmarksLoading, setBookmarksLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [selectedBookmark, setSelectedBookmark] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        bookmark: BookmarkFile | null;
    }>({ isOpen: false, x: 0, y: 0, bookmark: null });
    const { colorMode } = useColorMode();

    // Load bookmarks
    const loadBookmarks = useCallback(async () => {
        try {
            setBookmarksLoading(true);
            const data = await invokeGetBookmarks(projectPath);
            setBookmarks(data);
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to load bookmarks',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setBookmarksLoading(false);
        }
    }, [projectPath]);

    // Reconcile bookmarks (remove stale entries)
    const reconcileAndLoad = useCallback(async () => {
        try {
            setBookmarksLoading(true);
            const data = await invokeReconcileBookmarks(projectPath);
            setBookmarks(data);
        } catch (error) {
            console.error('Failed to reconcile bookmarks:', error);
            // Fall back to just loading
            loadBookmarks();
        } finally {
            setBookmarksLoading(false);
        }
    }, [projectPath, loadBookmarks]);

    // Initial load and reconcile
    useEffect(() => {
        reconcileAndLoad();
    }, [reconcileAndLoad]);

    // Listen for file changes to refresh bookmarks
    useEffect(() => {
        let unlisten: (() => void) | null = null;

        const setupListener = async () => {
            // Generate the event name (must match the Rust code)
            const sanitizedPath = projectPath
                .replace(/\//g, '_')
                .replace(/\\/g, '_')
                .replace(/:/g, '_')
                .replace(/\./g, '_')
                .replace(/ /g, '_');
            const eventName = `project-artifacts-changed-${sanitizedPath}`;

            unlisten = await listen<string[]>(eventName, (event) => {
                // Check if bookmarks.json was changed
                const changedPaths = event.payload;
                const bookmarksChanged = changedPaths.some(p => p.endsWith('bookmarks.json'));
                if (bookmarksChanged) {
                    loadBookmarks();
                }
            });
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, [projectPath, loadBookmarks]);

    // Toggle group expansion
    const toggleGroup = (groupTitle: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupTitle)) {
                next.delete(groupTitle);
            } else {
                next.add(groupTitle);
            }
            return next;
        });
    };

    // Handle bookmark click - convert to FileTreeNode
    const handleBookmarkClick = (bookmark: BookmarkFile) => {
        setSelectedBookmark(bookmark.path);
        const pathParts = bookmark.path.split(/[/\\]/);
        const filename = pathParts[pathParts.length - 1] || bookmark.title;

        const node: FileTreeNode = {
            id: bookmark.path,
            name: filename,
            path: bookmark.path,
            isFolder: false,
            isEssential: false,
        };

        onViewBookmark(node);
    };

    // Handle context menu
    const handleContextMenu = (e: React.MouseEvent, bookmark: BookmarkFile) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            bookmark,
        });
    };

    // Close context menu
    const closeContextMenu = () => {
        setContextMenu({ isOpen: false, x: 0, y: 0, bookmark: null });
    };

    // Handle remove bookmark
    const handleRemoveBookmark = async () => {
        if (!contextMenu.bookmark) return;

        try {
            await invokeRemoveBookmark(projectPath, contextMenu.bookmark.path);
            toaster.create({
                type: 'success',
                title: 'Bookmark removed',
                description: `Removed "${contextMenu.bookmark.title}" from bookmarks`,
            });
            loadBookmarks();
        } catch (error) {
            console.error('Failed to remove bookmark:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to remove bookmark',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
        closeContextMenu();
    };

    // Count total bookmarks
    const countBookmarks = (items: BookmarkItem[]): number => {
        return items.reduce((count, item) => {
            if (item.type === 'file') {
                return count + 1;
            } else {
                return count + countBookmarks(item.items);
            }
        }, 0);
    };

    const totalBookmarks = countBookmarks(bookmarks.items);

    return (
        <Box w="100%" h="100%" p={6} overflow="auto">
            <Flex align="center" justify="space-between" mb={8} py={3}>
                <HStack gap={4}>
                    <Icon as={FaBookmark} boxSize={7} color="orange.400" />
                    <VStack align="start" gap={1}>
                        <Text fontSize="2xl" fontWeight="bold">Bookmarks</Text>
                        <HStack gap={2}>
                            <Text fontSize="sm" color="gray.500">
                                {bookmarksLoading ? 'Loading...' : `${totalBookmarks} bookmarked file${totalBookmarks !== 1 ? 's' : ''}`}
                            </Text>
                            {!bookmarksLoading && totalBookmarks > 0 && (
                                <Badge size="sm" colorPalette="orange" variant="subtle" borderRadius="full">
                                    {totalBookmarks}
                                </Badge>
                            )}
                        </HStack>
                    </VStack>
                </HStack>
            </Flex>

            {!bookmarksLoading && bookmarks.items.length === 0 ? (
                <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    h="400px"
                    gap={5}
                >
                    <Icon as={FaBookmark} boxSize={16} color="orange.400" opacity={0.6} />
                    <VStack gap={2}>
                        <Text fontSize="lg" fontWeight="semibold" color="gray.700" _dark={{ color: 'gray.300' }}>
                            No bookmarks yet
                        </Text>
                        <Text fontSize="sm" color="gray.500" textAlign="center" maxW="300px">
                            Right-click a file in the Notebook to add it to your bookmarks
                        </Text>
                    </VStack>
                </Flex>
            ) : (
                <Box mt={4}>
                    <BookmarkList
                        items={bookmarks.items}
                        expandedGroups={expandedGroups}
                        onToggleGroup={toggleGroup}
                        onBookmarkClick={handleBookmarkClick}
                        onContextMenu={handleContextMenu}
                        colorMode={colorMode}
                        level={0}
                        selectedBookmark={selectedBookmark}
                    />
                </Box>
            )}

            {/* Context Menu */}
            {contextMenu.isOpen && contextMenu.bookmark && (
                <Portal>
                    <Menu.Root open={contextMenu.isOpen} onOpenChange={({ open }) => !open && closeContextMenu()}>
                        <Menu.Positioner>
                            <Menu.Content
                                minW="200px"
                                borderWidth="1px"
                                borderRadius="lg"
                                css={{
                                    background: 'rgba(255, 255, 255, 0.7)',
                                    backdropFilter: 'blur(20px) saturate(180%)',
                                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                    borderColor: 'rgba(251, 146, 60, 0.2)',
                                    boxShadow: '0 4px 16px 0 rgba(251, 146, 60, 0.15)',
                                    _dark: {
                                        background: 'rgba(20, 20, 25, 0.85)',
                                        borderColor: 'rgba(251, 146, 60, 0.3)',
                                        boxShadow: '0 4px 16px 0 rgba(251, 146, 60, 0.2)',
                                    },
                                }}
                                style={{
                                    position: 'fixed',
                                    left: `${contextMenu.x}px`,
                                    top: `${contextMenu.y}px`,
                                }}
                            >
                                <Menu.Item 
                                    value="remove" 
                                    onSelect={handleRemoveBookmark}
                                    css={{
                                        _hover: {
                                            bg: 'rgba(251, 146, 60, 0.1)',
                                        },
                                        _dark: {
                                            _hover: {
                                                bg: 'rgba(251, 146, 60, 0.15)',
                                            },
                                        },
                                    }}
                                >
                                    <HStack gap={2} width="100%">
                                        <Icon color="orange.500">
                                            <LuTrash2 />
                                        </Icon>
                                        <Text fontSize="sm">Remove from Bookmarks</Text>
                                    </HStack>
                                </Menu.Item>
                            </Menu.Content>
                        </Menu.Positioner>
                    </Menu.Root>
                </Portal>
            )}
        </Box>
    );
}

// Recursive bookmark list component
interface BookmarkListProps {
    items: BookmarkItem[];
    expandedGroups: Set<string>;
    onToggleGroup: (title: string) => void;
    onBookmarkClick: (bookmark: BookmarkFile) => void;
    onContextMenu: (e: React.MouseEvent, bookmark: BookmarkFile) => void;
    colorMode: string;
    level: number;
    selectedBookmark?: string | null;
}

function BookmarkList({
    items,
    expandedGroups,
    onToggleGroup,
    onBookmarkClick,
    onContextMenu,
    colorMode,
    level,
    selectedBookmark,
}: BookmarkListProps) {
    return (
        <VStack align="stretch" gap={2} pl={level > 0 ? 8 : 0}>
            {items.map((item, index) => {
                if (item.type === 'file') {
                    return (
                        <BookmarkFileItem
                            key={`${item.path}-${index}`}
                            bookmark={item}
                            onClick={() => onBookmarkClick(item)}
                            onContextMenu={(e) => onContextMenu(e, item)}
                            colorMode={colorMode}
                            isSelected={selectedBookmark === item.path}
                        />
                    );
                } else {
                    return (
                        <BookmarkGroupItem
                            key={`${item.title}-${index}`}
                            group={item}
                            isExpanded={expandedGroups.has(item.title)}
                            onToggle={() => onToggleGroup(item.title)}
                            expandedGroups={expandedGroups}
                            onToggleGroup={onToggleGroup}
                            onBookmarkClick={onBookmarkClick}
                            onContextMenu={onContextMenu}
                            colorMode={colorMode}
                            level={level}
                            selectedBookmark={selectedBookmark}
                        />
                    );
                }
            })}
        </VStack>
    );
}

const MotionBox = motion.create(Box);

// File bookmark item
interface BookmarkFileItemProps {
    bookmark: BookmarkFile;
    onClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    colorMode: string;
    isSelected?: boolean;
}

function BookmarkFileItem({
    bookmark,
    onClick,
    onContextMenu,
    colorMode,
    isSelected = false,
}: BookmarkFileItemProps) {
    // Determine icon based on file extension
    const getIcon = () => {
        if (bookmark.path.endsWith('.mmd') || bookmark.path.endsWith('.mermaid')) {
            return BsDiagram2;
        }
        return AiOutlineFileText;
    };

    const hoverBg = colorMode === 'light' ? 'orange.50' : 'rgba(154, 52, 18, 0.2)';
    const selectedBg = colorMode === 'light' ? 'orange.100' : 'rgba(154, 52, 18, 0.3)';
    const borderColor = colorMode === 'light' 
        ? (isSelected ? 'orange.400' : 'orange.200') 
        : (isSelected ? 'orange.500' : 'rgba(251, 146, 60, 0.3)');
    const hoverBorderColor = colorMode === 'light' ? 'orange.300' : 'rgba(251, 146, 60, 0.4)';

    return (
        <MotionBox
            initial={false}
            animate={{
                scale: isSelected ? 1.02 : 1,
            }}
            transition={{ duration: 0.2 }}
        >
            <HStack
                py={3.5}
                px={4}
                cursor="pointer"
                onClick={onClick}
                onContextMenu={onContextMenu}
                bg={isSelected ? selectedBg : 'transparent'}
                _hover={{ 
                    bg: isSelected ? selectedBg : hoverBg,
                    borderColor: hoverBorderColor,
                    transform: 'translateX(2px)',
                }}
                borderRadius="lg"
                borderWidth={isSelected ? '2px' : '1px'}
                borderColor={borderColor}
                gap={3}
                transition="all 0.2s ease-in-out"
                position="relative"
                boxShadow={isSelected 
                    ? (colorMode === 'light' 
                        ? '0 2px 8px rgba(251, 146, 60, 0.15)' 
                        : '0 2px 8px rgba(251, 146, 60, 0.2)')
                    : 'none'
                }
            >
                <Icon
                    as={getIcon()}
                    color="orange.400"
                    boxSize={5}
                    flexShrink={0}
                />
                <VStack align="start" gap={0.5} flex={1} overflow="hidden">
                    <Text fontSize="sm" fontWeight="semibold" truncate w="100%" color={isSelected ? 'orange.700' : 'inherit'} _dark={{ color: isSelected ? 'orange.300' : 'inherit' }}>
                        {bookmark.title}
                    </Text>
                    <Text fontSize="xs" color="gray.500" truncate w="100%">
                        {bookmark.path}
                    </Text>
                </VStack>
                <Icon
                    as={FaBookmark}
                    color="orange.400"
                    boxSize={3.5}
                    flexShrink={0}
                    opacity={0.8}
                />
            </HStack>
        </MotionBox>
    );
}

// Group bookmark item
interface BookmarkGroupItemProps {
    group: BookmarkGroup;
    isExpanded: boolean;
    onToggle: () => void;
    expandedGroups: Set<string>;
    onToggleGroup: (title: string) => void;
    onBookmarkClick: (bookmark: BookmarkFile) => void;
    onContextMenu: (e: React.MouseEvent, bookmark: BookmarkFile) => void;
    colorMode: string;
    level: number;
    selectedBookmark?: string | null;
}

function BookmarkGroupItem({
    group,
    isExpanded,
    onToggle,
    expandedGroups,
    onToggleGroup,
    onBookmarkClick,
    onContextMenu,
    colorMode,
    level,
    selectedBookmark,
}: BookmarkGroupItemProps) {
    const hoverBg = colorMode === 'light' ? 'orange.50' : 'rgba(154, 52, 18, 0.15)';
    const borderColor = colorMode === 'light' ? 'orange.200' : 'rgba(251, 146, 60, 0.25)';
    const hoverBorderColor = colorMode === 'light' ? 'orange.300' : 'rgba(251, 146, 60, 0.35)';
    
    // Count bookmarks in group recursively
    const countBookmarksInGroup = (items: BookmarkItem[]): number => {
        return items.reduce((count, item) => {
            if (item.type === 'file') {
                return count + 1;
            } else {
                return count + countBookmarksInGroup(item.items);
            }
        }, 0);
    };
    
    const bookmarkCount = countBookmarksInGroup(group.items);

    return (
        <Box>
            <HStack
                py={3.5}
                px={4}
                cursor="pointer"
                onClick={onToggle}
                bg={isExpanded ? (colorMode === 'light' ? 'orange.50' : 'rgba(154, 52, 18, 0.1)') : 'transparent'}
                _hover={{ 
                    bg: hoverBg,
                    borderColor: hoverBorderColor,
                }}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={borderColor}
                gap={3}
                transition="all 0.2s ease-in-out"
                position="relative"
            >
                <Icon
                    as={isExpanded ? LuChevronDown : LuChevronRight}
                    color="orange.500"
                    boxSize={4}
                    flexShrink={0}
                    transition="transform 0.2s"
                    transform={isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
                />
                <Icon as={LuFolder} color="orange.400" boxSize={5} flexShrink={0} />
                <Text fontSize="sm" fontWeight="semibold" flex={1} color={isExpanded ? 'orange.700' : 'inherit'} _dark={{ color: isExpanded ? 'orange.300' : 'inherit' }}>
                    {group.title}
                </Text>
                <Badge 
                    size="sm" 
                    colorPalette="orange" 
                    variant="subtle" 
                    borderRadius="full"
                    fontSize="xs"
                >
                    {bookmarkCount} {bookmarkCount === 1 ? 'item' : 'items'}
                </Badge>
            </HStack>

            <AnimatePresence initial={false}>
                {isExpanded && group.items.length > 0 && (
                    <MotionBox
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                            height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                            opacity: { duration: 0.2, delay: 0.05 }
                        }}
                        style={{ overflow: 'hidden' }}
                        mt={2}
                        ml={level > 0 ? 2 : 0}
                        pl={level > 0 ? 4 : 0}
                        borderLeftWidth={level > 0 ? '2px' : '0'}
                        borderLeftColor={colorMode === 'light' ? 'orange.200' : 'rgba(251, 146, 60, 0.2)'}
                    >
                        <BookmarkList
                            items={group.items}
                            expandedGroups={expandedGroups}
                            onToggleGroup={onToggleGroup}
                            onBookmarkClick={onBookmarkClick}
                            onContextMenu={onContextMenu}
                            colorMode={colorMode}
                            level={level + 1}
                            selectedBookmark={selectedBookmark}
                        />
                    </MotionBox>
                )}
            </AnimatePresence>
        </Box>
    );
}
