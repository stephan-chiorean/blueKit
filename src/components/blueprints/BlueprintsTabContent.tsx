import { useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Flex,
  Text,
  HStack,
  VStack,
  Tag,
  Badge,
  EmptyState,
  Button,
  Icon,
  Collapsible,
} from '@chakra-ui/react';
import { LuBot, LuPackage, LuChevronDown, LuChevronRight, LuPlus } from 'react-icons/lu';
import { KitFile } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';

// Blueprint structure matching the spec
interface BlueprintTask {
  id: string;
  agent: string;
  kit: string;
}

interface BlueprintLayer {
  id: string;
  order: number;
  name: string;
  tasks: BlueprintTask[];
}

interface Blueprint {
  id: string;
  name: string;
  version: number;
  layers: BlueprintLayer[];
}

// Mock blueprints data
const mockBlueprints: Blueprint[] = [
  {
    id: 'full-stack-app',
    name: 'Full Stack App',
    version: 1,
    layers: [
      {
        id: 'layer-1',
        order: 1,
        name: 'Initialization',
        tasks: [
          { id: 'task-db', agent: 'backend-ops', kit: 'infra/db-setup' },
          { id: 'task-ui', agent: 'cursor', kit: 'frontend/ui-shell' },
        ],
      },
      {
        id: 'layer-2',
        order: 2,
        name: 'Business Logic',
        tasks: [
          { id: 'task-auth', agent: 'cursor', kit: 'auth/auth-flow' },
        ],
      },
      {
        id: 'layer-3',
        order: 3,
        name: 'Testing',
        tasks: [
          { id: 'task-tests', agent: 'qa-bot', kit: 'testing/test-suite' },
        ],
      },
    ],
  },
  {
    id: 'api-server',
    name: 'API Server',
    version: 1,
    layers: [
      {
        id: 'layer-1',
        order: 1,
        name: 'Setup',
        tasks: [
          { id: 'task-api', agent: 'cursor', kit: 'backend/api-server' },
          { id: 'task-docs', agent: 'cursor', kit: 'docs/api-docs' },
        ],
      },
    ],
  },
];

interface BlueprintsTabContentProps {
  kits: KitFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  onViewKit: (kit: KitFile) => void;
}

export default function BlueprintsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit,
}: BlueprintsTabContentProps) {
  const { toggleItem, isSelected } = useSelection();
  const [expandedBlueprints, setExpandedBlueprints] = useState<Set<string>>(new Set());

  const handleBlueprintToggle = (blueprintId: string) => {
    const itemToToggle = {
      id: blueprintId,
      name: blueprintId,
      type: 'Blueprint' as const,
      path: blueprintId,
    };
    toggleItem(itemToToggle);
  };

  const toggleBlueprintExpansion = (blueprintId: string) => {
    setExpandedBlueprints((prev) => {
      const next = new Set(prev);
      if (next.has(blueprintId)) {
        next.delete(blueprintId);
      } else {
        next.add(blueprintId);
      }
      return next;
    });
  };

  if (kitsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading blueprints...
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

  if (projectsCount === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No projects linked. Projects are managed via CLI and will appear here automatically.
      </Box>
    );
  }

  // Using mock data for now
  const blueprints = mockBlueprints;

  if (blueprints.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon size="xl" color="primary.500">
              <LuPackage />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>No blueprints found</EmptyState.Title>
          <EmptyState.Description>
            Blueprints will appear here once they are created in your .bluekit directory.
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Box>
      <Flex mb={4} justify="flex-end">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<LuPlus />}
          onClick={() => {
            // TODO: Open create blueprint modal
            console.log('Create blueprint');
          }}
        >
          Add Blueprint
        </Button>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 1, lg: 1 }} gap={4}>
        {blueprints.map((blueprint) => {
          const isExpanded = expandedBlueprints.has(blueprint.id);
          const blueprintSelected = isSelected(blueprint.id);
          const totalTasks = blueprint.layers.reduce((sum, layer) => sum + layer.tasks.length, 0);

          return (
            <Card.Root
              key={blueprint.id}
              variant="subtle"
              borderWidth={blueprintSelected ? "2px" : "1px"}
              borderColor={blueprintSelected ? "primary.500" : "border.subtle"}
              bg={blueprintSelected ? "primary.50" : undefined}
            >
              <CardHeader>
                <VStack align="stretch" gap={3}>
                  <Flex align="center" justify="space-between" gap={4}>
                    <HStack gap={3} flex="1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBlueprintExpansion(blueprint.id)}
                        p={1}
                      >
                        <Icon>
                          {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                        </Icon>
                      </Button>
                      <VStack align="start" gap={0}>
                        <Heading size="md">{blueprint.name}</Heading>
                        <Text fontSize="xs" color="text.secondary">
                          ID: {blueprint.id} • v{blueprint.version}
                        </Text>
                      </VStack>
                    </HStack>
                    <HStack gap={2}>
                      <Badge colorPalette="primary" variant="subtle">
                        {blueprint.layers.length} layer{blueprint.layers.length !== 1 ? 's' : ''}
                      </Badge>
                      <Badge colorPalette="blue" variant="subtle">
                        {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                      </Badge>
                    </HStack>
                  </Flex>
                </VStack>
              </CardHeader>
              <CardBody>
                <Collapsible.Root open={isExpanded}>
                  <Collapsible.Content>
                    <VStack align="stretch" gap={4} mt={2}>
                      {blueprint.layers
                        .sort((a, b) => a.order - b.order)
                        .map((layer) => (
                          <Box key={layer.id} pl={4} borderLeft="2px solid" borderColor="primary.200">
                            <VStack align="stretch" gap={2}>
                              <HStack justify="space-between">
                                <HStack gap={2}>
                                  <Badge size="sm" colorPalette="primary">
                                    Layer {layer.order}
                                  </Badge>
                                  <Text fontWeight="semibold" fontSize="sm">
                                    {layer.name}
                                  </Text>
                                </HStack>
                                <Text fontSize="xs" color="text.secondary">
                                  {layer.tasks.length} task{layer.tasks.length !== 1 ? 's' : ''}
                                </Text>
                              </HStack>
                              <VStack align="stretch" gap={2} pl={4}>
                                {layer.tasks.map((task) => (
                                  <Card.Root
                                    key={task.id}
                                    variant="outline"
                                    size="sm"
                                    bg="bg.subtle"
                                  >
                                    <CardBody py={2}>
                                      <HStack justify="space-between" align="start">
                                        <VStack align="start" gap={1} flex="1">
                                          <Text fontSize="sm" fontWeight="medium">
                                            {task.kit}
                                          </Text>
                                          <HStack gap={2}>
                                            <Tag.Root size="sm" variant="subtle">
                                              <Icon size="xs">
                                                <LuBot />
                                              </Icon>
                                              <Tag.Label ml={1}>{task.agent}</Tag.Label>
                                            </Tag.Root>
                                            <Tag.Root size="sm" variant="subtle">
                                              <Icon size="xs">
                                                <LuPackage />
                                              </Icon>
                                              <Tag.Label ml={1}>Kit</Tag.Label>
                                            </Tag.Root>
                                          </HStack>
                                        </VStack>
                                      </HStack>
                                    </CardBody>
                                  </Card.Root>
                                ))}
                              </VStack>
                            </VStack>
                          </Box>
                        ))}
                    </VStack>
                  </Collapsible.Content>
                </Collapsible.Root>
              </CardBody>
            </Card.Root>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
