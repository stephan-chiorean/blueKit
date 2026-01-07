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
import { LuFilter, LuFolderPlus, LuChevronRight, LuFolder } from 'react-icons/lu';
import { BsBoxes } from 'react-icons/bs';
import { ArtifactFile, ArtifactFolder, FolderConfig, FolderTreeNode, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeMoveArtifactToFolder, invokeDeleteArtifactFolder } from '../../ipc';
import { ViewModeSwitcher, STANDARD_VIEW_MODES } from '../shared/ViewModeSwitcher';
import { useSelection } from '../../contexts/SelectionContext';
import { FolderCard } from '../shared/FolderCard';
import { CreateFolderDialog } from '../shared/CreateFolderDialog';
import EditFolderDialog from '../shared/EditFolderDialog';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { KitContextMenu } from './KitContextMenu';
import { FilterPanel } from '../shared/FilterPanel';
import { buildFolderTree, getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';

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

type ViewMode = 'card' | 'table' | 'blueprints';

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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ArtifactFolder | null>(null);
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

    // Debounce folder loading to avoid excessive calls when artifacts update rapidly
    const timeoutId = setTimeout(() => {
      loadFolders();
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [projectPath, kits]); // Reload when kits change (from file watcher)

  // Build folder tree when folders or kits change (memoized for performance)
  // Use all kits (unfiltered) for folders since filter only applies to root-level kits
  const folderTree = useMemo(() => {
    const tree = buildFolderTree(folders, kits, 'kits', projectPath);
    return tree.map(node => ({
      ...node,
      isExpanded: expandedFolders.has(node.folder.path),
    }));
  }, [folders, kits, projectPath, expandedFolders]);

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

  // Handle adding selected items to folder
  const handleAddToFolder = async (folder: ArtifactFolder) => {
    const selectedKits = selectedItems.filter(item => item.type === 'Kit');

    if (selectedKits.length === 0) return;

    const rollbacks: (() => void)[] = [];

    try {
      // Optimistically update UI immediately for each item
      for (const item of selectedKits) {
        if (item.path && onOptimisticMove) {
          const rollback = onOptimisticMove(item.path, folder.path);
          rollbacks.push(rollback);
        }
      }

      // Expand folder so user can see the item being added
      if (!expandedFolders.has(folder.path)) {
        setExpandedFolders(prev => new Set(prev).add(folder.path));
      }

      // Move all selected kits to the folder (backend operation)
      for (const item of selectedKits) {
        if (item.path) {
          try {
            const newPath = await invokeMoveArtifactToFolder(item.path, folder.path);
            // Confirm the move with actual path from backend
            // This updates the artifact path in the artifacts state immediately
            if (onConfirmMove) {
              onConfirmMove(item.path, newPath);
            }
          } catch (err) {
            console.error(`Failed to move ${item.path}:`, err);
            // Rollback this specific item
            const rollback = rollbacks.find((_, idx) => selectedKits[idx].path === item.path);
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

  // Handle removing selected items from folder
  const handleRemoveFromFolder = async (folder: ArtifactFolder) => {
    const selectedKits = selectedItems.filter(item => item.type === 'Kit');

    if (selectedKits.length === 0) return;

    // Calculate artifact type root directory
    const artifactTypeRoot = `${projectPath}/.bluekit/kits`;
    const rollbacks: (() => void)[] = [];

    try {
      // Optimistically update UI immediately for each item
      for (const item of selectedKits) {
        if (item.path && onOptimisticMove) {
          const rollback = onOptimisticMove(item.path, artifactTypeRoot);
          rollbacks.push(rollback);
        }
      }

      // Move all selected kits back to the artifact type root directory
      for (const item of selectedKits) {
        if (item.path) {
          try {
            const newPath = await invokeMoveArtifactToFolder(item.path, artifactTypeRoot);
            // Confirm the move with actual path from backend
            if (onConfirmMove) {
              onConfirmMove(item.path, newPath);
            }
          } catch (err) {
            console.error(`Failed to remove ${item.path}:`, err);
            // Rollback this specific item
            const rollback = rollbacks.find((_, idx) => selectedKits[idx].path === item.path);
            if (rollback) rollback();
            throw err;
          }
        }
      }

      // Clear selection
      clearSelection();
    } catch (err) {
      console.error('Failed to remove artifacts from folder:', err);
      // Rollback all optimistic updates on error
      rollbacks.forEach(rollback => rollback());
      toaster.create({
        type: 'error',
        title: 'Failed to remove artifacts',
        description: err instanceof Error ? err.message : 'Unknown error',
        closable: true,
      });
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
      await invokeCreateArtifactFolder(projectPath, 'kits', null, name, fullConfig);
      const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
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
      // then the folder reload effect (with kits dependency) will sync folders
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
    // then the folder reload effect (with kits dependency) will sync folders
    // For metadata-only changes (name, color), folders will reload from effect anyway
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

  const renderKitsTableView = () => (
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
        <Table.Row
          css={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderBottomWidth: '1px',
            borderBottomColor: 'rgba(0, 0, 0, 0.08)',
            _dark: {
              background: 'rgba(30, 30, 30, 0.85)',
              borderBottomColor: 'rgba(255, 255, 255, 0.15)',
            },
          }}
        >
          <Table.ColumnHeader w="6">
              <Checkbox.Root
              size="sm"
              colorPalette="blue"
              checked={rootKits.length > 0 && rootKits.every(kit => isSelected(kit.path))}
              onCheckedChange={(changes) => {
                rootKits.forEach(kit => {
                  if (changes.checked && !isSelected(kit.path)) {
                    handleKitToggle(kit);
                  } else if (!changes.checked && isSelected(kit.path)) {
                    handleKitToggle(kit);
                  }
                });
              }}
              cursor="pointer"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control cursor="pointer">
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
        {rootKits.map((kit) => {
          const kitSelected = isSelected(kit.path);
          const displayName = kit.frontMatter?.alias || kit.name;
          const description = kit.frontMatter?.description || kit.path;
          const isBase = kit.frontMatter?.is_base === true;
          return (
            <Table.Row
              key={kit.path}
              cursor="pointer"
              onClick={() => handleViewKit(kit)}
              onContextMenu={(e) => handleContextMenu(e, kit)}
              bg="transparent"
              _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
              data-selected={kitSelected ? "" : undefined}
            >
              <Table.Cell>
                <Checkbox.Root
                  size="sm"
                  colorPalette="blue"
                  checked={kitSelected}
                  onCheckedChange={() => {
                    handleKitToggle(kit);
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
                {kit.frontMatter?.tags && kit.frontMatter.tags.length > 0 ? (
                  <HStack gap={1} flexWrap="wrap">
                    {kit.frontMatter.tags.map((tag) => (
                      <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                        <Tag.Label>#{tag}</Tag.Label>
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

  return (
    <Box position="relative" width="100%" maxW="100%">
      <VStack align="stretch" gap={6} width="100%">
        {/* Folders Section - only show if folders exist */}
        {folderTree.length > 0 && (
          <Box position="relative">
            <Flex align="center" justify="space-between" gap={2} mb={4}>
              <Flex align="center" gap={2}>
                <Heading size="md">Folders</Heading>
                <Text fontSize="sm" color="text.muted">
                  {folderTree.length}
                </Text>
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
                  { id: 'blueprints', label: 'Blueprints', icon: BsBoxes },
                ]}
              />
            </Flex>

            {viewMode === 'card' ? (
              <SimpleGrid 
                columns={{ base: 1, md: 2, lg: 3 }} 
                gap={4} 
                width="100%" 
                maxW="100%"
                overflow="visible"
                css={{
                  alignItems: 'start',
                }}
              >
                {folderTree.map((node) => (
                  <FolderCard
                    key={node.folder.path}
                    node={node}
                    artifactType="kits"
                    onToggleExpand={() => toggleFolderExpanded(node.folder.path)}
                    onViewArtifact={handleViewKit}
                    onAddToFolder={handleAddToFolder}
                    onRemoveFromFolder={handleRemoveFromFolder}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                    hasCompatibleSelection={selectedItems.some(item => item.type === 'Kit')}
                    renderArtifactCard={(artifact) => <Box key={artifact.path}></Box>}
                    movingArtifacts={movingArtifacts}
                    expandedNestedFolders={expandedFolders}
                    onToggleNestedFolder={toggleNestedFolder}
                  />
                ))}
              </SimpleGrid>
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
                  <Table.Row
                    css={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      borderBottomWidth: '1px',
                      borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                      _dark: {
                        background: 'rgba(30, 30, 30, 0.85)',
                        borderBottomColor: 'rgba(255, 255, 255, 0.15)',
                      },
                    }}
                  >
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
                          bg="transparent"
                          _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
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
                                    <Tag.Label>#{tag}</Tag.Label>
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
                                handleViewKit(artifact);
                              }}
                              onContextMenu={(e) => {
                                e.stopPropagation();
                                handleContextMenu(e, artifact);
                              }}
                              _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                              bg="rgba(255, 255, 255, 0.05)"
                              data-selected={artifactSelected ? "" : undefined}
                            >
                              <Table.Cell>
                                <Checkbox.Root
                                  size="sm"
                                  colorPalette="blue"
                                  checked={artifactSelected}
                                  onCheckedChange={() => {
                                    handleKitToggle(artifact);
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
                                        <Tag.Label>#{tag}</Tag.Label>
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
                bg={isKitsFilterOpen ? "bg.subtle" : "bg.subtle"}
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
            {folderTree.length === 0 && (
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
                  : 'No kits at root level. All kits are organized in folders.'}
              </Text>
            </Box>
          ) : viewMode === 'card' ? (
            <SimpleGrid 
              columns={{ base: 1, md: 2, lg: 3 }} 
              gap={4} 
              width="100%" 
              maxW="100%"
              overflow="visible"
              css={{
                alignItems: 'start',
              }}
            >
              {rootKits.map((kit) => (
                <Card.Root
                  key={kit.path}
                  borderWidth={isSelected(kit.path) ? "2px" : "1px"}
                  borderRadius="16px"
                  position="relative"
                  cursor="pointer"
                  onClick={() => handleViewKit(kit)}
                  onContextMenu={(e) => handleContextMenu(e, kit)}
                  transition="all 0.2s ease-in-out"
                  height="100%"
                  display="flex"
                  flexDirection="column"
                  css={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    borderColor: isSelected(kit.path) ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                    _dark: {
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderColor: isSelected(kit.path) ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.15)',
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
                        <Heading size="md">{kit.frontMatter?.alias || kit.name}</Heading>
                        {kit.frontMatter?.is_base && (
                          <Icon as={ImTree} boxSize={5} color="primary.500" flexShrink={0} />
                        )}
                      </HStack>
                      <Checkbox.Root
                        checked={isSelected(kit.path)}
                        colorPalette="blue"
                        onCheckedChange={() => handleKitToggle(kit)}
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
                      {kit.frontMatter?.description || kit.path}
                    </Text>
                    {kit.frontMatter?.tags && kit.frontMatter.tags.length > 0 && (
                      <HStack gap={2} flexWrap="wrap" mt="auto">
                        {kit.frontMatter.tags.map((tag) => (
                          <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                            <Tag.Label>#{tag}</Tag.Label>
                          </Tag.Root>
                        ))}
                      </HStack>
                    )}
                  </CardBody>
                </Card.Root>
              ))}
            </SimpleGrid>
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
          ) : viewMode === 'table' ? (
            renderKitsTableView()
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
        artifacts={kits}
        artifactType="kits"
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

      <KitContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        kit={contextMenu.kit}
        onClose={closeContextMenu}
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

