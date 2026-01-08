---
id: collection-navigation-rendering-delay
alias: Collection Navigation Rendering Delay
type: walkthrough
is_base: false
version: 1
tags:
  - performance
  - react-rendering
  - navigation
description: Understanding why collection navigation causes a half-second rendering delay while tab switching is seamless, and how conditional rendering and state management create this performance issue
complexity: comprehensive
format: architecture
---
# Collection Navigation Rendering Delay

## Overview

When navigating into a collection from the Library tab and clicking back, there's a noticeable ~500ms delay where UI elements "pop in" rather than appearing instantly. In contrast, switching between tabs (Projects, Library, Workflows, Tasks) is completely seamless. This walkthrough explains why this happens and where the rendering complexity originates.

## The Problem

**Seamless**: Tab switching (Projects ↔ Library ↔ Workflows ↔ Tasks)  
**Delayed**: Clicking into a collection → Back to library view

The delay manifests as:
- Collections and catalogs taking ~500ms to appear
- Visual "pop-in" effect rather than smooth transition
- All UI elements re-rendering simultaneously

## Root Cause: Two Different Navigation Patterns

### Tab Navigation (Seamless) - CSS-Based Visibility

Tab switching uses Chakra UI's `Tabs.Root` component, which renders all tab content in the DOM simultaneously but controls visibility via CSS:

```423:568:src/pages/HomePage.tsx
            <Tabs.Root
              defaultValue="projects"
              variant="plain"
              value={activeTab}
              onValueChange={(e) => handleTabChange(e.value as string)}
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              {!isLibraryFullScreen && (
                <Flex
                  align="center"
                  gap={4}
                  mb={6}
                  mt={3}
                  position="relative"
                  w="100%"
                  flexShrink={0}
                >
                  <NavigationMenu onNavigateToPlans={onNavigateToPlans}>
                    {({ onOpen }) => (
                      <IconButton
                        variant="ghost"
                        size="lg"
                        aria-label="Open menu"
                        onClick={onOpen}
                        color="gray.600"
                        _hover={{ bg: "transparent" }}
                      >
                        <LuMenu />
                      </IconButton>
                    )}
                  </NavigationMenu>

                  {/* Portal target for left-side header actions (e.g. workspace selector) */}
                  <Box id="header-left-actions" display={activeTab === 'library' ? 'block' : 'none'} />
                  <Box
                    position="absolute"
                    left="50%"
                    borderRadius="lg"
                    p={2}
                    style={{
                      transform: "translateX(-50%)",
                      background: tabsBg,
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: tabsBorder,
                    }}
                  >
                    <Tabs.List>
                      <Tabs.Trigger value="projects">
                        <HStack gap={2}>
                          <Icon>
                            <LuFolder />
                          </Icon>
                          <Text>Projects</Text>
                        </HStack>
                      </Tabs.Trigger>
                      <Tabs.Trigger value="library">
                        <HStack gap={2}>
                          <Icon>
                            <LuLibrary />
                          </Icon>
                          <Text>Library</Text>
                        </HStack>
                      </Tabs.Trigger>
                      <Tabs.Trigger value="workflows">
                        <HStack gap={2}>
                          <Icon>
                            <LuWorkflow />
                          </Icon>
                          <Text>Workflows</Text>
                        </HStack>
                      </Tabs.Trigger>
                      <Tabs.Trigger value="tasks">
                        <HStack gap={2}>
                          <Icon>
                            <LuListTodo />
                          </Icon>
                          <Text>Tasks</Text>
                        </HStack>
                      </Tabs.Trigger>
                      <Tabs.Indicator
                        rounded="md"
                        style={{
                          background: indicatorBg,
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                        }}
                      />
                    </Tabs.List>
                  </Box>
                  {activeTab === "tasks" && (
                    <Box position="absolute" right={0}>
                      <Button
                        colorPalette="primary"
                        onClick={() => tasksTabRef.current?.openCreateDialog()}
                      >
                        <HStack gap={2}>
                          <Icon>
                            <LuPlus />
                          </Icon>
                          <Text>Add Task</Text>
                        </HStack>
                      </Button>
                    </Box>
                  )}
                  {activeTab === "library" && (
                    <Box position="absolute" right={0}>
                      <Button
                        colorPalette="primary"
                        onClick={() => libraryTabRef.current?.openAddWorkspaceDialog()}
                      >
                        <HStack gap={2}>
                          <Icon>
                            <LuPlus />
                          </Icon>
                          <Text>Add Workspace</Text>
                        </HStack>
                      </Button>
                    </Box>
                  )}
                </Flex>
              )}

              <Tabs.Content value="projects">
                <ProjectsTabContent
                  projects={projects}
                  projectsLoading={projectsLoading}
                  error={projectsError}
                  onProjectSelect={onProjectSelect}
                  onProjectsChanged={loadProjects}
                />
              </Tabs.Content>
              <Tabs.Content value="library" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <LibraryTabContent ref={libraryTabRef} onViewVariation={handleViewLibraryVariation} onViewingCollectionChange={setIsLibraryFullScreen} />
              </Tabs.Content>
              <Tabs.Content value="workflows">
                <WorkflowsTabContent />
              </Tabs.Content>
              <Tabs.Content value="tasks">
                <TasksTabContent
                  ref={tasksTabRef}
                  context="workspace"
                  projects={projects}
                />
              </Tabs.Content>
            </Tabs.Root>
```

**Why it's seamless:**
- All tab content is already in the DOM
- Switching only changes CSS `display` property
- No React re-renders, no component mounting/unmounting
- No state recalculation, no data fetching
- Instant visual transition

### Collection Navigation (Delayed) - Conditional Rendering

Collection navigation uses conditional rendering based on state:

```1486:1504:src/components/library/LibraryTabContent.tsx
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
```

**Why it's delayed:**

1. **Component Unmounting/Mounting**: When clicking back, `CollectionView` unmounts and the entire library view remounts
2. **State Cascade**: Multiple state changes trigger re-renders:
   - `viewingCollection` changes from `string | null` to `null`
   - `isLibraryFullScreen` changes (affects parent `HomePage` padding)
   - All derived state recalculates

3. **Parent Component Re-render**: The `HomePage` component re-renders due to `isLibraryFullScreen` change:

```412:421:src/pages/HomePage.tsx
        <Box
          h="100%"
          p={isLibraryFullScreen ? 0 : 6}
          position="relative"
          overflow="auto"
          style={{ height: '100%', maxHeight: '100%' }}
          css={{
            background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          }}
        >
```

4. **Complex Memoization Recalculation**: When the library view remounts, all expensive `useMemo` hooks recalculate:

```1189:1215:src/components/library/LibraryTabContent.tsx
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
```

5. **Portal Re-rendering**: The workspace selector portal needs to re-render:

```1292:1379:src/components/library/LibraryTabContent.tsx
      {/* Workspace Selector Portal - Rendered in top bar next to menu */}
      {document.getElementById('header-left-actions') && createPortal(
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
        document.getElementById('header-left-actions')!
      )}
```

6. **Large Component Tree**: The library view renders hundreds of catalog cards, collection cards, and complex nested components that all need to mount:

```1668:1690:src/components/library/LibraryTabContent.tsx
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
```

## Navigation Control Flow

### Clicking Into Collection

1. User clicks collection card → `onOpenModal={() => setViewingCollection(collection.id)}`
2. `viewingCollection` state updates from `null` to `collection.id`
3. `useEffect` triggers `onViewingCollectionChange?.(!!viewingCollection)` → sets `isLibraryFullScreen = true` in `HomePage`
4. `HomePage` re-renders, padding changes from `p={6}` to `p={0}`
5. Conditional render switches from library view to `CollectionView`
6. `CollectionView` mounts and renders

### Clicking Back Arrow

1. User clicks back button → `onBack={() => setViewingCollection(null)}`
2. `viewingCollection` state updates from `collection.id` to `null`
3. `useEffect` triggers `onViewingCollectionChange?.(false)` → sets `isLibraryFullScreen = false` in `HomePage`
4. `HomePage` re-renders, padding changes from `p={0}` back to `p={6}`
5. Conditional render switches from `CollectionView` back to library view
6. **Entire library view remounts** - this is where the delay happens:
   - All `useMemo` hooks recalculate (`organizedCatalogs`, `sortedCollections`, `selectedCatalogIds`, etc.)
   - Portal re-renders
   - All collection cards mount
   - All catalog cards mount
   - Filter panel re-renders
   - Selection bar re-renders

## Why This Complicates Rendering

### 1. **State Cascade Effect**

Multiple interdependent state changes happen in sequence:

```
viewingCollection: null → triggers
  ↓
onViewingCollectionChange(false) → triggers
  ↓
isLibraryFullScreen: true → false → triggers
  ↓
HomePage re-render (padding change) → triggers
  ↓
LibraryTabContent remount → triggers
  ↓
All useMemo recalculations → triggers
  ↓
All child components remount
```

### 2. **Loss of Component State**

When `CollectionView` unmounts and library view remounts, React loses:
- Component instance state
- Ref values
- Internal component lifecycle state
- Any cached render results

### 3. **Expensive Recalculations**

Every time the library view remounts, these expensive operations run:

- **Catalog organization**: Iterating through all catalogs and collections to build `organizedCatalogs`
- **Tag extraction**: Parsing JSON tags from all catalogs
- **Selection state derivation**: Converting `selectedVariations` Map to arrays and catalog maps
- **Filter matching**: Running `matchesFilter` on all ungrouped catalogs

### 4. **Parent-Child Coupling**

The `isLibraryFullScreen` state creates tight coupling between `LibraryTabContent` and `HomePage`:

```138:140:src/components/library/LibraryTabContent.tsx
  useEffect(() => {
    onViewingCollectionChange?.(!!viewingCollection);
  }, [viewingCollection, onViewingCollectionChange]);
```

This causes `HomePage` to re-render on every collection navigation, even though it doesn't need to know about collection state.

## Suggested Fixes

### Option 1: CSS-Based Visibility (Recommended)

Render both views simultaneously and control visibility with CSS, similar to how tabs work:

```tsx
// In LibraryTabContent.tsx
<Box position="relative">
  {/* Collection View - always rendered */}
  <Box
    display={viewingCollection ? 'block' : 'none'}
    position="absolute"
    inset={0}
    zIndex={viewingCollection ? 10 : 0}
  >
    <CollectionView {...collectionProps} />
  </Box>

  {/* Library View - always rendered */}
  <Box
    display={viewingCollection ? 'none' : 'block'}
    position="relative"
    zIndex={viewingCollection ? 0 : 10}
  >
    {/* Existing library view JSX */}
  </Box>
</Box>
```

**Benefits:**
- No component unmounting/mounting
- State preserved in both views
- No parent re-renders needed
- Instant visual transition

**Trade-offs:**
- Both views consume memory (usually acceptable)
- Slightly more complex layout management

### Option 2: Remove Parent State Dependency

Remove `isLibraryFullScreen` from `HomePage` and handle padding internally in `LibraryTabContent`:

```tsx
// In LibraryTabContent.tsx
<Box
  p={viewingCollection ? 0 : 6}
  // ... rest of styles
>
  {/* content */}
</Box>
```

**Benefits:**
- Eliminates parent re-render
- Simpler state management
- Collection navigation doesn't affect parent

**Trade-offs:**
- Padding logic moves to child component
- Less control from parent

### Option 3: React.memo and useMemo Optimization

Heavily optimize the library view to minimize re-render cost:

```tsx
// Memoize expensive components
const LibraryView = React.memo(({ catalogs, collections, ... }) => {
  // ... library view JSX
});

// Use React.memo for catalog cards
const CatalogCard = React.memo(({ catalog, ... }) => {
  // ... catalog card JSX
});
```

**Benefits:**
- No architectural changes
- Reduces re-render cost

**Trade-offs:**
- Still has unmount/mount overhead
- Complex memoization dependencies
- Doesn't solve root cause

### Option 4: Virtual Scrolling

Use virtual scrolling for large lists to reduce initial render cost:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: catalogs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 200,
});
```

**Benefits:**
- Only renders visible items
- Faster initial mount
- Better performance with many catalogs

**Trade-offs:**
- Additional dependency
- More complex implementation
- Doesn't solve unmount/mount issue

### Recommended Approach: Hybrid

Combine Option 1 (CSS visibility) with Option 2 (remove parent dependency):

1. **Render both views simultaneously** with CSS visibility
2. **Remove `isLibraryFullScreen`** from `HomePage`
3. **Handle padding internally** in `LibraryTabContent`

This gives you:
- ✅ Instant navigation (no unmount/mount)
- ✅ State preservation
- ✅ No parent re-renders
- ✅ Simpler architecture
- ✅ Minimal memory overhead

## Implementation Example

```tsx
// LibraryTabContent.tsx - simplified structure
const LibraryTabContent = forwardRef<LibraryTabContentRef, LibraryTabContentProps>(
  function LibraryTabContent({ onViewVariation }, ref) {
    const [viewingCollection, setViewingCollection] = useState<string | null>(null);
    
    // Remove onViewingCollectionChange - no longer needed
    
    return (
      <Box width="100%" position="relative" minH="100%">
        {/* Collection View - always in DOM */}
        <Box
          position="absolute"
          inset={0}
          display={viewingCollection ? 'block' : 'none'}
          zIndex={viewingCollection ? 10 : 0}
          bg="bg.panel"
        >
          {viewingCollection && (
            <CollectionView
              collection={sortedCollections.find(c => c.id === viewingCollection)!}
              // ... props
              onBack={() => setViewingCollection(null)}
            />
          )}
        </Box>

        {/* Library View - always in DOM */}
        <Box
          position="relative"
          display={viewingCollection ? 'none' : 'block'}
          zIndex={viewingCollection ? 0 : 10}
          p={6}
        >
          {/* Existing library view content */}
        </Box>
      </Box>
    );
  }
);
```

## Summary

The rendering delay occurs because:

1. **Conditional rendering** causes full component unmount/mount cycles
2. **Parent state dependency** (`isLibraryFullScreen`) triggers unnecessary parent re-renders
3. **Expensive recalculations** run on every remount (memoization, catalog organization, etc.)
4. **Large component tree** needs to mount hundreds of catalog/collection cards

The solution is to **render both views simultaneously** using CSS visibility (like tabs do) and **remove the parent state dependency**. This eliminates unmount/mount overhead and provides instant navigation.
