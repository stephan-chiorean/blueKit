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
} from '@chakra-ui/react';
import { LuNetwork } from 'react-icons/lu';
import { useState, useEffect, useRef } from 'react';
import { ArtifactFile, ArtifactFolder, FolderConfig, FolderTreeNode, invokeGetArtifactFolders, invokeCreateArtifactFolder, invokeMoveArtifactToFolder, invokeDeleteArtifactFolder } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';
import { FolderCard } from '../shared/FolderCard';
import { CreateFolderDialog } from '../shared/CreateFolderDialog';
import EditFolderDialog from '../shared/EditFolderDialog';
import DeleteFolderDialog from '../shared/DeleteFolderDialog';
import { ArtifactActionBar } from '../shared/ArtifactActionBar';
import { MasonryLayout, MasonryItem } from '../shared/MasonryLayout';
import { buildFolderTree, getRootArtifacts } from '../../utils/buildFolderTree';
import { toaster } from '../ui/toaster';

interface DiagramsTabContentProps {
  diagrams: ArtifactFile[];
  diagramsLoading: boolean;
  error: string | null;
  projectPath: string;
  onViewDiagram: (diagram: ArtifactFile) => void;
  onReload?: () => void;
}

export default function DiagramsTabContent({
  diagrams,
  diagramsLoading,
  error,
  projectPath,
  onViewDiagram,
  onReload,
}: DiagramsTabContentProps) {
  const { isSelected: isSelectedInContext, toggleItem, selectedItems, clearSelection } = useSelection();

  // Folder-related state
  const [folders, setFolders] = useState<ArtifactFolder[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ArtifactFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ArtifactFolder | null>(null);

  // Ref for filter button (used by ArtifactActionBar)
  const filterButtonRef = useRef<HTMLButtonElement>(null);

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

    loadFolders();
  }, [projectPath]);

  // Build folder tree when folders or diagrams change
  useEffect(() => {
    const tree = buildFolderTree(folders, diagrams, 'diagrams', projectPath);
    setFolderTree(tree.map(node => ({
      ...node,
      isExpanded: expandedFolders.has(node.folder.path),
    })));
  }, [folders, diagrams, projectPath, expandedFolders]);

  // Handle adding selected items to folder
  const handleAddToFolder = async (folder: ArtifactFolder) => {
    const selectedDiagrams = selectedItems.filter(item => item.type === 'Diagram');

    if (selectedDiagrams.length === 0) return;

    try {
      // Move all selected diagrams to the folder
      for (const item of selectedDiagrams) {
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
      const newFolders = await invokeGetArtifactFolders(projectPath, 'diagrams');
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
    const newFolders = await invokeGetArtifactFolders(projectPath, 'diagrams');
    setFolders(newFolders);

    if (onReload) {
      onReload();
    }
  };

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
        <VStack align="stretch" gap={4}>
          <ArtifactActionBar
            onNewFolder={() => setIsCreateFolderOpen(true)}
            onToggleFilter={() => {}}
            isFilterOpen={false}
            viewMode="card"
            onViewModeChange={() => {}}
            showViewModeSwitcher={false}
            filterButtonRef={filterButtonRef}
          />

          <MasonryLayout columnCount={3}>
            {/* Folders first */}
            {folderTree.map((node) => (
              <MasonryItem key={node.folder.path}>
                <FolderCard
                  node={node}
                  artifactType="diagrams"
                  onToggleExpand={() => toggleFolderExpanded(node.folder.path)}
                  onViewArtifact={handleDiagramClick}
                  onAddToFolder={handleAddToFolder}
                  onEdit={handleEditFolder}
                  onDelete={handleDeleteFolder}
                  hasCompatibleSelection={selectedItems.some(item => item.type === 'Diagram')}
                  renderArtifactCard={(artifact) => <Box key={artifact.path}></Box>}
                />
              </MasonryItem>
            ))}

            {/* Root-level diagrams */}
            {getRootArtifacts(diagrams, folders, 'diagrams', projectPath).map((diagram) => {
            const diagramSelected = isSelected(diagram.path);
            const displayName = diagram.frontMatter?.alias || diagram.name;
            const description = diagram.frontMatter?.description || diagram.path;
            return (
              <MasonryItem key={diagram.path}>
                <Card.Root
                  variant="subtle"
                  borderWidth={diagramSelected ? "2px" : "1px"}
                  borderColor={diagramSelected ? "primary.500" : "border.subtle"}
                  bg={diagramSelected ? "primary.50" : undefined}
                  cursor="pointer"
                  onClick={() => handleDiagramClick(diagram)}
                  _hover={{ borderColor: "primary.400", bg: "primary.50" }}
                  transition="all 0.2s"
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
              </MasonryItem>
            );
          })}
        </MasonryLayout>
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

