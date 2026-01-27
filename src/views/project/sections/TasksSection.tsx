import { useMemo, useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
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
  Input,
  InputGroup,
  Field,
  IconButton,
} from '@chakra-ui/react';
import { LuPlus, LuFolder, LuLayoutGrid, LuTable, LuFilter, LuX } from 'react-icons/lu';
import { LiquidViewModeSwitcher } from '@/features/kits/components/LiquidViewModeSwitcher';
import { Task, TaskPriority, TaskType } from '@/types/task';
import { Project, invokeDbGetTasks, invokeDbGetProjectTasks } from '@/ipc';
import TasksActionBar from '@/features/tasks/components/TasksActionBar';
import { ToolkitHeader } from '@/shared/components/ToolkitHeader';
import EditTaskDialog from '@/features/tasks/components/EditTaskDialog';
import { useQuickTaskPopover } from '@/shared/contexts/QuickTaskPopoverContext';
import { toaster } from '@/shared/components/ui/toaster';
import { getPriorityLabel, getPriorityIcon, getPriorityHoverColors, getPriorityColorPalette, getTypeIcon, getTypeColorPalette, getTypeLabel } from '@/shared/utils/taskUtils';

interface TasksSectionProps {
  context: 'workspace' | Project;  // workspace view or specific project
  projects: Project[];  // All projects for multi-select
}

export interface TasksSectionRef {
  openCreateDialog: () => void;
}

type SortOption = 'priority' | 'time';
type ViewMode = 'card' | 'table';

const TasksSection = forwardRef<TasksSectionRef, TasksSectionProps>(({
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
  const { openPopover } = useQuickTaskPopover();

  // Sort state
  const [sortBy] = useState<SortOption>('time');

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [titleFilter, setTitleFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
  const [selectedComplexities, setSelectedComplexities] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<TaskType[]>([]);

  // Load tasks from database
  const loadTasks = async () => {
    try {
      setLoading(true);
      const loadedTasks: Task[] = context === 'workspace'
        ? await invokeDbGetTasks()
        : await invokeDbGetProjectTasks((context as Project).id);
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

  // Ref for filter panel to detect outside clicks
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Load tasks on mount and when context changes
  useEffect(() => {
    loadTasks();
  }, [context]);

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
    openPopover({
      defaultView: 'create',
      defaultProjectId: context !== 'workspace' ? (context as Project).id : undefined,
      onTaskCreated: handleTaskCreated,
    });
  };

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => {
      openPopover({
        defaultView: 'create',
        defaultProjectId: context !== 'workspace' ? (context as Project).id : undefined,
        onTaskCreated: handleTaskCreated,
      });
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


  // Get all unique tags, priorities, and complexities from tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(task => {
      task.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const allPriorities: TaskPriority[] = ['pinned', 'high', 'standard', 'long term', 'nit'];
  const allComplexities = ['easy', 'hard', 'deep dive'];
  const allTypes: TaskType[] = ['bug', 'investigation', 'feature', 'cleanup', 'optimization', 'chore'];

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

  // Apply filters to sorted tasks
  const filteredTasks = useMemo(() => {
    return sortedTasks.filter(task => {
      // Title filter
      const matchesTitle = !titleFilter ||
        task.title.toLowerCase().includes(titleFilter.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(titleFilter.toLowerCase()));

      // Tags filter
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(selectedTag =>
          task.tags?.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
        );

      // Priority filter
      const matchesPriority = selectedPriorities.length === 0 ||
        selectedPriorities.includes(task.priority);

      // Complexity filter
      const matchesComplexity = selectedComplexities.length === 0 ||
        (task.complexity && selectedComplexities.includes(task.complexity));

      // Type filter
      const matchesType = selectedTypes.length === 0 ||
        (task.type && selectedTypes.includes(task.type));

      return matchesTitle && matchesTags && matchesPriority && matchesComplexity && matchesType;
    });
  }, [sortedTasks, titleFilter, selectedTags, selectedPriorities, selectedComplexities, selectedTypes]);

  // Split filtered tasks into In Progress and Backlog sections
  const inProgressTasks = useMemo(() => {
    return filteredTasks.filter(task => task.status === 'in_progress');
  }, [filteredTasks]);

  const backlogTasks = useMemo(() => {
    return filteredTasks.filter(task => task.status !== 'in_progress');
  }, [filteredTasks]);

  // Filter toggle functions
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const togglePriority = (priority: TaskPriority) => {
    setSelectedPriorities(prev => {
      if (prev.includes(priority)) {
        return prev.filter(p => p !== priority);
      } else {
        return [...prev, priority];
      }
    });
  };

  const toggleComplexity = (complexity: string) => {
    setSelectedComplexities(prev => {
      if (prev.includes(complexity)) {
        return prev.filter(c => c !== complexity);
      } else {
        return [...prev, complexity];
      }
    });
  };

  const toggleType = (type: TaskType) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

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
        <Button
          colorPalette="primary"
          variant="solid"
          size="sm"
          borderRadius="lg"
          onClick={handleAddTask}
        >
          <HStack gap={2}>
            <Icon>
              <LuPlus />
            </Icon>
            <Text>Add Task</Text>
          </HStack>
        </Button>
        <Text color="text.secondary" fontSize="lg">
          No tasks yet
        </Text>
        <Text color="text.tertiary" fontSize="sm">
          Click "Add Task" to create your first task
        </Text>
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
    const typeLabel = getTypeLabel(task.type);
    const typeIcon = task.type ? getTypeIcon(task.type) : null;
    const priorityIcon = getPriorityIcon(task.priority);
    const hoverColors = getPriorityHoverColors(task.priority);

    return (
      <Card.Root
        key={task.id}
        variant="subtle"
        borderRadius="16px"
        borderWidth={taskSelected ? "2px" : "1px"}
        position="relative"
        cursor="pointer"
        onClick={() => handleViewTask(task)}
        transition="all 0.2s ease-in-out"
        css={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          borderColor: taskSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          _dark: {
            background: 'rgba(0, 0, 0, 0.2)',
            borderColor: taskSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          },
          _hover: {
            transform: 'scale(1.02)',
            borderColor: hoverColors.borderColor,
          },
        }}
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
              {/* Show type if available */}
              {typeLabel && typeIcon && (
                <Badge size="sm" variant="outline" colorPalette={getTypeColorPalette(task.type!)}>
                  <HStack gap={1}>
                    <Icon color={typeIcon.color} boxSize={3}>
                      <typeIcon.icon />
                    </Icon>
                    <Text>{typeLabel}</Text>
                  </HStack>
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
                        <Text>{project.name}</Text>
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

  const parentName = context === 'workspace' ? 'Workspace' : context.name;

  return (
    <Flex direction="column" h="100%" overflow="hidden" position="relative">
      <EditTaskDialog
        task={selectedTask}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={loadTasks}
      />

      <TasksActionBar
        selectedTasks={selectedTasks}
        hasSelection={selectedTaskIds.size > 0}
        clearSelection={clearSelection}
        onTasksUpdated={loadTasks}
      />

      {/* Toolkit Header */}
      <ToolkitHeader
        title="Tasks"
        parentName={parentName}
        action={{
          label: "Add Task",
          onClick: handleAddTask,
          variant: "icon",
          icon: LuPlus,
        }}
      />

      {/* Scrollable Content */}
      <Box flex={1} overflowY="auto" p={6}>
        {/* In Progress Section */}
        <Box mb={8} position="relative">
          <Flex align="center" justify="space-between" gap={2} mb={4}>
            <Flex align="center" gap={2}>
              <Heading size="md">In Progress</Heading>
              <Text fontSize="sm" color="text.muted">
                {inProgressTasks.length}
              </Text>
              {/* Filter Button - with liquid glass styling */}
              <Box position="relative" overflow="visible">
                <Button
                  ref={filterButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  borderRadius="lg"
                  borderWidth="1px"
                  css={{
                    background: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    borderColor: 'rgba(0, 0, 0, 0.08)',
                    boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                    _dark: {
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                    },
                    _hover: {
                      background: 'rgba(255, 255, 255, 0.35)',
                      _dark: {
                        background: 'rgba(0, 0, 0, 0.3)',
                      },
                    },
                  }}
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuFilter />
                    </Icon>
                    <Text>Filter</Text>
                    {(titleFilter || selectedTags.length > 0 || selectedPriorities.length > 0 || selectedComplexities.length > 0 || selectedTypes.length > 0) && (
                      <Badge size="sm" colorPalette="primary" variant="solid">
                        {[titleFilter && 1, selectedTags.length, selectedPriorities.length, selectedComplexities.length, selectedTypes.length]
                          .filter(Boolean)
                          .reduce((a, b) => (a || 0) + (b || 0), 0)}
                      </Badge>
                    )}
                  </HStack>
                </Button>
                {/* Filter Overlay */}
                {isFilterOpen && (
                  <Box
                    ref={filterPanelRef}
                    position="absolute"
                    top="100%"
                    left={0}
                    zIndex={10}
                    w="400px"
                    mt={2}
                    borderWidth="1px"
                    borderColor="border.subtle"
                    borderRadius="md"
                    p={4}
                    bg="bg.surface"
                    boxShadow="lg"
                  >
                    <VStack align="stretch" gap={4}>
                      <Field.Root>
                        <Field.Label>Title</Field.Label>
                        <InputGroup
                          endElement={titleFilter ? (
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label="Clear title filter"
                              onClick={() => setTitleFilter('')}
                            >
                              <Icon>
                                <LuX />
                              </Icon>
                            </IconButton>
                          ) : undefined}
                        >
                          <Input
                            placeholder="Search by title or description..."
                            value={titleFilter}
                            onChange={(e) => setTitleFilter(e.target.value)}
                          />
                        </InputGroup>
                      </Field.Root>

                      {allTags.length > 0 && (
                        <Field.Root>
                          <Field.Label>Tags</Field.Label>
                          <HStack gap={1} flexWrap="wrap" mt={2}>
                            {allTags.map((tag) => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <Tag.Root
                                  key={tag}
                                  size="sm"
                                  variant={isSelected ? 'solid' : 'subtle'}
                                  colorPalette={isSelected ? 'primary' : undefined}
                                  cursor="pointer"
                                  onClick={() => toggleTag(tag)}
                                  opacity={isSelected ? 1 : 0.6}
                                  _hover={{ opacity: 1 }}
                                >
                                  <Tag.Label>{tag}</Tag.Label>
                                </Tag.Root>
                              );
                            })}
                          </HStack>
                        </Field.Root>
                      )}

                      <Field.Root>
                        <Field.Label>Priority</Field.Label>
                        <HStack gap={1} flexWrap="wrap" mt={2}>
                          {allPriorities.map((priority) => {
                            const isSelected = selectedPriorities.includes(priority);
                            const priorityIcon = getPriorityIcon(priority);
                            return (
                              <Tag.Root
                                key={priority}
                                size="sm"
                                variant={isSelected ? 'solid' : 'subtle'}
                                colorPalette={isSelected ? getPriorityColorPalette(priority) : undefined}
                                cursor="pointer"
                                onClick={() => togglePriority(priority)}
                                opacity={isSelected ? 1 : 0.6}
                                _hover={{ opacity: 1 }}
                              >
                                <HStack gap={1}>
                                  {priorityIcon && (
                                    <Icon color={priorityIcon.color} boxSize={3}>
                                      <priorityIcon.icon />
                                    </Icon>
                                  )}
                                  <Tag.Label>{getPriorityLabel(priority)}</Tag.Label>
                                </HStack>
                              </Tag.Root>
                            );
                          })}
                        </HStack>
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Complexity</Field.Label>
                        <HStack gap={1} flexWrap="wrap" mt={2}>
                          {allComplexities.map((complexity) => {
                            const isSelected = selectedComplexities.includes(complexity);
                            return (
                              <Tag.Root
                                key={complexity}
                                size="sm"
                                variant={isSelected ? 'solid' : 'subtle'}
                                colorPalette={isSelected ? 'primary' : undefined}
                                cursor="pointer"
                                onClick={() => toggleComplexity(complexity)}
                                opacity={isSelected ? 1 : 0.6}
                                _hover={{ opacity: 1 }}
                              >
                                <Tag.Label>{getComplexityLabel(complexity)}</Tag.Label>
                              </Tag.Root>
                            );
                          })}
                        </HStack>
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Type</Field.Label>
                        <HStack gap={1} flexWrap="wrap" mt={2}>
                          {allTypes.map((type) => {
                            const isSelected = selectedTypes.includes(type);
                            return (
                              <Tag.Root
                                key={type}
                                size="sm"
                                variant={isSelected ? 'solid' : 'subtle'}
                                colorPalette={isSelected ? 'primary' : undefined}
                                cursor="pointer"
                                onClick={() => toggleType(type)}
                                opacity={isSelected ? 1 : 0.6}
                                _hover={{ opacity: 1 }}
                              >
                                <Tag.Label>{getTypeLabel(type)}</Tag.Label>
                              </Tag.Root>
                            );
                          })}
                        </HStack>
                      </Field.Root>
                    </VStack>
                  </Box>
                )}
              </Box>
            </Flex>
            {/* View Mode Switcher */}
            <LiquidViewModeSwitcher
              value={viewMode}
              onChange={(mode) => setViewMode(mode as ViewMode)}
              modes={[
                { id: 'card', label: 'Cards', icon: LuLayoutGrid },
                { id: 'table', label: 'Table', icon: LuTable },
              ]}
            />
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
                {(titleFilter || selectedTags.length > 0 || selectedPriorities.length > 0 || selectedComplexities.length > 0 || selectedTypes.length > 0)
                  ? 'No tasks in progress match the current filters'
                  : context === 'workspace'
                    ? 'No tasks in progress'
                    : `No tasks in progress for ${(context as Project).name}`
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
                <Table.Row bg="bg.subtle">
                  <Table.ColumnHeader w="6"></Table.ColumnHeader>
                  <Table.ColumnHeader w="25%">Title</Table.ColumnHeader>
                  <Table.ColumnHeader w="12%">Complexity</Table.ColumnHeader>
                  <Table.ColumnHeader w="12%">Type</Table.ColumnHeader>
                  <Table.ColumnHeader w="18%">Projects</Table.ColumnHeader>
                  <Table.ColumnHeader w="18%">Tags</Table.ColumnHeader>
                  <Table.ColumnHeader w="15%">Updated</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {inProgressTasks.map((task) => {
                  const taskSelected = isSelected(task.id);
                  const complexityLabel = getComplexityLabel(task.complexity);
                  const typeLabel = getTypeLabel(task.type);
                  const typeIcon = task.type ? getTypeIcon(task.type) : null;
                  const priorityIcon = getPriorityIcon(task.priority);
                  const hoverColors = getPriorityHoverColors(task.priority);
                  return (
                    <Table.Row
                      key={task.id}
                      cursor="pointer"
                      onClick={() => handleViewTask(task)}
                      bg="bg.surface"
                      _hover={{ borderColor: hoverColors.borderColor }}
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
                        {typeLabel && typeIcon ? (
                          <Badge size="sm" variant="outline" colorPalette={getTypeColorPalette(task.type!)}>
                            <HStack gap={1}>
                              <Icon color={typeIcon.color} boxSize={3}>
                                <typeIcon.icon />
                              </Icon>
                              <Text>{typeLabel}</Text>
                            </HStack>
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
                                    <Text>{project.name}</Text>
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
                {(titleFilter || selectedTags.length > 0 || selectedPriorities.length > 0 || selectedComplexities.length > 0 || selectedTypes.length > 0)
                  ? 'No tasks in backlog match the current filters'
                  : 'No tasks in backlog'
                }
              </Text>
            </Box>
          ) : viewMode === 'card' ? (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {backlogTasks.map(renderTaskCard)}
            </SimpleGrid>
          ) : (
            <Table.Root size="sm" variant="outline">
              <Table.Header>
                <Table.Row bg="bg.subtle">
                  <Table.ColumnHeader w="6"></Table.ColumnHeader>
                  <Table.ColumnHeader w="25%">Title</Table.ColumnHeader>
                  <Table.ColumnHeader w="12%">Complexity</Table.ColumnHeader>
                  <Table.ColumnHeader w="12%">Type</Table.ColumnHeader>
                  <Table.ColumnHeader w="18%">Projects</Table.ColumnHeader>
                  <Table.ColumnHeader w="18%">Tags</Table.ColumnHeader>
                  <Table.ColumnHeader w="15%">Updated</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {backlogTasks.map((task) => {
                  const taskSelected = isSelected(task.id);
                  const complexityLabel = getComplexityLabel(task.complexity);
                  const typeLabel = getTypeLabel(task.type);
                  const typeIcon = task.type ? getTypeIcon(task.type) : null;
                  const priorityIcon = getPriorityIcon(task.priority);
                  const hoverColors = getPriorityHoverColors(task.priority);
                  return (
                    <Table.Row
                      key={task.id}
                      cursor="pointer"
                      onClick={() => handleViewTask(task)}
                      bg="bg.surface"
                      _hover={{ borderColor: hoverColors.borderColor }}
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
                        {typeLabel && typeIcon ? (
                          <Badge size="sm" variant="outline" colorPalette={getTypeColorPalette(task.type!)}>
                            <HStack gap={1}>
                              <Icon color={typeIcon.color} boxSize={3}>
                                <typeIcon.icon />
                              </Icon>
                              <Text>{typeLabel}</Text>
                            </HStack>
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
                                    <Text>{project.name}</Text>
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
    </Flex>
  );
});

TasksSection.displayName = 'TasksSection';

export default TasksSection;
