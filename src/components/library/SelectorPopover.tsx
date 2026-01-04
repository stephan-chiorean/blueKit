import { useState, useRef, useEffect, ReactNode } from 'react';
import {
    Box,
    Button,
    Flex,
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
    triggerVariant?: 'outline' | 'solid' | 'ghost' | 'surface' | 'subtle';
    triggerColorPalette?: string;

    // Popover content
    popoverTitle: string;
    searchPlaceholder?: string;
    emptyStateMessage?: string;
    noResultsMessage?: string;
    emptyStateIcon?: ReactNode; // Icon to show in empty state

    // Item rendering
    renderItem: (item: T, isSelected: boolean) => ReactNode;

    // Search functionality
    filterItem: (item: T, query: string) => boolean;

    // Confirm button
    getConfirmLabel: (selectedCount: number) => string;
    confirmButtonLabel?: string; // Simple label like "Add" or "Pull"
    confirmButtonColorPalette?: string; // Color for confirm button (green for Add, blue for Pull)

    // Callbacks
    onConfirm: (selectedItems: T[]) => void;
    onOpenChange?: (isOpen: boolean) => void;

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
    emptyStateIcon,
    renderItem,
    filterItem,
    getConfirmLabel,
    confirmButtonLabel,
    confirmButtonColorPalette,
    onConfirm,
    onOpenChange,
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

    const handleOpenChange = (e: { open: boolean }) => {
        setIsOpen(e.open);
        onOpenChange?.(e.open);
    };

    return (
        <Menu.Root
            closeOnSelect={false}
            open={isOpen}
            onOpenChange={handleOpenChange}
            positioning={{ placement: 'top', gutter: 50 }}
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
                <Menu.Content 
                    width="400px" 
                    maxH="500px" 
                    position="relative"
                    css={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderColor: 'rgba(0, 0, 0, 0.08)',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                        _dark: {
                            background: 'rgba(30, 30, 30, 0.85)',
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
                        },
                    }}
                >
                    {/* Header with title and confirm button */}
                    <Flex px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle" align="center" justify="space-between">
                        <Text fontSize="sm" fontWeight="semibold">
                            {popoverTitle}
                        </Text>
                        {confirmButtonLabel && (
                            <Button
                                variant="solid"
                                colorPalette={confirmButtonColorPalette || triggerColorPalette}
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirm();
                                }}
                                disabled={loading || selectedItemIds.size === 0}
                            >
                                {loading ? (
                                    <Spinner size="xs" />
                                ) : (
                                    confirmButtonLabel
                                )}
                            </Button>
                        )}
                    </Flex>

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
                                css={{
                                    borderColor: 'rgba(0, 0, 0, 0.06) !important',
                                    '&:focus': {
                                        borderColor: 'rgba(0, 0, 0, 0.06) !important',
                                        boxShadow: 'none !important',
                                        outline: 'none !important',
                                    },
                                    '&:focus-visible': {
                                        borderColor: 'rgba(0, 0, 0, 0.06) !important',
                                        boxShadow: 'none !important',
                                        outline: 'none !important',
                                    },
                                    '&:focus-within': {
                                        borderColor: 'rgba(0, 0, 0, 0.06) !important',
                                        boxShadow: 'none !important',
                                    },
                                    _dark: {
                                        borderColor: 'rgba(255, 255, 255, 0.08) !important',
                                        '&:focus': {
                                            borderColor: 'rgba(255, 255, 255, 0.08) !important',
                                        },
                                        '&:focus-visible': {
                                            borderColor: 'rgba(255, 255, 255, 0.08) !important',
                                        },
                                        '&:focus-within': {
                                            borderColor: 'rgba(255, 255, 255, 0.08) !important',
                                        },
                                    },
                                }}
                            />
                        </InputGroup>
                    </Box>

                    {/* Item List */}
                    <Box maxH="300px" minH="200px" overflowY="auto">
                        {filteredItems.length === 0 ? (
                            <Box 
                                display="flex" 
                                flexDirection="column" 
                                alignItems="center" 
                                justifyContent="center" 
                                py={8} 
                                px={3}
                                minH="200px"
                            >
                                {emptyStateIcon && (
                                    <Box mb={3} color="text.muted">
                                        {emptyStateIcon}
                                    </Box>
                                )}
                                <Text fontSize="sm" color="text.secondary" fontWeight="medium">
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
                </Menu.Content>
            </Menu.Positioner>
        </Menu.Root>
    );
}
