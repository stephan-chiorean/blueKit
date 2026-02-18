import { VStack, HStack, Text, Button, Icon } from '@chakra-ui/react';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { LuFileText, LuSearch, LuX, LuFolderOpen } from 'react-icons/lu';
import { toaster } from '@/shared/components/ui/toaster';

const MotionFlex = VStack; // Temporarily disable motion for debugging

interface EmptyTabStateProps {
    context: 'project' | 'library';
    // projectPath?: string; // Temporarily removed to fix lint
    onCreateNote?: () => void;
    onSearchFiles?: () => void;
    onCloseTab?: () => void;
}

export default function EmptyTabState({
    context,
    // projectPath,
    onCreateNote,
    onSearchFiles,
    onCloseTab,
}: EmptyTabStateProps) {
    const { colorMode } = useColorMode();

    const actions = context === 'project' ? [
        {
            icon: LuFileText,
            label: 'Create new note',
            shortcut: '⌘ N',
            onClick: onCreateNote,
        },
        {
            icon: LuSearch,
            label: 'Go to Note',
            shortcut: '⌘ O',
            onClick: onSearchFiles || (() => {
                toaster.create({
                    title: 'Coming soon',
                    description: 'File search will be available in the next update',
                    type: 'info',
                });
            }),
        },
        {
            icon: LuX,
            label: 'Close tab',
            shortcut: '⌘ W',
            onClick: onCloseTab,
        },
    ] : [
        {
            icon: LuSearch,
            label: 'Search library',
            shortcut: '⌘ K',
            onClick: () => {
                toaster.create({
                    title: 'Coming soon',
                    description: 'Library search will be available soon',
                    type: 'info',
                });
            },
        },
        {
            icon: LuFolderOpen,
            label: 'Go to project',
            shortcut: '⌘ P',
            onClick: () => {
                toaster.create({
                    title: 'Coming soon',
                    description: 'Project picker will be available soon',
                    type: 'info',
                });
            },
        },
        {
            icon: LuX,
            label: 'Close tab',
            shortcut: '⌘ W',
            onClick: onCloseTab,
        },
    ];

    return (
        <MotionFlex
            h="100%"
            w="100%"
            align="center"
            justify="center"
        >
            <VStack gap={2} maxW="400px" w="100%">
                {actions.map((action, index) => (
                    <Button
                        key={index}
                        onClick={action.onClick}
                        variant="ghost"
                        size="lg"
                        w="100%"
                        justifyContent="space-between"
                        px={6}
                        py={6}
                        h="auto"
                        _hover={{
                            bg: colorMode === 'light'
                                ? 'rgba(0, 0, 0, 0.04)'
                                : 'rgba(255, 255, 255, 0.06)',
                        }}
                    >
                        <HStack gap={3}>
                            <Icon boxSize={5} color="text.secondary">
                                <action.icon />
                            </Icon>
                            <Text fontSize="md" color="text.primary">
                                {action.label}
                            </Text>
                        </HStack>
                        <Text fontSize="sm" color="text.tertiary" fontFamily="mono">
                            {action.shortcut}
                        </Text>
                    </Button>
                ))}
            </VStack>
        </MotionFlex>
    );
}
