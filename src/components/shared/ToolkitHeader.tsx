import { Flex, Heading, Button, HStack, Icon, Text } from '@chakra-ui/react';
import { LuPlus } from 'react-icons/lu';
import { IconType } from 'react-icons';

/**
 * Props for ToolkitHeader component
 */
export interface ToolkitHeaderProps {
    /** The title to display (e.g., "Tasks", "Plans", "Kits") */
    title: string;
    /** Optional action button configuration */
    action?: {
        /** Button label (e.g., "Add Task", "Create Plan") */
        label: string;
        /** Click handler for the action button */
        onClick: () => void;
        /** Optional custom icon (defaults to LuPlus) */
        icon?: IconType;
        /** Color palette for the button (defaults to "primary") */
        colorPalette?: string;
    };
}

/**
 * ToolkitHeader - A consistent header component for toolkit tab content views
 * 
 * Displays a left-aligned title with an optional action button on the right.
 * 
 * @example
 * ```tsx
 * <ToolkitHeader
 *   title="Tasks"
 *   action={{
 *     label: "Add Task",
 *     onClick: handleAddTask,
 *   }}
 * />
 * ```
 */
export function ToolkitHeader({ title, action }: ToolkitHeaderProps) {
    return (
        <Flex
            align="center"
            justify="space-between"
            mb={6}
            py={2}
        >
            {/* Left-aligned Title */}
            <Heading
                size="2xl"
                css={{
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                    _dark: {
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                    },
                }}
            >
                {title}
            </Heading>

            {/* Action Button on the right */}
            {action && (
                <Button
                    colorPalette={action.colorPalette || 'primary'}
                    size="sm"
                    onClick={action.onClick}
                    borderRadius="lg"
                    borderWidth="1px"
                    css={{
                        background: 'rgba(255, 255, 255, 0.25)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderColor: 'rgba(0, 0, 0, 0.08)',
                        boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                        _dark: {
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                        },
                        _hover: {
                            background: 'rgba(255, 255, 255, 0.35)',
                            transform: 'scale(1.02)',
                            _dark: {
                                background: 'rgba(0, 0, 0, 0.3)',
                            },
                        },
                    }}
                >
                    <HStack gap={2}>
                        <Icon>
                            {action.icon ? <action.icon /> : <LuPlus />}
                        </Icon>
                        <Text>{action.label}</Text>
                    </HStack>
                </Button>
            )}
        </Flex>
    );
}

export default ToolkitHeader;
