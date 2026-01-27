import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CatalogWithVariations, LibraryWorkspace } from '@/types/github';
import { LibraryCollection } from '@/ipc/library';
import { cacheStorage } from '@/shared/utils/cacheStorage';

interface CachedCatalogs {
  catalogs: CatalogWithVariations[];
  timestamp: number;
}

interface CachedFolders {
  folders: string[];
  timestamp: number;
}

interface CachedCollections {
  collections: LibraryCollection[];
  timestamp: number;
}

interface LibraryCacheContextType {
  // Catalogs cache (for library workspace catalogs)
  getCachedCatalogs: (workspaceId: string) => Promise<CatalogWithVariations[] | null>;
  setCachedCatalogs: (workspaceId: string, catalogs: CatalogWithVariations[]) => Promise<void>;

  // Folders cache (for GitHub folder names in library workspaces) - DEPRECATED
  getCachedFolders: (workspaceId: string) => string[] | null;
  setCachedFolders: (workspaceId: string, folders: string[]) => void;

  // Collections cache (for SQLite-backed library collections)
  getCachedCollections: (workspaceId: string) => Promise<LibraryCollection[] | null>;
  setCachedCollections: (workspaceId: string, collections: LibraryCollection[]) => Promise<void>;

  // Workspaces cache (global list of all workspaces)
  getCachedWorkspaces: () => Promise<LibraryWorkspace[] | null>;
  setCachedWorkspaces: (workspaces: LibraryWorkspace[]) => Promise<void>;
  invalidateWorkspaces: () => Promise<void>;

  // Content cache (persistent via IndexedDB)
  getCachedVariationContent: (path: string) => Promise<string | null>;
  setCachedVariationContent: (path: string, content: string) => Promise<void>;
  invalidateVariationContent: (path?: string) => Promise<void>;

  // Cache invalidation
  invalidateCatalogs: (workspaceId: string) => Promise<void>;
  invalidateFolders: (workspaceId: string) => void;
  invalidateCollections: (workspaceId: string) => Promise<void>;
  clearAllCache: () => void;
}

const LibraryCacheContext = createContext<LibraryCacheContextType | undefined>(undefined);

export function LibraryCacheProvider({ children }: { children: ReactNode }) {
  // Folders cache (deprecated, kept for backwards compatibility)
  const [foldersCache, setFoldersCache] = useState<Map<string, CachedFolders>>(new Map());

  // Cache TTL: 24 hours for content (collections/catalogs have no TTL - invalidate on Sync only)
  const CONTENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Catalogs cache (library workspace catalogs) - stored in IndexedDB
  const getCachedCatalogs = useCallback(async (workspaceId: string): Promise<CatalogWithVariations[] | null> => {
    try {
      const key = `catalogs-${workspaceId}`;
      const cached = await cacheStorage.getJson<CatalogWithVariations[]>(key);
      if (cached) {
        return cached.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached catalogs:', error);
      return null;
    }
  }, []);

  const setCachedCatalogs = useCallback(async (workspaceId: string, catalogs: CatalogWithVariations[]) => {
    try {
      const key = `catalogs-${workspaceId}`;
      await cacheStorage.setJson(key, catalogs, Date.now());
    } catch (error) {
      console.error('Failed to cache catalogs:', error);
    }
  }, []);

  // Folders cache (GitHub folder names) - deprecated, kept for backwards compatibility
  const getCachedFolders = useCallback((workspaceId: string): string[] | null => {
    const cached = foldersCache.get(workspaceId);
    // No TTL check - folders cache is deprecated
    if (cached) {
      return cached.folders;
    }
    return null;
  }, [foldersCache]);

  const setCachedFolders = useCallback((workspaceId: string, folders: string[]) => {
    setFoldersCache(prev => {
      const next = new Map(prev);
      next.set(workspaceId, {
        folders,
        timestamp: Date.now(),
      });
      return next;
    });
  }, []);

  // Content cache (Persistent)
  const getCachedVariationContent = useCallback(async (path: string): Promise<string | null> => {
    const cached = await cacheStorage.get(path);
    if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL) {
      return cached.content;
    }
    // If expired, delete it (lazy cleanup)
    if (cached) {
      await cacheStorage.delete(path);
    }
    return null;
  }, []);

  const setCachedVariationContent = useCallback(async (path: string, content: string) => {
    await cacheStorage.set(path, content, Date.now());
  }, []);

  const invalidateVariationContent = useCallback(async (path?: string) => {
    if (path) {
      await cacheStorage.delete(path);
    } else {
      await cacheStorage.clear();
    }
  }, []);

  // Cache invalidation
  const invalidateCatalogs = useCallback(async (workspaceId: string) => {
    try {
      const key = `catalogs-${workspaceId}`;
      await cacheStorage.delete(key);
    } catch (error) {
      console.error('Failed to invalidate catalogs cache:', error);
    }
  }, []);

  const invalidateFolders = useCallback((workspaceId: string) => {
    setFoldersCache(prev => {
      const next = new Map(prev);
      next.delete(workspaceId);
      return next;
    });
  }, []);

  // Collections cache (SQLite-backed library collections) - stored in IndexedDB
  const getCachedCollections = useCallback(async (workspaceId: string): Promise<LibraryCollection[] | null> => {
    try {
      const key = `collections-${workspaceId}`;
      const cached = await cacheStorage.getJson<LibraryCollection[]>(key);
      if (cached) {
        return cached.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached collections:', error);
      return null;
    }
  }, []);

  const setCachedCollections = useCallback(async (workspaceId: string, collections: LibraryCollection[]) => {
    try {
      const key = `collections-${workspaceId}`;
      await cacheStorage.setJson(key, collections, Date.now());
    } catch (error) {
      console.error('Failed to cache collections:', error);
    }
  }, []);

  const invalidateCollections = useCallback(async (workspaceId: string) => {
    try {
      const key = `collections-${workspaceId}`;
      await cacheStorage.delete(key);
    } catch (error) {
      console.error('Failed to invalidate collections cache:', error);
    }
  }, []);

  // Workspaces cache (global list) - stored in IndexedDB
  const getCachedWorkspaces = useCallback(async (): Promise<LibraryWorkspace[] | null> => {
    try {
      const key = 'workspaces';
      const cached = await cacheStorage.getJson<LibraryWorkspace[]>(key);
      if (cached) {
        return cached.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached workspaces:', error);
      return null;
    }
  }, []);

  const setCachedWorkspaces = useCallback(async (workspaces: LibraryWorkspace[]) => {
    try {
      const key = 'workspaces';
      await cacheStorage.setJson(key, workspaces, Date.now());
    } catch (error) {
      console.error('Failed to cache workspaces:', error);
    }
  }, []);

  const invalidateWorkspaces = useCallback(async () => {
    try {
      const key = 'workspaces';
      await cacheStorage.delete(key);
    } catch (error) {
      console.error('Failed to invalidate workspaces cache:', error);
    }
  }, []);

  const clearAllCache = useCallback(async () => {
    setFoldersCache(new Map());
    // Clear all IndexedDB cache (including catalogs, collections, workspaces, and variation content)
    await cacheStorage.clear();
  }, []);

  return (
    <LibraryCacheContext.Provider
      value={{
        getCachedCatalogs,
        setCachedCatalogs,
        getCachedFolders,
        setCachedFolders,
        getCachedCollections,
        setCachedCollections,
        getCachedWorkspaces,
        setCachedWorkspaces,
        invalidateWorkspaces,
        getCachedVariationContent,
        setCachedVariationContent,
        invalidateVariationContent,
        invalidateCatalogs,
        invalidateFolders,
        invalidateCollections,
        clearAllCache,
      }}
    >
      {children}
    </LibraryCacheContext.Provider>
  );
}

export function useLibraryCache() {
  const context = useContext(LibraryCacheContext);
  if (context === undefined) {
    throw new Error('useLibraryCache must be used within a LibraryCacheProvider');
  }
  return context;
}

