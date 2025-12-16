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
  Badge,
} from '@chakra-ui/react';
import { LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu';
import { PlanPhaseWithMilestones, PlanMilestone } from '../../types/plan';
import { invokeDeletePlanPhase, invokeDeletePlanMilestone, invokeToggleMilestoneCompletion } from '../../ipc';
import { toaster } from '../ui/toaster';
import CreateMilestoneQuickDialog from './CreateMilestoneQuickDialog';
import EditMilestoneDialog from './EditMilestoneDialog';
import CreatePhaseDialog from './CreatePhaseDialog';
import EditPhaseDialog from './EditPhaseDialog';

interface UnifiedMilestonesManagerProps {
  planId: string;
  phases: PlanPhaseWithMilestones[];
  onUpdate: () => void;
}

export default function UnifiedMilestonesManager({
  planId,
  phases,
  onUpdate,
}: UnifiedMilestonesManagerProps) {
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [isCreatePhaseOpen, setIsCreatePhaseOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<PlanMilestone | null>(null);
  const [editingPhase, setEditingPhase] = useState<PlanPhaseWithMilestones | null>(null);

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

  const handleDeletePhase = async (phaseId: string, phaseName: string) => {
    if (!confirm(`Are you sure you want to delete the phase "${phaseName}"? This will also unlink any documents.`)) {
      return;
    }

    try {
      await invokeDeletePlanPhase(phaseId);
      toaster.create({
        type: 'success',
        title: 'Phase deleted',
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to delete phase:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete phase',
        description: String(error),
        closable: true,
      });
    }
  };

  // Sort phases by orderIndex
  const sortedPhases = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);

  // Get all milestones (flattened)
  const allMilestones = sortedPhases.flatMap(phase => 
    phase.milestones.map(m => ({ ...m, phase }))
  );

  return (
    <Card.Root variant="subtle">
      <CardBody>
        <VStack align="stretch" gap={3}>
          <Flex justify="space-between" align="center">
            <Text fontSize="sm" fontWeight="medium">
              Milestones ({allMilestones.length})
            </Text>
            <HStack gap={2}>
              <Button
                size="xs"
                variant="outline"
                colorPalette="primary"
                onClick={() => setIsCreatePhaseOpen(true)}
              >
                <HStack gap={1}>
                  <Icon>
                    <LuPlus />
                  </Icon>
                  <Text>Phase</Text>
                </HStack>
              </Button>
              <Button
                size="xs"
                variant="outline"
                colorPalette="primary"
                onClick={() => setIsCreateMilestoneOpen(true)}
              >
                <HStack gap={1}>
                  <Icon>
                    <LuPlus />
                  </Icon>
                  <Text>Milestone</Text>
                </HStack>
              </Button>
            </HStack>
          </Flex>

          {sortedPhases.length === 0 && allMilestones.length === 0 ? (
            <Text fontSize="sm" color="text.tertiary" textAlign="center" py={4}>
              No milestones yet. Click "Milestone" to create one.
            </Text>
          ) : (
            <VStack align="stretch" gap={3}>
              {/* Show milestones grouped by phase */}
              {sortedPhases.map((phase) => {
                const sortedMilestones = [...phase.milestones].sort(
                  (a, b) => a.orderIndex - b.orderIndex
                );

                if (sortedMilestones.length === 0) {
                  return null; // Skip empty phases
                }

                return (
                  <Card.Root key={phase.id} variant="outline" size="sm">
                    <CardBody p={3}>
                      <VStack align="stretch" gap={2}>
                        {/* Phase Header */}
                        <Flex justify="space-between" align="center">
                          <HStack gap={2}>
                            <Text fontSize="sm" fontWeight="medium" color="text.secondary">
                              {phase.name}
                            </Text>
                            <Badge size="sm" variant="subtle" colorPalette="gray">
                              {sortedMilestones.length}
                            </Badge>
                          </HStack>
                          <HStack gap={1}>
                            <IconButton
                              aria-label="Edit phase"
                              variant="ghost"
                              size="xs"
                              onClick={() => setEditingPhase(phase)}
                            >
                              <Icon>
                                <LuPencil />
                              </Icon>
                            </IconButton>
                            <IconButton
                              aria-label="Delete phase"
                              variant="ghost"
                              size="xs"
                              colorPalette="red"
                              onClick={() => handleDeletePhase(phase.id, phase.name)}
                            >
                              <Icon>
                                <LuTrash2 />
                              </Icon>
                            </IconButton>
                          </HStack>
                        </Flex>

                        {/* Milestones in Phase */}
                        <VStack align="stretch" gap={2}>
                          {sortedMilestones.map((milestone) => (
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
                          ))}
                        </VStack>
                      </VStack>
                    </CardBody>
                  </Card.Root>
                );
              })}
            </VStack>
          )}

          {/* Dialogs */}
          <CreateMilestoneQuickDialog
            isOpen={isCreateMilestoneOpen}
            onClose={() => setIsCreateMilestoneOpen(false)}
            planId={planId}
            phases={sortedPhases}
            onMilestoneCreated={onUpdate}
          />

          <CreatePhaseDialog
            isOpen={isCreatePhaseOpen}
            onClose={() => setIsCreatePhaseOpen(false)}
            planId={planId}
            onPhaseCreated={onUpdate}
          />

          {editingMilestone && (
            <EditMilestoneDialog
              isOpen={!!editingMilestone}
              onClose={() => setEditingMilestone(null)}
              milestone={editingMilestone}
              onMilestoneUpdated={onUpdate}
            />
          )}

          {editingPhase && (
            <EditPhaseDialog
              isOpen={!!editingPhase}
              onClose={() => setEditingPhase(null)}
              phase={editingPhase}
              onPhaseUpdated={onUpdate}
            />
          )}
        </VStack>
      </CardBody>
    </Card.Root>
  );
}

