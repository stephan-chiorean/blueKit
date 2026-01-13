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
  Icon,
  Menu,
  VStack,
  Switch,
} from '@chakra-ui/react';
import { LuSearch, LuBell, LuUser, LuLogOut, LuNotebookPen } from 'react-icons/lu';
import { Task } from '../types/task';
import { Project, invokeGetProjectRegistry } from '../ipc';
import TaskManagerPopover from './tasks/TaskManagerPopover';
import EditTaskDialog from './tasks/EditTaskDialog';
import TaskCreateDialog from './tasks/TaskCreateDialog';
import { useColorMode } from '../contexts/ColorModeContext';
import { useGitHubAuth } from '../auth/github/GitHubAuthProvider';
import { useNotepad } from '../contexts/NotepadContext';
import { useTimer } from '../contexts/TimerContext';
import TimerPopover from './shared/TimerPopover';
import SignInPopover from './shared/SignInPopover';
import { FaMoon, FaSun } from "react-icons/fa"

interface HeaderProps {
  currentProject?: Project;
  onNavigateToTasks?: () => void;
}

export default function Header({ currentProject, onNavigateToTasks }: HeaderProps = {}) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSignInPopoverOpen, setIsSignInPopoverOpen] = useState(false);
  const { colorMode, toggleColorMode } = useColorMode();
  const { isAuthenticated, user, signOut } = useGitHubAuth();
  const { isOpen: isNotepadOpen, toggleNotepad } = useNotepad();
  const { isPinned, elapsedTime, formatTime } = useTimer();

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

  const handleOpenCreateDialog = (projectsToPass: Project[]) => {
    setProjects(projectsToPass);
    setIsCreateDialogOpen(true);
  };

  const handleTaskUpdated = () => {
    // Dialogs will reload their own data
  };

  // Glass styling for light/dark mode
  const headerBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(20, 20, 25, 0.15)';

  return (
    <Box
      px={6}
      py={2}
      position="sticky"
      top={0}
      zIndex={10}
      style={{
        background: headerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Flex align="center" justify="space-between" gap={4}>
        {/* blueKit branding on the left */}
        <Box flex="1">
          <Heading size="lg">
            <Text
              as="span"
              color="primary.500"
              css={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              blue
            </Text>
            <Text
              as="span"
              css={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              Kit
            </Text>
          </Heading>
        </Box>

        {/* Center search bar */}
        <Box flex="2" maxW="600px">
          <InputGroup startElement={<LuSearch />}>
            <Input
              placeholder="Search..."
              variant="subtle"
              bg="bg.emphasized"
            />
          </InputGroup>
        </Box>

        {/* Right side icons */}
        <HStack gap={2} flex="1" justify="flex-end">
          {/* Pinned Timer Display */}
          {isPinned && (
            <Text
              fontSize="sm"
              fontWeight="medium"
              fontFamily="mono"
              color="primary.500"
              letterSpacing="0.05em"
              px={2}
              py={1}
            >
              {formatTime(elapsedTime)}
            </Text>
          )}

          {/* Dark Mode Toggle */}
          <Switch.Root
            checked={colorMode === 'dark'}
            onCheckedChange={toggleColorMode}
            colorPalette="blue"
            size="lg"
            cursor="pointer"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
              <Switch.Indicator fallback={<Icon as={FaSun} color="orange.400" />}>
                <Icon as={FaMoon} color="yellow.400" />
              </Switch.Indicator>
            </Switch.Control>
          </Switch.Root>

          <TaskManagerPopover
            onOpenTaskDialog={handleOpenTaskDialog}
            onOpenCreateDialog={handleOpenCreateDialog}
            currentProject={currentProject}
            onNavigateToTasks={onNavigateToTasks}
          />

          <TimerPopover />

          <IconButton
            variant="ghost"
            size="sm"
            aria-label={isNotepadOpen ? 'Close notepad' : 'Open notepad'}
            onClick={toggleNotepad}
            colorPalette={isNotepadOpen ? 'primary' : undefined}
            _hover={{ bg: 'transparent' }}
          >
            <LuNotebookPen />
          </IconButton>

          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Notifications"
            _hover={{ bg: 'transparent' }}
          >
            <LuBell />
          </IconButton>

          {/* User Menu */}
          {isAuthenticated && user ? (
            <Menu.Root>
              <Menu.Trigger asChild>
                <Box as="button" cursor="pointer" _hover={{ bg: 'transparent' }}>
                  <Avatar.Root size="sm">
                    {user.avatar_url ? (
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
                        // Close sign-in popover if it's open
                        setIsSignInPopoverOpen(false);
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
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          ) : (
            <SignInPopover
              isOpen={isSignInPopoverOpen}
              onOpenChange={setIsSignInPopoverOpen}
              trigger={
                <Box as="button" cursor="pointer">
                  <Avatar.Root size="sm">
                    <Avatar.Fallback>
                      <LuUser />
                    </Avatar.Fallback>
                  </Avatar.Root>
                </Box>
              }
            />
          )}
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
