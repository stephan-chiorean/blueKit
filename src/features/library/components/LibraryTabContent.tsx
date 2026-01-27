import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useCallback, ReactElement, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Button,
  EmptyState,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
  Badge,
  Menu,
  Portal,
  Select,
  createListCollection,
  Dialog,
  CloseButton,
  Popover,
  Input,
} from '@chakra-ui/react';
import {
  LuLibrary,
  LuPlus,
  LuRefreshCw,
  LuBookOpen,
  LuGithub,
  LuTrash2,
  LuExternalLink,
  LuLayers,
  LuFilter,
  LuBookmark,
  LuBookmarkPlus,
  LuPin,
  LuPinOff,
  LuPencil,
} from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { open as openShell } from '@tauri-apps/api/shell';

import { LibraryCollectionCard } from './LibraryCollectionCard';

import { toaster } from '@/shared/components/ui/toaster';
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
} from '@/ipc/library';
import {
  LibraryWorkspace,
  CatalogWithVariations,
  LibraryVariation,
  LibraryCatalog,
  GitHubUser,
} from '@/types/github';
import { Project, invokeGetProjectRegistry } from '@/ipc';
import { invokeGitHubGetUser, invokeGitHubGetFile } from '@/ipc/github';
import { useLibraryCache } from '@/shared/contexts/LibraryCacheContext';
import { useGitHubIntegration } from '@/shared/contexts/GitHubIntegrationContext';
import { ResourceFile, ResourceType } from '@/types/resource';
import AddWorkspaceDialog from './AddWorkspaceDialog';
import { FilterPanel } from '@/shared/components/FilterPanel';
import CollectionView from './CollectionView';
import EditLibraryCollectionModal from './EditLibraryCollectionModal';
import { LibrarySelectionBar } from './LibrarySelectionBar';
import { CatalogCard } from './CatalogCard';
import { CatalogDetailModal, SelectedVariation } from './CatalogDetailModal';
import { GitHubConnectButton } from '@/features/auth/components/GitHubConnectButton';

type ViewMode = 'loading' | 'no-auth' | 'no-workspaces' | 'browse';

// Ref type for external control
export interface LibraryTabContentRef {
  openAddWorkspaceDialog: () => void;
  hasSelections: () => boolean;
  clearSelections: () => void;
}

// Props for LibraryTabContent
interface LibraryTabContentProps {
  onViewVariation?: (resource: ResourceFile, content: string, resourceType: ResourceType) => void;
}



// Library collection is now imported from IPC - no local interface needed

const LibraryTabContent = forwardRef<LibraryTabContentRef, LibraryTabContentProps>(function LibraryTabContent({ onViewVariation }, ref) {
  const {
    getCachedCatalogs,
    setCachedCatalogs,
    getCachedCollections,
    setCachedCollections,
    getCachedWorkspaces,
    setCachedWorkspaces,
    invalidateWorkspaces,
    invalidateCatalogs,
    invalidateCollections,
    getCachedVariationContent,
    setCachedVariationContent
  } = useLibraryCache();
  const { isConnected: isGitHubConnected, accessToken, user: gitHubUserFromContext } = useGitHubIntegration();
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
  // showCreateCollectionDialog removed in favor of popover
  const [showDeleteCatalogsDialog, setShowDeleteCatalogsDialog] = useState(false);
  const [showEditWorkspaceDialog, setShowEditWorkspaceDialog] = useState(false);

  // Collection modal state
  const [viewingCollection, setViewingCollection] = useState<string | null>(null);

  // Catalog detail modal state
  const [viewingCatalog, setViewingCatalog] = useState<CatalogWithVariations | null>(null);

  // Edit collection modal state
  const [editingCollection, setEditingCollection] = useState<LibraryCollection | null>(null);
  const [showEditCollectionModal, setShowEditCollectionModal] = useState(false);

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

  // Multi-select state for variations (single source of truth for selection)
  const [selectedVariations, setSelectedVariations] = useState<Map<string, SelectedVariation>>(new Map());
  const [bulkPulling, setBulkPulling] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    openAddWorkspaceDialog: () => setShowAddWorkspaceDialog(true),
    hasSelections: () => selectedVariations.size > 0,
    clearSelections: () => setSelectedVariations(new Map()),
  }));

  // Filter state
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Spotlight Popover State (New Collection)
  const [isCollectionPopoverOpen, setIsCollectionPopoverOpen] = useState(false);
  const [shouldShowBlur, setShouldShowBlur] = useState(false);

  // Refs for synchronous state tracking (prevent flicker)
  const isCollectionPopoverOpenRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateBlurState = useCallback(() => {
    if (isCollectionPopoverOpenRef.current) {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      setShouldShowBlur(true);
    } else {
      blurTimeoutRef.current = setTimeout(() => {
        if (!isCollectionPopoverOpenRef.current) {
          setShouldShowBlur(false);
        }
      }, 100);
    }
  }, []);

  const handleCollectionPopoverChange = useCallback((isOpen: boolean) => {
    isCollectionPopoverOpenRef.current = isOpen;
    setIsCollectionPopoverOpen(isOpen);
    updateBlurState();
  }, [updateBlurState]);

  // Portal target ref for workspace selector
  const portalTargetRef = useRef<HTMLElement | null>(null);
  const [isPortalTargetAvailable, setIsPortalTargetAvailable] = useState(false);

  // Monitor portal target element availability
  useEffect(() => {
    const checkPortalTarget = () => {
      const element = document.getElementById('header-left-actions');
      if (element) {
        // Check if element is visible (not display: none)
        const style = window.getComputedStyle(element);
        const isVisible = style.display !== 'none';

        if (isVisible && element !== portalTargetRef.current) {
          portalTargetRef.current = element;
          setIsPortalTargetAvailable(true);
        } else if (!isVisible) {
          setIsPortalTargetAvailable(false);
        }
      } else {
        portalTargetRef.current = null;
        setIsPortalTargetAvailable(false);
      }
    };

    // Check immediately
    checkPortalTarget();

    // Set up MutationObserver to watch for changes to the element
    const observer = new MutationObserver(checkPortalTarget);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Also check periodically in case MutationObserver misses something
    const interval = setInterval(checkPortalTarget, 100);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

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

  // Derive selected catalog IDs from selected variations
  // A catalog is "selected" if any of its variations are selected
  const selectedCatalogIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { catalog } of selectedVariations.values()) {
      ids.add(catalog.id);
    }
    return ids;
  }, [selectedVariations]);

  // Get unique catalogs from selected variations (for collection operations)
  const selectedCatalogsFromVariations = useMemo(() => {
    const catalogMap = new Map<string, { catalog: LibraryCatalog; variations: LibraryVariation[] }>();
    for (const { catalog, variation } of selectedVariations.values()) {
      const existing = catalogMap.get(catalog.id);
      if (existing) {
        existing.variations.push(variation);
      } else {
        catalogMap.set(catalog.id, { catalog, variations: [variation] });
      }
    }
    return Array.from(catalogMap.values());
  }, [selectedVariations]);


  // Map of selected catalogs for O(1) lookup in CollectionView
  const selectedCatalogsMap = useMemo(() => {
    const map = new Map();
    selectedCatalogsFromVariations.forEach(sc => map.set(sc.catalog.id, sc));
    return map;
  }, [selectedCatalogsFromVariations]);


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
    const cachedCollections = await getCachedCollections(workspaceId);
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
        await setCachedCollections(workspaceId, sorted);
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
        // Deduplicate catalog IDs to prevent duplicate keys in React rendering
        const uniqueCatalogIds = [...new Set(catalogIds)];
        map.set(collection.id, uniqueCatalogIds);
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

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // React to GitHub integration context changes
  useEffect(() => {
    if (isGitHubConnected && gitHubUserFromContext) {
      setGithubUser(gitHubUserFromContext);
      setViewMode('browse');
      loadWorkspaces();
    } else {
      setGithubUser(null);
      setViewMode('no-auth');
    }
  }, [isGitHubConnected, gitHubUserFromContext]);

  const loadWorkspaces = async () => {
    // Check cache first
    const cachedWorkspaces = await getCachedWorkspaces();
    if (cachedWorkspaces) {
      // Use cached data immediately
      setWorkspaces(cachedWorkspaces);
      if (cachedWorkspaces.length === 0) {
        setViewMode('no-workspaces');
      } else {
        // Prefer pinned workspace, otherwise first one
        const pinnedWorkspace = cachedWorkspaces.find(w => w.pinned);
        setSelectedWorkspaceId(pinnedWorkspace ? pinnedWorkspace.id : cachedWorkspaces[0].id);
        setViewMode('browse');
      }

      // Refresh in background to get latest data
      try {
        const ws = await invokeLibraryListWorkspaces();
        setWorkspaces(ws);
        await setCachedWorkspaces(ws);
        if (ws.length === 0) {
          setViewMode('no-workspaces');
        } else {
          // Prefer pinned workspace, otherwise first one
          const pinnedWorkspace = ws.find(w => w.pinned);
          setSelectedWorkspaceId(pinnedWorkspace ? pinnedWorkspace.id : ws[0].id);
          setViewMode('browse');
        }
      } catch (error) {
        console.error('Failed to refresh workspaces (using cached data):', error);
        // Keep using cached data on error
      }
      return;
    }

    // No cache, load from backend
    try {
      const ws = await invokeLibraryListWorkspaces();
      setWorkspaces(ws);
      await setCachedWorkspaces(ws);
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
      // Clear selection when switching workspaces (catalogs are derived from variations)
      setSelectedVariations(new Map());
      // Reset filters when switching workspaces
      setNameFilter('');
      setSelectedTags([]);
    }
  }, [selectedWorkspaceId]);

  const loadCatalogs = async (workspaceId: string) => {
    // Check cache first
    const cached = await getCachedCatalogs(workspaceId);
    if (cached) {
      setCatalogs(cached);
      return;
    }

    setCatalogsLoading(true);
    try {
      const cats = await invokeListWorkspaceCatalogs(workspaceId);
      setCatalogs(cats);
      await setCachedCatalogs(workspaceId, cats);
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
      await invalidateCatalogs(selectedWorkspace.id);
      await invalidateCollections(selectedWorkspace.id);
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

  const handleWorkspaceCreated = async (workspace: LibraryWorkspace) => {
    const updatedWorkspaces = [...workspaces, workspace];
    setWorkspaces(updatedWorkspaces);
    setSelectedWorkspaceId(workspace.id);
    setViewMode('browse');
    // Invalidate and update cache
    await invalidateWorkspaces();
    await setCachedWorkspaces(updatedWorkspaces);
  };

  const handleDeleteWorkspace = async (workspace: LibraryWorkspace) => {
    if (!confirm(`Delete workspace "${workspace.name}"? This will remove it from BlueKit but won't delete the GitHub repository.`)) {
      return;
    }
    try {
      await invokeLibraryDeleteWorkspace(workspace.id);
      const updatedWorkspaces = workspaces.filter((w) => w.id !== workspace.id);
      setWorkspaces(updatedWorkspaces);
      if (selectedWorkspaceId === workspace.id) {
        setSelectedWorkspaceId(updatedWorkspaces.length > 0 ? updatedWorkspaces[0].id : null);
        if (updatedWorkspaces.length === 0) {
          setViewMode('no-workspaces');
        }
      }
      // Invalidate and update cache
      await invalidateWorkspaces();
      await setCachedWorkspaces(updatedWorkspaces);
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



  // Fetch variation content for preview modal
  const fetchVariationContent = async (variation: LibraryVariation, _catalog: LibraryCatalog): Promise<string> => {
    if (!selectedWorkspace) {
      throw new Error('No workspace selected');
    }

    // Check cache first
    try {
      const cached = await getCachedVariationContent(variation.remote_path);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Failed to read from cache:', error);
      // Continue to fetch from network
    }

    const content = await invokeGitHubGetFile(
      selectedWorkspace.github_owner,
      selectedWorkspace.github_repo,
      variation.remote_path,
      '' // Library implementation pending revamp
    );

    // Update cache
    try {
      await setCachedVariationContent(variation.remote_path, content);
    } catch (error) {
      console.warn('Failed to write to cache:', error);
      // Non-fatal error
    }

    return content;
  };




  // Handle catalog selection toggle - toggles all variations of the catalog
  // Catalog selection is derived from variations, so we only update variations
  const handleCatalogToggle = (catalogWithVariations: CatalogWithVariations) => {
    const { catalog, variations } = catalogWithVariations;

    // Check if ANY variation from this catalog is selected
    const hasAnySelected = variations.some(v => selectedVariations.has(v.id));

    setSelectedVariations(prev => {
      const next = new Map(prev);
      if (hasAnySelected) {
        // Deselect all variations from this catalog
        for (const variation of variations) {
          next.delete(variation.id);
        }
      } else {
        // Select all variations from this catalog
        for (const variation of variations) {
          next.set(variation.id, { variation, catalog });
        }
      }
      return next;
    });
  };

  // Clear all selections
  const clearVariationSelection = () => {
    setSelectedVariations(new Map());
  };

  // Handle deleting catalogs from workspace (called after confirmation)
  const handleDeleteCatalogs = async () => {
    const catalogIds = selectedCatalogsFromVariations.map(c => c.catalog.id);
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

      // Clear selections immediately (only variations, catalogs are derived)
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
        await invalidateCatalogs(selectedWorkspaceId);
      } catch (cacheError) {
        console.error('Failed to invalidate cache:', cacheError);
        // Continue anyway
      }

      // Force reload from API (bypass cache) to ensure consistency
      setCatalogsLoading(true);
      try {
        const freshCatalogs = await invokeListWorkspaceCatalogs(selectedWorkspaceId);
        setCatalogs(freshCatalogs);
        await setCachedCatalogs(selectedWorkspaceId, freshCatalogs);
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
      await setCachedCollections(selectedWorkspaceId, updatedCollections);

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
            // Deduplicate catalog IDs to prevent duplicate keys in React rendering
            freshMap.set(collection.id, [...new Set(catalogIds)]);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(collection.id, []);
          }
        }

        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        await setCachedCollections(selectedWorkspaceId, sorted);
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
      await invalidateCollections(selectedWorkspaceId);
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
    const catalogIds = selectedCatalogsFromVariations.map(c => c.catalog.id);
    if (catalogIds.length === 0 || !selectedWorkspaceId) return;

    // Clear selections immediately for fluid UX (only variations, catalogs are derived)
    setSelectedVariations(new Map());

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
            const catIds = await invokeLibraryGetCollectionCatalogIds(collection.id);
            // Deduplicate catalog IDs to prevent duplicate keys in React rendering
            freshMap.set(collection.id, [...new Set(catIds)]);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(collection.id, []);
          }
        }

        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        await setCachedCollections(selectedWorkspaceId, sorted);
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
      await invalidateCollections(selectedWorkspaceId);
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
    const catalogIds = selectedCatalogsFromVariations.map(c => c.catalog.id);
    if (catalogIds.length === 0 || !selectedWorkspaceId) return;

    // Clear selections immediately for fluid UX (only variations, catalogs are derived)
    setSelectedVariations(new Map());

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
        for (const coll of sorted) {
          try {
            const catIds = await invokeLibraryGetCollectionCatalogIds(coll.id);
            // Deduplicate catalog IDs to prevent duplicate keys in React rendering
            freshMap.set(coll.id, [...new Set(catIds)]);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(coll.id, []);
          }
        }

        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        await setCachedCollections(selectedWorkspaceId, sorted);
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
      await invalidateCollections(selectedWorkspaceId);
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

      await invalidateCollections(selectedWorkspaceId);
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
            const catIds = await invokeLibraryGetCollectionCatalogIds(coll.id);
            // Deduplicate catalog IDs to prevent duplicate keys in React rendering
            freshMap.set(coll.id, [...new Set(catIds)]);
          } catch (mapError) {
            console.error('Failed to load catalog IDs for collection:', mapError);
            freshMap.set(coll.id, []);
          }
        }

        // Update with fresh data silently (preserving order)
        setCustomCollections(sorted);
        setCollectionCatalogMap(freshMap);
        await setCachedCollections(selectedWorkspaceId, sorted);
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
      await invalidateCollections(selectedWorkspaceId);
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
      const updatedWorkspaces = workspaces.map(w => w.id === updated.id ? updated : w);
      setWorkspaces(updatedWorkspaces);
      // Invalidate and update cache
      await invalidateWorkspaces();
      await setCachedWorkspaces(updatedWorkspaces);
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
      // Invalidate and update cache
      await invalidateWorkspaces();
      await setCachedWorkspaces(ws);
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
      // Deduplicate catalog IDs to prevent duplicate keys in React rendering
      const uniqueCatalogIds = [...new Set(catalogIds)];
      for (const catalogId of uniqueCatalogIds) {
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
            Connect your GitHub account to access the library and publish resources.
          </EmptyState.Description>
          <GitHubConnectButton />
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
    <Box width="100%">
      {/* Workspace Selector Portal - Rendered in top bar next to menu */}
      {isPortalTargetAvailable && portalTargetRef.current && createPortal(
        <Select.Root
          collection={workspacesCollection}
          value={selectedWorkspaceId ? [selectedWorkspaceId] : []}
          onValueChange={(details) => setSelectedWorkspaceId(details.value[0] || null)}
          size="sm"
          width="180px"
        >
          <Select.HiddenSelect />
          <Select.Control
            cursor="pointer"
            borderWidth="1px"
            borderRadius="lg"
            px={2}
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
            <Select.Trigger
              width="100%"
              bg="transparent"
              border="none"
              _focus={{ boxShadow: "none", outline: "none" }}
              _hover={{ bg: "transparent" }}
              _active={{ bg: "transparent" }}
              css={{
                "& button": {
                  border: "none",
                  boxShadow: "none"
                }
              }}
            >
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
              <Select.Content
                borderWidth="1px"
                borderRadius="lg"
                css={{
                  background: 'rgba(255, 255, 255, 0.65)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.1)',
                  _dark: {
                    background: 'rgba(20, 20, 25, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                  },
                }}
              >
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
        </Select.Root>,
        portalTargetRef.current
      )}

      {/* Unified Library Action Bar - hide when collection modal is open */}
      <Portal>
        <LibrarySelectionBar
          isOpen={!viewingCollection && selectedVariations.size > 0}
          selectedVariations={selectedVariationsArray}
          onClearSelection={clearVariationSelection}
          onRemoveFromCollection={handleRemoveCatalogsFromCollection}
          onMoveToCollection={handleMoveCatalogsToCollection}
          onBulkPull={handleBulkPull}
          projects={projects}
          collections={sortedCollections}
          isLoading={bulkPulling}
          position="fixed"
        />
      </Portal>

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
                    Are you sure you want to delete <strong>{selectedCatalogsFromVariations.length}</strong> catalog{selectedCatalogsFromVariations.length !== 1 ? 's' : ''}?
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
                        • The catalog{selectedCatalogsFromVariations.length !== 1 ? 's' : ''} from the workspace
                      </Text>
                      <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }} pl={6}>
                        • All variations associated with {selectedCatalogsFromVariations.length === 1 ? 'this catalog' : 'these catalogs'}
                      </Text>
                      <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }} pl={6}>
                        • The file{selectedCatalogsFromVariations.length !== 1 ? 's' : ''} from the GitHub repository
                      </Text>
                      <Text fontSize="sm" color="red.700" _dark={{ color: "red.300" }} pl={6} fontWeight="medium">
                        • This action cannot be undone
                      </Text>
                    </VStack>
                  </Box>

                  {selectedCatalogsFromVariations.length <= 5 && (
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>
                        Catalog{selectedCatalogsFromVariations.length !== 1 ? 's' : ''} to be deleted:
                      </Text>
                      <VStack gap={1} align="stretch" pl={2}>
                        {selectedCatalogsFromVariations.map(({ catalog }) => (
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
                      <Text>Delete {selectedCatalogsFromVariations.length} Catalog{selectedCatalogsFromVariations.length !== 1 ? 's' : ''}</Text>
                    </HStack>
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {viewingCollection && sortedCollections.find(c => c.id === viewingCollection) ? (
        <CollectionView
          collection={sortedCollections.find(c => c.id === viewingCollection)!}
          catalogs={organizedCatalogs.collectionCatalogs.get(viewingCollection) || []}
          selectedVariations={selectedVariations}
          selectedCatalogs={selectedCatalogsMap}
          onCatalogToggle={handleCatalogToggle}
          onVariationToggle={handleVariationToggle}
          onMoveToCollection={(targetId) => handleMoveCatalogsToCollection(targetId)}
          onRemoveFromCollection={() => handleRemoveCatalogsFromCollection()}
          onBulkPull={handleBulkPull}
          clearVariationSelection={clearVariationSelection}
          projects={projects}
          bulkPulling={bulkPulling}
          allCollections={sortedCollections}
          onFetchVariationContent={fetchVariationContent}
          onBack={() => setViewingCollection(null)}
        />
      ) : (
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

          {/* Collections Section - controls always visible if not loading */}
          {!collectionsLoading && !catalogsLoading && (
            <Box position="relative">
              <Flex align="center" justify="space-between" gap={2} mb={4}>
                <HStack gap={4}>
                  {sortedCollections.length > 0 && (
                    <Flex align="center" gap={2}>
                      <Icon>
                        <LuBookmark />
                      </Icon>
                      <Heading size="md">Collections</Heading>
                      <Text fontSize="sm" color="text.muted">
                        {sortedCollections.length}
                      </Text>
                    </Flex>
                  )}

                  {/* New Collection Popover */}
                  <AddCollectionPopover
                    isOpen={isCollectionPopoverOpen}
                    onOpenChange={handleCollectionPopoverChange}
                    onConfirm={async (name) => {
                      await handleCreateCollection(name);
                    }}
                    trigger={
                      <Button
                        size="sm"
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
                    }
                  />
                </HStack>

                {/* Right side: GitHub link, Sync, Menu */}
                <HStack gap={2}>
                  {/* GitHub link */}
                  {selectedWorkspace && (
                    <HStack
                      gap={1}
                      cursor="pointer"
                      onClick={() => openGitHubRepo(selectedWorkspace)}
                      px={2}
                      py={1}
                      borderRadius="lg"
                      borderWidth="1px"
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

              {sortedCollections.length > 0 && (
                <SimpleGrid
                  columns={{ base: 3, md: 4, lg: 5, xl: 6 }}
                  gap={4}
                  p={1}
                  mb={4}
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
              )}
            </Box>
          )}

          {/* Catalogs Section - only show if not loading */}
          {!collectionsLoading && !catalogsLoading && (
            <Box mb={8} position="relative" width="100%" maxW="100%">
              <Flex align="center" gap={2} mb={4}>
                <Icon>
                  <LuBookOpen />
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
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} p={1}>
                  {organizedCatalogs.ungrouped.map((catWithVars) => (
                    <CatalogCard
                      key={catWithVars.catalog.id}
                      catalogWithVariations={catWithVars}
                      isSelected={selectedCatalogIds.has(catWithVars.catalog.id)}
                      onCatalogToggle={() => handleCatalogToggle(catWithVars)}
                      onCardClick={() => setViewingCatalog(catWithVars)}
                    />
                  ))}
                </SimpleGrid>
              )}
            </Box>
          )}
        </VStack>
      )}

      {/* Dialogs */}
      < AddWorkspaceDialog
        isOpen={showAddWorkspaceDialog}
        onClose={() => setShowAddWorkspaceDialog(false)}
        githubUser={githubUser}
        onWorkspaceCreated={handleWorkspaceCreated}
      />

      {/* Spotlight Blur Backdrop */}
      {shouldShowBlur && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={1300}
            css={{
              backdropFilter: 'blur(8px) saturate(120%)',
              WebkitBackdropFilter: 'blur(8px) saturate(120%)',
              background: 'rgba(0, 0, 0, 0.2)',
              _dark: {
                background: 'rgba(0, 0, 0, 0.4)',
              },
              pointerEvents: 'auto',
            }}
            onClick={() => {
              setIsCollectionPopoverOpen(false);
            }}
          />
        </Portal>
      )}

      <EditWorkspaceDialog
        isOpen={showEditWorkspaceDialog}
        onClose={() => setShowEditWorkspaceDialog(false)}
        workspace={selectedWorkspace}
        onUpdate={handleUpdateWorkspaceName}
      />

      {/* Collection View Modal */}

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

      {/* Catalog Detail Modal */}
      {viewingCatalog && (
        <CatalogDetailModal
          isOpen={!!viewingCatalog}
          onClose={() => setViewingCatalog(null)}
          catalogWithVariations={viewingCatalog}
          onFetchVariationContent={fetchVariationContent}
          selectedVariations={selectedVariations}
          onVariationToggle={handleVariationToggle}
          projects={projects}
          onBulkPull={handleBulkPull}
          bulkPulling={bulkPulling}
        />
      )}
    </Box>
  );
});

LibraryTabContent.displayName = 'LibraryTabContent';


// Spotlight Popover for Adding Collection
function AddCollectionPopover({
  isOpen,
  onOpenChange,
  onConfirm,
  trigger
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => Promise<void>;
  trigger: ReactElement; // Enforce ReactElement to allow cloning if needed
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const initialFocusRef = useRef<HTMLInputElement>(null);

  // Spotlight logic
  const triggerContainerRef = useRef<HTMLDivElement>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  // Measure trigger when opening
  useEffect(() => {
    if (isOpen && triggerContainerRef.current) {
      const rect = triggerContainerRef.current.getBoundingClientRect();
      setTriggerRect(rect);
    }
  }, [isOpen]);

  // Handle window resize updating the spotlight position
  useEffect(() => {
    if (!isOpen) return;

    const updateRect = () => {
      if (triggerContainerRef.current) {
        setTriggerRect(triggerContainerRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onConfirm(name);
      onOpenChange(false);
      setName('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Visual Clone of Trigger (Spotlight) */}
      {isOpen && triggerRect && (
        <Portal>
          <Box
            position="fixed"
            top={`${triggerRect.top}px`}
            left={`${triggerRect.left}px`}
            width={`${triggerRect.width}px`}
            height={`${triggerRect.height}px`}
            zIndex={1401} // Above popover (1400) and backdrop (1300)
            pointerEvents="none" // Click-through to backdrop (closes popover)
          >
            {cloneElement(trigger, {
              'data-state': 'open',
              'aria-expanded': true,
            } as any)}
          </Box>
        </Portal>
      )}

      <Popover.Root
        open={isOpen}
        onOpenChange={(e) => onOpenChange(e.open)}
        initialFocusEl={() => initialFocusRef.current}
        positioning={{ placement: 'bottom-start', gutter: 8 }}
      >
        <Popover.Trigger asChild>
          {cloneElement(trigger, {
            ref: (node: HTMLElement) => {
              // Capture ref for our spotlight measurement
              (triggerContainerRef as any).current = node;

              // Preserve existing ref if it exists (generic safety)
              const existingRef = (trigger as any).ref;
              if (typeof existingRef === 'function') {
                existingRef(node);
              } else if (existingRef) {
                existingRef.current = node;
              }
            }
          } as any)}
        </Popover.Trigger>

        <Portal>
          <Popover.Positioner zIndex={1400}>
            <Popover.Content
              width="320px"
              borderRadius="xl"
              css={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderWidth: '1px',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                _dark: {
                  background: 'rgba(30, 30, 30, 0.85)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
                },
              }}
            >
              <Popover.Body p={3}>
                <VStack align="stretch" gap={3}>
                  <Text fontSize="sm" fontWeight="semibold">New Collection</Text>
                  <HStack gap={2}>
                    <Input
                      ref={initialFocusRef}
                      placeholder="Collection Name"
                      size="sm"
                      variant="subtle"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmit();
                      }}
                      disabled={loading}
                      borderRadius="md"
                    />
                    <IconButton
                      aria-label="Create"
                      size="sm"
                      colorPalette="blue"
                      onClick={handleSubmit}
                      loading={loading}
                      disabled={!name.trim()}
                      rounded="md"
                    >
                      <Icon><LuPlus /></Icon>
                    </IconButton>
                  </HStack>
                </VStack>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </>
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

