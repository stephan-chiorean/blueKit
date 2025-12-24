import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  HStack,
  Icon,
  Input,
  Portal,
  Spinner,
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react';
import { LuUpload, LuPlus, LuCheck, LuX, LuGithub, LuTag } from 'react-icons/lu';
import { toaster } from '../ui/toaster';
import {
  invokeLibraryListWorkspaces,
  invokeLibraryCreateWorkspace,
  invokePublishResource,
  invokeScanProjectResources,
  invokeGetProjectResources,
} from '../../ipc/library';
import { invokeGitHubGetUser } from '../../ipc/github';
import { LibraryWorkspace, LibraryResource, GitHubUser } from '../../types/github';

interface PublishToLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Items to publish - need path and projectId to find resources */
  items: Array<{
    path?: string;
    name: string;
    type: string;
    projectId?: string;
    projectPath?: string;
  }>;
  onPublished?: () => void;
}

export default function PublishToLibraryDialog({
  isOpen,
  onClose,
  items,
  onPublished,
}: PublishToLibraryDialogProps) {
  const [workspaces, setWorkspaces] = useState<LibraryWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<LibraryWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // GitHub auth state
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Create workspace form
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newGithubRepo, setNewGithubRepo] = useState('');
  const [creating, setCreating] = useState(false);

  // Variation label for publishing
  const [variationLabel, setVariationLabel] = useState('');

  // Track publish results
  const [publishResults, setPublishResults] = useState<
    Array<{ name: string; success: boolean; error?: string }>
  >();

  // Suggested labels for quick selection
  const suggestedLabels = ['initial', 'updated', 'refactored', 'v2', 'stable', 'experimental'];

  useEffect(() => {
    if (isOpen) {
      checkGitHubAuth();
      loadWorkspaces();
      setPublishResults([]);
      setVariationLabel('');
    }
  }, [isOpen]);

  const checkGitHubAuth = async () => {
    setCheckingAuth(true);
    try {
      const user = await invokeGitHubGetUser();
      setGithubUser(user);
    } catch (error) {
      console.error('Not authenticated with GitHub:', error);
      setGithubUser(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const ws = await invokeLibraryListWorkspaces();
      setWorkspaces(ws);
      if (ws.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(ws[0]);
      }
      if (ws.length === 0) {
        setShowCreateForm(true);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!githubUser || !newWorkspaceName.trim() || !newGithubRepo.trim()) {
      return;
    }
    setCreating(true);
    try {
      const workspace = await invokeLibraryCreateWorkspace(
        newWorkspaceName.trim(),
        githubUser.login,
        newGithubRepo.trim()
      );
      setWorkspaces((prev) => [...prev, workspace]);
      setSelectedWorkspace(workspace);
      setShowCreateForm(false);
      setNewWorkspaceName('');
      setNewGithubRepo('');
      toaster.create({
        type: 'success',
        title: 'Workspace created',
        description: `Created workspace "${workspace.name}". Note: The GitHub repository must already exist.`,
      });
    } catch (error) {
      console.error('Failed to create workspace:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create workspace',
      });
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedWorkspace) {
      toaster.create({
        type: 'error',
        title: 'No workspace selected',
        description: 'Please select a workspace to publish to',
      });
      return;
    }

    if (items.length === 0) {
      toaster.create({
        type: 'error',
        title: 'No items to publish',
        description: 'No items selected for publishing',
      });
      return;
    }

    // Check if items have project info
    const itemsWithProject = items.filter(item => item.projectId && item.projectPath);
    if (itemsWithProject.length === 0) {
      toaster.create({
        type: 'error',
        title: 'Missing project info',
        description: 'Selected items must belong to a project to be published',
      });
      return;
    }

    setPublishing(true);
    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    try {
      // Group items by project
      const itemsByProject = new Map<string, typeof items>();
      for (const item of itemsWithProject) {
        const key = item.projectId!;
        if (!itemsByProject.has(key)) {
          itemsByProject.set(key, []);
        }
        itemsByProject.get(key)!.push(item);
      }

      // For each project, scan resources and find matching ones
      for (const [projectId, projectItems] of itemsByProject) {
        const projectPath = projectItems[0].projectPath!;

        // Scan project to ensure resources are up to date
        console.log(`Scanning project ${projectId} at ${projectPath}`);
        await invokeScanProjectResources(projectId, projectPath);

        // Get resources
        const resources = await invokeGetProjectResources(projectId);
        console.log(`Found ${resources.length} resources in project`);

        // Match items to resources by path
        for (const item of projectItems) {
          console.log(`Looking for resource matching: ${item.path} or ${item.name}`);
          
          const resource = resources.find((r: LibraryResource) => {
            // Normalize paths for comparison (remove leading ./ or /)
            const normalizePath = (p: string) => p.replace(/^\.?\//, '').replace(/\\/g, '/');
            const itemPath = item.path ? normalizePath(item.path) : '';
            const resourcePath = normalizePath(r.relativePath);
            
            // Match by path - check if paths end the same way (handles nested folders)
            const pathMatch = itemPath && (
              itemPath === resourcePath ||
              itemPath.endsWith('/' + resourcePath) ||
              resourcePath.endsWith('/' + itemPath) ||
              // Handle case where item.path is absolute and contains the relative path
              itemPath.includes('/.bluekit/' + resourcePath)
            );
            
            // Match by filename (fallback)
            const nameMatch = r.fileName === item.name || r.fileName === `${item.name}.md`;
            
            return pathMatch || nameMatch;
          });

          if (resource) {
            console.log(`Found matching resource: ${resource.id}`);
            try {
              const result = await invokePublishResource(resource.id, selectedWorkspace.id, {
                versionTag: variationLabel.trim() || undefined,
              });
              console.log('Publish result:', result);
              results.push({ name: item.name, success: true });
            } catch (error) {
              console.error('Publish error:', error);
              results.push({
                name: item.name,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          } else {
            console.log(`No matching resource found for ${item.name}`);
            results.push({
              name: item.name,
              success: false,
              error: 'Resource not found in project database. Try opening the project first.',
            });
          }
        }
      }

      // Handle items without project info
      for (const item of items.filter(i => !i.projectId || !i.projectPath)) {
        results.push({
          name: item.name,
          success: false,
          error: 'Item is not associated with a project',
        });
      }

      setPublishResults(results);

      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        toaster.create({
          type: 'success',
          title: 'Published',
          description: `Published ${successCount} of ${results.length} items`,
        });
        onPublished?.();
      } else if (results.length > 0) {
        toaster.create({
          type: 'error',
          title: 'Publish failed',
          description: 'No items were published. Check the errors below.',
        });
      }

      if (successCount === results.length && results.length > 0) {
        onClose();
      }
    } catch (error) {
      console.error('Publish failed:', error);
      toaster.create({
        type: 'error',
        title: 'Publish failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setPublishing(false);
    }
  };

  // Not authenticated with GitHub
  if (!checkingAuth && !githubUser) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="400px">
              <Dialog.Header>
                <Dialog.Title>Publish to Library</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack gap={4} align="center" py={4}>
                  <Icon fontSize="3xl" color="gray.400">
                    <LuGithub />
                  </Icon>
                  <Text textAlign="center">
                    You need to sign in with GitHub to publish resources to a library.
                  </Text>
                  <Text fontSize="sm" color="text.secondary" textAlign="center">
                    Go to Settings and connect your GitHub account.
                  </Text>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header>
              <Dialog.Title>Publish to Library</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {loading || checkingAuth ? (
                <Flex justify="center" py={8}>
                  <Spinner />
                </Flex>
              ) : showCreateForm || workspaces.length === 0 ? (
                <VStack gap={4} align="stretch">
                  <Text fontSize="sm" color="text.secondary">
                    Create a workspace to publish your resources. The GitHub repository must already exist.
                  </Text>
                  <Field.Root>
                    <Field.Label>Workspace Name</Field.Label>
                    <Input
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="My Team Library"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>GitHub Owner</Field.Label>
                    <Input
                      value={githubUser?.login || ''}
                      disabled
                      bg="bg.subtle"
                    />
                    <Field.HelperText>Using your GitHub account</Field.HelperText>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>GitHub Repository</Field.Label>
                    <Input
                      value={newGithubRepo}
                      onChange={(e) => setNewGithubRepo(e.target.value)}
                      placeholder="bluekit-library"
                    />
                    <Field.HelperText>Repository must already exist on GitHub</Field.HelperText>
                  </Field.Root>
                  <HStack gap={2}>
                    {workspaces.length > 0 && (
                      <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                        Cancel
                      </Button>
                    )}
                    <Button
                      colorPalette="primary"
                      onClick={handleCreateWorkspace}
                      disabled={
                        creating ||
                        !newWorkspaceName.trim() ||
                        !newGithubRepo.trim()
                      }
                    >
                      {creating ? <Spinner size="sm" /> : <LuPlus />}
                      <Text ml={2}>Create Workspace</Text>
                    </Button>
                  </HStack>
                </VStack>
              ) : (
                <VStack gap={4} align="stretch">
                  {/* Workspace selector */}
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Select Workspace
                    </Text>
                    <HStack gap={2} wrap="wrap">
                      {workspaces.map((ws) => (
                        <Tag.Root
                          key={ws.id}
                          cursor="pointer"
                          colorPalette={selectedWorkspace?.id === ws.id ? 'primary' : 'gray'}
                          variant={selectedWorkspace?.id === ws.id ? 'solid' : 'subtle'}
                          onClick={() => setSelectedWorkspace(ws)}
                        >
                          <Tag.Label>{ws.name}</Tag.Label>
                        </Tag.Root>
                      ))}
                      <Tag.Root
                        cursor="pointer"
                        colorPalette="gray"
                        variant="outline"
                        onClick={() => setShowCreateForm(true)}
                      >
                        <LuPlus />
                        <Tag.Label>New</Tag.Label>
                      </Tag.Root>
                    </HStack>
                  </Box>

                  {/* Variation Label */}
                  <Box>
                    <HStack gap={2} mb={2}>
                      <Icon fontSize="sm" color="primary.500">
                        <LuTag />
                      </Icon>
                      <Text fontSize="sm" fontWeight="medium">
                        Variation Label
                      </Text>
                      <Text fontSize="xs" color="text.tertiary">(optional)</Text>
                    </HStack>
                    <Input
                      value={variationLabel}
                      onChange={(e) => setVariationLabel(e.target.value)}
                      placeholder="e.g., initial, refactored, v2"
                      size="sm"
                      mb={2}
                    />
                    <HStack gap={1} wrap="wrap">
                      {suggestedLabels.map((label) => (
                        <Tag.Root
                          key={label}
                          size="sm"
                          cursor="pointer"
                          colorPalette={variationLabel === label ? 'primary' : 'gray'}
                          variant={variationLabel === label ? 'solid' : 'outline'}
                          onClick={() => setVariationLabel(variationLabel === label ? '' : label)}
                        >
                          <Tag.Label>{label}</Tag.Label>
                        </Tag.Root>
                      ))}
                    </HStack>
                  </Box>

                  {/* Items to publish */}
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Items to Publish ({items.length})
                    </Text>
                    <VStack align="stretch" gap={1} maxH="200px" overflowY="auto">
                      {items.map((item, idx) => {
                        const result = publishResults.find((r) => r.name === item.name);
                        const hasProjectInfo = item.projectId && item.projectPath;
                        return (
                          <Flex
                            key={idx}
                            justify="space-between"
                            align="center"
                            p={2}
                            bg="bg.subtle"
                            borderRadius="md"
                          >
                            <HStack gap={2}>
                              <Text fontSize="sm">{item.name}</Text>
                              <Tag.Root size="sm" colorPalette="gray" variant="subtle">
                                <Tag.Label>{item.type}</Tag.Label>
                              </Tag.Root>
                              {!hasProjectInfo && (
                                <Tag.Root size="sm" colorPalette="orange" variant="subtle">
                                  <Tag.Label>No project</Tag.Label>
                                </Tag.Root>
                              )}
                            </HStack>
                            {result && (
                              <Icon color={result.success ? 'green.500' : 'red.500'}>
                                {result.success ? <LuCheck /> : <LuX />}
                              </Icon>
                            )}
                          </Flex>
                        );
                      })}
                    </VStack>
                  </Box>

                  {/* Error messages */}
                  {publishResults.some((r) => !r.success) && (
                    <Box>
                      <Text fontSize="sm" color="red.500" fontWeight="medium" mb={1}>
                        Some items failed to publish:
                      </Text>
                      {publishResults
                        .filter((r) => !r.success)
                        .map((r, idx) => (
                          <Text key={idx} fontSize="xs" color="text.secondary">
                            {r.name}: {r.error}
                          </Text>
                        ))}
                    </Box>
                  )}
                </VStack>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {!showCreateForm && workspaces.length > 0 && (
                <Button
                  colorPalette="primary"
                  onClick={handlePublish}
                  disabled={publishing || !selectedWorkspace || items.length === 0}
                >
                  {publishing ? <Spinner size="sm" /> : <LuUpload />}
                  <Text ml={2}>Publish</Text>
                </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
