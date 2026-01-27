import { useState, useMemo, forwardRef, useImperativeHandle, memo } from 'react';
import {
  Box,
  SimpleGrid,
  Text,
  VStack,
  Button,
  HStack,
  Icon,
  Badge,
  Table,
} from '@chakra-ui/react';
import {
  LuPlus,
  LuFilter,
  LuMap,
} from 'react-icons/lu';
import { GrNavigate } from 'react-icons/gr';
import { Plan } from '@/types/plan';
import CreatePlanDialog from '@/features/plans/components/CreatePlanDialog';
import { ViewModeSwitcher, STANDARD_VIEW_MODES } from '@/shared/components/ViewModeSwitcher';
import { PlanResourceCard } from '@/shared/components/PlanResourceCard';
import { PlanCardSkeleton, TableSkeleton } from '@/shared/components/Skeletons';
import { StandardPageLayout } from '@/shared/components/layouts/StandardPageLayout';
import { FilterPanel } from '@/shared/components/FilterPanel';
import { ResourceSelectionBar } from '@/shared/components/ResourceSelectionBar';
import { useSelection } from '@/shared/contexts/SelectionContext';

interface PlansSectionProps {
  plans: Plan[];
  plansLoading: boolean;
  onViewPlan: (plan: Plan) => void;
  projectId: string;
  projectPath: string;
  onPlansChanged: () => void;
}

export interface PlansSectionRef {
  openCreateDialog: () => void;
}

type ViewMode = 'card' | 'table' | 'roadmap';

const PlansSection = forwardRef<PlansSectionRef, PlansSectionProps>(({
  plans,
  plansLoading,
  onViewPlan,
  projectId,
  projectPath,
  onPlansChanged,
}, ref) => {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection } = useSelection();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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

  const isSelected = (planId: string) => isSelectedInContext(planId);

  const handlePlanToggle = (plan: Plan) => {
    toggleItem({
      id: plan.id,
      name: plan.name,
      type: 'Plan',
      projectId: plan.projectId,
      projectPath: projectPath,
      path: plan.folderPath, // Using folderPath as path for now, or just leave undefined if not file-based in same way
    });
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

  // Format date helper
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000); // Check if backend sends seconds or ms. The types say number. 
    // Usually Rust sends seconds, but JS wants ms. Previous code used * 1000.
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Status badge color helper (duplicated from component for table view)
  const getStatusColorPalette = (status: string) => {
    switch (status) {
      case 'active': return 'blue';
      case 'completed': return 'green';
      case 'archived': return 'gray';
      default: return 'gray';
    }
  };

  const renderContent = () => {
    if (viewMode === 'table') {
      return (
        <Table.Root
          size="sm"
          variant="outline"
          borderRadius="16px"
          overflow="hidden"
          css={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
            _dark: {
              background: 'rgba(0, 0, 0, 0.2)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
            },
          }}
        >
          <Table.Header>
            <Table.Row
              css={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderBottomWidth: '1px',
                borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                _dark: {
                  background: 'rgba(30, 30, 30, 0.85)',
                  borderBottomColor: 'rgba(255, 255, 255, 0.15)',
                },
              }}
            >
              <Table.ColumnHeader w="30%">Name</Table.ColumnHeader>
              <Table.ColumnHeader w="35%">Description</Table.ColumnHeader>
              <Table.ColumnHeader w="10%">Status</Table.ColumnHeader>
              <Table.ColumnHeader w="10%">Progress</Table.ColumnHeader>
              <Table.ColumnHeader w="15%">Created</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredPlans.map((plan) => (
              <Table.Row
                key={plan.id}
                cursor="pointer"
                onClick={() => onViewPlan(plan)}
                bg="transparent"
                borderBottomWidth="1px"
                borderBottomColor="transparent"
                _hover={{
                  bg: "rgba(255, 255, 255, 0.05)",
                  borderBottomColor: "primary.500",
                }}
              >
                <Table.Cell>
                  <HStack gap={2}>
                    <Icon color="primary.500">
                      <LuMap />
                    </Icon>
                    <Text fontWeight="medium">{plan.name}</Text>
                  </HStack>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" color="text.secondary" lineClamp={1}>
                    {plan.description || '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    size="sm"
                    variant="subtle"
                    colorPalette={getStatusColorPalette(plan.status)}
                  >
                    {plan.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" color="text.tertiary">
                    {Math.round(plan.progress)}%
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" color="text.secondary">
                    {formatDate(plan.createdAt)}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      );
    }

    if (viewMode === 'roadmap') {
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
            Roadmap view coming soon
          </Text>
        </Box>
      );
    }

    // Default to card view
    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} overflow="visible">
        {filteredPlans.map((plan, index) => (
          <PlanResourceCard
            key={plan.id}
            plan={plan}
            isSelected={isSelected(plan.id)}
            onToggle={() => handlePlanToggle(plan)}
            onClick={() => onViewPlan(plan)}
            index={index}
          />
        ))}
      </SimpleGrid>
    );
  };

  const projectName = projectPath.split('/').pop() || 'Project';

  return (
    <Box position="relative">
      <CreatePlanDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onPlanCreated={handlePlanCreated}
        projectId={projectId}
        projectPath={projectPath}
      />

      <StandardPageLayout
        title="Plans"
        parentName={projectName}
        headerAction={{
          label: "Create Plan",
          onClick: handleOpenCreateDialog,
          variant: "icon",
          icon: LuPlus,
        }}
        filterControl={
          <Box position="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              borderWidth="1px"
              borderRadius="lg"
              css={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                transition: 'none',
                _dark: {
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                },
              }}
            >
              <HStack gap={2}>
                <Icon>
                  <LuFilter />
                </Icon>
                <Text>Filter</Text>
                {(nameFilter || selectedStatuses.length > 0) && (
                  <Badge size="sm" colorPalette="primary" variant="solid">
                    {(nameFilter ? 1 : 0) + selectedStatuses.length}
                  </Badge>
                )}
              </HStack>
            </Button>
            <FilterPanel
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              nameFilter={nameFilter}
              onNameFilterChange={setNameFilter}
              allTags={[]} // Plans don't have tags yet
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
        viewSwitcher={
          <ViewModeSwitcher
            variant="liquid"
            value={viewMode}
            onChange={(mode) => setViewMode(mode as ViewMode)}
            modes={[
              STANDARD_VIEW_MODES.card,
              STANDARD_VIEW_MODES.table,
              { id: 'roadmap', label: 'Roadmap', icon: GrNavigate },
            ]}
          />
        }
        itemCount={filteredPlans.length}
        itemLabel="plans"
        isLoading={plansLoading}
        loadingSkeleton={
          viewMode === 'table' ? (
            <Box py={4}>
              <TableSkeleton />
            </Box>
          ) : (
            <Box py={4}>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <PlanCardSkeleton key={i} />
                ))}
              </SimpleGrid>
            </Box>
          )
        }
        isEmpty={plans.length === 0}
        emptyState={
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
        }
      >
        {renderContent()}
      </StandardPageLayout>

      <ResourceSelectionBar
        isOpen={selectedItems.length > 0}
        selectedItems={selectedItems}
        onClearSelection={clearSelection}
        onMoveToFolder={() => { }} // Plans don't support moving to folders yet
        folders={[]}
      />
    </Box>
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
