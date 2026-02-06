import { useState, useMemo, forwardRef, useImperativeHandle, memo, useEffect } from 'react';
import {
  Box,
  Text,
  VStack,
  Button,
  HStack,
  Icon,
  Badge,
  Flex,
  Heading,
} from '@chakra-ui/react';
import {
  LuPlus,
  LuFilter,
  LuTrash2,
  LuCheck,
} from 'react-icons/lu';
import ResourceSelectionFooter from './components/ResourceSelectionFooter';
import { PlanDetails } from '@/types/plan';
import CreatePlanDialog from '@/features/plans/components/CreatePlanDialog';
import { ElegantPlanList } from '@/shared/components/ElegantPlanList';
import { TableSkeleton } from '@/shared/components/Skeletons';
import { FilterPanel } from '@/shared/components/FilterPanel';
import { ToolkitHeader } from '@/shared/components/ToolkitHeader';

interface PlansSectionProps {
  plans: PlanDetails[];
  plansLoading: boolean;
  onViewPlan: (plan: PlanDetails) => void;
  projectId: string;
  projectPath: string;
  onPlansChanged: () => void;
}

export interface PlansSectionRef {
  openCreateDialog: () => void;
}

const PlansSection = forwardRef<PlansSectionRef, PlansSectionProps>(({
  plans,
  plansLoading,
  onViewPlan,
  projectId,
  projectPath,
  onPlansChanged,
}, ref) => {
  const [nameFilter, setNameFilter] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Local selection state
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());

  // Status options for filter
  const statusOptions = [
    { value: 'active', label: 'Active', colorPalette: 'blue' },
    { value: 'completed', label: 'Completed', colorPalette: 'green' },
    { value: 'archived', label: 'Archived', colorPalette: 'gray' },
  ];

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openCreateDialog: handleOpenCreateDialog,
  }));

  const handlePlanCreated = () => {
    onPlansChanged();
  };

  // Selection handlers
  const clearSelection = () => setSelectedPlanIds(new Set());

  // Clear selection on mount/unmount or projectId change
  useEffect(() => {
    clearSelection();
  }, [projectId]);

  // Actions
  const handleDelete = () => {
    // TODO: Implement delete logic
    console.log('Delete selected plans:', Array.from(selectedPlanIds));
    clearSelection();
  };

  const handleComplete = () => {
    // TODO: Implement complete logic
    console.log('Complete selected plans:', Array.from(selectedPlanIds));
    clearSelection();
  };

  // Filter plans
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const lowerFilter = nameFilter.toLowerCase();
      const matchesName = !nameFilter ||
        plan.name.toLowerCase().includes(lowerFilter) ||
        (plan.description && plan.description.toLowerCase().includes(lowerFilter));

      const matchesStatus = selectedStatuses.length === 0 ||
        selectedStatuses.includes(plan.status);

      return matchesName && matchesStatus;
    });
  }, [plans, nameFilter, selectedStatuses]);

  // Split filtered plans into Active and Completed sections
  const activePlans = useMemo(() => {
    return filteredPlans.filter(plan => plan.status === 'active');
  }, [filteredPlans]);

  const completedPlans = useMemo(() => {
    return filteredPlans.filter(plan => plan.status === 'completed');
  }, [filteredPlans]);

  const projectName = projectPath.split('/').pop() || 'Project';

  return (
    <Flex
      direction="column"
      h="100%"
      w="100%"
      overflow="hidden"
      bg="transparent"
    >
      <VStack align="stretch" gap={0} flex={1} overflow="hidden">
        <CreatePlanDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onPlanCreated={handlePlanCreated}
          projectId={projectId}
          projectPath={projectPath}
        />

        <ToolkitHeader
          title="Plans"
          parentName={projectName}
          leftActions={
            <Box position="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                colorPalette="gray"
                title="Filter"
              >
                <Icon boxSize={4}>
                  <LuFilter />
                </Icon>
                {(nameFilter || selectedStatuses.length > 0) && (
                  <Badge
                    position="absolute"
                    top="-2px"
                    right="-2px"
                    size="xs"
                    colorPalette="primary"
                    variant="solid"
                    borderRadius="full"
                    zIndex={1}
                  >
                    {(nameFilter ? 1 : 0) + selectedStatuses.length}
                  </Badge>
                )}
              </Button>
              <FilterPanel
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                nameFilter={nameFilter}
                onNameFilterChange={setNameFilter}
                allTags={[]}
                selectedTags={[]}
                onToggleTag={() => { }}
                statusOptions={statusOptions}
                selectedStatuses={selectedStatuses}
                onToggleStatus={(status) => {
                  setSelectedStatuses(prev =>
                    prev.includes(status)
                      ? prev.filter(s => s !== status)
                      : [...prev, status]
                  );
                }}
              />
            </Box>
          }
          action={{
            label: "Create Plan",
            onClick: handleOpenCreateDialog,
            variant: "icon",
            icon: LuPlus,
          }}
        />

        <Box
          flex={1}
          overflowY="auto"
          p={6}
          w="100%"
        >
          {plansLoading ? (
            <Box py={4}>
              <TableSkeleton />
            </Box>
          ) : plans.length === 0 ? (
            <VStack py={12} gap={3}>
              <Text color="text.secondary" fontSize="lg">
                No plans yet
              </Text>
              <Text color="text.tertiary" fontSize="sm">
                Click "Create Plan" to get started
              </Text>
              <Button colorPalette="primary" onClick={handleOpenCreateDialog}>
                <HStack gap={2}>
                  <LuPlus />
                  <Text>Create Plan</Text>
                </HStack>
              </Button>
            </VStack>
          ) : (
            <>
              {/* Active Plans Section */}
              <Box mb={8}>
                <Flex align="center" gap={2} mb={4}>
                  <Heading size="md">Active</Heading>
                  <Text fontSize="sm" color="text.muted">
                    {activePlans.length}
                  </Text>
                </Flex>

                {activePlans.length === 0 ? (
                  <Box
                    p={6}
                    bg="bg.subtle"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    textAlign="center"
                  >
                    <Text color="text.muted" fontSize="sm">
                      {(nameFilter || selectedStatuses.length > 0)
                        ? 'No active plans match the current filters'
                        : 'No active plans'
                      }
                    </Text>
                  </Box>
                ) : (
                  <ElegantPlanList
                    plans={activePlans}
                    selectable={true}
                    selectedIds={selectedPlanIds}
                    onSelectionChange={setSelectedPlanIds}
                    onPlanClick={onViewPlan}
                  />
                )}
              </Box>

              {/* Completed Plans Section */}
              <Box>
                <Flex align="center" gap={2} mb={4}>
                  <Heading size="md">Completed</Heading>
                  <Text fontSize="sm" color="text.muted">
                    {completedPlans.length}
                  </Text>
                </Flex>

                {completedPlans.length === 0 ? (
                  <Box
                    p={6}
                    bg="bg.subtle"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    textAlign="center"
                  >
                    <Text color="text.muted" fontSize="sm">
                      {(nameFilter || selectedStatuses.length > 0)
                        ? 'No completed plans match the current filters'
                        : 'No completed plans'
                      }
                    </Text>
                  </Box>
                ) : (
                  <ElegantPlanList
                    plans={completedPlans}
                    selectable={true}
                    selectedIds={selectedPlanIds}
                    onSelectionChange={setSelectedPlanIds}
                    onPlanClick={onViewPlan}
                  />
                )}
              </Box>
            </>
          )}
        </Box>
      </VStack>

      {/* Selection Footer */}
      <ResourceSelectionFooter
        selectedCount={selectedPlanIds.size}
        isOpen={selectedPlanIds.size > 0}
        onClearSelection={clearSelection}
        resourceType="plan"
        actions={[
          {
            label: 'Delete',
            icon: LuTrash2,
            colorPalette: 'red',
            onClick: handleDelete,
          },
          {
            label: 'Complete',
            icon: LuCheck,
            colorPalette: 'green',
            onClick: handleComplete,
          },
        ]}
      />
    </Flex>
  );
});

export default memo(PlansSection, (prev, next) => {
  return (
    prev.plans === next.plans &&
    prev.plansLoading === next.plansLoading &&
    prev.projectId === next.projectId &&
    prev.projectPath === next.projectPath &&
    prev.onViewPlan === next.onViewPlan &&
    prev.onPlansChanged === next.onPlansChanged
  );
});
