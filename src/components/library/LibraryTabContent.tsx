import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Spinner,
  Tag,
  Text,
  VStack,
  Badge,
  Accordion,
  Menu,
  Portal,
  Select,
  createListCollection,
  Checkbox,
  ActionBar,
  Input,
  InputGroup,
} from '@chakra-ui/react';
import {
  LuLibrary,
  LuPlus,
  LuRefreshCw,
  LuPackage,
  LuBookOpen,
  LuBot,
  LuNetwork,
  LuGithub,
  LuChevronDown,
  LuTrash2,
  LuExternalLink,
  LuFolder,
  LuX,
  LuFolderPlus,
  LuChevronRight,
  LuSearch,
  LuCheck,
  LuFolderOpen,
  LuLayers,
} from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { open as openShell } from '@tauri-apps/api/shell';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { toaster } from '../ui/toaster';
import {
  invokeLibraryListWorkspaces,
  invokeLibraryDeleteWorkspace,
  invokeSyncWorkspaceCatalog,
  invokeListWorkspaceCatalogs,
  invokePullVariation,
} from '../../ipc/library';
import {
  LibraryWorkspace,
  CatalogWithVariations,
  LibraryVariation,
  LibraryCatalog,
  GitHubUser,
} from '../../types/github';
import { Project, invokeGetProjectRegistry, invokeCopyKitToProject, invokeCopyWalkthroughToProject, invokeCopyDiagramToProject } from '../../ipc';
import { invokeGitHubGetUser } from '../../ipc/github';
import AddWorkspaceDialog from './AddWorkspaceDialog';

// Selected variation with its catalog info for pulling
interface SelectedVariation {
  variation: LibraryVariation;
  catalog: LibraryCatalog;
}

// Selected catalog for folder operations
interface SelectedCatalog {
  catalog: LibraryCatalog;
  variations: LibraryVariation[];
}

type ViewMode = 'loading' | 'no-auth' | 'no-workspaces' | 'browse';

// Ref type for external control
export interface LibraryTabContentRef {
  openAddWorkspaceDialog: () => void;
}

const artifactTypeIcon: Record<string, React.ReactNode> = {
  kit: <LuPackage />,
  walkthrough: <LuBookOpen />,
  agent: <LuBot />,
  diagram: <LuNetwork />,
};

// Format relative time (e.g., "2 hours ago", "3 days ago")
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

// Extract folder path from remote_path (e.g., "kits/auth/login.md" -> "kits/auth")
function getFolderPath(remotePath: string): string {
  const parts = remotePath.split('/');
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

// Library folder structure (persisted in localStorage for now)
interface LibraryFolder {
  id: string;
  name: string;
  color?: string;
  catalogIds: string[]; // Catalog IDs in this folder
}

// Group catalogs by folder path
interface FolderGroup {
  path: string;
  name: string;
  catalogs: CatalogWithVariations[];
}

function groupCatalogsByFolder(catalogs: CatalogWithVariations[]): {
  folders: FolderGroup[];
  ungrouped: CatalogWithVariations[];
} {
  const folderMap = new Map<string, CatalogWithVariations[]>();
  const ungrouped: CatalogWithVariations[] = [];

  for (const catWithVars of catalogs) {
    const folderPath = getFolderPath(catWithVars.catalog.remote_path);
    if (folderPath) {
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
      folderMap.get(folderPath)!.push(catWithVars);
    } else {
      ungrouped.push(catWithVars);
    }
  }

  const folders: FolderGroup[] = Array.from(folderMap.entries())
    .map(([path, cats]) => ({
      path,
      name: path.split('/').pop() || path,
      catalogs: cats,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return { folders, ungrouped };
}

const LibraryTabContent = forwardRef<LibraryTabContentRef>(function LibraryTabContent(_, ref) {
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [workspaces, setWorkspaces] = useState<LibraryWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogWithVariations[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  // GitHub auth state
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  // Dialog states
  const [showAddWorkspaceDialog, setShowAddWorkspaceDialog] = useState(false);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    openAddWorkspaceDialog: () => setShowAddWorkspaceDialog(true),
  }));

  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Custom folders state (stored per workspace)
  const [customFolders, setCustomFolders] = useState<LibraryFolder[]>([]);

  // Multi-select state for variations
  const [selectedVariations, setSelectedVariations] = useState<Map<string, SelectedVariation>>(new Map());
  const [bulkPulling, setBulkPulling] = useState(false);

  // Multi-select state for catalogs (for folder operations)
  const [selectedCatalogs, setSelectedCatalogs] = useState<Map<string, SelectedCatalog>>(new Map());

  // Get selected workspace from ID
  const selectedWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === selectedWorkspaceId) || null;
  }, [workspaces, selectedWorkspaceId]);

  // Create collection for workspace dropdown
  const workspacesCollection = useMemo(() => {
    return createListCollection({
      items: workspaces,
      itemToString: (item) => item.name,
      itemToValue: (item) => item.id,
    });
  }, [workspaces]);

  // Get selected variations as array
  const selectedVariationsArray = useMemo(() => {
    return Array.from(selectedVariations.values());
  }, [selectedVariations]);

  // Get selected catalogs as array
  const selectedCatalogsArray = useMemo(() => {
    return Array.from(selectedCatalogs.values());
  }, [selectedCatalogs]);

  // Load custom folders from localStorage
  useEffect(() => {
    if (selectedWorkspaceId) {
      const stored = localStorage.getItem(`library-folders-${selectedWorkspaceId}`);
      if (stored) {
        try {
          setCustomFolders(JSON.parse(stored));
        } catch {
          setCustomFolders([]);
        }
      } else {
        setCustomFolders([]);
      }
    }
  }, [selectedWorkspaceId]);

  // Save custom folders to localStorage
  const saveFolders = (folders: LibraryFolder[]) => {
    if (selectedWorkspaceId) {
      localStorage.setItem(`library-folders-${selectedWorkspaceId}`, JSON.stringify(folders));
      setCustomFolders(folders);
    }
  };

  // Load workspaces on mount
  useEffect(() => {
    checkGitHubAuth();
    loadProjects();
  }, []);

  const checkGitHubAuth = async () => {
    try {
      const user = await invokeGitHubGetUser();
      setGithubUser(user);
      loadWorkspaces();
    } catch (error) {
      console.error('Not authenticated with GitHub:', error);
      setGithubUser(null);
      setViewMode('no-auth');
    }
  };

  const loadWorkspaces = async () => {
    try {
      const ws = await invokeLibraryListWorkspaces();
      setWorkspaces(ws);
      if (ws.length === 0) {
        setViewMode('no-workspaces');
      } else {
        setSelectedWorkspaceId(ws[0].id);
        setViewMode('browse');
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: 'Failed to load library workspaces',
      });
      setViewMode('no-workspaces');
    }
  };

  const loadProjects = async () => {
    try {
      const p = await invokeGetProjectRegistry();
      setProjects(p);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  // Load catalogs when workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      loadCatalogs(selectedWorkspaceId);
      // Clear selection when switching workspaces
      setSelectedVariations(new Map());
      setSelectedCatalogs(new Map());
    }
  }, [selectedWorkspaceId]);

  const loadCatalogs = async (workspaceId: string) => {
    try {
      const cats = await invokeListWorkspaceCatalogs(workspaceId);
      setCatalogs(cats);
    } catch (error) {
      console.error('Failed to load catalogs:', error);
      setCatalogs([]);
    }
  };

  const handleSync = async () => {
    if (!selectedWorkspace) return;
    setSyncing(true);
    try {
      const result = await invokeSyncWorkspaceCatalog(selectedWorkspace.id);
      toaster.create({
        type: 'success',
        title: 'Sync complete',
        description: `Created ${result.catalogs_created} catalogs, ${result.variations_created} variations`,
      });
      await loadCatalogs(selectedWorkspace.id);
    } catch (error) {
      console.error('Sync failed:', error);
      toaster.create({
        type: 'error',
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleWorkspaceCreated = (workspace: LibraryWorkspace) => {
    setWorkspaces((prev) => [...prev, workspace]);
    setSelectedWorkspaceId(workspace.id);
    setViewMode('browse');
  };

  const handleDeleteWorkspace = async (workspace: LibraryWorkspace) => {
    if (!confirm(`Delete workspace "${workspace.name}"? This will remove it from BlueKit but won't delete the GitHub repository.`)) {
      return;
    }
    try {
      await invokeLibraryDeleteWorkspace(workspace.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspace.id));
      if (selectedWorkspaceId === workspace.id) {
        const remaining = workspaces.filter((w) => w.id !== workspace.id);
        setSelectedWorkspaceId(remaining.length > 0 ? remaining[0].id : null);
        if (remaining.length === 0) {
          setViewMode('no-workspaces');
        }
      }
      toaster.create({
        type: 'success',
        title: 'Workspace deleted',
        description: `Deleted workspace "${workspace.name}"`,
      });
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete workspace',
      });
    }
  };

  // Handle variation selection toggle
  const handleVariationToggle = (variation: LibraryVariation, catalog: LibraryCatalog) => {
    setSelectedVariations(prev => {
      const next = new Map(prev);
      if (next.has(variation.id)) {
        next.delete(variation.id);
      } else {
        next.set(variation.id, { variation, catalog });
      }
      return next;
    });
  };

  // Handle catalog selection toggle - also selects/deselects all variations
  const handleCatalogToggle = (catalogWithVariations: CatalogWithVariations) => {
    const isCurrentlySelected = selectedCatalogs.has(catalogWithVariations.catalog.id);
    
    // Update catalog selection
    setSelectedCatalogs(prev => {
      const next = new Map(prev);
      if (isCurrentlySelected) {
        next.delete(catalogWithVariations.catalog.id);
      } else {
        next.set(catalogWithVariations.catalog.id, {
          catalog: catalogWithVariations.catalog,
          variations: catalogWithVariations.variations,
        });
      }
      return next;
    });

    // Also update variation selection
    setSelectedVariations(prev => {
      const next = new Map(prev);
      if (isCurrentlySelected) {
        // Deselect all variations from this catalog
        for (const variation of catalogWithVariations.variations) {
          next.delete(variation.id);
        }
      } else {
        // Select all variations from this catalog
        for (const variation of catalogWithVariations.variations) {
          next.set(variation.id, { variation, catalog: catalogWithVariations.catalog });
        }
      }
      return next;
    });
  };

  // Clear all selections
  const clearVariationSelection = () => {
    setSelectedVariations(new Map());
  };

  const clearCatalogSelection = () => {
    setSelectedCatalogs(new Map());
  };

  // Handle bulk pull to multiple projects
  const handleBulkPull = async (selectedProjects: Project[]) => {
    if (selectedVariationsArray.length === 0 || selectedProjects.length === 0) return;

    setBulkPulling(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const project of selectedProjects) {
        for (const { variation } of selectedVariationsArray) {
          try {
            await invokePullVariation(
              variation.id,
              project.id,
              project.path,
              false
            );
            successCount++;
          } catch (err) {
            console.error(`Failed to pull variation ${variation.id} to ${project.name}:`, err);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        toaster.create({
          type: 'success',
          title: 'Pull complete',
          description: `Pulled ${successCount} resource${successCount !== 1 ? 's' : ''} successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });
      } else if (errorCount > 0) {
        toaster.create({
          type: 'error',
          title: 'Pull failed',
          description: `Failed to pull ${errorCount} resource${errorCount !== 1 ? 's' : ''}`,
        });
      }

      clearVariationSelection();
    } finally {
      setBulkPulling(false);
    }
  };

  // Handle creating a new folder
  const handleCreateFolder = (name: string) => {
    const newFolder: LibraryFolder = {
      id: `folder-${Date.now()}`,
      name,
      catalogIds: [],
    };
    saveFolders([...customFolders, newFolder]);
    setShowCreateFolderDialog(false);
    toaster.create({
      type: 'success',
      title: 'Folder created',
      description: `Created folder "${name}"`,
    });
  };

  // Handle moving catalogs to folder
  const handleMoveCatalogsToFolder = (folderId: string) => {
    const catalogIds = selectedCatalogsArray.map(c => c.catalog.id);
    const updatedFolders = customFolders.map(folder => {
      if (folder.id === folderId) {
        // Add to this folder
        const existingIds = new Set(folder.catalogIds);
        catalogIds.forEach(id => existingIds.add(id));
        return { ...folder, catalogIds: Array.from(existingIds) };
      } else {
        // Remove from other folders
        return { ...folder, catalogIds: folder.catalogIds.filter(id => !catalogIds.includes(id)) };
      }
    });
    saveFolders(updatedFolders);
    clearCatalogSelection();
    toaster.create({
      type: 'success',
      title: 'Moved to folder',
      description: `Moved ${catalogIds.length} catalog${catalogIds.length !== 1 ? 's' : ''} to folder`,
    });
  };

  // Handle removing catalogs from folder
  const handleRemoveCatalogsFromFolder = () => {
    const catalogIds = selectedCatalogsArray.map(c => c.catalog.id);
    const updatedFolders = customFolders.map(folder => ({
      ...folder,
      catalogIds: folder.catalogIds.filter(id => !catalogIds.includes(id)),
    }));
    saveFolders(updatedFolders);
    clearCatalogSelection();
    toaster.create({
      type: 'success',
      title: 'Removed from folder',
      description: `Removed ${catalogIds.length} catalog${catalogIds.length !== 1 ? 's' : ''} from folder`,
    });
  };

  // Handle deleting a folder
  const handleDeleteFolder = (folderId: string) => {
    const folder = customFolders.find(f => f.id === folderId);
    if (!folder) return;
    
    saveFolders(customFolders.filter(f => f.id !== folderId));
    toaster.create({
      type: 'success',
      title: 'Folder deleted',
      description: `Deleted folder "${folder.name}"`,
    });
  };

  const openGitHubRepo = async (workspace: LibraryWorkspace) => {
    await openShell(`https://github.com/${workspace.github_owner}/${workspace.github_repo}`);
  };

  // Organize catalogs by custom folders
  const organizedCatalogs = useMemo(() => {
    const folderCatalogs = new Map<string, CatalogWithVariations[]>();
    const catalogInFolder = new Set<string>();

    // First, assign catalogs to folders
    for (const folder of customFolders) {
      const folderCats: CatalogWithVariations[] = [];
      for (const catalogId of folder.catalogIds) {
        const catWithVars = catalogs.find(c => c.catalog.id === catalogId);
        if (catWithVars) {
          folderCats.push(catWithVars);
          catalogInFolder.add(catalogId);
        }
      }
      folderCatalogs.set(folder.id, folderCats);
    }

    // Get ungrouped catalogs (not in any custom folder)
    const ungrouped = catalogs.filter(c => !catalogInFolder.has(c.catalog.id));

    return { folderCatalogs, ungrouped };
  }, [catalogs, customFolders]);

  // Loading state
  if (viewMode === 'loading') {
    return (
      <Flex justify="center" align="center" minH="200px">
        <Spinner size="lg" />
      </Flex>
    );
  }

  // Not authenticated with GitHub
  if (viewMode === 'no-auth') {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon size="xl" color="gray.400">
              <LuGithub />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>Connect to GitHub</EmptyState.Title>
          <EmptyState.Description>
            Sign in with GitHub to access the library and publish resources.
          </EmptyState.Description>
          <Text fontSize="sm" color="text.secondary" mt={2}>
            Go to Settings to connect your GitHub account.
          </Text>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  // No workspaces - show empty state with button to open dialog
  if (viewMode === 'no-workspaces') {
    return (
      <>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon size="xl" color="primary.500">
                <LuLibrary />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>No Library Workspaces</EmptyState.Title>
            <EmptyState.Description>
              Create a workspace to publish and share kits, walkthroughs, and agents via GitHub.
            </EmptyState.Description>

            <Button
              colorPalette="primary"
              size="lg"
              mt={6}
              onClick={() => setShowAddWorkspaceDialog(true)}
            >
              <HStack gap={2}>
                <LuPlus />
                <Text>Add Workspace</Text>
              </HStack>
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>

        <AddWorkspaceDialog
          isOpen={showAddWorkspaceDialog}
          onClose={() => setShowAddWorkspaceDialog(false)}
          githubUser={githubUser}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      </>
    );
  }

  // Browse catalogs
  return (
    <>
      {/* Toolbar row - sits above catalog cards */}
      <Flex 
        gap={2} 
        align="center" 
        mb={4}
        justify="space-between"
      >
        {/* Left side: Workspace dropdown + New Folder */}
        <HStack gap={2}>
          {/* Workspace dropdown */}
          <Select.Root
            collection={workspacesCollection}
            value={selectedWorkspaceId ? [selectedWorkspaceId] : []}
            onValueChange={(details) => setSelectedWorkspaceId(details.value[0] || null)}
            size="sm"
            variant="subtle"
            width="180px"
          >
            <Select.HiddenSelect />
            <Select.Control cursor="pointer">
              <Select.Trigger>
                <HStack gap={2}>
                  <Icon fontSize="sm" color="primary.500">
                    <LuLayers />
                  </Icon>
                  <Select.ValueText placeholder="Select workspace" />
                </HStack>
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content>
                  {workspacesCollection.items.map((ws) => (
                    <Select.Item item={ws} key={ws.id}>
                      <HStack gap={2}>
                        <Icon fontSize="sm" color="primary.500">
                          <LuLayers />
                        </Icon>
                        <Select.ItemText>{ws.name}</Select.ItemText>
                      </HStack>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>

          {/* New Folder button */}
          <Button
            size="sm"
            onClick={() => setShowCreateFolderDialog(true)}
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
        </HStack>

        {/* Right side: GitHub link, Sync, Menu */}
        <HStack gap={2}>
          {/* GitHub link */}
          {selectedWorkspace && (
            <HStack
              gap={1}
              cursor="pointer"
              onClick={() => openGitHubRepo(selectedWorkspace)}
              _hover={{ color: 'primary.500' }}
              px={2}
              py={1}
              borderRadius="md"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
            >
              <Icon fontSize="sm">
                <LuGithub />
              </Icon>
              <Text fontSize="xs" color="text.secondary">
                {selectedWorkspace.github_owner}/{selectedWorkspace.github_repo}
              </Text>
              <Icon fontSize="xs">
                <LuExternalLink />
              </Icon>
            </HStack>
          )}

          {/* Sync button - subtle style */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSync}
            disabled={syncing}
            _hover={{ bg: 'bg.subtle' }}
          >
            <HStack gap={2}>
              {syncing ? <Spinner size="sm" /> : <LuRefreshCw />}
              <Text>Sync</Text>
            </HStack>
          </Button>

          {/* Workspace menu */}
          {selectedWorkspace && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Workspace options"
                >
                  <IoIosMore />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item
                      value="delete"
                      color="red.500"
                      onSelect={() => handleDeleteWorkspace(selectedWorkspace)}
                    >
                      <HStack gap={2}>
                        <LuTrash2 />
                        <Text>Delete Workspace</Text>
                      </HStack>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )}
        </HStack>
      </Flex>

      {/* Variation Action Bar */}
      <LibraryVariationActionBar
        selectedVariations={selectedVariationsArray}
        hasSelection={selectedVariations.size > 0}
        clearSelection={clearVariationSelection}
        projects={projects}
        onBulkPull={handleBulkPull}
        loading={bulkPulling}
      />

      {/* Catalog Action Bar */}
      <LibraryCatalogActionBar
        selectedCatalogs={selectedCatalogsArray}
        hasSelection={selectedCatalogs.size > 0}
        clearSelection={clearCatalogSelection}
        folders={customFolders}
        onMoveToFolder={handleMoveCatalogsToFolder}
        onRemoveFromFolder={handleRemoveCatalogsFromFolder}
        onCreateFolder={() => setShowCreateFolderDialog(true)}
      />

      <VStack align="stretch" gap={4}>
        {/* Catalogs organized by folder */}
        {catalogs.length === 0 ? (
          <EmptyState.Root>
            <EmptyState.Content>
              <EmptyState.Indicator>
                <Icon size="lg" color="gray.400">
                  <LuLibrary />
                </Icon>
              </EmptyState.Indicator>
              <EmptyState.Title>No catalogs yet</EmptyState.Title>
              <EmptyState.Description>
                Sync to fetch catalogs from GitHub, or publish resources to this workspace.
              </EmptyState.Description>
            </EmptyState.Content>
          </EmptyState.Root>
        ) : (
          <VStack align="stretch" gap={6}>
            {/* Custom Folders */}
            {customFolders.length > 0 && (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {customFolders.map((folder) => {
                  const folderCats = organizedCatalogs.folderCatalogs.get(folder.id) || [];
                  const isExpanded = expandedFolders.has(folder.id);

                    return (
                      <LibraryFolderCard
                        key={folder.id}
                        folder={folder}
                        catalogs={folderCats}
                        isExpanded={isExpanded}
                        onToggleExpand={() => {
                          setExpandedFolders(prev => {
                            const next = new Set(prev);
                            if (next.has(folder.id)) {
                              next.delete(folder.id);
                            } else {
                              next.add(folder.id);
                            }
                            return next;
                          });
                        }}
                        onDeleteFolder={() => handleDeleteFolder(folder.id)}
                        selectedCatalogIds={selectedCatalogs}
                        onCatalogToggle={handleCatalogToggle}
                      />
                    );
                })}
              </SimpleGrid>
            )}

            {/* Ungrouped Catalogs (not in folders) */}
            {organizedCatalogs.ungrouped.length > 0 && (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {organizedCatalogs.ungrouped.map((catWithVars) => (
                  <CatalogCard
                    key={catWithVars.catalog.id}
                    catalogWithVariations={catWithVars}
                    selectedVariationIds={selectedVariations}
                    onVariationToggle={handleVariationToggle}
                    isSelected={selectedCatalogs.has(catWithVars.catalog.id)}
                    onCatalogToggle={() => handleCatalogToggle(catWithVars)}
                  />
                ))}
              </SimpleGrid>
            )}
          </VStack>
        )}
      </VStack>

      {/* Dialogs */}
      <AddWorkspaceDialog
        isOpen={showAddWorkspaceDialog}
        onClose={() => setShowAddWorkspaceDialog(false)}
        githubUser={githubUser}
        onWorkspaceCreated={handleWorkspaceCreated}
      />

      <CreateLibraryFolderDialog
        isOpen={showCreateFolderDialog}
        onClose={() => setShowCreateFolderDialog(false)}
        onCreate={handleCreateFolder}
      />
    </>
  );
});

interface CatalogCardProps {
  catalogWithVariations: CatalogWithVariations;
  selectedVariationIds: Map<string, SelectedVariation>;
  onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
  isSelected: boolean;
  onCatalogToggle: () => void;
}

function CatalogCard({ 
  catalogWithVariations, 
  selectedVariationIds, 
  onVariationToggle,
  isSelected,
  onCatalogToggle,
}: CatalogCardProps) {
  const { catalog, variations } = catalogWithVariations;
  const [expanded, setExpanded] = useState(false);

  const icon = artifactTypeIcon[catalog.artifact_type] || <LuPackage />;
  const tags = catalog.tags ? JSON.parse(catalog.tags) : [];

  // Get default version label (v1, v2, etc.) based on index - sorted by published_at descending
  const getVersionLabel = (variation: LibraryVariation, index: number): string => {
    if (variation.version_tag) return variation.version_tag;
    // Index 0 is most recent, so we reverse the numbering
    return `v${variations.length - index}`;
  };

  return (
    <Card.Root 
      variant="subtle"
      borderWidth={isSelected ? "2px" : "1px"}
      borderColor={isSelected ? "primary.500" : "border.subtle"}
      _hover={{ borderColor: isSelected ? "primary.600" : "primary.400" }}
    >
      <CardHeader pb={2}>
        <Flex justify="space-between" align="center">
          <HStack gap={2} flex={1}>
            <Icon color="primary.500">{icon}</Icon>
            <Heading size="sm">{catalog.name}</Heading>
            <Badge size="sm" colorPalette="gray">
              {variations.length}
            </Badge>
          </HStack>
          <Checkbox.Root
            checked={isSelected}
            colorPalette="primary"
            onCheckedChange={onCatalogToggle}
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
      <CardBody pt={0}>
        {catalog.description && (
          <Text fontSize="sm" color="text.secondary" mb={2}>
            {catalog.description}
          </Text>
        )}
        {tags.length > 0 && (
          <HStack gap={1} mb={2} wrap="wrap">
            {tags.map((tag: string) => (
              <Tag.Root key={tag} size="sm" colorPalette="gray" variant="subtle">
                <Tag.Label>{tag}</Tag.Label>
              </Tag.Root>
            ))}
          </HStack>
        )}

        <Accordion.Root
          collapsible
          value={expanded ? ['variations'] : []}
          onValueChange={(details) => setExpanded(details.value.includes('variations'))}
        >
          <Accordion.Item value="variations">
            <Accordion.ItemTrigger>
              <HStack gap={1}>
                <Text fontSize="sm">Variations</Text>
                <LuChevronDown />
              </HStack>
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <VStack align="stretch" gap={2} mt={2}>
                {variations.map((v, index) => {
                  const publishDate = new Date(v.published_at * 1000);
                  const timeAgo = formatTimeAgo(publishDate);
                  const isVariationSelected = selectedVariationIds.has(v.id);
                  const versionLabel = getVersionLabel(v, index);
                  
                  return (
                    <Flex
                      key={v.id}
                      justify="space-between"
                      align="center"
                      p={3}
                      bg="bg.subtle"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="transparent"
                      _hover={{ bg: 'bg.muted' }}
                      transition="all 0.2s"
                    >
                      <VStack align="start" gap={0}>
                        <HStack gap={2}>
                          <Text fontSize="sm" fontWeight="medium">
                            {versionLabel}
                          </Text>
                        </HStack>
                        <HStack gap={2}>
                          <Text fontSize="xs" color="text.tertiary">
                            {timeAgo}
                          </Text>
                          {v.publisher_name && (
                            <Text fontSize="xs" color="text.tertiary">
                              • by {v.publisher_name}
                            </Text>
                          )}
                        </HStack>
                      </VStack>
                      <Checkbox.Root
                        checked={isVariationSelected}
                        colorPalette="primary"
                        onCheckedChange={() => onVariationToggle(v, catalog)}
                        onClick={(e) => e.stopPropagation()}
                        cursor="pointer"
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control cursor="pointer">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Root>
                    </Flex>
                  );
                })}
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
      </CardBody>
    </Card.Root>
  );
}

// Library Folder Card (similar to FolderCard)
interface LibraryFolderCardProps {
  folder: LibraryFolder;
  catalogs: CatalogWithVariations[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDeleteFolder: () => void;
  selectedCatalogIds: Map<string, SelectedCatalog>;
  onCatalogToggle: (catalogWithVariations: CatalogWithVariations) => void;
}

function LibraryFolderCard({
  folder,
  catalogs,
  isExpanded,
  onToggleExpand,
  onDeleteFolder,
  selectedCatalogIds,
  onCatalogToggle,
}: LibraryFolderCardProps) {
  return (
    <Card.Root
      variant="subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      cursor="pointer"
      onClick={onToggleExpand}
      _hover={{ borderColor: 'blue.400' }}
      position="relative"
      overflow="hidden"
      width="100%"
      height="fit-content"
      alignSelf="start"
    >
      <CardHeader pb={2}>
        <Flex align="center" justify="space-between" gap={4}>
          <HStack gap={2} align="center" flex={1}>
            <Icon
              transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
              transition="transform 0.2s"
            >
              <LuChevronRight />
            </Icon>
            <Icon boxSize={5} color={folder.color || 'blue.500'}>
              <LuFolder />
            </Icon>
            <Heading size="md">{folder.name}</Heading>
            <Badge size="sm" colorPalette="gray">
              {catalogs.length}
            </Badge>
          </HStack>
          <Box flexShrink={0}>
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Folder options"
                  onClick={(e) => e.stopPropagation()}
                  bg="transparent"
                  _hover={{ bg: "transparent" }}
                >
                  <Icon>
                    <IoIosMore />
                  </Icon>
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item value="delete" onSelect={onDeleteFolder}>
                      <HStack gap={2}>
                        <Icon>
                          <LuTrash2 />
                        </Icon>
                        <Text fontSize="md">Delete</Text>
                      </HStack>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </Box>
        </Flex>
      </CardHeader>
      <CardBody pt={0}>
        <Box
          display="grid"
          css={{
            gridTemplateRows: isExpanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
          }}
          opacity={isExpanded ? 1 : 0}
          overflow="hidden"
        >
          <Box minHeight={0}>
            {catalogs.length > 0 ? (
              <Box pt={2} borderTopWidth="1px" borderColor="border.subtle">
                <VStack align="stretch" gap={2}>
                  {catalogs.map((catWithVars) => {
                    const icon = artifactTypeIcon[catWithVars.catalog.artifact_type] || <LuPackage />;
                    const isCatalogSelected = selectedCatalogIds.has(catWithVars.catalog.id);
                    
                    return (
                      <HStack
                        key={catWithVars.catalog.id}
                        fontSize="sm"
                        color="text.secondary"
                        cursor="pointer"
                        _hover={{ color: 'blue.500' }}
                        gap={2}
                        justify="space-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HStack gap={2} flex={1}>
                          <Icon boxSize={4}>{icon}</Icon>
                          <Text fontSize="sm">{catWithVars.catalog.name}</Text>
                          <Text fontSize="xs" color="text.tertiary">
                            ({catWithVars.variations.length})
                          </Text>
                        </HStack>
                        <Checkbox.Root
                          checked={isCatalogSelected}
                          colorPalette="blue"
                          onCheckedChange={() => onCatalogToggle(catWithVars)}
                          cursor="pointer"
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control cursor="pointer">
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Root>
                      </HStack>
                    );
                  })}
                </VStack>
              </Box>
            ) : (
              <Box pt={2} borderTopWidth="1px" borderColor="border.subtle">
                <Text fontSize="sm" color="text.tertiary" textAlign="center">
                  Empty folder
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      </CardBody>
    </Card.Root>
  );
}

// Action bar for variation bulk operations
interface LibraryVariationActionBarProps {
  selectedVariations: SelectedVariation[];
  hasSelection: boolean;
  clearSelection: () => void;
  projects: Project[];
  onBulkPull: (projects: Project[]) => void;
  loading: boolean;
}

function LibraryVariationActionBar({
  selectedVariations,
  hasSelection,
  clearSelection,
  projects,
  onBulkPull,
  loading,
}: LibraryVariationActionBarProps) {
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset when action bar closes
  useEffect(() => {
    if (!hasSelection) {
      setSelectedProjectIds(new Set());
      setSearchQuery('');
      setIsAddToProjectOpen(false);
    }
  }, [hasSelection]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isAddToProjectOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAddToProjectOpen]);

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleConfirmPull = () => {
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    onBulkPull(selectedProjects);
    setIsAddToProjectOpen(false);
    setSelectedProjectIds(new Set());
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const truncatePath = (path: string, maxLength: number = 40): string => {
    if (path.length <= maxLength) return path;
    return `...${path.slice(-(maxLength - 3))}`;
  };

  if (!hasSelection) {
    return null;
  }

  return (
    <ActionBar.Root open={hasSelection} closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner zIndex={1000}>
          <ActionBar.Content>
            <VStack align="stretch" gap={0}>
              <Box pb={1} mt={-0.5}>
                <HStack gap={1.5} justify="center">
                  <Text fontSize="xs" color="text.secondary">
                    {selectedVariations.length} variation{selectedVariations.length !== 1 ? 's' : ''} selected
                  </Text>
                </HStack>
              </Box>
              <HStack gap={2}>
                <Button
                  variant="surface"
                  colorPalette="red"
                  size="sm"
                  onClick={clearSelection}
                  disabled={loading}
                >
                  <HStack gap={2}>
                    <LuX />
                    <Text>Remove</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                {/* Add to Project popover */}
                <Menu.Root 
                  closeOnSelect={false}
                  open={isAddToProjectOpen}
                  onOpenChange={(e) => setIsAddToProjectOpen(e.open)}
                >
                  <Menu.Trigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      <HStack gap={2}>
                        <LuFolderPlus />
                        <Text>Add to Project</Text>
                      </HStack>
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner zIndex={2000}>
                      <Menu.Content width="400px" maxH="500px" position="relative" zIndex={2000}>
                        {/* Header */}
                        <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                          <Text fontSize="sm" fontWeight="semibold">
                            Add to Project
                          </Text>
                        </Box>

                        {/* Search Input */}
                        <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                          <InputGroup startElement={<LuSearch />}>
                            <Input
                              ref={searchInputRef}
                              placeholder="Search projects..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </InputGroup>
                        </Box>

                        {/* Project List */}
                        <Box maxH="300px" overflowY="auto">
                          {filteredProjects.length === 0 ? (
                            <Box textAlign="center" py={4} px={3}>
                              <Text fontSize="sm" color="text.secondary">
                                {searchQuery ? 'No projects match your search.' : 'No projects found.'}
                              </Text>
                            </Box>
                          ) : (
                            filteredProjects.map((project) => {
                              const isSelected = selectedProjectIds.has(project.id);
                              return (
                                <Menu.Item
                                  key={project.id}
                                  value={project.id}
                                  onSelect={() => toggleProject(project.id)}
                                >
                                  <HStack gap={2} justify="space-between" width="100%" minW={0}>
                                    <HStack gap={2} flex="1" minW={0} overflow="hidden">
                                      <Icon flexShrink={0}>
                                        <LuFolder />
                                      </Icon>
                                      <VStack align="start" gap={0} flex="1" minW={0} overflow="hidden">
                                        <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
                                          {project.name}
                                        </Text>
                                        <Text fontSize="xs" color="text.secondary" title={project.path}>
                                          {truncatePath(project.path, 35)}
                                        </Text>
                                      </VStack>
                                    </HStack>
                                    {isSelected && (
                                      <Icon color="primary.500" flexShrink={0}>
                                        <LuCheck />
                                      </Icon>
                                    )}
                                  </HStack>
                                </Menu.Item>
                              );
                            })
                          )}
                        </Box>

                        {/* Footer with Confirm Button */}
                        <Box
                          px={3}
                          py={2}
                          borderTopWidth="1px"
                          borderColor="border.subtle"
                          bg="bg.panel"
                          opacity={selectedProjectIds.size > 0 ? 1 : 0.5}
                        >
                          <Button
                            variant="solid"
                            colorPalette="primary"
                            size="sm"
                            width="100%"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmPull();
                            }}
                            disabled={loading || selectedProjectIds.size === 0}
                          >
                            {loading ? (
                              <HStack gap={2}>
                                <Spinner size="xs" />
                                <Text>Pulling...</Text>
                              </HStack>
                            ) : (
                              `Pull to ${selectedProjectIds.size} Project${selectedProjectIds.size !== 1 ? 's' : ''}`
                            )}
                          </Button>
                        </Box>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </HStack>
            </VStack>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}

// Action bar for catalog bulk operations (folder management)
interface LibraryCatalogActionBarProps {
  selectedCatalogs: SelectedCatalog[];
  hasSelection: boolean;
  clearSelection: () => void;
  folders: LibraryFolder[];
  onMoveToFolder: (folderId: string) => void;
  onRemoveFromFolder: () => void;
  onCreateFolder: () => void;
}

function LibraryCatalogActionBar({
  selectedCatalogs,
  hasSelection,
  clearSelection,
  folders,
  onMoveToFolder,
  onRemoveFromFolder,
  onCreateFolder,
}: LibraryCatalogActionBarProps) {
  if (!hasSelection) {
    return null;
  }

  return (
    <ActionBar.Root open={hasSelection} closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner zIndex={1000}>
          <ActionBar.Content>
            <VStack align="stretch" gap={0}>
              <Box pb={1} mt={-0.5}>
                <HStack gap={1.5} justify="center">
                  <Text fontSize="xs" color="text.secondary">
                    {selectedCatalogs.length} catalog{selectedCatalogs.length !== 1 ? 's' : ''} selected
                  </Text>
                </HStack>
              </Box>
              <HStack gap={2}>
                <Button
                  variant="surface"
                  colorPalette="red"
                  size="sm"
                  onClick={clearSelection}
                >
                  <HStack gap={2}>
                    <LuX />
                    <Text>Remove</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveFromFolder}
                >
                  <HStack gap={2}>
                    <LuTrash2 />
                    <Text>Remove from Folder</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                {/* Move to Folder menu */}
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      <HStack gap={2}>
                        <LuFolder />
                        <Text>Move to Folder</Text>
                        <LuChevronDown />
                      </HStack>
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner zIndex={2000}>
                      <Menu.Content>
                        {folders.length === 0 ? (
                          <Box px={3} py={2}>
                            <Text fontSize="sm" color="text.secondary">No folders yet</Text>
                          </Box>
                        ) : (
                          folders.map((folder) => (
                            <Menu.Item
                              key={folder.id}
                              value={folder.id}
                              onSelect={() => onMoveToFolder(folder.id)}
                            >
                              <HStack gap={2}>
                                <Icon color={folder.color || 'blue.500'}>
                                  <LuFolder />
                                </Icon>
                                <Text>{folder.name}</Text>
                              </HStack>
                            </Menu.Item>
                          ))
                        )}
                        <Menu.Separator />
                        <Menu.Item value="new" onSelect={onCreateFolder}>
                          <HStack gap={2}>
                            <Icon color="primary.500">
                              <LuFolderPlus />
                            </Icon>
                            <Text>Create New Folder</Text>
                          </HStack>
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </HStack>
            </VStack>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}

// Create folder dialog
interface CreateLibraryFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

function CreateLibraryFolderDialog({ isOpen, onClose, onCreate }: CreateLibraryFolderDialogProps) {
  const [name, setName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <Box
        position="fixed"
        inset={0}
        bg="blackAlpha.600"
        zIndex={1000}
        onClick={onClose}
      />
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        bg="bg.panel"
        borderRadius="lg"
        boxShadow="xl"
        p={6}
        w="350px"
        zIndex={1001}
        onClick={(e) => e.stopPropagation()}
      >
        <VStack align="stretch" gap={4}>
          <Heading size="md">Create Folder</Heading>
          
          <Input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />

          <HStack gap={2} justify="flex-end">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorPalette="primary"
              onClick={handleSubmit}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Portal>
  );
}

export default LibraryTabContent;
