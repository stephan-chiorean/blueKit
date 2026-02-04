import { useMemo, useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  HStack,
  VStack,
  Badge,
  Button,
  Icon,
  Spinner,
  Heading,
  Menu,
} from '@chakra-ui/react';
import { LuPlus, LuFilter } from 'react-icons/lu';
import { Task, TaskPriority, TaskType } from '@/types/task';
import { Project, invokeDbGetTasks, invokeDbGetProjectTasks, invokeDbUpdateTask } from '@/ipc';
import TasksSelectionFooter from '@/features/tasks/components/TasksSelectionFooter';
import { ToolkitHeader } from '@/shared/components/ToolkitHeader';
import EditTaskDialog from '@/features/tasks/components/EditTaskDialog';
import CreateTaskDialog from '@/features/tasks/components/CreateTaskDialog';
import DragTooltip from '@/features/tasks/components/DragTooltip';
import { toaster } from '@/shared/components/ui/toaster';
import { FilterPanel } from '@/shared/components/FilterPanel';
import { ElegantList } from '@/shared/components/ElegantList';

interface TasksSectionProps {
  context: 'workspace' | Project;  // workspace view or specific project
  projects: Project[];  // All projects for multi-select
}

export interface TasksSectionRef {
  openCreateDialog: () => void;
}

type SortOption = 'priority' | 'time';

// Drag state for task movement between sections
interface DragState {
  draggedTask: Task;
  sourceSection: 'in_progress' | 'backlog';
  dropTargetSection: 'in_progress' | 'backlog' | null;
  isValidDrop: boolean;
  startPosition: { x: number; y: number };
}

// Constants for drag behavior
const DRAG_THRESHOLD = 5; // pixels before drag activates

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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hasDragThresholdMet, setHasDragThresholdMet] = useState(false);

  // Sort state
  const [sortBy] = useState<SortOption>('time');

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [titleFilter, setTitleFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
  const [selectedComplexities] = useState<string[]>([]);
  const [selectedTypes] = useState<TaskType[]>([]);

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

  // Ref for filter button
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Load tasks on mount and when context changes
  useEffect(() => {
    loadTasks();
  }, [context]);

  // Document-level drag event handlers
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });

      if (!hasDragThresholdMet) {
        const dx = Math.abs(e.clientX - dragState.startPosition.x);
        const dy = Math.abs(e.clientY - dragState.startPosition.y);

        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          setHasDragThresholdMet(true);
        }
        return;
      }

      const target = findDropTargetAtPosition(e.clientX, e.clientY);
      const isValid = isValidDrop(dragState.sourceSection, target);

      setDragState(prev => prev ? {
        ...prev,
        dropTargetSection: target,
        isValidDrop: isValid
      } : null);
    };

    const handleMouseUp = async () => {
      if (hasDragThresholdMet && dragState.isValidDrop && dragState.dropTargetSection) {
        await performStatusUpdate(dragState.draggedTask, dragState.dropTargetSection);
      }
      clearDragState();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearDragState();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState, hasDragThresholdMet]);

  // Get selected tasks
  const selectedTasks = useMemo(() => {
    return tasks.filter(task => selectedTaskIds.has(task.id));
  }, [tasks, selectedTaskIds]);


  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    setSelectedTaskIds(newSelectedIds);
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

  // Drag handlers
  const handleDragStart = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();

    setDragState({
      draggedTask: task,
      sourceSection: task.status === 'in_progress' ? 'in_progress' : 'backlog',
      dropTargetSection: null,
      isValidDrop: false,
      startPosition: { x: e.clientX, y: e.clientY },
    });
    setHasDragThresholdMet(false);
  };

  const clearDragState = () => {
    setDragState(null);
    setHasDragThresholdMet(false);
    setMousePosition({ x: 0, y: 0 });
  };

  const findDropTargetAtPosition = (x: number, y: number): 'in_progress' | 'backlog' | null => {
    const elements = document.elementsFromPoint(x, y);

    for (const el of elements) {
      const dropZone = (el as HTMLElement).closest('[data-drop-zone]');
      if (dropZone) {
        const zone = dropZone.getAttribute('data-drop-zone');
        if (zone === 'in_progress' || zone === 'backlog') {
          return zone;
        }
      }
    }

    return null;
  };

  const isValidDrop = (sourceSection: string, targetSection: string | null): boolean => {
    if (!targetSection) return false;
    return sourceSection !== targetSection;
  };

  const performStatusUpdate = async (task: Task, newStatus: 'in_progress' | 'backlog') => {
    try {
      await invokeDbUpdateTask(
        task.id,
        task.title,
        task.description,
        task.priority,
        task.tags,
        task.projectIds,
        newStatus,
        task.complexity,
        task.type
      );

      toaster.create({
        type: 'success',
        title: 'Task moved',
        description: `Moved to ${newStatus === 'in_progress' ? 'In Progress' : 'Backlog'}`,
      });

      await loadTasks();
    } catch (error) {
      toaster.create({
        type: 'error',
        title: 'Failed to move task',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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


  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(task => {
      task.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

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

  if (loading) {
    return (
      <Box
        textAlign="center"
        py={12}
        h="100%"
      >
        <Spinner size="lg" />
      </Box>
    );
  }

  if (tasks.length === 0) {
    return (
      <Box
        h="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
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
      </Box>
    );
  }



  const parentName = context === 'workspace' ? 'Workspace' : context.name;

  const hasActiveFilters = titleFilter || selectedTags.length > 0 || selectedPriorities.length > 0 || selectedComplexities.length > 0 || selectedTypes.length > 0;
  const filterCount = [titleFilter && 1, selectedTags.length, selectedPriorities.length, selectedComplexities.length, selectedTypes.length]
    .filter(Boolean)
    .reduce((a, b) => (a || 0) + (b || 0), 0);

  return (
    <Flex
      direction="column"
      h="100%"
      overflow="hidden"
      position="relative"
    >
      {/* Dialogs */}
      <EditTaskDialog
        task={selectedTask}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={loadTasks}
      />

      <CreateTaskDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onTaskCreated={loadTasks}
        defaultProjectId={context !== 'workspace' ? (context as Project).id : undefined}
        projects={projects}
      />

      {/* Drag Tooltip */}
      {dragState && hasDragThresholdMet && (
        <DragTooltip
          task={dragState.draggedTask}
          targetSection={dragState.dropTargetSection}
          position={mousePosition}
          isValidDrop={dragState.isValidDrop}
        />
      )}

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
        <Box
          mb={8}
          position="relative"
          data-drop-zone="in_progress"
          borderWidth={
            dragState?.dropTargetSection === 'in_progress' && hasDragThresholdMet
              ? "2px"
              : "0"
          }
          borderStyle="dashed"
          borderColor={
            dragState?.dropTargetSection === 'in_progress' && hasDragThresholdMet
              ? (dragState.isValidDrop ? "blue.400" : "red.400")
              : "transparent"
          }
          bg={
            dragState?.dropTargetSection === 'in_progress' && hasDragThresholdMet
              ? (dragState.isValidDrop ? "blue.50" : "red.50")
              : "transparent"
          }
          transition="all 0.15s"
          _dark={{
            bg: dragState?.dropTargetSection === 'in_progress' && hasDragThresholdMet
              ? (dragState.isValidDrop ? "blue.900/20" : "red.900/20")
              : "transparent"
          }}
          p={dragState?.dropTargetSection === 'in_progress' && hasDragThresholdMet ? 4 : 0}
        >
          <Flex align="center" gap={2} mb={4}>
            <Heading size="md">In Progress</Heading>
            <Text fontSize="sm" color="text.muted">
              {inProgressTasks.length}
            </Text>
            {/* Filter Button */}
            <Box position="relative" overflow="visible">
              <Button
                ref={filterButtonRef}
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
                  {hasActiveFilters && (
                    <Badge size="sm" colorPalette="primary" variant="solid">
                      {filterCount}
                    </Badge>
                  )}
                </HStack>
              </Button>
              <FilterPanel
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                nameFilter={titleFilter}
                onNameFilterChange={setTitleFilter}
                allTags={allTags}
                selectedTags={selectedTags}
                onToggleTag={toggleTag}
                filterButtonRef={filterButtonRef}
                statusOptions={[
                  { value: 'pinned', label: 'Pinned', colorPalette: 'blue' },
                  { value: 'high', label: 'High', colorPalette: 'red' },
                  { value: 'standard', label: 'Standard', colorPalette: 'orange' },
                  { value: 'long term', label: 'Long Term', colorPalette: 'purple' },
                  { value: 'nit', label: 'Nit', colorPalette: 'yellow' },
                ]}
                selectedStatuses={selectedPriorities}
                onToggleStatus={(priority) => togglePriority(priority as TaskPriority)}
              />
            </Box>
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
          ) : (
            <ElegantList
              items={inProgressTasks}
              type="task"
              selectable={true}
              selectedIds={selectedTaskIds}
              onSelectionChange={handleSelectionChange}
              getItemId={(item) => (item as Task).id}
              onItemClick={(task) => handleViewTask(task as Task)}
              onItemMouseDown={(task, e) => {
                e.stopPropagation();
                handleDragStart(task as Task, e as any);
              }}
              getItemStyle={(task) => ({
                opacity: dragState?.draggedTask.id === (task as Task).id && hasDragThresholdMet ? 0.5 : 1,
                cursor: dragState ? 'grabbing' : 'grab',
                transition: 'opacity 0.15s'
              })}
              renderActions={(item) => (
                <Menu.Item value="edit" onClick={() => handleViewTask(item as Task)}>
                  <Text>Edit</Text>
                </Menu.Item>
              )}
            />
          )}
        </Box>

        {/* Backlog Section */}
        <Box
          data-drop-zone="backlog"
          borderWidth={
            dragState?.dropTargetSection === 'backlog' && hasDragThresholdMet
              ? "2px"
              : "0"
          }
          borderStyle="dashed"
          borderColor={
            dragState?.dropTargetSection === 'backlog' && hasDragThresholdMet
              ? (dragState.isValidDrop ? "blue.400" : "red.400")
              : "transparent"
          }
          bg={
            dragState?.dropTargetSection === 'backlog' && hasDragThresholdMet
              ? (dragState.isValidDrop ? "blue.50" : "red.50")
              : "transparent"
          }
          transition="all 0.15s"
          _dark={{
            bg: dragState?.dropTargetSection === 'backlog' && hasDragThresholdMet
              ? (dragState.isValidDrop ? "blue.900/20" : "red.900/20")
              : "transparent"
          }}
          p={dragState?.dropTargetSection === 'backlog' && hasDragThresholdMet ? 4 : 0}
        >
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
          ) : (
            <ElegantList
              items={backlogTasks}
              type="task"
              selectable={true}
              selectedIds={selectedTaskIds}
              onSelectionChange={handleSelectionChange}
              getItemId={(item) => (item as Task).id}
              onItemClick={(task) => handleViewTask(task as Task)}
              onItemMouseDown={(task, e) => {
                e.stopPropagation();
                handleDragStart(task as Task, e as any);
              }}
              getItemStyle={(task) => ({
                opacity: dragState?.draggedTask.id === (task as Task).id && hasDragThresholdMet ? 0.5 : 1,
                cursor: dragState ? 'grabbing' : 'grab',
                transition: 'opacity 0.15s'
              })}
              renderActions={(item) => (
                <Menu.Item value="edit" onClick={() => handleViewTask(item as Task)}>
                  <Text>Edit</Text>
                </Menu.Item>
              )}
            />
          )}
        </Box>
      </Box>

      {/* Selection Footer */}
      <TasksSelectionFooter
        isOpen={selectedTaskIds.size > 0}
        selectedTasks={selectedTasks}
        onClearSelection={clearSelection}
        onTasksUpdated={loadTasks}
      />
    </Flex>
  );
});

TasksSection.displayName = 'TasksSection';

export default TasksSection;
