import {
  Box,
  Flex,
  Text,
  Icon,
  HStack,
  VStack,
  Badge,
  Checkbox,
} from "@chakra-ui/react";
import { LuCircle, LuMap } from "react-icons/lu";
import { PlanDetails } from "@/types/plan";
import { useColorMode } from "@/shared/contexts/ColorModeContext";
import {
  getProgressColor,
  getActiveMilestones,
} from "@/shared/utils/planUtils";

interface ElegantPlanListProps {
  plans: PlanDetails[];
  onPlanClick: (plan: PlanDetails) => void;
  onPlanContextMenu?: (e: React.MouseEvent, plan: PlanDetails) => void;

  // Selection
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;

  // Loading/Empty states
  loading?: boolean;
  emptyMessage?: string;
}

export function ElegantPlanList({
  plans,
  onPlanClick,
  onPlanContextMenu,
  selectable,
  selectedIds,
  onSelectionChange,
  emptyMessage = "No plans found",
}: ElegantPlanListProps) {
  const { colorMode } = useColorMode();

  const hoverBg = colorMode === "light" ? "blackAlpha.50" : "whiteAlpha.100";
  const selectedBg = colorMode === "light" ? "blue.50" : "blue.900/20";
  const borderColor = colorMode === "light" ? "border.subtle" : "whiteAlpha.100";

  // Calculate selection state for header
  const allSelected = plans.length > 0 && plans.every(plan => selectedIds?.has(plan.id));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (allSelected) {
      // Clear all
      onSelectionChange(new Set());
    } else {
      // Select all
      const newSet = new Set(selectedIds);
      plans.forEach(plan => newSet.add(plan.id));
      onSelectionChange(newSet);
    }
  };

  const handlePlanToggle = (plan: PlanDetails) => {
    if (onSelectionChange && selectedIds) {
      const newSet = new Set(selectedIds);
      if (newSet.has(plan.id)) {
        newSet.delete(plan.id);
      } else {
        newSet.add(plan.id);
      }
      onSelectionChange(newSet);
    }
  };

  if (plans.length === 0) {
    return (
      <Box
        p={6}
        bg="bg.subtle"
        borderRadius="md"
        borderWidth="1px"
        borderColor="border.subtle"
        textAlign="center"
      >
        <Text color="text.muted" fontSize="sm">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <Box width="100%">
      {/* List Header */}
      <Flex
        px={4}
        py={2}
        borderBottomWidth="1px"
        borderColor={borderColor}
        color="text.muted"
        fontSize="xs"
        fontWeight="medium"
        textTransform="uppercase"
        letterSpacing="wider"
      >
        <Box flex="1">Name</Box>
        <Box width="400px" display={{ base: "none", md: "block" }}>
          Milestone
        </Box>
        <Box width="140px" display={{ base: "none", sm: "block" }}>
          Updated
        </Box>
        {/* Header Checkbox */}
        {selectable && (
          <Box width="48px" display="flex" alignItems="center" justifyContent="center">
            <Checkbox.Root
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              size="md"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control
                _checked={{
                  bg: "primary.500",
                  borderColor: "primary.500",
                }}
              >
                {/* No Checkbox.Indicator - solid fill only */}
              </Checkbox.Control>
            </Checkbox.Root>
          </Box>
        )}
      </Flex>

      {/* List Items */}
      <Box>
        {plans.map((plan) => {
          const isSelected = selectedIds?.has(plan.id);

          // Get plan-specific data
          const progressColor = getProgressColor(plan.status, plan.progress);

          // Milestone data
          const activeMilestones = getActiveMilestones(plan.phases);

          // Calculate task counts
          const totalTasks = plan.phases.reduce((sum, phase) => sum + (phase.milestones?.length || 0), 0);
          const completedTasks = plan.phases.reduce(
            (sum, phase) => sum + (phase.milestones?.filter(m => m.completed).length || 0),
            0
          );

          // Format updated date
          let dateStr = '-';
          if (plan.updatedAt) {
            try {
              dateStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                new Date(plan.updatedAt * 1000)
              );
            } catch (e) {
              // keep default
            }
          }

          return (
            <Flex
              key={plan.id}
              align="start"
              px={4}
              py={5}
              cursor="pointer"
              borderBottomWidth="1px"
              borderColor={borderColor}
              bg={isSelected ? selectedBg : "transparent"}
              _hover={{
                bg: isSelected ? selectedBg : hoverBg,
              }}
              onClick={() => onPlanClick(plan)}
              onContextMenu={(e) => onPlanContextMenu?.(e, plan)}
            >
              {/* Name Column */}
              <Flex flex="1" align="center" gap={3} minW={0} pr={4}>
                <Icon as={LuMap} boxSize={5} color={plan.status === 'completed' ? 'green.500' : 'blue.500'} flexShrink={0} />
                <VStack align="start" gap={1.5} minW={0} flex={1}>
                  <HStack gap={2} align="center" flexWrap="wrap">
                    <Text fontWeight="medium" fontSize="sm" color="fg" truncate>
                      {plan.name}
                    </Text>
                    {/* Phase count badge */}
                    <Badge size="sm" variant="outline" colorPalette="gray">
                      {plan.phases.length} {plan.phases.length === 1 ? 'phase' : 'phases'}
                    </Badge>
                    {/* Task completion badge */}
                    {totalTasks > 0 && (
                      <Badge size="sm" variant="outline" colorPalette={plan.status === 'completed' ? 'green' : 'blue'}>
                        {completedTasks}/{totalTasks} tasks
                      </Badge>
                    )}
                  </HStack>
                  {plan.description && (
                    <Text fontSize="xs" color="text.muted">
                      {plan.description}
                    </Text>
                  )}
                  {/* Progress Bar */}
                  <Box
                    position="relative"
                    h="4px"
                    bg="bg.subtle"
                    borderRadius="full"
                    overflow="hidden"
                    w="full"
                    maxW="300px"
                  >
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      h="100%"
                      w={`${plan.progress}%`}
                      bg={progressColor}
                      borderRadius="full"
                      transition="width 0.3s ease"
                    />
                  </Box>
                </VStack>
              </Flex>

              {/* Milestones Column */}
              <Box width="400px" display={{ base: "none", md: "block" }} pr={4}>
                {activeMilestones.length > 0 ? (
                  <VStack gap={2} align="start">
                    {activeMilestones.map((milestone) => (
                      <HStack key={milestone.id} gap={1}>
                        <Icon as={LuCircle} boxSize={3} color="fg.muted" flexShrink={0} />
                        <Text fontSize="xs" fontWeight="medium" color="fg">
                          {milestone.name}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="xs" color="text.muted">
                    No active milestones
                  </Text>
                )}
              </Box>

              {/* Updated Column */}
              <Box width="140px" display={{ base: "none", sm: "block" }}>
                <Text fontSize="xs" color="text.muted">
                  {dateStr}
                </Text>
              </Box>

              {/* Checkbox Column - Moved to Right */}
              {selectable && (
                <Box
                  width="48px"
                  onClick={(e) => e.stopPropagation()}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Checkbox.Root
                    checked={isSelected}
                    onCheckedChange={() => handlePlanToggle(plan)}
                    size="md"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control
                      _checked={{
                        bg: "primary.500",
                        borderColor: "primary.500",
                      }}
                    >
                      {/* No Checkbox.Indicator - solid fill only */}
                    </Checkbox.Control>
                  </Checkbox.Root>
                </Box>
              )}
            </Flex>
          );
        })}
      </Box>
    </Box>
  );
}
