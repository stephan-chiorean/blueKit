import {
    Box,
    Flex,
    Text,
    Icon,
    HStack,
    Badge,
    IconButton,
    Menu,
    Checkbox,
} from "@chakra-ui/react";
import { MdFolder, MdMoreVert } from "react-icons/md";
import { LuBookOpen, LuPackage } from "react-icons/lu";
import { ArtifactFile, ArtifactFolder } from "@/ipc";
import { Task } from "@/types/task";
import { ReactNode, useEffect, useState } from "react";
import { useColorMode } from "@/shared/contexts/ColorModeContext";
import { getPriorityIcon, getPriorityColorPalette, getTypeIcon, getTypeColorPalette, getTypeLabel } from "@/shared/utils/taskUtils";

export type ElegantListItem = ArtifactFile | ArtifactFolder | Task;

interface ElegantListProps {
    items: ElegantListItem[];
    onItemClick: (item: ElegantListItem) => void;
    onItemContextMenu?: (e: React.MouseEvent, item: ElegantListItem) => void;
    getIcon?: (item: ElegantListItem) => React.ElementType;
    renderActions?: (item: ElegantListItem) => ReactNode;
    renderInlineActions?: (item: ElegantListItem) => ReactNode; // New: render buttons directly on row
    actionsWidth?: string | number;

    // Selection state
    selectable?: boolean;
    selectedIds?: Set<string>;
    onToggleSelection?: (item: ElegantListItem) => void;
    onSelectionChange?: (ids: Set<string>) => void;
    getItemId?: (item: ElegantListItem) => string;
    type?: 'kit' | 'folder' | 'walkthrough' | 'task';

    // Drag-and-drop support
    onItemMouseDown?: (item: ElegantListItem, e: React.MouseEvent, index: number) => void;
    getItemStyle?: (item: ElegantListItem, index: number) => React.CSSProperties;
    getItemProps?: (item: ElegantListItem, index: number) => Record<string, any>;
    isDragging?: boolean; // Disable hover effects during drag operations
}

export function ElegantList({
    items,
    onItemClick,
    onItemContextMenu,
    getIcon,
    renderActions,
    renderInlineActions,
    actionsWidth,
    selectable,
    selectedIds,
    onToggleSelection,
    onSelectionChange,
    getItemId,
    type,
    onItemMouseDown,
    getItemStyle,
    getItemProps,
    isDragging = false,
}: ElegantListProps) {
    const { colorMode } = useColorMode();

    // Track hovered item explicitly to avoid stuck hover states during drag
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    // Clear hover state when drag starts or ends to prevent stuck states
    useEffect(() => {
        if (isDragging) {
            setHoveredItemId(null);
        }
    }, [isDragging]);

    const hoverBg = colorMode === "light" ? "blackAlpha.50" : "whiteAlpha.100";
    const selectedBg = colorMode === "light" ? "blue.50" : "blue.900/20";
    const borderColor = colorMode === "light" ? "border.subtle" : "whiteAlpha.100";
    const folderIconColor = colorMode === "light" ? "blue.500" : "blue.400";
    const fileIconColor = colorMode === "light" ? "blue.500" : "blue.400";
    const walkthroughIconColor = colorMode === "light" ? "orange.500" : "orange.400";

    const getItemPath = (item: ElegantListItem) => getItemId ? getItemId(item) : ('path' in item ? item.path : (item as any).id);

    // Helper to determine item type
    const isFolder = (item: ElegantListItem): item is ArtifactFolder => !('frontMatter' in item) && !('priority' in item);
    const isTask = (item: ElegantListItem): item is Task => 'priority' in item && 'status' in item;
    const isArtifact = (item: ElegantListItem): item is ArtifactFile => 'frontMatter' in item;

    // Calculate selection state for header
    const selectableItems = items.filter(item => !isFolder(item)); // Filter out folders
    const allSelected = selectableItems.length > 0 && selectableItems.every(item => selectedIds?.has(getItemPath(item)));

    const handleSelectAll = () => {
        if (!onSelectionChange) return;

        if (allSelected) {
            // Clear all
            onSelectionChange(new Set());
        } else {
            // Select all
            const newSet = new Set(selectedIds);
            selectableItems.forEach(item => newSet.add(getItemPath(item)));
            onSelectionChange(newSet);
        }
    };

    const handleItemToggle = (item: ElegantListItem) => {
        if (onSelectionChange && selectedIds) {
            const path = getItemPath(item);
            const newSet = new Set(selectedIds);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            onSelectionChange(newSet);
        } else {
            onToggleSelection?.(item);
        }
    };

    if (items.length === 0) {
        return null;
    }

    return (
        <Box width="100%">
            {/* List Header */}
            <Flex
                px={4}
                py={2}
                borderBottomWidth="1px"
                borderColor={borderColor}
                color="text.muted"
                fontSize="xs"
                fontWeight="medium"
                textTransform="uppercase"
                letterSpacing="wider"
            >
                <Box flex="1">Name</Box>
                <Box width="200px" display={{ base: "none", md: "block" }}>
                    Tags
                </Box>
                <Box width="100px" display={{ base: "none", sm: "block" }}>
                    Updated
                </Box>
                <Box width={actionsWidth || (renderInlineActions ? "auto" : "40px")}>
                    {renderInlineActions && "Actions"}
                </Box>
                {/* Header Checkbox */}
                {selectable && (
                    <Box width="48px" display="flex" alignItems="center" justifyContent="center">
                        <Checkbox.Root
                            checked={allSelected}
                            onCheckedChange={handleSelectAll}
                            size="md"
                        >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control
                                _checked={{
                                    bg: "primary.500",
                                    borderColor: "primary.500",
                                }}
                            >
                                {/* No Checkbox.Indicator - solid fill only */}
                            </Checkbox.Control>
                        </Checkbox.Root>
                    </Box>
                )}
            </Flex>

            {/* List Items */}
            <Box>
                {items.map((item, index) => {
                    // Use path as key
                    const path = getItemId ? getItemId(item) : ('path' in item ? item.path : (item as any).id);
                    const isSelected = selectedIds?.has(path);

                    // Determine type for icon/styling
                    const isItemFolder = isFolder(item);
                    const isItemTask = isTask(item);
                    // Items are selectable if the list is selectable AND it's not a folder
                    const canSelect = selectable && !isItemFolder;

                    let ItemIcon: React.ElementType = MdFolder;
                    let itemIconColor = folderIconColor;

                    if (isItemTask) {
                        // For tasks, use priority icon
                        const task = item as Task;
                        const priorityIcon = getPriorityIcon(task.priority);
                        if (priorityIcon) {
                            ItemIcon = priorityIcon.icon;
                            itemIconColor = priorityIcon.color;
                        }
                    } else if (!isItemFolder) {
                        const file = item as ArtifactFile;
                        if (file.frontMatter?.type === 'walkthrough') {
                            ItemIcon = LuBookOpen;
                            itemIconColor = walkthroughIconColor;
                        } else {
                            ItemIcon = LuPackage;
                            itemIconColor = fileIconColor;
                        }
                    }

                    if (getIcon) {
                        ItemIcon = getIcon(item);
                    }

                    // Safely access properties based on type
                    let tags: string[] = [];

                    if (isItemTask) {
                        const task = item as Task;
                        tags = task.tags || [];
                    } else if (isItemFolder) {
                        const folder = item as ArtifactFolder;
                        if ('config' in folder && (folder as any).config?.tags) {
                            tags = (folder as any).config.tags || [];
                        }
                    } else {
                        const file = item as ArtifactFile;
                        tags = file.frontMatter?.tags || [];
                    }

                    let updatedAt: string | number | undefined;
                    if (isItemTask) {
                        const task = item as Task;
                        updatedAt = task.updatedAt;
                    } else if (isItemFolder) {
                        const folder = item as ArtifactFolder;
                        updatedAt = (folder as any).updatedAt || (folder as any).config?.updatedAt;
                    } else {
                        const file = item as any; // Cast to any to access potentially missing 'stats'
                        updatedAt = file.stats?.mtimeMs;
                    }

                    let dateStr = '-';
                    if (updatedAt) {
                        try {
                            dateStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(updatedAt));
                        } catch (e) { }
                    }

                    const description = isItemTask
                        ? (item as Task).description
                        : isItemFolder
                            ? ((item as any).description || (item as any).config?.description || '')
                            : (item as ArtifactFile).frontMatter?.description;

                    // Get custom item style and props for drag-and-drop
                    const customStyle = getItemStyle ? getItemStyle(item, index) : {};
                    const customProps = getItemProps ? getItemProps(item, index) : {};

                    // Determine background: selected takes priority, then hover (if not dragging)
                    const isHovered = hoveredItemId === path && !isDragging;
                    const rowBg = isSelected ? selectedBg : (isHovered ? hoverBg : "transparent");

                    return (
                        <Flex
                            key={path}
                            align="center"
                            px={4}
                            py={3}
                            cursor="pointer"
                            borderBottomWidth="1px"
                            borderColor={borderColor}
                            bg={rowBg}
                            onMouseEnter={() => {
                                if (!isDragging) {
                                    setHoveredItemId(path);
                                }
                            }}
                            onMouseLeave={() => {
                                setHoveredItemId(null);
                            }}
                            onClick={() => {
                                // If clicking the row toggles selection (optional UX choice), or just opens the item
                                // Usually clicking the row opens the item. Clicking checkbox toggles selection.
                                onItemClick(item);
                            }}
                            onContextMenu={(e) => onItemContextMenu?.(e, item)}
                            onMouseDown={(e) => onItemMouseDown?.(item, e, index)}
                            style={customStyle}
                            {...customProps}
                        >

                            {/* Name Column */}
                            <Flex flex="1" align="center" gap={3} minW={0} pr={4}>
                                <Icon as={ItemIcon} boxSize={5} color={itemIconColor} flexShrink={0} />
                                <Box minW={0} overflow="hidden">
                                    <HStack gap={2} align="center">
                                        <Text
                                            fontWeight="medium"
                                            fontSize="sm"
                                            color="fg"
                                            truncate
                                        >
                                            {isItemTask
                                                ? (item as Task).title
                                                : isItemFolder
                                                    ? item.name
                                                    : ((item as ArtifactFile).frontMatter?.alias || item.name)}
                                        </Text>
                                        {/* Task-specific badges */}
                                        {isItemTask && (() => {
                                            const task = item as Task;
                                            const complexityLabel = task.complexity ?
                                                (task.complexity === 'easy' ? 'Easy' : task.complexity === 'hard' ? 'Hard' : 'Deep Dive') : null;
                                            const typeLabel = task.type ? getTypeLabel(task.type) : null;
                                            const typeIconData = task.type ? getTypeIcon(task.type) : null;

                                            return (
                                                <HStack gap={1} flexShrink={0}>
                                                    {complexityLabel && (
                                                        <Badge size="sm" variant="outline" colorPalette="gray">
                                                            {complexityLabel}
                                                        </Badge>
                                                    )}
                                                    {typeLabel && typeIconData && (
                                                        <Badge size="sm" variant="outline" colorPalette={getTypeColorPalette(task.type!)}>
                                                            <HStack gap={1}>
                                                                <Icon as={typeIconData.icon} color={typeIconData.color} boxSize={3} />
                                                                <Text>{typeLabel}</Text>
                                                            </HStack>
                                                        </Badge>
                                                    )}
                                                </HStack>
                                            );
                                        })()}
                                    </HStack>
                                    {description && (
                                        <Text fontSize="xs" color="text.muted" truncate>
                                            {description}
                                        </Text>
                                    )}
                                </Box>
                            </Flex>

                            {/* Tags Column */}
                            <Box width="200px" display={{ base: "none", md: "block" }}>
                                <HStack gap={1} flexWrap="nowrap" overflow="hidden">
                                    {tags?.slice(0, 3).map((tag) => (
                                        <Badge
                                            key={tag}
                                            size="sm"
                                            variant="subtle"
                                            colorPalette={isItemTask ? getPriorityColorPalette((item as Task).priority) : "gray"}
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                    {tags && tags.length > 3 && (
                                        <Text fontSize="xs" color="text.muted">+{tags.length - 3}</Text>
                                    )}
                                </HStack>
                            </Box>

                            {/* Updated Column */}
                            <Box width="100px" display={{ base: "none", sm: "block" }}>
                                <Text fontSize="xs" color="text.muted">
                                    {dateStr}
                                </Text>
                            </Box>

                            {/* Actions Column */}
                            <Box width={actionsWidth || (renderInlineActions ? "auto" : "40px")} onClick={(e) => e.stopPropagation()}>
                                {/* Inline actions (buttons shown directly on row) */}
                                {renderInlineActions ? (
                                    <HStack gap={2}>
                                        {renderInlineActions(item)}
                                    </HStack>
                                ) : renderActions && (!selectable || isItemFolder) ? (
                                    /* Menu actions (3-dot dropdown) */
                                    <Menu.Root positioning={{ placement: "bottom-end" }}>
                                        <Menu.Trigger asChild>
                                            <IconButton
                                                variant="ghost"
                                                size="sm"
                                                aria-label="Actions"
                                                color="text.muted"
                                                _hover={{ color: "fg", bg: "bg.subtle" }}
                                            >
                                                <MdMoreVert />
                                            </IconButton>
                                        </Menu.Trigger>
                                        <Menu.Positioner>
                                            <Menu.Content>
                                                {renderActions(item)}
                                            </Menu.Content>
                                        </Menu.Positioner>
                                    </Menu.Root>
                                ) : null}
                            </Box>

                            {/* Checkbox Column - Moved to Right */}
                            {selectable && (
                                <Box width="48px" onClick={(e) => e.stopPropagation()} display="flex" alignItems="center" justifyContent="center">
                                    {canSelect && (
                                        <Checkbox.Root
                                            checked={isSelected}
                                            onCheckedChange={() => handleItemToggle(item)}
                                            size="md"
                                        >
                                            <Checkbox.HiddenInput />
                                            <Checkbox.Control
                                                _checked={{
                                                    bg: "primary.500",
                                                    borderColor: "primary.500",
                                                }}
                                            >
                                                {/* No Checkbox.Indicator - solid fill only */}
                                            </Checkbox.Control>
                                        </Checkbox.Root>
                                    )}
                                </Box>
                            )}
                        </Flex>
                    );
                })}
            </Box>
        </Box>
    );
}

