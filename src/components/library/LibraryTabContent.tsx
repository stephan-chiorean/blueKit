import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
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
  Textarea,
  Dialog,
  CloseButton,
  Field,
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
  LuSearch,
  LuCheck,
  LuLayers,
  LuFilter,
  LuBookmark,
  LuBookmarkPlus,
  LuPin,
  LuPinOff,
  LuPencil,
} from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { FaBook } from 'react-icons/fa';
import { open as openShell } from '@tauri-apps/api/shell';
import { toaster } from '../ui/toaster';
import {
  invokeLibraryListWorkspaces,
  invokeLibraryDeleteWorkspace,
  invokeLibraryUpdateWorkspaceName,
  invokeLibrarySetWorkspacePinned,
  invokeSyncWorkspaceCatalog,
  invokeListWorkspaceCatalogs,
  invokeDeleteCatalogs,
  invokePullVariation,
  invokeLibraryCreateCollection,
  invokeLibraryGetCollections,
  invokeLibraryDeleteCollection,
  invokeLibraryAddCatalogsToCollection,
  invokeLibraryRemoveCatalogsFromCollection,
  invokeLibraryGetCollectionCatalogIds,
  invokeLibraryUpdateCollection,
  type LibraryCollection,
} from '../../ipc/library';
import {
  LibraryWorkspace,
  CatalogWithVariations,
  LibraryVariation,
  LibraryCatalog,
  GitHubUser,
} from '../../types/github';
import { Project, invokeGetProjectRegistry } from '../../ipc';
import { invokeGitHubGetUser, invokeGitHubGetFile } from '../../ipc/github';
import AddWorkspaceDialog from './AddWorkspaceDialog';
import { FilterPanel } from '../shared/FilterPanel';
import { useLibraryCache } from '../../contexts/LibraryCacheContext';
import { ResourceFile, ResourceType } from '../../types/resource';
import CollectionViewModal from './CollectionViewModal';
import EditLibraryCollectionModal from './EditLibraryCollectionModal';

// Selected variation with its catalog info for pulling
interface SelectedVariation {
  variation: LibraryVariation;
  catalog: LibraryCatalog;
}

// Selected catalog for collection operations
interface SelectedCatalog {
  catalog: LibraryCatalog;
  variations: LibraryVariation[];
}

type ViewMode = 'loading' | 'no-auth' | 'no-workspaces' | 'browse';

// Ref type for external control
export interface LibraryTabContentRef {
  openAddWorkspaceDialog: () => void;
}

// Props for LibraryTabContent
interface LibraryTabContentProps {
  onViewVariation?: (resource: ResourceFile, content: string, resourceType: ResourceType) => void;
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

// Library collection is now imported from IPC - no local interface needed

const LibraryTabContent = forwardRef<LibraryTabContentRef, LibraryTabContentProps>(function LibraryTabContent({ onViewVariation }, ref) {
  const { getCachedCatalogs, setCachedCatalogs, getCachedCollections, setCachedCollections, invalidateCatalogs, invalidateCollections } = useLibraryCache();
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [workspaces, setWorkspaces] = useState<LibraryWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogWithVariations[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [catalogsLoading, setCatalogsLoading] = useState(false);

  // GitHub auth state
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  // Dialog states
  const [showAddWorkspaceDialog, setShowAddWorkspaceDialog] = useState(false);
  const [showCreateCollectionDialog, setShowCreateCollectionDialog] = useState(false);
  const [showDeleteCatalogsDialog, setShowDeleteCatalogsDialog] = useState(false);
  const [showEditWorkspaceDialog, setShowEditWorkspaceDialog] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    openAddWorkspaceDialog: () => setShowAddWorkspaceDialog(true),
  }));

  // Collection modal state
  const [viewingCollection, setViewingCollection] = useState<string | null>(null);
  
  // Edit collection modal state
  const [editingCollection, setEditingCollection] = useState<LibraryCollection | null>(null);
  const [showEditCollectionModal, setShowEditCollectionModal] = useState(false);
  
  // Catalog expansion state (for modal: Set<catalogId>)
  const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(new Set());

  // Custom collections state (stored per workspace)
  const [customCollections, setCustomCollections] = useState<LibraryCollection[]>([]);

  // Sort collections consistently by order_index, then created_at
  const sortedCollections = useMemo(() => {
    return [...customCollections].sort((a, b) => {
      if (a.order_index !== b.order_index) {
        return a.order_index - b.order_index;
      }
      return a.created_at - b.created_at;
    });
  }, [customCollections]);

  // Catalog assignments per collection (collection_id -> catalog_id[])
  const [collectionCatalogMap, setCollectionCatalogMap] = useState<Map<string, string[]>>(new Map());

  // Multi-select state for variations
  const [selectedVariations, setSelectedVariations] = useState<Map<string, SelectedVariation>>(new Map());
  const [bulkPulling, setBulkPulling] = useState(false);

  // Multi-select state for catalogs (for folder operations)
  const [selectedCatalogs, setSelectedCatalogs] = useState<Map<string, SelectedCatalog>>(new Map());

  // Filter state
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

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

  // Get all unique tags from ungrouped catalogs (since filter only applies to ungrouped)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    const catalogInCollection = new Set<string>();

    // Mark catalogs that are in collections
    for (const collection of sortedCollections) {
      const catalogIds = collectionCatalogMap.get(collection.id) || [];
      for (const catalogId of catalogIds) {
        catalogInCollection.add(catalogId);
      }
    }

    // Only collect tags from ungrouped catalogs
    catalogs
      .filter(c => !catalogInCollection.has(c.catalog.id))
      .forEach(catWithVars => {
        const tags = catWithVars.catalog.tags ? JSON.parse(catWithVars.catalog.tags) : [];
        tags.forEach((tag: string) => tagSet.add(tag));
      });
    return Array.from(tagSet).sort();
  }, [catalogs, sortedCollections, collectionCatalogMap]);

  // Filter function for catalogs (used only for ungrouped catalogs)
  const matchesFilter = useCallback((catWithVars: CatalogWithVariations): boolean => {
    const catalog = catWithVars.catalog;
    const displayName = catalog.name;
    const matchesName = !nameFilter || 
      displayName.toLowerCase().includes(nameFilter.toLowerCase());
    
    const catalogTags = catalog.tags ? JSON.parse(catalog.tags) : [];
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(selectedTag =>
        catalogTags.some((tag: string) => 
          tag.toLowerCase() === selectedTag.toLowerCase()
        )
      );
    
    return matchesName && matchesTags;
  }, [nameFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  // Load collections from database
  const loadCollectionsFromDatabase = useCallback(async (workspaceId: string) => {
    // Check cache first
    const cachedCollections = getCachedCollections(workspaceId);
    let collections: LibraryCollection[];

    if (cachedCollections) {
      setCustomCollections(cachedCollections);
      collections = cachedCollections;
      // Don't return early - continue to load mappings below
    } else {
      setCollectionsLoading(true);
      try {
        collections = await invokeLibraryGetCollections(workspaceId);
        console.log('Loaded collections from database:', collections);

        // Sort collections by order_index, then created_at for consistent ordering
        const sorted = [...collections].sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });

        // Cache the collections
        setCachedCollections(workspaceId, sorted);
        setCustomCollections(sorted);
        collections = sorted;
      } catch (error) {
        console.error('Failed to load collections from database:', error);
        setCustomCollections([]);
        setCollectionCatalogMap(new Map());
        setCollectionsLoading(false);
        return;
      } finally {
        setCollectionsLoading(false);
      }
    }

    // ALWAYS load collection-catalog mappings (moved outside cache check)
    // This ensures mappings are loaded even when collections come from cache
    const map = new Map<string, string[]>();
    try {
      for (const collection of collections) {
        const catalogIds = await invokeLibraryGetCollectionCatalogIds(collection.id);
        map.set(collection.id, catalogIds);
      }
      setCollectionCatalogMap(map);
      console.log('Loaded collection-catalog mappings:', map);
    } catch (mapError) {
      console.error('Failed to load collection-catalog mappings:', mapError);
      setCollectionCatalogMap(new Map());
    }
  }, [getCachedCollections, setCachedCollections]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadCollectionsFromDatabase(selectedWorkspaceId);
    } else {
      setCustomCollections([]);
    }
  }, [selectedWorkspaceId, loadCollectionsFromDatabase]);

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
        // Prefer pinned workspace, otherwise first one
        const pinnedWorkspace = ws.find(w => w.pinned);
        setSelectedWorkspaceId(pinnedWorkspace ? pinnedWorkspace.id : ws[0].id);
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
      // Reset filters when switching workspaces
      setNameFilter('');
      setSelectedTags([]);
    }
  }, [selectedWorkspaceId]);

  const loadCatalogs = async (workspaceId: string) => {
    // Check cache first
    const cached = getCachedCatalogs(workspaceId);
    if (cached) {
      setCatalogs(cached);
      return;
    }

    setCatalogsLoading(true);
    try {
      const cats = await invokeListWorkspaceCatalogs(workspaceId);
      setCatalogs(cats);
      setCachedCatalogs(workspaceId, cats);
    } catch (error) {
      console.error('Failed to load catalogs:', error);
      setCatalogs([]);
    } finally {
      setCatalogsLoading(false);
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
      // Invalidate cache before reloading
      invalidateCatalogs(selectedWorkspace.id);
      invalidateCollections(selectedWorkspace.id);
      // Load both catalogs and collections in parallel
      await Promise.all([
        loadCatalogs(selectedWorkspace.id),
        loadCollectionsFromDatabase(selectedWorkspace.id),
      ]);
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

  // Parse front matter from content
  const parseFrontMatter = (content: string): any => {
    let frontMatter: any = {};
    if (content.trim().startsWith('---')) {
      const endIndex = content.indexOf('\n---', 4);
      if (endIndex !== -1) {
        const frontMatterText = content.substring(4, endIndex);
        const lines = frontMatterText.split('\n');
        lines.forEach((line) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            // Handle arrays (tags)
            if (key === 'tags' && value.startsWith('[')) {
              frontMatter[key] = value
                .slice(1, -1)
                .split(',')
                .map((t) => t.trim().replace(/['"]/g, ''));
            } else {
              // Remove quotes from value
              frontMatter[key] = value.replace(/^["']|["']$/g, '');
            }
          }
        });
      }
    }
    return frontMatter;
  };

  // Handle variation click to navigate to ResourceViewPage
  const handleVariationClick = async (variation: LibraryVariation, catalog: LibraryCatalog) => {
    if (!selectedWorkspace || !onViewVariation) {
      toaster.create({
        type: 'error',
        title: 'No workspace selected',
        description: 'Please select a workspace first',
      });
      return;
    }

    try {
      const content = await invokeGitHubGetFile(
        selectedWorkspace.github_owner,
        selectedWorkspace.github_repo,
        variation.remote_path
      );

      // Convert to ResourceFile
      const fileName = variation.remote_path.split('/').pop() || 'Unknown';
      const name = fileName.replace(/\.(md|markdown)$/, '');
      const frontMatter = parseFrontMatter(content);
      
      // Determine resource type from catalog artifact_type
      const resourceTypeMap: Record<string, ResourceType> = {
        kit: 'kit',
        walkthrough: 'walkthrough',
        agent: 'agent',
        diagram: 'diagram',
      };
      const resourceType = resourceTypeMap[catalog.artifact_type] || 'kit';

      const resourceFile: ResourceFile = {
        path: variation.remote_path,
        name,
        frontMatter,
        resourceType,
      };

      // Call callback to navigate
      onViewVariation(resourceFile, content, resourceType);
    } catch (error) {
      console.error('Failed to fetch variation content:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to load variation',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Handle catalog expansion toggle in modal
  const handleCatalogExpandToggle = (catalogId: string) => {
    setExpandedCatalogs(prev => {
      const next = new Set(prev);
      if (next.has(catalogId)) {
        next.delete(catalogId);
      } else {
        next.add(catalogId);
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

  // Handle opening delete confirmation dialog
  const handleDeleteCatalogsClick = () => {
    if (selectedCatalogsArray.length === 0) return;
    setShowDeleteCatalogsDialog(true);
  };

  // Handle deleting catalogs from workspace (called after confirmation)
  const handleDeleteCatalogs = async () => {
    const catalogIds = selectedCatalogsArray.map(c => c.catalog.id);
    if (catalogIds.length === 0) return;

    if (!selectedWorkspaceId) {
      toaster.create({
        type: 'error',
        title: 'No workspace selected',
        description: 'Please select a workspace first',
      });
      return;
    }

    setShowDeleteCatalogsDialog(false);

    try {
      console.log('Deleting catalogs:', catalogIds);
      const deletedCount = await invokeDeleteCatalogs(catalogIds);
      console.log('Delete completed, deleted count:', deletedCount);
      
      if (deletedCount === 0) {
        toaster.create({
          type: 'warning',
          title: 'No catalogs deleted',
          description: 'No catalogs were found to delete',
        });
        return;
      }
      
      // Clear selections immediately
      setSelectedCatalogs(new Map());
      setSelectedVariations(prev => {
        const next = new Map(prev);
        catalogIds.forEach(catalogId => {
          // Remove all variations that belong to these catalogs
          for (const [variationId, selectedVariation] of prev.entries()) {
            if (selectedVariation.catalog.id === catalogId) {
              next.delete(variationId);
            }
          }
        });
        return next;
      });

      // Immediately update the UI by filtering out deleted catalogs
      setCatalogs(prev => prev.filter(c => !catalogIds.includes(c.catalog.id)));

      // Invalidate cache to ensure fresh data on next load
      try {
        invalidateCatalogs(selectedWorkspaceId);
      } catch (cacheError) {
        console.error('Failed to invalidate cache:', cacheError);
        // Continue anyway
      }

      // Force reload from API (bypass cache) to ensure consistency
      setCatalogsLoading(true);
      try {
        const freshCatalogs = await invokeListWorkspaceCatalogs(selectedWorkspaceId);
        setCatalogs(freshCatalogs);
        setCachedCatalogs(selectedWorkspaceId, freshCatalogs);
      } catch (reloadError) {
        console.error('Failed to reload catalogs after deletion:', reloadError);
        // Don't show error to user since deletion succeeded - UI already updated
      } finally {
        setCatalogsLoading(false);
      }

      toaster.create({
        type: 'success',
        title: 'Catalogs deleted',
        description: `Deleted ${deletedCount} catalog${deletedCount !== 1 ? 's' : ''} and all variations from the workspace`,
      });
    } catch (err) {
      console.error('Failed to delete catalogs:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error details:', errorMessage);
      toaster.create({
        type: 'error',
        title: 'Failed to delete catalogs',
        description: errorMessage || 'An error occurred while deleting catalogs',
      });
    }
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

  // Handle creating a new collection
  const handleCreateCollection = async (name: string, description?: string, tags?: string) => {
    if (!selectedWorkspaceId) {
      toaster.create({
        type: 'error',
        title: 'Error',
        description: 'No workspace selected',
      });
      return;
    }

    // Close dialog immediately for fluid UX
    setShowCreateCollectionDialog(false);

    try {
      // Create collection in database
      const collectionId = await invokeLibraryCreateCollection(selectedWorkspaceId, name, description, tags);
      console.log('Created collection:', collectionId);

      // Optimistically create collection object
      const now = Math.floor(Date.now() / 1000);
      const maxOrderIndex = customCollections.length > 0 
        ? Math.max(...customCollections.map(c => c.order_index)) + 1
        : 0;
      const optimisticCollection: LibraryCollection = {
        id: collectionId,
        workspace_id: selectedWorkspaceId,
        name: name.trim(),
        description,
        tags,
        order_index: maxOrderIndex,
        created_at: now,
        updated_at: now,
      };

      // Optimistically update state immediately (no loading state)
      // Insert in sorted position to maintain order
      setCustomCollections(prev => {
        const updated = [...prev, optimisticCollection];
        return updated.sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });
      });
      setCollectionCatalogMap(prev => {
        const next = new Map(prev);
        next.set(collectionId, []); // Empty catalog list for new collection
        return next;
      });

      // Update cache optimistically (sorted)
      const updatedCollections = [...customCollections, optimisticCollection].sort((a, b) => {
        if (a.order_index !== b.order_index) {
          return a.order_index - b.order_index;
        }
        return a.created_at - b.created_at;
      });
      setCachedCollections(selectedWorkspaceId, updatedCollections);

      // Silently refresh in background to get accurate data (without loading state)
      // This ensures we have the correct order_index and timestamps from the database
      try {
        const freshCollections = await invokeLibraryGetCollections(selectedWorkspaceId);
        
        // Sort collections by order_index, then created_at for consistent ordering
        const sorted = [...freshCollections].sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });
        
        const freshMap = new Map<string, string[]>();
        for (const collection of sorted) {
          try {
            const catalogIds = await invokeLibraryGetCollectionCatalogIds(collection.id);
            freshMap.set(collection.id, catalogIds);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(collection.id, []);
          }
        }
        
        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        setCachedCollections(selectedWorkspaceId, sorted);
      } catch (refreshError) {
        console.error('Background refresh failed (using optimistic data):', refreshError);
        // Keep optimistic data - it's good enough
      }

      toaster.create({
        type: 'success',
        title: 'Collection created',
        description: `Created collection "${name}"`,
      });
    } catch (error) {
      console.error('Failed to create collection:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Rollback optimistic update on error
      invalidateCollections(selectedWorkspaceId);
      loadCollectionsFromDatabase(selectedWorkspaceId).catch(err => {
        console.error('Failed to reload after error:', err);
      });
      
      toaster.create({
        type: 'error',
        title: 'Failed to create collection',
        description: errorMessage,
      });
    }
  };

  // Handle moving catalogs to collection
  const handleMoveCatalogsToCollection = async (collectionId: string) => {
    const catalogIds = selectedCatalogsArray.map(c => c.catalog.id);
    if (catalogIds.length === 0 || !selectedWorkspaceId) return;

    // Clear selections immediately for fluid UX
    setSelectedCatalogs(new Map());
    setSelectedVariations(prev => {
      const next = new Map(prev);
      catalogIds.forEach(catalogId => {
        // Remove all variations that belong to these catalogs
        for (const [variationId, selectedVariation] of prev.entries()) {
          if (selectedVariation.catalog.id === catalogId) {
            next.delete(variationId);
          }
        }
      });
      return next;
    });

    // Optimistically update collection-catalog mapping
    setCollectionCatalogMap(prev => {
      const next = new Map(prev);
      const existingIds = next.get(collectionId) || [];
      const newIds = [...new Set([...existingIds, ...catalogIds])];
      next.set(collectionId, newIds);
      return next;
    });

    try {
      // Add catalogs to the new collection in database
      await invokeLibraryAddCatalogsToCollection(collectionId, catalogIds);

      // Silently refresh in background to ensure consistency (without loading state)
      try {
        const freshCollections = await invokeLibraryGetCollections(selectedWorkspaceId);
        
        // Sort collections by order_index, then created_at for consistent ordering
        const sorted = [...freshCollections].sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });
        
        const freshMap = new Map<string, string[]>();
        for (const collection of sorted) {
          try {
            const catalogIds = await invokeLibraryGetCollectionCatalogIds(collection.id);
            freshMap.set(collection.id, catalogIds);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(collection.id, []);
          }
        }
        
        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        setCachedCollections(selectedWorkspaceId, sorted);
      } catch (refreshError) {
        console.error('Background refresh failed (using optimistic data):', refreshError);
        // Keep optimistic data - it's good enough
      }

      toaster.create({
        type: 'success',
        title: 'Moved to collection',
        description: `Moved ${catalogIds.length} catalog${catalogIds.length !== 1 ? 's' : ''} to collection`,
      });
    } catch (error) {
      console.error('Failed to move catalogs to collection:', error);
      
      // Rollback optimistic update on error
      invalidateCollections(selectedWorkspaceId);
      loadCollectionsFromDatabase(selectedWorkspaceId).catch(err => {
        console.error('Failed to reload after error:', err);
      });
      
      toaster.create({
        type: 'error',
        title: 'Failed to move catalogs',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Handle removing catalogs from collection
  const handleRemoveCatalogsFromCollection = async () => {
    const catalogIds = selectedCatalogsArray.map(c => c.catalog.id);
    if (catalogIds.length === 0 || !selectedWorkspaceId) return;

    // Clear selections immediately for fluid UX
    setSelectedCatalogs(new Map());
    setSelectedVariations(prev => {
      const next = new Map(prev);
      catalogIds.forEach(catalogId => {
        // Remove all variations that belong to these catalogs
        for (const [variationId, selectedVariation] of prev.entries()) {
          if (selectedVariation.catalog.id === catalogId) {
            next.delete(variationId);
          }
        }
      });
      return next;
    });

    // Optimistically remove catalogs from all collections
    setCollectionCatalogMap(prev => {
      const next = new Map(prev);
      for (const collectionId of next.keys()) {
        const existingIds = next.get(collectionId) || [];
        const filteredIds = existingIds.filter(id => !catalogIds.includes(id));
        next.set(collectionId, filteredIds);
      }
      return next;
    });

    try {
      // Get all collections and remove catalogs from each
      for (const collection of customCollections) {
        await invokeLibraryRemoveCatalogsFromCollection(collection.id, catalogIds);
      }

      // Silently refresh in background to ensure consistency (without loading state)
      try {
        const freshCollections = await invokeLibraryGetCollections(selectedWorkspaceId);
        
        // Sort collections by order_index, then created_at for consistent ordering
        const sorted = [...freshCollections].sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });
        
        const freshMap = new Map<string, string[]>();
        for (const collection of sorted) {
          try {
            const catalogIds = await invokeLibraryGetCollectionCatalogIds(collection.id);
            freshMap.set(collection.id, catalogIds);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(collection.id, []);
          }
        }
        
        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        setCachedCollections(selectedWorkspaceId, sorted);
      } catch (refreshError) {
        console.error('Background refresh failed (using optimistic data):', refreshError);
        // Keep optimistic data - it's good enough
      }

      toaster.create({
        type: 'success',
        title: 'Removed from collection',
        description: `Removed ${catalogIds.length} catalog${catalogIds.length !== 1 ? 's' : ''} from collection`,
      });
    } catch (error) {
      console.error('Failed to remove catalogs from collection:', error);
      
      // Rollback optimistic update on error
      invalidateCollections(selectedWorkspaceId);
      loadCollectionsFromDatabase(selectedWorkspaceId).catch(err => {
        console.error('Failed to reload after error:', err);
      });
      
      toaster.create({
        type: 'error',
        title: 'Failed to remove catalogs',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Handle updating a collection
  const handleUpdateCollection = async (updatedCollection: LibraryCollection) => {
    if (!selectedWorkspaceId) return;

    try {
      await invokeLibraryUpdateCollection(
        updatedCollection.id,
        updatedCollection.name,
        updatedCollection.description,
        updatedCollection.tags,
        updatedCollection.color
      );

      // Optimistically update collection in state
      setCustomCollections(prev => {
        const updated = prev.map(c => 
          c.id === updatedCollection.id ? updatedCollection : c
        );
        // Sort by order_index, then created_at
        return updated.sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });
      });

      // Silently refresh in background to ensure consistency
      try {
        const freshCollections = await invokeLibraryGetCollections(selectedWorkspaceId);
        const sorted = [...freshCollections].sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });
        setCustomCollections(sorted);
      } catch (refreshError) {
        console.error('Failed to refresh collections after update:', refreshError);
      }

      toaster.create({
        type: 'success',
        title: 'Collection updated',
        description: 'Collection has been updated successfully',
      });

      invalidateCollections(selectedWorkspaceId);
    } catch (error) {
      console.error('Failed to update collection:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to update collection',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  // Handle editing a collection (opens modal)
  const handleEditCollection = (collectionId: string) => {
    const collection = customCollections.find(c => c.id === collectionId);
    if (collection) {
      setEditingCollection(collection);
      setShowEditCollectionModal(true);
    }
  };

  // Handle deleting a collection
  const handleDeleteCollection = async (collectionId: string) => {
    const collection = customCollections.find(c => c.id === collectionId);
    if (!collection || !selectedWorkspaceId) return;

    // Optimistically remove collection from state immediately
    setCustomCollections(prev => prev.filter(c => c.id !== collectionId));
    setCollectionCatalogMap(prev => {
      const next = new Map(prev);
      next.delete(collectionId);
      return next;
    });

    try {
      await invokeLibraryDeleteCollection(collectionId);

      // Silently refresh in background to ensure consistency (without loading state)
      try {
        const freshCollections = await invokeLibraryGetCollections(selectedWorkspaceId);
        
        // Sort collections by order_index, then created_at for consistent ordering
        const sorted = [...freshCollections].sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          return a.created_at - b.created_at;
        });
        
        const freshMap = new Map<string, string[]>();
        for (const coll of sorted) {
          try {
            const catalogIds = await invokeLibraryGetCollectionCatalogIds(coll.id);
            freshMap.set(coll.id, catalogIds);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(coll.id, []);
          }
        }
        
        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        setCachedCollections(selectedWorkspaceId, sorted);
      } catch (refreshError) {
        console.error('Background refresh failed (using optimistic data):', refreshError);
        // Keep optimistic data - it's good enough
      }

      toaster.create({
        type: 'success',
        title: 'Collection deleted',
        description: `Deleted collection "${collection.name}"`,
      });
    } catch (error) {
      console.error('Failed to delete collection:', error);
      
      // Rollback optimistic update on error
      invalidateCollections(selectedWorkspaceId);
      loadCollectionsFromDatabase(selectedWorkspaceId).catch(err => {
        console.error('Failed to reload after error:', err);
      });
      
      toaster.create({
        type: 'error',
        title: 'Failed to delete collection',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const openGitHubRepo = async (workspace: LibraryWorkspace) => {
    await openShell(`https://github.com/${workspace.github_owner}/${workspace.github_repo}`);
  };

  // Handle editing workspace name
  const handleEditWorkspace = () => {
    if (selectedWorkspace) {
      setShowEditWorkspaceDialog(true);
    }
  };

  // Handle updating workspace name
  const handleUpdateWorkspaceName = async (name: string) => {
    if (!selectedWorkspaceId) return;

    try {
      const updated = await invokeLibraryUpdateWorkspaceName(selectedWorkspaceId, name);
      setWorkspaces(prev => prev.map(w => w.id === updated.id ? updated : w));
      toaster.create({
        type: 'success',
        title: 'Workspace updated',
        description: `Renamed workspace to "${name}"`,
      });
      setShowEditWorkspaceDialog(false);
    } catch (error) {
      console.error('Failed to update workspace name:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update workspace name',
      });
    }
  };

  // Handle pinning/unpinning workspace
  const handlePinWorkspace = async () => {
    if (!selectedWorkspace) return;

    const newPinnedState = !selectedWorkspace.pinned;
    try {
      const updated = await invokeLibrarySetWorkspacePinned(selectedWorkspace.id, newPinnedState);
      // Reload workspaces to get updated list with correct sorting
      const ws = await invokeLibraryListWorkspaces();
      setWorkspaces(ws);
      // Keep the same workspace selected
      setSelectedWorkspaceId(updated.id);
      toaster.create({
        type: 'success',
        title: newPinnedState ? 'Workspace pinned' : 'Workspace unpinned',
        description: newPinnedState 
          ? `"${updated.name}" is now your default workspace`
          : `"${updated.name}" is no longer pinned`,
      });
    } catch (error) {
      console.error('Failed to pin/unpin workspace:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update workspace pin state',
      });
    }
  };

  // Organize catalogs by custom collections (using unfiltered catalogs)
  // Filter is only applied to ungrouped catalogs
  const organizedCatalogs = useMemo(() => {
    const collectionCatalogs = new Map<string, CatalogWithVariations[]>();
    const catalogInCollection = new Set<string>();

    // First, assign catalogs to collections (using unfiltered catalogs)
    for (const collection of sortedCollections) {
      const collectionCats: CatalogWithVariations[] = [];
      const catalogIds = collectionCatalogMap.get(collection.id) || [];
      for (const catalogId of catalogIds) {
        const catWithVars = catalogs.find(c => c.catalog.id === catalogId);
        if (catWithVars) {
          collectionCats.push(catWithVars);
          catalogInCollection.add(catalogId);
        }
      }
      collectionCatalogs.set(collection.id, collectionCats);
    }

    // Get ungrouped catalogs (not in any custom collection) and apply filter
    const ungrouped = catalogs
      .filter(c => !catalogInCollection.has(c.catalog.id))
      .filter(matchesFilter);

    return { collectionCatalogs, ungrouped };
  }, [catalogs, sortedCollections, collectionCatalogMap, matchesFilter]);

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
        {/* Left side: Workspace dropdown + New Collection */}
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

          {/* New Collection button */}
          <Button
            size="sm"
            onClick={() => setShowCreateCollectionDialog(true)}
            colorPalette="blue"
            variant="subtle"
          >
            <HStack gap={2}>
              <Icon>
                <LuBookmarkPlus />
              </Icon>
              <Text>New Collection</Text>
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
                      value="edit"
                      onSelect={handleEditWorkspace}
                    >
                      <HStack gap={2}>
                        <LuPencil />
                        <Text>Edit Workspace</Text>
                      </HStack>
                    </Menu.Item>
                    <Menu.Item
                      value="pin"
                      onSelect={handlePinWorkspace}
                    >
                      <HStack gap={2}>
                        {selectedWorkspace.pinned ? <LuPinOff /> : <LuPin />}
                        <Text>{selectedWorkspace.pinned ? 'Unpin Workspace' : 'Pin Workspace'}</Text>
                      </HStack>
                    </Menu.Item>
                    <Menu.Separator />
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
        clearSelection={handleDeleteCatalogsClick}
        collections={sortedCollections}
        onMoveToCollection={handleMoveCatalogsToCollection}
        onRemoveFromCollection={handleRemoveCatalogsFromCollection}
        onCreateCollection={() => setShowCreateCollectionDialog(true)}
      />

      {/* Delete Catalogs Confirmation Dialog */}
      <Dialog.Root
        open={showDeleteCatalogsDialog}
        onOpenChange={(e) => {
          if (!e.open) {
            setShowDeleteCatalogsDialog(false);
          }
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="md">
              <Dialog.Header>
                <Dialog.Title>Delete Catalogs</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>

              <Dialog.Body>
                <VStack gap={4} align="stretch">
                  <Text>
                    Are you sure you want to delete <strong>{selectedCatalogsArray.length}</strong> catalog{selectedCatalogsArray.length !== 1 ? 's' : ''}?
                  </Text>
                  
                  <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200" _dark={{ bg: "red.950", borderColor: "red.800" }}>
                    <VStack gap={2} align="stretch">
                      <HStack gap={2}>
                        <Icon color="red.600" _dark={{ color: "red.400" }}>
                          <LuTrash2 />
                        </Icon>
                        <Text fontSize="sm" fontWeight="medium" color="red.800" _dark={{ color: "red.300" }}>
                          This will permanently delete:
                        </Text>
                      </HStack>
                      <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }} pl={6}>
                        • The catalog{selectedCatalogsArray.length !== 1 ? 's' : ''} from the workspace
                      </Text>
                      <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }} pl={6}>
                        • All variations associated with {selectedCatalogsArray.length === 1 ? 'this catalog' : 'these catalogs'}
                      </Text>
                      <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }} pl={6}>
                        • The file{selectedCatalogsArray.length !== 1 ? 's' : ''} from the GitHub repository
                      </Text>
                      <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }} pl={6} fontWeight="medium">
                        • This action cannot be undone
                      </Text>
                    </VStack>
                  </Box>

                  {selectedCatalogsArray.length <= 5 && (
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>
                        Catalog{selectedCatalogsArray.length !== 1 ? 's' : ''} to be deleted:
                      </Text>
                      <VStack gap={1} align="stretch" pl={2}>
                        {selectedCatalogsArray.map(({ catalog }) => (
                          <Text key={catalog.id} fontSize="sm" color="fg.muted">
                            • {catalog.name}
                          </Text>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </Dialog.Body>

              <Dialog.Footer>
                <HStack gap={2}>
                  <Button variant="outline" onClick={() => setShowDeleteCatalogsDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorPalette="red"
                    onClick={handleDeleteCatalogs}
                  >
                    <HStack gap={2}>
                      <LuTrash2 />
                      <Text>Delete {selectedCatalogsArray.length} Catalog{selectedCatalogsArray.length !== 1 ? 's' : ''}</Text>
                    </HStack>
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <VStack align="stretch" gap={6} width="100%">
        {/* Loading state - show when collections or catalogs are loading */}
        {(collectionsLoading || catalogsLoading) && (
          <Box position="relative">
            <Flex align="center" justify="space-between" gap={2} mb={4}>
              <Flex align="center" gap={2}>
                <Heading size="md">
                  {collectionsLoading ? 'Loading Collections...' : catalogsLoading ? 'Loading Catalogs...' : 'Loading...'}
                </Heading>
              </Flex>
            </Flex>
            <Flex justify="center" align="center" py={12}>
              <VStack gap={4}>
                <Spinner size="lg" />
                <Text fontSize="sm" color="text.secondary">
                  {collectionsLoading && catalogsLoading
                    ? 'Loading collections and catalogs...'
                    : collectionsLoading
                    ? 'Scanning GitHub for collections...'
                    : 'Loading catalogs...'}
                </Text>
              </VStack>
            </Flex>
          </Box>
        )}

        {/* Collections Section - only show if collections exist and not loading */}
        {!collectionsLoading && !catalogsLoading && sortedCollections.length > 0 && (
          <Box position="relative">
            <Flex align="center" justify="space-between" gap={2} mb={4}>
              <Flex align="center" gap={2}>
                <Icon>
                  <LuBookmark />
                </Icon>
                <Heading size="md">Collections</Heading>
                <Text fontSize="sm" color="text.muted">
                  {sortedCollections.length}
                </Text>
              </Flex>
            </Flex>

            <SimpleGrid 
              columns={{ base: 3, md: 4, lg: 5, xl: 6 }} 
              gap={2}
            >
              {sortedCollections.map((collection) => {
                const collectionCats = organizedCatalogs.collectionCatalogs.get(collection.id) || [];
                
                return (
                  <LibraryCollectionCard
                    key={collection.id}
                    collection={collection}
                    catalogs={collectionCats}
                    onOpenModal={() => setViewingCollection(collection.id)}
                    onDeleteCollection={() => handleDeleteCollection(collection.id)}
                    onEditCollection={() => handleEditCollection(collection.id)}
                  />
                );
              })}
            </SimpleGrid>
          </Box>
        )}

        {/* Catalogs Section - only show if not loading */}
        {!collectionsLoading && !catalogsLoading && (
          <Box mb={8} position="relative" width="100%" maxW="100%">
            <Flex align="center" gap={2} mb={4}>
              <Icon>
                <FaBook />
              </Icon>
              <Heading size="md">Catalog</Heading>
              <Text fontSize="sm" color="text.muted">
                {organizedCatalogs.ungrouped.length}
              </Text>
              {/* Filter Button - only show if there are catalogs or collections */}
              {(catalogs.length > 0 || customCollections.length > 0) && (
              <Box position="relative">
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
            )}
          </Flex>

          {catalogs.length === 0 && customCollections.length === 0 ? (
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
          ) : organizedCatalogs.ungrouped.length === 0 ? (
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
                  ? 'No catalogs match the current filters'
                  : 'All catalogs are organized in collections.'}
              </Text>
            </Box>
          ) : (
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
          </Box>
        )}
      </VStack>

      {/* Dialogs */}
      <AddWorkspaceDialog
        isOpen={showAddWorkspaceDialog}
        onClose={() => setShowAddWorkspaceDialog(false)}
        githubUser={githubUser}
        onWorkspaceCreated={handleWorkspaceCreated}
      />

      <CreateLibraryCollectionDialog
        isOpen={showCreateCollectionDialog}
        onClose={() => setShowCreateCollectionDialog(false)}
        onCreate={handleCreateCollection}
      />

      <EditWorkspaceDialog
        isOpen={showEditWorkspaceDialog}
        onClose={() => setShowEditWorkspaceDialog(false)}
        workspace={selectedWorkspace}
        onUpdate={handleUpdateWorkspaceName}
      />

      {/* Collection View Modal */}
      {viewingCollection && (() => {
        const collection = sortedCollections.find(c => c.id === viewingCollection);
        if (!collection) return null;
        const collectionCats = organizedCatalogs.collectionCatalogs.get(collection.id) || [];
        return (
          <CollectionViewModal
            isOpen={true}
            onClose={() => setViewingCollection(null)}
            collection={collection}
            catalogs={collectionCats}
            selectedVariations={selectedVariations}
            selectedCatalogs={selectedCatalogs}
            expandedCatalogs={expandedCatalogs}
            onCatalogExpandToggle={handleCatalogExpandToggle}
            onCatalogToggle={handleCatalogToggle}
            onVariationClick={handleVariationClick}
            onVariationToggle={handleVariationToggle}
            onDeleteCollection={() => {
              handleDeleteCollection(collection.id);
              setViewingCollection(null);
            }}
            onMoveToCollection={handleMoveCatalogsToCollection}
            onRemoveFromCollection={handleRemoveCatalogsFromCollection}
            onCreateCollection={() => {
              setShowCreateCollectionDialog(true);
              setViewingCollection(null);
            }}
            onBulkPull={handleBulkPull}
            clearVariationSelection={clearVariationSelection}
            clearCatalogSelection={handleDeleteCatalogsClick}
            projects={projects}
            bulkPulling={bulkPulling}
            allCollections={sortedCollections}
          />
        );
      })()}

      {/* Edit Collection Modal */}
      <EditLibraryCollectionModal
        isOpen={showEditCollectionModal}
        onClose={() => {
          setShowEditCollectionModal(false);
          setEditingCollection(null);
        }}
        onSave={handleUpdateCollection}
        collection={editingCollection}
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
      borderRadius="16px"
      borderWidth={isSelected ? "2px" : "1px"}
      transition="all 0.2s ease-in-out"
      css={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderColor: isSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        _dark: {
          background: 'rgba(0, 0, 0, 0.2)',
          borderColor: isSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        },
        _hover: {
          transform: 'scale(1.02)',
          borderColor: isSelected ? 'var(--chakra-colors-primary-600)' : 'var(--chakra-colors-primary-400)',
        },
      }}
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
          <HStack gap={2} flexWrap="wrap" mb={2}>
            {tags.map((tag: string, index: number) => (
              <Tag.Root key={`${catalog.id}-${tag}-${index}`} size="sm" variant="subtle" colorPalette="primary">
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


// Library Collection Card - simplified to open modal
interface LibraryCollectionCardProps {
  collection: LibraryCollection;
  catalogs: CatalogWithVariations[];
  onOpenModal: () => void;
  onDeleteCollection: () => void;
  onEditCollection: () => void;
}

function LibraryCollectionCard({
  collection,
  catalogs,
  onOpenModal,
  onDeleteCollection,
  onEditCollection,
}: LibraryCollectionCardProps) {
  // Helper function to infer artifact type from remote_path or variations
  const inferArtifactType = (catalogWithVariations: CatalogWithVariations): string => {
    const catalog = catalogWithVariations.catalog;
    let type = catalog.artifact_type;
    
    // If type is "unknown", try to infer from remote_path or variations
    if (type === 'unknown' || !type) {
      // First, check variations' remote_path
      for (const variation of catalogWithVariations.variations) {
        const remotePath = variation.remote_path || '';
        const pathParts = remotePath.split('/');
        
        // Look for artifact type directories in the path
        const artifactTypeMap: Record<string, string> = {
          'kits': 'kit',
          'walkthroughs': 'walkthrough',
          'agents': 'agent',
          'diagrams': 'diagram',
        };
        
        for (const part of pathParts) {
          if (artifactTypeMap[part]) {
            type = artifactTypeMap[part];
            return type;
          }
        }
        
        // Check file extension for diagrams
        if (remotePath.endsWith('.mmd') || remotePath.endsWith('.mermaid')) {
          type = 'diagram';
          return type;
        }
      }
      
      // Fallback: check catalog's remote_path
      const remotePath = catalog.remote_path || '';
      const pathParts = remotePath.split('/');
      
      const artifactTypeMap: Record<string, string> = {
        'kits': 'kit',
        'walkthroughs': 'walkthrough',
        'agents': 'agent',
        'diagrams': 'diagram',
      };
      
      for (const part of pathParts) {
        if (artifactTypeMap[part]) {
          type = artifactTypeMap[part];
          return type;
        }
      }
      
      // Check file extension for diagrams
      if (remotePath.endsWith('.mmd') || remotePath.endsWith('.mermaid')) {
        type = 'diagram';
        return type;
      }
    }
    
    return type || 'unknown';
  };
  
  // Count catalogs by artifact type
  const typeCounts = catalogs.reduce((acc, cat) => {
    const type = inferArtifactType(cat);
    if (type && type !== 'unknown') {
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Build summary similar to GlobalActionBar
  const resourceSummary: Array<{ count: number; icon: React.ReactNode }> = [];
  if (typeCounts.kit) {
    resourceSummary.push({ count: typeCounts.kit, icon: <LuPackage /> });
  }
  if (typeCounts.walkthrough) {
    resourceSummary.push({ count: typeCounts.walkthrough, icon: <LuBookOpen /> });
  }
  if (typeCounts.agent) {
    resourceSummary.push({ count: typeCounts.agent, icon: <LuBot /> });
  }
  if (typeCounts.diagram) {
    resourceSummary.push({ count: typeCounts.diagram, icon: <LuNetwork /> });
  }
  
  // If we have catalogs but couldn't determine types, show total count
  // This handles cases where artifact_type is "unknown" and paths don't contain type info
  if (resourceSummary.length === 0 && catalogs.length > 0) {
    resourceSummary.push({ count: catalogs.length, icon: <LuPackage /> });
  }

  return (
    <Card.Root
      cursor="pointer"
      onClick={onOpenModal}
      transition="all 0.2s ease-in-out"
      position="relative"
      overflow="hidden"
      borderRadius="16px"
      borderWidth="1px"
      p={2.5}
      display="flex"
      flexDirection="column"
      css={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderColor: collection.color || 'rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        _dark: {
          background: 'rgba(0, 0, 0, 0.2)',
          borderColor: collection.color || 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        },
        _hover: {
          transform: 'scale(1.02)',
        },
      }}
    >
      <VStack align="stretch" gap={0}>
        <Flex align="start" justify="space-between" gap={1.5} mb={1.5}>
          <VStack align="start" gap={1} flex={1} minW={0}>
            <Heading 
              size="md" 
              fontWeight="medium"
              css={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                lineHeight: '1.2',
              }}
            >
              {collection.name}
            </Heading>
            {resourceSummary.length > 0 && (
              <Box
                px={2}
                py={1}
                borderRadius="sm"
                bg="transparent"
              >
                <HStack gap={1.5} justify="flex-start" wrap="wrap">
                  {resourceSummary.map((part, index) => (
                    <HStack key={index} gap={1}>
                      {index > 0 && (
                        <Text fontSize="sm" color="blue.600" _dark={{ color: "blue.300" }}>
                          •
                        </Text>
                      )}
                      <Text fontSize="sm" color="blue.600" _dark={{ color: "blue.300" }}>
                        {part.count}
                      </Text>
                      <Icon fontSize="sm" color="blue.600" _dark={{ color: "blue.300" }}>
                        {part.icon}
                      </Icon>
                    </HStack>
                  ))}
                </HStack>
              </Box>
            )}
          </VStack>
          <Box flexShrink={0} onClick={(e) => e.stopPropagation()}>
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  variant="ghost"
                  size="xs"
                  aria-label="Collection options"
                  onClick={(e) => e.stopPropagation()}
                  bg="transparent"
                  _hover={{ bg: "bg.subtle" }}
                  _active={{ bg: "bg.subtle" }}
                  _focus={{ bg: "bg.subtle" }}
                  _focusVisible={{ bg: "bg.subtle" }}
                >
                  <Icon fontSize="xs">
                    <IoIosMore />
                  </Icon>
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item value="edit" onSelect={onEditCollection}>
                      <Icon><LuPencil /></Icon>
                      Edit Collection
                    </Menu.Item>
                    <Menu.Item value="delete" onSelect={onDeleteCollection}>
                      <Icon><LuTrash2 /></Icon>
                      Remove Collection
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </Box>
        </Flex>
      </VStack>
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

// Action bar for catalog bulk operations (collection management)
interface LibraryCatalogActionBarProps {
  selectedCatalogs: SelectedCatalog[];
  hasSelection: boolean;
  clearSelection: () => void;
  collections: LibraryCollection[];
  onMoveToCollection: (collectionId: string) => void;
  onRemoveFromCollection: () => void;
  onCreateCollection: () => void;
}

function LibraryCatalogActionBar({
  selectedCatalogs,
  hasSelection,
  clearSelection,
  collections,
  onMoveToCollection,
  onRemoveFromCollection,
  onCreateCollection,
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
                  onClick={onRemoveFromCollection}
                >
                  <HStack gap={2}>
                    <LuTrash2 />
                    <Text>Remove from Collection</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                {/* Move to Collection menu */}
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      <HStack gap={2}>
                        <LuBookmark />
                        <Text>Move to Collection</Text>
                        <LuChevronDown />
                      </HStack>
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner zIndex={2000}>
                      <Menu.Content>
                        {collections.length === 0 ? (
                          <Box px={3} py={2}>
                            <Text fontSize="sm" color="text.secondary">No collections yet</Text>
                          </Box>
                        ) : (
                          collections.map((collection) => (
                            <Menu.Item
                              key={collection.id}
                              value={collection.id}
                              onSelect={() => onMoveToCollection(collection.id)}
                            >
                              <HStack gap={2}>
                                <Icon color={collection.color || 'blue.500'}>
                                  <LuBookmark />
                                </Icon>
                                <Text>{collection.name}</Text>
                              </HStack>
                            </Menu.Item>
                          ))
                        )}
                        <Menu.Separator />
                        <Menu.Item value="new" onSelect={onCreateCollection}>
                          <HStack gap={2}>
                            <Icon color="primary.500">
                              <LuBookmarkPlus />
                            </Icon>
                            <Text>Create New Collection</Text>
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


// Create collection dialog
interface CreateLibraryCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string, tags?: string) => Promise<void>;
}

function CreateLibraryCollectionDialog({ isOpen, onClose, onCreate }: CreateLibraryCollectionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setTags('');
      setIsCreating(false);
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    try {
      // Parse tags: split by comma, trim, filter empty
      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const tagsJson = tagsArray.length > 0 ? JSON.stringify(tagsArray) : undefined;
      
      await onCreate(
        name.trim(),
        description.trim() || undefined,
        tagsJson
      );
      onClose();
    } catch (error) {
      // Error is already handled in onCreate
      console.error('Failed to create collection:', error);
    } finally {
      setIsCreating(false);
    }
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
        w="450px"
        maxW="90vw"
        maxH="90vh"
        overflowY="auto"
        zIndex={1001}
        onClick={(e) => e.stopPropagation()}
      >
        <VStack align="stretch" gap={4}>
          <Heading size="md">Create Collection</Heading>

          <Field.Root>
            <Field.Label>Name</Field.Label>
            <Input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Collection name"
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating && e.ctrlKey) {
                  handleSubmit();
                }
              }}
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>Description (optional)</Field.Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this collection contains..."
              disabled={isCreating}
              rows={3}
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>Tags (optional)</Field.Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated, tags"
              disabled={isCreating}
            />
            <Field.HelperText>Separate tags with commas</Field.HelperText>
          </Field.Root>

          <HStack gap={2} justify="flex-end">
            <Button variant="ghost" onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              colorPalette="primary"
              onClick={handleSubmit}
              disabled={!name.trim() || isCreating}
              loading={isCreating}
            >
              Create
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Portal>
  );
}

// Edit workspace dialog
interface EditWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: LibraryWorkspace | null;
  onUpdate: (name: string) => Promise<void>;
}

function EditWorkspaceDialog({ isOpen, onClose, workspace, onUpdate }: EditWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && workspace) {
      setName(workspace.name);
      setIsUpdating(false);
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, workspace]);

  const handleSubmit = async () => {
    if (!name.trim() || isUpdating || !workspace) return;
    setIsUpdating(true);
    try {
      await onUpdate(name.trim());
      onClose();
    } catch (error) {
      // Error is already handled in onUpdate
      console.error('Failed to update workspace:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen || !workspace) return null;

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
          <Heading size="md">Edit Workspace</Heading>

          <Input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            disabled={isUpdating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isUpdating) handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
          />

          <HStack gap={2} justify="flex-end">
            <Button variant="ghost" onClick={onClose} disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              colorPalette="primary"
              onClick={handleSubmit}
              disabled={!name.trim() || isUpdating || name === workspace.name}
              loading={isUpdating}
            >
              Save
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Portal>
  );
}

export default LibraryTabContent;
