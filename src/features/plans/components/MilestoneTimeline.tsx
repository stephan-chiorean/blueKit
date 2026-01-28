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
  Box,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuPlus, LuTrash2, LuChevronDown, LuChevronUp, LuSparkles, LuTarget } from 'react-icons/lu';
import { PlanPhaseWithMilestones } from '@/types/plan';
import { invokeDeletePlanMilestone, invokeToggleMilestoneCompletion, invokeCreatePlanMilestone, invokeCreatePlanPhase } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';

const MotionCard = motion.create(Card.Root);
const MotionBox = motion.create(Box);

interface MilestoneTimelineProps {
  planId: string;
  phases: PlanPhaseWithMilestones[];
  onUpdate: () => void;
  embedded?: boolean;
}

const MilestoneTimeline = memo(function MilestoneTimeline({
  planId,
  phases,
  onUpdate,
  embedded = false,
}: MilestoneTimelineProps) {
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!embedded);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten all milestones from all phases and sort by orderIndex
  const allMilestones = phases
    .flatMap(phase =>
      phase.milestones.map(m => ({ ...m, phase }))
    )
    .sort((a, b) => {
      if (a.phase.orderIndex !== b.phase.orderIndex) {
        return a.phase.orderIndex - b.phase.orderIndex;
      }
      return a.orderIndex - b.orderIndex;
    });

  const pendingMilestones = allMilestones.filter(m => !m.completed);
  const completedMilestones = allMilestones.filter(m => m.completed);
  const visibleMilestones = showCompleted ? allMilestones : pendingMilestones;

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
      let phaseId = phases.find(p => p.name === 'Milestones')?.id;

      if (!phaseId) {
        phaseId = phases.find(p => p.name === 'Ungrouped')?.id;
      }

      if (!phaseId) {
        const newPhase = await invokeCreatePlanPhase(
          planId,
          'Milestones',
          'Plan milestones',
          phases.length
        );
        phaseId = newPhase.id;
      }

      await invokeCreatePlanMilestone(phaseId, newMilestoneName.trim());
      setNewMilestoneName('');
      onUpdate();

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

  if (embedded) {
    return (
      <VStack align="stretch" gap={4}>
          {/* Add Milestone */}
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
              css={{
                borderRadius: '10px',
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              size="sm"
              colorPalette="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleAddMilestone();
              }}
              disabled={!newMilestoneName.trim() || isCreating}
              loading={isCreating}
              css={{
                borderRadius: '10px',
              }}
            >
              <Icon>
                <LuPlus />
              </Icon>
              Add
            </Button>
          </HStack>

          {allMilestones.length === 0 ? (
            <Box
              p={4}
              borderRadius="12px"
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="border.subtle"
              textAlign="center"
            >
              <VStack gap={1}>
                <Icon color="text.tertiary" boxSize={5}>
                  <LuSparkles />
                </Icon>
                <Text fontSize="sm" color="text.tertiary">
                  No milestones yet
                </Text>
              </VStack>
            </Box>
          ) : (
            <VStack align="stretch" gap={2}>
              <AnimatePresence mode="popLayout">
                {visibleMilestones.map((milestone, index) => (
                  <MotionCard
                    key={milestone.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    variant="outline"
                    size="sm"
                    bg={milestone.completed ? 'green.50' : 'transparent'}
                    borderColor={milestone.completed ? 'green.200' : 'border.subtle'}
                    cursor="pointer"
                    role="group"
                    onClick={() => handleToggleMilestone(milestone.id)}
                    css={{
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      _dark: {
                        bg: milestone.completed ? 'green.950/30' : 'transparent',
                        borderColor: milestone.completed ? 'green.800/50' : 'border.subtle',
                      },
                      _hover: {
                        transform: 'translateX(4px)',
                        borderColor: milestone.completed ? 'green.300' : 'primary.300',
                      },
                    }}
                  >
                    <CardBody py={2} px={3}>
                      <Flex justify="space-between" align="center" gap={2}>
                        <HStack gap={3} flex="1">
                          <MotionBox
                            initial={false}
                            animate={milestone.completed ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
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
                              <Checkbox.Control
                                css={{
                                  borderRadius: '6px',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Root>
                          </MotionBox>
                          <VStack align="start" gap={1} flex="1">
                            <Text
                              fontSize="sm"
                              textDecoration={milestone.completed ? 'line-through' : 'none'}
                              color={milestone.completed ? 'text.tertiary' : 'text.primary'}
                              transition="all 0.2s ease-in-out"
                            >
                              {milestone.name}
                            </Text>
                            {milestone.phase.name !== 'Ungrouped' && milestone.phase.name !== 'Milestones' && (
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
                            transition: 'opacity 0.15s ease',
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
                  </MotionCard>
                ))}
              </AnimatePresence>
            </VStack>
          )}
      </VStack>
    );
  }

  return (
    <Card.Root
      variant="subtle"
      css={{
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(24px) saturate(200%)',
        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
        borderWidth: '1px',
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: '16px',
        boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5)',
        _dark: {
          background: 'rgba(40, 40, 50, 0.5)',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          boxShadow: '0 4px 24px -8px rgba(0, 0, 0, 0.4)',
        },
        transition: 'all 0.2s ease',
      }}
    >
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
              <Text fontSize="sm" fontWeight="medium">
                Milestones
              </Text>
              <Box
                px={2}
                py={0.5}
                borderRadius="full"
                bg={completedMilestones.length === allMilestones.length && allMilestones.length > 0 ? 'green.100' : 'primary.100'}
                _dark={{ bg: completedMilestones.length === allMilestones.length && allMilestones.length > 0 ? 'green.900/40' : 'primary.900/40' }}
              >
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color={completedMilestones.length === allMilestones.length && allMilestones.length > 0 ? 'green.600' : 'primary.600'}
                  _dark={{ color: completedMilestones.length === allMilestones.length && allMilestones.length > 0 ? 'green.300' : 'primary.300' }}
                >
                  {completedMilestones.length}/{allMilestones.length}
                </Text>
              </Box>
            </HStack>
            {isExpanded && completedMilestones.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCompleted(!showCompleted);
                }}
              >
                <HStack gap={1}>
                  <Icon boxSize={3}>
                    {showCompleted ? <LuChevronUp /> : <LuChevronDown />}
                  </Icon>
                  <Text fontSize="xs">
                    {showCompleted ? 'Hide' : 'Show'} completed ({completedMilestones.length})
                  </Text>
                </HStack>
              </Button>
            )}
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
                <VStack align="stretch" gap={4} pt={4}>
                  {/* Add Milestone */}
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
                      css={{
                        borderRadius: '10px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      size="sm"
                      colorPalette="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddMilestone();
                      }}
                      disabled={!newMilestoneName.trim() || isCreating}
                      loading={isCreating}
                      css={{
                        borderRadius: '10px',
                      }}
                    >
                      <Icon>
                        <LuPlus />
                      </Icon>
                      Add
                    </Button>
                  </HStack>

                  {allMilestones.length === 0 ? (
                    <Box
                      p={4}
                      borderRadius="12px"
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor="border.subtle"
                      textAlign="center"
                    >
                      <VStack gap={1}>
                        <Icon color="text.tertiary" boxSize={5}>
                          <LuSparkles />
                        </Icon>
                        <Text fontSize="sm" color="text.tertiary">
                          No milestones yet
                        </Text>
                      </VStack>
                    </Box>
                  ) : (
                    <VStack align="stretch" gap={2}>
                      <AnimatePresence mode="popLayout">
                        {visibleMilestones.map((milestone, index) => (
                          <MotionCard
                            key={milestone.id}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                            transition={{ duration: 0.2, delay: index * 0.02 }}
                            variant="outline"
                            size="sm"
                            bg={milestone.completed ? 'green.50' : 'transparent'}
                            borderColor={milestone.completed ? 'green.200' : 'border.subtle'}
                            cursor="pointer"
                            role="group"
                            onClick={() => handleToggleMilestone(milestone.id)}
                            css={{
                              borderRadius: '12px',
                              transition: 'all 0.2s ease',
                              _dark: {
                                bg: milestone.completed ? 'green.950/30' : 'transparent',
                                borderColor: milestone.completed ? 'green.800/50' : 'border.subtle',
                              },
                              _hover: {
                                transform: 'translateX(4px)',
                                borderColor: milestone.completed ? 'green.300' : 'primary.300',
                              },
                            }}
                          >
                            <CardBody py={2} px={3}>
                              <Flex justify="space-between" align="center" gap={2}>
                                <HStack gap={3} flex="1">
                                  <MotionBox
                                    initial={false}
                                    animate={milestone.completed ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                  >
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
                                      <Checkbox.Control
                                        css={{
                                          borderRadius: '6px',
                                          transition: 'all 0.2s ease',
                                        }}
                                      >
                                        <Checkbox.Indicator />
                                      </Checkbox.Control>
                                    </Checkbox.Root>
                                  </MotionBox>
                                  <VStack align="start" gap={1} flex="1">
                                    <Text
                                      fontSize="sm"
                                      textDecoration={milestone.completed ? 'line-through' : 'none'}
                                      color={milestone.completed ? 'text.tertiary' : 'text.primary'}
                                      transition="all 0.2s ease-in-out"
                                    >
                                      {milestone.name}
                                    </Text>
                                    {milestone.phase.name !== 'Ungrouped' && milestone.phase.name !== 'Milestones' && (
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
                                    transition: 'opacity 0.15s ease',
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
                          </MotionCard>
                        ))}
                      </AnimatePresence>
                    </VStack>
                  )}
                </VStack>
              </motion.div>
            )}
          </AnimatePresence>
        </VStack>
      </CardBody>
    </Card.Root>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.planId === nextProps.planId &&
    JSON.stringify(prevProps.phases) === JSON.stringify(nextProps.phases) &&
    prevProps.embedded === nextProps.embedded
  );
});

export default MilestoneTimeline;
