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
  Spinner,
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { LuArrowLeft, LuCopy, LuCheck, LuFileText, LuCode, LuTrash2 } from 'react-icons/lu';
import { RiClaudeFill } from 'react-icons/ri';
import { ResourceFile } from '../../types/resource';
import { invokeGetPlanDetails, invokeGetPlanDocuments, invokeWatchPlanFolder, invokeStopWatcher, invokeLinkBrainstormToPlan, invokeUnlinkBrainstormFromPlan, invokeLinkMultiplePlansToPlan, invokeUnlinkPlanFromPlan, invokeReadFile } from '../../ipc';
import { invokeGetPlansFiles } from '../../ipc/artifacts';
import { ArtifactFile } from '../../ipc/types';
import { PlanDetails, PlanDocument } from '../../types/plan';
import { toaster } from '../ui/toaster';
import MilestoneTimeline from './MilestoneTimeline';
import PlanDocumentList from './PlanDocumentList';
import { useResource } from '../../contexts/ResourceContext';

interface PlanOverviewProps {
  plan: ResourceFile;
  onBack?: () => void;
}

export default function PlanOverview({ plan, onBack }: PlanOverviewProps) {
  const { setSelectedResource } = useResource();
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<string>('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>(undefined);
  
  // Plan linking state
  const [claudePlans, setClaudePlans] = useState<ArtifactFile[]>([]);
  const [cursorPlans, setCursorPlans] = useState<ArtifactFile[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'claude' | 'cursor' | null>(null);
  const [selectedPlanPaths, setSelectedPlanPaths] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);
  const [linkedPlanSource, setLinkedPlanSource] = useState<'claude' | 'cursor' | null>(null);

  // Get plan ID from resource path or frontMatter
  // The plan ID should be stored in the resource when it's created
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

      // Detect source from linked plans (use first one if available)
      if (details.linkedPlans && details.linkedPlans.length > 0) {
        const firstSource = details.linkedPlans[0].source;
        setLinkedPlanSource(firstSource === 'claude' || firstSource === 'cursor' ? firstSource : null);
      } else {
        setLinkedPlanSource(null);
      }
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
  const updatePlanDocumentsIncremental = useCallback(async (changedPaths: string[]) => {
    if (!planId || !planDetails) return;

    try {
      const updatedDocuments = await invokeGetPlanDocuments(planId);
      setPlanDetails(prev => {
        if (!prev) return prev;
        return { ...prev, documents: updatedDocuments };
      });
    } catch (error) {
      console.error('Error updating plan documents incrementally:', error);
      // Fallback to full reload on error
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
        // Start watching the plan folder
        await invokeWatchPlanFolder(planId, planDetails.folderPath);

        // Generate the event name (must match the Rust code)
        const eventName = `plan-documents-changed-${planId}`;

        // Listen for file change events - receive changed file paths
        const unlisten = await listen<string[]>(eventName, (event) => {
          if (isMounted) {
            const changedPaths = event.payload;
            console.log(
              `Plan documents changed for ${planId}, ${changedPaths.length} files changed`
            );
            if (changedPaths.length > 0) {
              updatePlanDocumentsIncremental(changedPaths);
            } else {
              // If no paths provided, fallback to full reload
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

    // Cleanup function - called when component unmounts or plan changes
    return () => {
      isMounted = false;
      if (unlistenFn) {
        unlistenFn();
      }

      // Stop the backend watcher to prevent resource leaks
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

  // Auto-save after 1 second of inactivity
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

  // Calculate progress - memoized to prevent unnecessary recalculations
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

  // Load plans from a source
  const loadPlansFromSource = async (source: 'claude' | 'cursor') => {
    setSelectedSource(source);
    setLoadingPlans(true);
    setSelectedPlanPaths([]);
    try {
      const plans = await invokeGetPlansFiles(source);
      if (source === 'claude') {
        setClaudePlans(plans);
      } else {
        setCursorPlans(plans);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to load plans',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoadingPlans(false);
    }
  };

  // Toggle plan selection
  const togglePlanSelection = (path: string) => {
    setSelectedPlanPaths(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      } else {
        return [...prev, path];
      }
    });
  };

  // Link selected plans
  const handleLinkPlans = async () => {
    if (selectedPlanPaths.length === 0 || !planDetails || !selectedSource) return;

    setLinking(true);
    try {
      await invokeLinkMultiplePlansToPlan(
        planDetails.id,
        selectedPlanPaths,
        selectedSource
      );

      const sourceName = selectedSource.charAt(0).toUpperCase() + selectedSource.slice(1);
      const message = selectedPlanPaths.length > 1
        ? `Successfully linked ${selectedPlanPaths.length} ${sourceName} plans`
        : `Successfully linked ${sourceName} plan`;

      toaster.create({
        type: 'success',
        title: `${sourceName} plan${selectedPlanPaths.length > 1 ? 's' : ''} linked`,
        description: message,
      });
      setSelectedSource(null);
      setSelectedPlanPaths([]);
      loadPlanDetails();
    } catch (error) {
      console.error('Failed to link plans:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to link plan',
        description: String(error),
        closable: true,
      });
    } finally {
      setLinking(false);
    }
  };


  // Unlink a specific plan from plan
  const handleUnlinkPlan = async (linkedPlanPath: string) => {
    if (!planDetails) return;

    try {
      await invokeUnlinkPlanFromPlan(planDetails.id, linkedPlanPath);

      toaster.create({
        type: 'success',
        title: 'Plan unlinked',
        description: 'Successfully removed linked plan',
      });
      loadPlanDetails();
    } catch (error) {
      console.error('Failed to unlink plan:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to unlink',
        description: String(error),
        closable: true,
      });
    }
  };

  // Get plans for current source
  const currentPlans = selectedSource === 'claude' ? claudePlans : cursorPlans;

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
      bg="bg.subtle"
    >
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
          <Card.Root variant="subtle">
            <CardBody>
              <VStack align="stretch" gap={3}>
                <Flex justify="space-between" align="start">
                  <Heading size="lg">{planDetails.name}</Heading>
                  <Badge
                    size="md"
                    variant="subtle"
                    colorPalette={getStatusColorPalette(planDetails.status)}
                  >
                    {planDetails.status}
                  </Badge>
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
                    colorPalette="primary"
                    css={{
                      '& [data-part="range"]': {
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important',
                        transitionProperty: 'width, transform !important',
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
              </VStack>
            </CardBody>
          </Card.Root>

          {/* Linked Plans Section */}
          <Card.Root variant="subtle">
            <CardBody>
              <VStack align="stretch" gap={3}>
                {/* Add Plan Section - Always visible, always says "Add Plan" */}
                {!selectedSource ? (
                  <>
                    <Text fontSize="sm" fontWeight="medium">
                      Add Plan
                    </Text>
                      <HStack gap={3}>
                        {/* Claude Box */}
                        <Card.Root
                          variant="outline"
                          cursor="pointer"
                          onClick={() => loadPlansFromSource('claude')}
                          borderWidth="2px"
                          borderColor="border.subtle"
                          _hover={{
                            borderColor: 'orange.300',
                            bg: 'orange.50',
                            _dark: {
                              bg: 'orange.950',
                            },
                          }}
                          flex="1"
                          transition="all 0.2s"
                        >
                          <CardBody p={4}>
                            <VStack gap={2}>
                              <Icon color="orange.500" boxSize={6}>
                                <RiClaudeFill />
                              </Icon>
                              <Text fontSize="sm" fontWeight="medium">
                                Claude
                              </Text>
                            </VStack>
                          </CardBody>
                        </Card.Root>

                        {/* Cursor Box */}
                        <Card.Root
                          variant="outline"
                          cursor="pointer"
                          onClick={() => loadPlansFromSource('cursor')}
                          borderWidth="2px"
                          borderColor="border.subtle"
                          _hover={{
                            borderColor: 'blue.300',
                            bg: 'blue.50',
                            _dark: {
                              bg: 'blue.950',
                            },
                          }}
                          flex="1"
                          transition="all 0.2s"
                        >
                          <CardBody p={4}>
                            <VStack gap={2}>
                              <Icon color="blue.500" boxSize={6}>
                                <LuCode />
                              </Icon>
                              <Text fontSize="sm" fontWeight="medium">
                                Cursor
                              </Text>
                            </VStack>
                          </CardBody>
                        </Card.Root>
                      </HStack>
                    </>
                  ) : (
                    <>
                      <Flex justify="space-between" align="center">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setSelectedSource(null);
                            setSelectedPlanPaths([]);
                          }}
                        >
                          ← Back
                        </Button>
                        <HStack gap={1}>
                          <Icon color={selectedSource === 'claude' ? 'orange.500' : 'blue.500'}>
                            {selectedSource === 'claude' ? <RiClaudeFill /> : <LuCode />}
                          </Icon>
                          <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
                            {selectedSource} Plans
                          </Text>
                        </HStack>
                      </Flex>

                      {loadingPlans ? (
                        <Flex justify="center" py={4}>
                          <Spinner size="sm" />
                        </Flex>
                      ) : currentPlans.length === 0 ? (
                        <Text fontSize="sm" color="text.tertiary" textAlign="center" py={4}>
                          No {selectedSource} plans found
                        </Text>
                      ) : (
                        <VStack align="stretch" gap={2} maxH="200px" overflowY="auto">
                          {currentPlans.map((p) => {
                            const isSelected = selectedPlanPaths.includes(p.path);
                            return (
                              <Card.Root
                                key={p.path}
                                variant="outline"
                                cursor="pointer"
                                onClick={() => togglePlanSelection(p.path)}
                                borderWidth="1px"
                                borderColor={isSelected ? 'primary.500' : 'border.subtle'}
                                bg={isSelected ? 'primary.50' : 'transparent'}
                                transition="all 0.2s ease-in-out"
                                _hover={{ borderColor: 'primary.300' }}
                                _dark={{
                                  bg: isSelected ? 'blue.950/30' : 'transparent',
                                  borderColor: isSelected ? 'blue.500/50' : 'border.subtle',
                                }}
                              >
                                <CardBody p={2}>
                                  <HStack gap={2}>
                                    <Icon color="primary.500" boxSize={4}>
                                      <LuFileText />
                                    </Icon>
                                    <Text fontSize="xs" fontWeight="medium" noOfLines={1}>
                                      {p.name}
                                    </Text>
                                  </HStack>
                                </CardBody>
                              </Card.Root>
                            );
                          })}
                        </VStack>
                      )}

                      {selectedPlanPaths.length > 0 && (
                        <Button
                          size="sm"
                          colorPalette="primary"
                          onClick={handleLinkPlans}
                          loading={linking}
                          loadingText="Linking..."
                        >
                          Link {selectedPlanPaths.length} Plan{selectedPlanPaths.length > 1 ? 's' : ''}
                        </Button>
                      )}
                    </>
                  )}

                {/* Show linked plans if they exist - styled like documents */}
                {planDetails.linkedPlans && planDetails.linkedPlans.length > 0 && (
                  <VStack align="stretch" gap={2} pt={3} borderTopWidth="1px" borderColor="border.subtle">
                    <Text fontSize="sm" fontWeight="medium" color="text.secondary">
                      Linked Plans ({planDetails.linkedPlans.length})
                    </Text>
                    <VStack align="stretch" gap={2}>
                      {planDetails.linkedPlans.map((linkedPlan) => (
                        <Card.Root
                          key={linkedPlan.id}
                          variant="subtle"
                          borderWidth="1px"
                          borderColor="border.subtle"
                          cursor="pointer"
                          onClick={async () => {
                            try {
                              const content = await invokeReadFile(linkedPlan.linkedPlanPath);
                              const fileName = linkedPlan.linkedPlanPath.split('/').pop() || 'plan';
                              const resourceFile: ResourceFile = {
                                path: linkedPlan.linkedPlanPath,
                                name: fileName,
                                frontMatter: {},
                                resourceType: 'plan',
                              };
                              setSelectedResource(resourceFile, content, 'plan');
                            } catch (error) {
                              console.error('Failed to open linked plan:', error);
                              toaster.create({
                                type: 'error',
                                title: 'Failed to open file',
                                description: String(error),
                                closable: true,
                              });
                            }
                          }}
                          transition="all 0.2s ease-in-out"
                          _hover={{
                            transform: 'translateY(-2px)',
                            shadow: 'sm',
                          }}
                          role="group"
                        >
                          <CardBody>
                            <HStack justify="space-between" align="start" gap={3}>
                              <HStack gap={2} flex="1" minW={0}>
                                <Icon color="primary.500">
                                  <LuFileText />
                                </Icon>
                                <VStack align="start" gap={0} flex="1" minW={0}>
                                  <Text
                                    fontSize="sm"
                                    fontWeight="medium"
                                    noOfLines={1}
                                    title={linkedPlan.linkedPlanPath}
                                  >
                                    {linkedPlan.linkedPlanPath.split('/').pop()}
                                  </Text>
                                  <Badge size="sm" variant="subtle" colorPalette={linkedPlan.source === 'claude' ? 'orange' : 'blue'}>
                                    {linkedPlan.source}
                                  </Badge>
                                </VStack>
                              </HStack>

                              <IconButton
                                aria-label="Unlink plan"
                                variant="ghost"
                                size="xs"
                                colorPalette="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlinkPlan(linkedPlan.linkedPlanPath);
                                }}
                                css={{
                                  opacity: 0,
                                  transition: 'opacity 0.2s ease-in-out',
                                  '[role="group"]:hover &': {
                                    opacity: 1,
                                  },
                                }}
                              >
                                <Icon>
                                  <LuTrash2 />
                                </Icon>
                              </IconButton>
                            </HStack>
                          </CardBody>
                        </Card.Root>
                      ))}
                    </VStack>
                  </VStack>
                )}
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
          <Card.Root variant="subtle">
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
