import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
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
  SimpleGrid,
} from '@chakra-ui/react';
import { LuFilter, LuFolderPlus } from 'react-icons/lu';
import { BsBoxes } from 'react-icons/bs';
import { ArtifactFile, ArtifactFolder, FolderConfig, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeDeleteArtifactFolder, invokeRenameArtifactFolder } from '../../ipc';
import { STANDARD_VIEW_MODES } from '../shared/ViewModeSwitcher';
import { ToolkitHeader } from '../shared/ToolkitHeader';
import { LiquidViewModeSwitcher } from './LiquidViewModeSwitcher';
import { useSelection } from '../../contexts/SelectionContext';
import { SimpleFolderCard } from '../shared/SimpleFolderCard';
import FolderView from '../shared/FolderView';
import { CreateFolderPopover } from '../shared/CreateFolderPopover';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { KitContextMenu } from './KitContextMenu';
import { ResourceCard } from '../shared/ResourceCard';
import { ResourceSelectionBar } from '../shared/ResourceSelectionBar';
import { FilterPanel } from '../shared/FilterPanel';
import { getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';
import FilePreviewPopover from '../sidebar/FilePreviewPopover';
import { useSmartHover } from '../../hooks/useSmartHover';

interface KitsTabContentProps {
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

type ViewMode = 'card' | 'blueprints';

function KitsTabContent({
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
}: KitsTabContentProps) {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection, addItem } = useSelection();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
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

  // Smart hover for kits preview
  const {
    hoveredItem: hoveredKit,
    anchorRect,
    handleMouseEnter,
    handleMouseLeave,
    handlePopoverMouseEnter,
    handlePopoverMouseLeave,
  } = useSmartHover<ArtifactFile>({
    initialDelay: 1000,
    smartDelay: 1000,
    gracePeriod: 500,
    placement: 'top',
  });

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

    // Debounce folder loading to avoid excessive calls when artifacts update rapidly
    const timeoutId = setTimeout(() => {
      loadFolders();
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
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

      // Don't reload folders here - file watcher will update artifacts first,
      // then the folder reload effect (with kits dependency) will sync folders
      // Reloading now causes state mismatch with useDeferredValue
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
      <Box textAlign="center" py={12} color="text.secondary">
        Loading kits...
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500">
        Error: {error}
      </Box>
    );
  }

  if (projectsCount === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No projects linked. Projects are managed via CLI and will appear here automatically.
      </Box>
    );
  }

  if (kits.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No kits found in any linked project's .bluekit directory.
      </Box>
    );
  }

  // If viewing a folder, show the FolderView component
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
    <Box position="relative" width="100%" maxW="100%">
      <VStack align="stretch" gap={6} width="100%">
        {/* Toolkit Header */}
        <ToolkitHeader title="Kits" />

        {/* Folders Section - only show if folders exist */}
        {folders.length > 0 && (
          <Box position="relative">
            <Flex align="center" justify="space-between" gap={2} mb={4}>
              <Flex align="center" gap={2}>
                <Heading size="md">Groups</Heading>
                <Text fontSize="sm" color="text.muted">
                  {folders.length}
                </Text>
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
              {/* View Mode Switcher */}
              <LiquidViewModeSwitcher
                value={viewMode}
                onChange={(mode) => setViewMode(mode as ViewMode)}
                modes={[
                  STANDARD_VIEW_MODES.card,
                  { id: 'blueprints', label: 'Blueprints', icon: BsBoxes },
                ]}
              />
            </Flex>

            {viewMode === 'card' ? (
              <AnimatePresence mode="popLayout">
                <SimpleGrid
                  columns={{ base: 3, md: 4, lg: 5, xl: 6 }}
                  gap={4}
                  p={1}
                  width="100%"
                  maxW="100%"
                  overflow="visible"
                >
                  {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map((folder, index) => (
                    <SimpleFolderCard
                      key={folder.path}
                      folder={folder}
                      artifacts={getFolderArtifacts(folder.path)}
                      onOpenFolder={() => setViewingFolder(folder)}
                      onRenameFolder={async (newName) => handleRenameFolder(folder, newName)}
                      onDeleteFolder={() => handleDeleteFolder(folder)}
                      index={index}
                    />
                  ))}
                </SimpleGrid>
              </AnimatePresence>
            ) : (
              <Box
                p={6}
                bg="bg.subtle"
                borderRadius="md"
                borderWidth="1px"
                borderColor="border.subtle"
                textAlign="center"
              >
                <Text color="text.muted" fontSize="sm">
                  Blueprints view coming soon
                </Text>
              </Box>
            )}
          </Box>
        )}

        {/* Kits Section */}
        <Box mb={8} position="relative" width="100%" maxW="100%">
          <Flex align="center" gap={2} mb={4}>
            <Heading size="md">Kits</Heading>
            <Text fontSize="sm" color="text.muted">
              {rootKits.length}
            </Text>
            {/* Filter Button - always visible */}
            <Box position="relative">
              <Button
                ref={kitsFilterButtonRef}
                variant="ghost"
                size="sm"
                onClick={() => setIsKitsFilterOpen(!isKitsFilterOpen)}
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
            {/* Show New Folder button if no folders exist */}
            {folders.length === 0 && (
              <Button
                size="sm"
                onClick={() => setIsCreateFolderOpen(true)}
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
            )}
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
                  : 'No kits at root level. All kits are organized in groups.'}
              </Text>
            </Box>
          ) : viewMode === 'card' ? (
            <AnimatePresence mode="popLayout">
              <SimpleGrid
                columns={{ base: 1, md: 2, lg: 3 }}
                gap={4}
                p={1}
                width="100%"
                maxW="100%"
                overflow="visible"
                css={{
                  '> *': {
                    minHeight: '220px',
                  },
                }}
              >

                {rootKits.map((kit, index) => (
                  <ResourceCard
                    key={kit.path}
                    resource={kit}
                    isSelected={isSelected(kit.path)}
                    onToggle={() => handleKitToggle(kit)}
                    onClick={() => handleViewKit(kit)}
                    onContextMenu={(e) => handleContextMenu(e, kit)}
                    resourceType="kit"
                    index={index}
                    onMouseEnter={(e) => handleMouseEnter(kit, e)}
                    onMouseLeave={(e) => handleMouseLeave(e)}
                  />
                ))}
              </SimpleGrid>
            </AnimatePresence>
          ) : viewMode === 'blueprints' ? (
            <Box
              p={6}
              bg="bg.subtle"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
            >
              <Text color="text.muted" fontSize="sm">
                Blueprints view coming soon
              </Text>
            </Box>
          ) : null}
        </Box>
      </VStack>

      {/* Selection Bar */}
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

      <FilePreviewPopover
        file={hoveredKit as any}
        anchorRect={anchorRect}
        isOpen={!!hoveredKit}
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
        placement="top"
      />
    </Box>
  );
}

// Memoize component to prevent unnecessary re-renders
// Only re-render when props actually change
export default memo(KitsTabContent, (prevProps, nextProps) => {
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
