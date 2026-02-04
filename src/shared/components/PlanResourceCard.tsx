import {
    Box,
    Checkbox,
    Flex,
    Heading,
    HStack,
    Icon,
    Text,
    VStack,
    Badge,
} from '@chakra-ui/react';
import { LuMap, LuTarget, LuTrophy, LuArchive, LuCalendar, LuCheck, LuCircle } from 'react-icons/lu'; // Richer icon set
import { PlanDetails } from '@/types/plan';

interface PlanResourceCardProps {
    plan: PlanDetails;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
    index?: number;
}

export function PlanResourceCard({
    plan,
    isSelected,
    onToggle,
    onClick,
}: PlanResourceCardProps) {
    // Determine visual theme based on status
    const getTheme = (status: string) => {
        switch (status) {
            case 'active':
                return {
                    icon: LuTarget,
                    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)',
                    accentColor: 'blue.500',
                    glowColor: 'rgba(59, 130, 246, 0.4)'
                };
            case 'completed':
                return {
                    icon: LuTrophy,
                    gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(21, 128, 61, 0.05) 100%)',
                    accentColor: 'green.500',
                    glowColor: 'rgba(34, 197, 94, 0.4)'
                };
            case 'archived':
                return {
                    icon: LuArchive,
                    gradient: 'linear-gradient(135deg, rgba(100, 116, 139, 0.15) 0%, rgba(71, 85, 105, 0.05) 100%)',
                    accentColor: 'gray.500',
                    glowColor: 'rgba(100, 116, 139, 0.4)'
                };
            default:
                return {
                    icon: LuMap,
                    gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(67, 56, 202, 0.05) 100%)',
                    accentColor: 'indigo.500',
                    glowColor: 'rgba(99, 102, 241, 0.4)'
                };
        }
    };

    const theme = getTheme(plan.status);

    return (
        <Box
            position="relative"
            data-group
            h="100%"
            onClick={onClick}
            cursor="pointer"
            transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            _hover={{
                transform: 'translateY(-4px)',
            }}
        >
            {/* Main Card Container */}
            <Box
                h="100%"
                p={8}
                borderRadius="24px"
                position="relative"
                overflow="hidden"
                borderColor={isSelected ? theme.accentColor : 'border.subtle'}
                bg={isSelected
                    ? { base: 'whiteAlpha.200', _light: 'blackAlpha.50' }
                    : { base: 'whiteAlpha.50', _light: 'white' }
                }
                css={{
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    boxShadow: isSelected
                        ? `0 20px 40px -10px ${theme.glowColor}`
                        : '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease',
                    _hover: {
                        borderColor: theme.accentColor,
                        boxShadow: `0 20px 40px -10px ${theme.glowColor}`
                    }
                }}
            >
                {/* Decorative Background Gradient */}
                <Box
                    position="absolute"
                    inset={0}
                    bg={theme.gradient}
                    opacity={0.5}
                    mixBlendMode="overlay"
                    pointerEvents="none"
                />

                {/* Content Layout */}
                <VStack align="stretch" gap={6} position="relative" zIndex={1} h="100%">

                    {/* Header Section */}
                    <Flex justify="space-between" align="start">
                        {/* Milestones Preview */}
                        <Box flex={1} mr={4}>
                            <Text
                                fontSize="xs"
                                fontWeight="bold"
                                textTransform="uppercase"
                                letterSpacing="wider"
                                color={theme.accentColor}
                                mb={3}
                            >
                                Key Milestones
                            </Text>
                            <VStack align="stretch" gap={2}>
                                {plan.phases && plan.phases.flatMap(p => p.milestones).length > 0 ? (
                                    plan.phases.flatMap(p => p.milestones)
                                        .slice(0, 4) // Show top 4
                                        .map((milestone) => (
                                            <HStack key={milestone.id} gap={2} opacity={milestone.completed ? 0.5 : 1}>
                                                <Icon
                                                    as={milestone.completed ? LuCheck : LuCircle}
                                                    color={milestone.completed ? "green.400" : "fg.muted"}
                                                    boxSize={3.5}
                                                />
                                                <Text
                                                    fontSize="sm"
                                                    color="fg"
                                                    lineClamp={1}
                                                    textDecoration={milestone.completed ? "line-through" : "none"}
                                                >
                                                    {milestone.name}
                                                </Text>
                                            </HStack>
                                        ))
                                ) : (
                                    <Text fontSize="sm" color="fg.muted" fontStyle="italic">
                                        No milestones yet
                                    </Text>
                                )}
                                {plan.phases && plan.phases.flatMap(p => p.milestones).length > 4 && (
                                    <Text fontSize="xs" color={theme.accentColor} mt={1}>
                                        +{plan.phases.flatMap(p => p.milestones).length - 4} more...
                                    </Text>
                                )}
                            </VStack>
                        </Box>

                        <Box onClick={(e) => e.stopPropagation()}>
                            <Checkbox.Root
                                checked={isSelected}
                                onCheckedChange={() => onToggle()}
                                size="lg"
                                colorPalette="blue"
                                css={{
                                    _focus: { boxShadow: 'none' }
                                }}
                            >
                                <Checkbox.HiddenInput />
                                <Checkbox.Control
                                    borderRadius="md"
                                    css={{
                                        borderWidth: "2px",
                                        borderColor: "border.muted",
                                        _checked: {
                                            bg: theme.accentColor,
                                            borderColor: theme.accentColor,
                                        }
                                    }}
                                >
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                            </Checkbox.Root>
                        </Box>
                    </Flex>

                    {/* Title & Description */}
                    <VStack align="stretch" gap={2} flex={1}>
                        <Heading
                            size="lg"
                            fontWeight="bold"
                            lineClamp={2}
                            letterSpacing="tight"
                            color="fg"
                        >
                            {plan.name}
                        </Heading>
                        <Text
                            fontSize="md"
                            color="fg.muted"
                            lineClamp={2}
                            lineHeight="tall"
                        >
                            {plan.description || 'No description provided.'}
                        </Text>
                    </VStack>

                    {/* Footer / Stats */}
                    <VStack align="stretch" gap={4} pt={4}>
                        {/* Custom Progress Bar */}
                        <VStack align="stretch" gap={2}>
                            <Flex justify="space-between" align="center">
                                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color={theme.accentColor}>
                                    Progress
                                </Text>
                                <Text fontSize="sm" fontWeight="bold" color="fg">
                                    {Math.round(plan.progress)}%
                                </Text>
                            </Flex>
                            <Box
                                h="6px"
                                w="100%"
                                bg="bg.subtle"
                                borderRadius="full"
                                overflow="hidden"
                            >
                                <Box
                                    h="100%"
                                    w={`${plan.progress}%`}
                                    bg={theme.accentColor}
                                    borderRadius="full"
                                    css={{
                                        boxShadow: `0 0 10px ${theme.glowColor}`,
                                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)"
                                    }}
                                />
                            </Box>
                        </VStack>

                        <Flex justify="space-between" align="center" pt={2} borderTopWidth="1px" borderTopColor="border.subtle">
                            <HStack gap={2} color="fg.muted">
                                <Icon as={LuCalendar} />
                                <Text fontSize="xs" fontWeight="medium">
                                    {new Date(plan.createdAt).toLocaleDateString()}
                                </Text>
                            </HStack>

                            <Badge
                                variant="surface"
                                colorPalette={
                                    plan.status === 'active' ? 'blue' :
                                        plan.status === 'completed' ? 'green' : 'gray'
                                }
                                size="md"
                                css={{
                                    bg: `color-mix(in srgb, ${theme.accentColor}, transparent 90%)`,
                                    color: theme.accentColor,
                                    borderColor: `color-mix(in srgb, ${theme.accentColor}, transparent 80%)`,
                                }}
                            >
                                {plan.status}
                            </Badge>
                        </Flex>
                    </VStack>
                </VStack>
            </Box>
        </Box>
    );
}
