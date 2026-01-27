/**
 * WalkthroughOverviewPanel - Left sidebar showing walkthrough info, takeaways, and notes
 * 
 * Mirrors PlanOverviewPanel structure with:
 * - Collapsible main card with title, progress, and status
 * - Takeaways section (like milestones in plans)
 * - Notes section
 */
import { useState, useCallback, useRef } from 'react';
import {
    Card,
    CardBody,
    Text,
    VStack,
    Button,
    Flex,
    HStack,
    Icon,
    Textarea,
    IconButton,
    Badge,
    Progress,
    Box,
    Center,
    Input,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LuArrowLeft,
    LuCopy,
    LuCheck,
    LuChevronDown,
    LuLightbulb,
    LuPlus,
    LuExternalLink,
} from 'react-icons/lu';
import type { WalkthroughDetails } from '@/types/walkthrough';
import { invokeOpenFileInEditor } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import TakeawayItem from './TakeawayItem';

interface WalkthroughOverviewPanelProps {
    details: WalkthroughDetails;
    loading: boolean;
    onBack?: () => void;
    onToggleTakeaway: (takeawayId: string) => void;
    onAddTakeaway: (title: string) => void;
    onDeleteTakeaway: (takeawayId: string) => void;
}

export default function WalkthroughOverviewPanel({
    details,
    loading,
    onBack,
    onToggleTakeaway,
    onAddTakeaway,
    onDeleteTakeaway,
}: WalkthroughOverviewPanelProps) {
    const { colorMode } = useColorMode();
    const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
    const [isUnifiedExpanded, setIsUnifiedExpanded] = useState(true);
    const [hideCompleted, setHideCompleted] = useState(false);

    // Takeaway input state
    const [newTakeawayTitle, setNewTakeawayTitle] = useState('');
    const takeawayInputRef = useRef<HTMLInputElement>(null);

    // Note state
    const [notes, setNotes] = useState<string>('');
    const notesKey = `bluekit-walkthrough-notes-${details.id}`;

    // Load notes from localStorage on mount
    useState(() => {
        const savedNotes = localStorage.getItem(notesKey);
        if (savedNotes !== null) {
            setNotes(savedNotes);
        }
    });

    // Calculate progress
    const completedCount = details.takeaways.filter((t) => t.completed).length;
    const totalCount = details.takeaways.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    // Filter takeaways
    const visibleTakeaways = hideCompleted
        ? details.takeaways.filter((t) => !t.completed)
        : details.takeaways;

    // Handle add takeaway
    const handleAddTakeaway = useCallback(() => {
        if (!newTakeawayTitle.trim()) return;
        onAddTakeaway(newTakeawayTitle.trim());
        setNewTakeawayTitle('');
        setTimeout(() => takeawayInputRef.current?.focus(), 50);
    }, [newTakeawayTitle, onAddTakeaway]);

    const handleTakeawayKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddTakeaway();
        }
    };

    // Handle notes save
    const handleNotesChange = useCallback((value: string) => {
        setNotes(value);
        try {
            localStorage.setItem(notesKey, value);
        } catch (error) {
            console.error('Failed to save notes:', error);
        }
    }, [notesKey]);

    // Copy notes to clipboard
    const copyNotes = useCallback(async () => {
        if (!notes) return;
        try {
            await navigator.clipboard.writeText(notes);
            setCopiedNoteId('current');
            setTimeout(() => setCopiedNoteId(null), 2000);
        } catch (error) {
            console.error('Failed to copy notes:', error);
        }
    }, [notes]);

    // Open in editor
    const handleOpenInEditor = useCallback(async () => {
        try {
            await invokeOpenFileInEditor(details.filePath, 'cursor');
        } catch (error) {
            console.error('Failed to open file:', error);
            toaster.create({ type: 'error', title: 'Failed to open file in editor' });
        }
    }, [details.filePath]);

    const cardStyle = {
        background: colorMode === 'light'
            ? 'rgba(255, 255, 255, 0.65)'
            : 'rgba(40, 40, 50, 0.5)',
        backdropFilter: 'blur(24px) saturate(200%)',
        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
        borderWidth: '1px',
        borderColor: colorMode === 'light'
            ? 'rgba(255, 255, 255, 0.5)'
            : 'rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: colorMode === 'light'
            ? '0 4px 16px -4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5)'
            : '0 4px 24px -8px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.2s ease',
    };

    if (loading) {
        return (
            <VStack h="100%" p={5} align="stretch" gap={5}>
                <Text color="text.secondary">Loading walkthrough details...</Text>
            </VStack>
        );
    }

    return (
        <VStack
            className="walkthrough-overview-scroll"
            h="100%"
            p={5}
            align="stretch"
            gap={5}
            overflowY="auto"
            position="relative"
        >
            {/* Back Button */}
            {onBack && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    alignSelf="flex-start"
                    css={{
                        borderRadius: '10px',
                        _hover: {
                            bg: colorMode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
                        },
                    }}
                >
                    <HStack gap={2}>
                        <Icon>
                            <LuArrowLeft />
                        </Icon>
                        <Text>Back</Text>
                    </HStack>
                </Button>
            )}

            {/* Main Unified Card */}
            <Card.Root variant="subtle" css={cardStyle}>
                <CardBody>
                    <VStack align="stretch" gap={0}>
                        {/* Collapsed Header Area */}
                        <VStack
                            align="stretch"
                            gap={3}
                            cursor="pointer"
                            onClick={() => setIsUnifiedExpanded(!isUnifiedExpanded)}
                            py={1}
                        >
                            <Flex justify="space-between" align="start">
                                <VStack align="start" gap={1} flex="1">
                                    <HStack gap={2}>
                                        <Icon boxSize={5} color="orange.500">
                                            <LuLightbulb />
                                        </Icon>
                                        <Text fontWeight="semibold" fontSize="md" lineClamp={2}>
                                            {details.name}
                                        </Text>
                                    </HStack>

                                    <Text fontSize="xs" color="text.secondary">
                                        {completedCount} / {totalCount} takeaways
                                        {progress > 0 && ` · ${Math.round(progress)}%`}
                                    </Text>
                                </VStack>
                                <IconButton
                                    aria-label="Open in editor"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenInEditor();
                                    }}
                                    css={{ borderRadius: '10px' }}
                                >
                                    <Icon>
                                        <LuExternalLink />
                                    </Icon>
                                </IconButton>
                            </Flex>

                            {totalCount > 0 && (
                                <Progress.Root
                                    value={progress}
                                    size="sm"
                                    colorPalette={progress >= 100 ? 'green' : 'orange'}
                                    css={{
                                        '& [data-part="range"]': {
                                            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important',
                                            background: progress >= 100
                                                ? 'linear-gradient(90deg, var(--chakra-colors-green-400), var(--chakra-colors-green-500))'
                                                : 'linear-gradient(90deg, var(--chakra-colors-orange-400), var(--chakra-colors-orange-500))',
                                        },
                                        '& [data-part="track"]': {
                                            overflow: 'hidden',
                                            borderRadius: '999px',
                                        },
                                    }}
                                >
                                    <Progress.Track>
                                        <Progress.Range />
                                    </Progress.Track>
                                </Progress.Root>
                            )}

                            <Center pt={1}>
                                <Icon
                                    color="text.tertiary"
                                    size="lg"
                                    transform={isUnifiedExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}
                                    transition="transform 0.2s ease"
                                >
                                    <LuChevronDown />
                                </Icon>
                            </Center>
                        </VStack>

                        {/* Expanded Content */}
                        <AnimatePresence>
                            {isUnifiedExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <VStack align="stretch" gap={4} pt={4}>
                                        <Box h="1px" bg="border.subtle" />

                                        {/* Takeaways Section */}
                                        <VStack align="stretch" gap={3}>
                                            <Flex justify="space-between" align="center">
                                                <HStack gap={2} color="text.secondary">
                                                    <Icon size="sm">
                                                        <LuLightbulb />
                                                    </Icon>
                                                    <Text fontSize="sm" fontWeight="medium">
                                                        Takeaways
                                                    </Text>
                                                    <Badge size="sm" variant="subtle" colorPalette="orange">
                                                        {completedCount}/{totalCount}
                                                    </Badge>
                                                </HStack>
                                                {details.takeaways.some(t => t.completed) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHideCompleted(!hideCompleted);
                                                        }}
                                                        css={{ fontSize: '11px' }}
                                                    >
                                                        {hideCompleted ? 'Show completed' : 'Hide completed'} ({details.takeaways.filter(t => t.completed).length})
                                                    </Button>
                                                )}
                                            </Flex>

                                            {/* Add Takeaway Input */}
                                            <HStack gap={2} onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                    ref={takeawayInputRef}
                                                    value={newTakeawayTitle}
                                                    onChange={(e) => setNewTakeawayTitle(e.target.value)}
                                                    onKeyDown={handleTakeawayKeyDown}
                                                    placeholder="Add a takeaway..."
                                                    size="sm"
                                                    css={{
                                                        borderRadius: '10px',
                                                        _focus: {
                                                            borderColor: 'orange.400',
                                                        },
                                                    }}
                                                />
                                                <Button
                                                    colorPalette="orange"
                                                    variant="solid"
                                                    size="sm"
                                                    onClick={handleAddTakeaway}
                                                    disabled={!newTakeawayTitle.trim()}
                                                    css={{ borderRadius: '10px' }}
                                                >
                                                    <HStack gap={1}>
                                                        <Icon>
                                                            <LuPlus />
                                                        </Icon>
                                                        <Text>Add</Text>
                                                    </HStack>
                                                </Button>
                                            </HStack>

                                            {/* Takeaways List */}
                                            <VStack align="stretch" gap={1} onClick={(e) => e.stopPropagation()}>
                                                <AnimatePresence>
                                                    {visibleTakeaways.map((takeaway) => (
                                                        <TakeawayItem
                                                            key={takeaway.id}
                                                            takeaway={takeaway}
                                                            onToggle={onToggleTakeaway}
                                                            onDelete={onDeleteTakeaway}
                                                            showDelete
                                                        />
                                                    ))}
                                                </AnimatePresence>
                                            </VStack>

                                            {details.takeaways.length === 0 && (
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
                                    </VStack>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </VStack>
                </CardBody>
            </Card.Root>

            {/* Notes Card */}
            <Card.Root variant="subtle" css={cardStyle}>
                <CardBody>
                    <VStack align="stretch" gap={3}>
                        <Flex justify="space-between" align="center">
                            <HStack gap={2} color="text.secondary">
                                <Icon size="sm">
                                    <LuLightbulb />
                                </Icon>
                                <Text fontSize="sm" fontWeight="medium">Notes</Text>
                            </HStack>
                            <IconButton
                                aria-label="Copy notes"
                                variant="ghost"
                                size="xs"
                                onClick={copyNotes}
                                disabled={!notes}
                            >
                                <Icon>
                                    {copiedNoteId === 'current' ? <LuCheck /> : <LuCopy />}
                                </Icon>
                            </IconButton>
                        </Flex>
                        <VStack align="stretch" gap={1}>
                            <Textarea
                                value={notes}
                                onChange={(e) => handleNotesChange(e.target.value)}
                                placeholder="Take notes about this walkthrough..."
                                rows={6}
                                resize="vertical"
                                css={{
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                }}
                            />
                            <Text fontSize="xs" color="text.tertiary" textAlign="right">
                                Auto-saved
                            </Text>
                        </VStack>
                    </VStack>
                </CardBody>
            </Card.Root>
        </VStack>
    );
}
