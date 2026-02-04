import { Box, HStack, Text, Button, Icon, Badge } from '@chakra-ui/react';
import { LuTrash2, LuX, LuShare, LuFolderPlus } from 'react-icons/lu';

interface KitsSelectionFooterProps {
    selectedCount: number;
    isOpen: boolean;
    onClearSelection: () => void;
    onDelete: () => void;
    onPublish: () => void;
    onAddToProject: () => void;
    loading?: boolean;
}

export default function KitsSelectionFooter({
    selectedCount,
    isOpen,
    onClearSelection,
    onDelete,
    onPublish,
    onAddToProject,
    loading
}: KitsSelectionFooterProps) {
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
                                kit{selectedCount !== 1 ? 's' : ''} selected
                            </Text>
                        </HStack>
                        <HStack gap={2}>
                            <Button
                                size="sm"
                                variant="ghost"
                                colorPalette="blue"
                                onClick={onAddToProject}
                                disabled={loading}
                            >
                                <HStack gap={1}>
                                    <Icon>
                                        <LuFolderPlus />
                                    </Icon>
                                    <Text>Add to Project</Text>
                                </HStack>
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                colorPalette="green"
                                onClick={onPublish}
                                disabled={loading}
                            >
                                <HStack gap={1}>
                                    <Icon>
                                        <LuShare />
                                    </Icon>
                                    <Text>Publish</Text>
                                </HStack>
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                colorPalette="red"
                                onClick={onDelete}
                                disabled={loading}
                            >
                                <HStack gap={1}>
                                    <Icon>
                                        <LuTrash2 />
                                    </Icon>
                                    <Text>Delete</Text>
                                </HStack>
                            </Button>
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
