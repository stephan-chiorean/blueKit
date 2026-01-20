import { useEffect, useState, useCallback, useMemo } from 'react';
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
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { LuArrowLeft, LuCopy, LuCheck, LuTrash2, LuCircleCheck, LuPartyPopper, LuChevronDown, LuFileText, LuNotebook } from 'react-icons/lu';
import { ResourceFile } from '../../types/resource';
import { invokeWatchPlanFolder, invokeStopWatcher, invokeUpdatePlan, invokeGetPlanDocuments } from '../../ipc';
import { PlanDetails, PlanDocument } from '../../types/plan';
import { toaster } from '../ui/toaster';
import MilestoneTimeline from './MilestoneTimeline';
import PlanDocumentList from './PlanDocumentList';
import DeletePlanDialog from './DeletePlanDialog';
import { useColorMode } from '../../contexts/ColorModeContext';

const MotionBox = motion.create(Box);

interface PlanOverviewPanelProps {
    plan: ResourceFile;
    planDetails: PlanDetails | null;
    loading: boolean;
    selectedDocumentId?: string;
    onSelectDocument?: (document: PlanDocument) => void;
    onBack?: () => void;
    onPlanDeleted?: () => void | Promise<void>;
    onUpdate: () => void;
}

const CollapsibleCard = ({
    title,
    icon,
    children,
    headerContent,
    defaultExpanded = true,
}: {
    title: React.ReactNode;
    icon?: React.ReactNode;
    children: React.ReactNode;
    headerContent?: React.ReactNode;
    defaultExpanded?: boolean;
}) => {
    const { colorMode } = useColorMode();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

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

    return (
        <Card.Root variant="subtle" css={cardStyle}>
            <CardBody>
                <VStack align="stretch" gap={0}>
                    <Flex
                        justify="space-between"
                        align="center"
                        cursor="pointer"
                        onClick={() => setIsExpanded(!isExpanded)}
                        py={1}
                    >
                        <HStack gap={2}>
                            <Icon
                                boxSize={5}
                                color="text.secondary"
                                transform={isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
                                transition="transform 0.2s ease"
                            >
                                <LuChevronDown />
                            </Icon>
                            {icon && (
                                <Icon boxSize={4} color="text.secondary">
                                    {icon}
                                </Icon>
                            )}
                            <Box fontWeight="medium" fontSize="sm">
                                {title}
                            </Box>
                        </HStack>
                        <Box onClick={(e) => e.stopPropagation()}>
                            {headerContent}
                        </Box>
                    </Flex>
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                style={{ overflow: 'hidden' }}
                            >
                                <Box pt={4}>
                                    {children}
                                </Box>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </VStack>
            </CardBody>
        </Card.Root>
    );
};

export default function PlanOverviewPanel({
    plan,
    planDetails,
    loading,
    selectedDocumentId,
    onSelectDocument,
    onBack,
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
        // Navigate back after deletion
        if (onBack) {
            onBack();
        }
    };

    // Stable callback for document selection
    const handleSelectDocument = useCallback((document: PlanDocument) => {
        onSelectDocument?.(document);
    }, [onSelectDocument]);

    // Background is now handled by parent Splitter.Panel in PlanWorkspace
    return (
        <VStack
            h="100%"
            p={5}
            align="stretch"
            gap={5}
            overflowY="auto"
            position="relative"
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

            {loading ? (
                <Text color="text.secondary">Loading plan details...</Text>
            ) : !planDetails ? (
                <Text color="red.500">Failed to load plan details</Text>
            ) : (
                <>
                    {/* Plan Metadata with Progress */}
                    <CollapsibleCard
                        title={planDetails.name}
                        headerContent={
                            <Badge
                                size="md"
                                variant="subtle"
                                colorPalette={getStatusColorPalette(planDetails.status)}
                            >
                                {planDetails.status}
                            </Badge>
                        }
                    >
                        <VStack align="stretch" gap={4}>
                            {planDetails.description && (
                                <Text fontSize="sm" color="text.secondary">
                                    {planDetails.description}
                                </Text>
                            )}

                            {/* Progress Indicator */}
                            <VStack align="stretch" gap={2}>
                                <Flex justify="space-between" align="center">
                                    <Text fontSize="sm" fontWeight="medium">
                                        Progress
                                    </Text>
                                    <Text fontSize="sm" color="text.secondary" transition="all 0.3s ease-out">
                                        {completedMilestones} / {totalMilestones} milestones
                                    </Text>
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
                            <HStack gap={2} pt={1}>
                                {planDetails.status !== 'completed' && (
                                    <Button
                                        colorPalette="green"
                                        variant="subtle"
                                        size="sm"
                                        onClick={handleCompletePlan}
                                        loading={isCompleting}
                                        loadingText="Completing..."
                                        css={{
                                            borderRadius: '10px',
                                            transition: 'all 0.2s ease',
                                            _hover: {
                                                transform: 'scale(1.02)',
                                            },
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
                                    onClick={() => setIsDeleteDialogOpen(true)}
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
                        </VStack>
                    </CollapsibleCard>

                    {/* Milestone Timeline */}
                    <MilestoneTimeline
                        key={`milestone-${planDetails.id}`}
                        planId={planDetails.id}
                        phases={planDetails.phases}
                        onUpdate={onUpdate}
                    />

                    {/* Document List */}
                    <CollapsibleCard
                        title="Documents"
                        icon={<LuFileText />}
                        headerContent={
                            <Badge variant="subtle" size="sm">
                                {planDetails.documents.length}
                            </Badge>
                        }
                    >
                        <PlanDocumentList
                            key={`documents-${planDetails.id}`}
                            documents={planDetails.documents}
                            selectedDocumentId={selectedDocumentId}
                            onSelectDocument={handleSelectDocument}
                            onDocumentDeleted={onUpdate}
                            hideHeader={true}
                        />
                    </CollapsibleCard>

                    {/* Notepad */}
                    <CollapsibleCard
                        title="Notes"
                        icon={<LuNotebook />}
                        headerContent={
                            <IconButton
                                aria-label="Copy notes"
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyNotes();
                                }}
                                disabled={!notes}
                            >
                                <Icon>
                                    {copiedNoteId === 'current' ? <LuCheck /> : <LuCopy />}
                                </Icon>
                            </IconButton>
                        }
                    >
                        <VStack align="stretch" gap={3}>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Take notes about this plan..."
                                rows={4}
                                resize="vertical"
                                css={{
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                }}
                            />
                            <Text fontSize="xs" color="text.tertiary">
                                Auto-saved to browser
                            </Text>
                        </VStack>
                    </CollapsibleCard>
                </>
            )}
        </VStack>
    );
}
