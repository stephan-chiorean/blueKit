import {
    Box,
    Flex,
    Text,
    Icon,
    HStack,
    Badge,
    IconButton,
    Menu,
} from "@chakra-ui/react";
import { MdFolder, MdMoreVert } from "react-icons/md";
import { LuFileText, LuBookOpen, LuPackage } from "react-icons/lu";
import { ArtifactFile, ArtifactFolder } from "@/ipc";
import { ReactNode } from "react";
import { useColorMode } from "@/shared/contexts/ColorModeContext";

export type ElegantListItem = ArtifactFile | ArtifactFolder;

interface ElegantListProps {
    items: ElegantListItem[];
    onItemClick: (item: ElegantListItem) => void;
    onItemContextMenu?: (e: React.MouseEvent, item: ElegantListItem) => void;
    getIcon?: (item: ElegantListItem) => React.ElementType;
    renderActions?: (item: ElegantListItem) => ReactNode;

    // Selection state
    selectedIds?: Set<string>;
    onToggleSelection?: (item: ElegantListItem) => void;
    type?: 'kit' | 'folder' | 'walkthrough';
}

export function ElegantList({
    items,
    onItemClick,
    onItemContextMenu,
    getIcon,
    renderActions,
    selectedIds,
    onToggleSelection,
    type,
}: ElegantListProps) {
    const { colorMode } = useColorMode();

    const hoverBg = colorMode === "light" ? "blackAlpha.50" : "whiteAlpha.100";
    const selectedBg = colorMode === "light" ? "blue.50" : "blue.900/20";
    const borderColor = colorMode === "light" ? "border.subtle" : "whiteAlpha.100";
    const folderIconColor = colorMode === "light" ? "blue.500" : "blue.400";
    const fileIconColor = colorMode === "light" ? "blue.500" : "blue.400";
    const walkthroughIconColor = colorMode === "light" ? "orange.500" : "orange.400";

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
                <Box width="40px"></Box>
            </Flex>

            {/* List Items */}
            <Box>
                {items.map((item) => {
                    // Use path as key
                    const path = 'path' in item ? item.path : (item as any).id;
                    const isSelected = selectedIds?.has(path);

                    // Determine type for icon/styling
                    const isItemFolder = !('frontMatter' in item);

                    let ItemIcon = MdFolder;
                    let itemIconColor = folderIconColor;

                    if (!isItemFolder) {
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

                    if (isItemFolder) {
                        const folder = item as ArtifactFolder;
                        if ('config' in folder && (folder as any).config?.tags) {
                            tags = (folder as any).config.tags || [];
                        }
                    } else {
                        const file = item as ArtifactFile;
                        tags = file.frontMatter?.tags || [];
                    }

                    let updatedAt: string | number | undefined;
                    if (isItemFolder) {
                        const folder = item as ArtifactFolder;
                        updatedAt = (folder as any).updatedAt || (folder as any).config?.updatedAt;
                    } else {
                        const file = item as ArtifactFile;
                        updatedAt = file.stats?.mtimeMs;
                    }

                    let dateStr = '-';
                    if (updatedAt) {
                        try {
                            dateStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(updatedAt));
                        } catch (e) { }
                    }

                    const description = isItemFolder
                        ? ((item as any).description || (item as any).config?.description || '')
                        : (item as ArtifactFile).frontMatter?.description;

                    return (
                        <Flex
                            key={path}
                            align="center"
                            px={4}
                            py={3}
                            cursor="pointer"
                            borderBottomWidth="1px"
                            borderColor={borderColor}
                            bg={isSelected ? selectedBg : "transparent"}
                            _hover={{
                                bg: isSelected ? selectedBg : hoverBg,
                            }}
                            onClick={(e) => {
                                onItemClick(item);
                            }}
                            onContextMenu={(e) => onItemContextMenu?.(e, item)}
                        >
                            {/* Name Column */}
                            <Flex flex="1" align="center" gap={3} minW={0} pr={4}>
                                <Icon as={ItemIcon} boxSize={5} color={itemIconColor} flexShrink={0} />
                                <Box minW={0} overflow="hidden">
                                    <Text
                                        fontWeight="medium"
                                        fontSize="sm"
                                        color="fg"
                                        truncate
                                    >
                                        {isItemFolder 
                                            ? item.name 
                                            : ((item as ArtifactFile).frontMatter?.alias || item.name)}
                                    </Text>
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
                                        <Badge key={tag} size="sm" variant="subtle" colorPalette="gray">
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
                            <Box width="40px" onClick={(e) => e.stopPropagation()}>
                                {renderActions ? (
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
                        </Flex>
                    );
                })}
            </Box>
        </Box>
    );
}
