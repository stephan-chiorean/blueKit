import { useMemo, useState } from 'react';
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
} from '@chakra-ui/react';
import { LuPlus, LuArrowUpDown } from 'react-icons/lu';
import { Task } from '../../types/task';
import TasksActionBar from './TasksActionBar';
import TaskDialog from './TaskDialog';

interface TasksTabContentProps {
  kits: any[]; // Not used anymore, kept for compatibility
  kitsLoading: boolean; // Not used anymore, kept for compatibility
  error: string | null; // Not used anymore, kept for compatibility
  projectsCount: number;
  onViewTask: (task: any) => void; // Not used anymore, kept for compatibility
}

// Mock task data
const MOCK_TASKS: Task[] = [
  {
    id: '1',
    name: 'Implement user authentication',
    description: 'Add login and registration functionality with JWT tokens',
    priority: 'high',
    status: 'in_progress',
    complexity: 7,
    tags: ['backend', 'security', 'auth'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    acceptanceCriteria: `- User can register with email and password
- User can login with credentials
- JWT tokens are generated and validated
- Password is hashed using bcrypt
- Session management is implemented
- Error handling for invalid credentials`,
  },
  {
    id: '2',
    name: 'Design landing page',
    description: 'Create a modern and responsive landing page design',
    priority: 'standard',
    status: 'pending',
    complexity: 4,
    tags: ['frontend', 'design', 'ui'],
    createdAt: '2024-01-18T09:00:00Z',
    updatedAt: '2024-01-18T09:00:00Z',
    acceptanceCriteria: `- Responsive design for mobile, tablet, and desktop
- Hero section with clear call-to-action
- Feature highlights section
- Testimonials section
- Footer with links and contact info
- Smooth animations and transitions`,
  },
  {
    id: '3',
    name: 'Set up CI/CD pipeline',
    description: 'Configure automated testing and deployment',
    priority: 'pinned',
    status: 'pending',
    complexity: 8,
    tags: ['devops', 'ci-cd', 'automation'],
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-22T16:00:00Z',
    acceptanceCriteria: `- Automated tests run on every push
- Build process is automated
- Deployment to staging environment
- Deployment to production with approval
- Rollback capability
- Build notifications in Slack`,
  },
  {
    id: '4',
    name: 'Optimize database queries',
    description: 'Improve query performance and add proper indexing',
    priority: 'high',
    status: 'in_progress',
    complexity: 6,
    tags: ['backend', 'database', 'performance'],
    createdAt: '2024-01-12T11:00:00Z',
    updatedAt: '2024-01-21T10:15:00Z',
    acceptanceCriteria: `- All slow queries identified and optimized
- Proper indexes added to frequently queried columns
- Query execution time reduced by 50%
- Database connection pooling configured
- Query monitoring and logging in place`,
  },
  {
    id: '5',
    name: 'Add dark mode support',
    description: 'Implement theme switching between light and dark modes',
    priority: 'long term',
    status: 'completed',
    complexity: 3,
    tags: ['frontend', 'ui', 'theme'],
    createdAt: '2024-01-20T13:00:00Z',
    updatedAt: '2024-01-25T15:30:00Z',
    acceptanceCriteria: `- Theme toggle button in header
- All components support dark mode
- Theme preference saved to localStorage
- Smooth transition between themes
- System preference detection`,
  },
  {
    id: '6',
    name: 'Refactor API endpoints',
    description: 'Clean up and organize API endpoint structure',
    priority: 'standard',
    status: 'pending',
    complexity: 5,
    tags: ['backend', 'refactoring'],
    createdAt: '2024-01-19T10:00:00Z',
    updatedAt: '2024-01-19T10:00:00Z',
    acceptanceCriteria: `- All endpoints follow RESTful conventions
- Consistent error handling
- Proper status codes
- API documentation updated`,
  },
];

type SortOption = 'priority' | 'time';

export default function TasksTabContent({
  kits: _kits,
  kitsLoading: _kitsLoading,
  error: _error,
  projectsCount,
  onViewTask: _onViewTask,
}: TasksTabContentProps) {
  // Local state for tasks (using mock data)
  const [tasks] = useState<Task[]>(MOCK_TASKS);
  
  // Local state for selected tasks
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('priority');

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

  const removeTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleAddTask = () => {
    // TODO: Implement add task functionality
    console.log('Add task clicked');
  };

  // Get priority order for sorting (lower number = higher priority)
  const getPriorityOrder = (priority?: string): number => {
    switch (priority) {
      case 'pinned':
        return 0;
      case 'high':
        return 1;
      case 'long term':
        return 2;
      case 'standard':
        return 3;
      default:
        return 4; // Unknown priorities go last
    }
  };

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    if (!priority || priority === 'standard') return 'gray';
    switch (priority.toLowerCase()) {
      case 'pinned':
        return 'purple';
      case 'high':
        return 'orange';
      case 'long term':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Sort tasks based on selected sort option
  const sortedTasks = useMemo(() => {
    const tasksCopy = [...tasks];
    
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

  // Get status color
  const getStatusColor = (status?: string) => {
    if (!status) return 'gray';
    switch (status.toLowerCase()) {
      case 'completed':
        return 'green';
      case 'in_progress':
        return 'blue';
      case 'blocked':
        return 'red';
      case 'pending':
        return 'gray';
      default:
        return 'gray';
    }
  };

  if (projectsCount === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No projects linked. Projects are managed via CLI and will appear here automatically.
      </Box>
    );
  }

  if (tasks.length === 0) {
    return (
      <VStack py={12} gap={3}>
        <Text color="text.secondary" fontSize="lg">
          No tasks yet
        </Text>
        <Text color="text.tertiary" fontSize="sm">
          Click "Add Task" to create your first task
        </Text>
      </VStack>
    );
  }

  return (
    <Box position="relative">
      <TaskDialog
        task={selectedTask}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedTask(null);
        }}
      />

      <TasksActionBar 
        selectedTasks={selectedTasks}
        hasSelection={selectedTaskIds.size > 0}
        clearSelection={clearSelection}
        removeTask={removeTask}
      />

      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" gap={1}>
          <Heading size="lg">Tasks</Heading>
          <Text fontSize="sm" color="text.muted">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
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

      {/* Task Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {sortedTasks.map((task) => {
          const taskSelected = isSelected(task.id);
          const priorityColor = getPriorityColor(task.priority);
          const statusColor = getStatusColor(task.status);

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
                    <Heading size="sm" flex="1">{task.name}</Heading>
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
                    {/* Only show priority badge if not standard */}
                    {task.priority && task.priority !== 'standard' && (
                      <Badge colorPalette={priorityColor} size="sm">
                        {task.priority}
                      </Badge>
                    )}
                    {task.status && (
                      <Badge colorPalette={statusColor} size="sm">
                        {task.status.replace('_', ' ')}
                      </Badge>
                    )}
                    {task.complexity !== undefined && (
                      <Badge colorPalette="gray" size="sm">
                        Complexity: {task.complexity}/10
                      </Badge>
                    )}
                  </HStack>
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
        })}
      </SimpleGrid>
    </Box>
  );
}
