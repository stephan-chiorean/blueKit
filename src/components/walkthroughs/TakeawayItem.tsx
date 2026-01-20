/**
 * TakeawayItem component - Individual takeaway with checkbox for completion
 */
import { HStack, Box, Text, Checkbox, Icon, IconButton } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { LuLightbulb, LuTrash2 } from 'react-icons/lu';
import type { Takeaway } from '../../types/walkthrough';

const MotionBox = motion.create(Box);

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
        <MotionBox
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            role="group"
        >
            <HStack
                gap={3}
                p={3}
                borderRadius="12px"
                bg={takeaway.completed ? 'green.50' : 'bg.subtle'}
                borderWidth="1px"
                borderColor={takeaway.completed ? 'green.200' : 'border.subtle'}
                _dark={{
                    bg: takeaway.completed ? 'green.900/20' : 'bg.subtle',
                    borderColor: takeaway.completed ? 'green.700/50' : 'border.subtle',
                }}
                cursor="pointer"
                onClick={() => onToggle(takeaway.id)}
                transition="all 0.2s ease"
                _hover={{
                    borderColor: takeaway.completed ? 'green.300' : 'orange.300',
                    transform: 'translateX(2px)',
                    _dark: {
                        borderColor: takeaway.completed ? 'green.600' : 'orange.600',
                    },
                }}
            >
                <Checkbox.Root
                    checked={takeaway.completed}
                    onCheckedChange={() => onToggle(takeaway.id)}
                    colorPalette="green"
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control
                        cursor="pointer"
                        borderRadius="6px"
                        css={{
                            transition: 'all 0.2s ease',
                            borderWidth: '2px',
                        }}
                    >
                        <Checkbox.Indicator />
                    </Checkbox.Control>
                </Checkbox.Root>

                <Icon
                    boxSize={4}
                    color={takeaway.completed ? 'green.500' : 'orange.500'}
                    opacity={takeaway.completed ? 0.6 : 1}
                >
                    <LuLightbulb />
                </Icon>

                <Text
                    flex="1"
                    fontSize="sm"
                    fontWeight="medium"
                    textDecoration={takeaway.completed ? 'line-through' : 'none'}
                    color={takeaway.completed ? 'text.tertiary' : 'text.primary'}
                >
                    {takeaway.title}
                </Text>

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
            </HStack>
        </MotionBox>
    );
}
