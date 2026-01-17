---
id: local-project-scanner
alias: Local Project Scanner
type: kit
is_base: false
version: 1
tags:
  - filesystem
  - discovery
  - caching
description: A filesystem scanner that discovers directories containing a specific marker subdirectory across the local machine, with intelligent caching, configurable search paths, exclusion patterns, and project management capabilities
---
# Local Project Scanner Kit

## End State

After applying this kit, the application will have:

**Core scanning functionality:**
- Recursive directory scanner that finds all directories containing a configurable marker subdirectory (e.g., `.claude`, `.vscode`, `.idea`)
- Configurable search paths with sensible defaults (home directory, common dev directories)
- Depth-limited traversal to prevent infinite recursion and improve performance
- Exclusion pattern support to skip irrelevant directories (node_modules, .git, etc.)
- Symlink loop detection to avoid circular references

**Caching system:**
- Persistent cache of scan results stored in JSON format
- Configurable cache validity period (default: 60 minutes)
- Automatic cache invalidation when expired
- Cache validation that verifies cached directories still exist
- Cache metadata tracking: scan timestamp, search parameters, version

**Project management interfaces:**
- `findProjects(options)`: Core scanning function returning array of project paths
- `getProjectsWithCache(options)`: Cached scanning with automatic refresh logic
- `clearCache()`: Manual cache invalidation
- `getCacheInfo()`: Cache status and metadata inspection

**Configuration options:**
- `markerDir`: Name of marker subdirectory to search for (default: `.claude`)
- `searchPaths`: Array of base paths to search (defaults to common dev directories)
- `maxDepth`: Maximum recursion depth (default: 4)
- `exclude`: Array of directory patterns to skip
- `cacheMaxAge`: Cache validity in minutes (default: 60)
- `useCache`: Enable/disable caching (default: true)
- `forceRefresh`: Bypass cache and force fresh scan

**Performance characteristics:**
- Cached scans return results in < 100ms
- Fresh scans complete in 1-30 seconds depending on directory tree size
- Automatic cache validation removes stale entries
- Graceful handling of permission errors (silently skip inaccessible directories)

**Error handling:**
- Silent skip of directories with permission denied errors
- Validation of cached directories before returning results
- Graceful degradation when cache file is corrupted or missing

## Implementation Principles

- **Depth limiting is essential**: Always enforce maximum recursion depth to prevent infinite loops and improve performance
- **Symlink detection**: Track visited paths to avoid following symlink loops
- **Cache validation**: Always verify cached directories still exist before returning cached results
- **Exclusion patterns**: Support both exact matches and prefix patterns (e.g., `.` for hidden directories)
- **Graceful error handling**: Permission errors should not crash the scanner; silently skip inaccessible directories
- **Cache structure**: Store metadata (timestamp, search params, version) alongside results for validation
- **Path normalization**: Use absolute paths consistently to avoid duplicate entries
- **Async-first**: All filesystem operations should be asynchronous to avoid blocking
- **Configurable defaults**: Provide sensible defaults but allow full customization
- **Stateless core**: Core scanning function should be pure (no side effects); caching is a separate concern

## Verification Criteria

After generation, verify:
- ✓ Scanner finds all directories containing the marker subdirectory within specified search paths
- ✓ Cached results return instantly (< 100ms) when cache is valid
- ✓ Fresh scan updates cache with new results
- ✓ Expired cache triggers automatic refresh
- ✓ Exclusion patterns correctly skip specified directories
- ✓ Maximum depth limit prevents infinite recursion
- ✓ Symlink loops are detected and avoided
- ✓ Permission errors don't crash the scanner
- ✓ Cache validation removes stale directory entries
- ✓ Configurable marker directory works with different names (not hardcoded)
- ✓ Multiple search paths are all traversed correctly
- ✓ Results are deduplicated and sorted consistently

## Interface Contracts

**Provides:**
- `findProjects(options: ScanOptions): Promise<string[]>` - Core scanning function
- `getProjectsWithCache(options: CacheOptions): Promise<{dirs: string[], fromCache: boolean, scannedAt: string, cacheAge?: number}>` - Cached scanning
- `clearCache(): Promise<void>` - Clear scan cache
- `getCacheInfo(): Promise<CacheInfo>` - Get cache metadata
- `loadCache(): Promise<CacheData | null>` - Load cache from disk
- `saveCache(data: CacheData): Promise<void>` - Save cache to disk
- `isCacheValid(cache: CacheData, maxAgeMinutes: number): boolean` - Validate cache age

**Type definitions:**
```typescript
interface ScanOptions {
  markerDir?: string;           // Marker subdirectory name (default: '.claude')
  searchPaths?: string[];        // Base paths to search
  maxDepth?: number;             // Maximum recursion depth (default: 4)
  exclude?: string[];            // Patterns to exclude
}

interface CacheOptions extends ScanOptions {
  useCache?: boolean;            // Enable caching (default: true)
  forceRefresh?: boolean;        // Force fresh scan (default: false)
  cacheMaxAge?: number;          // Cache validity in minutes (default: 60)
}

interface CacheData {
  version: string;               // Cache format version
  scannedAt: string;             // ISO timestamp
  dirs: string[];                // Array of project paths
  searchPaths: string[];         // Search paths used
  maxDepth: number;              // Max depth used
  exclude: string[];             // Exclude patterns used
}

interface CacheInfo {
  exists: boolean;
  dirs?: number;
  scannedAt?: string;
  ageMinutes?: number;
  isValid?: boolean;
}
```

**Requires:**
- Filesystem access: Read permissions for search paths
- Cache directory: Writable directory for cache file (typically `~/.app-name/`)
- Node.js/JavaScript runtime: For async filesystem operations
- Path utilities: For path joining and normalization

**Compatible With:**
- Project Management UI: Consumes scan results for interactive project selection
- Settings Sync: Uses discovered projects to manage configurations across projects
- Batch Operations: Enables running commands across multiple discovered projects
- IDE Integration: Provides project discovery for IDE extensions
- CLI Tools: Powers command-line interfaces for project navigation

## Usage Examples

**Basic scanning:**
```javascript
// Find all projects with .claude subdirectory
const projects = await findProjects({
  markerDir: '.claude',
  searchPaths: ['~/Projects', '~/Documents'],
  maxDepth: 4
});
```

**Cached scanning:**
```javascript
// Use cache if available, otherwise scan fresh
const { dirs, fromCache, cacheAge } = await getProjectsWithCache({
  markerDir: '.claude',
  useCache: true,
  forceRefresh: false
});
```

**Custom marker directory:**
```javascript
// Find all projects with .vscode subdirectory
const projects = await findProjects({
  markerDir: '.vscode',
  searchPaths: ['~/code'],
  exclude: ['node_modules', '.git']
});
```

**Cache management:**
```javascript
// Check cache status
const info = await getCacheInfo();
if (!info.isValid) {
  // Force refresh
  await getProjectsWithCache({ forceRefresh: true });
}

// Clear cache
await clearCache();
```

## Implementation Notes

**Cache location:**
- Store cache in application-specific directory (e.g., `~/.app-name/scan-cache.json`)
- Ensure directory exists before writing cache file
- Use JSON format for human-readable debugging

**Search algorithm:**
- Iterate through each search path
- For each path, recursively traverse directories up to maxDepth
- Check if any subdirectory matches the marker directory name
- Skip excluded patterns early in traversal
- Track visited paths to prevent symlink loops
- Return parent directory (not marker directory itself) when found

**Performance optimizations:**
- Early exit when maxDepth reached
- Skip excluded directories before deeper traversal
- Validate cached directories exist before returning (removes stale entries)
- Use Set for visited path tracking (O(1) lookup)
- Sort and deduplicate results once at the end

**Error handling:**
- Wrap filesystem operations in try-catch
- Return empty array or null on critical errors
- Log warnings for permission errors but continue scanning
- Validate cache JSON before parsing (handle corruption gracefully)

**Default search paths:**
- Home directory (`~`)
- Common development directories: `~/Documents`, `~/Projects`, `~/Developer`, `~/dev`, `~/workspace`, `~/src`, `~/code`
- Platform-specific paths can be detected and added

**Default exclusions:**
- `node_modules`, `.git`, `Library`, `.Trash`, `Applications`
- Any directory starting with `.` (except the marker directory itself)
- Platform-specific system directories
