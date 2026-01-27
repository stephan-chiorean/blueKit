import {
    Badge,
    Box,
    Checkbox,
    Flex,
    Heading,
    HStack,
    Icon,
    Tag,
    Text,
    VStack,
} from '@chakra-ui/react';
import {
    LuPackage,
    LuBookOpen,
    LuBot,
    LuNetwork,
} from 'react-icons/lu';
import { GlassCard } from '@/shared/components/GlassCard';
import { CatalogWithVariations } from '@/types/github';

export const artifactTypeIcon: Record<string, React.ReactNode> = {
    kit: <LuPackage />,
    walkthrough: <LuBookOpen />,
    agent: <LuBot />,
    implementation_plan: <LuNetwork />,
};

interface CatalogCardProps {
    catalogWithVariations: CatalogWithVariations;
    isSelected: boolean;
    onCatalogToggle: () => void;
    onCardClick: () => void;
}

export function CatalogCard({
    catalogWithVariations,
    isSelected,
    onCatalogToggle,
    onCardClick,
}: CatalogCardProps) {
    const { catalog, variations } = catalogWithVariations;
    const hasSingleVariation = variations.length === 1;

    const icon = artifactTypeIcon[catalog.artifact_type] || <LuPackage />;
    const tags = catalog.tags ? JSON.parse(catalog.tags) : [];

    return (
        <GlassCard
            isSelected={isSelected}
            intensity="medium"
            cursor="pointer"
            onClick={onCardClick}
            _hover={{
                borderColor: isSelected ? 'primary.600' : 'rgba(255, 255, 255, 0.4)',
                _dark: {
                    borderColor: isSelected ? 'primary.600' : 'rgba(255, 255, 255, 0.1)',
                }
            }}
        >
            <Box p={4}>
                <VStack align="stretch" gap={2}>
                    {/* Header */}
                    <Flex justify="space-between" align="center">
                        <HStack gap={2} flex={1}>
                            <Icon color="primary.500">{icon}</Icon>
                            <Heading size="sm">{catalog.name}</Heading>
                            {!hasSingleVariation && (
                                <Badge
                                    size="sm"
                                    colorPalette="gray"
                                    bg="transparent"
                                    _dark={{ bg: "bg.subtle" }}
                                >
                                    {variations.length}
                                </Badge>
                            )}
                        </HStack>
                        <Checkbox.Root
                            checked={isSelected}
                            colorPalette="primary"
                            variant="solid"
                            onCheckedChange={onCatalogToggle}
                            onClick={(e) => e.stopPropagation()}
                            cursor="pointer"
                            css={{
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
                                        _dark: {
                                            color: 'transparent',
                                        },
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
                    {catalog.description && (
                        <Text fontSize="sm" color="text.secondary">
                            {catalog.description}
                        </Text>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                        <HStack gap={2} flexWrap="wrap">
                            {tags.map((tag: string, index: number) => (
                                <Tag.Root key={`${catalog.id}-${tag}-${index}`} size="sm" variant="subtle" colorPalette="primary">
                                    <Tag.Label>#{tag}</Tag.Label>
                                </Tag.Root>
                            ))}
                        </HStack>
                    )}
                </VStack>
            </Box>
        </GlassCard>
    );
}
