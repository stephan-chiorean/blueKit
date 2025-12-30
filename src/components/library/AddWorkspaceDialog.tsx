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
} from '@chakra-ui/react';
import { LuGithub, LuCheck, LuTriangleAlert, LuFolder, LuUserPlus, LuX } from 'react-icons/lu';
import { GitHubUser, LibraryWorkspace } from '../../types/github';
import { invokeLibraryCreateWorkspace } from '../../ipc/library';
import { toaster } from '../ui/toaster';

interface AddWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  githubUser: GitHubUser | null;
  onWorkspaceCreated: (workspace: LibraryWorkspace) => void;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

interface Collaborator {
  login: string;
  avatar_url: string;
}

/**
 * Generates a valid GitHub repository name from a workspace name.
 * Converts to lowercase, replaces spaces with hyphens, and removes invalid characters.
 */
function generateRepoName(workspaceName: string): string {
  return workspaceName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove invalid characters
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

export default function AddWorkspaceDialog({
  isOpen,
  onClose,
  githubUser,
  onWorkspaceCreated,
}: AddWorkspaceDialogProps) {
  // Form state
  const [workspaceName, setWorkspaceName] = useState('');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  
  // Loading states
  const [creating, setCreating] = useState(false);
  
  // Validation
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Generate repo name from workspace name
  const generatedRepoName = useMemo(() => {
    if (!workspaceName.trim()) return '';
    return generateRepoName(workspaceName);
  }, [workspaceName]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setWorkspaceName('');
      setCollaborators([]);
      setValidationState('idle');
      setValidationError(null);
    }
  }, [isOpen]);

  const handleAddCollaborator = () => {
    // TODO: Implement collaborator search and selection
    // For now, this is a placeholder
    toaster.create({
      type: 'info',
      title: 'Coming soon',
      description: 'Collaborator management will be available soon',
    });
  };

  const handleRemoveCollaborator = (login: string) => {
    setCollaborators(prev => prev.filter(c => c.login !== login));
  };

  const validateAndCreate = async () => {
    if (!githubUser || !workspaceName.trim()) {
      return;
    }

    if (!generatedRepoName) {
      setValidationError('Please enter a valid workspace name');
      return;
    }

    setCreating(true);
    setValidationState('validating');

    try {
      const workspace = await invokeLibraryCreateWorkspace(
        workspaceName.trim(),
        githubUser.login,
        generatedRepoName
      );

      setValidationState('valid');
      
      toaster.create({
        type: 'success',
        title: 'Workspace created',
        description: `Created workspace "${workspace.name}" and repository "${generatedRepoName}"`,
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

  const isFormValid = workspaceName.trim().length > 0 && generatedRepoName.length > 0;

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
                        Repository will be created in this account
                      </Text>
                    </Box>
                    <Icon fontSize="sm" color="green.500">
                      <LuCheck />
                    </Icon>
                  </HStack>
                </Box>

                {/* Workspace Name */}
                <Field.Root>
                  <Field.Label fontWeight="medium">
                    Workspace Name
                  </Field.Label>
                  <Input
                    value={workspaceName}
                    onChange={(e) => {
                      setWorkspaceName(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="My Library"
                    disabled={creating}
                  />
                  <Field.HelperText>
                    A friendly name for this workspace
                  </Field.HelperText>
                </Field.Root>

                {/* Generated Repository Name */}
                <Field.Root>
                  <Field.Label fontWeight="medium">
                    Repository Name
                  </Field.Label>
                  <Input
                    value={generatedRepoName ? `${githubUser?.login || ''}/${generatedRepoName}` : ''}
                    placeholder="username/repository-name"
                    disabled
                    bg="bg.subtle"
                    color="text.secondary"
                  />
                  <Field.HelperText>
                    This repository will be created automatically
                  </Field.HelperText>
                </Field.Root>

                {/* Collaborators Section */}
                <Field.Root>
                  <Field.Label fontWeight="medium">
                    Collaborators
                  </Field.Label>
                  <VStack align="stretch" gap={3}>
                    {collaborators.length > 0 && (
                      <VStack align="stretch" gap={2}>
                        {collaborators.map((collab) => (
                          <Box
                            key={collab.login}
                            p={2}
                            bg="bg.subtle"
                            borderRadius="md"
                            borderWidth="1px"
                            borderColor="border.subtle"
                          >
                            <HStack gap={2} justify="space-between">
                              <HStack gap={2}>
                                <Box
                                  as="img"
                                  src={collab.avatar_url}
                                  alt={collab.login}
                                  w={6}
                                  h={6}
                                  borderRadius="full"
                                />
                                <Text fontSize="sm" fontWeight="medium">
                                  {collab.login}
                                </Text>
                              </HStack>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => handleRemoveCollaborator(collab.login)}
                                disabled={creating}
                              >
                                <Icon>
                                  <LuX />
                                </Icon>
                              </Button>
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleAddCollaborator}
                      disabled={creating}
                      leftIcon={<LuUserPlus />}
                    >
                      Add Collaborator
                    </Button>
                  </VStack>
                  <Field.HelperText>
                    Add team members who can access this workspace
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

