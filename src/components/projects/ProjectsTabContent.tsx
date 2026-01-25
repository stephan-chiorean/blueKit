import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
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
  Dialog,
  Input,
} from '@chakra-ui/react';
import { useColorMode } from '../../contexts/ColorModeContext';
import { Project, invokeOpenProjectInEditor, invokeOpenInTerminal, invokeConnectProjectGit, invokeDisconnectProjectGit, invokeDbUpdateProject, invokeDbDeleteProject } from '../../ipc';
import { LuFolder, LuChevronRight, LuPencil, LuTrash2, LuCopy } from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { FaGithub } from 'react-icons/fa';
import { toaster } from '../ui/toaster';

interface ProjectsTabContentProps {
  projects: Project[];
  projectsLoading: boolean;
  error: string | null;
  onProjectSelect: (project: Project) => void;
  onProjectsChanged?: () => void;
}

export default function ProjectsTabContent({
  projects,
  projectsLoading,
  error,
  onProjectSelect,
  onProjectsChanged,
}: ProjectsTabContentProps) {
  const [connectingProjectId, setConnectingProjectId] = useState<string | null>(null);
  const [localProjects, setLocalProjects] = useState<Project[]>(projects.filter(p => !p.isVault));
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { colorMode } = useColorMode();

  // Glass styling for light/dark mode
  const cardBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(20, 20, 25, 0.5)';
  const cardBorder = colorMode === 'light' ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.12)';

  // Update local projects when props change
  useEffect(() => {
    setLocalProjects(projects.filter(p => !p.isVault));
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

      // Notify parent to reload projects
      onProjectsChanged?.();
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

      // Notify parent to reload projects
      onProjectsChanged?.();
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
    editor: 'cursor' | 'vscode' | 'antigravity'
  ) => {
    try {
      await invokeOpenProjectInEditor(project.path, editor);
    } catch (error) {
      console.error(`Failed to open project in ${editor}:`, error);
    }
  };

  const handleOpenInTerminal = async (project: Project) => {
    try {
      await invokeOpenInTerminal(project.path);
    } catch (error) {
      console.error('Failed to open terminal:', error);
      toaster.create({
        title: 'Failed to open terminal',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
      });
    }
  };

  const handleCopyPath = async (project: Project) => {
    try {
      await navigator.clipboard.writeText(project.path);
      toaster.create({
        title: 'Path copied',
        description: `Copied ${project.path} to clipboard`,
        type: 'success',
        duration: 2000,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy path';
      toaster.create({
        title: 'Failed to copy path',
        description: errorMessage,
        type: 'error',
        duration: 3000,
      });
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingProject) return;

    try {
      setIsSaving(true);
      const updatedProject = await invokeDbUpdateProject(
        editingProject.id,
        editName,
        editDescription
      );

      setLocalProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      setEditingProject(null);

      // Notify parent to reload projects
      onProjectsChanged?.();

      toaster.create({
        title: 'Project updated',
        description: `Successfully updated ${editName}`,
        type: 'success',
        duration: 3000,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project';
      toaster.create({
        title: 'Failed to update project',
        description: errorMessage,
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = (project: Project) => {
    setDeletingProject(project);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;

    try {
      setIsDeleting(true);
      await invokeDbDeleteProject(deletingProject.id);
      setLocalProjects(prev => prev.filter(p => p.id !== deletingProject.id));

      // Notify parent to reload projects
      onProjectsChanged?.();

      toaster.create({
        title: 'Project removed',
        description: `Successfully removed ${deletingProject.name} from registry`,
        type: 'success',
        duration: 3000,
      });

      setDeletingProject(null);
      setDeleteConfirmText('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      toaster.create({
        title: 'Failed to remove project',
        description: errorMessage,
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <VStack align="stretch" gap={4} w="100%" maxW="100%">
      <Box
        display="grid"
        gap={6}
        gridTemplateColumns={{
          base: "1fr",
          md: "repeat(2, 1fr)",
          lg: "repeat(3, 1fr)",
        }}
        w="100%"
        css={{
          '@media (min-width: 1920px)': {
            gridTemplateColumns: 'repeat(4, 1fr)',
          },
        }}
      >
        {localProjects.map((project) => {
          const isConnectingThis = connectingProjectId === project.id;

          return (
            <Box
              key={project.id}
              cursor="pointer"
              _hover={{ borderColor: "primary.400" }}
              transition="all 0.2s"
              onClick={() => onProjectSelect(project)}
              position="relative"
              overflow="hidden"
              borderRadius="lg"
              p={4}
              w="100%"
              minW={0}
              style={{
                background: cardBg,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: cardBorder,
              }}
            >
              <Box bg="transparent" w="100%" minW={0}>
                <Flex align="start" justify="space-between" gap={4} w="100%" minW={0}>
                  <VStack align="start" gap={3} flex={1} minW={0}>
                    <HStack gap={2} align="center" w="100%" minW={0}>
                      <Icon boxSize={5} color="primary.500" flexShrink={0}>
                        <LuFolder />
                      </Icon>
                      <Heading size="lg" truncate>{project.name}</Heading>
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
                      {project.gitConnected ? (
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
                      )}
                    </HStack>

                    {/* Show git URL if connected */}
                    {project.gitConnected && project.gitUrl && (
                      <Text fontSize="xs" color="fg.muted" fontFamily="mono" lineClamp={1}>
                        {project.gitUrl}
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
                                      value="terminal"
                                      onSelect={() => handleOpenInTerminal(project)}
                                    >
                                      Terminal
                                    </Menu.Item>
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
                                    <Menu.Item
                                      value="antigravity"
                                      onSelect={() => handleOpenInEditor(project, 'antigravity')}
                                    >
                                      Antigravity
                                    </Menu.Item>
                                  </Menu.Content>
                                </Menu.Positioner>
                              </Portal>
                            </Menu.Root>
                            <Menu.Separator />
                            <Menu.Item
                              value="copy-path"
                              onSelect={() => handleCopyPath(project)}
                            >
                              <Icon><LuCopy /></Icon>
                              Copy Path
                            </Menu.Item>
                            <Menu.Item
                              value="edit"
                              onSelect={() => handleEditProject(project)}
                            >
                              <Icon><LuPencil /></Icon>
                              Edit Project
                            </Menu.Item>
                            <Menu.Item
                              value="delete"
                              onSelect={() => handleDeleteProject(project)}
                              color="fg.error"
                            >
                              <Icon><LuTrash2 /></Icon>
                              Remove Project
                            </Menu.Item>
                          </Menu.Content>
                        </Menu.Positioner>
                      </Portal>
                    </Menu.Root>
                  </Box>
                </Flex>
              </Box>
              <Box bg="transparent" pt={2} w="100%" minW={0}>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'blue.300' : 'secondary.solid'} mb={3} lineClamp={2}>
                  {project.description || 'No description'}
                </Text>
                <Text fontSize="xs" color="text.tertiary" fontFamily="mono" truncate w="100%">
                  {project.path}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Edit Project Dialog */}
      <Dialog.Root
        open={editingProject !== null}
        onOpenChange={(e) => {
          if (!e.open) {
            setEditingProject(null);
          }
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Edit Project</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack gap={4} align="stretch">
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Project Name
                    </Text>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter project name"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Description
                    </Text>
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Enter project description (optional)"
                    />
                  </Box>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline" disabled={isSaving}>
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button
                  onClick={handleSaveEdit}
                  loading={isSaving}
                  disabled={!editName.trim()}
                >
                  Save Changes
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Delete Project Confirmation Dialog */}
      <Dialog.Root
        open={deletingProject !== null}
        onOpenChange={(e) => {
          if (!e.open) {
            setDeletingProject(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title color="fg.error">Remove Project</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack gap={4} align="stretch">
                  <Box
                    p={3}
                    bg="red.50"
                    borderWidth="1px"
                    borderColor="red.200"
                    borderRadius="md"
                    _dark={{ bg: "red.950", borderColor: "red.800" }}
                  >
                    <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }}>
                      This action cannot be undone. This will remove the project from BlueKit's registry.
                    </Text>
                  </Box>

                  <Text fontSize="sm" color="fg.muted">
                    The actual project files will not be deleted, only the registry entry will be removed.
                  </Text>

                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Type <Text as="span" fontWeight="bold" fontFamily="mono">{deletingProject?.name}</Text> to confirm:
                    </Text>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={deletingProject?.name}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </Box>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline" disabled={isDeleting}>
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button
                  onClick={handleConfirmDelete}
                  loading={isDeleting}
                  disabled={deleteConfirmText !== deletingProject?.name}
                  colorPalette="red"
                >
                  Remove Project
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
