import { useEffect, useState, useCallback, useMemo } from 'react';
import {

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
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { LuCopy, LuCheck, LuTrash2, LuCircleCheck, LuPartyPopper, LuChevronDown, LuFileText, LuNotebook, LuTarget } from 'react-icons/lu';
import { ResourceFile } from '@/types/resource';
import { invokeWatchPlanFolder, invokeStopWatcher, invokeUpdatePlan, invokeGetPlanDocuments, invokeReorderPlanDocuments } from '@/ipc';
import { PlanDetails, PlanDocument } from '@/types/plan';
import { toaster } from '@/shared/components/ui/toaster';
import MilestoneTimeline from './MilestoneTimeline';
import PlanDocumentList from './PlanDocumentList';
import DeletePlanDialog from './DeletePlanDialog';
import { useColorMode } from '@/shared/contexts/ColorModeContext';


const MotionBox = motion.create(Box);

interface PlanOverviewPanelProps {
    plan: ResourceFile;
    planDetails: PlanDetails | null;
    loading: boolean;
    selectedDocumentId?: string;
    onSelectDocument?: (document: PlanDocument) => void;
    onPlanDeleted?: () => void | Promise<void>;
    onUpdate: () => void;
}


export default function PlanOverviewPanel({
    plan,
    planDetails,
    loading,
    selectedDocumentId,
    onSelectDocument,
    onPlanDeleted,
    onUpdate,
}: PlanOverviewPanelProps) {
    const { colorMode } = useColorMode();
    const [notes, setNotes] = useState<string>('');
    const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Generate unique key for localStorage based on plan path
    const notesKey = `bluekit-plan-notes-${plan.path}`;
    const planId = planDetails?.id || '';

    // Load notes from localStorage on mount
    useEffect(() => {
        const savedNotes = localStorage.getItem(notesKey);
        if (savedNotes !== null) {
            setNotes(savedNotes);
        }
    }, [notesKey]);

    // Incremental update for plan documents
    const updatePlanDocumentsIncremental = useCallback(async (_changedPaths: string[]) => {
        if (!planId || !planDetails) return;

        try {
            await invokeGetPlanDocuments(planId);
            // This will trigger a re-render from parent
            onUpdate();
        } catch (error) {
            console.error('Error updating plan documents incrementally:', error);
            onUpdate();
        }
    }, [planId, planDetails, onUpdate]);

    // Set up file watcher for plan folder
    useEffect(() => {
        if (!planId || !planDetails) return;

        let isMounted = true;
        let unlistenFn: (() => void) | null = null;

        const setupWatcher = async () => {
            try {
                await invokeWatchPlanFolder(planId, planDetails.folderPath);
                const eventName = `plan-documents-changed-${planId}`;

                const unlisten = await listen<string[]>(eventName, (event) => {
                    if (isMounted) {
                        const changedPaths = event.payload;
                        if (changedPaths.length > 0) {
                            updatePlanDocumentsIncremental(changedPaths);
                        } else {
                            onUpdate();
                        }
                    }
                });

                unlistenFn = unlisten;
            } catch (error) {
                console.error(`Failed to set up file watcher for plan ${planId}:`, error);
            }
        };

        setupWatcher();

        return () => {
            isMounted = false;
            if (unlistenFn) {
                unlistenFn();
            }

            const eventName = `plan-documents-changed-${planId}`;
            invokeStopWatcher(eventName).catch(err => {
                console.warn('Failed to stop plan folder watcher:', err);
            });
        };
    }, [planId, planDetails?.folderPath, updatePlanDocumentsIncremental, onUpdate]);

    // Auto-save notes to localStorage
    const autoSaveNotes = useCallback(() => {
        try {
            localStorage.setItem(notesKey, notes);
        } catch (error) {
            console.error('Failed to auto-save notes:', error);
        }
    }, [notes, notesKey]);

    useEffect(() => {
        const timer = setTimeout(() => {
            autoSaveNotes();
        }, 1000);

        return () => clearTimeout(timer);
    }, [notes, autoSaveNotes]);

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

    // Calculate progress
    const { totalMilestones, completedMilestones, progress } = useMemo(() => {
        const total = planDetails?.phases.reduce((sum, phase) => sum + phase.milestones.length, 0) || 0;
        const completed = planDetails?.phases.reduce(
            (sum, phase) => sum + phase.milestones.filter(m => m.completed).length,
            0
        ) || 0;
        const prog = total > 0 ? (completed / total) * 100 : 0;
        return { totalMilestones: total, completedMilestones: completed, progress: prog };
    }, [planDetails?.phases]);

    // Get status color palette
    const getStatusColorPalette = (status: string) => {
        switch (status) {
            case 'active':
                return 'blue';
            case 'completed':
                return 'green';
            case 'archived':
                return 'gray';
            default:
                return 'gray';
        }
    };

    // Complete plan handler
    const handleCompletePlan = async () => {
        if (!planDetails) return;

        setIsCompleting(true);
        try {
            await invokeUpdatePlan(planDetails.id, undefined, undefined, 'completed');
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);

            toaster.create({
                type: 'success',
                title: '🎉 Plan completed!',
                description: `Congratulations on completing "${planDetails.name}"`,
            });

            onUpdate();
        } catch (error) {
            console.error('Failed to complete plan:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to complete plan',
                description: String(error),
                closable: true,
            });
        } finally {
            setIsCompleting(false);
        }
    };

    // Handle plan deletion
    const handlePlanDeleted = async () => {
        // Notify parent to refresh the plans list
        if (onPlanDeleted) {
            await onPlanDeleted();
        }
    };

    // Stable callback for document selection
    const handleSelectDocument = useCallback((document: PlanDocument) => {
        onSelectDocument?.(document);
    }, [onSelectDocument]);

    // Individual section expand states
    const [isMilestonesExpanded, setIsMilestonesExpanded] = useState(true);
    const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(true);
    const [isNotesExpanded, setIsNotesExpanded] = useState(true);

    return (
        <Box
            h="100%"
            position="relative"
            display="flex"
            flexDirection="column"
            css={{
                background: colorMode === 'light'
                    ? '#EBEFF7'
                    : 'rgba(255, 255, 255, 0.05)',
                borderWidth: '0px',
                borderLeftWidth: '1px',
                borderColor: colorMode === 'light'
                    ? 'rgba(0, 0, 0, 0.06)'
                    : 'rgba(255, 255, 255, 0.08)',
                borderRadius: '0px',
                boxShadow: 'none',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Confetti Animation */}
            <AnimatePresence>
                {showConfetti && (
                    <MotionBox
                        position="fixed"
                        top="50%"
                        left="50%"
                        transform="translate(-50%, -50%)"
                        zIndex={1000}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.4, type: 'spring' }}
                    >
                        <Icon boxSize={24} color="green.500">
                            <LuPartyPopper />
                        </Icon>
                    </MotionBox>
                )}
            </AnimatePresence>

            {/* Delete Dialog */}
            {planDetails && (
                <DeletePlanDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setIsDeleteDialogOpen(false)}
                    onDeleted={handlePlanDeleted}
                    planId={planDetails.id}
                    planName={planDetails.name}
                    folderPath={planDetails.folderPath}
                />
            )}


            {/* Scrollable Content Area */}
            <VStack
                className="plan-overview-scroll"
                flex="1"
                minH={0}
                p={4}
                align="stretch"
                gap={4}
                overflowY="auto"
            >
                {loading ? (
                    <Text color="text.secondary">Loading plan details...</Text>
                ) : !planDetails ? (
                    <Text color="red.500">Failed to load plan details</Text>
                ) : (
                    <VStack align="stretch" gap={4}>

                        <VStack
                            align="stretch"
                            gap={6}
                        >
                            {/* Header Area */}
                            <VStack
                                align="stretch"
                                gap={3}
                                py={1}
                            >
                                <Flex justify="space-between" align="start">
                                    <VStack align="start" gap={1} flex="1">
                                        <Text fontWeight="semibold" fontSize="md">
                                            {planDetails.name}
                                        </Text>

                                        <Text fontSize="xs" color="text.secondary">
                                            {completedMilestones} / {totalMilestones} milestones · {Math.round(progress)}%
                                        </Text>
                                    </VStack>
                                    <Badge
                                        size="md"
                                        variant="subtle"
                                        colorPalette={getStatusColorPalette(planDetails.status)}
                                    >
                                        {planDetails.status}
                                    </Badge>
                                </Flex>

                                <Progress.Root
                                    value={progress}
                                    size="sm"
                                    colorPalette={progress >= 100 ? 'green' : 'primary'}
                                    css={{
                                        '& [data-part="range"]': {
                                            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important',
                                            background: progress >= 100
                                                ? 'linear-gradient(90deg, var(--chakra-colors-green-400), var(--chakra-colors-green-500))'
                                                : 'linear-gradient(90deg, var(--chakra-colors-primary-400), var(--chakra-colors-primary-500))',
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
                            </VStack>

                            {/* Action Buttons */}
                                            <HStack gap={2}>
                                                {planDetails.status !== 'completed' && (
                                                    <Button
                                                        colorPalette="green"
                                                        variant="subtle"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCompletePlan();
                                                        }}
                                                        loading={isCompleting}
                                                        loadingText="Completing..."
                                                        flex="1"
                                                        css={{
                                                            borderRadius: '10px',
                                                        }}
                                                    >
                                                        <HStack gap={2}>
                                                            <Icon>
                                                                <LuCircleCheck />
                                                            </Icon>
                                                            <Text>Complete</Text>
                                                        </HStack>
                                                    </Button>
                                                )}
                                                <Button
                                                    colorPalette="red"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsDeleteDialogOpen(true);
                                                    }}
                                                    flex="1"
                                                    css={{
                                                        borderRadius: '10px',
                                                    }}
                                                >
                                                    <HStack gap={2}>
                                                        <Icon>
                                                            <LuTrash2 />
                                                        </Icon>
                                                        <Text>Delete</Text>
                                                    </HStack>
                                                </Button>
                                            </HStack>

                                            {/* Milestones */}
                                            <VStack align="stretch" gap={3}>
                                                <HStack
                                                    gap={2}
                                                    color="text.secondary"
                                                    cursor="pointer"
                                                    onClick={() => setIsMilestonesExpanded(!isMilestonesExpanded)}
                                                >
                                                    <Icon
                                                        size="sm"
                                                        transform={isMilestonesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
                                                        transition="transform 0.2s ease"
                                                    >
                                                        <LuChevronDown />
                                                    </Icon>
                                                    <Icon size="sm">
                                                        <LuTarget />
                                                    </Icon>
                                                    <Text fontSize="sm" fontWeight="medium">
                                                        Milestones ({planDetails.phases.reduce((sum, p) => sum + p.milestones.filter(m => m.completed).length, 0)}/{planDetails.phases.reduce((sum, p) => sum + p.milestones.length, 0)})
                                                    </Text>
                                                </HStack>
                                                <AnimatePresence>
                                                    {isMilestonesExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                                            style={{ overflow: 'hidden' }}
                                                        >
                                                            <MilestoneTimeline
                                                                key={`milestone-${planDetails.id}`}
                                                                planId={planDetails.id}
                                                                phases={planDetails.phases}
                                                                onUpdate={onUpdate}
                                                                embedded={true}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </VStack>

                                            {/* Documents */}
                                            <VStack align="stretch" gap={3}>
                                                <HStack
                                                    gap={2}
                                                    color="text.secondary"
                                                    cursor="pointer"
                                                    onClick={() => setIsDocumentsExpanded(!isDocumentsExpanded)}
                                                >
                                                    <Icon
                                                        size="sm"
                                                        transform={isDocumentsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
                                                        transition="transform 0.2s ease"
                                                    >
                                                        <LuChevronDown />
                                                    </Icon>
                                                    <Icon size="sm">
                                                        <LuFileText />
                                                    </Icon>
                                                    <Text fontSize="sm" fontWeight="medium">
                                                        Documents ({planDetails.documents.length})
                                                    </Text>
                                                </HStack>
                                                <AnimatePresence>
                                                    {isDocumentsExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                                            style={{ overflow: 'hidden' }}
                                                        >
                                                            <PlanDocumentList
                                                                key={`documents-${planDetails.id}`}
                                                                documents={planDetails.documents}
                                                                selectedDocumentId={selectedDocumentId}
                                                                onSelectDocument={handleSelectDocument}
                                                                onDocumentDeleted={onUpdate}
                                                                onReorder={async (reorderedDocs) => {
                                                                    try {
                                                                        const docIds = reorderedDocs.map(d => d.id);
                                                                        await invokeReorderPlanDocuments(planDetails.id, docIds);
                                                                        onUpdate();
                                                                    } catch (error) {
                                                                        console.error("Failed to reorder documents:", error);
                                                                        toaster.create({
                                                                            type: 'error',
                                                                            title: 'Failed to reorder documents',
                                                                            description: String(error),
                                                                        });
                                                                    }
                                                                }}
                                                                hideHeader={true}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </VStack>
                                        </VStack>
                        <VStack align="stretch" gap={3}>
                            <Flex justify="space-between" align="center">
                                <HStack
                                    gap={2}
                                    color="text.secondary"
                                    cursor="pointer"
                                    onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                                >
                                    <Icon
                                        size="sm"
                                        transform={isNotesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
                                        transition="transform 0.2s ease"
                                    >
                                        <LuChevronDown />
                                    </Icon>
                                    <Icon size="sm">
                                        <LuNotebook />
                                    </Icon>
                                    <Text fontSize="sm" fontWeight="medium">Notes</Text>
                                </HStack>
                                {notes && (
                                    <IconButton
                                        aria-label="Copy notes"
                                        variant="ghost"
                                        size="xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyNotes();
                                        }}
                                    >
                                        <Icon>
                                            {copiedNoteId === 'current' ? <LuCheck /> : <LuCopy />}
                                        </Icon>
                                    </IconButton>
                                )}
                            </Flex>
                            <AnimatePresence>
                                {isNotesExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <VStack align="stretch" gap={1}>
                                            <Textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Take notes about this plan..."
                                                rows={6}
                                                resize="vertical"
                                                css={{
                                                    borderRadius: '10px',
                                                    fontSize: '13px',
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <Text fontSize="xs" color="text.tertiary" textAlign="right">
                                                Auto-saved
                                            </Text>
                                        </VStack>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </VStack>

                    </VStack>
                )}
            </VStack>
        </Box>
    );
}
