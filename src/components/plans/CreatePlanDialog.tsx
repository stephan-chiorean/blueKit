import { useState, useMemo } from 'react';
import {
  Dialog,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Field,
  Portal,
  CloseButton,
  Box,
  Text,
  Icon,
  IconButton,
  Badge,
  Card,
  CardBody,
  ScrollArea,
  Separator,
} from '@chakra-ui/react';
import { LuPlus, LuX, LuTrash2, LuGripVertical, LuMap } from 'react-icons/lu';
import { invokeCreatePlan, invokeCreatePlanPhase, invokeCreatePlanMilestone } from '../../ipc';
import { toaster } from '../ui/toaster';

interface Milestone {
  id: string;
  name: string;
  description?: string;
  phaseId?: string; // undefined = ungrouped
}

interface Phase {
  id: string;
  name: string;
  description?: string;
  orderIndex: number;
}

interface CreatePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanCreated: () => void;
  projectId: string;
  projectPath: string;
}

export default function CreatePlanDialog({
  isOpen,
  onClose,
  onPlanCreated,
  projectId,
  projectPath,
}: CreatePlanDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phases, setPhases] = useState<Phase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  
  // New milestone/phase form state
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [selectedPhaseForMilestone, setSelectedPhaseForMilestone] = useState<string>('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseDescription, setNewPhaseDescription] = useState('');

  // Group milestones by phase
  const milestonesByPhase = useMemo(() => {
    const grouped: Record<string, Milestone[]> = {};
    const ungrouped: Milestone[] = [];

    milestones.forEach((milestone) => {
      if (milestone.phaseId) {
        if (!grouped[milestone.phaseId]) {
          grouped[milestone.phaseId] = [];
        }
        grouped[milestone.phaseId].push(milestone);
      } else {
        ungrouped.push(milestone);
      }
    });

    return { grouped, ungrouped };
  }, [milestones]);

  const handleAddPhase = () => {
    if (!newPhaseName.trim()) return;

    const newPhase: Phase = {
      id: `phase-${Date.now()}`,
      name: newPhaseName.trim(),
      description: newPhaseDescription.trim() || undefined,
      orderIndex: phases.length,
    };

    setPhases([...phases, newPhase]);
    setNewPhaseName('');
    setNewPhaseDescription('');
  };

  const handleDeletePhase = (phaseId: string) => {
    setPhases(phases.filter((p) => p.id !== phaseId));
    // Unlink milestones from deleted phase
    setMilestones(
      milestones.map((m) => (m.phaseId === phaseId ? { ...m, phaseId: undefined } : m))
    );
  };

  const handleAddMilestone = () => {
    if (!newMilestoneName.trim()) return;

    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      name: newMilestoneName.trim(),
      description: newMilestoneDescription.trim() || undefined,
      phaseId: selectedPhaseForMilestone || undefined,
    };

    setMilestones([...milestones, newMilestone]);
    setNewMilestoneName('');
    setNewMilestoneDescription('');
    setSelectedPhaseForMilestone('');
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    setMilestones(milestones.filter((m) => m.id !== milestoneId));
  };

  const handleMoveMilestoneToPhase = (milestoneId: string, phaseId?: string) => {
    setMilestones(
      milestones.map((m) => (m.id === milestoneId ? { ...m, phaseId } : m))
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toaster.create({
        type: 'error',
        title: 'Name required',
        description: 'Please enter a plan name',
        closable: true,
      });
      return;
    }

    if (!projectPath) {
      toaster.create({
        type: 'error',
        title: 'Project not found',
        description: 'Could not determine project path',
        closable: true,
      });
      return;
    }

    setLoading(true);
    try {
      // Create plan
      const plan = await invokeCreatePlan(
        projectId,
        projectPath,
        name.trim(),
        description.trim() || undefined
      );

      // Create phases
      const createdPhases = await Promise.all(
        phases.map((phase) =>
          invokeCreatePlanPhase(plan.id, phase.name, phase.description, phase.orderIndex)
        )
      );

      // If we have ungrouped milestones, create a default "Ungrouped" phase
      const hasUngroupedMilestones = milestones.some((m) => !m.phaseId);
      let ungroupedPhaseId: string | undefined;
      if (hasUngroupedMilestones) {
        const ungroupedPhase = await invokeCreatePlanPhase(
          plan.id,
          'Ungrouped',
          'Milestones not assigned to a specific phase',
          createdPhases.length
        );
        ungroupedPhaseId = ungroupedPhase.id;
      }

      // Create milestones (grouped by phase)
      const phaseMap = new Map(phases.map((phase, idx) => [phase.id, createdPhases[idx].id]));
      
      await Promise.all(
        milestones.map((milestone, index) => {
          const phaseId = milestone.phaseId
            ? phaseMap.get(milestone.phaseId)
            : ungroupedPhaseId || phaseMap.get(undefined);
          
          if (!phaseId) {
            throw new Error(`No phase found for milestone: ${milestone.name}`);
          }
          
          return invokeCreatePlanMilestone(
            phaseId,
            milestone.name,
            milestone.description,
            index // orderIndex
          );
        })
      );

      toaster.create({
        type: 'success',
        title: 'Plan created',
        description: `Created plan: ${name.trim()}`,
      });

      onPlanCreated();

      // Reset form
      setName('');
      setDescription('');
      setPhases([]);
      setMilestones([]);
      setNewMilestoneName('');
      setNewMilestoneDescription('');
      setSelectedPhaseForMilestone('');
      setNewPhaseName('');
      setNewPhaseDescription('');

      onClose();
    } catch (error) {
      console.error('Failed to create plan:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to create plan',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setDescription('');
      setPhases([]);
      setMilestones([]);
      setNewMilestoneName('');
      setNewMilestoneDescription('');
      setSelectedPhaseForMilestone('');
      setNewPhaseName('');
      setNewPhaseDescription('');
      onClose();
    }
  };

  return (
    <Portal>
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="4xl" maxH="90vh">
            <Dialog.Header>
              <Dialog.Title>Create Plan</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton aria-label="Close" size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <ScrollArea.Root h="calc(90vh - 200px)">
                <ScrollArea.Viewport>
                  <VStack gap={6} align="stretch" p={2}>
                    {/* Basic Plan Info */}
                    <VStack align="stretch" gap={4}>
                      <Field.Root required>
                        <Field.Label>Plan Name</Field.Label>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter plan name..."
                          disabled={loading}
                        />
                        <Field.HelperText>
                          A folder with this name will be created in .bluekit/plans/
                        </Field.HelperText>
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Description</Field.Label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Optional description..."
                          disabled={loading}
                          rows={2}
                        />
                      </Field.Root>
                    </VStack>

                    <Separator />

                    {/* Phases Section */}
                    <VStack align="stretch" gap={3}>
                      <HStack justify="space-between" align="center">
                        <Text fontSize="md" fontWeight="medium">
                          Phases
                        </Text>
                        <HStack gap={2} flex="1" maxW="400px">
                          <Input
                            placeholder="Phase name..."
                            value={newPhaseName}
                            onChange={(e) => setNewPhaseName(e.target.value)}
                            size="sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddPhase();
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={handleAddPhase}
                            disabled={!newPhaseName.trim()}
                          >
                            <HStack gap={1}>
                              <Icon>
                                <LuPlus />
                              </Icon>
                              <Text>Add Phase</Text>
                            </HStack>
                          </Button>
                        </HStack>
                      </HStack>

                      {phases.length > 0 && (
                        <VStack align="stretch" gap={2}>
                          {phases.map((phase) => (
                            <Card.Root key={phase.id} variant="subtle" size="sm">
                              <CardBody>
                                <HStack justify="space-between" align="start">
                                  <VStack align="start" gap={1} flex="1">
                                    <HStack gap={2}>
                                      <Icon color="primary.500">
                                        <LuMap />
                                      </Icon>
                                      <Text fontWeight="medium">{phase.name}</Text>
                                    </HStack>
                                    {phase.description && (
                                      <Text fontSize="sm" color="text.secondary">
                                        {phase.description}
                                      </Text>
                                    )}
                                  </VStack>
                                  <IconButton
                                    size="xs"
                                    variant="ghost"
                                    colorPalette="red"
                                    aria-label="Delete phase"
                                    onClick={() => handleDeletePhase(phase.id)}
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
                      )}
                    </VStack>

                    <Separator />

                    {/* Milestones Section */}
                    <VStack align="stretch" gap={3}>
                      <HStack justify="space-between" align="center">
                        <Text fontSize="md" fontWeight="medium">
                          Milestones
                        </Text>
                      </HStack>

                      {/* Add Milestone Form */}
                      <Card.Root variant="outline" size="sm">
                        <CardBody>
                          <VStack align="stretch" gap={2}>
                            <HStack gap={2}>
                              <Input
                                placeholder="Milestone name..."
                                value={newMilestoneName}
                                onChange={(e) => setNewMilestoneName(e.target.value)}
                                size="sm"
                                flex="1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddMilestone();
                                  }
                                }}
                              />
                              {phases.length > 0 && (
                                <Box minW="150px">
                                  <select
                                    value={selectedPhaseForMilestone}
                                    onChange={(e) => setSelectedPhaseForMilestone(e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      fontSize: '14px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--chakra-colors-border-subtle)',
                                      background: 'var(--chakra-colors-bg-surface)',
                                    }}
                                  >
                                    <option value="">Ungrouped</option>
                                    {phases.map((phase) => (
                                      <option key={phase.id} value={phase.id}>
                                        {phase.name}
                                      </option>
                                    ))}
                                  </select>
                                </Box>
                              )}
                              <Button
                                size="sm"
                                onClick={handleAddMilestone}
                                disabled={!newMilestoneName.trim()}
                                colorPalette="primary"
                              >
                                <HStack gap={1}>
                                  <Icon>
                                    <LuPlus />
                                  </Icon>
                                  <Text>Add</Text>
                                </HStack>
                              </Button>
                            </HStack>
                            <Input
                              placeholder="Optional description..."
                              value={newMilestoneDescription}
                              onChange={(e) => setNewMilestoneDescription(e.target.value)}
                              size="sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMilestone();
                                }
                              }}
                            />
                          </VStack>
                        </CardBody>
                      </Card.Root>

                      {/* Grouped Milestones by Phase */}
                      {phases.length > 0 && Object.keys(milestonesByPhase.grouped).length > 0 && (
                        <VStack align="stretch" gap={3}>
                          {phases.map((phase) => {
                            const phaseMilestones = milestonesByPhase.grouped[phase.id] || [];
                            if (phaseMilestones.length === 0) return null;

                            return (
                              <Box key={phase.id} pl={4} borderLeft="2px solid" borderColor="primary.200">
                                <VStack align="stretch" gap={2}>
                                  <HStack gap={2}>
                                    <Icon color="primary.500">
                                      <LuMap />
                                    </Icon>
                                    <Text fontSize="sm" fontWeight="medium" color="primary.700">
                                      {phase.name}
                                    </Text>
                                    <Badge size="sm" variant="subtle" colorPalette="primary">
                                      {phaseMilestones.length}
                                    </Badge>
                                  </HStack>
                                  <VStack align="stretch" gap={1} pl={4}>
                                    {phaseMilestones.map((milestone) => (
                                      <HStack
                                        key={milestone.id}
                                        justify="space-between"
                                        p={2}
                                        bg="bg.subtle"
                                        borderRadius="md"
                                      >
                                        <VStack align="start" gap={0} flex="1">
                                          <Text fontSize="sm" fontWeight="medium">
                                            {milestone.name}
                                          </Text>
                                          {milestone.description && (
                                            <Text fontSize="xs" color="text.secondary">
                                              {milestone.description}
                                            </Text>
                                          )}
                                        </VStack>
                                        <IconButton
                                          size="xs"
                                          variant="ghost"
                                          colorPalette="red"
                                          aria-label="Delete milestone"
                                          onClick={() => handleDeleteMilestone(milestone.id)}
                                        >
                                          <Icon>
                                            <LuX />
                                          </Icon>
                                        </IconButton>
                                      </HStack>
                                    ))}
                                  </VStack>
                                </VStack>
                              </Box>
                            );
                          })}
                        </VStack>
                      )}

                      {/* Ungrouped Milestones */}
                      {milestonesByPhase.ungrouped.length > 0 && (
                        <VStack align="stretch" gap={2}>
                          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
                            Ungrouped
                          </Text>
                          <VStack align="stretch" gap={1}>
                            {milestonesByPhase.ungrouped.map((milestone) => (
                              <HStack
                                key={milestone.id}
                                justify="space-between"
                                p={2}
                                bg="bg.subtle"
                                borderRadius="md"
                              >
                                <VStack align="start" gap={0} flex="1">
                                  <Text fontSize="sm" fontWeight="medium">
                                    {milestone.name}
                                  </Text>
                                  {milestone.description && (
                                    <Text fontSize="xs" color="text.secondary">
                                      {milestone.description}
                                    </Text>
                                  )}
                                </VStack>
                                <HStack gap={1}>
                                  {phases.length > 0 && (
                                    <Box minW="120px">
                                      <select
                                        value={milestone.phaseId || ''}
                                        onChange={(e) =>
                                          handleMoveMilestoneToPhase(
                                            milestone.id,
                                            e.target.value || undefined
                                          )
                                        }
                                        style={{
                                          width: '100%',
                                          padding: '4px 6px',
                                          fontSize: '12px',
                                          borderRadius: '4px',
                                          border: '1px solid var(--chakra-colors-border-subtle)',
                                          background: 'var(--chakra-colors-bg-surface)',
                                        }}
                                      >
                                        <option value="">Ungrouped</option>
                                        {phases.map((phase) => (
                                          <option key={phase.id} value={phase.id}>
                                            {phase.name}
                                          </option>
                                        ))}
                                      </select>
                                    </Box>
                                  )}
                                  <IconButton
                                    size="xs"
                                    variant="ghost"
                                    colorPalette="red"
                                    aria-label="Delete milestone"
                                    onClick={() => handleDeleteMilestone(milestone.id)}
                                  >
                                    <Icon>
                                      <LuX />
                                    </Icon>
                                  </IconButton>
                                </HStack>
                              </HStack>
                            ))}
                          </VStack>
                        </VStack>
                      )}

                      {milestones.length === 0 && (
                        <Text fontSize="sm" color="text.tertiary" textAlign="center" py={4}>
                          No milestones yet. Add milestones above.
                        </Text>
                      )}
                    </VStack>
                  </VStack>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar orientation="vertical">
                  <ScrollArea.Thumb />
                </ScrollArea.Scrollbar>
              </ScrollArea.Root>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2} justify="flex-end">
                <Button variant="ghost" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleSubmit}
                  loading={loading}
                  loadingText="Creating..."
                >
                  Create Plan
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
