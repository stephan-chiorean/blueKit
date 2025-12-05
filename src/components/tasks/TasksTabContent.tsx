import { useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  Tag,
  VStack,
  Badge,
  Checkbox,
  Button,
  Icon,
  Spinner,
  Table,
} from '@chakra-ui/react';
import { LuPlus, LuFolder, LuLayoutGrid, LuTable, LuFilter } from 'react-icons/lu';
import { Task } from '../../types/task';
import { ProjectEntry, invokeDbGetTasks, invokeDbGetProjectTasks } from '../../ipc';
import TasksActionBar from './TasksActionBar';
import EditTaskDialog from './EditTaskDialog';
import TaskCreateDialog from './TaskCreateDialog';
import { toaster } from '../ui/toaster';
import { getPriorityLabel, shouldShowPriorityBadge, getPriorityIcon, getPriorityHoverColors, getPriorityColorPalette } from '../../utils/taskUtils';

interface TasksTabContentProps {
  context: 'workspace' | ProjectEntry;  // workspace view or specific project
  projects: ProjectEntry[];  // All projects for multi-select
}

export interface TasksTabContentRef {
  openCreateDialog: () => void;
}

type SortOption = 'priority' | 'time';
type ViewMode = 'card' | 'table';

const TasksTabContent = forwardRef<TasksTabContentRef, TasksTabContentProps>(({
  context,
  projects,
}, ref) => {
  // Local state for tasks (loaded from database)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Local state for selected tasks
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('time');
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  // Load tasks from database
  const loadTasks = async () => {
    try {
      setLoading(true);
      const loadedTasks: Task[] = context === 'workspace'
        ? await invokeDbGetTasks()
        : await invokeDbGetProjectTasks((context as ProjectEntry).id);
      setTasks(loadedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to load tasks',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Load tasks on mount and when context changes
  useEffect(() => {
    loadTasks();
  }, [context]);

  // Get selected tasks
  const selectedTasks = useMemo(() => {
    return tasks.filter(task => selectedTaskIds.has(task.id));
  }, [tasks, selectedTaskIds]);

  const isSelected = (id: string) => {
    return selectedTaskIds.has(id);
  };

  const handleTaskToggle = (task: Task) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleAddTask = () => {
    setIsCreateDialogOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => {
      setIsCreateDialogOpen(true);
    },
  }));

  const handleTaskCreated = () => {
    // Reload tasks from database
    loadTasks();
  };

  // Get priority order for sorting (lower number = higher priority)
  const getPriorityOrder = (priority: string): number => {
    switch (priority) {
      case 'pinned':
        return 0;
      case 'high':
        return 1;
      case 'standard':
        return 2;
      case 'long term':
        return 3;
      case 'nit':
        return 4;
      default:
        return 5; // Unknown priorities go last
    }
  };

  // Get complexity label
  const getComplexityLabel = (complexity?: string) => {
    if (!complexity) return null;
    switch (complexity) {
      case 'easy':
        return 'Easy';
      case 'hard':
        return 'Hard';
      case 'deep dive':
        return 'Deep Dive';
      default:
        return complexity;
    }
  };

  // Sort tasks based on selected sort option, filtering out completed tasks
  const sortedTasks = useMemo(() => {
    // Filter out completed tasks first
    const visibleTasks = tasks.filter(task => task.status !== 'completed');
    const tasksCopy = [...visibleTasks];

    // Always separate pinned tasks first, then sort the rest
    const pinnedTasks = tasksCopy.filter(task => task.priority === 'pinned');
    const otherTasks = tasksCopy.filter(task => task.priority !== 'pinned');

    if (sortBy === 'priority') {
      // Sort by priority order: pinned -> high -> long term -> standard
      const sortedOther = otherTasks.sort((a, b) => {
        const orderA = getPriorityOrder(a.priority);
        const orderB = getPriorityOrder(b.priority);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // If same priority, sort by updatedAt (most recent first)
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      // Sort pinned tasks by updatedAt (most recent first)
      const sortedPinned = pinnedTasks.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      return [...sortedPinned, ...sortedOther];
    } else if (sortBy === 'time') {
      // Sort by updatedAt (most recent first), but pinned tasks always first
      const sortedOther = otherTasks.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      const sortedPinned = pinnedTasks.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      return [...sortedPinned, ...sortedOther];
    }

    return tasksCopy;
  }, [tasks, sortBy]);

  // Split tasks into In Progress and Backlog sections
  const inProgressTasks = useMemo(() => {
    return sortedTasks.filter(task => task.status === 'in_progress');
  }, [sortedTasks]);

  const backlogTasks = useMemo(() => {
    return sortedTasks.filter(task => task.status !== 'in_progress');
  }, [sortedTasks]);

  if (loading) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="lg" />
      </Box>
    );
  }

  if (tasks.length === 0) {
    return (
      <VStack py={12} gap={3}>
        <TaskCreateDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onTaskCreated={handleTaskCreated}
          projects={projects}
          defaultProjectId={context !== 'workspace' ? (context as ProjectEntry).id : undefined}
        />
        <Text color="text.secondary" fontSize="lg">
          No tasks yet
        </Text>
        <Text color="text.tertiary" fontSize="sm">
          Click "Add Task" to create your first task
        </Text>
        <Button colorPalette="primary" onClick={handleAddTask}>
          <HStack gap={2}>
            <LuPlus />
            <Text>Add Task</Text>
          </HStack>
        </Button>
      </VStack>
    );
  }

  // Helper function to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper function to render task card (used in both In Progress and Backlog sections)
  const renderTaskCard = (task: Task) => {
    const taskSelected = isSelected(task.id);
    const complexityLabel = getComplexityLabel(task.complexity);
    const priorityIcon = getPriorityIcon(task.priority);
    const hoverColors = getPriorityHoverColors(task.priority);

    return (
      <Card.Root
        key={task.id}
        variant="subtle"
        borderWidth={taskSelected ? "2px" : "1px"}
        borderColor={taskSelected ? "primary.500" : "border.subtle"}
        bg={taskSelected ? "primary.50" : undefined}
        position="relative"
        cursor="pointer"
        onClick={() => handleViewTask(task)}
        _hover={{ borderColor: hoverColors.borderColor, bg: hoverColors.bg }}
      >
        <CardHeader>
          <VStack align="stretch" gap={3}>
            <Flex justify="space-between" align="start" gap={3}>
              <HStack gap={2} flex="1" align="center">
                <Heading size="md">{task.title}</Heading>
                {priorityIcon && (
                  <Icon color={priorityIcon.color} boxSize={5}>
                    <priorityIcon.icon />
                  </Icon>
                )}
              </HStack>
              <Checkbox.Root
                checked={taskSelected}
                colorPalette="blue"
                onCheckedChange={() => {
                  handleTaskToggle(task);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                cursor="pointer"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control cursor="pointer">
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox.Root>
            </Flex>

            <HStack gap={2} flexWrap="wrap">
              {/* Show complexity if available */}
              {complexityLabel && (
                <Badge size="sm" variant="outline" colorPalette="gray">
                  {complexityLabel}
                </Badge>
              )}
            </HStack>

            {/* Project badges - gray/muted */}
            {task.projectIds.length > 0 && (
              <HStack gap={1} flexWrap="wrap">
                {task.projectIds.map(projectId => {
                  const project = projects.find(p => p.id === projectId);
                  return project ? (
                    <Badge key={projectId} size="xs" variant="outline" colorPalette="gray">
                      <HStack gap={1}>
                        <LuFolder size={10} />
                        <Text>{project.title}</Text>
                      </HStack>
                    </Badge>
                  ) : null;
                })}
              </HStack>
            )}
          </VStack>
        </CardHeader>

        <CardBody display="flex" flexDirection="column" gap={3}>
          {/* Tags - colored to match priority icon */}
          {task.tags && task.tags.length > 0 && (
            <HStack gap={1} flexWrap="wrap">
              {task.tags.map((tag) => (
                <Tag.Root 
                  key={tag} 
                  size="sm" 
                  variant="subtle"
                  colorPalette={getPriorityColorPalette(task.priority)}
                >
                  <Tag.Label>{tag}</Tag.Label>
                </Tag.Root>
              ))}
            </HStack>
          )}
        </CardBody>
      </Card.Root>
    );
  };

  return (
    <Box position="relative">
      <EditTaskDialog
        task={selectedTask}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={loadTasks}
      />

      <TaskCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onTaskCreated={handleTaskCreated}
        projects={projects}
        defaultProjectId={context !== 'workspace' ? (context as ProjectEntry).id : undefined}
      />

      <TasksActionBar
        selectedTasks={selectedTasks}
        hasSelection={selectedTaskIds.size > 0}
        clearSelection={clearSelection}
        onTasksUpdated={loadTasks}
      />

      {/* Controls Bar - Filter and View Mode */}
      <Flex justify="space-between" align="center" mb={6}>
        {/* Filter Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {}}
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
            size="sm"
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
            size="sm"
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

      {/* In Progress Section */}
      <Box mb={8}>
        <Flex align="center" gap={2} mb={4}>
          <Heading size="md">In Progress</Heading>
          <Text fontSize="sm" color="text.muted">
            {inProgressTasks.length}
          </Text>
        </Flex>

        {inProgressTasks.length === 0 ? (
          <Box
            p={6}
            bg="bg.subtle"
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.subtle"
            textAlign="center"
          >
            <Text color="text.muted" fontSize="sm">
              {context === 'workspace'
                ? 'No tasks in progress'
                : `No tasks in progress for ${(context as ProjectEntry).title}`
              }
            </Text>
          </Box>
        ) : viewMode === 'card' ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {inProgressTasks.map(renderTaskCard)}
          </SimpleGrid>
        ) : (
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader w="6"></Table.ColumnHeader>
                <Table.ColumnHeader w="30%">Title</Table.ColumnHeader>
                <Table.ColumnHeader w="15%">Complexity</Table.ColumnHeader>
                <Table.ColumnHeader w="20%">Projects</Table.ColumnHeader>
                <Table.ColumnHeader w="20%">Tags</Table.ColumnHeader>
                <Table.ColumnHeader w="15%">Updated</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {inProgressTasks.map((task) => {
                const taskSelected = isSelected(task.id);
                const complexityLabel = getComplexityLabel(task.complexity);
                const priorityIcon = getPriorityIcon(task.priority);
                const hoverColors = getPriorityHoverColors(task.priority);
                return (
                  <Table.Row
                    key={task.id}
                    cursor="pointer"
                    onClick={() => handleViewTask(task)}
                    _hover={{ bg: hoverColors.bg, borderColor: hoverColors.borderColor }}
                    data-selected={taskSelected ? "" : undefined}
                  >
                    <Table.Cell>
                      <Checkbox.Root
                        size="sm"
                        checked={taskSelected}
                        colorPalette="blue"
                        onCheckedChange={() => {
                          handleTaskToggle(task);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        cursor="pointer"
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control cursor="pointer">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Root>
                    </Table.Cell>
                    <Table.Cell>
                      <HStack gap={2}>
                        <Text fontWeight="medium">{task.title}</Text>
                        {priorityIcon && (
                          <Icon color={priorityIcon.color}>
                            <priorityIcon.icon />
                          </Icon>
                        )}
                      </HStack>
                    </Table.Cell>
                    <Table.Cell>
                      {complexityLabel ? (
                        <Badge size="sm" variant="outline" colorPalette="gray">
                          {complexityLabel}
                        </Badge>
                      ) : (
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {task.projectIds.length > 0 ? (
                        <HStack gap={1} flexWrap="wrap">
                          {task.projectIds.map(projectId => {
                            const project = projects.find(p => p.id === projectId);
                            return project ? (
                              <Badge key={projectId} size="xs" variant="outline" colorPalette="gray">
                                <HStack gap={1}>
                                  <LuFolder size={10} />
                                  <Text>{project.title}</Text>
                                </HStack>
                              </Badge>
                            ) : null;
                          })}
                        </HStack>
                      ) : (
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {task.tags && task.tags.length > 0 ? (
                        <HStack gap={1} flexWrap="wrap">
                          {task.tags.map((tag) => (
                            <Tag.Root key={tag} size="sm" variant="subtle">
                              <Tag.Label>{tag}</Tag.Label>
                            </Tag.Root>
                          ))}
                        </HStack>
                      ) : (
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" color="text.secondary">
                        {formatDate(task.updatedAt)}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </Box>

      {/* Backlog Section */}
      <Box>
        <Flex align="center" gap={2} mb={4}>
          <Heading size="md">Backlog</Heading>
          <Text fontSize="sm" color="text.muted">
            {backlogTasks.length}
          </Text>
        </Flex>

        {backlogTasks.length === 0 ? (
          <Box
            p={6}
            bg="bg.subtle"
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.subtle"
            textAlign="center"
          >
            <Text color="text.muted" fontSize="sm">
              No tasks in backlog
            </Text>
          </Box>
        ) : viewMode === 'card' ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {backlogTasks.map(renderTaskCard)}
          </SimpleGrid>
        ) : (
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader w="6"></Table.ColumnHeader>
                <Table.ColumnHeader w="30%">Title</Table.ColumnHeader>
                <Table.ColumnHeader w="15%">Complexity</Table.ColumnHeader>
                <Table.ColumnHeader w="20%">Projects</Table.ColumnHeader>
                <Table.ColumnHeader w="20%">Tags</Table.ColumnHeader>
                <Table.ColumnHeader w="15%">Updated</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {backlogTasks.map((task) => {
                const taskSelected = isSelected(task.id);
                const complexityLabel = getComplexityLabel(task.complexity);
                const priorityIcon = getPriorityIcon(task.priority);
                const hoverColors = getPriorityHoverColors(task.priority);
                return (
                  <Table.Row
                    key={task.id}
                    cursor="pointer"
                    onClick={() => handleViewTask(task)}
                    _hover={{ bg: hoverColors.bg, borderColor: hoverColors.borderColor }}
                    data-selected={taskSelected ? "" : undefined}
                  >
                    <Table.Cell>
                      <Checkbox.Root
                        size="sm"
                        checked={taskSelected}
                        colorPalette="blue"
                        onCheckedChange={() => {
                          handleTaskToggle(task);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        cursor="pointer"
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control cursor="pointer">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Root>
                    </Table.Cell>
                    <Table.Cell>
                      <HStack gap={2}>
                        <Text fontWeight="medium">{task.title}</Text>
                        {priorityIcon && (
                          <Icon color={priorityIcon.color}>
                            <priorityIcon.icon />
                          </Icon>
                        )}
                      </HStack>
                    </Table.Cell>
                    <Table.Cell>
                      {complexityLabel ? (
                        <Badge size="sm" variant="outline" colorPalette="gray">
                          {complexityLabel}
                        </Badge>
                      ) : (
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {task.projectIds.length > 0 ? (
                        <HStack gap={1} flexWrap="wrap">
                          {task.projectIds.map(projectId => {
                            const project = projects.find(p => p.id === projectId);
                            return project ? (
                              <Badge key={projectId} size="xs" variant="outline" colorPalette="gray">
                                <HStack gap={1}>
                                  <LuFolder size={10} />
                                  <Text>{project.title}</Text>
                                </HStack>
                              </Badge>
                            ) : null;
                          })}
                        </HStack>
                      ) : (
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {task.tags && task.tags.length > 0 ? (
                        <HStack gap={1} flexWrap="wrap">
                          {task.tags.map((tag) => (
                            <Tag.Root key={tag} size="sm" variant="subtle">
                              <Tag.Label>{tag}</Tag.Label>
                            </Tag.Root>
                          ))}
                        </HStack>
                      ) : (
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" color="text.secondary">
                        {formatDate(task.updatedAt)}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </Box>
    </Box>
  );
});

TasksTabContent.displayName = 'TasksTabContent';

export default TasksTabContent;
