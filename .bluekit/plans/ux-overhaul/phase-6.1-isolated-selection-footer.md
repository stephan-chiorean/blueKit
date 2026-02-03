# Phase 6.1: Isolated Selection State with Inline Footer

## Overview

Replace the global `SelectionContext` usage in PlansSection, KitsSection, and WalkthroughsSection with isolated local state. Replace the floating `ResourceSelectionBar` overlay with an inline footer component that pushes content up rather than overlapping.

Additionally, remove document transition animations from PlanWorkspace when navigating between plan documents (make switching instant).

## Current State

### Problems
1. **Global Selection Context**: PlansSection, KitsSection, and WalkthroughsSection all use the global `SelectionContext`, creating cross-tab state pollution
2. **Floating Overlay**: `ResourceSelectionBar` is a Portal-based floating component that overlays content at the bottom of the screen
3. **Context Leakage**: Selections made in one tab persist when switching to another tab, causing confusion

### Current Implementation
- All three sections import and use `useSelection()` hook
- Selections are stored globally in `SelectionContext`
- `ResourceSelectionBar` renders as a Portal at `zIndex: 1400` with fixed positioning
- Action bar appears over content, potentially obscuring cards at the bottom

## Goals

1. **Isolated State**: Each section manages its own selection state independently
2. **Inline Footer**: Replace floating overlay with an inline footer that's part of the document flow
3. **Content Flow**: Footer should push content up, not overlap it
4. **Consistent UX**: Maintain familiar selection and action UI patterns
5. **Clean Architecture**: Remove dependencies on global SelectionContext for these sections

## Implementation Plan

### 1. Design Pattern for Inline Selection Footers

Each section will implement its own inline footer with these shared principles:

**Key Differences from ResourceSelectionBar**:
- No Portal usage (renders inline within the section)
- No fixed positioning
- No backdrop blur
- Part of document flow (pushes content up)
- Animated height transition (0 → auto)
- Sticky positioning (sticks to bottom of viewport but within document flow)

**Layout Structure**:
```
┌─────────────────────────────────────┐
│  Main Content (cards/table/etc)     │
│                                     │
│                                     │  ← Content is pushed up when footer appears
├─────────────────────────────────────┤
│  Selection Footer (inline)          │  ← Sticky footer (position: sticky, bottom: 0)
│  [Selection summary] [Actions]      │
└─────────────────────────────────────┘
```

**Common Styling Principles**:
- `position: sticky`
- `bottom: 0`
- `width: 100%`
- `background`: Glass morphism (matching ResourceSelectionBar style)
- `borderTopWidth: 1px`
- `zIndex: 100` (lower than floating components)
- Smooth height animation with Chakra's `Collapse` component

**Why Separate Implementations?**
- Each section has different actions (Plans don't have folders, etc.)
- Different selection item types and metadata
- Flexibility to customize UI per section
- No forced abstraction for simple, section-specific logic

### 2. Add Local Selection State to Each Section

#### PlansSection.tsx (src/views/project/sections/PlansSection.tsx)

**Changes**:
1. Remove `useSelection()` import and usage
2. Add local state:
   ```typescript
   const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());

   const isSelected = (planId: string) => selectedPlanIds.has(planId);

   const togglePlan = (plan: Plan) => {
     setSelectedPlanIds(prev => {
       const next = new Set(prev);
       if (next.has(plan.id)) {
         next.delete(plan.id);
       } else {
         next.add(plan.id);
       }
       return next;
     });
   };

   const clearSelection = () => setSelectedPlanIds(new Set());

   const selectedPlans = plans.filter(p => selectedPlanIds.has(p.id));
   ```

3. Implement inline selection footer directly in component:
   ```tsx
   <Collapse in={selectedPlanIds.size > 0} animateOpacity>
     <Box
       position="sticky"
       bottom={0}
       width="100%"
       borderTopWidth="1px"
       py={4}
       px={6}
       css={{
         background: 'rgba(255, 255, 255, 0.85)',
         backdropFilter: 'blur(20px) saturate(180%)',
         // ... glass morphism
       }}
     >
       {/* Selection summary and actions */}
       <HStack justify="space-between">
         <Text>{selectedPlanIds.size} plan(s) selected</Text>
         <HStack>
           <Button onClick={handleDelete}>Delete</Button>
           <Button onClick={handleComplete}>Complete</Button>
           <Button onClick={clearSelection}>Clear</Button>
         </HStack>
       </HStack>
     </Box>
   </Collapse>
   ```
4. Update `PlanResourceCard` to use local `togglePlan` handler
5. Clear selections on unmount or when switching tabs

#### KitsSection.tsx (src/views/project/sections/KitsSection.tsx)

**Changes**:
1. Remove `useSelection()` import and usage
2. Add local state:
   ```typescript
   const [selectedKitPaths, setSelectedKitPaths] = useState<Set<string>>(new Set());

   const isSelected = (kitPath: string) => selectedKitPaths.has(kitPath);

   const toggleKit = (kit: ArtifactFile) => {
     setSelectedKitPaths(prev => {
       const next = new Set(prev);
       if (next.has(kit.path)) {
         next.delete(kit.path);
       } else {
         next.add(kit.path);
       }
       return next;
     });
   };

   const clearSelection = () => setSelectedKitPaths(new Set());

   const selectedKits = kits.filter(k => selectedKitPaths.has(k.path));
   ```

3. Add "Select All" functionality in section header:
   ```tsx
   <Flex align="center" gap={2} mb={4}>
     <Heading size="md">Kits</Heading>
     <Text fontSize="sm" color="text.muted">
       {rootKits.length}
     </Text>
     {rootKits.length > 0 && (
       <Button
         size="sm"
         variant="ghost"
         onClick={handleSelectAll}
       >
         {selectedKitPaths.size === rootKits.length ? 'Deselect All' : 'Select All'}
       </Button>
     )}
   </Flex>
   ```

4. Update `ElegantList` items to show checkboxes instead of 3-dot menu:
   - Remove `renderActions` prop for kit items
   - Add checkbox to left side of each item
   - Wire checkbox to local toggle handler
   - Keep `renderActions` for folder items (groups keep 3-dot menu)

5. Implement inline selection footer directly in component:
   ```tsx
   <Collapse in={selectedKitPaths.size > 0} animateOpacity>
     <Box
       position="sticky"
       bottom={0}
       width="100%"
       borderTopWidth="1px"
       py={4}
       px={6}
       css={{/* glass morphism */}}
     >
       <HStack justify="space-between">
         <Text>{selectedKitPaths.size} kit(s) selected</Text>
         <HStack>
           <Button onClick={handleDelete}>Delete</Button>
           <Button onClick={handleAddToProject}>Add to Project</Button>
           <Button onClick={handlePublish}>Publish to Library</Button>
           <Button onClick={clearSelection}>Clear</Button>
         </HStack>
       </HStack>
     </Box>
   </Collapse>
   ```

#### WalkthroughsSection.tsx (src/views/project/sections/WalkthroughsSection.tsx)

**Changes**:
1. Remove `useSelection()` import and usage
2. Add local state (same pattern as KitsSection):
   ```typescript
   const [selectedWalkthroughPaths, setSelectedWalkthroughPaths] = useState<Set<string>>(new Set());
   // ... same pattern as above
   ```

3. Add "Select All" functionality in section header:
   ```tsx
   <Flex align="center" gap={2} mb={4}>
     <Heading size="md">Walkthroughs</Heading>
     <Text fontSize="sm" color="text.muted">
       {rootWalkthroughs.length}
     </Text>
     {rootWalkthroughs.length > 0 && (
       <Button
         size="sm"
         variant="ghost"
         onClick={handleSelectAll}
       >
         {selectedWalkthroughPaths.size === rootWalkthroughs.length ? 'Deselect All' : 'Select All'}
       </Button>
     )}
   </Flex>
   ```

4. Update `ElegantList` items to show checkboxes instead of 3-dot menu:
   - Remove `renderActions` prop for walkthrough items
   - Add checkbox to left side of each item
   - Wire checkbox to local toggle handler
   - Keep `renderActions` for folder items (groups keep 3-dot menu)

5. Implement inline selection footer directly in component:
   ```tsx
   <Collapse in={selectedWalkthroughPaths.size > 0} animateOpacity>
     <Box
       position="sticky"
       bottom={0}
       width="100%"
       borderTopWidth="1px"
       py={4}
       px={6}
       css={{/* glass morphism */}}
     >
       <HStack justify="space-between">
         <Text>{selectedWalkthroughPaths.size} walkthrough(s) selected</Text>
         <HStack>
           <Button onClick={handleDelete}>Delete</Button>
           <Button onClick={handleAddToProject}>Add to Project</Button>
           <Button onClick={handlePublish}>Publish to Library</Button>
           <Button onClick={clearSelection}>Clear</Button>
         </HStack>
       </HStack>
     </Box>
   </Collapse>
   ```

### 3. Layout Integration

Each section needs to adjust its container layout to accommodate the footer:

**Before**:
```tsx
<Box h="100%" overflow="hidden">
  <StandardPageLayout>
    {/* content */}
  </StandardPageLayout>
  <ResourceSelectionBar /> {/* Portal */}
</Box>
```

**After**:
```tsx
<Flex direction="column" h="100%">
  <Box flex="1" overflow="auto">
    <StandardPageLayout>
      {/* content */}
    </StandardPageLayout>
  </Box>

  {/* Inline selection footer (section-specific implementation) */}
  <Collapse in={selectedIds.size > 0} animateOpacity>
    <Box
      position="sticky"
      bottom={0}
      width="100%"
      borderTopWidth="1px"
      py={4}
      px={6}
      css={{/* glass morphism */}}
    >
      {/* Selection summary and action buttons */}
    </Box>
  </Collapse>
</Flex>
```

**Key Points**:
- Outer `Flex` container takes full height
- Content area uses `flex: 1` and `overflow: auto`
- Footer is outside the scrolling area (sticky at bottom)
- Footer height changes trigger content area adjustment

### 4. Footer Animation

Use Chakra UI's `Collapse` component for smooth height transitions:

```tsx
<Collapse in={isOpen} animateOpacity>
  <Box
    position="sticky"
    bottom={0}
    width="100%"
    borderTopWidth="1px"
    css={{
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      // ...
    }}
  >
    {/* Footer content */}
  </Box>
</Collapse>
```

### 5. Action Implementation

Each section needs to implement its own action handlers:

**PlansSection Actions**:
- **Delete**: Delete selected plans
- **Complete**: Mark selected plans as completed (update status)
- **Clear**: Clear selection

**KitsSection Actions**:
- **Delete**: Delete selected kits
- **Add to Project**: Copy kits to selected projects
- **Publish to Library**: Publish kits to global library
- **Clear**: Clear selection

**WalkthroughsSection Actions**:
- **Delete**: Delete selected walkthroughs
- **Add to Project**: Copy walkthroughs to selected projects
- **Publish to Library**: Publish walkthroughs to global library
- **Clear**: Clear selection

### 6. Selection UI for Kits and Walkthroughs

**Kits/Walkthroughs Lists (ElegantList items)**:
- Replace 3-dot menu with **checkbox selection**
- Checkbox visible on left side of each item
- Checkbox appears always (not just on hover)
- Add **"Select All"** functionality in section header
- Visual feedback when selected:
  - Border highlight: `borderColor: "primary.500"`
  - Background tint: `bg: "primary.50"` (light mode) / `bg: "primary.900"` (dark mode)

**Groups/Folders (ElegantList items)**:
- **Keep 3-dot menu** (no change)
- No checkbox selection for groups
- Groups are not selectable for bulk actions

**Plans (PlanResourceCard)**:
- Keep existing selection mechanism (likely click/checkbox)
- Visual feedback when selected (border + background tint)

### 7. Update ElegantList Component

The `ElegantList` component needs to support both checkbox selection (for kits/walkthroughs) and menu actions (for groups):

**New Props**:
```typescript
interface ElegantListProps {
  items: any[];
  type: 'kit' | 'walkthrough' | 'folder' | 'diagram' | 'agent';
  onItemClick?: (item: any) => void;
  onItemContextMenu?: (e: React.MouseEvent, item: any) => void;
  renderActions?: (item: any) => React.ReactNode;

  // New props for selection
  selectable?: boolean;           // Enable checkbox selection
  selectedIds?: Set<string>;      // Currently selected item IDs
  onToggleSelection?: (item: any) => void;  // Toggle selection handler
  getItemId?: (item: any) => string;  // Extract ID from item
}
```

**Rendering Logic**:
- If `selectable={true}`: Show checkbox on left side (kits/walkthroughs)
- If `selectable={false}` or undefined: Show 3-dot menu on right side (groups/folders)
- Checkbox state driven by `selectedIds.has(getItemId(item))`
- Clicking checkbox calls `onToggleSelection(item)`

**Usage Examples**:
```tsx
// Kits (with checkbox selection)
<ElegantList
  items={rootKits}
  type="kit"
  selectable={true}
  selectedIds={selectedKitPaths}
  onToggleSelection={toggleKit}
  getItemId={(kit) => kit.path}
  onItemClick={(kit) => handleViewKit(kit)}
/>

// Groups (with 3-dot menu)
<ElegantList
  items={folders}
  type="folder"
  onItemClick={(folder) => setViewingFolder(folder)}
  renderActions={(folder) => (
    <Menu.Item onClick={() => handleDeleteFolder(folder)}>
      Delete
    </Menu.Item>
  )}
/>
```

### 8. Clear Selection on Tab Switch

Add effect to clear selections when component unmounts:

```typescript
useEffect(() => {
  return () => {
    clearSelection();
  };
}, []);
```

Or clear on projectId/projectPath change:

```typescript
useEffect(() => {
  clearSelection();
}, [projectId, projectPath]);
```

## Migration Checklist

### Phase 0: Update ElegantList Component
- [ ] Add `selectable` prop to enable checkbox mode
- [ ] Add `selectedIds`, `onToggleSelection`, `getItemId` props
- [ ] Implement checkbox rendering on left side (when `selectable={true}`)
- [ ] Wire checkbox to `onToggleSelection` handler
- [ ] Keep 3-dot menu rendering (when `selectable={false}` or undefined)
- [ ] Test with both checkbox mode and menu mode

### Phase 1: Refactor PlansSection
- [ ] Remove SelectionContext import
- [ ] Add local selection state (`useState<Set<string>>`)
- [ ] Implement selection handlers (toggle, clear, isSelected)
- [ ] Update PlanResourceCard integration
- [ ] Implement inline selection footer with Collapse animation
- [ ] Add action handlers: Delete, Complete, Clear
- [ ] Adjust layout container (Flex wrapper)
- [ ] Style footer with glass morphism
- [ ] Test selection flow and all actions

### Phase 2: Refactor KitsSection
- [ ] Remove SelectionContext import
- [ ] Add local selection state (`useState<Set<string>>`)
- [ ] Implement selection handlers (toggle, clear, isSelected, selectAll)
- [ ] Add "Select All" button in Kits section header
- [ ] Update ElegantList for kits: Replace 3-dot menu with checkbox selection
- [ ] Keep ElegantList for groups: Keep 3-dot menu (no checkbox)
- [ ] Implement inline selection footer with Collapse animation
- [ ] Add action handlers: Delete, Add to Project, Publish to Library, Clear
- [ ] Adjust layout container (Flex wrapper)
- [ ] Style footer with glass morphism
- [ ] Test selection flow, select all, and all actions

### Phase 3: Refactor WalkthroughsSection
- [ ] Remove SelectionContext import
- [ ] Add local selection state (`useState<Set<string>>`)
- [ ] Implement selection handlers (toggle, clear, isSelected, selectAll)
- [ ] Add "Select All" button in Walkthroughs section header
- [ ] Update ElegantList for walkthroughs: Replace 3-dot menu with checkbox selection
- [ ] Keep ElegantList for groups: Keep 3-dot menu (no checkbox)
- [ ] Implement inline selection footer with Collapse animation
- [ ] Add action handlers: Delete, Add to Project, Publish to Library, Clear
- [ ] Adjust layout container (Flex wrapper)
- [ ] Style footer with glass morphism
- [ ] Test selection flow, select all, and all actions

### Phase 4: Remove PlanWorkspace Document Transition Animations
- [ ] Remove document content transition animations from PlanWorkspace/PlanDocViewPage
- [ ] Make document switching instant (no fade/slide transitions)
- [ ] Ensure documents appear immediately when navigating between them
- [ ] Test document navigation behavior

### Phase 5: Cleanup
- [ ] Verify SelectionContext is no longer used in these sections
- [ ] Check if SelectionContext is still needed elsewhere
- [ ] Remove ResourceSelectionBar from these sections
- [ ] Update tests if any
- [ ] Document new selection pattern

## Technical Considerations

### State Management
- Use `Set<string>` for selection state (efficient lookups and toggles)
- Convert to array when needed for rendering: `Array.from(selectedIds)`

### Performance
- Memoize selected items array to prevent re-renders:
  ```typescript
  const selectedItems = useMemo(
    () => items.filter(item => selectedIds.has(item.id)),
    [items, selectedIds]
  );
  ```

### Accessibility
- Footer should have `role="region"` and `aria-label="Selection actions"`
- Action buttons should have descriptive labels
- Keyboard shortcuts for common actions (Escape to clear, Delete key)

### Mobile/Responsive
- Footer should be responsive (stack buttons vertically on small screens)
- Consider making footer full-height on mobile with slide-up animation

## Visual Design

### Footer Appearance
- Glass morphism background (consistent with current ResourceSelectionBar)
- Subtle border-top separator
- Compact height (48-56px)
- Centered action buttons with adequate spacing
- Selection count badge prominent on left side

### Transition
- 200-300ms ease-in-out for height change
- Content should smoothly push up (no jank)
- Opacity fade-in for footer content

## Success Criteria

1. ✅ PlansSection, KitsSection, and WalkthroughsSection no longer depend on SelectionContext
2. ✅ Each section manages its own selection state independently
3. ✅ Selections are isolated per-section (switching tabs clears selection)
4. ✅ Each section has its own inline selection footer implementation
5. ✅ Footers appear inline and push content up (no overlap)
6. ✅ Smooth Collapse animations when footer appears/disappears
7. ✅ All section-specific actions work correctly:
   - Plans: Delete, Complete, Clear
   - Kits/Walkthroughs: Delete, Add to Project, Publish to Library, Clear
8. ✅ ElegantList component supports checkbox selection mode
9. ✅ Kits/Walkthroughs show checkboxes (not 3-dot menu)
10. ✅ Groups/Folders keep 3-dot menu (no checkbox selection)
11. ✅ "Select All" / "Deselect All" functionality works in Kits and Walkthroughs sections
12. ✅ Visual feedback for selected items is clear (checkbox checked + border/background)
13. ✅ Footers are responsive and accessible
14. ✅ No shared/abstracted footer component (each section customized)

## Future Enhancements

1. **Keyboard Shortcuts**: Cmd/Ctrl+A to select all, Escape to clear
2. **Bulk Actions**: Select all filtered items, select by type
3. **Selection Persistence**: Optionally persist selections in localStorage
4. **Footer Positioning**: Allow user to choose between sticky footer or always-visible footer
5. **Action History**: Undo/redo for bulk actions

## Notes

- **No Shared Component**: Each section implements its own footer for maximum flexibility and simplicity
- **Isolated State**: Improves isolation and reduces cognitive load by keeping selections scoped to the current view
- **Inline Layout**: The inline footer provides better visual hierarchy (content flows naturally)
- **Checkbox Selection**: Kits and walkthroughs use checkboxes for clear, discoverable selection (no hidden menu)
- **Groups Stay Same**: Folders/groups keep 3-dot menu since they're not selectable for bulk actions
- **Select All**: Provides quick way to select all visible items for batch operations
- **Future Pattern**: Future sections should follow this pattern rather than using global SelectionContext
- **SelectionContext Scope**: SelectionContext may still be useful for cross-app selections (e.g., Library view, Home page)
- **Customization**: Each footer can have different actions, styling tweaks, and behavior without affecting others
