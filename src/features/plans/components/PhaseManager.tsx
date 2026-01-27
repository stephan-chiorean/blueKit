import { useState } from 'react';
import {
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Badge,
  Flex,
  IconButton,
} from '@chakra-ui/react';
import { LuPlus, LuChevronDown, LuChevronRight, LuPencil, LuTrash2 } from 'react-icons/lu';
import { PlanPhaseWithMilestones } from '@/types/plan';
import CreatePhaseDialog from './CreatePhaseDialog';
import EditPhaseDialog from './EditPhaseDialog';
import { invokeDeletePlanPhase } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';

interface PhaseManagerProps {
  planId: string;
  phases: PlanPhaseWithMilestones[];
  onUpdate: () => void;
}

export default function PhaseManager({ planId, phases, onUpdate }: PhaseManagerProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PlanPhaseWithMilestones | null>(null);

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

  const getStatusColorPalette = (status: string) => {
    switch (status) {
      case 'pending':
        return 'gray';
      case 'in_progress':
        return 'blue';
      case 'completed':
        return 'green';
      default:
        return 'gray';
    }
  };

  // Sort phases by orderIndex
  const sortedPhases = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Card.Root variant="subtle">
      <CardBody>
        <VStack align="stretch" gap={3}>
          <Flex justify="space-between" align="center">
            <Text fontSize="sm" fontWeight="medium">
              Phases ({phases.length})
            </Text>
            <Button
              size="xs"
              variant="outline"
              colorPalette="primary"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <HStack gap={1}>
                <Icon>
                  <LuPlus />
                </Icon>
                <Text>Add Phase</Text>
              </HStack>
            </Button>
          </Flex>

          {sortedPhases.length === 0 ? (
            <Text fontSize="sm" color="text.tertiary" textAlign="center" py={4}>
              No phases yet. Click "Add Phase" to create one.
            </Text>
          ) : (
            <VStack align="stretch" gap={2}>
              {sortedPhases.map((phase) => {
                const isExpanded = expandedPhases.has(phase.id);
                return (
                  <Card.Root
                    key={phase.id}
                    variant="outline"
                    size="sm"
                  >
                    <CardBody p={3}>
                      <VStack align="stretch" gap={2}>
                        <Flex justify="space-between" align="start" gap={2}>
                          <HStack gap={2} flex="1" cursor="pointer" onClick={() => togglePhase(phase.id)}>
                            <Icon color="text.secondary">
                              {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                            </Icon>
                            <Text fontSize="sm" fontWeight="medium" flex="1">
                              {phase.name}
                            </Text>
                          </HStack>
                          <HStack gap={1}>
                            <Badge
                              size="sm"
                              variant="subtle"
                              colorPalette={getStatusColorPalette(phase.status)}
                            >
                              {phase.status.replace('_', ' ')}
                            </Badge>
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

                        {isExpanded && phase.description && (
                          <Text fontSize="xs" color="text.secondary" pl={6}>
                            {phase.description}
                          </Text>
                        )}

                        {isExpanded && (
                          <HStack pl={6} gap={3} fontSize="xs" color="text.tertiary">
                            <Text>{phase.milestones.length} milestones</Text>
                            {phase.milestones.filter(m => m.completed).length > 0 && (
                              <Text>
                                {phase.milestones.filter(m => m.completed).length} completed
                              </Text>
                            )}
                          </HStack>
                        )}
                      </VStack>
                    </CardBody>
                  </Card.Root>
                );
              })}
            </VStack>
          )}

          <CreatePhaseDialog
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            planId={planId}
            onPhaseCreated={onUpdate}
          />

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
