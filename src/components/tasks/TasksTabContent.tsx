import { useMemo, useState, useEffect } from 'react';
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
  NativeSelect,
  Spinner,
} from '@chakra-ui/react';
import { LuPlus, LuArrowUpDown, LuFolder, LuPin } from 'react-icons/lu';
import { Task } from '../../types/task';
import { ProjectEntry, invokeDbGetTasks, invokeDbGetProjectTasks } from '../../ipc';
import TasksActionBar from './TasksActionBar';
import TaskDialog from './TaskDialog';
import TaskCreateDialog from './TaskCreateDialog';
import { toaster } from '../ui/toaster';

interface TasksTabContentProps {
  context: 'workspace' | ProjectEntry;  // workspace view or specific project
  projects: ProjectEntry[];  // All projects for multi-select
}

type SortOption = 'priority' | 'time';

export default function TasksTabContent({
  context,
  projects,
}: TasksTabContentProps) {
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
  const [sortBy, setSortBy] = useState<SortOption>('priority');

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

  // Get priority color
  const getPriorityColor = (priority: string) => {
    if (priority === 'nit') return 'gray';
    switch (priority.toLowerCase()) {
      case 'pinned':
        return 'purple';
      case 'high':
        return 'orange';
      case 'standard':
        return 'green';
      case 'long term':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Sort tasks based on selected sort option, filtering out completed tasks
  const sortedTasks = useMemo(() => {
    // Filter out completed tasks first
    const visibleTasks = tasks.filter(task => task.status !== 'completed');
    const tasksCopy = [...visibleTasks];

    if (sortBy === 'priority') {
      // Sort by priority order: pinned -> high -> long term -> standard
      return tasksCopy.sort((a, b) => {
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
    } else if (sortBy === 'time') {
      // Sort by updatedAt (most recent first)
      return tasksCopy.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
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

  // Helper function to render task card (used in both In Progress and Backlog sections)
  const renderTaskCard = (task: Task) => {
    const taskSelected = isSelected(task.id);
    const priorityColor = getPriorityColor(task.priority);

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
        _hover={{ borderColor: "primary.400", bg: "primary.50" }}
      >
        <CardHeader>
          <VStack align="stretch" gap={2}>
            <Flex justify="space-between" align="start" gap={2}>
              <HStack gap={1.5} flex="1">
                <Heading size="sm">{task.title}</Heading>
                {task.priority === 'pinned' && (
                  <Icon color="purple.500">
                    <LuPin />
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
              {/* Only show priority badge if not nit */}
              {task.priority !== 'nit' && (
                <Badge colorPalette={priorityColor} size="sm">
                  {task.priority}
                </Badge>
              )}
            </HStack>

            {/* Project badges */}
            {task.projectIds.length > 0 && (
              <HStack gap={1} flexWrap="wrap">
                {task.projectIds.map(projectId => {
                  const project = projects.find(p => p.id === projectId);
                  return project ? (
                    <Badge key={projectId} size="xs" colorPalette="blue" variant="outline">
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
          {/* Description */}
          {task.description && (
            <Text fontSize="sm" color="text.secondary" lineClamp={2}>
              {task.description}
            </Text>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <HStack gap={1} flexWrap="wrap" mt="auto">
              {task.tags.map((tag) => (
                <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
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
      <TaskDialog
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

      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" gap={1}>
          <Heading size="lg">Tasks</Heading>
          <Text fontSize="sm" color="text.muted">
            {inProgressTasks.length} in progress · {backlogTasks.length} in backlog
          </Text>
        </VStack>
        <HStack gap={2}>
          {/* Sort Select */}
          <NativeSelect.Root size="sm" width="140px">
            <NativeSelect.Field
              value={sortBy}
              onChange={(e) => setSortBy(e.currentTarget.value as SortOption)}
            >
              <option value="priority">Priority</option>
              <option value="time">Time</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator>
              <Icon>
                <LuArrowUpDown />
              </Icon>
            </NativeSelect.Indicator>
          </NativeSelect.Root>
          
          <Button
            colorPalette="primary"
            onClick={handleAddTask}
          >
            <HStack gap={2}>
              <Icon>
                <LuPlus />
              </Icon>
              <Text>Add Task</Text>
            </HStack>
          </Button>
        </HStack>
      </Flex>

      {/* In Progress Section */}
      <Box mb={8}>
        <Heading size="md" mb={4}>In Progress</Heading>

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
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {inProgressTasks.map(renderTaskCard)}
          </SimpleGrid>
        )}
      </Box>

      {/* Backlog Section */}
      <Box>
        <Heading size="md" mb={4}>Backlog</Heading>

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
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {backlogTasks.map(renderTaskCard)}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
}
