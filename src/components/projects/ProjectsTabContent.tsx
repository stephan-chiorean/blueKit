import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Text,
  VStack,
  HStack,
  EmptyState,
  Icon,
  Menu,
  IconButton,
  Portal,
  Flex,
  Button,
  Status,
} from '@chakra-ui/react';
import { Project, invokeOpenProjectInEditor, invokeDbGetProjects, invokeConnectProjectGit, invokeDisconnectProjectGit } from '../../ipc';
import { LuFolder, LuChevronRight } from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { FaGithub } from 'react-icons/fa';
import { toaster } from '../ui/toaster';

interface ProjectsTabContentProps {
  projects: Project[];
  projectsLoading: boolean;
  error: string | null;
  onProjectSelect: (project: Project) => void;
}

export default function ProjectsTabContent({
  projects,
  projectsLoading,
  error,
  onProjectSelect,
}: ProjectsTabContentProps) {
  const [connectingProjectId, setConnectingProjectId] = useState<string | null>(null);
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);

  // Update local projects when props change
  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  const handleConnectGit = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setConnectingProjectId(project.id);
      const updatedProject = await invokeConnectProjectGit(project.id);

      toaster.create({
        title: 'Git connected',
        description: `Successfully connected ${project.name} to git`,
        type: 'success',
        duration: 3000,
      });

      // Update local projects with the updated project
      setLocalProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect git';
      console.error('Failed to connect git:', err);
      toaster.create({
        title: 'Failed to connect git',
        description: errorMessage,
        type: 'error',
        duration: 5000,
      });
    } finally {
      setConnectingProjectId(null);
    }
  };

  const handleDisconnectGit = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setConnectingProjectId(project.id);
      const updatedProject = await invokeDisconnectProjectGit(project.id);

      toaster.create({
        title: 'Git disconnected',
        description: `Disconnected ${project.name} from git`,
        type: 'info',
        duration: 3000,
      });

      // Update local projects with the updated project
      setLocalProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect git';
      toaster.create({
        title: 'Failed to disconnect git',
        description: errorMessage,
        type: 'error',
        duration: 5000,
      });
    } finally {
      setConnectingProjectId(null);
    }
  };

  if (projectsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading projects...
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500">
        Error: {error}
      </Box>
    );
  }

  if (projects.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon boxSize={12} color="text.tertiary">
                <LuFolder />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>No projects found</EmptyState.Title>
            <EmptyState.Description>
              Projects are managed via CLI and will appear here automatically when linked.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Box>
    );
  }

  const handleOpenInEditor = async (
    project: Project,
    editor: 'cursor' | 'vscode'
  ) => {
    try {
      await invokeOpenProjectInEditor(project.path, editor);
    } catch (error) {
      console.error(`Failed to open project in ${editor}:`, error);
    }
  };

  return (
    <VStack align="stretch" gap={4}>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
        {localProjects.map((project) => {
          const isConnectingThis = connectingProjectId === project.id;

          return (
            <Card.Root
              key={project.id}
              variant="subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              cursor="pointer"
              _hover={{ borderColor: "primary.400" }}
              transition="all 0.2s"
              onClick={() => onProjectSelect(project)}
              position="relative"
              overflow="visible"
            >
              <CardHeader>
                <Flex align="start" justify="space-between" gap={4}>
                  <VStack align="start" gap={3} flex={1}>
                    <HStack gap={2} align="center">
                      <Icon boxSize={5} color="primary.500">
                        <LuFolder />
                      </Icon>
                      <Heading size="lg">{project.name}</Heading>
                    </HStack>

                    {/* GitHub connection status */}
                    <HStack gap={3}>
                      <HStack gap={2}>
                        <Icon boxSize={4} color={project.gitConnected ? "green.500" : "gray.400"}>
                          <FaGithub />
                        </Icon>
                        <Status.Root size="sm">
                          <Status.Indicator colorPalette={project.gitConnected ? "green" : "gray"} />
                          <Text fontSize="sm" color="fg.muted">
                            {project.gitConnected ? 'Connected' : 'Not connected'}
                          </Text>
                        </Status.Root>
                      </HStack>

                      {/* Connect/Disconnect button */}
                      {dbProject && (
                        dbProject.gitConnected ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="red"
                            onClick={(e) => handleDisconnectGit(project, e)}
                            loading={isConnectingThis}
                            loadingText="Disconnecting..."
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="green"
                            onClick={(e) => handleConnectGit(project, e)}
                            loading={isConnectingThis}
                            loadingText="Connecting..."
                          >
                            Connect
                          </Button>
                        )
                      )}
                    </HStack>

                    {/* Show git URL if connected */}
                    {project.gitConnected && dbProject.gitUrl && (
                      <Text fontSize="xs" color="fg.muted" fontFamily="mono" noOfLines={1}>
                        {dbProject.gitUrl}
                      </Text>
                    )}
                  </VStack>

                  <Box flexShrink={0} onClick={(e) => e.stopPropagation()}>
                    <Menu.Root>
                      <Menu.Trigger asChild>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label="Project options"
                          onClick={(e) => e.stopPropagation()}
                          bg="transparent"
                          _hover={{ bg: "transparent" }}
                          _active={{ bg: "transparent" }}
                          _focus={{ bg: "transparent" }}
                          _focusVisible={{ bg: "transparent" }}
                        >
                          <Icon>
                            <IoIosMore />
                          </Icon>
                        </IconButton>
                      </Menu.Trigger>
                      <Portal>
                        <Menu.Positioner>
                          <Menu.Content>
                            <Menu.Root positioning={{ placement: "right-start", gutter: 2 }}>
                              <Menu.TriggerItem>
                                Open <LuChevronRight />
                              </Menu.TriggerItem>
                              <Portal>
                                <Menu.Positioner>
                                  <Menu.Content>
                                    <Menu.Item
                                      value="cursor"
                                      onSelect={() => handleOpenInEditor(project, 'cursor')}
                                    >
                                      Cursor
                                    </Menu.Item>
                                    <Menu.Item
                                      value="vscode"
                                      onSelect={() => handleOpenInEditor(project, 'vscode')}
                                    >
                                      VSCode
                                    </Menu.Item>
                                  </Menu.Content>
                                </Menu.Positioner>
                              </Portal>
                            </Menu.Root>
                          </Menu.Content>
                        </Menu.Positioner>
                      </Portal>
                    </Menu.Root>
                  </Box>
                </Flex>
              </CardHeader>
              <CardBody>
                <Text fontSize="sm" color="text.secondary" mb={3}>
                  {project.description || 'No description'}
                </Text>
                <Text fontSize="xs" color="text.tertiary" fontFamily="mono" noOfLines={1}>
                  {project.path}
                </Text>
              </CardBody>
            </Card.Root>
          );
        })}
      </SimpleGrid>
    </VStack>
  );
}
