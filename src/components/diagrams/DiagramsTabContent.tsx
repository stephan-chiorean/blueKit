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
  EmptyState,
  Checkbox,
  VStack,
  Button,
  Table,
  Tag,
  SimpleGrid,
} from '@chakra-ui/react';
import { LuNetwork, LuFolderPlus, LuLayoutGrid, LuTable, LuChevronRight, LuFolder } from 'react-icons/lu';
import { useState, useEffect, useMemo, memo } from 'react';
import { ArtifactFile, ArtifactFolder, FolderConfig, FolderTreeNode, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeMoveArtifactToFolder, invokeDeleteArtifactFolder } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';
import { FolderCard } from '../shared/FolderCard';
import { CreateFolderDialog } from '../shared/CreateFolderDialog';
import EditFolderDialog from '../shared/EditFolderDialog';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { buildFolderTree, getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';

interface DiagramsTabContentProps {
  diagrams: ArtifactFile[];
  diagramsLoading: boolean;
  error: string | null;
  projectPath: string;
  onViewDiagram: (diagram: ArtifactFile) => void;
  onReload?: () => void;
  onOptimisticMove?: (artifactPath: string, targetFolderPath: string) => (() => void);
  onConfirmMove?: (oldPath: string, newPath: string) => void;
  movingArtifacts?: Set<string>;
}

function DiagramsTabContent({
  diagrams,
  diagramsLoading,
  error,
  projectPath,
  onViewDiagram,
  onReload,
  onOptimisticMove,
  onConfirmMove,
  movingArtifacts = new Set(),
}: DiagramsTabContentProps) {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection } = useSelection();

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const isSelected = (diagramId: string) => isSelectedInContext(diagramId);

  const handleDiagramToggle = (diagram: ArtifactFile) => {
    toggleItem({
      id: diagram.path,
      name: diagram.frontMatter?.alias || diagram.name,
      type: 'Diagram',
      path: diagram.path,
    });
  };

  // Handle clicking on a diagram - diagrams already have front matter from parent
  const handleDiagramClick = (diagram: ArtifactFile) => {
    onViewDiagram(diagram);
  };

  // Load folders from backend
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const loadedFolders = await invokeGetArtifactFolders(projectPath, 'diagrams');
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
  }, [projectPath, diagrams]); // Reload when diagrams change (from file watcher)

  // Build folder tree when folders or diagrams change (memoized for performance)
  const folderTree = useMemo(() => {
    const tree = buildFolderTree(folders, diagrams, 'diagrams', projectPath);
    return tree.map(node => ({
      ...node,
      isExpanded: expandedFolders.has(node.folder.path),
    }));
  }, [folders, diagrams, projectPath, expandedFolders]);

  // Handle adding selected items to folder
  const handleAddToFolder = async (folder: ArtifactFolder) => {
    const selectedDiagrams = selectedItems.filter(item => item.type === 'Diagram');

    if (selectedDiagrams.length === 0) return;

    const rollbacks: (() => void)[] = [];

    try {
      // Optimistically update UI immediately for each item
      for (const item of selectedDiagrams) {
        if (item.path && onOptimisticMove) {
          const rollback = onOptimisticMove(item.path, folder.path);
          rollbacks.push(rollback);
        }
      }

      // Expand folder so user can see the item being added
      if (!expandedFolders.has(folder.path)) {
        setExpandedFolders(prev => new Set(prev).add(folder.path));
      }

      // Move all selected diagrams to the folder (backend operation)
      for (const item of selectedDiagrams) {
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
            const rollback = rollbacks.find((_, idx) => selectedDiagrams[idx].path === item.path);
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
      await invokeCreateArtifactFolder(projectPath, 'diagrams', null, name, fullConfig);
      const newFolders = await invokeGetArtifactFolders(projectPath, 'diagrams');
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
      // then the folder reload effect (with diagrams dependency) will sync folders
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
    // then the folder reload effect (with diagrams dependency) will sync folders
    // For metadata-only changes (name, color), folders will reload from effect anyway
  };

  // Get root-level diagrams (not in folders) - must be before early returns
  const rootDiagrams = useMemo(() => {
    return getRootArtifacts(diagrams, folders, 'diagrams', projectPath);
  }, [diagrams, folders, projectPath]);

  if (diagramsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading diagrams...
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

  if (diagrams.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon boxSize={12} color="text.tertiary">
                <LuNetwork />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>No diagrams found</EmptyState.Title>
            <EmptyState.Description>
              Add .mmd or .mermaid files to .bluekit/diagrams to see them here.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Box>
    );
  }

  return (
    <Box position="relative">
      <VStack align="stretch" gap={6}>
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

            {viewMode === 'card' ? (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {folderTree.map((node) => (
                  <FolderCard
                    key={node.folder.path}
                    node={node}
                    artifactType="diagrams"
                    onToggleExpand={() => toggleFolderExpanded(node.folder.path)}
                    onViewArtifact={handleDiagramClick}
                    onAddToFolder={handleAddToFolder}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                    hasCompatibleSelection={selectedItems.some(item => item.type === 'Diagram')}
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
                                handleDiagramClick(artifact);
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
                                    handleDiagramToggle(artifact);
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
                                <HStack gap={2}>
                                  <Icon boxSize={4} color="primary.500">
                                    <LuNetwork />
                                  </Icon>
                                  <Text>{displayName}</Text>
                                </HStack>
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
        )}

        {/* Diagrams Section */}
        <Box mb={8} position="relative">
          <Flex align="center" gap={2} mb={4}>
            <Heading size="md">Diagrams</Heading>
            <Text fontSize="sm" color="text.muted">
              {rootDiagrams.length}
            </Text>
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

          {rootDiagrams.length === 0 ? (
            <Box
              p={6}
              bg="bg.subtle"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
            >
              <Text color="text.muted" fontSize="sm">
                No diagrams at root level. All diagrams are organized in folders.
              </Text>
            </Box>
          ) : viewMode === 'card' ? (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {rootDiagrams.map((diagram) => {
                const diagramSelected = isSelected(diagram.path);
                const displayName = diagram.frontMatter?.alias || diagram.name;
                const description = diagram.frontMatter?.description || diagram.path;
                return (
                  <Box
                    key={diagram.path}
                    borderWidth="2px"
                    borderColor={diagramSelected ? "primary.500" : "transparent"}
                    borderRadius="md"
                    transition="border-color 0.2s"
                    boxSizing="border-box"
                    height="100%"
                  >
                    <Card.Root
                      variant="subtle"
                      borderWidth="1px"
                      borderColor={diagramSelected ? "transparent" : "border.subtle"}
                      bg={diagramSelected ? "primary.hover.bg" : undefined}
                      cursor="pointer"
                      onClick={() => handleDiagramClick(diagram)}
                      _hover={{ borderColor: diagramSelected ? "transparent" : "primary.400", bg: "primary.hover.bg" }}
                      transition="all 0.2s"
                      height="100%"
                      display="flex"
                      flexDirection="column"
                    >
                      <CardHeader>
                        <Flex align="center" justify="space-between" gap={4}>
                          <HStack gap={2} align="center" flex="1">
                            <Icon boxSize={5} color="primary.500">
                              <LuNetwork />
                            </Icon>
                            <Heading size="md">{displayName}</Heading>
                          </HStack>
                          <Checkbox.Root
                            checked={diagramSelected}
                            colorPalette="blue"
                            onCheckedChange={() => handleDiagramToggle(diagram)}
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
                          {description}
                        </Text>
                        <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                          {diagram.path}
                        </Text>
                      </CardBody>
                    </Card.Root>
                  </Box>
                );
              })}
            </SimpleGrid>
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
        artifacts={diagrams}
        artifactType="diagrams"
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
export default memo(DiagramsTabContent, (prevProps, nextProps) => {
  return (
    prevProps.diagrams === nextProps.diagrams &&
    prevProps.diagramsLoading === nextProps.diagramsLoading &&
    prevProps.error === nextProps.error &&
    prevProps.projectPath === nextProps.projectPath &&
    prevProps.onViewDiagram === nextProps.onViewDiagram &&
    prevProps.onReload === nextProps.onReload
  );
});

