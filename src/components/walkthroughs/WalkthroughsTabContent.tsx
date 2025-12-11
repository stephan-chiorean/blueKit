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
import { LuFilter, LuFolderPlus, LuLayoutGrid, LuTable, LuChevronRight, LuFolder } from 'react-icons/lu';
import { ArtifactFile, ArtifactFolder, FolderConfig, FolderTreeNode, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeMoveArtifactToFolder, invokeDeleteArtifactFolder } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';
import { FolderCard } from '../shared/FolderCard';
import { CreateFolderDialog } from '../shared/CreateFolderDialog';
import EditFolderDialog from '../shared/EditFolderDialog';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { FilterPanel } from '../shared/FilterPanel';
import { buildFolderTree, getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';

interface WalkthroughsTabContentProps {
  kits: ArtifactFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  projectPath: string;
  onViewKit: (kit: ArtifactFile) => void;
  onReload?: () => void;
  onOptimisticMove?: (artifactPath: string, targetFolderPath: string) => (() => void);
  onConfirmMove?: (oldPath: string, newPath: string) => void;
  movingArtifacts?: Set<string>;
}

type ViewMode = 'card' | 'table';

function WalkthroughsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  projectPath,
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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);

  const isSelected = (walkthroughId: string) => isSelectedInContext(walkthroughId);

  const handleWalkthroughToggle = (walkthrough: ArtifactFile) => {
    toggleItem({
      id: walkthrough.path,
      name: walkthrough.frontMatter?.alias || walkthrough.name,
      type: 'Walkthrough',
      path: walkthrough.path,
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
    console.log('[WalkthroughFolders] 🎯 Effect triggered - walkthroughs count:', walkthroughs.length);
    console.log('[WalkthroughFolders] 📝 Walkthrough paths:', walkthroughs.map(w => w.path));

    const loadFolders = async () => {
      try {
        console.log('[WalkthroughFolders] 🔍 Fetching folders from backend...');
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
        console.log('[WalkthroughFolders] ✅ Received', loadedFolders.length, 'folders');
        console.log('[WalkthroughFolders] 📁 Folder paths:', loadedFolders.map(f => f.path));
        setFolders(loadedFolders);
        console.log('[WalkthroughFolders] 💾 Folders state updated');
      } catch (err) {
        console.error('[WalkthroughFolders] ❌ Failed to load folders:', err);
      }
    };

    // Debounce folder loading to avoid excessive calls when artifacts update rapidly
    console.log('[WalkthroughFolders] ⏱️ Starting 100ms debounce timer...');
    const timeoutId = setTimeout(() => {
      console.log('[WalkthroughFolders] ⏰ Debounce complete, loading folders now');
      loadFolders();
    }, 100); // 100ms debounce

    return () => {
      console.log('[WalkthroughFolders] 🧹 Cleanup - canceling debounce timer');
      clearTimeout(timeoutId);
    };
  }, [projectPath, walkthroughs]); // Reload when walkthroughs change (from file watcher)

  // Build folder tree when folders or walkthroughs change (memoized for performance)
  const folderTree = useMemo(() => {
    const tree = buildFolderTree(folders, filteredWalkthroughs, 'walkthroughs', projectPath);
    console.log('[WalkthroughFolders] 🌳 Built folder tree:', tree.length, 'root folders');
    tree.forEach(node => {
      console.log(`[WalkthroughFolders] 📁 ${node.folder.config?.name || node.folder.name}:`, {
        path: node.folder.path,
        children: node.children.length,
        artifacts: node.artifacts.length,
        childNames: node.children.map(c => c.folder.config?.name || c.folder.name)
      });
    });
    return tree.map(node => ({
      ...node,
      isExpanded: expandedFolders.has(node.folder.path),
    }));
  }, [folders, filteredWalkthroughs, projectPath, expandedFolders]);

  const handleViewWalkthrough = (walkthrough: ArtifactFile) => {
    onViewKit(walkthrough);
  };

  // Handle adding selected items to folder
  const handleAddToFolder = async (folder: ArtifactFolder) => {
    const selectedWalkthroughs = selectedItems.filter(item => item.type === 'Walkthrough');

    if (selectedWalkthroughs.length === 0) return;

    const rollbacks: (() => void)[] = [];

    try {
      // Optimistically update UI immediately for each item
      for (const item of selectedWalkthroughs) {
        if (item.path && onOptimisticMove) {
          const rollback = onOptimisticMove(item.path, folder.path);
          rollbacks.push(rollback);
        }
      }

      // Expand folder so user can see the item being added
      if (!expandedFolders.has(folder.path)) {
        setExpandedFolders(prev => new Set(prev).add(folder.path));
      }

      // Move all selected walkthroughs to the folder (backend operation)
      for (const item of selectedWalkthroughs) {
        if (item.path) {
          try {
            const newPath = await invokeMoveArtifactToFolder(item.path, folder.path);
            // Confirm the move with actual path from backend
            if (onConfirmMove) {
              onConfirmMove(item.path, newPath);
            }
          } catch (err) {
            console.error(`Failed to move ${item.path}:`, err);
            // Rollback this specific item
            const rollback = rollbacks.find((_, idx) => selectedWalkthroughs[idx].path === item.path);
            if (rollback) rollback();
            throw err;
          }
        }
      }

      // Don't reload folders here - it causes state mismatch with useDeferredValue
      // The file watcher will update both artifacts and folders via incremental updates
      // Optimistic updates already show the correct UI state immediately

      // Clear selection
      clearSelection();
    } catch (err) {
      console.error('Failed to move artifacts to folder:', err);
      // Rollback all optimistic updates on error
      rollbacks.forEach(rollback => rollback());
      throw err;
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

  const toggleFolderExpanded = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Handle nested folder expansion (for subfolders within folders)
  const toggleNestedFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Handle edit folder
  const handleEditFolder = (folder: ArtifactFolder) => {
    setEditingFolder(folder);
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
        description: `Deleted ${deletingFolder.config?.name || deletingFolder.name}`,
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

  // Handle folder updated (after edit)
  const handleFolderUpdated = async () => {
    // Don't reload folders here - if artifacts moved, file watcher will update them first,
    // then the folder reload effect (with walkthroughs dependency) will sync folders
    // For metadata-only changes (name, color), folders will reload from effect anyway
  };

  // Ref for filter button (used by FilterPanel for click-outside detection)
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Get root-level walkthroughs (not in folders) - must be before early returns
  const rootWalkthroughs = useMemo(() => {
    return getRootArtifacts(filteredWalkthroughs, folders, 'walkthroughs', projectPath);
  }, [filteredWalkthroughs, folders, projectPath]);

  const renderWalkthroughsTableView = () => (
    <Table.Root size="sm" variant="outline">
      <Table.Header>
        <Table.Row>
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
              _hover={{ bg: "bg.subtle" }}
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

  return (
    <Box position="relative">
      <VStack align="stretch" gap={6}>
        {/* Folders Section */}
        <Box position="relative">
          <Flex align="center" justify="space-between" gap={2} mb={4}>
            <Flex align="center" gap={2}>
              <Heading size="md">Folders</Heading>
              <Text fontSize="sm" color="text.muted">
                {folderTree.length}
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
            <HStack gap={0} borderRadius="md" overflow="hidden" bg="bg.subtle" shadow="sm">
              <Button
                onClick={() => setViewMode('card')}
                variant="ghost"
                borderRadius={0}
                borderRightWidth="1px"
                borderRightColor="border.subtle"
                bg={viewMode === 'card' ? 'bg.surface' : 'transparent'}
                color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
                _hover={{ bg: viewMode === 'card' ? 'bg.surface' : 'bg.subtle' }}
                size="sm"
              >
                <HStack gap={2}>
                  <Icon>
                    <LuLayoutGrid />
                  </Icon>
                  <Text>Cards</Text>
                </HStack>
              </Button>
              <Button
                onClick={() => setViewMode('table')}
                variant="ghost"
                borderRadius={0}
                bg={viewMode === 'table' ? 'bg.surface' : 'transparent'}
                color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
                _hover={{ bg: viewMode === 'table' ? 'bg.surface' : 'bg.subtle' }}
                size="sm"
              >
                <HStack gap={2}>
                  <Icon>
                    <LuTable />
                  </Icon>
                  <Text>Table</Text>
                </HStack>
              </Button>
            </HStack>
          </Flex>

          {folderTree.length === 0 ? (
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
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {folderTree.map((node) => (
                <FolderCard
                  key={node.folder.path}
                  node={node}
                  artifactType="walkthroughs"
                  onToggleExpand={() => toggleFolderExpanded(node.folder.path)}
                  onViewArtifact={handleViewWalkthrough}
                  onAddToFolder={handleAddToFolder}
                  onEdit={handleEditFolder}
                  onDelete={handleDeleteFolder}
                  hasCompatibleSelection={selectedItems.some(item => item.type === 'Walkthrough')}
                  renderArtifactCard={(artifact) => <Box key={artifact.path}></Box>}
                  movingArtifacts={movingArtifacts}
                  expandedNestedFolders={expandedFolders}
                  onToggleNestedFolder={toggleNestedFolder}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Table.Root size="sm" variant="outline">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader w="6"></Table.ColumnHeader>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Description</Table.ColumnHeader>
                  <Table.ColumnHeader>Tags</Table.ColumnHeader>
                  <Table.ColumnHeader>Resources</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {folderTree.map((node) => {
                  const folderName = node.folder.config?.name || node.folder.name;
                  const folderDescription = node.folder.config?.description || '';
                  const totalResources = node.artifacts.length;
                  const isExpanded = expandedFolders.has(node.folder.path);
                  
                  return (
                    <>
                      <Table.Row
                        key={node.folder.path}
                        cursor="pointer"
                        onClick={() => toggleFolderExpanded(node.folder.path)}
                        _hover={{ bg: "bg.subtle" }}
                      >
                        <Table.Cell>
                          <Icon
                            transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
                            transition='transform 0.2s'
                          >
                            <LuChevronRight />
                          </Icon>
                        </Table.Cell>
                        <Table.Cell>
                          <HStack gap={2}>
                            <Icon boxSize={4} color="blue.500">
                              <LuFolder />
                            </Icon>
                            <Text fontWeight="medium">{folderName}</Text>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell>
                          <Text fontSize="sm" color="text.secondary" lineClamp={1}>
                            {folderDescription || '—'}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          {node.folder.config?.tags && node.folder.config.tags.length > 0 ? (
                            <HStack gap={1} flexWrap="wrap">
                              {node.folder.config.tags.map((tag) => (
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
                          <Text fontSize="sm" color="text.secondary">
                            {totalResources} resource{totalResources !== 1 ? 's' : ''}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                      {isExpanded && node.artifacts.map((artifact) => {
                        const artifactSelected = isSelected(artifact.path);
                        const displayName = artifact.frontMatter?.alias || artifact.name;
                        return (
                          <Table.Row
                            key={artifact.path}
                            cursor="pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewWalkthrough(artifact);
                            }}
                            _hover={{ bg: "bg.subtle" }}
                            bg="bg.subtle"
                            data-selected={artifactSelected ? "" : undefined}
                          >
                            <Table.Cell>
                              <Checkbox.Root
                                size="sm"
                                colorPalette="blue"
                                checked={artifactSelected}
                                onCheckedChange={() => {
                                  handleWalkthroughToggle(artifact);
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
                            <Table.Cell pl={8}>
                              <Text>{displayName}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontSize="sm" color="text.secondary" lineClamp={1}>
                                {artifact.frontMatter?.description || '—'}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              {artifact.frontMatter?.tags && artifact.frontMatter.tags.length > 0 ? (
                                <HStack gap={1} flexWrap="wrap">
                                  {artifact.frontMatter.tags.map((tag) => (
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
                              <Text fontSize="sm" color="text.tertiary">—</Text>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </>
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
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {rootWalkthroughs.map((walkthrough) => (
                <Card.Root
                  key={walkthrough.path}
                  variant="subtle"
                  borderWidth={isSelected(walkthrough.path) ? "2px" : "1px"}
                  borderColor={isSelected(walkthrough.path) ? "primary.500" : "border.subtle"}
                  bg={isSelected(walkthrough.path) ? "primary.hover.bg" : undefined}
                  position="relative"
                  cursor="pointer"
                  onClick={() => handleViewWalkthrough(walkthrough)}
                  _hover={{ borderColor: "primary.400", bg: "primary.hover.bg" }}
                  height="100%"
                  display="flex"
                  flexDirection="column"
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

      <EditFolderDialog
        isOpen={!!editingFolder}
        onClose={() => setEditingFolder(null)}
        folder={editingFolder}
        artifacts={walkthroughs}
        artifactType="walkthroughs"
        projectPath={projectPath}
        onUpdated={handleFolderUpdated}
        onOptimisticMove={onOptimisticMove}
        onConfirmMove={onConfirmMove}
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






