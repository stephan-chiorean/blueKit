import {
    Box,
    Button,
    HStack,
    Icon,
    Menu,
    Portal,
    Separator,
    Text,
    VStack,
} from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    LuBookmark,
    LuBookmarkPlus,
    LuChevronDown,
    LuTrash2,
    LuX,
} from 'react-icons/lu';
import { Project } from '../../ipc';
import { LibraryCollection } from '../../ipc/library';
import { PullButton } from './PullButton';

interface LibrarySelectionBarProps {
    isOpen: boolean;
    selectedCount: number;
    onClearSelection: () => void;
    onRemoveFromCollection: () => void;
    onMoveToCollection: (collectionId: string) => void;
    onCreateCollection: () => void;
    onBulkPull: (projects: Project[]) => void;
    projects: Project[];
    collections: LibraryCollection[];
    isLoading?: boolean;
    // Positioning mode: 'fixed' (bottom of screen) or 'static' (rendered in place, e.g. inside a modal's footer area)
    // Actually, 'static' inside a flex container or absolute inside a relative container.
    // For the modal, we want it to be inside the content flow but animated.
    // OR we can make it absolute bottom of the container.
    position?: 'fixed' | 'absolute';
    containerWidth?: string;
    bottomOffset?: string;
}

export function LibrarySelectionBar({
    isOpen,
    selectedCount,
    onClearSelection,
    onRemoveFromCollection,
    onMoveToCollection,
    onCreateCollection,
    onBulkPull,
    projects,
    collections,
    isLoading = false,
    position = 'fixed',
    containerWidth = 'auto',
    bottomOffset = '20px',
}: LibrarySelectionBarProps) {

    // Style config based on position
    const positionStyles = position === 'fixed' ? {
        position: 'fixed' as const,
        bottom: bottomOffset,
        left: '50%',
        x: '-50%', // use x instead of translateX for simpler framer motion
        zIndex: 1400, // Higher than most things, lower than heavy modals if needed
    } : {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        x: 0,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: "100%", opacity: 0, ...positionStyles }}
                    animate={{ y: 0, opacity: 1, ...positionStyles }}
                    exit={{ y: "100%", opacity: 0, ...positionStyles }}
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                        mass: 0.8
                    }}
                    style={{
                        ...positionStyles,
                        width: position === 'absolute' ? '100%' : 'auto',
                        minWidth: position === 'fixed' ? '400px' : 'auto',
                        maxWidth: '90vw',
                    }}
                >
                    <Box
                        py={3}
                        px={4}
                        borderRadius={position === 'fixed' ? '12px' : '0 0 16px 16px'} // Match modal radius if absolute
                        css={{
                            background: 'rgba(255, 255, 255, 0.85)', // More opaque for better readability
                            backdropFilter: 'blur(20px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                            borderTopWidth: position === 'absolute' ? '1px' : '0',
                            borderWidth: position === 'fixed' ? '1px' : '0',
                            borderColor: 'rgba(0, 0, 0, 0.08)',
                            boxShadow: position === 'fixed'
                                ? '0 10px 40px -10px rgba(0,0,0,0.1)'
                                : 'none',
                            _dark: {
                                background: 'rgba(30, 30, 30, 0.85)',
                                borderColor: 'rgba(255, 255, 255, 0.15)',
                                boxShadow: position === 'fixed'
                                    ? '0 10px 40px -10px rgba(0,0,0,0.5)'
                                    : 'none',
                            },
                        }}
                    >
                        <VStack gap={2} width="100%">
                            {/* Selection summary */}
                            <HStack gap={1.5} justify="center" wrap="wrap">
                                <Text fontSize="xs" color="text.secondary" fontWeight="medium">
                                    {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                                </Text>
                            </HStack>

                            {/* Action buttons */}
                            <HStack gap={2} justify="center" wrap="wrap">
                                {/* Clear selection */}
                                <Button
                                    variant="surface"
                                    colorPalette="gray"
                                    size="sm"
                                    onClick={onClearSelection}
                                    disabled={isLoading}
                                >
                                    <HStack gap={2}>
                                        <LuX />
                                        <Text>Clear</Text>
                                    </HStack>
                                </Button>

                                <Separator orientation="vertical" height="20px" />

                                {/* Remove from Collection */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onRemoveFromCollection}
                                    disabled={isLoading}
                                    colorPalette="red"
                                >
                                    <HStack gap={2}>
                                        <LuTrash2 />
                                        <Text>Remove</Text>
                                    </HStack>
                                </Button>

                                <Separator orientation="vertical" height="20px" />

                                {/* Move to Collection */}
                                <Menu.Root>
                                    <Menu.Trigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isLoading}
                                        >
                                            <HStack gap={2}>
                                                <LuBookmark />
                                                <Text>Move</Text>
                                                <LuChevronDown />
                                            </HStack>
                                        </Button>
                                    </Menu.Trigger>
                                    <Portal>
                                        <Menu.Positioner zIndex={position === 'absolute' ? 3000 : 1500}>
                                            <Menu.Content>
                                                {collections.length === 0 ? (
                                                    <Box px={3} py={2}>
                                                        <Text fontSize="sm" color="text.secondary">No collections yet</Text>
                                                    </Box>
                                                ) : (
                                                    collections.map((col) => (
                                                        <Menu.Item
                                                            key={col.id}
                                                            value={col.id}
                                                            onSelect={() => onMoveToCollection(col.id)}
                                                        >
                                                            <HStack gap={2}>
                                                                <Icon color={col.color || 'blue.500'}>
                                                                    <LuBookmark />
                                                                </Icon>
                                                                <Text>{col.name}</Text>
                                                            </HStack>
                                                        </Menu.Item>
                                                    ))
                                                )}
                                                <Menu.Separator />
                                                <Menu.Item value="new" onSelect={onCreateCollection}>
                                                    <HStack gap={2}>
                                                        <Icon color="primary.500">
                                                            <LuBookmarkPlus />
                                                        </Icon>
                                                        <Text>Create New</Text>
                                                    </HStack>
                                                </Menu.Item>
                                            </Menu.Content>
                                        </Menu.Positioner>
                                    </Portal>
                                </Menu.Root>

                                <Separator orientation="vertical" height="20px" />

                                {/* Pull button */}
                                <PullButton
                                    projects={projects}
                                    onConfirmPull={onBulkPull}
                                    loading={isLoading}
                                />
                            </HStack>
                        </VStack>
                    </Box>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
