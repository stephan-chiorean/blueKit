import { useState, useEffect } from 'react';
import {
  Dialog,
  Portal,
  Button,
  VStack,
  HStack,
  Input,
  Text,
  Box,
  Icon,
} from '@chakra-ui/react';
import { open } from '@tauri-apps/api/dialog';
import { LuFolder } from 'react-icons/lu';
import { invokeCreateNewProject, invokeDbUpdateProject, invokeGetProjectRegistry } from '../../ipc';
import { toaster } from '../ui/toaster';

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: () => void;
}

/**
 * Validates a project name to ensure it doesn't contain invalid filesystem characters.
 */
function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Project name is required' };
  }

  // Invalid filesystem characters: / \ : * ? " < > |
  const invalidChars = /[\/\\:*?"<>|]/;
  if (invalidChars.test(name)) {
    return {
      valid: false,
      error: 'Project name cannot contain: / \\ : * ? " < > |',
    };
  }

  // Check for leading/trailing spaces or dots (Windows issue)
  if (name.trim() !== name) {
    return {
      valid: false,
      error: 'Project name cannot have leading or trailing spaces',
    };
  }

  if (name.endsWith('.')) {
    return {
      valid: false,
      error: 'Project name cannot end with a dot',
    };
  }

  return { valid: true };
}

export default function AddProjectDialog({
  isOpen,
  onClose,
  onProjectCreated,
}: AddProjectDialogProps) {
  const [parentPath, setParentPath] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setParentPath('');
      setProjectName('');
      setDescription('');
      setValidationError(null);
    }
  }, [isOpen]);

  const handleSelectDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select parent directory for new project',
      });

      if (selectedPath && typeof selectedPath === 'string') {
        setParentPath(selectedPath);
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: 'Failed to open directory picker',
      });
    }
  };

  const handleCreate = async () => {
    // Validate project name
    const validation = validateProjectName(projectName);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid project name');
      return;
    }

    if (!parentPath) {
      setValidationError('Please select a parent directory');
      return;
    }

    setIsCreating(true);
    setValidationError(null);

    try {
      // Construct full project path
      const projectPath = `${parentPath}/${projectName.trim()}`;

      // Create project (automatically registers in database)
      // The returned path is the normalized absolute path that was stored
      const createdPath = await invokeCreateNewProject(projectPath, projectName.trim(), []);

      // If user provided a description, update it
      if (description.trim()) {
        // Get the newly created project to get its ID
        // Use the returned path to ensure exact match
        const projects = await invokeGetProjectRegistry();
        const newProject = projects.find((p) => p.path === createdPath);

        if (newProject) {
          await invokeDbUpdateProject(newProject.id, undefined, description.trim());
        } else {
          console.warn(`Could not find newly created project at path: ${createdPath}`);
        }
      }

      toaster.create({
        type: 'success',
        title: 'Project created',
        description: `Successfully created project "${projectName.trim()}"`,
      });

      // Reset form
      setParentPath('');
      setProjectName('');
      setDescription('');
      setValidationError(null);

      // Notify parent to reload projects
      onProjectCreated?.();
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create project';
      console.error('Failed to create project:', error);
      setValidationError(errorMessage);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      onClose();
    }
  };

  const fullPath = parentPath && projectName.trim() 
    ? `${parentPath}/${projectName.trim()}`
    : '';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header>
              <Dialog.Title>Create New Project</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} align="stretch">
                {/* Parent Directory Selection */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Parent Directory
                  </Text>
                  <HStack gap={2}>
                    <Input
                      value={parentPath}
                      placeholder="Select parent directory..."
                      readOnly
                      flex={1}
                    />
                    <Button
                      variant="outline"
                      onClick={handleSelectDirectory}
                      disabled={isCreating}
                    >
                      <HStack gap={2}>
                        <Icon>
                          <LuFolder />
                        </Icon>
                        <Text>Browse</Text>
                      </HStack>
                    </Button>
                  </HStack>
                </Box>

                {/* Project Name */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Project Name
                  </Text>
                  <Input
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="Enter project name"
                    disabled={isCreating}
                    autoFocus
                  />
                </Box>

                {/* Description */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Description (optional)
                  </Text>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter project description"
                    disabled={isCreating}
                  />
                </Box>

                {/* Full Path Preview */}
                {fullPath && (
                  <Box
                    p={3}
                    bg="bg.subtle"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Text fontSize="xs" color="fg.muted" mb={1}>
                      Project will be created at:
                    </Text>
                    <Text fontSize="sm" fontFamily="mono" color="fg.default">
                      {fullPath}
                    </Text>
                  </Box>
                )}

                {/* Validation Error */}
                {validationError && (
                  <Box
                    p={3}
                    bg="red.50"
                    borderWidth="1px"
                    borderColor="red.200"
                    borderRadius="md"
                    _dark={{ bg: 'red.950', borderColor: 'red.800' }}
                  >
                    <Text fontSize="sm" color="red.700" _dark={{ color: 'red.300' }}>
                      {validationError}
                    </Text>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" disabled={isCreating}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button
                onClick={handleCreate}
                loading={isCreating}
                disabled={!projectName.trim() || !parentPath || isCreating}
                colorPalette="primary"
              >
                Create Project
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

