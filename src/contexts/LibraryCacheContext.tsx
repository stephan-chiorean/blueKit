import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CatalogWithVariations } from '../types/github';
import { LibraryCollection } from '../ipc/library';
import { cacheStorage } from '../utils/cacheStorage';

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
  getCachedCatalogs: (workspaceId: string) => CatalogWithVariations[] | null;
  setCachedCatalogs: (workspaceId: string, catalogs: CatalogWithVariations[]) => void;

  // Folders cache (for GitHub folder names in library workspaces) - DEPRECATED
  getCachedFolders: (workspaceId: string) => string[] | null;
  setCachedFolders: (workspaceId: string, folders: string[]) => void;

  // Collections cache (for SQLite-backed library collections)
  getCachedCollections: (workspaceId: string) => LibraryCollection[] | null;
  setCachedCollections: (workspaceId: string, collections: LibraryCollection[]) => void;

  // Content cache (persistent via IndexedDB)
  getCachedVariationContent: (path: string) => Promise<string | null>;
  setCachedVariationContent: (path: string, content: string) => Promise<void>;
  invalidateVariationContent: (path?: string) => Promise<void>;

  // Cache invalidation
  invalidateCatalogs: (workspaceId: string) => void;
  invalidateFolders: (workspaceId: string) => void;
  invalidateCollections: (workspaceId: string) => void;
  clearAllCache: () => void;
}

const LibraryCacheContext = createContext<LibraryCacheContextType | undefined>(undefined);

export function LibraryCacheProvider({ children }: { children: ReactNode }) {
  // Separate caches for different data types
  const [catalogsCache, setCatalogsCache] = useState<Map<string, CachedCatalogs>>(new Map());
  const [foldersCache, setFoldersCache] = useState<Map<string, CachedFolders>>(new Map());
  const [collectionsCache, setCollectionsCache] = useState<Map<string, CachedCollections>>(new Map());

  // Cache TTL: 5 minutes for lists, 24 hours for content
  const LIST_CACHE_TTL = 5 * 60 * 1000;
  const CONTENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Catalogs cache (library workspace catalogs)
  const getCachedCatalogs = useCallback((workspaceId: string): CatalogWithVariations[] | null => {
    const cached = catalogsCache.get(workspaceId);

    if (cached && Date.now() - cached.timestamp < LIST_CACHE_TTL) {
      return cached.catalogs;
    }

    return null;
  }, [catalogsCache]);

  const setCachedCatalogs = useCallback((workspaceId: string, catalogs: CatalogWithVariations[]) => {
    setCatalogsCache(prev => {
      const next = new Map(prev);
      next.set(workspaceId, {
        catalogs,
        timestamp: Date.now(),
      });
      return next;
    });
  }, []);

  // Folders cache (GitHub folder names)
  const getCachedFolders = useCallback((workspaceId: string): string[] | null => {
    const cached = foldersCache.get(workspaceId);

    if (cached && Date.now() - cached.timestamp < LIST_CACHE_TTL) {
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
  const invalidateCatalogs = useCallback((workspaceId: string) => {
    setCatalogsCache(prev => {
      const next = new Map(prev);
      next.delete(workspaceId);
      return next;
    });
  }, []);

  const invalidateFolders = useCallback((workspaceId: string) => {
    setFoldersCache(prev => {
      const next = new Map(prev);
      next.delete(workspaceId);
      return next;
    });
  }, []);

  // Collections cache (SQLite-backed library collections)
  const getCachedCollections = useCallback((workspaceId: string): LibraryCollection[] | null => {
    const cached = collectionsCache.get(workspaceId);

    if (cached && Date.now() - cached.timestamp < LIST_CACHE_TTL) {
      return cached.collections;
    }

    return null;
  }, [collectionsCache]);

  const setCachedCollections = useCallback((workspaceId: string, collections: LibraryCollection[]) => {
    setCollectionsCache(prev => {
      const next = new Map(prev);
      next.set(workspaceId, {
        collections,
        timestamp: Date.now(),
      });
      return next;
    });
  }, []);

  const invalidateCollections = useCallback((workspaceId: string) => {
    setCollectionsCache(prev => {
      const next = new Map(prev);
      next.delete(workspaceId);
      return next;
    });
  }, []);

  const clearAllCache = useCallback(async () => {
    setCatalogsCache(new Map());
    setFoldersCache(new Map());
    setCollectionsCache(new Map());
    // Also clear persistent cache
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

