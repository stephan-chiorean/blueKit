---
id: view-mode-switcher
alias: View Mode Switcher
type: kit
is_base: false
version: 1
tags: [ui-component, switcher, view-mode, cards, table]
description: 'Reusable cards/table view mode switcher component with shadow styling for elevated appearance'
---

# View Mode Switcher Component

## Overview

A reusable view mode switcher component that allows users to toggle between card and table views. The component features a subtle shadow effect that makes it appear elevated and more noticeable, with a clean border and smooth transitions.

## Features

- **Dual View Modes**: Toggle between card and table views
- **Visual Feedback**: Active state styling with background color change
- **Elevated Appearance**: Medium shadow (`shadow="md"`) for depth
- **Clean Borders**: 1px border with subtle color
- **Icon Support**: Uses react-icons for visual indicators
- **Hover States**: Interactive hover feedback

## Prerequisites

### Dependencies

**Chakra UI v3:**
```typescript
import {
  HStack,
  Button,
  Icon,
  Text,
} from '@chakra-ui/react';
```

**Icons (react-icons):**
```bash
npm install react-icons
```

Icons used: `LuLayoutGrid` (cards), `LuTable` (table)

## Implementation

### Step 1: Import Dependencies

```typescript
import { HStack, Button, Icon, Text } from '@chakra-ui/react';
import { LuLayoutGrid, LuTable } from 'react-icons/lu';
```

### Step 2: Component State

```typescript
type ViewMode = 'card' | 'table';

const [viewMode, setViewMode] = useState<ViewMode>('card');
```

### Step 3: Component Code

```tsx
<HStack 
  gap={0} 
  borderWidth="1px" 
  borderColor="border" 
  borderRadius="md" 
  overflow="hidden" 
  bg="bg.subtle" 
  shadow="md"
>
  <Button
    onClick={() => setViewMode('card')}
    variant="ghost"
    borderRadius={0}
    borderRightWidth="1px"
    borderRightColor="border.subtle"
    bg={viewMode === 'card' ? 'white' : 'transparent'}
    color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
    _hover={{ bg: viewMode === 'card' ? 'white' : 'bg.subtle' }}
    size="sm"
  >
    <HStack gap={2}>
      <Icon>
        <LuLayoutGrid />
      </Icon>
      <Text>Cards</Text>
    </HStack>
  </Button>
  <Button
    onClick={() => setViewMode('table')}
    variant="ghost"
    borderRadius={0}
    bg={viewMode === 'table' ? 'white' : 'transparent'}
    color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
    _hover={{ bg: viewMode === 'table' ? 'white' : 'bg.subtle' }}
    size="sm"
  >
    <HStack gap={2}>
      <Icon>
        <LuTable />
      </Icon>
      <Text>Table</Text>
    </HStack>
  </Button>
</HStack>
```

## Styling Details

### Container Styling

- **Border**: `borderWidth="1px"` with `borderColor="border"` for subtle definition
- **Shadow**: `shadow="md"` provides medium elevation for pop-out effect
- **Background**: `bg="bg.subtle"` for subtle background
- **Border Radius**: `borderRadius="md"` for rounded corners
- **Overflow**: `overflow="hidden"` ensures buttons respect container radius

### Button Styling

**Active State:**
- Background: `white` (stands out from container)
- Text color: `text.primary` (high contrast)

**Inactive State:**
- Background: `transparent` (blends with container)
- Text color: `text.secondary` (lower contrast)

**Hover State:**
- Active button: Maintains `white` background
- Inactive button: Changes to `bg.subtle` for feedback

**Divider:**
- Right border on first button: `borderRightWidth="1px"` with `borderRightColor="border.subtle"`
- Creates visual separation between buttons

## Usage Example

```tsx
import { useState } from 'react';
import { HStack, Button, Icon, Text } from '@chakra-ui/react';
import { LuLayoutGrid, LuTable } from 'react-icons/lu';

type ViewMode = 'card' | 'table';

export default function MyComponent() {
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  return (
    <>
      {/* View Mode Switcher */}
      <HStack 
        gap={0} 
        borderWidth="1px" 
        borderColor="border" 
        borderRadius="md" 
        overflow="hidden" 
        bg="bg.subtle" 
        shadow="md"
      >
        <Button
          onClick={() => setViewMode('card')}
          variant="ghost"
          borderRadius={0}
          borderRightWidth="1px"
          borderRightColor="border.subtle"
          bg={viewMode === 'card' ? 'white' : 'transparent'}
          color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
          _hover={{ bg: viewMode === 'card' ? 'white' : 'bg.subtle' }}
          size="sm"
        >
          <HStack gap={2}>
            <Icon>
              <LuLayoutGrid />
            </Icon>
            <Text>Cards</Text>
          </HStack>
        </Button>
        <Button
          onClick={() => setViewMode('table')}
          variant="ghost"
          borderRadius={0}
          bg={viewMode === 'table' ? 'white' : 'transparent'}
          color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
          _hover={{ bg: viewMode === 'table' ? 'white' : 'bg.subtle' }}
          size="sm"
        >
          <HStack gap={2}>
            <Icon>
              <LuTable />
            </Icon>
            <Text>Table</Text>
          </HStack>
        </Button>
      </HStack>

      {/* Conditional rendering based on view mode */}
      {viewMode === 'card' ? (
        <CardView />
      ) : (
        <TableView />
      )}
    </>
  );
}
```

## Design Decisions

### Why Shadow?

The `shadow="md"` property creates a subtle elevation effect that:
- Makes the switcher stand out from surrounding content
- Provides visual hierarchy
- Creates a modern, polished appearance
- Works well with the 1px border for definition

### Why 1px Border?

A 1px border provides:
- Subtle definition without being heavy
- Clean appearance that doesn't compete with content
- Good balance with the shadow effect
- Consistent with modern UI design patterns

### Why White Background for Active State?

The white background on the active button:
- Creates clear visual distinction
- Provides high contrast for readability
- Makes the active state immediately obvious
- Works well with the shadow for depth

## Customization Options

### Different Shadow Levels

```tsx
// Subtle shadow
shadow="sm"

// Medium shadow (default)
shadow="md"

// Prominent shadow
shadow="lg"
```

### Different Border Styles

```tsx
// Thicker border
borderWidth="2px"

// Colored border
borderColor="primary.500"

// No border (shadow only)
borderWidth="0"
```

### Additional View Modes

To add more view modes (e.g., list, grid):

```tsx
type ViewMode = 'card' | 'table' | 'list' | 'grid';

// Add additional buttons following the same pattern
<Button onClick={() => setViewMode('list')}>
  <HStack gap={2}>
    <Icon><LuList /></Icon>
    <Text>List</Text>
  </HStack>
</Button>
```

## Related Components

This switcher is used in:
- **KitsTabContent** (`src/components/kits/KitsTabContent.tsx`)
- **WalkthroughsTabContent** (`src/components/walkthroughs/WalkthroughsTabContent.tsx`)
- **DiagramsTabContent** (`src/components/diagrams/DiagramsTabContent.tsx`)

## Best Practices

1. **Consistent Placement**: Place the switcher near the content it controls
2. **Clear Labels**: Use descriptive text ("Cards", "Table") alongside icons
3. **State Management**: Use React state to track current view mode
4. **Accessibility**: Ensure keyboard navigation works (Chakra UI handles this)
5. **Visual Feedback**: Always provide clear active state indication
