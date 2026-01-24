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
import { LuFilter, LuFolderPlus, LuPlus } from 'react-icons/lu';
import { ArtifactFile, ArtifactFolder, FolderConfig, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeDeleteArtifactFolder, invokeRenameArtifactFolder } from '../../ipc';
import { ToolkitHeader } from '../shared/ToolkitHeader';
import { useSelection } from '../../contexts/SelectionContext';
import FolderView from '../shared/FolderView';
import { CreateFolderPopover } from '../shared/CreateFolderPopover';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { FilterPanel } from '../shared/FilterPanel';
import { getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';
import { ResourceSelectionBar } from '../shared/ResourceSelectionBar';
import CreateWalkthroughDialog from './CreateWalkthroughDialog';
import { ElegantList } from '../shared/ElegantList';

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
  onViewWalkthrough?: (walkthroughId: string) => void;
}

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
  onViewWalkthrough,
}: WalkthroughsTabContentProps) {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection } = useSelection();
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [isFoldersLoading, setIsFoldersLoading] = useState(true);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [viewingFolder, setViewingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);
  const [isCreateWalkthroughOpen, setIsCreateWalkthroughOpen] = useState(false);

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
      const newFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
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

  // Ref for filter button (used by FilterPanel for click-outside detection)
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Get root-level walkthroughs (not in folders) - must be before early returns
  const rootWalkthroughs = useMemo(() => {
    return getRootArtifacts(filteredWalkthroughs, folders, 'walkthroughs', projectPath);
  }, [filteredWalkthroughs, folders, projectPath]);

  if (kitsLoading) {
    return (
      <Box position="relative">
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
        <ToolkitHeader
          title="Walkthroughs"
          action={projectId ? {
            label: "Add Walkthrough",
            onClick: () => setIsCreateWalkthroughOpen(true),
            variant: 'solid',
            icon: LuPlus,
          } : undefined}
        />

        {/* Folders Section */}
        <Box position="relative">
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
              onItemClick={(kit) => handleViewWalkthrough(kit as ArtifactFile)}
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

      {/* Create Walkthrough Dialog */}
      {projectId && (
        <CreateWalkthroughDialog
          isOpen={isCreateWalkthroughOpen}
          onClose={() => setIsCreateWalkthroughOpen(false)}
          onWalkthroughCreated={() => {
            onReload?.();
          }}
          projectId={projectId}
          projectPath={projectPath}
        />
      )}


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
    prevProps.projectId === nextProps.projectId &&
    prevProps.onViewKit === nextProps.onViewKit &&
    prevProps.onReload === nextProps.onReload &&
    prevProps.onViewWalkthrough === nextProps.onViewWalkthrough
  );
});
