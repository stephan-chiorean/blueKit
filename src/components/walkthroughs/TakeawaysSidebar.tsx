/**
 * TakeawaysSidebar component - Left sidebar showing takeaways with progress indicator
 */
import { useState, useRef } from 'react';
import {
    VStack,
    HStack,
    Box,
    Text,
    Icon,
    IconButton,
    Input,
    Progress,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuLightbulb, LuPlus, LuChevronDown } from 'react-icons/lu';
import type { Takeaway } from '../../types/walkthrough';
import TakeawayItem from './TakeawayItem';

const MotionBox = motion.create(Box);

interface TakeawaysSidebarProps {
    takeaways: Takeaway[];
    onToggle: (takeawayId: string) => void;
    onAdd: (title: string) => void;
    onDelete: (takeawayId: string) => void;
}

export default function TakeawaysSidebar({
    takeaways,
    onToggle,
    onAdd,
    onDelete,
}: TakeawaysSidebarProps) {
    const [newTakeawayTitle, setNewTakeawayTitle] = useState('');
    const [isExpanded, setIsExpanded] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    const completedCount = takeaways.filter((t) => t.completed).length;
    const progress = takeaways.length > 0 ? (completedCount / takeaways.length) * 100 : 0;

    const handleAddTakeaway = () => {
        if (!newTakeawayTitle.trim()) return;
        onAdd(newTakeawayTitle.trim());
        setNewTakeawayTitle('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddTakeaway();
        }
    };

    return (
        <VStack align="stretch" gap={4}>
            {/* Header with Progress */}
            <Box
                borderRadius="16px"
                borderWidth="1px"
                borderColor="border.subtle"
                bg="bg.subtle"
                overflow="hidden"
            >
                <HStack
                    justify="space-between"
                    p={4}
                    cursor="pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                    _hover={{ bg: 'bg.muted' }}
                    transition="background 0.2s ease"
                >
                    <HStack gap={3}>
                        <Box
                            p={2}
                            borderRadius="10px"
                            bg="orange.100"
                            _dark={{ bg: 'orange.900/30' }}
                        >
                            <Icon boxSize={4} color="orange.500">
                                <LuLightbulb />
                            </Icon>
                        </Box>
                        <VStack align="start" gap={0}>
                            <Text fontSize="sm" fontWeight="semibold">
                                Takeaways
                            </Text>
                            <Text fontSize="xs" color="text.tertiary">
                                {completedCount} of {takeaways.length} completed
                            </Text>
                        </VStack>
                    </HStack>
                    <Icon
                        transform={isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}
                        transition="transform 0.2s ease"
                        color="text.tertiary"
                    >
                        <LuChevronDown />
                    </Icon>
                </HStack>

                {/* Progress Bar */}
                <Box px={4} pb={3}>
                    <Progress.Root value={progress} max={100} size="sm">
                        <Progress.Track borderRadius="full" bg="bg.muted">
                            <Progress.Range
                                bg={progress === 100 ? 'green.500' : 'orange.500'}
                                transition="all 0.3s ease"
                            />
                        </Progress.Track>
                    </Progress.Root>
                </Box>

                {/* Expandable Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <MotionBox
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            overflow="hidden"
                        >
                            <VStack align="stretch" gap={2} px={4} pb={4}>
                                {/* Add Takeaway Input */}
                                <HStack gap={2}>
                                    <Input
                                        ref={inputRef}
                                        value={newTakeawayTitle}
                                        onChange={(e) => setNewTakeawayTitle(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Add takeaway..."
                                        size="sm"
                                        css={{
                                            borderRadius: '8px',
                                            _focus: {
                                                borderColor: 'orange.400',
                                            },
                                        }}
                                    />
                                    <IconButton
                                        aria-label="Add takeaway"
                                        onClick={handleAddTakeaway}
                                        disabled={!newTakeawayTitle.trim()}
                                        colorPalette="orange"
                                        variant="solid"
                                        size="sm"
                                        css={{ borderRadius: '8px' }}
                                    >
                                        <Icon>
                                            <LuPlus />
                                        </Icon>
                                    </IconButton>
                                </HStack>

                                {/* Takeaway List */}
                                <VStack align="stretch" gap={1}>
                                    <AnimatePresence>
                                        {takeaways.map((takeaway) => (
                                            <TakeawayItem
                                                key={takeaway.id}
                                                takeaway={takeaway}
                                                onToggle={onToggle}
                                                onDelete={onDelete}
                                                showDelete
                                            />
                                        ))}
                                    </AnimatePresence>
                                </VStack>

                                {takeaways.length === 0 && (
                                    <Box
                                        p={4}
                                        textAlign="center"
                                        borderRadius="10px"
                                        borderWidth="1px"
                                        borderStyle="dashed"
                                        borderColor="border.subtle"
                                    >
                                        <Text fontSize="xs" color="text.tertiary">
                                            No takeaways yet. Add key learnings to track.
                                        </Text>
                                    </Box>
                                )}
                            </VStack>
                        </MotionBox>
                    )}
                </AnimatePresence>
            </Box>
        </VStack>
    );
}
