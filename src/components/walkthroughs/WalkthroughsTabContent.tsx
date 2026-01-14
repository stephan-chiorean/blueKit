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
  SimpleGrid,
} from '@chakra-ui/react';
import { LuFilter, LuFolderPlus, LuBookOpen } from 'react-icons/lu';
import { ArtifactFile, ArtifactFolder, FolderConfig, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeDeleteArtifactFolder, invokeRenameArtifactFolder } from '../../ipc';
import { STANDARD_VIEW_MODES } from '../shared/ViewModeSwitcher';
import { ToolkitHeader } from '../shared/ToolkitHeader';
import { LiquidViewModeSwitcher } from '../kits/LiquidViewModeSwitcher';
import { useSelection } from '../../contexts/SelectionContext';
import { SimpleFolderCard } from '../shared/SimpleFolderCard';
import FolderView from '../shared/FolderView';
import { CreateFolderPopover } from '../shared/CreateFolderPopover';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { FilterPanel } from '../shared/FilterPanel';
import { getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';
import { ResourceCard } from '../shared/ResourceCard';
import { ResourceSelectionBar } from '../shared/ResourceSelectionBar';

interface WalkthroughsTabContentProps {
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

type ViewMode = 'card' | 'walkthroughs';

function WalkthroughsTabContent({
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
}: WalkthroughsTabContentProps) {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection } = useSelection();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [viewingFolder, setViewingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);

  const isSelected = (walkthroughId: string) => isSelectedInContext(walkthroughId);

  const handleWalkthroughToggle = (walkthrough: ArtifactFile) => {
    toggleItem({
      id: walkthrough.path,
      name: walkthrough.frontMatter?.alias || walkthrough.name,
      type: 'Walkthrough',
      path: walkthrough.path,
      projectId,
      projectPath,
    });
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
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
        setFolders(loadedFolders);
      } catch (err) {
        console.error('[WalkthroughFolders] ❌ Failed to load folders:', err);
      }
    };

    // Debounce folder loading to avoid excessive calls when artifacts update rapidly
    const timeoutId = setTimeout(() => {
      loadFolders();
    }, 100); // 100ms debounce

    return () => {
      clearTimeout(timeoutId);
    };
  }, [projectPath, walkthroughs]); // Reload when walkthroughs change (from file watcher)

  // Get artifacts for a specific folder
  const getFolderArtifacts = (folderPath: string): ArtifactFile[] => {
    return walkthroughs.filter(w => w.path.startsWith(folderPath + '/'));
  };

  const handleViewWalkthrough = (walkthrough: ArtifactFile) => {
    onViewKit(walkthrough);
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

  // Handle rename folder (receives new name from popover)
  const handleRenameFolder = async (folder: ArtifactFolder, newName: string) => {
    if (!newName) return;

    try {
      await invokeRenameArtifactFolder(folder.path, newName);
      toaster.create({
        type: 'success',
        title: 'Folder renamed',
        description: `Renamed to ${newName}`,
      });
      // Reload folders to reflect the change
      const newFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
      setFolders(newFolders);
    } catch (error) {
      console.error('Failed to rename folder:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to rename folder',
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
        title: 'Folder deleted',
        description: `Deleted ${deletingFolder.name}`,
      });

      // Don't reload folders here - file watcher will update artifacts first,
      // then the folder reload effect (with walkthroughs dependency) will sync folders
      // Reloading now causes state mismatch with useDeferredValue
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete folder',
        description: error instanceof Error ? error.message : 'Unknown error',
        closable: true,
      });
    }
  };

  // Ref for filter button (used by FilterPanel for click-outside detection)
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Get root-level walkthroughs (not in folders) - must be before early returns
  const rootWalkthroughs = useMemo(() => {
    return getRootArtifacts(filteredWalkthroughs, folders, 'walkthroughs', projectPath);
  }, [filteredWalkthroughs, folders, projectPath]);

  if (kitsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading walkthroughs...
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

  if (walkthroughs.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
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
        isSelected={(path) => isSelected(path)}
        onArtifactToggle={handleWalkthroughToggle}
        onViewArtifact={handleViewWalkthrough}
        onBack={() => setViewingFolder(null)}
      />
    );
  }

  return (
    <Box position="relative">
      <VStack align="stretch" gap={6}>
        {/* Toolkit Header */}
        <ToolkitHeader title="Walkthroughs" />

        {/* Folders Section */}
        <Box position="relative">
          <Flex align="center" justify="space-between" gap={2} mb={4}>
            <Flex align="center" gap={2}>
              <Heading size="md">Folders</Heading>
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
                onConfirm={(name) => handleCreateFolder(name, {})}
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
                      <Text>New Folder</Text>
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
                { id: 'walkthroughs', label: 'Walkthroughs', icon: LuBookOpen },
              ]}
            />
          </Flex>

          {folders.length === 0 ? (
            <Box
              p={6}
              bg="bg.subtle"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
            >
              <Text color="text.muted" fontSize="sm">
                No folders yet. Create one to organize your walkthroughs.
              </Text>
            </Box>
          ) : viewMode === 'card' ? (
            <SimpleGrid
              columns={{ base: 3, md: 4, lg: 5, xl: 6 }}
              gap={4}
              p={1}
              overflow="visible"
            >
              {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                <SimpleFolderCard
                  key={folder.path}
                  folder={folder}
                  artifacts={getFolderArtifacts(folder.path)}
                  onOpenFolder={() => setViewingFolder(folder)}
                  onRenameFolder={async (newName) => handleRenameFolder(folder, newName)}
                  onDeleteFolder={() => handleDeleteFolder(folder)}
                />
              ))}
            </SimpleGrid>
          ) : null}
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
                  : 'No walkthroughs at root level. All walkthroughs are organized in folders.'}
              </Text>
            </Box>
          ) : viewMode === 'card' ? (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} p={1} overflow="visible">
              {rootWalkthroughs.map((walkthrough) => (
                <ResourceCard
                  key={walkthrough.path}
                  resource={walkthrough}
                  isSelected={isSelected(walkthrough.path)}
                  onToggle={() => handleWalkthroughToggle(walkthrough)}
                  onClick={() => handleViewWalkthrough(walkthrough)}
                  resourceType="walkthrough"
                />
              ))}
            </SimpleGrid>
          ) : viewMode === 'walkthroughs' ? (
            <Box
              p={6}
              bg="bg.subtle"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
            >
              <Text color="text.muted" fontSize="sm">
                Walkthroughs view coming soon
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
    </Box>
  );
}

// Memoize component to prevent unnecessary re-renders
// Only re-render when props actually change
export default memo(WalkthroughsTabContent, (prevProps, nextProps) => {
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






