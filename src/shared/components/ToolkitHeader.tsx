import { Box, HStack, Icon, Button, Text } from '@chakra-ui/react';
import { LuPlus } from 'react-icons/lu';
import { IconType } from 'react-icons';
import { ReactNode } from 'react';

/**
 * Props for ToolkitHeader component
 */
export interface ToolkitHeaderProps {
    /** The title to display (e.g., "Tasks", "Plans", "Kits") */
    title: string;
    /** Optional parent name for breadcrumbs (e.g. Project Name) */
    parentName?: string;
    /** Optional action button configuration */
    action?: {
        /** Button label (e.g., "Add Task", "Create Plan") - used for tooltip or text */
        label: string;
        /** Click handler for the action button */
        onClick: () => void;
        /** Optional custom icon (defaults to LuPlus) */
        icon?: IconType;
        /** Color palette for the button (defaults to "primary") */
        colorPalette?: string;
        /** Variant style: 'glass', 'solid', or 'icon' (new default mirroring NoteView) */
        variant?: 'glass' | 'solid' | 'icon';
    };
    /** Optional left-side actions (custom buttons/elements) */
    leftActions?: ReactNode;
}

export function ToolkitHeader({ title, parentName, action, leftActions }: ToolkitHeaderProps) {
    const ActionIcon = action?.icon || LuPlus;

    return (
        <Box
            position="sticky"
            top={0}
            zIndex={100}
            bg="transparent"
            px={4}
            py={2}
        >
            <HStack justify="space-between" align="center" gap={4}>
                {/* Left: Custom actions or placeholder to balance layout */}
                {leftActions ? (
                    <HStack gap={2} minW="40px">
                        {leftActions}
                    </HStack>
                ) : (
                    <Box w={action ? "auto" : 0} minW={action ? "40px" : 0} />
                )}

                {/* Center: Breadcrumbs */}
                <HStack
                    gap={2}
                    flex={1}
                    justify="center"
                    minW={0}
                >
                    {parentName && (
                        <>
                            <Text fontSize="sm" color="text.secondary" lineClamp={1}>
                                {parentName}
                            </Text>
                            <Text fontSize="sm" color="text.tertiary">
                                {'>'}
                            </Text>
                        </>
                    )}
                    <Text
                        fontSize="sm"
                        color="text.primary"
                        fontWeight="medium"
                        lineClamp={1}
                    >
                        {title}
                    </Text>
                </HStack>

                {/* Right: Action Button */}
                <HStack gap={1} minW={action ? "40px" : 0} justify="flex-end">
                    {action && (
                        <Button
                            variant="ghost"
                            size="sm"
                            px={2}
                            onClick={action.onClick}
                            colorPalette={action.colorPalette || 'gray'}
                            bg="transparent"
                            _hover={{
                                bg: 'bg.subtle', // Subtle hover effect like NoteViewHeader
                            }}
                            title={action.label} // Basic tooltip
                        >
                            <Icon boxSize={4}>
                                <ActionIcon />
                            </Icon>
                        </Button>
                    )}
                </HStack>
            </HStack>
        </Box>
    );
}

export default ToolkitHeader;
