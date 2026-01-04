import { useState, useRef, useEffect, ReactNode } from 'react';
import {
    Box,
    Button,
    HStack,
    Icon,
    Input,
    InputGroup,
    Menu,
    Text,
    VStack,
    Spinner,
} from '@chakra-ui/react';
import {
    LuSearch,
    LuCheck,
} from 'react-icons/lu';

export interface SelectorItem {
    id: string;
}

export interface SelectorPopoverProps<T extends SelectorItem> {
    // Data
    items: T[];

    // Trigger button configuration
    triggerIcon: ReactNode;
    triggerLabel: string;
    showArrow?: boolean;
    triggerVariant?: 'outline' | 'solid' | 'ghost' | 'surface';
    triggerColorPalette?: string;

    // Popover content
    popoverTitle: string;
    searchPlaceholder?: string;
    emptyStateMessage?: string;
    noResultsMessage?: string;

    // Item rendering
    renderItem: (item: T, isSelected: boolean) => ReactNode;

    // Search functionality
    filterItem: (item: T, query: string) => boolean;

    // Confirm button
    getConfirmLabel: (selectedCount: number) => string;

    // Callbacks
    onConfirm: (selectedItems: T[]) => void;

    // State
    loading?: boolean;
    disabled?: boolean;
}

export function SelectorPopover<T extends SelectorItem>({
    items,
    triggerIcon,
    triggerLabel,
    showArrow = true,
    triggerVariant = 'solid',
    triggerColorPalette = 'primary',
    popoverTitle,
    searchPlaceholder = 'Search...',
    emptyStateMessage = 'No items found.',
    noResultsMessage = 'No items match your search.',
    renderItem,
    filterItem,
    getConfirmLabel,
    onConfirm,
    loading = false,
    disabled = false,
}: SelectorPopoverProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset state when menu closes
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSelectedItemIds(new Set());
        }
    }, [isOpen]);

    // Focus search input when menu opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const toggleItem = (itemId: string) => {
        setSelectedItemIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const handleConfirm = () => {
        const selectedItems = items.filter(item => selectedItemIds.has(item.id));
        onConfirm(selectedItems);
        setIsOpen(false);
    };

    const filteredItems = items.filter(item => filterItem(item, searchQuery));

    return (
        <Menu.Root
            closeOnSelect={false}
            open={isOpen}
            onOpenChange={(e) => setIsOpen(e.open)}
        >
            <Menu.Trigger asChild>
                <Button
                    variant={triggerVariant}
                    colorPalette={triggerColorPalette}
                    size="sm"
                    disabled={disabled || loading}
                >
                    <HStack gap={2}>
                        {triggerIcon}
                        <Text>{triggerLabel}</Text>
                        {showArrow && (
                            <Icon>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </Icon>
                        )}
                    </HStack>
                </Button>
            </Menu.Trigger>
            <Menu.Positioner zIndex={3000}>
                <Menu.Content width="400px" maxH="500px">
                    {/* Header */}
                    <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                        <Text fontSize="sm" fontWeight="semibold">
                            {popoverTitle}
                        </Text>
                    </Box>

                    {/* Search Input */}
                    <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                        <InputGroup startElement={<LuSearch />}>
                            <Input
                                ref={searchInputRef}
                                placeholder={searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                        </InputGroup>
                    </Box>

                    {/* Item List */}
                    <Box maxH="300px" overflowY="auto">
                        {filteredItems.length === 0 ? (
                            <Box textAlign="center" py={4} px={3}>
                                <Text fontSize="sm" color="text.secondary">
                                    {searchQuery ? noResultsMessage : emptyStateMessage}
                                </Text>
                            </Box>
                        ) : (
                            filteredItems.map((item) => {
                                const isSelected = selectedItemIds.has(item.id);
                                return (
                                    <Menu.Item
                                        key={item.id}
                                        value={item.id}
                                        onSelect={() => toggleItem(item.id)}
                                    >
                                        <HStack gap={2} justify="space-between" width="100%" minW={0}>
                                            <Box flex="1" minW={0} overflow="hidden">
                                                {renderItem(item, isSelected)}
                                            </Box>
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

                    {/* Footer with Confirm Button */}
                    <Box
                        px={3}
                        py={2}
                        borderTopWidth="1px"
                        borderColor="border.subtle"
                        bg="bg.panel"
                        opacity={selectedItemIds.size > 0 ? 1 : 0.5}
                    >
                        <Button
                            variant="solid"
                            colorPalette={triggerColorPalette}
                            size="sm"
                            width="100%"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConfirm();
                            }}
                            disabled={loading || selectedItemIds.size === 0}
                        >
                            {loading ? (
                                <HStack gap={2}>
                                    <Spinner size="xs" />
                                    <Text>Processing...</Text>
                                </HStack>
                            ) : (
                                getConfirmLabel(selectedItemIds.size)
                            )}
                        </Button>
                    </Box>
                </Menu.Content>
            </Menu.Positioner>
        </Menu.Root>
    );
}
