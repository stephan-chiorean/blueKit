import { useState, useEffect, useRef } from 'react';
import {
    Popover,
    Portal,
    Button,
    VStack,
    HStack,
    Text,
    Box,
    Spinner,
    Badge,
    Icon,
    IconButton,
    Input,
    Textarea,
    Flex,
    SegmentGroup,
} from '@chakra-ui/react';
import {
    LuPlus,
    LuListTodo,
    LuArrowLeft,
    LuCheck,
    LuCircle,
    LuLoader,
    LuChevronDown,
    LuChevronUp,
    LuTrash2,
    LuPin,
    LuArrowUp,
    LuMinus,
    LuClock,
    LuSparkles,
} from 'react-icons/lu';
import { Task, TaskPriority, TaskStatus } from '@/types/task';
import {
    Project,
    invokeDbGetTasks,
    invokeGetProjectRegistry,
    invokeDbCreateTask,
    invokeDbUpdateTask,
    invokeDbDeleteTask,
} from '@/ipc';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { toaster } from '@/shared/components/ui/toaster';
import ProjectMultiSelect from './ProjectMultiSelect';

type PopoverView = 'list' | 'create' | 'edit';

interface QuickTaskPopoverProps {
    currentProject?: Project;
    onNavigateToTasks?: () => void;
    // External control props
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultView?: PopoverView;
    defaultProjectId?: string;
    onTaskCreated?: () => void;
    trigger?: React.ReactNode;
}

export default function QuickTaskPopover({
    currentProject,
    onNavigateToTasks,
    open: controlledOpen,
    onOpenChange,
    defaultView = 'list',
    defaultProjectId,
    onTaskCreated,
    trigger,
}: QuickTaskPopoverProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;
    const setIsOpen = (open: boolean) => {
        if (isControlled) {
            onOpenChange?.(open);
        } else {
            setInternalOpen(open);
        }
    };
    const [currentView, setCurrentView] = useState<PopoverView>(defaultView);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Form state for create/edit
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('standard');
    const [status, setStatus] = useState<TaskStatus>('backlog');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);
    const { colorMode } = useColorMode();

    // Glassmorphism styles
    const glassStyle = {
        background: colorMode === 'light'
            ? 'rgba(255, 255, 255, 0.92)'
            : 'rgba(20, 20, 28, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid',
        borderColor: colorMode === 'light'
            ? 'rgba(0, 0, 0, 0.06)'
            : 'rgba(255, 255, 255, 0.06)',
        boxShadow: colorMode === 'light'
            ? '0 8px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.02)'
            : '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02)',
    };

    const taskCardStyle = {
        background: colorMode === 'light'
            ? 'rgba(0, 0, 0, 0.03)'
            : 'rgba(255, 255, 255, 0.04)',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: colorMode === 'light'
            ? 'rgba(0, 0, 0, 0.04)'
            : 'rgba(255, 255, 255, 0.04)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        _hover: {
            background: colorMode === 'light'
                ? 'rgba(0, 0, 0, 0.05)'
                : 'rgba(255, 255, 255, 0.06)',
            borderColor: 'primary.400',
            transform: 'translateY(-1px)',
        },
    };

    const inputStyle = {
        background: colorMode === 'light'
            ? 'rgba(0, 0, 0, 0.03)'
            : 'rgba(255, 255, 255, 0.04)',
        border: '1px solid',
        borderColor: colorMode === 'light'
            ? 'rgba(0, 0, 0, 0.06)'
            : 'rgba(255, 255, 255, 0.06)',
        borderRadius: 'lg',
        _hover: {
            borderColor: colorMode === 'light'
                ? 'rgba(0, 0, 0, 0.1)'
                : 'rgba(255, 255, 255, 0.1)',
        },
        _focus: {
            borderColor: 'primary.400',
            boxShadow: 'none',
            outline: 'none',
        },
    };

    // Load tasks and projects
    const loadData = async () => {
        try {
            setLoading(true);
            const [allTasks, projectRegistry] = await Promise.all([
                invokeDbGetTasks(),
                invokeGetProjectRegistry(),
            ]);
            // Sort by status: in_progress first, then backlog, then rest
            const sortedTasks = allTasks.sort((a, b) => {
                const statusOrder: Record<TaskStatus, number> = {
                    'in_progress': 0,
                    'backlog': 1,
                    'blocked': 2,
                    'completed': 3,
                };
                return statusOrder[a.status] - statusOrder[b.status];
            });
            // Only show non-completed tasks in the quick view
            setTasks(sortedTasks.filter(t => t.status !== 'completed'));
            setProjects(projectRegistry);
        } catch (error) {
            console.error('Failed to load tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadData();
            // Reset to default view when opening
            setCurrentView(defaultView);
            // Reset form with latest defaultProjectId
            setTitle('');
            setDescription('');
            setPriority('standard');
            setStatus('backlog');
            const initialProjectIds = defaultProjectId
                ? [defaultProjectId]
                : currentProject
                ? [currentProject.id]
                : [];
            setSelectedProjectIds(initialProjectIds);
            setShowMoreOptions(false);
            setEditingTask(null);
        }
    }, [isOpen, defaultView, defaultProjectId, currentProject]);

    // Focus title input when entering create/edit view
    useEffect(() => {
        if ((currentView === 'create' || currentView === 'edit') && titleInputRef.current) {
            setTimeout(() => titleInputRef.current?.focus(), 100);
        }
    }, [currentView]);

    // Reset form
    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPriority('standard');
        setStatus('backlog');
        // Prefer defaultProjectId, then currentProject, then empty
        const initialProjectIds = defaultProjectId
            ? [defaultProjectId]
            : currentProject
            ? [currentProject.id]
            : [];
        setSelectedProjectIds(initialProjectIds);
        setShowMoreOptions(false);
        setEditingTask(null);
    };

    // Navigate to create view
    const goToCreate = () => {
        resetForm();
        setCurrentView('create');
    };

    // Navigate to edit view
    const goToEdit = (task: Task) => {
        setEditingTask(task);
        setTitle(task.title);
        setDescription(task.description || '');
        setPriority(task.priority);
        setStatus(task.status);
        setSelectedProjectIds(task.projectIds || []);
        setShowMoreOptions(true);
        setCurrentView('edit');
    };

    // Navigate back to list
    const goToList = () => {
        resetForm();
        setCurrentView('list');
    };

    // Handle create task
    const handleCreate = async (addAnother = false) => {
        if (!title.trim()) return;

        setSubmitting(true);
        try {
            await invokeDbCreateTask(
                title.trim(),
                description.trim() || undefined,
                priority,
                [], // tags
                selectedProjectIds,
                status,
                undefined, // complexity
                undefined, // type
            );

            toaster.create({
                type: 'success',
                title: 'Task created',
                description: title.trim(),
            });

            await loadData();
            
            // Call the callback if provided
            if (onTaskCreated) {
                onTaskCreated();
            }

            if (addAnother) {
                setTitle('');
                setDescription('');
                titleInputRef.current?.focus();
            } else {
                goToList();
            }
        } catch (error) {
            console.error('Failed to create task:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to create task',
                description: String(error),
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Handle update task
    const handleUpdate = async () => {
        if (!editingTask || !title.trim()) return;

        setSubmitting(true);
        try {
            await invokeDbUpdateTask(
                editingTask.id,
                title.trim(),
                description.trim() || undefined,
                priority,
                editingTask.tags,
                selectedProjectIds,
                status,
                editingTask.complexity,
                editingTask.type,
            );

            toaster.create({
                type: 'success',
                title: 'Task updated',
                description: title.trim(),
            });

            await loadData();
            goToList();
        } catch (error) {
            console.error('Failed to update task:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to update task',
                description: String(error),
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Handle delete task
    const handleDelete = async () => {
        if (!editingTask) return;

        setSubmitting(true);
        try {
            await invokeDbDeleteTask(editingTask.id);

            toaster.create({
                type: 'success',
                title: 'Task deleted',
            });

            await loadData();
            goToList();
        } catch (error) {
            console.error('Failed to delete task:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to delete task',
                description: String(error),
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Quick toggle task status
    const toggleTaskStatus = async (task: Task, e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus: TaskStatus = task.status === 'in_progress' ? 'completed' : 'in_progress';

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
                task.type,
            );
            await loadData();

            if (newStatus === 'completed') {
                toaster.create({
                    type: 'success',
                    title: 'Task completed! 🎉',
                    description: task.title,
                });
            }
        } catch (error) {
            console.error('Failed to toggle task status:', error);
        }
    };

    // Get status icon
    const getStatusIcon = (taskStatus: TaskStatus) => {
        switch (taskStatus) {
            case 'in_progress':
                return <LuLoader className="spin-animation" />;
            case 'completed':
                return <LuCheck />;
            default:
                return <LuCircle />;
        }
    };

    // Get status color
    const getStatusColor = (taskStatus: TaskStatus) => {
        switch (taskStatus) {
            case 'in_progress':
                return 'blue.400';
            case 'completed':
                return 'green.400';
            case 'blocked':
                return 'red.400';
            default:
                return 'gray.400';
        }
    };

    const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;

    // Keyboard handlers
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (currentView !== 'list') {
                goToList();
            } else {
                setIsOpen(false);
            }
        } else if (e.key === 'Enter' && e.metaKey && currentView === 'create') {
            handleCreate(false);
        }
    };

    // Priority items for segment group
    const priorityItems = [
        { value: 'pinned', label: <HStack gap={1}><Icon color="blue.500" size="sm"><LuPin /></Icon><Text fontSize="xs">Pin</Text></HStack> },
        { value: 'high', label: <HStack gap={1}><Icon color="red.500" size="sm"><LuArrowUp /></Icon><Text fontSize="xs">High</Text></HStack> },
        { value: 'standard', label: <HStack gap={1}><Icon color="orange.500" size="sm"><LuMinus /></Icon><Text fontSize="xs">Std</Text></HStack> },
        { value: 'long term', label: <HStack gap={1}><Icon color="purple.500" size="sm"><LuClock /></Icon><Text fontSize="xs">Long</Text></HStack> },
        { value: 'nit', label: <HStack gap={1}><Icon color="yellow.500" size="sm"><LuSparkles /></Icon><Text fontSize="xs">Nit</Text></HStack> },
    ];

    const statusItems = [
        { value: 'backlog', label: 'Backlog' },
        { value: 'in_progress', label: 'Active' },
        { value: 'blocked', label: 'Blocked' },
    ];

    return (
        <>
            <style>{`
        .spin-animation {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
            <Popover.Root
                open={isOpen}
                onOpenChange={(e) => {
                    setIsOpen(e.open);
                    if (!e.open) {
                        setCurrentView('list');
                        resetForm();
                    }
                }}
            >
                {trigger ? (
                    <Popover.Trigger asChild>
                        {trigger}
                    </Popover.Trigger>
                ) : (
                    <Popover.Trigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            position="relative"
                            _hover={{ bg: 'transparent' }}
                            _active={{ bg: 'transparent' }}
                            data-state={isOpen ? 'open' : 'closed'}
                            css={{
                                '&[data-state="open"]': {
                                    backgroundColor: 'transparent',
                                },
                            }}
                        >
                            <LuListTodo />
                            {inProgressCount > 0 && (
                                <Badge
                                    position="absolute"
                                    top="-4px"
                                    right="-4px"
                                    colorPalette="blue"
                                    size="xs"
                                    borderRadius="full"
                                    px={1.5}
                                    fontSize="10px"
                                    minW="18px"
                                    h="18px"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                >
                                    {inProgressCount}
                                </Badge>
                            )}
                        </Button>
                    </Popover.Trigger>
                )}

                <Portal>
                    <Popover.Positioner>
                        <Popover.Content
                            width="420px"
                            maxH="70vh"
                            borderRadius="xl"
                            overflow="hidden"
                            css={glassStyle}
                            onKeyDown={handleKeyDown}
                        >
                            {/* Header */}
                            <Box
                                px={4}
                                py={3}
                                borderBottom="1px solid"
                                borderColor={colorMode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}
                            >
                                <Flex align="center" justify="space-between">
                                    {currentView !== 'list' && (
                                        <IconButton
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Back to list"
                                            onClick={goToList}
                                            mr={2}
                                            _hover={{ bg: 'transparent' }}
                                        >
                                            <Icon>
                                                <LuArrowLeft />
                                            </Icon>
                                        </IconButton>
                                    )}
                                    <Text fontWeight="semibold" fontSize="md" flex={1}>
                                        {currentView === 'list' && 'Tasks'}
                                        {currentView === 'create' && 'Quick Add'}
                                        {currentView === 'edit' && 'Edit Task'}
                                    </Text>
                                    {currentView === 'list' && onNavigateToTasks && (
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => {
                                                setIsOpen(false);
                                                onNavigateToTasks();
                                            }}
                                            color="text.muted"
                                            _hover={{ color: 'primary.500' }}
                                        >
                                            <Text fontSize="xs">See All →</Text>
                                        </Button>
                                    )}
                                </Flex>
                            </Box>

                            {/* Content */}
                            <Box
                                maxH="calc(70vh - 120px)"
                                overflowY="auto"
                                css={{
                                    '&::-webkit-scrollbar': {
                                        width: '6px',
                                    },
                                    '&::-webkit-scrollbar-track': {
                                        background: 'transparent',
                                    },
                                    '&::-webkit-scrollbar-thumb': {
                                        background: colorMode === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)',
                                        borderRadius: '3px',
                                    },
                                }}
                            >
                                {/* List View */}
                                {currentView === 'list' && (
                                    <Box p={3}>
                                        {loading ? (
                                            <Flex justify="center" py={8}>
                                                <Spinner size="sm" color="primary.500" />
                                            </Flex>
                                        ) : tasks.length === 0 ? (
                                            <VStack py={8} gap={2}>
                                                <Text color="text.muted" fontSize="sm">
                                                    No active tasks
                                                </Text>
                                                <Text color="text.muted" fontSize="xs" opacity={0.7}>
                                                    Click the button below to add one
                                                </Text>
                                            </VStack>
                                        ) : (
                                            <VStack gap={2} align="stretch">
                                                {tasks.slice(0, 8).map(task => {
                                                    const taskProjects = task.projectIds
                                                        .map(id => projects.find(p => p.id === id))
                                                        .filter(Boolean)
                                                        .map(p => p!.name);

                                                    return (
                                                        <Box
                                                            key={task.id}
                                                            p={3}
                                                            css={taskCardStyle}
                                                            onClick={() => goToEdit(task)}
                                                        >
                                                            <HStack justify="space-between" align="flex-start">
                                                                <VStack align="start" gap={0.5} flex={1} minW={0}>
                                                                    <Text
                                                                        fontWeight="medium"
                                                                        fontSize="sm"
                                                                        lineClamp={1}
                                                                    >
                                                                        {task.title}
                                                                    </Text>
                                                                    {taskProjects.length > 0 && (
                                                                        <Text
                                                                            fontSize="xs"
                                                                            color="text.muted"
                                                                            lineClamp={1}
                                                                        >
                                                                            {taskProjects.join(', ')}
                                                                        </Text>
                                                                    )}
                                                                </VStack>
                                                                <IconButton
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    aria-label={task.status === 'in_progress' ? 'Complete task' : 'Start task'}
                                                                    onClick={(e) => toggleTaskStatus(task, e)}
                                                                    color={getStatusColor(task.status)}
                                                                    _hover={{
                                                                        bg: 'transparent',
                                                                        color: task.status === 'in_progress' ? 'green.500' : 'blue.500',
                                                                        transform: 'scale(1.1)',
                                                                    }}
                                                                    transition="all 0.2s"
                                                                >
                                                                    <Icon size="sm">
                                                                        {getStatusIcon(task.status)}
                                                                    </Icon>
                                                                </IconButton>
                                                            </HStack>
                                                        </Box>
                                                    );
                                                })}
                                                {tasks.length > 8 && (
                                                    <Text fontSize="xs" color="text.muted" textAlign="center" pt={1}>
                                                        +{tasks.length - 8} more tasks
                                                    </Text>
                                                )}
                                            </VStack>
                                        )}
                                    </Box>
                                )}

                                {/* Create View */}
                                {currentView === 'create' && (
                                    <Box p={4}>
                                        <VStack gap={3} align="stretch">
                                            <Input
                                                ref={titleInputRef}
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="What needs to be done?"
                                                size="lg"
                                                fontWeight="medium"
                                                css={inputStyle}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleCreate(false);
                                                    }
                                                }}
                                            />

                                            <ProjectMultiSelect
                                                projects={projects}
                                                selectedProjectIds={selectedProjectIds}
                                                onChange={setSelectedProjectIds}
                                            />

                                            {/* More options toggle */}
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => setShowMoreOptions(!showMoreOptions)}
                                                color="text.muted"
                                                _hover={{ color: 'text.primary' }}
                                                justifyContent="flex-start"
                                                px={0}
                                            >
                                                <Icon size="sm">
                                                    {showMoreOptions ? <LuChevronUp /> : <LuChevronDown />}
                                                </Icon>
                                                <Text fontSize="xs" ml={1}>
                                                    {showMoreOptions ? 'Less options' : 'More options'}
                                                </Text>
                                            </Button>

                                            {/* Collapsible more options - using CSS transition instead of Collapse */}
                                            <Box
                                                overflow="hidden"
                                                maxH={showMoreOptions ? '400px' : '0'}
                                                opacity={showMoreOptions ? 1 : 0}
                                                transition="all 0.3s ease-in-out"
                                            >
                                                <VStack gap={3} align="stretch" pt={2}>
                                                    <Textarea
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        placeholder="Add notes..."
                                                        rows={2}
                                                        fontSize="sm"
                                                        css={inputStyle}
                                                    />

                                                    <Box>
                                                        <Text fontSize="xs" color="text.muted" mb={2}>Priority</Text>
                                                        <SegmentGroup.Root
                                                            value={priority}
                                                            onValueChange={(e) => setPriority(e.value as TaskPriority)}
                                                            size="sm"
                                                        >
                                                            <SegmentGroup.Indicator />
                                                            <SegmentGroup.Items items={priorityItems} />
                                                        </SegmentGroup.Root>
                                                    </Box>

                                                    <Box>
                                                        <Text fontSize="xs" color="text.muted" mb={2}>Status</Text>
                                                        <SegmentGroup.Root
                                                            value={status}
                                                            onValueChange={(e) => setStatus(e.value as TaskStatus)}
                                                            size="sm"
                                                        >
                                                            <SegmentGroup.Indicator />
                                                            <SegmentGroup.Items items={statusItems} />
                                                        </SegmentGroup.Root>
                                                    </Box>
                                                </VStack>
                                            </Box>
                                        </VStack>
                                    </Box>
                                )}

                                {/* Edit View */}
                                {currentView === 'edit' && editingTask && (
                                    <Box p={4}>
                                        <VStack gap={3} align="stretch">
                                            <Input
                                                ref={titleInputRef}
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Task title..."
                                                size="lg"
                                                fontWeight="medium"
                                                css={inputStyle}
                                            />

                                            <Textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Add notes..."
                                                rows={2}
                                                fontSize="sm"
                                                css={inputStyle}
                                            />

                                            <ProjectMultiSelect
                                                projects={projects}
                                                selectedProjectIds={selectedProjectIds}
                                                onChange={setSelectedProjectIds}
                                            />

                                            <Box>
                                                <Text fontSize="xs" color="text.muted" mb={2}>Priority</Text>
                                                <SegmentGroup.Root
                                                    value={priority}
                                                    onValueChange={(e) => setPriority(e.value as TaskPriority)}
                                                    size="sm"
                                                >
                                                    <SegmentGroup.Indicator />
                                                    <SegmentGroup.Items items={priorityItems} />
                                                </SegmentGroup.Root>
                                            </Box>

                                            <Box>
                                                <Text fontSize="xs" color="text.muted" mb={2}>Status</Text>
                                                <SegmentGroup.Root
                                                    value={status}
                                                    onValueChange={(e) => setStatus(e.value as TaskStatus)}
                                                    size="sm"
                                                >
                                                    <SegmentGroup.Indicator />
                                                    <SegmentGroup.Items items={statusItems} />
                                                </SegmentGroup.Root>
                                            </Box>
                                        </VStack>
                                    </Box>
                                )}
                            </Box>

                            {/* Footer */}
                            <Box
                                px={4}
                                py={3}
                                borderTop="1px solid"
                                borderColor={colorMode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}
                            >
                                {currentView === 'list' && (
                                    <Button
                                        colorPalette="primary"
                                        size="sm"
                                        width="full"
                                        onClick={goToCreate}
                                        borderRadius="lg"
                                        fontWeight="medium"
                                    >
                                        <HStack gap={2}>
                                            <Icon size="sm">
                                                <LuPlus />
                                            </Icon>
                                            <Text>Quick Add</Text>
                                        </HStack>
                                    </Button>
                                )}

                                {currentView === 'create' && (
                                    <HStack gap={2}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            flex={1}
                                            onClick={() => handleCreate(true)}
                                            disabled={!title.trim() || submitting}
                                            borderRadius="lg"
                                        >
                                            Create & Add More
                                        </Button>
                                        <Button
                                            colorPalette="primary"
                                            size="sm"
                                            flex={1}
                                            onClick={() => handleCreate(false)}
                                            disabled={!title.trim()}
                                            loading={submitting}
                                            borderRadius="lg"
                                        >
                                            Create
                                        </Button>
                                    </HStack>
                                )}

                                {currentView === 'edit' && (
                                    <HStack gap={2}>
                                        <IconButton
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Delete task"
                                            onClick={handleDelete}
                                            disabled={submitting}
                                            color="red.500"
                                            _hover={{ bg: 'red.500/10' }}
                                        >
                                            <Icon>
                                                <LuTrash2 />
                                            </Icon>
                                        </IconButton>
                                        <Box flex={1} />
                                        <Button
                                            colorPalette="primary"
                                            size="sm"
                                            onClick={handleUpdate}
                                            disabled={!title.trim()}
                                            loading={submitting}
                                            borderRadius="lg"
                                            px={6}
                                        >
                                            Save
                                        </Button>
                                    </HStack>
                                )}
                            </Box>
                        </Popover.Content>
                    </Popover.Positioner>
                </Portal>
            </Popover.Root>
        </>
    );
}
