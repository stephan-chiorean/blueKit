# Phase 6.4: Unified Section Headers

**Status**: Planning
**Dependencies**: Phase 6.3 (Unified Selection Footer)
**Scope**: Standardize header layout and sticky behavior across all section views

## Problem Statement

Currently, section headers across the app have inconsistent layouts and behaviors:

### Current State Analysis

1. **TasksSection** (`src/views/project/sections/TasksSection.tsx:659-669`)
   - Uses `ToolkitHeader` component
   - Action: "Add Task" icon button (upper right)
   - Filter: Located in "In Progress" section header (line 692), not in main header
   - **Issue**: Filter is buried in content, not in main header

2. **KitsSection** (`src/views/project/sections/KitsSection.tsx:532-535`)
   - Uses `ToolkitHeader` component
   - No header action
   - Filter + "New Group": In "Groups" section header (lines 546-620), not main header
   - **Issue**: Controls scattered in sub-sections instead of main header

3. **PlansSection** (`src/views/project/sections/PlansSection.tsx:139-201`)
   - Uses `StandardPageLayout` component (different pattern!)
   - Header action: "Create Plan" icon button
   - Filter: Passed as `filterControl` prop to StandardPageLayout
   - **Issue**: Different component, but better pattern for filter placement

4. **WalkthroughsSection** (`src/views/project/sections/WalkthroughsSection.tsx:465-474`)
   - Uses `ToolkitHeader` component
   - Action: "Add Walkthrough" icon button (conditional on projectId)
   - Filter + "New Group": In "Groups" section header (lines 485-559), not main header
   - **Issue**: Controls scattered in sub-sections instead of main header

### Inconsistencies

❌ **Multiple header components**: `ToolkitHeader` vs `StandardPageLayout`
❌ **Filter placement**: Sometimes in section headers, sometimes in main header
❌ **Action placement**: Inconsistent icon button styles
❌ **Sticky behavior**: Not consistently applied
❌ **Visual hierarchy**: Controls compete for attention instead of clear left/right split

### Desired State

✅ **Single header component** used across all sections
✅ **Unified layout**: Title (left) → Actions (right)
✅ **Sticky positioning** at top of scrollable content
✅ **Consistent action buttons**: Filter, New Group, Add Item all styled the same
✅ **Clear visual hierarchy**: Primary actions prominent, secondary actions subtle

---

## Design Principles

### 1. Consistent Layout Pattern

All section headers should follow this structure:

```
┌────────────────────────────────────────────────────────────┐
│ [Title]                    [Filter] [New Group] [Add Item] │
└────────────────────────────────────────────────────────────┘
```

- **Title**: Bold, prominent (left-aligned)
- **Actions**: Small icon buttons (right-aligned)
- **Order**: Filter → Context-specific actions → Primary action

### 2. Sticky Header Behavior

Headers should:
- Stick to top of scrollable area
- Have subtle backdrop blur for readability over scrolled content
- Maintain z-index layering (header above content, below modals)

### 3. Visual Consistency

All action buttons should:
- Be same size (`sm`)
- Use icon-only style (no text labels in header)
- Show tooltips on hover
- Use consistent colors (filter = gray, new = blue, add = primary)

---

## Implementation Plan

### Step 1: Audit ToolkitHeader Component

**File**: `src/shared/components/ToolkitHeader.tsx`

**Current capabilities**:
- Title display
- Parent name (breadcrumb)
- Single action button (icon variant)

**Needed enhancements**:
1. Support multiple actions (array of action configs)
2. Built-in sticky positioning option
3. Backdrop blur styling
4. Left/right action slots (for filter on left, primary on right)

**Proposed API**:
```typescript
interface ToolkitHeaderProps {
  title: string;
  parentName?: string;

  // Left-side actions (filter, view toggles)
  leftActions?: ActionConfig[];

  // Right-side actions (new group, add item)
  rightActions?: ActionConfig[];

  // Sticky behavior
  sticky?: boolean;

  // Custom styling
  className?: string;
}

interface ActionConfig {
  id: string;
  icon: React.ComponentType;
  label: string; // For tooltip
  onClick: () => void;
  variant?: 'ghost' | 'subtle' | 'solid';
  colorPalette?: string;
  badge?: number; // For filter count badge
}
```

---

### Step 2: Enhance ToolkitHeader Component

**File**: `src/shared/components/ToolkitHeader.tsx`

**Changes**:

1. **Add sticky positioning**:
```tsx
const stickyStyles = sticky ? {
  position: 'sticky' as const,
  top: 0,
  zIndex: 100,
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  background: 'rgba(255, 255, 255, 0.85)',
  _dark: {
    background: 'rgba(20, 20, 20, 0.85)',
  },
} : {};
```

2. **Render action buttons**:
```tsx
const renderAction = (action: ActionConfig) => (
  <Tooltip.Root key={action.id}>
    <Tooltip.Trigger asChild>
      <IconButton
        size="sm"
        variant={action.variant || 'ghost'}
        colorPalette={action.colorPalette}
        aria-label={action.label}
        onClick={action.onClick}
      >
        <action.icon />
        {action.badge && (
          <Badge
            position="absolute"
            top="-4px"
            right="-4px"
            size="xs"
            colorPalette="primary"
          >
            {action.badge}
          </Badge>
        )}
      </IconButton>
    </Tooltip.Trigger>
    <Portal>
      <Tooltip.Positioner>
        <Tooltip.Content>{action.label}</Tooltip.Content>
      </Tooltip.Positioner>
    </Portal>
  </Tooltip.Root>
);
```

3. **Layout with left and right actions**:
```tsx
<Box {...stickyStyles} borderBottomWidth="1px" borderColor="border.subtle">
  <HStack justify="space-between" py={4} px={6}>
    {/* Left side: Title + Breadcrumb */}
    <VStack align="start" gap={0}>
      {parentName && (
        <Text fontSize="xs" color="text.muted">
          {parentName}
        </Text>
      )}
      <Heading size="lg">{title}</Heading>
    </VStack>

    {/* Right side: Actions */}
    <HStack gap={2}>
      {/* Left actions (filter, etc.) */}
      {leftActions?.map(renderAction)}

      {/* Separator if we have both left and right actions */}
      {leftActions && leftActions.length > 0 && rightActions && rightActions.length > 0 && (
        <Box h="20px" w="1px" bg="border.subtle" />
      )}

      {/* Right actions (new, add, etc.) */}
      {rightActions?.map(renderAction)}
    </HStack>
  </HStack>
</Box>
```

---

### Step 3: Refactor TasksSection Header

**File**: `src/views/project/sections/TasksSection.tsx`

**Changes**:

1. **Move filter from "In Progress" section to main header**:
   - Remove filter button from line 692-744
   - Add to ToolkitHeader as leftAction

2. **Update ToolkitHeader usage**:
```tsx
<ToolkitHeader
  title="Tasks"
  parentName={parentName}
  sticky={true}
  leftActions={[
    {
      id: 'filter',
      icon: LuFilter,
      label: 'Filter',
      onClick: () => setIsFilterOpen(!isFilterOpen),
      variant: 'ghost',
      badge: filterCount > 0 ? filterCount : undefined,
    },
  ]}
  rightActions={[
    {
      id: 'add-task',
      icon: LuPlus,
      label: 'Add Task',
      onClick: handleAddTask,
      variant: 'ghost',
      colorPalette: 'blue',
    },
  ]}
/>
```

3. **Keep FilterPanel positioned relative to filter button**:
   - Use a ref for the filter button
   - FilterPanel already supports positioning via `filterButtonRef` prop

---

### Step 4: Refactor KitsSection Header

**File**: `src/views/project/sections/KitsSection.tsx`

**Changes**:

1. **Move filter and "New Group" from "Groups" section to main header**:
   - Remove from lines 546-620
   - Add to ToolkitHeader

2. **Update ToolkitHeader usage**:
```tsx
<ToolkitHeader
  title="Kits"
  parentName={projectName}
  sticky={true}
  leftActions={[
    {
      id: 'filter',
      icon: LuFilter,
      label: 'Filter',
      onClick: () => setIsFilterOpen(!isFilterOpen),
      variant: 'ghost',
      badge: (nameFilter || selectedTags.length > 0)
        ? (nameFilter ? 1 : 0) + selectedTags.length
        : undefined,
    },
  ]}
  rightActions={[
    {
      id: 'new-group',
      icon: LuFolderPlus,
      label: 'New Group',
      onClick: () => setIsCreateFolderOpen(true),
      variant: 'ghost',
      colorPalette: 'blue',
    },
  ]}
/>
```

3. **Simplify "Groups" section header**:
   - Keep just: `<Heading size="md">Groups</Heading>` + count badge
   - Remove filter and new group buttons

4. **Handle CreateFolderPopover**:
   - Since we're now using icon button instead of trigger element, refactor popover
   - Use state to control open/close instead of trigger prop

---

### Step 5: Refactor WalkthroughsSection Header

**File**: `src/views/project/sections/WalkthroughsSection.tsx`

**Changes**:

1. **Move filter and "New Group" from "Groups" section to main header**:
   - Remove from lines 485-559
   - Add to ToolkitHeader

2. **Update ToolkitHeader usage**:
```tsx
<ToolkitHeader
  title="Walkthroughs"
  parentName={projectName}
  sticky={true}
  leftActions={[
    {
      id: 'filter',
      icon: LuFilter,
      label: 'Filter',
      onClick: () => setIsFilterOpen(!isFilterOpen),
      variant: 'ghost',
      badge: (nameFilter || selectedTags.length > 0)
        ? (nameFilter ? 1 : 0) + selectedTags.length
        : undefined,
    },
  ]}
  rightActions={[
    {
      id: 'new-group',
      icon: LuFolderPlus,
      label: 'New Group',
      onClick: () => setIsCreateFolderOpen(true),
      variant: 'ghost',
      colorPalette: 'blue',
    },
    projectId && {
      id: 'add-walkthrough',
      icon: LuPlus,
      label: 'Add Walkthrough',
      onClick: () => setIsCreateWalkthroughOpen(true),
      variant: 'ghost',
      colorPalette: 'blue',
    },
  ].filter(Boolean)}
/>
```

3. **Simplify "Groups" section header**:
   - Keep just: `<Heading size="md">Groups</Heading>` + count badge

---

### Step 6: Refactor PlansSection Header

**File**: `src/views/project/sections/PlansSection.tsx`

**Changes**:

1. **Replace StandardPageLayout with ToolkitHeader**:
   - Remove StandardPageLayout wrapper (lines 139-299)
   - Use ToolkitHeader + manual content rendering

2. **Update to ToolkitHeader**:
```tsx
<Flex direction="column" h="100%" overflow="hidden">
  <ToolkitHeader
    title="Plans"
    parentName={projectName}
    sticky={true}
    leftActions={[
      {
        id: 'filter',
        icon: LuFilter,
        label: 'Filter',
        onClick: () => setIsFilterOpen(!isFilterOpen),
        variant: 'ghost',
        badge: (nameFilter || selectedStatuses.length > 0)
          ? (nameFilter ? 1 : 0) + selectedStatuses.length
          : undefined,
      },
    ]}
    rightActions={[
      {
        id: 'create-plan',
        icon: LuPlus,
        label: 'Create Plan',
        onClick: handleOpenCreateDialog,
        variant: 'ghost',
        colorPalette: 'blue',
      },
    ]}
  />

  {/* Scrollable content */}
  <Box flex={1} overflowY="auto" p={6}>
    {plansLoading ? (
      <TableSkeleton />
    ) : plans.length === 0 ? (
      <EmptyState />
    ) : (
      <>
        {/* Active Plans Section */}
        <Box mb={8}>...</Box>
        {/* Completed Plans Section */}
        <Box>...</Box>
      </>
    )}
  </Box>
</Flex>
```

3. **Note**: This removes dependency on `StandardPageLayout`, consolidating to one header pattern

---

### Step 7: Update Section Headers (Groups/Walkthroughs/etc.)

**Files**:
- `src/views/project/sections/KitsSection.tsx`
- `src/views/project/sections/WalkthroughsSection.tsx`

**Changes**:

After moving controls to main header, section headers should be simplified:

**Before** (KitsSection line 546-620):
```tsx
<Flex align="center" justify="space-between" gap={2} mb={4}>
  <Flex align="center" gap={2}>
    <Heading size="md">Groups</Heading>
    <Text fontSize="sm" color="text.muted">{folders.length}</Text>
    {/* Filter Button */}
    <Box>...</Box>
    {/* New Folder Button */}
    <CreateFolderPopover>...</CreateFolderPopover>
  </Flex>
</Flex>
```

**After**:
```tsx
<Flex align="center" gap={2} mb={4}>
  <Heading size="md">Groups</Heading>
  <Badge variant="subtle" colorPalette="gray">
    {folders.length}
  </Badge>
</Flex>
```

**Visual Change**: Cleaner, less cluttered section headers

---

### Step 8: Handle FilterPanel Positioning

**File**: All section files

**Challenge**: FilterPanel needs to position relative to filter button, but button is now in sticky header

**Solution**: Use portal positioning with ref

```tsx
// In section component
const filterButtonRef = useRef<HTMLButtonElement>(null);

// Pass ref to ToolkitHeader action
leftActions={[
  {
    id: 'filter',
    icon: LuFilter,
    label: 'Filter',
    onClick: () => setIsFilterOpen(!isFilterOpen),
    ref: filterButtonRef, // New prop for action ref
  },
]}

// FilterPanel already supports filterButtonRef
<FilterPanel
  isOpen={isFilterOpen}
  onClose={() => setIsFilterOpen(false)}
  filterButtonRef={filterButtonRef}
  // ... other props
/>
```

**ToolkitHeader Enhancement**:
- Add `ref` prop to `ActionConfig`
- Forward ref to IconButton

---

### Step 9: Handle CreateFolderPopover Without Trigger Prop

**Files**:
- `src/views/project/sections/KitsSection.tsx`
- `src/views/project/sections/WalkthroughsSection.tsx`

**Current**: CreateFolderPopover uses `trigger` prop to render custom button

**New approach**: Controlled popover

**Option 1: Render popover separately** (Recommended):
```tsx
{/* In header */}
<ToolkitHeader
  rightActions={[
    {
      id: 'new-group',
      icon: LuFolderPlus,
      label: 'New Group',
      onClick: () => setIsCreateFolderOpen(true), // Just set state
    },
  ]}
/>

{/* Render popover outside header */}
<CreateFolderPopover
  isOpen={isCreateFolderOpen}
  onOpenChange={setIsCreateFolderOpen}
  onConfirm={handleCreateFolder}
  // No trigger prop - popover manages its own positioning
/>
```

**Option 2: Enhance ActionConfig to support custom render**:
```typescript
interface ActionConfig {
  // ... existing props
  render?: (defaultButton: React.ReactNode) => React.ReactNode;
}

// Usage
rightActions={[
  {
    id: 'new-group',
    icon: LuFolderPlus,
    label: 'New Group',
    render: () => (
      <CreateFolderPopover trigger={<IconButton>...</IconButton>} />
    ),
  },
]}
```

**Recommendation**: Use Option 1 for simplicity and consistency

---

## Visual Specifications

### Header Styling

```css
/* Sticky header */
position: sticky;
top: 0;
z-index: 100;
padding: 16px 24px;
border-bottom: 1px solid var(--chakra-colors-border-subtle);

/* Glassmorphic background */
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
background: rgba(255, 255, 255, 0.85);

/* Dark mode */
background: rgba(20, 20, 20, 0.85);
```

### Action Buttons

```typescript
{
  size: 'sm',
  variant: 'ghost',
  colorPalette: 'gray', // Filter
  // or 'blue' // New Group, Add Item
}
```

### Badge (for filter count)

```typescript
{
  position: 'absolute',
  top: '-4px',
  right: '-4px',
  size: 'xs',
  colorPalette: 'primary',
  variant: 'solid',
}
```

### Spacing

- Header padding: `py={4} px={6}` (16px vertical, 24px horizontal)
- Action buttons gap: `gap={2}` (8px)
- Title + Actions gap: `justify="space-between"` (maximum space)

---

## Z-Index Layering

Ensure proper layering:

1. **Content**: `z-index: auto` (0)
2. **Section headers** (Groups, Walkthroughs): `z-index: 10` (local stacking)
3. **Main sticky header**: `z-index: 100`
4. **FilterPanel**: `z-index: 200` (above header)
5. **Modals/Popovers**: `z-index: 1000+` (standard modal layer)

---

## Migration Checklist

### ToolkitHeader Component
- [ ] Add `leftActions` and `rightActions` props
- [ ] Add `sticky` prop
- [ ] Implement action rendering with badges
- [ ] Add tooltip support for action buttons
- [ ] Support ref forwarding for filter button
- [ ] Add backdrop blur styling for sticky mode

### TasksSection
- [ ] Move filter to main header leftActions
- [ ] Keep "Add Task" in rightActions
- [ ] Remove filter from "In Progress" section
- [ ] Test FilterPanel positioning

### KitsSection
- [ ] Move filter to leftActions
- [ ] Move "New Group" to rightActions
- [ ] Remove controls from "Groups" section header
- [ ] Simplify section header to just title + count
- [ ] Refactor CreateFolderPopover to controlled mode

### WalkthroughsSection
- [ ] Move filter to leftActions
- [ ] Move "New Group" and "Add Walkthrough" to rightActions
- [ ] Remove controls from "Groups" section header
- [ ] Simplify section header to just title + count
- [ ] Refactor CreateFolderPopover to controlled mode

### PlansSection
- [ ] Replace StandardPageLayout with ToolkitHeader
- [ ] Move filter to leftActions
- [ ] Move "Create Plan" to rightActions
- [ ] Manually render content sections
- [ ] Test empty state and loading state rendering

---

## Testing Checklist

### Visual Tests
- [ ] All headers aligned and styled consistently
- [ ] Sticky headers work correctly on scroll
- [ ] Backdrop blur visible over scrolled content
- [ ] Action buttons same size across sections
- [ ] Filter badge appears when filters active
- [ ] Tooltips show on action button hover

### Functional Tests
- [ ] Filter button opens FilterPanel correctly
- [ ] FilterPanel positions relative to filter button in sticky header
- [ ] "New Group" button opens CreateFolderPopover
- [ ] "Add" buttons open respective dialogs
- [ ] Multiple filters applied, badge count updates
- [ ] Clear filters, badge disappears

### Interaction Tests
- [ ] Click filter → panel opens
- [ ] Click outside panel → panel closes
- [ ] Click filter while open → panel closes
- [ ] Scroll page → header stays at top
- [ ] Switch tabs → header state resets correctly

### Accessibility Tests
- [ ] All action buttons have aria-label
- [ ] Tooltips announce on focus
- [ ] Keyboard navigation works (Tab through actions)
- [ ] Enter/Space activates buttons
- [ ] Screen reader announces filter count badge

---

## Success Criteria

### Visual Consistency
- [x] All section headers use same component (ToolkitHeader)
- [x] All action buttons styled identically
- [x] Sticky behavior consistent across sections
- [x] Filter badges show active filter count

### User Experience
- [x] Primary actions easy to find (upper right)
- [x] Filter always in same location (upper left)
- [x] Headers stay visible while scrolling
- [x] Reduced visual clutter in section content

### Code Quality
- [x] Single source of truth for header layout
- [x] Reduced duplication across sections
- [x] Clear separation: header vs content
- [x] Reusable action configuration pattern

---

## Future Enhancements

1. **View Mode Toggle**: Add left action for list/grid view toggle
2. **Sort Toggle**: Add left action for sort order (A-Z, Date, etc.)
3. **Bulk Actions**: Add context-sensitive actions when items selected
4. **Breadcrumbs**: Extend for multi-level navigation (Groups > Subgroups)
5. **Search**: Add inline search in header (replaces filter in some contexts)
6. **Keyboard Shortcuts**: Cmd+K for filter, Cmd+N for new item, etc.

---

## Implementation Order

**Day 1**: Enhance ToolkitHeader
- Add multi-action support
- Implement sticky mode
- Add badge support
- Test in isolation

**Day 2**: Refactor TasksSection
- Migrate to enhanced ToolkitHeader
- Move filter to header
- Test functionality

**Day 3**: Refactor KitsSection
- Migrate to enhanced ToolkitHeader
- Move filter and new group to header
- Simplify section headers
- Refactor CreateFolderPopover

**Day 4**: Refactor WalkthroughsSection
- Same approach as KitsSection
- Ensure parity with Kits implementation

**Day 5**: Refactor PlansSection
- Replace StandardPageLayout
- Migrate to ToolkitHeader
- Manually render content

**Day 6**: Polish and Testing
- Visual consistency check
- Functional testing
- Accessibility testing
- Fix any issues

---

## Notes

- **StandardPageLayout**: After PlansSection migration, check if `StandardPageLayout` is used elsewhere. If not, consider deprecating to reduce maintenance burden.
- **Action Configs**: The `ActionConfig` pattern is reusable for other UI components (toolbars, context menus, etc.)
- **Ref Forwarding**: FilterPanel positioning with sticky header may require additional testing on different screen sizes
- **CreateFolderPopover**: Converting from trigger-based to controlled may require updates to spotlight blur logic
- **Mobile**: Consider responsive behavior - might need to collapse actions into overflow menu on small screens

This phase brings significant UX consistency improvements by unifying the header pattern across all sections, making the app feel more cohesive and professional.
