import {
    Box,
    Checkbox,
    Flex,
    Heading,
    HStack,
    Icon,
    Text,
    VStack,
    Tag,
    Progress,
} from '@chakra-ui/react';
import { LuMap } from 'react-icons/lu';
import { GlassCard } from './GlassCard';
import { Plan } from '@/types/plan';

interface PlanResourceCardProps {
    plan: Plan;
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
    // Plan status badge color
    const statusColorPalette = {
        active: 'blue',
        completed: 'green',
        archived: 'gray',
    }[plan.status] || 'gray';

    return (
        <Box
            transition="all 0.2s ease-in-out"
            _hover={{
                transform: 'translateY(-4px)',
            }}
        >
            <GlassCard
                isSelected={isSelected}
                intensity="medium"
                cursor="pointer"
                onClick={onClick}
                _hover={{
                    borderColor: isSelected ? 'primary.600' : 'rgba(255, 255, 255, 0.4)',
                    _dark: {
                        borderColor: isSelected ? 'primary.600' : 'rgba(255, 255, 255, 0.1)',
                    }
                }}
            >
                <Box p={4}>
                    <VStack align="stretch" gap={3}>
                        {/* Header */}
                        <Flex justify="space-between" align="center">
                            <HStack gap={2} flex={1} overflow="hidden">
                                <Icon color="primary.500" as={LuMap} fontSize="lg" flexShrink={0} />
                                <Heading size="sm" lineClamp={1} flex={1}>
                                    {plan.name}
                                </Heading>
                                <Tag.Root size="sm" variant="subtle" colorPalette={statusColorPalette} flexShrink={0}>
                                    <Tag.Label>{plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}</Tag.Label>
                                </Tag.Root>
                            </HStack>
                            <Checkbox.Root
                                checked={isSelected}
                                colorPalette="primary"
                                variant="solid"
                                onCheckedChange={onToggle}
                                onClick={(e) => e.stopPropagation()}
                                cursor="pointer"
                                css={{
                                    marginLeft: '8px',
                                    _focus: { boxShadow: 'none', outline: 'none' },
                                    _focusVisible: { boxShadow: 'none', outline: 'none' }
                                }}
                            >
                                <Checkbox.HiddenInput />
                                <Checkbox.Control
                                    cursor="pointer"
                                    css={{
                                        borderColor: isSelected ? 'transparent' : 'border.emphasized',
                                        backgroundColor: isSelected ? 'primary.500' : 'transparent',
                                        _checked: {
                                            borderColor: 'transparent',
                                            backgroundColor: 'primary.500',
                                        },
                                        _focus: { boxShadow: 'none', outline: 'none' },
                                        _focusVisible: { boxShadow: 'none', outline: 'none' },
                                    }}
                                >
                                    <Checkbox.Indicator
                                        css={{
                                            color: 'transparent',
                                            _dark: { color: 'transparent' },
                                            _checked: {
                                                bg: 'primary.500',
                                                borderColor: 'primary.500',
                                                color: 'transparent'
                                            }
                                        }}
                                    />
                                </Checkbox.Control>
                            </Checkbox.Root>
                        </Flex>

                        {/* Description */}
                        <Text fontSize="sm" color="text.secondary" lineClamp={2} minH="40px">
                            {plan.description || 'No description provided.'}
                        </Text>

                        {/* Progress */}
                        <VStack gap={1} align="stretch">
                            <Flex justify="space-between" align="center">
                                <Text fontSize="xs" color="text.muted">Progress</Text>
                                <Text fontSize="xs" fontWeight="bold">{Math.round(plan.progress)}%</Text>
                            </Flex>
                            <Progress.Root value={plan.progress} size="sm" colorPalette="primary">
                                <Progress.Track>
                                    <Progress.Range />
                                </Progress.Track>
                            </Progress.Root>
                        </VStack>

                        {/* Footer */}
                        <Text fontSize="xs" color="text.muted" textAlign="right">
                            Created {new Date(plan.createdAt).toLocaleDateString()}
                        </Text>
                    </VStack>
                </Box>
            </GlassCard>
        </Box>
    );
}
