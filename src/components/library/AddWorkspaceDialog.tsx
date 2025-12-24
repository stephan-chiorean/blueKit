import { useState, useEffect, useMemo } from 'react';
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
  Text,
  VStack,
  Select,
  createListCollection,
} from '@chakra-ui/react';
import { LuGithub, LuCheck, LuTriangleAlert, LuFolder } from 'react-icons/lu';
import { GitHubUser, GitHubRepo, LibraryWorkspace } from '../../types/github';
import { invokeGitHubGetRepos } from '../../ipc/github';
import { invokeLibraryCreateWorkspace } from '../../ipc/library';
import { toaster } from '../ui/toaster';

interface AddWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  githubUser: GitHubUser | null;
  onWorkspaceCreated: (workspace: LibraryWorkspace) => void;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export default function AddWorkspaceDialog({
  isOpen,
  onClose,
  githubUser,
  onWorkspaceCreated,
}: AddWorkspaceDialogProps) {
  // Form state
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  
  // Loading states
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Validation
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load repos when dialog opens
  useEffect(() => {
    if (isOpen && githubUser) {
      loadRepos();
    }
  }, [isOpen, githubUser]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setWorkspaceName('');
      setSelectedRepo('');
      setValidationState('idle');
      setValidationError(null);
    }
  }, [isOpen]);

  // Auto-generate workspace name from repo
  useEffect(() => {
    if (selectedRepo && !workspaceName) {
      const repo = repos.find(r => r.full_name === selectedRepo);
      if (repo) {
        // Convert repo name to title case with spaces
        const name = repo.name
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        setWorkspaceName(name);
      }
    }
  }, [selectedRepo, repos]);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const userRepos = await invokeGitHubGetRepos();
      // Sort by recently pushed
      const sorted = userRepos.sort((a, b) => 
        new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
      );
      setRepos(sorted);
    } catch (error) {
      console.error('Failed to load repos:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to load repositories',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoadingRepos(false);
    }
  };

  // Create collection for Select component
  const reposCollection = useMemo(() => {
    return createListCollection({
      items: repos,
      itemToString: (item) => item.full_name,
      itemToValue: (item) => item.full_name,
    });
  }, [repos]);

  const handleRepoChange = (details: { value: string[] }) => {
    const value = details.value[0] || '';
    setSelectedRepo(value);
    setValidationState('idle');
    setValidationError(null);
  };

  const validateAndCreate = async () => {
    if (!githubUser || !workspaceName.trim() || !selectedRepo) {
      return;
    }

    const repo = repos.find(r => r.full_name === selectedRepo);
    if (!repo) {
      setValidationError('Please select a repository');
      return;
    }

    setCreating(true);
    setValidationState('validating');

    try {
      const workspace = await invokeLibraryCreateWorkspace(
        workspaceName.trim(),
        repo.owner.login,
        repo.name
      );

      setValidationState('valid');
      
      toaster.create({
        type: 'success',
        title: 'Workspace created',
        description: `Created workspace "${workspace.name}"`,
      });

      onWorkspaceCreated(workspace);
      onClose();
    } catch (error) {
      console.error('Failed to create workspace:', error);
      setValidationState('invalid');
      setValidationError(error instanceof Error ? error.message : 'Failed to create workspace');
      
      toaster.create({
        type: 'error',
        title: 'Creation failed',
        description: error instanceof Error ? error.message : 'Failed to create workspace',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    if (!creating) {
      onClose();
    }
  };

  const isFormValid = workspaceName.trim().length > 0 && selectedRepo.length > 0;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !creating && !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="480px">
            <Dialog.Header borderBottomWidth="1px" borderColor="border.subtle" pb={4}>
              <HStack gap={3}>
                <Flex
                  w={10}
                  h={10}
                  bg="primary.50"
                  borderRadius="lg"
                  align="center"
                  justify="center"
                >
                  <Icon fontSize="xl" color="primary.500">
                    <LuFolder />
                  </Icon>
                </Flex>
                <Box>
                  <Dialog.Title fontSize="lg" fontWeight="semibold">
                    Add Library Workspace
                  </Dialog.Title>
                  <Text fontSize="sm" color="text.secondary" mt={0.5}>
                    Connect a GitHub repository to store resources
                  </Text>
                </Box>
              </HStack>
            </Dialog.Header>

            <Dialog.Body py={6}>
              <VStack gap={5} align="stretch">
                {/* GitHub Account Info */}
                <Box
                  p={3}
                  bg="bg.subtle"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="border.subtle"
                >
                  <HStack gap={3}>
                    <Icon fontSize="lg" color="text.secondary">
                      <LuGithub />
                    </Icon>
                    <Box flex={1}>
                      <Text fontSize="sm" fontWeight="medium">
                        {githubUser?.login || 'Not connected'}
                      </Text>
                      <Text fontSize="xs" color="text.tertiary">
                        GitHub Account
                      </Text>
                    </Box>
                    <Icon fontSize="sm" color="green.500">
                      <LuCheck />
                    </Icon>
                  </HStack>
                </Box>

                {/* Repository Selection */}
                <Field.Root>
                  <Field.Label fontWeight="medium">
                    Repository
                  </Field.Label>
                  <Select.Root
                    collection={reposCollection}
                    value={selectedRepo ? [selectedRepo] : []}
                    onValueChange={handleRepoChange}
                    disabled={loadingRepos || creating}
                  >
                    <Select.HiddenSelect />
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select a repository" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        {loadingRepos ? (
                          <Spinner size="sm" />
                        ) : (
                          <Select.Indicator />
                        )}
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content maxH="300px" overflowY="auto">
                          {reposCollection.items.map((repo) => (
                            <Select.Item item={repo} key={repo.id}>
                              <VStack align="start" gap={0} py={1}>
                                <Select.ItemText fontWeight="medium">
                                  {repo.name}
                                </Select.ItemText>
                                <Text fontSize="xs" color="text.tertiary">
                                  {repo.owner.login}/{repo.name}
                                  {repo.private && ' • Private'}
                                </Text>
                              </VStack>
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                  </Select.Root>
                  <Field.HelperText>
                    Resources will be stored in this repository
                  </Field.HelperText>
                </Field.Root>

                {/* Workspace Name */}
                <Field.Root>
                  <Field.Label fontWeight="medium">
                    Workspace Name
                  </Field.Label>
                  <Input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="My Library"
                    disabled={creating}
                  />
                  <Field.HelperText>
                    A friendly name for this workspace
                  </Field.HelperText>
                </Field.Root>

                {/* Validation Error */}
                {validationError && (
                  <Box
                    p={3}
                    bg="red.50"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="red.200"
                  >
                    <HStack gap={2}>
                      <Icon fontSize="md" color="red.500">
                        <LuTriangleAlert />
                      </Icon>
                      <Text fontSize="sm" color="red.700">
                        {validationError}
                      </Text>
                    </HStack>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer borderTopWidth="1px" borderColor="border.subtle" pt={4}>
              <HStack gap={3} justify="flex-end" w="full">
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={validateAndCreate}
                  disabled={!isFormValid || creating}
                >
                  {creating ? (
                    <HStack gap={2}>
                      <Spinner size="sm" />
                      <Text>Creating...</Text>
                    </HStack>
                  ) : (
                    'Create Workspace'
                  )}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

