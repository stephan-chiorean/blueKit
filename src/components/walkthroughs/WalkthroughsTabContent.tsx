import { useState, useMemo, useEffect, useRef, memo } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Flex,
  Text,
  Icon,
  HStack,
  Checkbox,
  Tag,
  Table,
  VStack,
  Button,
  Badge,
  SimpleGrid,
} from '@chakra-ui/react';
import { ImTree } from 'react-icons/im';
import { LuFilter, LuFolderPlus, LuChevronRight, LuFolder, LuBookOpen } from 'react-icons/lu';
import { ArtifactFile, ArtifactFolder, FolderConfig, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeDeleteArtifactFolder, invokeRenameArtifactFolder } from '../../ipc';
import { ViewModeSwitcher, STANDARD_VIEW_MODES } from '../shared/ViewModeSwitcher';
import { useSelection } from '../../contexts/SelectionContext';
import { SimpleFolderCard } from '../shared/SimpleFolderCard';
import FolderView from '../shared/FolderView';
import { CreateFolderDialog } from '../shared/CreateFolderDialog';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { FilterPanel } from '../shared/FilterPanel';
import { getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';

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

type ViewMode = 'card' | 'table' | 'walkthroughs';

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

  // Handle rename folder (prompts for new name)
  const handleRenameFolder = async (folder: ArtifactFolder) => {
    const newName = prompt('Enter new folder name:', folder.name);
    if (!newName || newName === folder.name) return;

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

  const renderWalkthroughsTableView = () => (
    <Table.Root
      size="sm"
      variant="outline"
      borderRadius="16px"
      overflow="hidden"
      css={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        _dark: {
          background: 'rgba(0, 0, 0, 0.2)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <Table.Header>
        <Table.Row bg="transparent">
          <Table.ColumnHeader w="6">
            <Checkbox.Root
              size="sm"
              colorPalette="blue"
              checked={rootWalkthroughs.length > 0 && rootWalkthroughs.every(walkthrough => isSelected(walkthrough.path))}
              onCheckedChange={(changes) => {
                rootWalkthroughs.forEach(walkthrough => {
                  if (changes.checked && !isSelected(walkthrough.path)) {
                    handleWalkthroughToggle(walkthrough);
                  } else if (!changes.checked && isSelected(walkthrough.path)) {
                    handleWalkthroughToggle(walkthrough);
                  }
                });
              }}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Root>
          </Table.ColumnHeader>
          <Table.ColumnHeader>Name</Table.ColumnHeader>
          <Table.ColumnHeader>Description</Table.ColumnHeader>
          <Table.ColumnHeader>Tags</Table.ColumnHeader>
          <Table.ColumnHeader>Base</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rootWalkthroughs.map((walkthrough) => {
          const walkthroughSelected = isSelected(walkthrough.path);
          const displayName = walkthrough.frontMatter?.alias || walkthrough.name;
          const description = walkthrough.frontMatter?.description || walkthrough.path;
          const isBase = walkthrough.frontMatter?.is_base === true;
          return (
            <Table.Row
              key={walkthrough.path}
              cursor="pointer"
              onClick={() => handleViewWalkthrough(walkthrough)}
              bg="transparent"
              borderBottomWidth="1px"
              borderBottomColor="transparent"
              _hover={{ 
                bg: "rgba(255, 255, 255, 0.05)",
                borderBottomColor: "primary.500",
              }}
              data-selected={walkthroughSelected ? "" : undefined}
            >
              <Table.Cell>
                <Checkbox.Root
                  size="sm"
                  colorPalette="blue"
                  checked={walkthroughSelected}
                  onCheckedChange={() => {
                    handleWalkthroughToggle(walkthrough);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  cursor="pointer"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control cursor="pointer">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Root>
              </Table.Cell>
              <Table.Cell>
                <HStack gap={2}>
                  <Text fontWeight="medium">{displayName}</Text>
                  {isBase && (
                    <Icon
                      as={ImTree}
                      boxSize={4}
                      color="primary.500"
                    />
                  )}
                </HStack>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm" color="text.secondary" lineClamp={1}>
                  {description}
                </Text>
              </Table.Cell>
              <Table.Cell>
                {walkthrough.frontMatter?.tags && walkthrough.frontMatter.tags.length > 0 ? (
                  <HStack gap={1} flexWrap="wrap">
                    {walkthrough.frontMatter.tags.map((tag) => (
                      <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                        <Tag.Label>{tag}</Tag.Label>
                      </Tag.Root>
                    ))}
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="text.tertiary">—</Text>
                )}
              </Table.Cell>
              <Table.Cell>
                {isBase ? (
                  <Tag.Root size="sm" variant="solid" colorPalette="primary">
                    <Tag.Label>Base</Tag.Label>
                  </Tag.Root>
                ) : (
                  <Text fontSize="sm" color="text.tertiary">—</Text>
                )}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );

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
                  bg={isFilterOpen ? "bg.subtle" : "bg.subtle"}
                  borderWidth="1px"
                  borderColor="border.subtle"
                  _hover={{ bg: "bg.subtle" }}
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
              {/* New Folder Button - subtle blue style */}
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
                  <Text>New Folder</Text>
                </HStack>
              </Button>
            </Flex>
            {/* View Mode Switcher */}
            <ViewModeSwitcher
              value={viewMode}
              onChange={(mode) => setViewMode(mode as ViewMode)}
              modes={[
                STANDARD_VIEW_MODES.card,
                STANDARD_VIEW_MODES.table,
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
              columns={{ base: 2, md: 3, lg: 4, xl: 5 }}
              gap={4}
              overflow="visible"
              css={{
                alignItems: 'start',
              }}
            >
              {folders.map((folder) => (
                <SimpleFolderCard
                  key={folder.path}
                  folder={folder}
                  artifacts={getFolderArtifacts(folder.path)}
                  onOpenFolder={() => setViewingFolder(folder)}
                  onEditFolder={() => handleRenameFolder(folder)}
                  onDeleteFolder={() => handleDeleteFolder(folder)}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Table.Root
              size="sm"
              variant="outline"
              borderRadius="16px"
              overflow="hidden"
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                _dark: {
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                },
              }}
            >
              <Table.Header>
                <Table.Row bg="transparent">
                  <Table.ColumnHeader w="6"></Table.ColumnHeader>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Description</Table.ColumnHeader>
                  <Table.ColumnHeader>Tags</Table.ColumnHeader>
                  <Table.ColumnHeader>Resources</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {folders.map((folder) => {
                  const folderArtifacts = getFolderArtifacts(folder.path);
                  const totalResources = folderArtifacts.length;

                  return (
                    <Table.Row
                      key={folder.path}
                      cursor="pointer"
                      onClick={() => setViewingFolder(folder)}
                      bg="transparent"
                      borderBottomWidth="1px"
                      borderBottomColor="transparent"
                      _hover={{
                        bg: "rgba(255, 255, 255, 0.05)",
                        borderBottomColor: "primary.500",
                      }}
                    >
                      <Table.Cell>
                        <Icon>
                          <LuChevronRight />
                        </Icon>
                      </Table.Cell>
                      <Table.Cell>
                        <HStack gap={2}>
                          <Icon boxSize={4} color="blue.500">
                            <LuFolder />
                          </Icon>
                          <Text fontWeight="medium">{folder.name}</Text>
                        </HStack>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="text.tertiary">—</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="text.secondary">
                          {totalResources} resource{totalResources !== 1 ? 's' : ''}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
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
                  : 'No walkthroughs at root level. All walkthroughs are organized in folders.'}
              </Text>
            </Box>
          ) : viewMode === 'card' ? (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} overflow="visible">
              {rootWalkthroughs.map((walkthrough) => (
                <Card.Root
                  key={walkthrough.path}
                  borderWidth={isSelected(walkthrough.path) ? "2px" : "1px"}
                  borderRadius="16px"
                  position="relative"
                  cursor="pointer"
                  onClick={() => handleViewWalkthrough(walkthrough)}
                  transition="all 0.2s ease-in-out"
                  height="100%"
                  display="flex"
                  flexDirection="column"
                  css={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    borderColor: isSelected(walkthrough.path) ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                    _dark: {
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderColor: isSelected(walkthrough.path) ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                    },
                    _hover: {
                      transform: 'scale(1.02)',
                      borderColor: 'var(--chakra-colors-primary-400)',
                      zIndex: 10,
                    },
                  }}
                >
                  <CardHeader>
                    <Flex align="center" justify="space-between" gap={4}>
                      <HStack gap={2} align="center">
                        <Heading size="md">{walkthrough.frontMatter?.alias || walkthrough.name}</Heading>
                        {walkthrough.frontMatter?.is_base && (
                          <Icon as={ImTree} boxSize={5} color="primary.500" flexShrink={0} />
                        )}
                      </HStack>
                      <Checkbox.Root
                        checked={isSelected(walkthrough.path)}
                        colorPalette="blue"
                        onCheckedChange={() => handleWalkthroughToggle(walkthrough)}
                        onClick={(e) => e.stopPropagation()}
                        cursor="pointer"
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control cursor="pointer">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Root>
                    </Flex>
                  </CardHeader>
                  <CardBody display="flex" flexDirection="column" flex="1">
                    <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                      {walkthrough.frontMatter?.description || walkthrough.path}
                    </Text>
                    {walkthrough.frontMatter?.tags && walkthrough.frontMatter.tags.length > 0 && (
                      <HStack gap={2} flexWrap="wrap" mt="auto">
                        {walkthrough.frontMatter.tags.map((tag) => (
                          <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                            <Tag.Label>{tag}</Tag.Label>
                          </Tag.Root>
                        ))}
                      </HStack>
                    )}
                  </CardBody>
                </Card.Root>
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
          ) : viewMode === 'table' ? (
            renderWalkthroughsTableView()
          ) : null}
        </Box>
      </VStack>

      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
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






