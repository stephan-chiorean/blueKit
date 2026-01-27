# Browser-Style Tabs Implementation Plan

## Overview

Implement browser-style tabs positioned above the main content area on the right side of the application. These tabs will be visually independent of the sidebar navigation and will feature sophisticated styling including merged corners, elegant dividers, hover states, and icons.

---

## Reference Analysis (from screenshot)

### Key Visual Features to Replicate

1. **Tab Bar Container**
   - Horizontal tab strip positioned directly above content
   - Consistent background color with subtle differentiation from content
   - No visible border between selected tab and content (seamless merge)

2. **Selected Tab Styling**
   - Background matches content area exactly (seamless blend)
   - Rounded top corners (approximately `8px` radius)
   - **Inverted corner cutouts** at bottom where tab meets content - creates smooth "flowing" transition, not perpendicular
   - No bottom border visible

3. **Unselected Tab Styling**
   - Slightly darker/muted background than selected
   - Same rounded top corners
   - Visible bottom edge (doesn't merge with content)
   - Clear visual hierarchy showing inactive state

4. **Hover State (Unselected)**
   - Background brightens toward selected state
   - Smooth transition animation
   - Provides clear feedback before clicking

5. **Tab Dividers**
   - Thin vertical lines between adjacent tabs
   - Subtle color (`rgba` with low opacity)
   - Do NOT appear between selected tab and its neighbors
   - Height shorter than full tab height for elegance

6. **Tab Icons**
   - Small icon to left of tab label
   - Consistent sizing (~14-16px)
   - Color matches tab text state

7. **Close Button (X)**
   - Appears on right side of tab
   - Subtle until hover, then more visible
   - Consistent with modern browser patterns

---

## Technical Implementation

### File Structure

```
src/components/tabs/
├── BrowserTabs.tsx          # Main tab container component
├── BrowserTab.tsx           # Individual tab component
├── TabDivider.tsx           # Divider component
├── useTabState.ts           # Tab state management hook
└── tabStyles.ts             # Shared style constants
```

### 1. BrowserTabs Container (`BrowserTabs.tsx`)

**Responsibilities:**
- Renders horizontal tab bar
- Manages tab selection state
- Handles tab ordering and divider logic
- Provides context to child tabs

**Layout Structure:**
```tsx
<Box position="relative">
  {/* Tab Bar */}
  <Flex
    h="36px"                              // Tab bar height
    px={2}                                // Horizontal padding
    alignItems="flex-end"                 // Tabs align to bottom
    bg={tabBarBackground}                 // Matches sidebar/neutral area
  >
    {tabs.map((tab, index) => (
      <Fragment key={tab.id}>
        {/* Divider logic: show between non-selected adjacent tabs */}
        {shouldShowDivider(index) && <TabDivider />}
        <BrowserTab
          tab={tab}
          isSelected={selectedId === tab.id}
          onSelect={() => setSelectedId(tab.id)}
        />
      </Fragment>
    ))}
  </Flex>

  {/* Content Area - receives inverted corners from selected tab */}
  <Box
    bg={contentBackground}                // Matches selected tab exactly
    borderTopLeftRadius={0}               // Flat where tabs connect
    position="relative"
  >
    {/* Inverted corner overlays positioned absolutely */}
    <InvertedCornerLeft />
    <InvertedCornerRight />
    {children}
  </Box>
</Box>
```

### 2. Individual Tab (`BrowserTab.tsx`)

**Styling Breakdown:**

```tsx
// Selected Tab
const selectedStyles = {
  bg: contentBackground,                  // Matches content exactly
  borderTopLeftRadius: '8px',
  borderTopRightRadius: '8px',
  borderBottomLeftRadius: 0,              // Flat - merges with content
  borderBottomRightRadius: 0,
  position: 'relative',
  zIndex: 1,                              // Above other tabs
  // Bottom "extension" to cover gap
  _after: {
    content: '""',
    position: 'absolute',
    bottom: '-1px',
    left: 0,
    right: 0,
    height: '1px',
    bg: contentBackground,                // Covers any border line
  }
};

// Unselected Tab
const unselectedStyles = {
  bg: unselectedTabBackground,            // Slightly darker/muted
  borderTopLeftRadius: '8px',
  borderTopRightRadius: '8px',
  opacity: 0.85,
  transition: 'all 0.15s ease',
  _hover: {
    bg: hoverTabBackground,               // Approaches selected brightness
    opacity: 1,
  }
};
```

### 3. Inverted Corner Effect (Critical Detail)

The "merged" look requires SVG-based inverted corners:

```tsx
// InvertedCorner.tsx
const InvertedCornerLeft = ({ colorMode }) => (
  <Box
    position="absolute"
    left={selectedTabLeftEdge}            // Positioned at tab edge
    bottom="100%"                         // Just above content
    w="8px"
    h="8px"
    overflow="hidden"
    pointerEvents="none"
  >
    <svg width="8" height="8" viewBox="0 0 8 8">
      <path
        d="M8 8 L8 0 Q8 8 0 8 Z"
        fill={contentBackground}          // Matches content/selected tab
      />
    </svg>
  </Box>
);

// Mirror for right side
const InvertedCornerRight = ({ colorMode }) => (
  <Box
    position="absolute"
    right={selectedTabRightEdge}
    bottom="100%"
    w="8px"
    h="8px"
    overflow="hidden"
    pointerEvents="none"
    transform="scaleX(-1)"               // Mirror the path
  >
    <svg width="8" height="8" viewBox="0 0 8 8">
      <path
        d="M8 8 L8 0 Q8 8 0 8 Z"
        fill={contentBackground}
      />
    </svg>
  </Box>
);
```

### 4. Tab Dividers (`TabDivider.tsx`)

```tsx
const TabDivider = ({ colorMode }) => (
  <Box
    w="1px"
    h="16px"                              // Shorter than full tab height
    alignSelf="center"
    bg={colorMode === 'light'
      ? 'rgba(0, 0, 0, 0.12)'
      : 'rgba(255, 255, 255, 0.15)'}
    mx={0}                                // Tight spacing
    flexShrink={0}
  />
);
```

**Divider Logic:**
- Show between two unselected adjacent tabs
- Hide when either neighbor is selected (selected tab has no dividers)

### 5. Color Values (Matching ProjectSidebar.tsx Exactly)

```ts
// tabStyles.ts
export const getTabColors = (colorMode: 'light' | 'dark') => ({
  // Tab bar background - EXACT MATCH with sidebar
  // From ProjectSidebar.tsx sidebarBg values
  tabBarBg: colorMode === 'light'
    ? 'rgba(255, 255, 255, 0.3)'          // Exact sidebarBg light
    : 'rgba(20, 20, 25, 0.15)',           // Exact sidebarBg dark

  // Selected tab & content - seamless merge with content panel
  selectedBg: colorMode === 'light'
    ? 'rgba(255, 255, 255, 0.45)'         // Match content panel
    : 'rgba(20, 20, 25, 0.5)',

  // Unselected tab - TRANSPARENT (blends with tab bar)
  unselectedBg: 'transparent',

  // Hover state - subtle hint toward selected
  hoverBg: colorMode === 'light'
    ? 'rgba(255, 255, 255, 0.2)'          // Subtle white overlay
    : 'rgba(255, 255, 255, 0.05)',        // Very subtle brightening

  // Text colors
  selectedText: colorMode === 'light' ? 'gray.900' : 'gray.100',
  unselectedText: colorMode === 'light' ? 'gray.600' : 'gray.400',

  // Divider
  divider: colorMode === 'light'
    ? 'rgba(0, 0, 0, 0.12)'
    : 'rgba(255, 255, 255, 0.15)',

  // Icon colors
  iconSelected: 'primary.500',
  iconUnselected: colorMode === 'light' ? 'gray.500' : 'gray.500',
});
```

---

## Integration Point

### Location in App

The tabs component will be placed in `ProjectDetailPage.tsx` between the sidebar splitter and the main content area:

```tsx
// In ProjectDetailPage.tsx, right side content panel
<Splitter.Panel id="content">
  <Box h="100%" overflow="hidden" position="relative">
    {/* NEW: Browser Tabs */}
    <BrowserTabs
      tabs={openTabs}
      selectedId={activeTabId}
      onSelect={setActiveTabId}
      colorMode={colorMode}
    />

    {/* Existing content - now wrapped by tabs */}
    <Box
      flex={1}
      overflow="hidden"
      css={/* existing glassmorphism styles */}
    >
      {/* Current view content */}
    </Box>
  </Box>
</Splitter.Panel>
```

---

## Component API

### BrowserTabs Props

```ts
interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;     // LuFile, LuFolder, etc.
  closable?: boolean;
}

interface BrowserTabsProps {
  tabs: Tab[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  colorMode: 'light' | 'dark';
}
```

---

## Visual Specifications

| Property | Value |
|----------|-------|
| Tab height | 36px |
| Tab min-width | 120px |
| Tab max-width | 200px |
| Border radius (top) | 8px |
| Inverted corner size | 8px |
| Icon size | 14px |
| Icon-label gap | 6px |
| Close button size | 14px |
| Divider height | 16px |
| Divider width | 1px |
| Hover transition | 150ms ease |
| Font size | 13px (xs) |
| Font weight | 500 (medium) |

---

## Files to Create/Modify

### New Files
1. `src/components/tabs/BrowserTabs.tsx` - Main container
2. `src/components/tabs/BrowserTab.tsx` - Individual tab
3. `src/components/tabs/TabDivider.tsx` - Divider component
4. `src/components/tabs/InvertedCorner.tsx` - SVG corner effect
5. `src/components/tabs/tabStyles.ts` - Style constants
6. `src/components/tabs/index.ts` - Barrel export

### Files to Modify
1. `src/pages/ProjectDetailPage.tsx` - Integrate BrowserTabs above content

---

## Implementation Order

1. Create `tabStyles.ts` with color constants
2. Create `TabDivider.tsx` (simple)
3. Create `InvertedCorner.tsx` (SVG components)
4. Create `BrowserTab.tsx` with all states
5. Create `BrowserTabs.tsx` container with divider logic
6. Create `index.ts` barrel export
7. Integrate into `ProjectDetailPage.tsx`
8. Test light/dark modes
9. Fine-tune hover transitions and colors

---

## Verification

1. **Visual Match**: Selected tab background seamlessly blends with content
2. **Inverted Corners**: Smooth curved transition at tab-content junction
3. **Hover States**: Clear feedback when hovering unselected tabs
4. **Dividers**: Appear only between unselected adjacent tabs
5. **Light/Dark Mode**: Consistent appearance in both modes
6. **Icons**: Properly sized and colored per tab state
7. **Independence**: Tabs remain unaffected by sidebar navigation changes
