import { Box, HStack, Text, Button, Icon, Badge } from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';
import { IconType } from 'react-icons';

export interface ActionButton {
    label: string;
    icon: IconType;
    colorPalette: string;
    onClick: () => void;
}

interface ResourceSelectionFooterProps {
    selectedCount: number;
    isOpen: boolean;
    onClearSelection: () => void;
    resourceType: 'kit' | 'plan' | 'walkthrough';
    actions: ActionButton[];
    loading?: boolean;
}

export default function ResourceSelectionFooter({
    selectedCount,
    isOpen,
    onClearSelection,
    resourceType,
    actions,
    loading
}: ResourceSelectionFooterProps) {
    const pluralizedResourceType = selectedCount !== 1 ? `${resourceType}s` : resourceType;

    return (
        <Box
            position="sticky"
            bottom={0}
            width="100%"
            display="grid"
            css={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
                transition: "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            zIndex={10}
        >
            <Box overflow="hidden" minHeight={0}>
                <Box
                    borderTopWidth="1px"
                    borderColor="border.subtle"
                    py={4}
                    px={6}
                    css={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        _dark: {
                            background: 'rgba(20, 20, 20, 0.85)',
                        }
                    }}
                >
                    <HStack justify="space-between">
                        <HStack gap={3}>
                            <Badge colorPalette="blue" size="lg" variant="solid">
                                {selectedCount}
                            </Badge>
                            <Text fontWeight="medium" fontSize="sm">
                                {pluralizedResourceType} selected
                            </Text>
                        </HStack>
                        <HStack gap={2}>
                            {actions.map((action, index) => (
                                <Button
                                    key={index}
                                    size="sm"
                                    variant="ghost"
                                    colorPalette={action.colorPalette}
                                    onClick={action.onClick}
                                    disabled={loading}
                                >
                                    <HStack gap={1}>
                                        <Icon>
                                            <action.icon />
                                        </Icon>
                                        <Text>{action.label}</Text>
                                    </HStack>
                                </Button>
                            ))}
                            <Button
                                size="sm"
                                variant="ghost"
                                colorPalette="gray"
                                onClick={onClearSelection}
                                disabled={loading}
                            >
                                <HStack gap={1}>
                                    <Icon>
                                        <LuX />
                                    </Icon>
                                    <Text>Clear</Text>
                                </HStack>
                            </Button>
                        </HStack>
                    </HStack>
                </Box>
            </Box>
        </Box>
    );
}
