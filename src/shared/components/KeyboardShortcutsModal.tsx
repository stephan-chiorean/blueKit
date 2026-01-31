import { Dialog, VStack, HStack, Text, Kbd, Box, Grid, GridItem } from '@chakra-ui/react';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { motion } from 'framer-motion';

const MotionBox = motion.create(Box);

interface KeyboardShortcut {
    action: string;
    keys: string[];
    description?: string;
}

interface ShortcutCategory {
    title: string;
    shortcuts: KeyboardShortcut[];
}

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    const { colorMode } = useColorMode();

    const categories: ShortcutCategory[] = [
        {
            title: 'Tabs',
            shortcuts: [
                { action: 'New tab', keys: ['⌘', 'T'] },
                { action: 'Close tab', keys: ['⌘', 'W'] },
                { action: 'Switch to tab 1-9', keys: ['⌘', '1-9'] },
                { action: 'Previous tab', keys: ['⌘', '⇧', '['] },
                { action: 'Next tab', keys: ['⌘', '⇧', ']'] },
            ],
        },
        {
            title: 'Files',
            shortcuts: [
                { action: 'New note', keys: ['⌘', 'N'] },
                { action: 'Go to file', keys: ['⌘', 'O'], description: 'Coming soon' },
                { action: 'Save file', keys: ['⌘', 'S'] },
                { action: 'Save all', keys: ['⌘', '⇧', 'S'] },
            ],
        },
        {
            title: 'Navigation',
            shortcuts: [
                { action: 'Search library', keys: ['⌘', 'K'], description: 'Coming soon' },
                { action: 'Go to project', keys: ['⌘', 'P'], description: 'Coming soon' },
                { action: 'Toggle sidebar', keys: ['⌘', 'B'] },
                { action: 'Toggle sidebar', keys: ['⌘', '\\'] },
            ],
        },
        {
            title: 'View',
            shortcuts: [
                { action: 'Keyboard shortcuts', keys: ['⌘', '/'] },
                { action: 'Command palette', keys: ['⌘', '⇧', 'P'], description: 'Coming soon' },
            ],
        },
        {
            title: 'Editor',
            shortcuts: [
                { action: 'Toggle edit/preview', keys: ['⌘', 'E'] },
                { action: 'Paste as plain text', keys: ['⌘', '⇧', 'V'] },
            ],
        },
    ];

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
            <Dialog.Backdrop
                bg={colorMode === 'light' ? 'blackAlpha.300' : 'blackAlpha.600'}
                backdropFilter="blur(8px)"
            />
            <Dialog.Positioner>
                <Dialog.Content
                    asChild
                    bg={colorMode === 'light' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 20, 25, 0.85)'}
                    backdropFilter="blur(20px) saturate(180%)"
                    borderWidth="1px"
                    borderColor={colorMode === 'light' ? 'blackAlpha.100' : 'whiteAlpha.200'}
                    boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.25)"
                    p={0}
                    overflow="hidden"
                >
                    <MotionBox
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Dialog.Header borderBottomWidth="1px" borderColor={colorMode === 'light' ? 'blackAlpha.100' : 'whiteAlpha.100'} py={4}>
                            <Dialog.Title fontSize="lg">Keyboard Shortcuts</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body p={6}>
                            <Grid templateColumns="repeat(2, 1fr)" gap={8}>
                                {categories.map((category) => (
                                    <GridItem key={category.title}>
                                        <Text fontWeight="bold" mb={3} color="text.secondary" fontSize="sm" textTransform="uppercase" letterSpacing="wider">
                                            {category.title}
                                        </Text>
                                        <VStack align="stretch" gap={2}>
                                            {category.shortcuts.map((shortcut) => (
                                                <HStack key={shortcut.action} justify="space-between">
                                                    <VStack align="start" gap={0}>
                                                        <Text fontSize="sm">{shortcut.action}</Text>
                                                        {shortcut.description && (
                                                            <Text fontSize="xs" color="text.tertiary">{shortcut.description}</Text>
                                                        )}
                                                    </VStack>
                                                    <HStack gap={1}>
                                                        {shortcut.keys.map((key) => (
                                                            <Kbd key={key} size="sm" variant="subtle">{key}</Kbd>
                                                        ))}
                                                    </HStack>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    </GridItem>
                                ))}
                            </Grid>
                        </Dialog.Body>
                    </MotionBox>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    );
}
