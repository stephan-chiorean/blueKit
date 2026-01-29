---
id: cross-project-tab-switching-architecture
alias: Cross-Project Tab Switching Architecture
type: walkthrough
is_base: false
version: 1
tags:
  - tabs
  - caching
  - performance
description: Architecture for smooth cross-project tab switching with project registry caching and optimistic artifact loading
complexity: comprehensive
format: architecture
---
# Cross-Project Tab Switching Architecture

## Overview

BlueKit's tab system allows users to navigate between multiple projects seamlessly. This walkthrough explains the architecture that enables smooth tab switching, especially when moving between different projects, through intelligent caching and optimistic loading strategies.

## The Problem

Prior to optimization, switching tabs between different projects caused jarring visual reloads:

1. **Full screen "Loading project..." flash** - Every tab switch fetched the entire project registry
2. **Artifact reload flicker** - ProjectView showed loading states even when just switching tabs
3. **Wrong data display** - Briefly showed Project A's data when switching to Project B
4. **Multiple unnecessary API calls** - No caching meant redundant backend invocations

## Architecture Components

### 1. TabContent.tsx - Project Registry Caching

**Location**: `src/app/TabContent.tsx`

**Purpose**: Manages which project corresponds to the active tab and caches the project registry.

#### Key State

```typescript
const [projectsCache, setProjectsCache] = useState<Project[]>([]);
const [activeProject, setActiveProject] = useState<Project | null>(null);
const [projectLoading, setProjectLoading] = useState(false);
```

#### Caching Strategy

The component implements a cache-first strategy:

```typescript
// 1. Check cache first
const cachedProject = projectsCache.find(p => p.id === activeTab.resource.projectId);
if (cachedProject) {
  // Instant - no loading state
  setActiveProject(cachedProject);
  return;
}

// 2. Cache miss - fetch all projects
const projects = await invokeGetProjectRegistry();
setProjectsCache(projects);
```

**Behavior**:
- **First load**: Fetches project registry, shows "Loading project...", caches results
- **Subsequent tab switches**: Instant lookup from cache, no loading state
- **Cache invalidation**: Currently session-based (cleared on app restart)

**Performance Impact**:
- Eliminates repeated backend calls for project metadata
- Instant tab switches when project is cached
- Reduces visual jank significantly

### 2. ProjectView.tsx - Optimistic Artifact Loading

**Location**: `src/views/project/ProjectView.tsx`

**Purpose**: Renders the project interface and manages artifact loading for the current project.

#### Artifact State Management

```typescript
const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
const [artifactsLoading, setArtifactsLoading] = useState(true);
```

#### Loading Strategy

The component uses different strategies based on context:

**Initial Load** (artifacts.length === 0):
```typescript
if (artifacts.length === 0) {
  setArtifactsLoading(true); // Show loading UI
}
const projectArtifacts = await invokeGetProjectArtifacts(project.path);
setArtifacts(projectArtifacts);
setArtifactsLoading(false);
```

**Project Switch** (artifacts.length > 0):
```typescript
// Clear old artifacts immediately
setArtifacts([]);

// Load new artifacts (but don't show full loading state)
const projectArtifacts = await invokeGetProjectArtifacts(project.path);
setArtifacts(projectArtifacts);
```

#### Why Clear Artifacts?

Clearing artifacts prevents showing Project A's kits when viewing Project B:

```typescript
useEffect(() => {
  // Clear old artifacts immediately when project changes
  setArtifacts([]);
  setError(null);
  
  loadProjectArtifacts();
}, [project.path]);
```

This creates a brief empty state, but sections are optimized to handle this gracefully.

### 3. Section Components - Graceful Empty States

**Locations**: 
- `src/views/project/sections/KitsSection.tsx`
- `src/views/project/sections/WalkthroughsSection.tsx`
- Similar pattern in other sections

#### Loading State Optimization

Sections only show empty states when:
1. Data is empty AND
2. NOT currently loading

```typescript
{rootKits.length === 0 && !kitsLoading && (nameFilter || selectedTags.length > 0) ? (
  <Box>
    <Text>No kits match the current filters</Text>
  </Box>
) : rootKits.length > 0 ? (
  <ElegantList items={rootKits} ... />
) : null}
```

**Key behaviors**:
- While loading with no data: Render `null` (no flicker)
- After loading with no data: Show empty state (only if filters active)
- While loading with data: Keep showing old data
- After loading: Show new data

## Data Flow

### Same-Project Tab Switch

```
User clicks tab for different section in same project
  ↓
TabContext updates activeTabId
  ↓
TabContent checks activeTab.resource.projectId
  ↓
projectId unchanged → no project fetch needed
  ↓
activeProject already set → no re-render
  ↓
ProjectView sees same project.path → no artifact reload
  ↓
Only active section content changes
  ✓ INSTANT SWITCH
```

### Cross-Project Tab Switch (First Time)

```
User clicks tab for Project B (first time)
  ↓
TabContent checks activeTab.resource.projectId (changed)
  ↓
Check projectsCache for Project B → MISS
  ↓
Fetch invokeGetProjectRegistry() → shows "Loading project..."
  ↓
Cache results in projectsCache
  ↓
Set activeProject to Project B
  ↓
ProjectView useEffect triggers (project.path changed)
  ↓
Clear artifacts (setArtifacts([]))
  ↓
Load artifacts for Project B
  ↓
Sections render with new data
  ✓ ONE-TIME LOAD
```

### Cross-Project Tab Switch (Cached)

```
User clicks tab for Project A (previously viewed)
  ↓
TabContent checks activeTab.resource.projectId (changed)
  ↓
Check projectsCache for Project A → HIT
  ↓
Instantly set activeProject to Project A (no loading state)
  ↓
ProjectView useEffect triggers (project.path changed)
  ↓
Clear artifacts (setArtifacts([]))
  ↓
Load artifacts for Project A (background, no spinner)
  ↓
Sections briefly render empty → then populate with data
  ✓ FAST SWITCH (~100-200ms)
```

## Performance Characteristics

### Before Optimization
- **Same project**: ~50ms (already fast)
- **Different project**: 500-1000ms with visible loading screens
- **API calls per switch**: 1-2 (project registry + artifacts)
- **Visual feedback**: Multiple loading states, flickers

### After Optimization
- **Same project**: ~50ms (unchanged)
- **Different project (first)**: 300-500ms with one loading screen
- **Different project (cached)**: ~100-200ms, no loading screens
- **API calls per switch**: 0-1 (only artifacts if needed)
- **Visual feedback**: Minimal, smooth transitions

## Design Decisions

### 1. Session-Based Cache
**Decision**: Cache cleared on app restart, not persisted to disk

**Rationale**: 
- Projects can change outside the app (git operations, file system changes)
- Fresh data on app start ensures consistency
- In-memory cache is simpler and faster than disk persistence
- Most sessions involve working with 2-3 projects repeatedly

### 2. Clear Artifacts on Project Switch
**Decision**: Immediately clear old artifacts when switching projects

**Alternative considered**: Keep showing old artifacts until new ones load

**Rationale**:
- Prevents showing wrong project's data (critical correctness issue)
- Empty state is brief and non-jarring (optimized sections)
- Users expect fresh data when switching projects
- Simpler state management (no "stale" data tracking)

### 3. Loading State Only on Empty
**Decision**: Only show `artifactsLoading=true` when `artifacts.length === 0`

**Rationale**:
- First load needs feedback (user knows data is coming)
- Subsequent loads are fast enough to skip spinner
- Reduces visual noise
- Sections handle empty state gracefully

### 4. Cache Entire Project Registry
**Decision**: Cache all projects, not just the current one

**Alternative considered**: Cache only projects we've visited

**Rationale**:
- Project registry is small (<100 projects typical)
- Single API call fetches everything
- Enables instant switch to any project
- Simpler invalidation strategy

## File Watcher Integration

ProjectView sets up file watchers per project:

```typescript
useEffect(() => {
  // Load initial artifacts
  loadProjectArtifacts();
  
  // Set up watcher for this project
  await invokeWatchProjectArtifacts(project.path);
  
  // Listen for changes
  unlisten = await listen(eventName, (event) => {
    updateArtifactsIncremental(event.payload);
  });
  
  return () => {
    // Cleanup watcher when switching projects
    invokeStopWatcher(eventName);
  };
}, [project.path]);
```

**Incremental updates** use `startTransition` for non-blocking UI:

```typescript
const updateArtifactsIncremental = async (changedPaths: string[]) => {
  const changedArtifacts = await invokeGetChangedArtifacts(project.path, changedPaths);
  
  startTransition(() => {
    setArtifacts(prev => {
      // Merge changed artifacts into existing state
      // No loading state - happens silently
    });
  });
};
```

## Edge Cases Handled

### 1. Rapid Tab Switching
**Scenario**: User rapidly clicks between tabs

**Handling**: 
- useEffect cleanup cancels in-flight requests (`isActive` flag)
- 100ms debounce in `loadProjectArtifacts` prevents duplicate calls
- Only final tab selection processes fully

### 2. Project Not Found in Cache
**Scenario**: Tab references project that no longer exists

**Handling**:
```typescript
const project = projects.find(p => p.id === activeTab.resource.projectId) || null;
setProjectError(project ? null : 'Project not found.');
```
Shows error state with "Go to Home" button.

### 3. Empty Project (No Artifacts)
**Scenario**: Project has no .bluekit directory or no files

**Handling**:
- Sections render empty state (no error)
- File watcher still active (will detect new files)
- User can create new artifacts normally

### 4. Concurrent Project Updates
**Scenario**: Multiple tabs for same project, file watcher fires

**Handling**:
- All ProjectView instances for same project path listen to same event
- `updateArtifactsIncremental` merges changes atomically
- UI updates in parallel across all tabs for that project

## Testing Considerations

To verify tab switching performance:

1. **Open multiple projects in tabs**
2. **Switch between tabs rapidly** - should be instant with no flickers
3. **Check browser DevTools Network tab** - should see minimal API calls
4. **Monitor component re-renders** - React DevTools Profiler should show minimal work
5. **Test with large artifact sets** (100+ kits) - should still be fast

## Future Optimizations

Potential improvements not yet implemented:

1. **Persistent cache**: Save project registry to localStorage/IndexedDB
2. **Artifact caching**: Cache artifacts per project across tab switches
3. **Prefetching**: Load likely-next projects in background
4. **LRU eviction**: If memory grows, evict least-recently-used projects
5. **Invalidation hooks**: File watcher events trigger cache updates
6. **Optimistic artifact display**: Keep artifacts in cache even after project switch

## Related Files

- `src/app/TabContext.tsx` - Tab state management
- `src/app/TabManager.tsx` - Tab persistence
- `src/ipc.ts` - Backend communication layer
- `src/shared/components/ElegantList.tsx` - List rendering component
- `src/views/project/ProjectSidebar.tsx` - Section navigation

## Summary

The cross-project tab switching architecture achieves smooth performance through:

1. **Project registry caching** - Eliminates repeated backend calls
2. **Optimistic artifact loading** - Minimizes loading states
3. **Graceful empty states** - Sections handle transitions smoothly
4. **Atomic state updates** - Prevents showing stale data
5. **Incremental updates** - File changes don't block UI

Result: Sub-200ms tab switches with minimal visual feedback, even across different projects.
