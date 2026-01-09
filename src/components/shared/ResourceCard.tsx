import {
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
import { ImTree } from 'react-icons/im';
import { GlassCard } from './GlassCard';
import { ArtifactFile } from '../../ipc';

// Artifact type icon mapping
export const artifactTypeIcon: Record<string, React.ReactNode> = {
    kit: <LuPackage />,
    walkthrough: <LuBookOpen />,
    agent: <LuBot />,
    implementation_plan: <LuNetwork />,
    diagram: <LuNetwork />,
};

interface ResourceCardProps {
    resource: ArtifactFile;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    resourceType?: 'kit' | 'walkthrough' | 'agent' | 'diagram';
}

export function ResourceCard({
    resource,
    isSelected,
    onToggle,
    onClick,
    onContextMenu,
    resourceType = 'kit',
}: ResourceCardProps) {
    const displayName = resource.frontMatter?.alias || resource.name;
    const description = resource.frontMatter?.description || resource.path;
    const tags = resource.frontMatter?.tags || [];
    const isBase = resource.frontMatter?.is_base === true;
    const icon = artifactTypeIcon[resourceType] || <LuPackage />;

    return (
        <GlassCard
            isSelected={isSelected}
            intensity="medium"
            cursor="pointer"
            onClick={onClick}
            onContextMenu={onContextMenu}
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
                            <Heading size="sm">{displayName}</Heading>
                            {isBase && (
                                <Icon as={ImTree} boxSize={4} color="primary.500" />
                            )}
                        </HStack>
                        <Checkbox.Root
                            checked={isSelected}
                            colorPalette="primary"
                            variant="solid"
                            onCheckedChange={onToggle}
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
                    <Text fontSize="sm" color="text.secondary" lineClamp={2}>
                        {description}
                    </Text>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <HStack gap={2} flexWrap="wrap">
                            {tags.map((tag: string, index: number) => (
                                <Tag.Root key={`${resource.path}-${tag}-${index}`} size="sm" variant="subtle" colorPalette="primary">
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

export default ResourceCard;
