/**
 * TakeawayItem component - Individual takeaway with checkbox for completion
 */
import { HStack, Box, Text, Icon, IconButton, Flex } from '@chakra-ui/react';
import { LuCheck, LuLightbulb, LuTrash2 } from 'react-icons/lu';
import type { Takeaway } from '@/types/walkthrough';

interface TakeawayItemProps {
    takeaway: Takeaway;
    onToggle: (takeawayId: string) => void;
    onDelete?: (takeawayId: string) => void;
    showDelete?: boolean;
}

export default function TakeawayItem({
    takeaway,
    onToggle,
    onDelete,
    showDelete = false,
}: TakeawayItemProps) {
    return (
        <Box role="group">
            <Box
                px={3}
                py={2}
                bg={takeaway.completed ? 'green.50' : 'transparent'}
                borderWidth={takeaway.completed ? '1px' : '0px'}
                borderColor={takeaway.completed ? 'green.200' : 'transparent'}
                cursor="pointer"
                onClick={() => onToggle(takeaway.id)}
                css={{
                    borderRadius: '12px',
                    transition: 'all 0.15s ease',
                    _dark: {
                        bg: takeaway.completed ? 'green.950/30' : 'transparent',
                        borderColor: takeaway.completed ? 'green.800/50' : 'transparent',
                    },
                    _hover: {
                        bg: takeaway.completed ? 'rgba(var(--chakra-colors-green-500) / 0.12)' : 'rgba(128, 128, 128, 0.05)',
                    },
                }}
            >
                <Flex justify="space-between" align="center" gap={2}>
                    <HStack gap={3} flex="1" minW={0}>
                        {/* Milestone-style marker (no checkbox) */}
                        <Box
                            w="22px"
                            h="22px"
                            borderRadius="full"
                            display="grid"
                            placeItems="center"
                            flexShrink={0}
                            bg={takeaway.completed ? 'green.500' : 'transparent'}
                            borderWidth="2px"
                            borderColor={takeaway.completed ? 'green.500' : 'orange.300'}
                            _dark={{
                                bg: takeaway.completed ? 'green.400' : 'transparent',
                                borderColor: takeaway.completed ? 'green.400' : 'orange.600',
                            }}
                        >
                            {takeaway.completed ? (
                                <Icon boxSize={3.5} color="white">
                                    <LuCheck />
                                </Icon>
                            ) : (
                                <Icon boxSize={3.5} color="orange.500" _dark={{ color: 'orange.400' }}>
                                    <LuLightbulb />
                                </Icon>
                            )}
                        </Box>

                        <Text
                            flex="1"
                            minW={0}
                            fontSize="sm"
                            textDecoration={takeaway.completed ? 'line-through' : 'none'}
                            color={takeaway.completed ? 'text.tertiary' : 'text.primary'}
                            transition="all 0.2s ease-in-out"
                            noOfLines={2}
                        >
                            {takeaway.title}
                        </Text>
                    </HStack>

                    {showDelete && onDelete && (
                        <IconButton
                            aria-label="Delete takeaway"
                            variant="ghost"
                            size="xs"
                            colorPalette="red"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(takeaway.id);
                            }}
                            css={{
                                opacity: 0,
                                transition: 'opacity 0.15s ease',
                                '[role="group"]:hover &': {
                                    opacity: 1,
                                },
                            }}
                        >
                            <Icon>
                                <LuTrash2 />
                            </Icon>
                        </IconButton>
                    )}
                </Flex>
            </Box>
        </Box>
    );
}
