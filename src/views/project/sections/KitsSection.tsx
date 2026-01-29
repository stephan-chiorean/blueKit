import { useState, useMemo, useEffect, useRef, memo } from 'react';
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
import { LuFilter, LuFolderPlus } from 'react-icons/lu';
import { ArtifactFile, ArtifactFolder, FolderConfig, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeDeleteArtifactFolder, invokeRenameArtifactFolder } from '@/ipc';
import { ToolkitHeader } from '@/shared/components/ToolkitHeader';
import { useSelection } from '@/shared/contexts/SelectionContext';
import FolderView from '@/shared/components/FolderView';
import { CreateFolderPopover } from '@/shared/components/CreateFolderPopover';
import DeleteFolderDialog from '@/shared/components/DeleteFolderDialog';
import { KitContextMenu } from '@/features/kits/components/KitContextMenu';
import { ElegantList } from '@/shared/components/ElegantList';
import { ResourceSelectionBar } from '@/shared/components/ResourceSelectionBar';
import { FilterPanel } from '@/shared/components/FilterPanel';
import { getRootArtifacts } from '@/shared/utils/buildFolderTree';
import { toaster } from '@/shared/components/ui/toaster';

interface KitsSectionProps {
  kits: ArtifactFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  projectPath: string;
  projectId?: string;
  onViewKit: (kit: ArtifactFile) => void;
  onReload?: () => void;
  onOptimisticMove?: (artifactPath: string, targetFolderPath: string) => (() => void);
  onConfirmMove?: (oldPath: string, newPath: string) => void;
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
  onReload,
  onOptimisticMove,
  onConfirmMove,
  movingArtifacts = new Set(),
}: KitsSectionProps) {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection, addItem } = useSelection();
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isKitsFilterOpen, setIsKitsFilterOpen] = useState(false);

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [viewingFolder, setViewingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    kit: ArtifactFile | null;
  }>({ isOpen: false, x: 0, y: 0, kit: null });

  const isSelected = (kitId: string) => isSelectedInContext(kitId);

  const handleKitToggle = (kit: ArtifactFile) => {
    toggleItem({
      id: kit.path,
      name: kit.frontMatter?.alias || kit.name,
      type: 'Kit',
      path: kit.path,
      projectId,
      projectPath,
    });
  };

  // Get root-level kits (not in folders) - unfiltered
  const rootKitsUnfiltered = useMemo(() => {
    return getRootArtifacts(kits, folders, 'kits', projectPath);
  }, [kits, folders, projectPath]);

  // Get all unique tags from root-level kits only
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    rootKitsUnfiltered.forEach(kit => {
      kit.frontMatter?.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [rootKitsUnfiltered]);

  // Filter only root-level kits based on name and selected tags
  const filteredRootKits = useMemo(() => {
    return rootKitsUnfiltered.filter(kit => {
      const displayName = kit.frontMatter?.alias || kit.name;
      const matchesName = !nameFilter ||
        displayName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        kit.name.toLowerCase().includes(nameFilter.toLowerCase());

      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(selectedTag =>
          kit.frontMatter?.tags?.some(tag =>
            tag.toLowerCase() === selectedTag.toLowerCase()
          )
        );

      return matchesName && matchesTags;
    });
  }, [rootKitsUnfiltered, nameFilter, selectedTags]);

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
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'kits');
        setFolders(loadedFolders);
      } catch (err) {
        console.error('Failed to load folders:', err);
      }
    };

    // Load folders immediately when dependencies change
    loadFolders();

    return () => { };
  }, [projectPath, kits]); // Reload when kits change (from file watcher)

  const handleViewKit = (kit: ArtifactFile) => {
    onViewKit(kit);
  };

  const handleContextMenu = (e: React.MouseEvent, kit: ArtifactFile) => {
    e.preventDefault();

    // Boundary detection to prevent off-screen menu
    const menuWidth = 250;
    const menuHeight = 200;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({ isOpen: true, x, y, kit });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, kit: null });
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
      await invokeCreateArtifactFolder(projectPath, 'kits', null, name, fullConfig);
      const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
      setFolders(newFolders);
    } catch (err) {
      console.error('Failed to create folder:', err);
      throw err;
    }
  };


  // Handle rename folder (receives new name from popover)
  const handleRenameFolder = async (folder: ArtifactFolder, newName: string) => {
    if (!newName) return;

    try {
      await invokeRenameArtifactFolder(folder.path, newName);
      toaster.create({
        type: 'success',
        title: 'Group renamed',
        description: `Renamed to ${newName}`,
      });
      // Reload folders to reflect the change
      const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
      setFolders(newFolders);
    } catch (error) {
      console.error('Failed to rename folder:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to rename group',
        description: error instanceof Error ? error.message : 'Unknown error',
        closable: true,
      });
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

  // Get artifacts for a specific folder
  const getFolderArtifacts = (folderPath: string): ArtifactFile[] => {
    return kits.filter(kit => kit.path.startsWith(folderPath + '/'));
  };

  // Ref for filter button (used by FilterPanel for click-outside detection)
  const kitsFilterButtonRef = useRef<HTMLButtonElement>(null);

  // Use filtered root kits (filter only applies to root-level kits)
  const rootKits = filteredRootKits;

  if (kitsLoading) {
    return (
      <Box
        position="relative"
        width="100%"
        maxW="100%"
        h="100%"
      >
        <VStack align="stretch" gap={6} width="100%">
          <ToolkitHeader title="Kits" />
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

  if (kits.length === 0) {
    return (
      <Box
        textAlign="center"
        py={12}
        color="text.secondary"
        h="100%"
      >
        No kits found in any linked project's .bluekit directory.
      </Box>
    );
  }

  // If viewing a folder, show the FolderView component
  // Note: FolderView functionality is kept, but internal display is handled by FolderView component.
  if (viewingFolder) {
    return (
      <FolderView
        folder={viewingFolder}
        artifacts={getFolderArtifacts(viewingFolder.path)}
        isSelected={(path) => isSelected(path)}
        onArtifactToggle={handleKitToggle}
        onViewArtifact={handleViewKit}
        onContextMenu={handleContextMenu}
        onBack={() => setViewingFolder(null)}
      />
    );
  }

  return (
    <Flex
      direction="column"
      h="100%"
      overflow="hidden"
      position="relative"
    >
      <VStack align="stretch" gap={0} h="100%">
        {/* Toolkit Header */}
        <ToolkitHeader
          title="Kits"
          leftActions={
            <HStack gap={1}>
              {/* Filter Button */}
              <Box position="relative">
                <Button
                  ref={kitsFilterButtonRef}
                  variant="ghost"
                  size="sm"
                  px={2}
                  onClick={() => setIsKitsFilterOpen(!isKitsFilterOpen)}
                  bg="transparent"
                  _hover={{
                    bg: 'bg.subtle',
                  }}
                  title="Filter kits"
                >
                  <Icon boxSize={4}>
                    <LuFilter />
                  </Icon>
                </Button>
                <FilterPanel
                  isOpen={isKitsFilterOpen}
                  onClose={() => setIsKitsFilterOpen(false)}
                  nameFilter={nameFilter}
                  onNameFilterChange={setNameFilter}
                  allTags={allTags}
                  selectedTags={selectedTags}
                  onToggleTag={toggleTag}
                  filterButtonRef={kitsFilterButtonRef}
                />
              </Box>
              {/* New Group Button */}
              <CreateFolderPopover
                isOpen={isCreateFolderOpen}
                onOpenChange={setIsCreateFolderOpen}
                onConfirm={(name, description, tags) => handleCreateFolder(name, { description, tags })}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    px={2}
                    bg="transparent"
                    _hover={{
                      bg: 'bg.subtle',
                    }}
                    title="New group"
                  >
                    <Icon boxSize={4}>
                      <LuFolderPlus />
                    </Icon>
                  </Button>
                }
              />
            </HStack>
          }
        />

        {/* Scrollable Content Area */}
        <Box flex={1} overflowY="auto" p={6}>
          {/* Folders Section - only show if folders exist */}
        {folders.length > 0 && (
          <Box position="relative">
            <Flex align="center" gap={2} mb={4}>
              <Heading size="md">Groups</Heading>
              <Text fontSize="sm" color="text.muted">
                {folders.length}
              </Text>
            </Flex>

            <ElegantList
              items={folders}
              type="folder"
              onItemClick={(folder) => setViewingFolder(folder as ArtifactFolder)}
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
          </Box>
        )}

        {/* Kits Section */}
        <Box mb={8} position="relative" width="100%" maxW="100%">
          <Flex align="center" gap={2} mb={4}>
            <Heading size="md">Kits</Heading>
            <Text fontSize="sm" color="text.muted">
              {rootKits.length}
            </Text>
          </Flex>

          {rootKits.length === 0 && !kitsLoading && (nameFilter || selectedTags.length > 0) ? (
            <Box
              p={6}
              bg="bg.subtle"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
            >
              <Text color="text.muted" fontSize="sm">
                No kits match the current filters
              </Text>
            </Box>
          ) : rootKits.length > 0 ? (
            <ElegantList
              items={rootKits}
              type="kit"
              onItemClick={(kit) => handleViewKit(kit as ArtifactFile)}
              onItemContextMenu={(e, kit) => handleContextMenu(e, kit as ArtifactFile)}
              renderActions={(item) => (
                <Menu.Item value="open-kit" onClick={() => handleViewKit(item as ArtifactFile)}>
                  <HStack gap={2}>
                    <Text>Open</Text>
                  </HStack>
                </Menu.Item>
              )}
            />
          ) : null}
        </Box>
        </Box>
      </VStack>

      <ResourceSelectionBar
        isOpen={selectedItems.length > 0}
        selectedItems={selectedItems}
        onClearSelection={clearSelection}
        onMoveToFolder={(folderPath) => {
          // TODO: Implement move to folder
          console.log('Move to folder:', folderPath, selectedItems);
          clearSelection();
        }}
        folders={folders}
      />

      <DeleteFolderDialog
        isOpen={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        folder={deletingFolder}
        onConfirm={handleConfirmDeleteFolder}
      />

      <KitContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        kit={contextMenu.kit}
        onClose={closeContextMenu}
      />


    </Flex>
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
    prevProps.onViewKit === nextProps.onViewKit &&
    prevProps.onReload === nextProps.onReload
  );
});
