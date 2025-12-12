import { useState, useEffect } from 'react';
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
import { LuPackage, LuChevronDown, LuChevronRight, LuFolderPlus } from 'react-icons/lu';
import { Blueprint, BlueprintTask } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';
import { invokeGetBlueprints, invokeGetBlueprintTaskFile, invokeCopyBlueprintToProject } from '../../ipc';
import { open } from '@tauri-apps/api/dialog';
import { toaster } from '../ui/toaster';
import TaskDetailModal from './TaskDetailModal';

interface BlueprintsTabContentProps {
  projectPath: string;
  projectsCount: number;
  onViewTask: (blueprintPath: string, taskFile: string, taskDescription: string) => void;
}

export default function BlueprintsTabContent({
  projectPath,
  projectsCount,
  onViewTask,
}: BlueprintsTabContentProps) {
  const { isSelected } = useSelection();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [blueprintsLoading, setBlueprintsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBlueprints, setExpandedBlueprints] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<{ blueprint: Blueprint; task: BlueprintTask } | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Load blueprints from .bluekit/blueprints
  useEffect(() => {
    const loadBlueprints = async () => {
      try {
        setBlueprintsLoading(true);
        setError(null);
        const loadedBlueprints = await invokeGetBlueprints(projectPath);
        setBlueprints(loadedBlueprints);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load blueprints');
        console.error('Error loading blueprints:', err);
      } finally {
        setBlueprintsLoading(false);
      }
    };

    if (projectPath) {
      loadBlueprints();
    }
  }, [projectPath]);

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

  const handleTaskClick = (blueprint: Blueprint, task: BlueprintTask) => {
    setSelectedTask({ blueprint, task });
    setIsTaskModalOpen(true);
  };

  const handleAddToProject = async (blueprint: Blueprint) => {
    try {
      // Open directory picker to select a project
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project',
      });

      if (!selectedPath || typeof selectedPath !== 'string') {
        // User cancelled
        return;
      }

      // Copy the blueprint directory to the target project
      await invokeCopyBlueprintToProject(blueprint.path, selectedPath);

      // Show success toast
      toaster.create({
        type: 'success',
        title: 'Success',
        description: `Successfully copied blueprint "${blueprint.metadata.name}" to project`,
      });
    } catch (error) {
      console.error('[BlueprintsTabContent] Error in Add to Project:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: `Failed to add blueprint to project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  if (blueprintsLoading) {
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
          const isExpanded = expandedBlueprints.has(blueprint.metadata.id);
          const blueprintSelected = isSelected(blueprint.metadata.id);
          const totalTasks = blueprint.metadata.layers.reduce((sum, layer) => sum + layer.tasks.length, 0);

          return (
            <Card.Root
              key={blueprint.metadata.id}
              variant="subtle"
              borderWidth={blueprintSelected ? "2px" : "1px"}
              borderColor={blueprintSelected ? "primary.500" : "border.subtle"}
            >
              <CardHeader>
                <VStack align="stretch" gap={3}>
                  <Flex align="center" justify="space-between" gap={4}>
                    <HStack gap={3} flex="1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBlueprintExpansion(blueprint.metadata.id)}
                        p={1}
                      >
                        <Icon>
                          {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                        </Icon>
                      </Button>
                      <VStack align="start" gap={0} flex="1">
                        <Heading size="md">{blueprint.metadata.name}</Heading>
                        {blueprint.metadata.description ? (
                          <Text fontSize="xs" color="text.secondary">
                            {blueprint.metadata.description}
                          </Text>
                        ) : (
                          <Text fontSize="xs" color="text.secondary">
                            ID: {blueprint.metadata.id} • v{blueprint.metadata.version}
                          </Text>
                        )}
                        <Button
                          variant="outline"
                          size="xs"
                          mt={2}
                          onClick={() => handleAddToProject(blueprint)}
                        >
                          <HStack gap={1}>
                            <Icon size="xs">
                              <LuFolderPlus />
                            </Icon>
                            <Text>Add to Project</Text>
                          </HStack>
                        </Button>
                      </VStack>
                    </HStack>
                    <HStack gap={2}>
                      <Badge colorPalette="primary" variant="subtle">
                        {blueprint.metadata.layers.length} layer{blueprint.metadata.layers.length !== 1 ? 's' : ''}
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
                      {blueprint.metadata.layers
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
                                    _hover={{ borderColor: 'primary.300' }}
                                    onClick={() => handleTaskClick(blueprint, task)}
                                  >
                                    <CardBody py={2}>
                                      <VStack align="start" gap={1} flex="1">
                                        <Text fontSize="sm" fontWeight="medium">
                                          {task.description}
                                        </Text>
                                        <Tag.Root size="sm" variant="subtle">
                                          <Icon size="xs">
                                            <LuPackage />
                                          </Icon>
                                          <Tag.Label ml={1}>{task.taskFile}</Tag.Label>
                                        </Tag.Root>
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
        onViewTask={onViewTask}
      />
    </Box>
  );
}
