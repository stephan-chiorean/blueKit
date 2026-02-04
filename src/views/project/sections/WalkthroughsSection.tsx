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
import { LuFilter, LuFolderPlus, LuPlus, LuTrash2, LuShare, LuX } from 'react-icons/lu';
import { ArtifactFile, ArtifactFolder, FolderConfig, Project, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeDeleteArtifactFolder } from '@/ipc';
import { invokeMoveArtifactToFolder } from '@/ipc/folders';
import { ToolkitHeader } from '@/shared/components/ToolkitHeader';
import FolderView from '@/shared/components/FolderView';
import { CreateFolderPopover } from '@/shared/components/CreateFolderPopover';
import DeleteFolderDialog from '@/shared/components/DeleteFolderDialog';
import { FilterPanel } from '@/shared/components/FilterPanel';
import { getRootArtifacts } from '@/shared/utils/buildFolderTree';
import { toaster } from '@/shared/components/ui/toaster';
import CreateWalkthroughDialog from '@/features/walkthroughs/components/CreateWalkthroughDialog';
import { ElegantList } from '@/shared/components/ElegantList';

// Drag state for walkthrough/folder movement
interface DragState {
  draggedWalkthrough: ArtifactFile;
  dropTargetFolderId: string | null | undefined; // null = root, undefined = invalid area
  isValidDrop: boolean;
  startPosition: { x: number; y: number };
}

// Constants for drag behavior
const DRAG_THRESHOLD = 5; // pixels before drag activates

interface WalkthroughsSectionProps {
  kits: ArtifactFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  projectPath: string;
  projectId?: string;
  onViewKit: (kit: ArtifactFile) => void;
  onViewWalkthrough?: (walkthroughId: string) => void;
  projects?: Project[];
  onReload?: () => void;
}

function WalkthroughsSection({
  kits,
  kitsLoading,
  error,
  projectsCount,
  projectPath,
  projectId,
  onViewKit,
  onViewWalkthrough,
  projects = [],
  onReload,
}: WalkthroughsSectionProps) {
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Local selection state
  const [selectedWalkthroughIds, setSelectedWalkthroughIds] = useState<Set<string>>(new Set());

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [isFoldersLoading, setIsFoldersLoading] = useState(true);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [viewingFolder, setViewingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);
  const [isCreateWalkthroughOpen, setIsCreateWalkthroughOpen] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hasDragThresholdMet, setHasDragThresholdMet] = useState(false);
  const [justFinishedDragging, setJustFinishedDragging] = useState(false);


  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    setSelectedWalkthroughIds(newSelectedIds);
  };

  const clearSelection = () => setSelectedWalkthroughIds(new Set());

  // Clear selection on mount/unmount or projectId change
  useEffect(() => {
    clearSelection();
  }, [projectId]);

  // Actions
  const handleDelete = () => {
    console.log('Delete selected walkthroughs:', Array.from(selectedWalkthroughIds));
    clearSelection();
  };

  const handlePublish = () => {
    console.log('Publish selected walkthroughs:', Array.from(selectedWalkthroughIds));
    clearSelection();
  };

  const handleAddToProject = () => {
    console.log('Add selected walkthroughs to project:', Array.from(selectedWalkthroughIds));
    clearSelection();
  };


  // Filter kits to only show those with type: walkthrough in front matter
  const walkthroughs = useMemo(() =>
    kits.filter(kit => kit.frontMatter?.type === 'walkthrough'),
    [kits]
  );

  // Get all unique tags from walkthroughs
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    walkthroughs.forEach(walkthrough => {
      walkthrough.frontMatter?.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [walkthroughs]);

  // Filter walkthroughs based on name and selected tags
  const filteredWalkthroughs = useMemo(() => {
    return walkthroughs.filter(walkthrough => {
      const displayName = walkthrough.frontMatter?.alias || walkthrough.name;
      const matchesName = !nameFilter ||
        displayName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        walkthrough.name.toLowerCase().includes(nameFilter.toLowerCase());

      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(selectedTag =>
          walkthrough.frontMatter?.tags?.some(tag =>
            tag.toLowerCase() === selectedTag.toLowerCase()
          )
        );

      return matchesName && matchesTags;
    });
  }, [walkthroughs, nameFilter, selectedTags]);

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
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
        setFolders(loadedFolders);
      } catch (err) {
        console.error('[WalkthroughFolders] ❌ Failed to load folders:', err);
      } finally {
        setIsFoldersLoading(false);
      }
    };

    // Load folders immediately when dependencies change
    loadFolders();

    return () => { };
  }, [projectPath, walkthroughs]); // Reload when walkthroughs change (from file watcher)

  // Get artifacts for a specific folder
  const getFolderArtifacts = (folderPath: string): ArtifactFile[] => {
    return walkthroughs.filter(w => w.path.startsWith(folderPath + '/'));
  };

  const handleViewWalkthrough = (walkthrough: ArtifactFile) => {
    // Don't open if we just finished dragging
    if (justFinishedDragging) return;

    if (onViewWalkthrough) {
      onViewWalkthrough(walkthrough.path);
    } else {
      onViewKit(walkthrough);
    }
  };

  // Handle create folder
  const handleCreateFolder = async (name: string, config: Partial<FolderConfig>) => {
    const fullConfig: FolderConfig = {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: config.name || name,
      description: config.description,
      tags: config.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await invokeCreateArtifactFolder(projectPath, 'walkthroughs', null, name, fullConfig);
      const newFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
      setFolders(newFolders);
    } catch (err) {
      console.error('Failed to create folder:', err);
      throw err;
    }
  };

  // Handle delete folder
  const handleDeleteFolder = (folder: ArtifactFolder) => {
    setDeletingFolder(folder);
  };

  // Confirm delete folder
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

  // Ref for filter button (used by FilterPanel for click-outside detection)
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Drag handlers
  const handleDragStart = useCallback((walkthrough: ArtifactFile, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    e.stopPropagation();

    setDragState({
      draggedWalkthrough: walkthrough,
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
  const performMove = useCallback(async (walkthrough: ArtifactFile, targetFolderId: string | null | undefined) => {
    if (targetFolderId === undefined) return;

    try {
      const targetFolder = folders.find(f => (f.config?.id || f.path) === targetFolderId);
      if (!targetFolder) return;

      await invokeMoveArtifactToFolder(walkthrough.path, targetFolder.path);

      toaster.create({
        type: 'success',
        title: 'Walkthrough moved',
        description: `Moved "${walkthrough.frontMatter?.alias || walkthrough.name}" to ${targetFolder.name}`,
      });

      onReload?.();
    } catch (error) {
      console.error('Failed to move walkthrough:', error);
      toaster.create({
        type: 'error',
        title: 'Move failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, [folders, onReload]);

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
        await performMove(dragState.draggedWalkthrough, dragState.dropTargetFolderId);
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

  // Get root-level walkthroughs (not in folders) - must be before early returns
  const rootWalkthroughs = useMemo(() => {
    return getRootArtifacts(filteredWalkthroughs, folders, 'walkthroughs', projectPath);
  }, [filteredWalkthroughs, folders, projectPath]);

  if (kitsLoading) {
    return (
      <Box
        position="relative"
        h="100%"
      >
        <VStack align="stretch" gap={6}>
          <Flex align="center" justify="space-between" mb={6} py={2}>
            <Heading size="2xl">Walkthroughs</Heading>
          </Flex>
          <Box p={4}><Text>Loading...</Text></Box>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        textAlign="center"
        py={12}
        color="red.500"
        h="100%"
      >
        Error: {error}
      </Box>
    );
  }

  if (projectsCount === 0) {
    return (
      <Box
        textAlign="center"
        py={12}
        color="text.secondary"
        h="100%"
      >
        No projects linked. Projects are managed via CLI and will appear here automatically.
      </Box>
    );
  }

  if (walkthroughs.length === 0) {
    return (
      <Box
        textAlign="center"
        py={12}
        color="text.secondary"
        h="100%"
      >
        No walkthroughs found in any linked project's .bluekit directory.
      </Box>
    );
  }

  // If viewing a folder, show the FolderView component
  if (viewingFolder) {
    return (
      <FolderView
        folder={viewingFolder}
        artifacts={getFolderArtifacts(viewingFolder.path)}
        selectedIds={selectedWalkthroughIds}
        onSelectionChange={handleSelectionChange}
        onViewArtifact={handleViewWalkthrough}
        onBack={() => setViewingFolder(null)}
        onArtifactsChanged={onReload}
      />
    );
  }

  const projectName = projectPath.split('/').pop() || 'Project';

  return (
    <Flex
      direction="column"
      h="100%"
      overflow="hidden"
    >
      <VStack align="stretch" gap={0} flex={1} overflow="hidden">
        {/* Toolkit Header */}
        <ToolkitHeader
          title="Walkthroughs"
          parentName={projectName}
          action={projectId ? {
            label: "Add Walkthrough",
            onClick: () => setIsCreateWalkthroughOpen(true),
            variant: 'icon', // Explicitly use new icon variant
            icon: LuPlus,
          } : undefined}
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
                {/* Filter Button */}
                <Box position="relative" overflow="visible">
                  <Button
                    ref={filterButtonRef}
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    borderWidth="1px"
                    borderRadius="lg"
                    css={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      borderColor: 'rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                      transition: 'none',
                      _dark: {
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                      },
                    }}
                  >
                    <HStack gap={2}>
                      <Icon>
                        <LuFilter />
                      </Icon>
                      <Text>Filter</Text>
                      {(nameFilter || selectedTags.length > 0) && (
                        <Badge size="sm" colorPalette="primary" variant="solid">
                          {[nameFilter && 1, selectedTags.length]
                            .filter(Boolean)
                            .reduce((a, b) => (a || 0) + (b || 0), 0)}
                        </Badge>
                      )}
                    </HStack>
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
                {/* New Folder Button with Spotlight Popover */}
                <CreateFolderPopover
                  isOpen={isCreateFolderOpen}
                  onOpenChange={setIsCreateFolderOpen}
                  onConfirm={(name, description, tags) => handleCreateFolder(name, { description, tags })}
                  trigger={
                    <Button
                      size="sm"
                      colorPalette="blue"
                      variant="subtle"
                    >
                      <HStack gap={2}>
                        <Icon>
                          <LuFolderPlus />
                        </Icon>
                        <Text>New Group</Text>
                      </HStack>
                    </Button>
                  }
                />
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
                  No groups yet. Create one to organize your walkthroughs.
                </Text>
              </Box>
            ) : (
              <ElegantList
                items={folders}
                type="folder"
                onItemClick={(folder) => setViewingFolder(folder as ArtifactFolder)}
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

                  if (!isDraggedOver) return {};

                  return {
                    borderWidth: '2px',
                    borderStyle: 'dashed',
                    borderColor: '#3182ce', // blue.400
                    backgroundColor: 'var(--chakra-colors-blue-50)',
                    _dark: {
                      backgroundColor: 'var(--chakra-colors-blue-900)',
                    }
                  };
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

          {/* Walkthroughs Section */}
          <Box mb={8} position="relative">
            <Flex align="center" gap={2} mb={4}>
              <Heading size="md">Walkthroughs</Heading>
              <Text fontSize="sm" color="text.muted">
                {rootWalkthroughs.length}
              </Text>
            </Flex>

            {rootWalkthroughs.length === 0 ? (
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
                    ? 'No walkthroughs match the current filters'
                    : 'No walkthroughs at root level. All walkthroughs are organized in groups.'}
                </Text>
              </Box>
            ) : (
              <ElegantList
                items={rootWalkthroughs}
                type="walkthrough"
                selectable={true}
                selectedIds={selectedWalkthroughIds}
                onSelectionChange={handleSelectionChange}
                getItemId={(item) => (item as ArtifactFile).path}
                onItemClick={(kit) => handleViewWalkthrough(kit as ArtifactFile)}
                onItemMouseDown={(walkthrough, e) => {
                  handleDragStart(walkthrough as ArtifactFile, e as any);
                }}
                getItemStyle={(walkthrough) => {
                  const isDragged = dragState?.draggedWalkthrough.path === (walkthrough as ArtifactFile).path && hasDragThresholdMet;
                  return {
                    opacity: isDragged ? 0.4 : 1,
                    cursor: dragState ? 'grabbing' : 'grab',
                  };
                }}
                renderActions={(item) => (
                  <Menu.Item value="open-walkthrough" onClick={() => handleViewWalkthrough(item as ArtifactFile)}>
                    <HStack gap={2}>
                      <Text>Open</Text>
                    </HStack>
                  </Menu.Item>
                )}
              />
            )}
          </Box>
        </Box>
      </VStack>

      <DeleteFolderDialog
        isOpen={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        folder={deletingFolder}
        onConfirm={handleConfirmDeleteFolder}
      />

      {/* Create Walkthrough Dialog */}
      {projectId && (
        <CreateWalkthroughDialog
          isOpen={isCreateWalkthroughOpen}
          onClose={() => setIsCreateWalkthroughOpen(false)}
          onWalkthroughCreated={() => {
            // No reload needed as file watcher handles it
          }}
          projectId={projectId}
          projectPath={projectPath}
        />
      )}

      {/* Inline Selection Footer */}
      <Box
        position="sticky"
        bottom={0}
        width="100%"
        display="grid"
        css={{
          gridTemplateRows: selectedWalkthroughIds.size > 0 ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <Box overflow="hidden" minHeight={0}>
          <Box
            borderTopWidth="1px"
            borderColor="border.subtle"
            py={4}
            px={6}
            css={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              _dark: {
                background: 'rgba(20, 20, 20, 0.85)',
              }
            }}
          >
            <HStack justify="space-between">
              <HStack gap={3}>
                <Badge colorPalette="blue" size="lg" variant="solid">
                  {selectedWalkthroughIds.size}
                </Badge>
                <Text fontWeight="medium" fontSize="sm">walkthrough{selectedWalkthroughIds.size > 1 ? 's' : ''} selected</Text>
              </HStack>
              <HStack gap={2}>
                <Button size="sm" variant="ghost" colorPalette="blue" onClick={handleAddToProject}>
                  <HStack gap={1}>
                    <LuPlus />
                    <Text>Add to Project</Text>
                  </HStack>
                </Button>
                <Button size="sm" variant="ghost" colorPalette="orange" onClick={handlePublish}>
                  <HStack gap={1}>
                    <LuShare />
                    <Text>Publish to Library</Text>
                  </HStack>
                </Button>
                <Button size="sm" variant="ghost" colorPalette="red" onClick={handleDelete}>
                  <HStack gap={1}>
                    <LuTrash2 />
                    <Text>Delete</Text>
                  </HStack>
                </Button>
                <Button size="sm" variant="ghost" colorPalette="gray" onClick={clearSelection}>
                  <HStack gap={1}>
                    <LuX />
                    <Text>Clear</Text>
                  </HStack>
                </Button>
              </HStack>
            </HStack>
          </Box>
        </Box>
      </Box>

    </Flex>
  );
}

// Memoize component to prevent unnecessary re-renders
// Only re-render when props actually change
export default memo(WalkthroughsSection, (prevProps, nextProps) => {
  return (
    prevProps.kits === nextProps.kits &&
    prevProps.kitsLoading === nextProps.kitsLoading &&
    prevProps.error === nextProps.error &&
    prevProps.projectsCount === nextProps.projectsCount &&
    prevProps.projectPath === nextProps.projectPath &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.onViewKit === nextProps.onViewKit &&
    prevProps.onViewWalkthrough === nextProps.onViewWalkthrough
  );
});
