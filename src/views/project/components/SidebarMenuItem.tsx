import { Box, HStack, Text, Icon, Badge } from '@chakra-ui/react';
import type { ElementType, MouseEvent } from 'react';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

interface SidebarMenuItemProps {
    icon: ElementType;
    label: string;
    isActive?: boolean;
    onClick: (event: MouseEvent) => void;
    onContextMenu?: (event: MouseEvent) => void;
    badge?: string | number;
    collapsed?: boolean;
}

export default function SidebarMenuItem({
    icon,
    label,
    isActive = false,
    onClick,
    onContextMenu,
    badge,
    collapsed = false
}: SidebarMenuItemProps) {
    const { colorMode } = useColorMode();

    // Match the exact styling of the subtle blue button (colorPalette="blue" variant="subtle")
    // Light mode: subtle blue background (blue.100 for more visibility), darker navy text (blue.700)
    // Dark mode: blue background (blue.900), light blue text (blue.200)
    const activeBg = colorMode === 'light' ? 'blue.100' : 'blue.900';
    const hoverBg = colorMode === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(66, 135, 245, 0.08)';
    const activeColor = colorMode === 'light' ? 'blue.700' : 'blue.200';
    const inactiveColor = colorMode === 'light' ? 'gray.600' : 'gray.400';

    return (
        <Box
            as="button"
            onClick={(event) => onClick(event)}
            onContextMenu={onContextMenu}
            w="100%"
            py={2}
            pl={2}
            pr={0}
            mb={0.5}
            borderRadius="md"
            bg={isActive ? activeBg : 'transparent'}
            color={isActive ? activeColor : inactiveColor}
            transition="all 0.2s"
            cursor="pointer"
            _hover={{
                bg: isActive ? activeBg : hoverBg,
                color: activeColor,
            }}
            textAlign="left"
            title={collapsed ? label : undefined}
        >
            <HStack gap={3} justify={collapsed ? 'center' : 'flex-start'}>
                <Icon as={icon} boxSize={5} />

                {!collapsed && (
                    <HStack flex="1" justify="space-between" overflow="hidden">
                        <Text
                            fontSize="sm"
                            fontWeight={isActive ? "medium" : "normal"}
                            truncate
                        >
                            {label}
                        </Text>

                        {badge && (
                            <Badge
                                size="sm"
                                variant="subtle"
                                colorScheme="blue"
                                borderRadius="full"
                            >
                                {badge}
                            </Badge>
                        )}
                    </HStack>
                )}
            </HStack>
        </Box>
    );
}
