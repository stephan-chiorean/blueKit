import { useState, useRef, memo } from 'react';
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
  Input,
  Badge,
} from '@chakra-ui/react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { PlanMilestone, PlanPhaseWithMilestones } from '../../types/plan';
import { invokeDeletePlanMilestone, invokeToggleMilestoneCompletion, invokeCreatePlanMilestone, invokeCreatePlanPhase } from '../../ipc';
import { toaster } from '../ui/toaster';

interface MilestoneTimelineProps {
  planId: string;
  phases: PlanPhaseWithMilestones[];
  onUpdate: () => void;
}

const MilestoneTimeline = memo(function MilestoneTimeline({
  planId,
  phases,
  onUpdate,
}: MilestoneTimelineProps) {
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten all milestones from all phases and sort by orderIndex
  const allMilestones = phases
    .flatMap(phase => 
      phase.milestones.map(m => ({ ...m, phase }))
    )
    .sort((a, b) => {
      // First sort by phase orderIndex, then by milestone orderIndex
      if (a.phase.orderIndex !== b.phase.orderIndex) {
        return a.phase.orderIndex - b.phase.orderIndex;
      }
      return a.orderIndex - b.orderIndex;
    });

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

  const handleAddMilestone = async () => {
    if (!newMilestoneName.trim()) return;

    setIsCreating(true);
    try {
      // Find or create "Ungrouped" phase
      let phaseId = phases.find(p => p.name === 'Ungrouped')?.id;
      
      if (!phaseId) {
        const newPhase = await invokeCreatePlanPhase(
          planId,
          'Ungrouped',
          'Milestones not assigned to a specific phase',
          phases.length
        );
        phaseId = newPhase.id;
      }

      await invokeCreatePlanMilestone(phaseId, newMilestoneName.trim());
      setNewMilestoneName('');
      onUpdate();
      
      // Focus the input for quick entry
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to create milestone:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to create milestone',
        description: String(error),
        closable: true,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddMilestone();
    }
  };

  return (
    <Card.Root variant="subtle">
      <CardBody>
        <VStack align="stretch" gap={4}>
          <Text fontSize="sm" fontWeight="medium">
            Milestones ({allMilestones.length})
          </Text>

          {/* Add Milestone - simple text field + button */}
          <HStack gap={2}>
            <Input
              ref={inputRef}
              value={newMilestoneName}
              onChange={(e) => setNewMilestoneName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a milestone..."
              size="sm"
              disabled={isCreating}
              flex="1"
            />
            <Button
              size="sm"
              colorPalette="primary"
              onClick={handleAddMilestone}
              disabled={!newMilestoneName.trim() || isCreating}
              loading={isCreating}
            >
              <Icon>
                <LuPlus />
              </Icon>
              Add
            </Button>
          </HStack>

          {allMilestones.length === 0 ? (
            <Text fontSize="sm" color="text.tertiary" textAlign="center" py={4}>
              No milestones yet
            </Text>
          ) : (
            <VStack align="stretch" gap={2}>
              {allMilestones.map((milestone) => (
                <Card.Root
                  key={milestone.id}
                  variant="outline"
                  size="sm"
                  bg={milestone.completed ? 'green.50' : 'transparent'}
                  borderColor={milestone.completed ? 'green.200' : 'border.subtle'}
                  cursor="pointer"
                  transition="all 0.3s ease-in-out"
                  _hover={{
                    transform: 'translateY(-2px)',
                    shadow: 'sm',
                  }}
                  _dark={{
                    bg: milestone.completed ? 'green.950/30' : 'transparent',
                    borderColor: milestone.completed ? 'green.800/50' : 'border.subtle',
                  }}
                  role="group"
                  onClick={() => handleToggleMilestone(milestone.id)}
                >
                  <CardBody py={2} px={3}>
                    <Flex justify="space-between" align="center" gap={2}>
                      <HStack gap={3} flex="1">
                        <Checkbox.Root
                          checked={milestone.completed}
                          onCheckedChange={() => handleToggleMilestone(milestone.id)}
                          colorPalette="green"
                          size="md"
                          cursor="pointer"
                          p={1}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Root>
                        <VStack align="start" gap={1} flex="1">
                          <Text
                            fontSize="sm"
                            textDecoration={milestone.completed ? 'line-through' : 'none'}
                            color={milestone.completed ? 'text.tertiary' : 'text.primary'}
                            transition="all 0.2s ease-in-out"
                          >
                            {milestone.name}
                          </Text>
                          {milestone.phase.name !== 'Ungrouped' && (
                            <Badge size="xs" variant="subtle" colorPalette="blue">
                              {milestone.phase.name}
                            </Badge>
                          )}
                        </VStack>
                      </HStack>
                      <IconButton
                        aria-label="Delete milestone"
                        variant="ghost"
                        size="xs"
                        colorPalette="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMilestone(milestone.id, milestone.name);
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
                    </Flex>
                  </CardBody>
                </Card.Root>
              ))}
            </VStack>
          )}
        </VStack>
      </CardBody>
    </Card.Root>
  );
}, (prevProps, nextProps) => {
  // Only re-render if planId or phases actually changed
  return (
    prevProps.planId === nextProps.planId &&
    JSON.stringify(prevProps.phases) === JSON.stringify(nextProps.phases)
  );
});

export default MilestoneTimeline;

