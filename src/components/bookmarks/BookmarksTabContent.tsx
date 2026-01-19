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
} from '@chakra-ui/react';
import { LuBookmark, LuFolder, LuChevronDown, LuChevronRight, LuTrash2 } from 'react-icons/lu';
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
            <Flex align="center" justify="space-between" mb={6} py={2}>
                <HStack gap={3}>
                    <Icon as={LuBookmark} boxSize={6} color="blue.500" />
                    <VStack align="start" gap={0}>
                        <Text fontSize="xl" fontWeight="bold">Bookmarks</Text>
                        <Text fontSize="sm" color="gray.500">
                            {bookmarksLoading ? 'Loading...' : `${totalBookmarks} bookmarked file${totalBookmarks !== 1 ? 's' : ''}`}
                        </Text>
                    </VStack>
                </HStack>
            </Flex>

            {!bookmarksLoading && bookmarks.items.length === 0 ? (
                <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    h="300px"
                    color="gray.500"
                    gap={4}
                >
                    <Icon as={LuBookmark} boxSize={12} opacity={0.5} />
                    <VStack gap={1}>
                        <Text fontSize="lg" fontWeight="medium">No bookmarks yet</Text>
                        <Text fontSize="sm" color="gray.400">
                            Right-click a file in the Notebook to add it to your bookmarks
                        </Text>
                    </VStack>
                </Flex>
            ) : (
                <Box mt={6}>
                    <BookmarkList
                        items={bookmarks.items}
                        expandedGroups={expandedGroups}
                        onToggleGroup={toggleGroup}
                        onBookmarkClick={handleBookmarkClick}
                        onContextMenu={handleContextMenu}
                        colorMode={colorMode}
                        level={0}
                    />
                </Box>
            )}

            {/* Context Menu */}
            {contextMenu.isOpen && contextMenu.bookmark && (
                <Portal>
                    <Menu.Root open={contextMenu.isOpen} onOpenChange={({ open }) => !open && closeContextMenu()}>
                        <Menu.Positioner>
                            <Menu.Content
                                minW="180px"
                                borderWidth="1px"
                                borderRadius="lg"
                                css={{
                                    background: 'rgba(255, 255, 255, 0.65)',
                                    backdropFilter: 'blur(20px) saturate(180%)',
                                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                    borderColor: 'rgba(0, 0, 0, 0.08)',
                                    boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.1)',
                                    _dark: {
                                        background: 'rgba(20, 20, 25, 0.8)',
                                        borderColor: 'rgba(255, 255, 255, 0.15)',
                                        boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                                    },
                                }}
                                style={{
                                    position: 'fixed',
                                    left: `${contextMenu.x}px`,
                                    top: `${contextMenu.y}px`,
                                }}
                            >
                                <Menu.Item value="remove" onSelect={handleRemoveBookmark}>
                                    <HStack gap={2} width="100%">
                                        <Icon>
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
}

function BookmarkList({
    items,
    expandedGroups,
    onToggleGroup,
    onBookmarkClick,
    onContextMenu,
    colorMode,
    level,
}: BookmarkListProps) {
    return (
        <VStack align="stretch" gap={1} pl={level > 0 ? 6 : 0}>
            {items.map((item, index) => {
                if (item.type === 'file') {
                    return (
                        <BookmarkFileItem
                            key={`${item.path}-${index}`}
                            bookmark={item}
                            onClick={() => onBookmarkClick(item)}
                            onContextMenu={(e) => onContextMenu(e, item)}
                            colorMode={colorMode}
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
                        />
                    );
                }
            })}
        </VStack>
    );
}

// File bookmark item
interface BookmarkFileItemProps {
    bookmark: BookmarkFile;
    onClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    colorMode: string;
}

function BookmarkFileItem({
    bookmark,
    onClick,
    onContextMenu,
    colorMode,
}: BookmarkFileItemProps) {
    // Determine icon based on file extension
    const getIcon = () => {
        if (bookmark.path.endsWith('.mmd') || bookmark.path.endsWith('.mermaid')) {
            return BsDiagram2;
        }
        return AiOutlineFileText;
    };

    const hoverBg = colorMode === 'light' ? 'gray.50' : 'whiteAlpha.100';
    const borderColor = colorMode === 'light' ? 'gray.200' : 'whiteAlpha.200';

    return (
        <HStack
            py={3}
            px={4}
            cursor="pointer"
            onClick={onClick}
            onContextMenu={onContextMenu}
            bg="transparent"
            _hover={{ bg: hoverBg }}
            borderRadius="lg"
            borderWidth="1px"
            borderColor={borderColor}
            gap={3}
            transition="all 0.15s"
        >
            <Icon
                as={getIcon()}
                color="blue.500"
                boxSize={5}
                flexShrink={0}
            />
            <VStack align="start" gap={0} flex={1} overflow="hidden">
                <Text fontSize="sm" fontWeight="medium" truncate w="100%">
                    {bookmark.title}
                </Text>
                <Text fontSize="xs" color="gray.500" truncate w="100%">
                    {bookmark.path}
                </Text>
            </VStack>
        </HStack>
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
}: BookmarkGroupItemProps) {
    const hoverBg = colorMode === 'light' ? 'gray.50' : 'whiteAlpha.100';
    const borderColor = colorMode === 'light' ? 'gray.200' : 'whiteAlpha.200';

    return (
        <Box>
            <HStack
                py={3}
                px={4}
                cursor="pointer"
                onClick={onToggle}
                bg="transparent"
                _hover={{ bg: hoverBg }}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={borderColor}
                gap={3}
                transition="all 0.15s"
            >
                <Icon
                    as={isExpanded ? LuChevronDown : LuChevronRight}
                    color="gray.500"
                    boxSize={4}
                    flexShrink={0}
                />
                <Icon as={LuFolder} color="blue.400" boxSize={5} flexShrink={0} />
                <Text fontSize="sm" fontWeight="medium" flex={1}>
                    {group.title}
                </Text>
                <Text fontSize="xs" color="gray.500">
                    {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                </Text>
            </HStack>

            {isExpanded && group.items.length > 0 && (
                <Box mt={2}>
                    <BookmarkList
                        items={group.items}
                        expandedGroups={expandedGroups}
                        onToggleGroup={onToggleGroup}
                        onBookmarkClick={onBookmarkClick}
                        onContextMenu={onContextMenu}
                        colorMode={colorMode}
                        level={level + 1}
                    />
                </Box>
            )}
        </Box>
    );
}
