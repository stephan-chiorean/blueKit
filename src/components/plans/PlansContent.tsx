import { useState, useMemo, useEffect, useRef } from 'react';
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
  IconButton,
  Table,
  VStack,
  Input,
  InputGroup,
  Field,
} from '@chakra-ui/react';
import { LuLayoutGrid, LuTable, LuX, LuFilter } from 'react-icons/lu';
import { ArtifactFile } from '../../ipc';

interface PlansContentProps {
  plans: ArtifactFile[];
  plansLoading: boolean;
  error: string | null;
  onViewPlan: (plan: ArtifactFile) => void;
  plansSource?: 'claude' | 'cursor';
}

type ViewMode = 'card' | 'table';

export default function PlansContent({
  plans,
  plansLoading,
  error,
  onViewPlan,
  plansSource,
}: PlansContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [nameFilter, setNameFilter] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Helper function to get display name for a plan
  const getDisplayName = (plan: ArtifactFile): string => {
    // For Cursor plans, extract name from filename (remove .plan.md or .plan)
    if (plansSource === 'cursor') {
      // Remove .plan.md or .plan from the end of the name
      let name = plan.name;
      if (name.endsWith('.plan.md')) {
        name = name.slice(0, -8); // Remove '.plan.md'
      } else if (name.endsWith('.plan')) {
        name = name.slice(0, -5); // Remove '.plan'
      }
      return plan.frontMatter?.title || plan.frontMatter?.alias || name;
    }
    // For Claude plans, use normal logic
    return plan.frontMatter?.title || plan.frontMatter?.alias || plan.name;
  };

  // Filter plans based on name
  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      const displayName = getDisplayName(plan);
      const matchesName = !nameFilter || 
        displayName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        plan.name.toLowerCase().includes(nameFilter.toLowerCase());
      
      return matchesName;
    });
  }, [plans, nameFilter, plansSource]);

  const handleViewPlan = (plan: ArtifactFile) => {
    onViewPlan(plan);
  };

  // Refs for filter panel and button to detect outside clicks
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterOpen &&
        filterPanelRef.current &&
        filterButtonRef.current &&
        !filterPanelRef.current.contains(event.target as Node) &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  if (plansLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading plans...
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500">
        Error: {error}
      </Box>
    );
  }

  if (plans.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No plans found.
      </Box>
    );
  }

  const renderCardView = () => (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {filteredPlans.map((plan) => {
        const displayName = getDisplayName(plan);
        // Extract relative path from full path (show path relative to plans directory)
        const pathParts = plan.path.split('/');
        const plansIndex = pathParts.findIndex(part => part === 'plans');
        const relativePath = plansIndex >= 0 
          ? pathParts.slice(plansIndex + 1).join('/')
          : plan.path;
        
        return (
          <Card.Root 
            key={plan.path} 
            variant="subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            cursor="pointer"
            onClick={() => handleViewPlan(plan)}
            _hover={{ borderColor: "primary.400", bg: "primary.50" }}
          >
            <CardHeader>
              <Heading size="md">{displayName}</Heading>
            </CardHeader>
            <CardBody display="flex" flexDirection="column" flex="1">
              <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                {relativePath}
              </Text>
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );

  const renderTableView = () => (
    <Table.Root size="sm" variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Title</Table.ColumnHeader>
          <Table.ColumnHeader>Path</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {filteredPlans.map((plan) => {
          const displayName = getDisplayName(plan);
          const pathParts = plan.path.split('/');
          const plansIndex = pathParts.findIndex(part => part === 'plans');
          const relativePath = plansIndex >= 0 
            ? pathParts.slice(plansIndex + 1).join('/')
            : plan.path;
          
          return (
            <Table.Row
              key={plan.path}
              cursor="pointer"
              onClick={() => handleViewPlan(plan)}
              _hover={{ bg: "bg.subtle" }}
            >
              <Table.Cell>
                <Text fontWeight="medium">{displayName}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm" color="text.secondary">
                  {relativePath}
                </Text>
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );

  return (
    <Box position="relative">
      {/* Main Content */}
      <VStack align="stretch" gap={4}>
        <Flex justify="space-between" align="center">
          {/* Filter Button */}
          <Button
            ref={filterButtonRef}
            variant="ghost"
            size="sm"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            bg={isFilterOpen ? "bg.subtle" : "bg.subtle"}
            borderWidth="1px"
            borderColor="border.subtle"
            _hover={{ bg: "bg.subtle" }}
          >
            <HStack gap={2}>
              <Icon>
                <LuFilter />
              </Icon>
              <Text>Filter</Text>
            </HStack>
          </Button>

          {/* View Mode Switcher */}
          <HStack gap={0} borderWidth="1px" borderColor="border.subtle" borderRadius="md" overflow="hidden" bg="bg.subtle">
            <Button
              onClick={() => setViewMode('card')}
              variant="ghost"
              borderRadius={0}
              borderRightWidth="1px"
              borderRightColor="border.subtle"
              bg={viewMode === 'card' ? 'white' : 'transparent'}
              color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
              _hover={{ bg: viewMode === 'card' ? 'white' : 'bg.subtle' }}
            >
              <HStack gap={2}>
                <Icon>
                  <LuLayoutGrid />
                </Icon>
                <Text>Cards</Text>
              </HStack>
            </Button>
            <Button
              onClick={() => setViewMode('table')}
              variant="ghost"
              borderRadius={0}
              bg={viewMode === 'table' ? 'white' : 'transparent'}
              color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
              _hover={{ bg: viewMode === 'table' ? 'white' : 'bg.subtle' }}
            >
              <HStack gap={2}>
                <Icon>
                  <LuTable />
                </Icon>
                <Text>Table</Text>
              </HStack>
            </Button>
          </HStack>
        </Flex>

        {/* Filter Overlay */}
        {isFilterOpen && (
          <Box
            ref={filterPanelRef}
            position="absolute"
            top="50px"
            left={0}
            zIndex={10}
            w="300px"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="md"
            p={4}
            bg="white"
            boxShadow="lg"
          >
            <VStack align="stretch" gap={4}>
              <Field.Root>
                <Field.Label>Name</Field.Label>
                <InputGroup
                  endElement={nameFilter ? (
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label="Clear name filter"
                      onClick={() => setNameFilter('')}
                    >
                      <Icon>
                        <LuX />
                      </Icon>
                    </IconButton>
                  ) : undefined}
                >
                  <Input
                    placeholder="Filter by name..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                </InputGroup>
              </Field.Root>
            </VStack>
          </Box>
        )}

        {/* Content */}
        {filteredPlans.length === 0 ? (
          <Box textAlign="center" py={12} color="text.secondary">
            No plans match the current filters.
          </Box>
        ) : (
          viewMode === 'card' ? renderCardView() : renderTableView()
        )}
      </VStack>
    </Box>
  );
}
