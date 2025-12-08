import { useState, useMemo, useEffect, useRef } from 'react';
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
} from '@chakra-ui/react';
import { ImTree } from 'react-icons/im';
import { ArtifactFile, ArtifactFolder, FolderConfig, FolderTreeNode, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeMoveArtifactToFolder, invokeDeleteArtifactFolder } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';
import { FolderCard } from '../shared/FolderCard';
import { CreateFolderDialog } from '../shared/CreateFolderDialog';
import EditFolderDialog from '../shared/EditFolderDialog';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { ArtifactActionBar } from '../shared/ArtifactActionBar';
import { FilterPanel } from '../shared/FilterPanel';
import { MasonryLayout, MasonryItem } from '../shared/MasonryLayout';
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
}

type ViewMode = 'card' | 'table';

export default function WalkthroughsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  projectPath,
  onViewKit,
  onReload,
}: WalkthroughsTabContentProps) {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection } = useSelection();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
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
    const loadFolders = async () => {
      try {
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
        setFolders(loadedFolders);
      } catch (err) {
        console.error('Failed to load folders:', err);
      }
    };

    loadFolders();
  }, [projectPath]);

  // Build folder tree when folders or walkthroughs change
  useEffect(() => {
    const tree = buildFolderTree(folders, filteredWalkthroughs, 'walkthroughs', projectPath);
    setFolderTree(tree.map(node => ({
      ...node,
      isExpanded: expandedFolders.has(node.folder.path),
    })));
  }, [folders, filteredWalkthroughs, projectPath, expandedFolders]);

  const handleViewWalkthrough = (walkthrough: ArtifactFile) => {
    onViewKit(walkthrough);
  };

  // Handle adding selected items to folder
  const handleAddToFolder = async (folder: ArtifactFolder) => {
    const selectedWalkthroughs = selectedItems.filter(item => item.type === 'Walkthrough');

    if (selectedWalkthroughs.length === 0) return;

    try {
      // Move all selected walkthroughs to the folder
      for (const item of selectedWalkthroughs) {
        if (item.path) {
          await invokeMoveArtifactToFolder(item.path, folder.path);
        }
      }

      // Clear selection and reload
      clearSelection();
      if (onReload) {
        onReload();
      }
    } catch (err) {
      console.error('Failed to move artifacts to folder:', err);
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

      // Reload folders
      const newFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
      setFolders(newFolders);

      if (onReload) {
        onReload();
      }
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
    // Reload folders
    const newFolders = await invokeGetArtifactFolders(projectPath, 'walkthroughs');
    setFolders(newFolders);

    if (onReload) {
      onReload();
    }
  };

  // Ref for filter button (used by FilterPanel for click-outside detection)
  const filterButtonRef = useRef<HTMLButtonElement>(null);

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

  const renderTableView = () => (
    <Table.Root size="sm" variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader w="6">
            <Checkbox.Root
              size="sm"
              colorPalette="blue"
              checked={filteredWalkthroughs.length > 0 && filteredWalkthroughs.every(walkthrough => isSelected(walkthrough.path))}
              onCheckedChange={(changes) => {
                filteredWalkthroughs.forEach(walkthrough => {
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
        {filteredWalkthroughs.map((walkthrough) => {
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

  return (
    <Box position="relative">
        {/* Main Content */}
        <VStack align="stretch" gap={4}>
          <ArtifactActionBar
            onNewFolder={() => setIsCreateFolderOpen(true)}
            onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
            isFilterOpen={isFilterOpen}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showViewModeSwitcher={true}
            filterButtonRef={filterButtonRef}
          />

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

        {/* Content */}
        {filteredWalkthroughs.length === 0 ? (
          <Box textAlign="center" py={12} color="text.secondary">
            No walkthroughs match the current filters.
          </Box>
        ) : viewMode === 'card' ? (
          <MasonryLayout columnCount={3}>
            {/* Folders first */}
            {folderTree.map((node) => (
              <MasonryItem key={node.folder.path}>
                <FolderCard
                  node={node}
                  artifactType="walkthroughs"
                  onToggleExpand={() => toggleFolderExpanded(node.folder.path)}
                  onViewArtifact={handleViewWalkthrough}
                  onAddToFolder={handleAddToFolder}
                  onEdit={handleEditFolder}
                  onDelete={handleDeleteFolder}
                  hasCompatibleSelection={selectedItems.some(item => item.type === 'Walkthrough')}
                  renderArtifactCard={(artifact) => <Box key={artifact.path}></Box>}
                />
              </MasonryItem>
            ))}

            {/* Root-level walkthroughs */}
            {getRootArtifacts(filteredWalkthroughs, folders, 'walkthroughs', projectPath).map((walkthrough) => (
              <MasonryItem key={walkthrough.path}>
                <Card.Root
                  variant="subtle"
                  borderWidth={isSelected(walkthrough.path) ? "2px" : "1px"}
                  borderColor={isSelected(walkthrough.path) ? "primary.500" : "border.subtle"}
                  bg={isSelected(walkthrough.path) ? "primary.50" : undefined}
                  position="relative"
                  cursor="pointer"
                  onClick={() => handleViewWalkthrough(walkthrough)}
                  _hover={{ borderColor: "primary.400", bg: "primary.50" }}
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
                </MasonryItem>
              ))}
            </MasonryLayout>
          ) : (
          renderTableView()
        )}
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






