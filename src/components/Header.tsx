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
  Switch,
  Icon,
  Menu,
  VStack,
} from '@chakra-ui/react';
import { LuSearch, LuBell, LuUser, LuLogOut } from 'react-icons/lu';
import { FaMoon, FaSun } from "react-icons/fa";
import { Task } from '../types/task';
import { ProjectEntry, invokeGetProjectRegistry } from '../ipc';
import TaskManagerPopover from './tasks/TaskManagerPopover';
import EditTaskDialog from './tasks/EditTaskDialog';
import TaskCreateDialog from './tasks/TaskCreateDialog';
import { useColorMode } from '../contexts/ColorModeContext';
import { useGitHubAuth } from '../auth/github/GitHubAuthProvider';

interface HeaderProps {
  currentProject?: ProjectEntry;
  onNavigateToTasks?: () => void;
}

export default function Header({ currentProject, onNavigateToTasks }: HeaderProps = {}) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const { colorMode, toggleColorMode } = useColorMode();
  const { isAuthenticated, user, signOut } = useGitHubAuth();

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
          {/* Dark Mode Toggle */}
          <Switch.Root
            colorPalette="blue"
            size="lg"
            checked={colorMode === 'dark'}
            onCheckedChange={(e) => {
              if (e.checked && colorMode === 'light') {
                toggleColorMode();
              } else if (!e.checked && colorMode === 'dark') {
                toggleColorMode();
              }
            }}
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
              <Switch.Indicator fallback={<Icon as={FaSun} color="yellow.400" />}>
                <Icon as={FaMoon} color="gray.400" />
              </Switch.Indicator>
            </Switch.Control>
          </Switch.Root>

          <TaskManagerPopover
            onOpenTaskDialog={handleOpenTaskDialog}
            onOpenCreateDialog={handleOpenCreateDialog}
            currentProject={currentProject}
            onNavigateToTasks={onNavigateToTasks}
          />

          <IconButton variant="ghost" size="sm" aria-label="Notifications">
            <LuBell />
          </IconButton>
          
          {/* User Menu */}
          <Menu.Root>
            <Menu.Trigger asChild>
              <Box as="button" cursor="pointer">
                <Avatar.Root size="sm">
                  {isAuthenticated && user?.avatar_url ? (
                    <Avatar.Image src={user.avatar_url} alt={user.login || 'User'} />
                  ) : null}
                  <Avatar.Fallback>
                    <LuUser />
                  </Avatar.Fallback>
                </Avatar.Root>
              </Box>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content width="240px">
                {isAuthenticated && user ? (
                  <>
                    {/* User Info */}
                    <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                      <VStack align="start" gap={1}>
                        <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>
                          {user.name || user.login}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                          @{user.login}
                        </Text>
                      </VStack>
                    </Box>
                    
                    {/* Logout */}
                    <Menu.Item
                      value="logout"
                      onSelect={async () => {
                        try {
                          await signOut();
                        } catch (error) {
                          console.error('Failed to sign out:', error);
                        }
                      }}
                    >
                      <HStack gap={2}>
                        <Icon>
                          <LuLogOut />
                        </Icon>
                        <Text>Sign Out</Text>
                      </HStack>
                    </Menu.Item>
                  </>
                ) : (
                  <Menu.Item value="signin" disabled>
                    <Text fontSize="sm" color="fg.muted">
                      Not signed in
                    </Text>
                  </Menu.Item>
                )}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </HStack>
      </Flex>

      {/* Task Dialogs */}
      <EditTaskDialog
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
