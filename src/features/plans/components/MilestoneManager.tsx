import { useState } from 'react';
import {
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Flex,
  IconButton,
  Checkbox,
} from '@chakra-ui/react';
import { LuPlus, LuChevronDown, LuChevronRight, LuPencil, LuTrash2 } from 'react-icons/lu';
import { PlanPhaseWithMilestones, PlanMilestone } from '@/types/plan';
import CreateMilestoneDialog from './CreateMilestoneDialog';
import EditMilestoneDialog from './EditMilestoneDialog';
import { invokeDeletePlanMilestone, invokeToggleMilestoneCompletion } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';

interface MilestoneManagerProps {
  phases: PlanPhaseWithMilestones[];
  onUpdate: () => void;
}

export default function MilestoneManager({ phases, onUpdate }: MilestoneManagerProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(phases.map(p => p.id))
  );
  const [creatingForPhase, setCreatingForPhase] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<PlanMilestone | null>(null);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    try {
      await invokeToggleMilestoneCompletion(milestoneId);
      onUpdate();
    } catch (error) {
      console.error('Failed to toggle milestone:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to update milestone',
        description: String(error),
        closable: true,
      });
    }
  };

  const handleDeleteMilestone = async (milestoneId: string, milestoneName: string) => {
    if (!confirm(`Are you sure you want to delete the milestone "${milestoneName}"?`)) {
      return;
    }

    try {
      await invokeDeletePlanMilestone(milestoneId);
      toaster.create({
        type: 'success',
        title: 'Milestone deleted',
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to delete milestone:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete milestone',
        description: String(error),
        closable: true,
      });
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return null;
    // Note: Backend returns timestamp in seconds, but JavaScript Date expects milliseconds
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Sort phases by orderIndex
  const sortedPhases = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Card.Root variant="subtle">
      <CardBody>
        <VStack align="stretch" gap={3}>
          <Text fontSize="sm" fontWeight="medium">
            Milestones
          </Text>

          {sortedPhases.length === 0 ? (
            <Text fontSize="sm" color="text.tertiary" textAlign="center" py={4}>
              No phases yet. Create phases first to add milestones.
            </Text>
          ) : (
            <VStack align="stretch" gap={3}>
              {sortedPhases.map((phase) => {
                const isExpanded = expandedPhases.has(phase.id);
                const sortedMilestones = [...phase.milestones].sort(
                  (a, b) => a.orderIndex - b.orderIndex
                );

                return (
                  <Card.Root key={phase.id} variant="outline" size="sm">
                    <CardBody p={3}>
                      <VStack align="stretch" gap={2}>
                        <Flex justify="space-between" align="center">
                          <HStack
                            gap={2}
                            flex="1"
                            cursor="pointer"
                            onClick={() => togglePhase(phase.id)}
                          >
                            <Icon color="text.secondary">
                              {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                            </Icon>
                            <Text fontSize="sm" fontWeight="medium">
                              {phase.name}
                            </Text>
                            <Text fontSize="xs" color="text.tertiary">
                              ({sortedMilestones.filter(m => m.completed).length} /{' '}
                              {sortedMilestones.length})
                            </Text>
                          </HStack>
                          <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="primary"
                            onClick={() => setCreatingForPhase(phase.id)}
                          >
                            <HStack gap={1}>
                              <Icon>
                                <LuPlus />
                              </Icon>
                              <Text>Add</Text>
                            </HStack>
                          </Button>
                        </Flex>

                        {isExpanded && (
                          <VStack align="stretch" gap={2} pl={6}>
                            {sortedMilestones.length === 0 ? (
                              <Text fontSize="xs" color="text.tertiary" py={2}>
                                No milestones in this phase
                              </Text>
                            ) : (
                              sortedMilestones.map((milestone) => (
                                <Flex
                                  key={milestone.id}
                                  justify="space-between"
                                  align="start"
                                  gap={2}
                                  p={2}
                                  borderRadius="md"
                                  _hover={{ bg: 'bg.subtle' }}
                                >
                                  <HStack gap={2} flex="1">
                                    <Checkbox.Root
                                      checked={milestone.completed}
                                      onCheckedChange={() => handleToggleMilestone(milestone.id)}
                                      colorPalette="green"
                                      size="sm"
                                    >
                                      <Checkbox.HiddenInput />
                                      <Checkbox.Control>
                                        <Checkbox.Indicator />
                                      </Checkbox.Control>
                                    </Checkbox.Root>
                                    <VStack align="start" gap={0.5} flex="1">
                                      <Text
                                        fontSize="sm"
                                        textDecoration={milestone.completed ? 'line-through' : 'none'}
                                        color={milestone.completed ? 'text.tertiary' : 'text.primary'}
                                      >
                                        {milestone.name}
                                      </Text>
                                      {milestone.description && (
                                        <Text fontSize="xs" color="text.secondary">
                                          {milestone.description}
                                        </Text>
                                      )}
                                      {milestone.completed && milestone.completedAt && (
                                        <Text fontSize="xs" color="text.tertiary">
                                          Completed {formatDate(milestone.completedAt)}
                                        </Text>
                                      )}
                                    </VStack>
                                  </HStack>
                                  <HStack gap={1}>
                                    <IconButton
                                      aria-label="Edit milestone"
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => setEditingMilestone(milestone)}
                                    >
                                      <Icon>
                                        <LuPencil />
                                      </Icon>
                                    </IconButton>
                                    <IconButton
                                      aria-label="Delete milestone"
                                      variant="ghost"
                                      size="xs"
                                      colorPalette="red"
                                      onClick={() =>
                                        handleDeleteMilestone(milestone.id, milestone.name)
                                      }
                                    >
                                      <Icon>
                                        <LuTrash2 />
                                      </Icon>
                                    </IconButton>
                                  </HStack>
                                </Flex>
                              ))
                            )}
                          </VStack>
                        )}
                      </VStack>
                    </CardBody>
                  </Card.Root>
                );
              })}
            </VStack>
          )}

          {creatingForPhase && (
            <CreateMilestoneDialog
              isOpen={!!creatingForPhase}
              onClose={() => setCreatingForPhase(null)}
              phaseId={creatingForPhase}
              onMilestoneCreated={onUpdate}
            />
          )}

          {editingMilestone && (
            <EditMilestoneDialog
              isOpen={!!editingMilestone}
              onClose={() => setEditingMilestone(null)}
              milestone={editingMilestone}
              onMilestoneUpdated={onUpdate}
            />
          )}
        </VStack>
      </CardBody>
    </Card.Root>
  );
}
