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
import { LuBot, LuPackage, LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { KitFile } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';
import TaskDetailModal from './TaskDetailModal';

// Blueprint structure matching the spec
interface BlueprintTask {
  id: string;
  alias: string;
  agent?: string;
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
  description?: string;
  layers: BlueprintLayer[];
}

// Mock blueprints data
const mockBlueprints: Blueprint[] = [
  {
    id: 'full-stack-app',
    name: 'Full Stack App',
    version: 1,
    description: 'A complete full-stack application blueprint with database setup, frontend UI, authentication, and testing layers.',
    layers: [
      {
        id: 'layer-1',
        order: 1,
        name: 'Initialization',
        tasks: [
          { id: 'task-db', alias: 'Database Setup', agent: 'backend-ops', kit: 'infra/db-setup' },
          { id: 'task-ui', alias: 'UI Shell', agent: 'cursor', kit: 'frontend/ui-shell' },
        ],
      },
      {
        id: 'layer-2',
        order: 2,
        name: 'Business Logic',
        tasks: [
          { id: 'task-auth', alias: 'Authentication Flow', agent: 'cursor', kit: 'auth/auth-flow' },
        ],
      },
      {
        id: 'layer-3',
        order: 3,
        name: 'Testing',
        tasks: [
          { id: 'task-tests', alias: 'Test Suite', agent: 'qa-bot', kit: 'testing/test-suite' },
        ],
      },
    ],
  },
  {
    id: 'api-server',
    name: 'API Server',
    version: 1,
    description: 'Blueprint for setting up a RESTful API server with comprehensive documentation.',
    layers: [
      {
        id: 'layer-1',
        order: 1,
        name: 'Setup',
        tasks: [
          { id: 'task-api', alias: 'API Server', agent: 'cursor', kit: 'backend/api-server' },
          { id: 'task-docs', alias: 'API Documentation', kit: 'docs/api-docs' },
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
  kits: _kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit: _onViewKit,
}: BlueprintsTabContentProps) {
  const { isSelected } = useSelection();
  const [expandedBlueprints, setExpandedBlueprints] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<BlueprintTask | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

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

  const handleTaskClick = (task: BlueprintTask) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleUpdateTask = (taskId: string, agentId: string | undefined) => {
    // Update the selected task state to reflect the change
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, agent: agentId });
    }
    // Note: In a real implementation, this would update the actual blueprint file
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
                        {blueprint.description ? (
                          <Text fontSize="xs" color="text.secondary">
                            {blueprint.description}
                          </Text>
                        ) : (
                          <Text fontSize="xs" color="text.secondary">
                            ID: {blueprint.id} • v{blueprint.version}
                          </Text>
                        )}
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
                                    cursor="pointer"
                                    _hover={{ bg: 'primary.50', borderColor: 'primary.300' }}
                                    onClick={() => handleTaskClick(task)}
                                  >
                                    <CardBody py={2}>
                                      <VStack align="start" gap={1} flex="1">
                                        <Text fontSize="sm" fontWeight="medium">
                                          {task.alias}
                                        </Text>
                                        <HStack gap={2}>
                                          {task.agent ? (
                                            <Tag.Root size="sm" variant="subtle">
                                              <Icon size="xs">
                                                <LuBot />
                                              </Icon>
                                              <Tag.Label ml={1}>{task.agent}</Tag.Label>
                                            </Tag.Root>
                                          ) : null}
                                          <Tag.Root size="sm" variant="subtle">
                                            <Icon size="xs">
                                              <LuPackage />
                                            </Icon>
                                            <Tag.Label ml={1}>{task.kit}</Tag.Label>
                                          </Tag.Root>
                                        </HStack>
                                      </VStack>
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
      <TaskDetailModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onUpdateTask={handleUpdateTask}
      />
    </Box>
  );
}
