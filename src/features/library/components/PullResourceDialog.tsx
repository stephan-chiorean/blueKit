import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  Flex,
  HStack,
  Icon,
  Portal,
  Spinner,
  Text,
  VStack,
  Select,
  createListCollection,
  Badge,
} from '@chakra-ui/react';
import {
  LuDownload,
  LuFolder,
  LuCheck,
  LuTriangleAlert,
  LuPackage,
  LuBookOpen,
  LuBot,
  LuNetwork,
} from 'react-icons/lu';
import { LibraryVariation, LibraryCatalog } from '@/types/github';
import { Project, invokeGetProjectRegistry } from '@/ipc';
import { invokePullVariation } from '@/ipc/library';
import { toaster } from '@/shared/components/ui/toaster';

interface PullResourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  variation: LibraryVariation | null;
  catalog: LibraryCatalog | null;
  onPulled?: () => void;
}

const artifactTypeIcon: Record<string, React.ReactNode> = {
  kit: <LuPackage />,
  walkthrough: <LuBookOpen />,
  agent: <LuBot />,
  diagram: <LuNetwork />,
};

const artifactTypeFolderName: Record<string, string> = {
  kit: 'kits',
  walkthrough: 'walkthroughs',
  agent: 'agents',
  diagram: 'diagrams',
};

export default function PullResourceDialog({
  isOpen,
  onClose,
  variation,
  catalog,
  onPulled,
}: PullResourceDialogProps) {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load projects when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadProjects();
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Reset selected project when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProjectId('');
      setSuccess(false);
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const projectList = await invokeGetProjectRegistry();
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Create collection for Select component
  const projectsCollection = useMemo(() => {
    return createListCollection({
      items: projects,
      itemToString: (item) => item.name,
      itemToValue: (item) => item.id,
    });
  }, [projects]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const handleProjectChange = (details: { value: string[] }) => {
    setSelectedProjectId(details.value[0] || '');
    setError(null);
  };

  const handlePull = async () => {
    if (!variation || !selectedProject) {
      return;
    }

    setPulling(true);
    setError(null);

    try {
      await invokePullVariation(
        variation.id,
        selectedProject.id,
        selectedProject.path,
        false // don't overwrite if exists
      );

      setSuccess(true);
      toaster.create({
        type: 'success',
        title: 'Resource pulled',
        description: `Added to ${selectedProject.name}`,
      });

      onPulled?.();
      
      // Close dialog after a short delay to show success
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Pull failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toaster.create({
        type: 'error',
        title: 'Pull failed',
        description: errorMessage,
      });
    } finally {
      setPulling(false);
    }
  };

  // Get target folder path for preview
  const targetFolder = useMemo(() => {
    if (!catalog || !selectedProject) return null;
    const folderName = artifactTypeFolderName[catalog.artifact_type] || catalog.artifact_type;
    return `.bluekit/${folderName}/`;
  }, [catalog, selectedProject]);

  const icon = catalog ? artifactTypeIcon[catalog.artifact_type] || <LuPackage /> : <LuPackage />;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !pulling && !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="460px">
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
                    <LuDownload />
                  </Icon>
                </Flex>
                <Box>
                  <Dialog.Title fontSize="lg" fontWeight="semibold">
                    Pull Resource
                  </Dialog.Title>
                  <Text fontSize="sm" color="text.secondary" mt={0.5}>
                    Add this resource to a project
                  </Text>
                </Box>
              </HStack>
            </Dialog.Header>

            <Dialog.Body py={6}>
              <VStack gap={5} align="stretch">
                {/* Resource Info */}
                {catalog && variation && (
                  <Box
                    p={4}
                    bg="bg.subtle"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <HStack gap={3} mb={2}>
                      <Icon fontSize="lg" color="primary.500">
                        {icon}
                      </Icon>
                      <Text fontWeight="medium">{catalog.name}</Text>
                    </HStack>
                    <HStack gap={2} wrap="wrap">
                      <Badge size="sm" colorPalette="gray">
                        {catalog.artifact_type}
                      </Badge>
                      {variation.version_tag && (
                        <Badge size="sm" colorPalette="primary">
                          {variation.version_tag}
                        </Badge>
                      )}
                    </HStack>
                    {catalog.description && (
                      <Text fontSize="sm" color="text.secondary" mt={2}>
                        {catalog.description}
                      </Text>
                    )}
                  </Box>
                )}

                {/* Project Selection */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Target Project
                  </Text>
                  {loadingProjects ? (
                    <Flex justify="center" py={4}>
                      <Spinner size="sm" />
                    </Flex>
                  ) : projects.length === 0 ? (
                    <Box
                      p={3}
                      bg="orange.50"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="orange.200"
                    >
                      <HStack gap={2}>
                        <Icon fontSize="md" color="orange.500">
                          <LuTriangleAlert />
                        </Icon>
                        <Text fontSize="sm" color="orange.700">
                          No projects available. Create a project first.
                        </Text>
                      </HStack>
                    </Box>
                  ) : (
                    <Select.Root
                      collection={projectsCollection}
                      value={selectedProjectId ? [selectedProjectId] : []}
                      onValueChange={handleProjectChange}
                      disabled={pulling}
                    >
                      <Select.HiddenSelect />
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a project" />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Control>
                      <Portal>
                        <Select.Positioner>
                          <Select.Content maxH="200px" overflowY="auto">
                            {projectsCollection.items.map((project) => (
                              <Select.Item item={project} key={project.id}>
                                <HStack gap={2}>
                                  <Icon fontSize="sm" color="primary.500">
                                    <LuFolder />
                                  </Icon>
                                  <Select.ItemText>{project.name}</Select.ItemText>
                                </HStack>
                                <Select.ItemIndicator />
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Portal>
                    </Select.Root>
                  )}
                </Box>

                {/* Target Folder Preview */}
                {targetFolder && selectedProject && (
                  <Box
                    p={3}
                    bg="bg.muted"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Text fontSize="xs" color="text.tertiary" mb={1}>
                      Will be saved to:
                    </Text>
                    <HStack gap={2}>
                      <Icon fontSize="sm" color="text.secondary">
                        <LuFolder />
                      </Icon>
                      <Text fontSize="sm" fontFamily="mono" color="text.secondary">
                        {selectedProject.path}/{targetFolder}
                      </Text>
                    </HStack>
                  </Box>
                )}

                {/* Success Message */}
                {success && (
                  <Box
                    p={3}
                    bg="green.50"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="green.200"
                  >
                    <HStack gap={2}>
                      <Icon fontSize="md" color="green.500">
                        <LuCheck />
                      </Icon>
                      <Text fontSize="sm" color="green.700">
                        Resource pulled successfully!
                      </Text>
                    </HStack>
                  </Box>
                )}

                {/* Error Message */}
                {error && (
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
                        {error}
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
                  onClick={onClose}
                  disabled={pulling}
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handlePull}
                  disabled={!selectedProject || pulling || success}
                >
                  {pulling ? (
                    <HStack gap={2}>
                      <Spinner size="sm" />
                      <Text>Pulling...</Text>
                    </HStack>
                  ) : success ? (
                    <HStack gap={2}>
                      <LuCheck />
                      <Text>Done</Text>
                    </HStack>
                  ) : (
                    <HStack gap={2}>
                      <LuDownload />
                      <Text>Pull to Project</Text>
                    </HStack>
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

