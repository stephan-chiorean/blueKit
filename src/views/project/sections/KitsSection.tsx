import { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import {
  Box,
  Heading,
  Flex,
  Text,
  Icon,
  HStack,
  VStack,
  Button,
  Badge,
  Menu,
} from '@chakra-ui/react';
import { createPortal } from 'react-dom';
import { LuFilter, LuFolderPlus, LuPackage, LuArrowRight, LuX, LuTrash2, LuShare, LuPlus } from 'react-icons/lu';
import {
  ArtifactFile,
  ArtifactFolder,
  FolderConfig,
  Project,
  invokeGetArtifactFolders,
  invokeCreateArtifactFolder,
  invokeDeleteArtifactFolder,
  deleteResources,
  invokeCopyKitToProject,
  invokeCopyWalkthroughToProject,
  invokeCopyDiagramToProject,
} from '@/ipc';
import { invokeMoveArtifactToFolder } from '@/ipc/folders';
import { ToolkitHeader } from '@/shared/components/ToolkitHeader';
import GroupView from '@/shared/components/GroupView';
import { CreateFolderPopover } from '@/shared/components/CreateFolderPopover';
import DeleteFolderDialog from '@/shared/components/DeleteFolderDialog';
import { FilterPanel } from '@/shared/components/FilterPanel';
import { getRootArtifacts } from '@/shared/utils/buildFolderTree';
import { toaster } from '@/shared/components/ui/toaster';
import { ElegantList } from '@/shared/components/ElegantList';
import ResourceSelectionFooter from './components/ResourceSelectionFooter';
import AddToProjectDialog from './components/AddToProjectDialog';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

// Drag state for kit/folder movement
interface DragState {
  draggedKit: ArtifactFile;
  dropTargetFolderId: string | null | undefined; // null = root, undefined = invalid area
  isValidDrop: boolean;
  startPosition: { x: number; y: number };
}

// Constants for drag behavior
const DRAG_THRESHOLD = 5; // pixels before drag activates

interface KitsSectionProps {
  kits: ArtifactFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  projectPath: string;
  projectId?: string;
  onViewKit: (kit: ArtifactFile) => void;
  projects?: Project[];
  onReload?: () => void;
  onOptimisticMove?: (artifactId: string, folderId: string | null) => void;
  onConfirmMove?: (oldPath: string, newPath: string) => void; // Unused in this file but ensuring type safety
  movingArtifacts?: Set<string>;
}

function KitsSection({
  kits,
  kitsLoading,
  error,
  projectsCount,
  projectPath,
  projectId,
  onViewKit,
  projects = [],
  onReload,
  onOptimisticMove,
}: KitsSectionProps) {
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Local selection state
  const [selectedKitIds, setSelectedKitIds] = useState<Set<string>>(new Set());

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [isFoldersLoading, setIsFoldersLoading] = useState(true);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [viewingFolder, setViewingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);

  // Color mode for drag styling
  const { colorMode } = useColorMode();


  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    setSelectedKitIds(newSelectedIds);
  };

  const clearSelection = () => setSelectedKitIds(new Set());

  // Clear selection on mount/unmount or projectId change
  useEffect(() => {
    clearSelection();
  }, [projectId]);

  // Actions
  const [isKitsLoading, setIsKitsLoading] = useState(false);
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hasDragThresholdMet, setHasDragThresholdMet] = useState(false);
  const [justFinishedDragging, setJustFinishedDragging] = useState(false);

  const handleDelete = async () => {
    const selectedKits = kits.filter(k => selectedKitIds.has(k.path));
    if (selectedKits.length === 0) return;

    const confirmMessage = `Delete ${selectedKits.length} kit${selectedKits.length !== 1 ? 's' : ''}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setIsKitsLoading(true);
    try {
      const filePaths = selectedKits.map(k => k.path);
      await deleteResources(filePaths);

      toaster.create({
        type: 'success',
        title: 'Kits deleted',
        description: `Deleted ${selectedKits.length} kit${selectedKits.length !== 1 ? 's' : ''}`,
      });

      clearSelection();
      onReload?.();
    } catch (error) {
      console.error('Failed to delete kits:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete kits',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsKitsLoading(false);
    }
  };

  const handlePublish = () => {
    clearSelection();
  };

  const handleAddToProjects = async (selectedProjects: Project[]) => {
    const selectedKits = kits.filter(k => selectedKitIds.has(k.path));
    if (selectedKits.length === 0 || selectedProjects.length === 0) return;

    setIsKitsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const project of selectedProjects) {
        for (const kit of selectedKits) {
          try {
            const artifactType = kit.frontMatter?.type || 'kit';

            if (artifactType === 'walkthrough') {
              await invokeCopyWalkthroughToProject(kit.path, project.path);
            } else if (artifactType === 'diagram') {
              await invokeCopyDiagramToProject(kit.path, project.path);
            } else {
              await invokeCopyKitToProject(kit.path, project.path);
            }

            successCount++;
          } catch (err) {
            console.error(`Failed to copy ${kit.name} to ${project.name}:`, err);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        toaster.create({
          type: 'success',
          title: 'Add complete',
          description: `Added ${successCount} kit${successCount !== 1 ? 's' : ''} to ${selectedProjects.length} project${selectedProjects.length !== 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });
      } else if (errorCount > 0) {
        toaster.create({
          type: 'error',
          title: 'Add failed',
          description: `Failed to add ${errorCount} kit${errorCount !== 1 ? 's' : ''}`,
        });
      }

      clearSelection();
    } finally {
      setIsKitsLoading(false);
    }
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    kits.forEach(kit => {
      kit.frontMatter?.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [kits]);

  // Filter kits based on name and selected tags
  const filteredKits = useMemo(() => {
    return kits.filter(kit => {
      // Basic text search on name or alias
      const displayName = kit.frontMatter?.alias || kit.name;
      const matchesName = !nameFilter ||
        displayName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        kit.name.toLowerCase().includes(nameFilter.toLowerCase());

      // Filter by selected tags (AND logic - must have at least one of selected tags? OR logic usually better for tags)
      // Implementing OR logic: if any selected tag matches any of kit's tags
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(selectedTag =>
          kit.frontMatter?.tags?.some(tag =>
            tag.toLowerCase() === selectedTag.toLowerCase()
          )
        );

      return matchesName && matchesTags;
    });
  }, [kits, nameFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  // Load folders from backend
  useEffect(() => {
    const loadFolders = async () => {
      try {
        setIsFoldersLoading(true);
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'kits');
        setFolders(loadedFolders);
      } catch (err) {
        console.error('[KitsFolders] ❌ Failed to load folders:', err);
      } finally {
        setIsFoldersLoading(false);
      }
    };

    // Load folders immediately when dependencies change
    loadFolders();

    return () => { };
  }, [projectPath, kits]); // Reload when kits change

  // Get artifacts for a specific folder
  const getFolderArtifacts = (folderPath: string): ArtifactFile[] => {
    return kits.filter(k => k.path.startsWith(folderPath + '/'));
  };

  const handleCreateFolder = async (name: string, config: Partial<FolderConfig>) => {
    const fullConfig: FolderConfig = {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`, // Generate ID
      name: config.name || name,
      description: config.description,
      tags: config.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await invokeCreateArtifactFolder(projectPath, 'kits', null, name, fullConfig);
      // Reload folders
      const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
      setFolders(newFolders);
    } catch (err) {
      console.error('Failed to create folder:', err);
      throw err;
    }
  };

  const handleDeleteFolder = (folder: ArtifactFolder) => {
    setDeletingFolder(folder);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;

    try {
      await invokeDeleteArtifactFolder(deletingFolder.path);
      toaster.create({
        type: 'success',
        title: 'Group deleted',
        description: `Deleted ${deletingFolder.name}`,
      });
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete group',
        description: error instanceof Error ? error.message : 'Unknown error',
        closable: true,
      });
    }
  };

  // Ref for filter button
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Get root-level kits
  const rootKits = useMemo(() => {
    return getRootArtifacts(filteredKits, folders, 'kits', projectPath);
  }, [filteredKits, folders, projectPath]);

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, _kit: ArtifactFile) => {
    e.preventDefault();
    // Context menu logic if needed, or pass prop to ElegantList to handle it
  };

  // Wrapper for onViewKit that prevents opening after drag
  const handleViewKit = (kit: ArtifactFile) => {
    if (justFinishedDragging) return;
    onViewKit(kit);
  };

  // Drag handlers
  const handleDragStart = useCallback((kit: ArtifactFile, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    e.stopPropagation();

    setDragState({
      draggedKit: kit,
      dropTargetFolderId: undefined,
      isValidDrop: false,
      startPosition: { x: e.clientX, y: e.clientY },
    });
    setMousePosition({ x: e.clientX, y: e.clientY });
    setHasDragThresholdMet(false);
  }, []);

  const clearDragState = useCallback(() => {
    setDragState(null);
    setHasDragThresholdMet(false);
  }, []);

  // Find drop target at cursor position
  const findDropTargetAtPosition = useCallback((x: number, y: number): string | null | undefined => {
    const elements = document.elementsFromPoint(x, y);

    for (const el of elements) {
      const droppableEl = (el as HTMLElement).closest('[data-droppable-folder-id]');
      if (droppableEl) {
        const folderId = droppableEl.getAttribute('data-droppable-folder-id');
        return folderId; // folder ID
      }
    }

    return undefined; // Not a valid drop area
  }, []);

  // Perform move operation
  const performMove = useCallback(async (kit: ArtifactFile, targetFolderId: string | null | undefined) => {
    if (targetFolderId === undefined) return;

    try {
      const targetFolder = folders.find(f => (f.config?.id || f.path) === targetFolderId);
      if (!targetFolder) return;

      // Optimistic update
      onOptimisticMove?.(kit.path, targetFolder.path);

      await invokeMoveArtifactToFolder(kit.path, targetFolder.path);

      toaster.create({
        type: 'success',
        title: 'Kit moved',
        description: `Moved "${kit.frontMatter?.alias || kit.name}" to ${targetFolder.name}`,
      });

      onReload?.();
    } catch (error) {
      console.error('Failed to move kit:', error);
      toaster.create({
        type: 'error',
        title: 'Move failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, [folders, onReload, onOptimisticMove]);

  // Document-level mouse event handlers for drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });

      // Check drag threshold
      if (!hasDragThresholdMet) {
        const dx = Math.abs(e.clientX - dragState.startPosition.x);
        const dy = Math.abs(e.clientY - dragState.startPosition.y);
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          setHasDragThresholdMet(true);
        }
        return;
      }

      // Find drop target at cursor position
      const dropTarget = findDropTargetAtPosition(e.clientX, e.clientY);
      const isValid = dropTarget !== undefined;

      setDragState(prev => prev ? {
        ...prev,
        dropTargetFolderId: dropTarget,
        isValidDrop: isValid
      } : null);
    };

    const handleMouseUp = async () => {
      const wasDragging = hasDragThresholdMet;

      if (hasDragThresholdMet && dragState.isValidDrop && dragState.dropTargetFolderId !== undefined) {
        await performMove(dragState.draggedKit, dragState.dropTargetFolderId);
      }

      clearDragState();

      // Prevent click event from firing after drag
      if (wasDragging) {
        setJustFinishedDragging(true);
        setTimeout(() => setJustFinishedDragging(false), 100);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearDragState();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState, hasDragThresholdMet, clearDragState, performMove, findDropTargetAtPosition]);

  if (kitsLoading) {
    return (
      <Box position="relative" h="100%">
        <VStack align="stretch" gap={6}>
          <Flex align="center" justify="space-between" mb={6} py={2}>
            <Heading size="2xl">Kits</Heading>
          </Flex>
          <Box p={4}><Text>Loading...</Text></Box>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500" h="100%">
        Error: {error}
      </Box>
    );
  }

  if (projectsCount === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary" h="100%">
        No projects linked. Projects are managed via CLI and will appear here automatically.
      </Box>
    );
  }

  if (kits.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary" h="100%">
        No kits found in this project's .bluekit directory.
      </Box>
    );
  }

  // If viewing a folder, show the GroupView component
  if (viewingFolder) {
    return (
      <GroupView
        folder={viewingFolder}
        artifacts={getFolderArtifacts(viewingFolder.path)}
        selectedIds={selectedKitIds}
        onSelectionChange={handleSelectionChange}
        onViewArtifact={onViewKit}
        onBack={() => setViewingFolder(null)}
        onArtifactsChanged={onReload}
        projects={projects}
      />
    );
  }

  const projectName = projectPath.split('/').pop() || 'Project';

  // Get drop target folder name for tooltip
  const getDropTargetName = (): string | undefined => {
    if (!dragState || dragState.dropTargetFolderId === undefined) return undefined;
    const targetFolder = folders.find(f => (f.config?.id || f.path) === dragState.dropTargetFolderId);
    return targetFolder?.name;
  };

  return (
    <Flex direction="column" h="100%" overflow="hidden">
      <VStack align="stretch" gap={0} flex={1} overflow="hidden">
        {/* Toolkit Header */}
        <ToolkitHeader
          title="Kits"
          parentName={projectName}
          leftActions={
            <HStack gap={1}>
              <Box position="relative">
                <Button
                  ref={filterButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  colorPalette="gray"
                  title="Filter"
                >
                  <Icon boxSize={4}>
                    <LuFilter />
                  </Icon>
                  {(nameFilter || selectedTags.length > 0) && (
                    <Badge
                      position="absolute"
                      top="-2px"
                      right="-2px"
                      size="xs"
                      colorPalette="primary"
                      variant="solid"
                      borderRadius="full"
                      zIndex={1}
                    >
                      {(nameFilter ? 1 : 0) + selectedTags.length}
                    </Badge>
                  )}
                </Button>
                <FilterPanel
                  isOpen={isFilterOpen}
                  onClose={() => setIsFilterOpen(false)}
                  nameFilter={nameFilter}
                  onNameFilterChange={setNameFilter}
                  allTags={allTags}
                  selectedTags={selectedTags}
                  onToggleTag={toggleTag}
                  filterButtonRef={filterButtonRef}
                />
              </Box>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateFolderOpen(true)}
                colorPalette="gray"
                title="New Group"
              >
                <Icon boxSize={4}>
                  <LuFolderPlus />
                </Icon>
              </Button>
              {/* Controlled Popover rendering attached to header button logic via state */}
              <CreateFolderPopover
                isOpen={isCreateFolderOpen}
                onOpenChange={setIsCreateFolderOpen}
                onConfirm={(name, description, tags) => handleCreateFolder(name, { description, tags })}
                trigger={<Box />}
              />
            </HStack>
          }
          action={{
            label: "New Kit",
            onClick: () => setIsAddToProjectOpen(true),
            variant: "icon",
            icon: LuPlus,
          }}
        />

        {/* Scrollable Content Area */}
        <Box
          flex={1}
          overflowY="auto"
          p={6}
          userSelect={dragState && hasDragThresholdMet ? 'none' : 'auto'}
        >
          {/* Folders Section */}
          <Box position="relative" mb={8}>
            <Flex align="center" justify="space-between" gap={2} mb={4}>
              <Flex align="center" gap={2}>
                <Heading size="md">Groups</Heading>
                <Text fontSize="sm" color="text.muted">
                  {folders.length}
                </Text>
              </Flex>
            </Flex>

            {folders.length === 0 && !isFoldersLoading ? (
              <Box
                p={6}
                bg="bg.subtle"
                borderRadius="md"
                borderWidth="1px"
                borderColor="border.subtle"
                textAlign="center"
              >
                <Text color="text.muted" fontSize="sm">
                  No groups yet. Create one to organize your kits.
                </Text>
              </Box>
            ) : (
              <ElegantList
                items={folders}
                type="folder"
                onItemClick={(folder) => setViewingFolder(folder as ArtifactFolder)}
                isDragging={dragState !== null && hasDragThresholdMet}
                getItemProps={(item) => {
                  const folder = item as ArtifactFolder;
                  return {
                    'data-droppable-folder-id': folder.config?.id || folder.path,
                  };
                }}
                getItemStyle={(item) => {
                  const folder = item as ArtifactFolder;
                  const folderId = folder.config?.id || folder.path;
                  const isDraggedOver = dragState?.dropTargetFolderId === folderId && hasDragThresholdMet;

                  // Don't set pointerEvents on folder rows - they need to be detectable for drop targeting
                  // The hover highlight is controlled via backgroundColor, not CSS :hover
                  if (isDraggedOver) {
                    return {
                      backgroundColor: colorMode === 'light' ? 'var(--chakra-colors-blue-50)' : 'rgba(30, 58, 138, 0.3)',
                    };
                  }

                  return {};
                }}
                renderActions={(item) => {
                  const folder = item as ArtifactFolder;
                  return (
                    <>
                      <Menu.Item value="open-folder" onClick={() => setViewingFolder(folder)}>
                        <HStack gap={2}>
                          <Icon as={LuFolderPlus} /> <Text>Open</Text>
                        </HStack>
                      </Menu.Item>
                      <Menu.Item
                        value="delete-folder"
                        color="fg.error"
                        onClick={() => handleDeleteFolder(folder)}
                      >
                        <HStack gap={2}>
                          <Icon as={LuFolderPlus} /> <Text>Delete</Text>
                        </HStack>
                      </Menu.Item>
                    </>
                  );
                }}
              />
            )}
          </Box>

          {/* Kits Section */}
          <Box mb={8} position="relative">
            <Flex align="center" gap={2} mb={4}>
              <Heading size="md">Kits</Heading>
              <Text fontSize="sm" color="text.muted">
                {rootKits.length}
              </Text>
            </Flex>

            {rootKits.length === 0 ? (
              <Box
                p={6}
                bg="bg.subtle"
                borderRadius="md"
                borderWidth="1px"
                borderColor="border.subtle"
                textAlign="center"
              >
                <Text color="text.muted" fontSize="sm">
                  {(nameFilter || selectedTags.length > 0)
                    ? 'No kits match the current filters'
                    : 'No kits at root level. All kits are organized in folders.'}
                </Text>
              </Box>
            ) : (
              // Replaced with ElegantList with selection props
              <ElegantList
                items={rootKits}
                type="kit"
                selectable={true}
                selectedIds={selectedKitIds}
                onSelectionChange={handleSelectionChange}
                getItemId={(item) => (item as ArtifactFile).path}
                onItemClick={(kit) => handleViewKit(kit as ArtifactFile)}
                onItemContextMenu={(e, kit) => handleContextMenu(e, kit as ArtifactFile)}
                isDragging={dragState !== null && hasDragThresholdMet}
                onItemMouseDown={(kit, e) => {
                  handleDragStart(kit as ArtifactFile, e as any);
                }}
                getItemStyle={(kit) => {
                  const isDragged = dragState?.draggedKit.path === (kit as ArtifactFile).path && hasDragThresholdMet;
                  return {
                    opacity: isDragged ? 0.4 : 1,
                    cursor: 'pointer',
                  };
                }}
              />
            )}
          </Box>
        </Box>
      </VStack>

      {/* Drag Tooltip */}
      {dragState && hasDragThresholdMet && (
        <DragTooltip
          kit={dragState.draggedKit}
          targetFolderName={getDropTargetName()}
          position={mousePosition}
          isValidDrop={dragState.isValidDrop}
        />
      )}

      <DeleteFolderDialog
        isOpen={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        folder={deletingFolder}
        onConfirm={handleConfirmDeleteFolder}
      />

      <ResourceSelectionFooter
        selectedCount={selectedKitIds.size}
        isOpen={selectedKitIds.size > 0}
        onClearSelection={clearSelection}
        resourceType="kit"
        actions={[
          {
            label: 'Add to Project',
            icon: LuPlus,
            colorPalette: 'blue',
            onClick: () => setIsAddToProjectOpen(true),
          },
          {
            label: 'Publish to Library',
            icon: LuShare,
            colorPalette: 'orange',
            onClick: handlePublish,
          },
          {
            label: 'Delete',
            icon: LuTrash2,
            colorPalette: 'red',
            onClick: handleDelete,
          },
        ]}
        loading={isKitsLoading}
      />

      <AddToProjectDialog
        isOpen={isAddToProjectOpen}
        onClose={() => setIsAddToProjectOpen(false)}
        projects={projects}
        onConfirm={handleAddToProjects}
        loading={isKitsLoading}
      />
    </Flex>
  );
}

// Drag tooltip component
interface DragTooltipProps {
  kit: ArtifactFile;
  targetFolderName: string | undefined;
  position: { x: number; y: number };
  isValidDrop: boolean;
}

function DragTooltip({ kit, targetFolderName, position, isValidDrop }: DragTooltipProps) {
  // Determine action text
  let actionText: string;
  let actionColor: string;

  if (targetFolderName === undefined) {
    actionText = 'Release to cancel';
    actionColor = 'gray.500';
  } else if (!isValidDrop) {
    actionText = 'Cannot move here';
    actionColor = 'red.400';
  } else {
    actionText = `Move to ${targetFolderName}`;
    actionColor = 'blue.500';
  }

  const displayName = kit.frontMatter?.alias || kit.name.replace(/\.(md|markdown)$/, '');

  return createPortal(
    <Box
      position="fixed"
      left={`${position.x + 16}px`}
      top={`${position.y + 8}px`}
      pointerEvents="none"
      zIndex={9999}
      bg="bg.panel"
      borderRadius="md"
      boxShadow="lg"
      px={3}
      py={2}
      border="2px solid"
      borderColor={isValidDrop ? 'blue.400' : 'red.400'}
      minW="180px"
      maxW="280px"
    >
      <HStack gap={2}>
        <Icon as={LuPackage} color="blue.400" boxSize={4} />
        <Text fontSize="sm" fontWeight="medium" truncate>
          {displayName}
        </Text>
      </HStack>
      <HStack gap={1} mt={1.5}>
        <Icon
          as={isValidDrop ? LuArrowRight : LuX}
          boxSize={3}
          color={actionColor}
        />
        <Text fontSize="xs" color={actionColor}>
          {actionText}
        </Text>
      </HStack>
    </Box>,
    document.body
  );
}

// Memoize component to prevent unnecessary re-renders
// Only re-render when props actually change
export default memo(KitsSection, (prevProps, nextProps) => {
  return (
    prevProps.kits === nextProps.kits &&
    prevProps.kitsLoading === nextProps.kitsLoading &&
    prevProps.error === nextProps.error &&
    prevProps.projectsCount === nextProps.projectsCount &&
    prevProps.projectPath === nextProps.projectPath &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.onViewKit === nextProps.onViewKit
  );
});
