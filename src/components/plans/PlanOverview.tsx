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
  Heading,
  Box,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { LuArrowLeft, LuCopy, LuCheck, LuTrash2, LuCircleCheck, LuPartyPopper } from 'react-icons/lu';
import { ResourceFile } from '../../types/resource';
import { invokeGetPlanDetails, invokeGetPlanDocuments, invokeWatchPlanFolder, invokeStopWatcher, invokeUpdatePlan } from '../../ipc';
import { PlanDetails, PlanDocument } from '../../types/plan';
import { toaster } from '../ui/toaster';
import MilestoneTimeline from './MilestoneTimeline';
import PlanDocumentList from './PlanDocumentList';
import DeletePlanDialog from './DeletePlanDialog';

const MotionBox = motion.create(Box);

interface PlanOverviewProps {
  plan: ResourceFile;
  onBack?: () => void;
  onPlanDeleted?: () => void;
}

export default function PlanOverview({ plan, onBack, onPlanDeleted }: PlanOverviewProps) {
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<string>('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Get plan ID from resource path or frontMatter
  const planId = (plan as any).id || plan.frontMatter?.id || '';

  // Generate unique key for localStorage based on plan path
  const notesKey = `bluekit-plan-notes-${plan.path}`;

  // Load plan details
  const loadPlanDetails = useCallback(async () => {
    if (!planId) {
      console.error('No plan ID found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const details = await invokeGetPlanDetails(planId);
      setPlanDetails(details);
    } catch (error) {
      console.error('Failed to load plan details:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to load plan details',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [planId]);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem(notesKey);
    if (savedNotes !== null) {
      setNotes(savedNotes);
    }
  }, [notesKey]);

  // Load plan details on mount
  useEffect(() => {
    loadPlanDetails();
  }, [loadPlanDetails]);

  // Incremental update for plan documents
  const updatePlanDocumentsIncremental = useCallback(async (_changedPaths: string[]) => {
    if (!planId || !planDetails) return;

    try {
      const updatedDocuments = await invokeGetPlanDocuments(planId);
      setPlanDetails(prev => {
        if (!prev) return prev;
        return { ...prev, documents: updatedDocuments };
      });
    } catch (error) {
      console.error('Error updating plan documents incrementally:', error);
      loadPlanDetails();
    }
  }, [planId, planDetails]);

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
              loadPlanDetails();
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
  }, [planId, planDetails?.folderPath, updatePlanDocumentsIncremental, loadPlanDetails]);

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

      loadPlanDetails();
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
  const handlePlanDeleted = () => {
    if (onPlanDeleted) {
      onPlanDeleted();
    }
    if (onBack) {
      onBack();
    }
  };

  // Stable callback for document selection
  const handleSelectDocument = useCallback((document: PlanDocument) => {
    setSelectedDocumentId(document.id);
  }, []);

  return (
    <VStack
      h="100%"
      p={6}
      align="stretch"
      gap={6}
      overflowY="auto"
      position="relative"
      css={{
        background: 'rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRight: '1px solid rgba(255, 255, 255, 0.15)',
        _dark: {
          background: 'rgba(20, 20, 25, 0.4)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
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

      {/* Back Button */}
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          alignSelf="flex-start"
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
          <Card.Root
            variant="subtle"
            css={{
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderWidth: '1px',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '20px',
              _dark: {
                background: 'rgba(30, 30, 35, 0.7)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <CardBody>
              <VStack align="stretch" gap={4}>
                <Flex justify="space-between" align="start">
                  <Heading size="lg">{planDetails.name}</Heading>
                  <HStack gap={2}>
                    <Badge
                      size="md"
                      variant="subtle"
                      colorPalette={getStatusColorPalette(planDetails.status)}
                    >
                      {planDetails.status}
                    </Badge>
                  </HStack>
                </Flex>
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
                    size="md"
                    colorPalette={progress >= 100 ? 'green' : 'primary'}
                    css={{
                      '& [data-part="range"]': {
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important',
                        background: progress >= 100
                          ? 'linear-gradient(90deg, var(--chakra-colors-green-400), var(--chakra-colors-green-500))'
                          : undefined,
                      },
                      '& [data-part="track"]': {
                        overflow: 'hidden',
                      },
                    }}
                  >
                    <Progress.Track>
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                  <Text fontSize="xs" color="text.secondary" textAlign="right" transition="all 0.3s ease-out">
                    {Math.round(progress)}%
                  </Text>
                </VStack>

                {/* Action Buttons */}
                <HStack gap={3} pt={2}>
                  {planDetails.status !== 'completed' && (
                    <Button
                      colorPalette="green"
                      variant="subtle"
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
                        <Text>Complete Plan</Text>
                      </HStack>
                    </Button>
                  )}
                  <Button
                    colorPalette="red"
                    variant="ghost"
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
            </CardBody>
          </Card.Root>

          {/* Milestone Timeline */}
          <MilestoneTimeline
            key={`milestone-${planDetails.id}`}
            planId={planDetails.id}
            phases={planDetails.phases}
            onUpdate={loadPlanDetails}
          />

          {/* Document List */}
          <PlanDocumentList
            key={`documents-${planDetails.id}`}
            documents={planDetails.documents}
            phases={planDetails.phases}
            selectedDocumentId={selectedDocumentId}
            onSelectDocument={handleSelectDocument}
            onDocumentDeleted={loadPlanDetails}
          />

          {/* Notepad */}
          <Card.Root
            variant="subtle"
            css={{
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderWidth: '1px',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '20px',
              _dark: {
                background: 'rgba(30, 30, 35, 0.7)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <CardBody>
              <VStack align="stretch" gap={3}>
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm" fontWeight="medium">
                    Notes
                  </Text>
                  <HStack gap={1}>
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
                  </HStack>
                </Flex>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Take notes about this plan..."
                  rows={6}
                  resize="vertical"
                  css={{
                    borderRadius: '12px',
                  }}
                />
                <Text fontSize="xs" color="text.tertiary">
                  Auto-saved to browser storage
                </Text>
              </VStack>
            </CardBody>
          </Card.Root>
        </>
      )}
    </VStack>
  );
}
