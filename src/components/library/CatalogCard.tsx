import {
    Badge,
    Card,
    CardHeader,
    CardBody,
    Checkbox,
    Flex,
    Heading,
    HStack,
    Icon,
    Tag,
    Text,
} from '@chakra-ui/react';
import {
    LuPackage,
    LuBookOpen,
    LuBot,
    LuNetwork,
} from 'react-icons/lu';
import { CatalogWithVariations } from '../../types/github';

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
        <Card.Root
            borderRadius="16px"
            borderWidth="1px"
            cursor="pointer"
            onClick={onCardClick}
            transition="all 0.2s ease-in-out"
            css={{
                background: isSelected 
                    ? 'rgba(255, 255, 255, 0.55)' 
                    : 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                borderColor: isSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(0, 0, 0, 0.08)',
                boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.06)',
                _dark: {
                    background: isSelected 
                        ? 'rgba(30, 30, 30, 0.85)' 
                        : 'rgba(0, 0, 0, 0.2)',
                    borderColor: isSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                },
                _hover: {
                    transform: 'scale(1.02)',
                    borderColor: isSelected ? 'var(--chakra-colors-primary-600)' : 'var(--chakra-colors-primary-400)',
                },
            }}
        >
            <CardHeader pb={2}>
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
                        variant="outline"
                        onCheckedChange={onCatalogToggle}
                        onClick={(e) => e.stopPropagation()}
                        cursor="pointer"
                    >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control 
                            cursor="pointer"
                            css={{
                                borderColor: isSelected ? 'primary.500' : 'border.emphasized',
                                _checked: {
                                    borderColor: 'primary.500',
                                },
                            }}
                        >
                            <Checkbox.Indicator 
                                css={{
                                    color: 'primary.500',
                                    _dark: {
                                        color: 'primary.500',
                                    },
                                }}
                            />
                        </Checkbox.Control>
                    </Checkbox.Root>
                </Flex>
            </CardHeader>
            <CardBody pt={0}>
                {catalog.description && (
                    <Text fontSize="sm" color="text.secondary" mb={2}>
                        {catalog.description}
                    </Text>
                )}
                {tags.length > 0 && (
                    <HStack gap={2} flexWrap="wrap">
                        {tags.map((tag: string, index: number) => (
                            <Tag.Root key={`${catalog.id}-${tag}-${index}`} size="sm" variant="subtle" colorPalette="primary">
                                <Tag.Label>{tag}</Tag.Label>
                            </Tag.Root>
                        ))}
                    </HStack>
                )}
            </CardBody>
        </Card.Root>
    );
}
