import { useState, useEffect } from 'react';
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
  Flex,
} from '@chakra-ui/react';
import { LuPlus, LuListTodo } from 'react-icons/lu';
import { Task } from '../../types/task';
import { ProjectEntry, invokeDbGetTasks, invokeGetProjectRegistry } from '../../ipc';

interface TaskManagerPopoverProps {
  onOpenTaskDialog: (task: Task) => void;
  onOpenCreateDialog: (projects: ProjectEntry[]) => void;
  currentProject?: ProjectEntry;
  onNavigateToTasks?: () => void;
}

export default function TaskManagerPopover({
  onOpenTaskDialog,
  onOpenCreateDialog,
  currentProject,
  onNavigateToTasks,
}: TaskManagerPopoverProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Load in-progress tasks and projects
  const loadInProgressTasks = async () => {
    try {
      setLoading(true);
      const [allTasks, projectRegistry] = await Promise.all([
        invokeDbGetTasks(),
        invokeGetProjectRegistry(),
      ]);
      const inProgressTasks = allTasks.filter(task => task.status === 'in_progress');
      setTasks(inProgressTasks);
      setProjects(projectRegistry);
    } catch (error) {
      console.error('Failed to load in-progress tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadInProgressTasks();
  }, []);

  const inProgressCount = tasks.length;

  return (
    <Popover.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" position="relative">
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
            >
              {inProgressCount}
            </Badge>
          )}
        </Button>
      </Popover.Trigger>

      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="lg" width="400px">
            <Popover.Header>
              <Flex align="center" justify="space-between" width="full">
                <Text fontWeight="semibold">In Progress Tasks</Text>
                {onNavigateToTasks && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigateToTasks();
                    }}
                    colorPalette="gray"
                  >
                    <Text fontSize="sm">See All</Text>
                  </Button>
                )}
              </Flex>
            </Popover.Header>

            <Popover.Body>
              {loading ? (
                <Box textAlign="center" py={4}>
                  <Spinner size="sm" />
                </Box>
              ) : tasks.length === 0 ? (
                <VStack py={4} gap={2}>
                  <Text color="text.secondary" fontSize="sm">
                    No tasks in progress
                  </Text>
                  <Text color="text.tertiary" fontSize="xs">
                    Click "Add Task" to create a new task
                  </Text>
                </VStack>
              ) : (
                <VStack gap={2} align="stretch">
                  {tasks.map(task => {
                    // Get project names for this task
                    const taskProjects = task.projectIds
                      .map(projectId => projects.find(p => p.id === projectId))
                      .filter(Boolean)
                      .map(p => p!.title);

                    return (
                      <Box
                        key={task.id}
                        p={3}
                        bg="bg.subtle"
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        cursor="pointer"
                        onClick={() => onOpenTaskDialog(task)}
                        _hover={{ bg: 'primary.hover.bg', borderColor: 'primary.400' }}
                      >
                        <Text fontWeight="medium" fontSize="sm">
                          {task.title}
                        </Text>
                        {taskProjects.length > 0 && (
                          <Text fontSize="xs" color="text.secondary" mt={1}>
                            {taskProjects.join(', ')}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </Popover.Body>

            <Popover.Footer>
              <Button
                colorPalette="primary"
                size="sm"
                width="full"
                onClick={() => onOpenCreateDialog(projects)}
              >
                <HStack gap={2}>
                  <LuPlus />
                  <Text>Add Task</Text>
                </HStack>
              </Button>
            </Popover.Footer>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
