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
  Button,
  IconButton,
  Table,
  VStack,
  Input,
  InputGroup,
  Field,
} from '@chakra-ui/react';
import { ImTree } from 'react-icons/im';
import { LuLayoutGrid, LuTable, LuX, LuFilter, LuFolderPlus } from 'react-icons/lu';
import { ArtifactFile, ArtifactFolder, FolderConfig, FolderTreeNode, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeMoveArtifactToFolder, invokeDeleteArtifactFolder } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';
import { FolderCard } from '../shared/FolderCard';
import { CreateFolderDialog } from '../shared/CreateFolderDialog';
import EditFolderDialog from '../shared/EditFolderDialog';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { buildFolderTree, getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';

interface KitsTabContentProps {
  kits: ArtifactFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  projectPath: string;
  onViewKit: (kit: ArtifactFile) => void;
  onReload?: () => void;
}

type ViewMode = 'card' | 'table';

export default function KitsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  projectPath,
  onViewKit,
  onReload,
}: KitsTabContentProps) {
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

  const isSelected = (kitId: string) => isSelectedInContext(kitId);

  const handleKitToggle = (kit: ArtifactFile) => {
    toggleItem({
      id: kit.path,
      name: kit.frontMatter?.alias || kit.name,
      type: 'Kit',
      path: kit.path,
    });
  };

  // Get all unique tags from kits
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
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'kits');
        setFolders(loadedFolders);
      } catch (err) {
        console.error('Failed to load folders:', err);
      }
    };

    loadFolders();
  }, [projectPath]);

  // Build folder tree when folders or kits change
  useEffect(() => {
    const tree = buildFolderTree(folders, filteredKits, 'kits', projectPath);
    setFolderTree(tree.map(node => ({
      ...node,
      isExpanded: expandedFolders.has(node.folder.path),
    })));
  }, [folders, filteredKits, projectPath, expandedFolders]);

  const handleViewKit = (kit: ArtifactFile) => {
    onViewKit(kit);
  };

  // Handle adding selected items to folder
  const handleAddToFolder = async (folder: ArtifactFolder) => {
    const selectedKits = selectedItems.filter(item => item.type === 'Kit');

    if (selectedKits.length === 0) return;

    try {
      // Move all selected kits to the folder
      for (const item of selectedKits) {
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
      const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
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
    const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
    setFolders(newFolders);

    if (onReload) {
      onReload();
    }
  };

  // Refs for filter panel and button to detect outside clicks
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterOpen &&
        filterPanelRef.current &&
        filterButtonRef.current &&
        !filterPanelRef.current.contains(event.target as Node) &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

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

  const renderTableView = () => (
    <Table.Root size="sm" variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader w="6">
              <Checkbox.Root
              size="sm"
              colorPalette="blue"
              checked={filteredKits.length > 0 && filteredKits.every(kit => isSelected(kit.path))}
              onCheckedChange={(changes) => {
                filteredKits.forEach(kit => {
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
        {filteredKits.map((kit) => {
          const kitSelected = isSelected(kit.path);
          const displayName = kit.frontMatter?.alias || kit.name;
          const description = kit.frontMatter?.description || kit.path;
          const isBase = kit.frontMatter?.is_base === true;
          return (
            <Table.Row
              key={kit.path}
              cursor="pointer"
              onClick={() => handleViewKit(kit)}
              _hover={{ bg: "bg.subtle" }}
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
          <Flex justify="space-between" align="center">
            {/* New Folder Button */}
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

            <HStack gap={2}>
              {/* Filter Button */}
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
                </HStack>
              </Button>

              {/* View Mode Switcher */}
              <HStack gap={0} borderWidth="1px" borderColor="border.subtle" borderRadius="md" overflow="hidden" bg="bg.subtle">
                <Button
                  onClick={() => setViewMode('card')}
                  variant="ghost"
                  borderRadius={0}
                  borderRightWidth="1px"
                  borderRightColor="border.subtle"
                  bg={viewMode === 'card' ? 'white' : 'transparent'}
                  color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
                  _hover={{ bg: viewMode === 'card' ? 'white' : 'bg.subtle' }}
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
                  bg={viewMode === 'table' ? 'white' : 'transparent'}
                  color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
                  _hover={{ bg: viewMode === 'table' ? 'white' : 'bg.subtle' }}
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuTable />
                    </Icon>
                    <Text>Table</Text>
                  </HStack>
                </Button>
              </HStack>
            </HStack>
          </Flex>

        {/* Filter Overlay */}
        {isFilterOpen && (
          <Box
            ref={filterPanelRef}
            position="absolute"
            top="50px"
            left={0}
            zIndex={10}
            w="300px"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="md"
            p={4}
            bg="white"
            boxShadow="lg"
          >
            <VStack align="stretch" gap={4}>
              <Field.Root>
                <Field.Label>Name</Field.Label>
                <InputGroup
                  endElement={nameFilter ? (
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label="Clear name filter"
                      onClick={() => setNameFilter('')}
                    >
                      <Icon>
                        <LuX />
                      </Icon>
                    </IconButton>
                  ) : undefined}
                >
                  <Input
                    placeholder="Filter by name..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                </InputGroup>
              </Field.Root>

              {allTags.length > 0 && (
                <Field.Root>
                  <Field.Label>Tags</Field.Label>
                  <HStack gap={1} flexWrap="wrap" mt={2}>
                    {allTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <Tag.Root
                          key={tag}
                          size="sm"
                          variant={isSelected ? 'solid' : 'subtle'}
                          colorPalette={isSelected ? 'primary' : undefined}
                          cursor="pointer"
                          onClick={() => toggleTag(tag)}
                          opacity={isSelected ? 1 : 0.6}
                          _hover={{ opacity: 1 }}
                        >
                          <Tag.Label>{tag}</Tag.Label>
                        </Tag.Root>
                      );
                    })}
                  </HStack>
                </Field.Root>
              )}
            </VStack>
          </Box>
        )}

        {/* Content */}
        {filteredKits.length === 0 ? (
          <Box textAlign="center" py={12} color="text.secondary">
            No kits match the current filters.
          </Box>
        ) : (
          viewMode === 'card' ? (
            <div
              style={{
                columnCount: 3,
                columnGap: '16px',
              }}
            >
              {/* Folders first */}
              {folderTree.map((node) => (
                <div
                  key={node.folder.path}
                  style={{
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                    marginBottom: '16px',
                    display: 'inline-block',
                    width: '100%',
                    WebkitColumnBreakInside: 'avoid',
                  } as React.CSSProperties}
                >
                  <FolderCard
                    node={node}
                    artifactType="kits"
                    onToggleExpand={() => toggleFolderExpanded(node.folder.path)}
                    onViewArtifact={handleViewKit}
                    onAddToFolder={handleAddToFolder}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                    hasCompatibleSelection={selectedItems.some(item => item.type === 'Kit')}
                    renderArtifactCard={(artifact) => <Box key={artifact.path}></Box>}
                  />
                </div>
              ))}

              {/* Root-level artifacts */}
              {getRootArtifacts(filteredKits, folders, 'kits', projectPath).map((kit) => (
                <div
                  key={kit.path}
                  style={{
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                    marginBottom: '16px',
                    display: 'inline-block',
                    width: '100%',
                    WebkitColumnBreakInside: 'avoid',
                  } as React.CSSProperties}
                >
                  <Card.Root
                    variant="subtle"
                    borderWidth={isSelected(kit.path) ? "2px" : "1px"}
                    borderColor={isSelected(kit.path) ? "primary.500" : "border.subtle"}
                    bg={isSelected(kit.path) ? "primary.50" : undefined}
                    position="relative"
                    cursor="pointer"
                    onClick={() => handleViewKit(kit)}
                    _hover={{ borderColor: "primary.400", bg: "primary.50" }}
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
                              <Tag.Label>{tag}</Tag.Label>
                            </Tag.Root>
                          ))}
                        </HStack>
                      )}
                    </CardBody>
                  </Card.Root>
                </div>
              ))}
            </div>
          ) : (
            renderTableView()
          )
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
        artifacts={kits}
        artifactType="kits"
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

