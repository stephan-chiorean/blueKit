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
  SimpleGrid,
  Badge,
} from '@chakra-ui/react';
import { open } from '@tauri-apps/api/dialog';
import { LuFolderPlus, LuFolder, LuArrowLeft } from 'react-icons/lu';
import { FaGithub } from 'react-icons/fa';
import {
  invokeCreateNewProject,
  invokeDbUpdateProject,
  invokeGetProjectRegistry,
  invokeCloneFromGithub,
  invokeDbCreateProject
} from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: () => void;
}

type ModalStep = 'select-option' | 'new-local' | 'existing-local' | 'clone-repo';

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

/**
 * Validates GitHub owner/repo format
 */
function validateOwnerRepo(value: string): boolean {
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(value);
}

export default function AddProjectDialog({
  isOpen,
  onClose,
  onProjectCreated,
}: AddProjectDialogProps) {
  const { colorMode } = useColorMode();

  // Navigation state
  const [currentStep, setCurrentStep] = useState<ModalStep>('select-option');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New Local Project State
  const [parentPath, setParentPath] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Existing Local Project State
  const [existingPath, setExistingPath] = useState('');
  const [existingProjectName, setExistingProjectName] = useState('');
  const [existingDescription, setExistingDescription] = useState('');

  // Clone Repo State
  const [ownerRepo, setOwnerRepo] = useState('');
  const [cloneTargetPath, setCloneTargetPath] = useState('');
  const [cloneProjectName, setCloneProjectName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all states after animation
      setTimeout(() => {
        setCurrentStep('select-option');
        setParentPath('');
        setProjectName('');
        setDescription('');
        setExistingPath('');
        setExistingProjectName('');
        setExistingDescription('');
        setOwnerRepo('');
        setCloneTargetPath('');
        setCloneProjectName('');
        setCloneDescription('');
        setValidationError(null);
        setIsProcessing(false);
      }, 200);
    }
  }, [isOpen]);

  // Auto-fill project name from path selection
  const handleExistingPathSelect = (path: string) => {
    setExistingPath(path);
    // Extract folder name
    const folderName = path.split(/[/\\]/).pop() || '';
    setExistingProjectName(folderName);
  };

  const handleClonePathSelect = (path: string) => {
    setCloneTargetPath(path);
  };

  const handleDirectorySelect = async (setter: (path: string) => void) => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Directory',
      });

      if (selectedPath && typeof selectedPath === 'string') {
        setter(selectedPath);
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error);
    }
  };

  // --------------------------------------------------------------------------
  // ACTION HANDLERS
  // --------------------------------------------------------------------------

  const handleCreateNewLocal = async () => {
    const validation = validateProjectName(projectName);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid project name');
      return;
    }

    if (!parentPath) {
      setValidationError('Please select a parent directory');
      return;
    }

    setIsProcessing(true);
    setValidationError(null);

    try {
      const projectPath = `${parentPath}/${projectName.trim()}`;
      const createdPath = await invokeCreateNewProject(projectPath, projectName.trim(), []);

      if (description.trim()) {
        const projects = await invokeGetProjectRegistry();
        const newProject = projects.find((p) => p.path === createdPath);
        if (newProject) {
          await invokeDbUpdateProject(newProject.id, undefined, description.trim());
        }
      }

      toaster.create({
        type: 'success',
        title: 'Project created',
        description: `Successfully created "${projectName.trim()}"`,
      });

      onProjectCreated?.();
      onClose();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddExistingLocal = async () => {
    if (!existingPath) {
      setValidationError('Please select the project folder');
      return;
    }

    if (!existingProjectName.trim()) {
      setValidationError('Project name is required');
      return;
    }

    setIsProcessing(true);
    setValidationError(null);

    try {
      // 1. Check if already exists in DB (by path)
      const projects = await invokeGetProjectRegistry();
      const duplicate = projects.find(p => p.path === existingPath);

      if (duplicate) {
        throw new Error('This folder is already registered as a project');
      }

      // 2. Create project entry
      await invokeDbCreateProject(
        existingProjectName.trim(),
        existingPath,
        existingDescription.trim() || undefined
      );

      toaster.create({
        type: 'success',
        title: 'Project Added',
        description: `Successfully added "${existingProjectName.trim()}"`,
      });

      onProjectCreated?.();
      onClose();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to add project');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloneRepo = async () => {
    if (!validateOwnerRepo(ownerRepo)) {
      setValidationError('Invalid repository format. Use "owner/repo"');
      return;
    }

    if (!cloneTargetPath) {
      setValidationError('Please select a parent directory');
      return;
    }

    // Project name is optional for clone (defaults to repo name), but if provided, validate it
    const finalName = cloneProjectName.trim() || ownerRepo.split('/')[1] || 'New Project';
    const validation = validateProjectName(finalName);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid project name');
      return;
    }

    setIsProcessing(true);
    setValidationError(null);

    try {
      const targetDir = `${cloneTargetPath}/${finalName}`;

      await invokeCloneFromGithub(
        ownerRepo,
        targetDir,
        finalName,
        true, // register
        true  // init bluekit
      );

      if (cloneDescription.trim()) {
        // Need to update description after creation
        const projects = await invokeGetProjectRegistry();
        const newProject = projects.find(p => p.path === targetDir);

        if (newProject) {
          await invokeDbUpdateProject(newProject.id, undefined, cloneDescription.trim());
        }
      }

      toaster.create({
        type: 'success',
        title: 'Repository Cloned',
        description: `Successfully cloned "${ownerRepo}"`,
      });

      onProjectCreated?.();
      onClose();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to clone repository');
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // UI COMPONENTS
  // --------------------------------------------------------------------------

  const renderOptionCard = (
    title: string,
    description: string,
    icon: React.ElementType,
    step: ModalStep,
    badge?: string
  ) => (
    <Box
      as="button"
      onClick={() => setCurrentStep(step)}
      p={5}
      borderRadius="xl"
      borderWidth="1px"
      borderColor={colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.100'}
      bg={colorMode === 'dark' ? 'whiteAlpha.50' : 'white'}
      textAlign="left"
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-2px)',
        shadow: 'lg',
        borderColor: 'blue.400',
        bg: colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.50'
      }}
      position="relative"
      overflow="hidden"
    >
      {badge && (
        <Badge
          position="absolute"
          top={3}
          right={3}
          colorPalette="blue"
          variant="solid"
          size="sm"
        >
          {badge}
        </Badge>
      )}
      <VStack align="start" gap={3}>
        <Box
          p={3}
          borderRadius="lg"
          bg={colorMode === 'dark' ? 'blue.900' : 'blue.50'}
          color="blue.400"
        >
          <Icon as={icon} boxSize={6} />
        </Box>
        <Box>
          <Text fontWeight="bold" fontSize="lg" mb={1}>{title}</Text>
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">{description}</Text>
        </Box>
      </VStack>
    </Box>
  );

  const renderValidationError = () => (
    validationError && (
      <Box
        p={3}
        bg="red.50"
        borderWidth="1px"
        borderColor="red.200"
        borderRadius="md"
        _dark={{ bg: 'red.950', borderColor: 'red.800' }}
        mt={4}
      >
        <Text fontSize="sm" color="red.700" _dark={{ color: 'red.300' }}>
          {validationError}
        </Text>
      </Box>
    )
  );

  const renderHeader = (title: string) => (
    <Dialog.Header>
      <HStack>
        {currentStep !== 'select-option' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep('select-option')}
            disabled={isProcessing}
            mr={2}
          >
            <Icon as={LuArrowLeft} />
          </Button>
        )}
        <Dialog.Title>{title}</Dialog.Title>
      </HStack>
    </Dialog.Header>
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && !isProcessing && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW={currentStep === 'select-option' ? '800px' : '500px'}>

            {/* STEP 1: SELECT OPTION */}
            {currentStep === 'select-option' && (
              <>
                {renderHeader('Add Project')}
                <Dialog.Body pb={8}>
                  <Text color="fg.muted" mb={5}>
                    Choose how you want to add a project to your workspace.
                  </Text>

                  <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                    {renderOptionCard(
                      'New Local Project',
                      'Create a brand new empty project directory on your computer.',
                      LuFolderPlus,
                      'new-local'
                    )}
                    {renderOptionCard(
                      'Existing Folder',
                      'Import an existing folder from your computer into BlueKit.',
                      LuFolder,
                      'existing-local'
                    )}
                    {renderOptionCard(
                      'Clone Repository',
                      'Clone a GitHub repository and set it up as a project.',
                      FaGithub,
                      'clone-repo',
                      'Git'
                    )}
                  </SimpleGrid>
                </Dialog.Body>
              </>
            )}

            {/* STEP 2: NEW LOCAL PROJECT */}
            {currentStep === 'new-local' && (
              <>
                {renderHeader('New Local Project')}
                <Dialog.Body>
                  <VStack gap={4} align="stretch">
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Parent Directory</Text>
                      <HStack gap={2}>
                        <Input value={parentPath} placeholder="Select folder..." readOnly flex={1} />
                        <Button variant="outline" onClick={() => handleDirectorySelect(setParentPath)} disabled={isProcessing}>
                          Browse
                        </Button>
                      </HStack>
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Project Name</Text>
                      <Input
                        value={projectName}
                        onChange={(e) => {
                          setProjectName(e.target.value);
                          setValidationError(null);
                        }}
                        placeholder="My New Project"
                        disabled={isProcessing}
                        autoFocus
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Description (Optional)</Text>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description..."
                        disabled={isProcessing}
                      />
                    </Box>
                    {parentPath && projectName && (
                      <Box p={3} bg="bg.subtle" borderRadius="md" borderWidth="1px" borderColor="border.subtle">
                        <Text fontSize="xs" color="fg.muted">Will create:</Text>
                        <Text fontSize="sm" fontFamily="mono">{parentPath}/{projectName}</Text>
                      </Box>
                    )}
                    {renderValidationError()}
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="ghost" onClick={() => setCurrentStep('select-option')} disabled={isProcessing}>Cancel</Button>
                  <Button
                    onClick={handleCreateNewLocal}
                    loading={isProcessing}
                    disabled={!projectName || !parentPath}
                    colorPalette="primary"
                  >
                    Create Project
                  </Button>
                </Dialog.Footer>
              </>
            )}

            {/* STEP 2: EXISTING LOCAL PROJECT */}
            {currentStep === 'existing-local' && (
              <>
                {renderHeader('Import Existing Project')}
                <Dialog.Body>
                  <VStack gap={4} align="stretch">
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Project Folder</Text>
                      <HStack gap={2}>
                        <Input value={existingPath} placeholder="Select existing project folder..." readOnly flex={1} />
                        <Button variant="outline" onClick={() => handleDirectorySelect(handleExistingPathSelect)} disabled={isProcessing}>
                          Browse
                        </Button>
                      </HStack>
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Project Name</Text>
                      <Input
                        value={existingProjectName}
                        onChange={(e) => setExistingProjectName(e.target.value)}
                        placeholder="Project Name"
                        disabled={isProcessing}
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Description (Optional)</Text>
                      <Input
                        value={existingDescription}
                        onChange={(e) => setExistingDescription(e.target.value)}
                        placeholder="Brief description..."
                        disabled={isProcessing}
                      />
                    </Box>
                    {renderValidationError()}
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="ghost" onClick={() => setCurrentStep('select-option')} disabled={isProcessing}>Cancel</Button>
                  <Button
                    onClick={handleAddExistingLocal}
                    loading={isProcessing}
                    disabled={!existingPath || !existingProjectName}
                    colorPalette="primary"
                  >
                    Import Project
                  </Button>
                </Dialog.Footer>
              </>
            )}

            {/* STEP 2: CLONE REPO */}
            {currentStep === 'clone-repo' && (
              <>
                {renderHeader('Clone Repository')}
                <Dialog.Body>
                  <VStack gap={4} align="stretch">
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>GitHub Owner/Repo</Text>
                      <Input
                        value={ownerRepo}
                        onChange={(e) => {
                          setOwnerRepo(e.target.value);
                          setValidationError(null);
                          // Auto fill name if empty
                          if (e.target.value.includes('/')) {
                            const repo = e.target.value.split('/')[1];
                            if (repo && !cloneProjectName) setCloneProjectName(repo);
                          }
                        }}
                        placeholder="facebook/react"
                        disabled={isProcessing}
                        autoFocus
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Clone To (Parent Directory)</Text>
                      <HStack gap={2}>
                        <Input value={cloneTargetPath} placeholder="Select destination folder..." readOnly flex={1} />
                        <Button variant="outline" onClick={() => handleDirectorySelect(handleClonePathSelect)} disabled={isProcessing}>
                          Browse
                        </Button>
                      </HStack>
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Project Name</Text>
                      <Input
                        value={cloneProjectName}
                        onChange={(e) => setCloneProjectName(e.target.value)}
                        placeholder="Project Name"
                        disabled={isProcessing}
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Description (Optional)</Text>
                      <Input
                        value={cloneDescription}
                        onChange={(e) => setCloneDescription(e.target.value)}
                        placeholder="Brief description..."
                        disabled={isProcessing}
                      />
                    </Box>
                    {cloneTargetPath && cloneProjectName && (
                      <Box p={3} bg="bg.subtle" borderRadius="md" borderWidth="1px" borderColor="border.subtle">
                        <Text fontSize="xs" color="fg.muted">Will clone to:</Text>
                        <Text fontSize="sm" fontFamily="mono">{cloneTargetPath}/{cloneProjectName}</Text>
                      </Box>
                    )}
                    {renderValidationError()}
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="ghost" onClick={() => setCurrentStep('select-option')} disabled={isProcessing}>Cancel</Button>
                  <Button
                    onClick={handleCloneRepo}
                    loading={isProcessing}
                    disabled={!ownerRepo || !cloneTargetPath}
                    colorPalette="primary"
                  >
                    Clone Repository
                  </Button>
                </Dialog.Footer>
              </>
            )}

          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
