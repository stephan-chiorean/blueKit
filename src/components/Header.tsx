import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Avatar,
  Heading,
  Text,
} from '@chakra-ui/react';
import { LuSearch, LuBell, LuUser } from 'react-icons/lu';
import { Task } from '../types/task';
import { ProjectEntry, invokeGetProjectRegistry } from '../ipc';
import TaskManagerPopover from './tasks/TaskManagerPopover';
import TaskDialog from './tasks/TaskDialog';
import TaskCreateDialog from './tasks/TaskCreateDialog';

export default function Header() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const registryProjects = await invokeGetProjectRegistry();
        setProjects(registryProjects);
      } catch (error) {
        console.error('Failed to load projects in Header:', error);
      }
    };
    loadProjects();
  }, []);

  const handleOpenTaskDialog = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleOpenCreateDialog = (projectsToPass: ProjectEntry[]) => {
    setProjects(projectsToPass);
    setIsCreateDialogOpen(true);
  };

  const handleTaskUpdated = () => {
    // Dialogs will reload their own data
  };

  return (
    <Box
      bg="bg.subtle"
      px={6}
      py={2}
      position="sticky"
      top={0}
      zIndex={10}
      boxShadow="sm"
    >
      <Flex align="center" justify="space-between" gap={4}>
        {/* blueKit branding on the left */}
        <Box flex="1">
          <Heading size="lg">
            <Text as="span" color="primary.500">
              blue
            </Text>
            <Text as="span">Kit</Text>
          </Heading>
        </Box>

        {/* Center search bar */}
        <Box flex="2" maxW="600px">
          <InputGroup startElement={<LuSearch />}>
            <Input
              placeholder="Search..."
              variant="subtle"
              borderWidth="1px"
              borderColor="primary.300"
            />
          </InputGroup>
        </Box>

        {/* Right side icons */}
        <HStack gap={2} flex="1" justify="flex-end">
          <TaskManagerPopover
            onOpenTaskDialog={handleOpenTaskDialog}
            onOpenCreateDialog={handleOpenCreateDialog}
          />

          <IconButton variant="ghost" size="sm" aria-label="Notifications">
            <LuBell />
          </IconButton>
          <Avatar.Root size="sm">
            <Avatar.Fallback>
              <LuUser />
            </Avatar.Fallback>
          </Avatar.Root>
        </HStack>
      </Flex>

      {/* Task Dialogs */}
      <TaskDialog
        task={selectedTask}
        isOpen={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={handleTaskUpdated}
      />

      <TaskCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onTaskCreated={handleTaskUpdated}
        projects={projects}
        defaultProjectId={undefined}
      />
    </Box>
  );
}
