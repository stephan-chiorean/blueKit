import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CatalogWithVariations } from '../types/github';

interface CachedCatalogs {
  catalogs: CatalogWithVariations[];
  timestamp: number;
}

interface CachedFolders {
  folders: string[];
  timestamp: number;
}

interface LibraryCacheContextType {
  // Catalogs cache (for library workspace catalogs)
  getCachedCatalogs: (workspaceId: string) => CatalogWithVariations[] | null;
  setCachedCatalogs: (workspaceId: string, catalogs: CatalogWithVariations[]) => void;
  
  // Folders cache (for GitHub folder names in library workspaces)
  getCachedFolders: (workspaceId: string) => string[] | null;
  setCachedFolders: (workspaceId: string, folders: string[]) => void;
  
  // Cache invalidation
  invalidateCatalogs: (workspaceId: string) => void;
  invalidateFolders: (workspaceId: string) => void;
  clearAllCache: () => void;
}

const LibraryCacheContext = createContext<LibraryCacheContextType | undefined>(undefined);

export function LibraryCacheProvider({ children }: { children: ReactNode }) {
  // Separate caches for different data types
  const [catalogsCache, setCatalogsCache] = useState<Map<string, CachedCatalogs>>(new Map());
  const [foldersCache, setFoldersCache] = useState<Map<string, CachedFolders>>(new Map());
  
  // Cache TTL: 5 minutes
  const CACHE_TTL = 5 * 60 * 1000;

  // Catalogs cache (library workspace catalogs)
  const getCachedCatalogs = useCallback((workspaceId: string): CatalogWithVariations[] | null => {
    const cached = catalogsCache.get(workspaceId);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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

  const clearAllCache = useCallback(() => {
    setCatalogsCache(new Map());
    setFoldersCache(new Map());
  }, []);

  return (
    <LibraryCacheContext.Provider
      value={{
        getCachedCatalogs,
        setCachedCatalogs,
        getCachedFolders,
        setCachedFolders,
        invalidateCatalogs,
        invalidateFolders,
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

