import { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Flex,
  Text,
  Icon,
  HStack,
  Button,
  Input,
  InputGroup,
  Field,
  IconButton,
  Spinner,
  VStack,
  Badge,
  Table,
  Progress,
} from '@chakra-ui/react';
import {
  LuPlus,
  LuX,
  LuMap,
} from 'react-icons/lu';
import { GrNavigate } from 'react-icons/gr';
import { Plan } from '../../types/plan';
import CreatePlanDialog from './CreatePlanDialog';
import { ViewModeSwitcher, STANDARD_VIEW_MODES } from '../shared/ViewModeSwitcher';

interface PlansTabContentProps {
  plans: Plan[];
  plansLoading: boolean;
  onViewPlan: (plan: Plan) => void;
  projectId: string;
  projectPath: string;
  onPlansChanged: () => void;
}

export interface PlansTabContentRef {
  openCreateDialog: () => void;
}

type ViewMode = 'card' | 'table' | 'roadmap';

const PlansTabContent = forwardRef<PlansTabContentRef, PlansTabContentProps>(({
  plans,
  plansLoading,
  onViewPlan,
  projectId,
  projectPath,
  onPlansChanged,
}, ref) => {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [filterText, setFilterText] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter plans by name or description
  const filteredPlans = useMemo(() => {
    if (!filterText) return plans;
    const lowerFilter = filterText.toLowerCase();
    return plans.filter(
      (plan) =>
        plan.name.toLowerCase().includes(lowerFilter) ||
        (plan.description && plan.description.toLowerCase().includes(lowerFilter))
    );
  }, [plans, filterText]);

  const handlePlanCreated = () => {
    onPlansChanged();
  };

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => {
      setIsCreateDialogOpen(true);
    },
  }));

  // Get status badge color palette
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

  // Format date
  // Note: Backend returns timestamp in seconds, but JavaScript Date expects milliseconds
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Render plan card
  const renderPlanCard = (plan: Plan) => {
    return (
      <Card.Root
        key={plan.id}
        borderWidth="1px"
        borderRadius="16px"
        cursor="pointer"
        onClick={() => onViewPlan(plan)}
        transition="all 0.2s ease-in-out"
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
          _hover: {
            transform: 'scale(1.02)',
            borderColor: 'var(--chakra-colors-primary-400)',
            zIndex: 10,
          },
        }}
      >
        <CardHeader>
          <VStack align="stretch" gap={2}>
            <Flex justify="space-between" align="start" gap={3}>
              <HStack gap={2} flex="1">
                <Icon boxSize={5} color="primary.500">
                  <LuMap />
                </Icon>
                <Heading size="md">{plan.name}</Heading>
              </HStack>
              <Badge
                size="sm"
                variant="subtle"
                colorPalette={getStatusColorPalette(plan.status)}
              >
                {plan.status}
              </Badge>
            </Flex>
            {plan.description && (
              <Text fontSize="sm" color="text.secondary" lineClamp={2}>
                {plan.description}
              </Text>
            )}
          </VStack>
        </CardHeader>

        <CardBody display="flex" flexDirection="column" gap={3}>
          {/* Progress bar */}
          <Box>
            <Flex justify="space-between" mb={1}>
              <Text fontSize="xs" color="text.tertiary">
                Progress
              </Text>
              <Text fontSize="xs" color="text.tertiary">
                {Math.round(plan.progress)}%
              </Text>
            </Flex>
            <Progress.Root value={plan.progress} size="sm" colorPalette="primary">
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
          </Box>

          <Text fontSize="xs" color="text.tertiary">
            Created {formatDate(plan.createdAt)}
          </Text>
        </CardBody>
      </Card.Root>
    );
  };

  if (plansLoading) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="lg" />
      </Box>
    );
  }

  if (plans.length === 0) {
    return (
      <VStack py={12} gap={3}>
        <CreatePlanDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onPlanCreated={handlePlanCreated}
          projectId={projectId}
          projectPath={projectPath}
        />
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
    );
  }

  return (
    <Box position="relative">
      <CreatePlanDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onPlanCreated={handlePlanCreated}
        projectId={projectId}
        projectPath={projectPath}
      />

      {/* Header with filter and view mode toggle */}
      <Flex align="center" justify="space-between" gap={2} mb={4} position="relative">
        <Flex align="center" gap={2} flex="1">
          <Heading size="md">Plans</Heading>
          <Text fontSize="sm" color="text.muted">
            {filteredPlans.length}
          </Text>
          {/* Filter input */}
          <Box w="300px">
            <Field.Root>
              <InputGroup
                endElement={
                  filterText ? (
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label="Clear filter"
                      onClick={() => setFilterText('')}
                    >
                      <Icon>
                        <LuX />
                      </Icon>
                    </IconButton>
                  ) : undefined
                }
              >
                <Input
                  placeholder="Filter by name or description..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  size="sm"
                />
              </InputGroup>
            </Field.Root>
          </Box>
        </Flex>

        {/* View Mode Switcher */}
        <ViewModeSwitcher
          value={viewMode}
          onChange={(mode) => setViewMode(mode as ViewMode)}
          modes={[
            STANDARD_VIEW_MODES.card,
            STANDARD_VIEW_MODES.table,
            { id: 'roadmap', label: 'Roadmap', icon: GrNavigate },
          ]}
        />
      </Flex>

      {/* Plans list */}
      {filteredPlans.length === 0 ? (
        <Box
          p={6}
          bg="bg.subtle"
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.subtle"
          textAlign="center"
        >
          <Text color="text.muted" fontSize="sm">
            No plans match the current filter
          </Text>
        </Box>
      ) : viewMode === 'card' ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} overflow="visible">
          {filteredPlans.map(renderPlanCard)}
        </SimpleGrid>
      ) : viewMode === 'roadmap' ? (
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
      ) : (
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
            <Table.Row bg="transparent">
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
      )}
    </Box>
  );
});

PlansTabContent.displayName = 'PlansTabContent';

export default PlansTabContent;
