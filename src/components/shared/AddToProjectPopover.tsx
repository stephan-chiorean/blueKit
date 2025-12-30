import { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Button,
  VStack,
  HStack,
  Text,
  Box,
  Spinner,
  Input,
  InputGroup,
  Icon,
  Flex,
  Portal,
} from '@chakra-ui/react';
import { LuSearch, LuCheck, LuFolder, LuFolderOpen, LuPlus } from 'react-icons/lu';
import { open } from '@tauri-apps/api/dialog';
import { Project, invokeGetProjectRegistry, invokeCopyKitToProject, invokeCopyWalkthroughToProject, invokeCopyDiagramToProject, invokeCreateNewProject } from '../../ipc';
import { toaster } from '../ui/toaster';

export type ArtifactType = 'kit' | 'walkthrough' | 'diagram' | 'agent';

interface AddToProjectPopoverProps {
  onConfirm: (selectedProjects: Project[]) => Promise<void>;
  itemCount: number;
  trigger: React.ReactNode;
  sourceFiles: Array<{ path: string; name: string; type: ArtifactType }>;
}

export default function AddToProjectPopover({
  onConfirm,
  itemCount,
  trigger,
  sourceFiles,
}: AddToProjectPopoverProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load projects when menu opens
  useEffect(() => {
    if (isOpen) {
      loadProjects();
      setSelectedProjectIds(new Set());
      setSearchQuery('');
      // Focus search input after a brief delay to allow menu to render
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const registryProjects = await invokeGetProjectRegistry();
      setProjects(registryProjects);
    } catch (error) {
      console.error('[AddToProjectPopover] Error loading projects:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: `Failed to load projects: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedProjectIds.size === 0) {
      toaster.create({
        type: 'warning',
        title: 'No projects selected',
        description: 'Please select at least one project to add items to.',
      });
      return;
    }

    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    
    try {
      setCopying(true);
      await onConfirm(selectedProjects);
      setSelectedProjectIds(new Set());
      setIsOpen(false);
    } catch (error) {
      console.error('[AddToProjectPopover] Error confirming:', error);
      // Error handling is done in the parent component
    } finally {
      setCopying(false);
    }
  };

  const handleBrowse = async () => {
    try {
      setCopying(true);

      // Open directory picker
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: `Select directory to add ${itemCount} artifact${itemCount !== 1 ? 's' : ''}`,
      });

      if (!selectedPath || typeof selectedPath !== 'string') {
        // User cancelled
        setCopying(false);
        return;
      }

      // Copy each file to the selected directory based on its type
      const copyPromises: Promise<void>[] = [];
      for (const file of sourceFiles) {
        let copyPromise: Promise<string>;

        if (file.type === 'kit') {
          copyPromise = invokeCopyKitToProject(file.path, selectedPath);
        } else if (file.type === 'walkthrough') {
          copyPromise = invokeCopyWalkthroughToProject(file.path, selectedPath);
        } else if (file.type === 'diagram') {
          copyPromise = invokeCopyDiagramToProject(file.path, selectedPath);
        } else {
          // agent type - TODO: implement invokeCopyAgentToProject
          console.warn(`[AddToProjectPopover] Skipping agent ${file.name} - not yet implemented`);
          continue;
        }

        copyPromises.push(
          copyPromise
            .then(() => {
              // Success
            })
            .catch((error) => {
              console.error(`[AddToProjectPopover] Error copying ${file.name} to ${selectedPath}:`, error);
              throw error;
            })
        );
      }

      await Promise.all(copyPromises);

      toaster.create({
        type: 'success',
        title: 'Items added',
        description: `Added ${itemCount} artifact${itemCount !== 1 ? 's' : ''} to ${selectedPath}`,
      });

      setIsOpen(false);
    } catch (error) {
      console.error('[AddToProjectPopover] Error in Browse:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: `Failed to add items: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    } finally {
      setCopying(false);
    }
  };

  const handleNewProject = async () => {
    try {
      setCopying(true);

      // First, open directory picker to select parent directory
      const parentPath = await open({
        directory: true,
        multiple: false,
        title: 'Select parent directory for new project',
      });

      if (!parentPath || typeof parentPath !== 'string') {
        // User cancelled
        setCopying(false);
        return;
      }

      // Generate project name from first item
      const firstItem = sourceFiles[0];
      const projectName = firstItem.name || 'new-project';
      const projectPath = `${parentPath}/${projectName}`;

      // Prepare source files with their types
      const filesWithTypes: Array<[string, string]> = sourceFiles.map(file => [
        file.path,
        file.type
      ]);

      // Create new project
      const createdPath = await invokeCreateNewProject(
        projectPath,
        projectName,
        filesWithTypes,
        true // Register project automatically
      );

      toaster.create({
        type: 'success',
        title: 'Project created',
        description: `Created new project "${projectName}" with ${itemCount} artifact${itemCount !== 1 ? 's' : ''} at ${createdPath}`,
      });

      setIsOpen(false);
    } catch (error) {
      console.error('[AddToProjectPopover] Error in New Project:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: `Failed to create project: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    } finally {
      setCopying(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    (project.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (project.path?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  // Helper function to truncate path from the beginning, showing the end
  const truncatePath = (path: string, maxLength: number = 40): string => {
    if (path.length <= maxLength) return path;
    return `...${path.slice(-(maxLength - 3))}`;
  };

  return (
    <Menu.Root 
      closeOnSelect={false}
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
    >
      <Menu.Trigger asChild>
        {trigger}
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner zIndex={2000}>
          <Menu.Content width="400px" maxH="500px" position="relative" zIndex={2000}>
          {/* Header */}
          <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
            <Flex justify="space-between" align="center" gap={2}>
              <Text fontSize="sm" fontWeight="semibold">
                Add to Project
              </Text>
              <HStack gap={1}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBrowse();
                  }}
                  disabled={copying}
                >
                  <HStack gap={1}>
                    <Icon>
                      <LuFolderOpen />
                    </Icon>
                    <Text>Browse</Text>
                  </HStack>
                </Button>
                <Button
                  variant="solid"
                  colorPalette="blue"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewProject();
                  }}
                  disabled={copying}
                >
                  <HStack gap={1}>
                    <Icon>
                      <LuPlus />
                    </Icon>
                    <Text>New</Text>
                  </HStack>
                </Button>
              </HStack>
            </Flex>
          </Box>

          {/* Search Input */}
          <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
            <InputGroup startElement={<LuSearch />}>
              <Input
                ref={searchInputRef}
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </InputGroup>
          </Box>

          {/* Project List */}
          <Box maxH="300px" overflowY="auto">
            {loading ? (
              <Box textAlign="center" py={4}>
                <Spinner size="sm" />
                <Text mt={2} fontSize="sm" color="text.secondary">
                  Loading projects...
                </Text>
              </Box>
            ) : filteredProjects.length === 0 ? (
              <Box textAlign="center" py={4} px={3}>
                <Text fontSize="sm" color="text.secondary">
                  {searchQuery ? 'No projects match your search.' : 'No projects found. Projects are managed via CLI and will appear here automatically.'}
                </Text>
              </Box>
            ) : (
              filteredProjects.map((project) => {
                const isSelected = selectedProjectIds.has(project.id);
                return (
                  <Menu.Item
                    key={project.id}
                    value={project.id}
                    onSelect={() => {
                      toggleProject(project.id);
                    }}
                  >
                    <HStack gap={2} justify="space-between" width="100%" minW={0}>
                      <HStack gap={2} flex="1" minW={0} overflow="hidden">
                        <Icon flexShrink={0}>
                          <LuFolder />
                        </Icon>
                        <VStack align="start" gap={0} flex="1" minW={0} overflow="hidden">
                          <Text fontSize="sm" fontWeight="medium" lineClamp={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" width="100%">
                            {project.name}
                          </Text>
                          <Text fontSize="xs" color="text.secondary" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" width="100%" title={project.path}>
                            {truncatePath(project.path, 35)}
                          </Text>
                        </VStack>
                      </HStack>
                      {isSelected && (
                        <Icon color="primary.500" flexShrink={0}>
                          <LuCheck />
                        </Icon>
                      )}
                    </HStack>
                  </Menu.Item>
                );
              })
            )}
          </Box>

          {/* Footer with Confirm Button */}
          <Box 
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            px={3} 
            py={2} 
            borderTopWidth="1px" 
            borderColor="border.subtle"
            bg="bg.panel"
            boxShadow="lg"
            opacity={selectedProjectIds.size > 0 ? 1 : 0}
            transform={selectedProjectIds.size > 0 ? 'translateY(0)' : 'translateY(100%)'}
            transition="opacity 0.2s ease-out, transform 0.2s ease-out"
            pointerEvents={selectedProjectIds.size > 0 ? 'auto' : 'none'}
            zIndex={10}
          >
            <Button
              variant="solid"
              colorPalette="primary"
              size="sm"
              width="100%"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirm();
              }}
              disabled={copying}
            >
              {copying ? (
                <HStack gap={2}>
                  <Spinner size="xs" />
                  <Text>Adding...</Text>
                </HStack>
              ) : (
                `Add to ${selectedProjectIds.size} Project${selectedProjectIds.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </Box>
        </Menu.Content>
      </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

