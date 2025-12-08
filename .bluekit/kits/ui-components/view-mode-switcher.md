---
id: view-mode-switcher
alias: View Mode Switcher
type: kit
is_base: false
version: 2
tags: [ui-component, switcher, view-mode, cards, table]
description: 'Reusable cards/table view mode switcher component with shadow-only styling for elevated appearance'
---

# View Mode Switcher Component

## Overview

A reusable view mode switcher component that allows users to toggle between card and table views. The component features a subtle shadow effect that makes it appear elevated and more noticeable, with smooth transitions.

## Features

- **Dual View Modes**: Toggle between card and table views
- **Visual Feedback**: Active state styling with background color change
- **Elevated Appearance**: Subtle shadow (`shadow="sm"`) for depth without borders
- **Shadow-Only Design**: Clean appearance relying solely on shadow for definition
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
  borderRadius="md" 
  overflow="hidden" 
  bg="bg.subtle" 
  shadow="sm"
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

- **Shadow**: `shadow="sm"` provides subtle elevation for pop-out effect
- **Background**: `bg="bg.subtle"` for subtle background
- **Border Radius**: `borderRadius="md"` for rounded corners
- **Overflow**: `overflow="hidden"` ensures buttons respect container radius
- **No Border**: Clean shadow-only design for a softer appearance

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
        borderRadius="md" 
        overflow="hidden" 
        bg="bg.subtle" 
        shadow="sm"
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

### Why Shadow-Only Design?

The `shadow="sm"` property creates a subtle elevation effect that:
- Makes the switcher stand out from surrounding content
- Provides visual hierarchy without harsh borders
- Creates a modern, polished appearance
- Gives a softer, more elegant look than bordered designs

### Why No Border?

Removing the border:
- Creates a cleaner, more minimal appearance
- Lets the shadow provide all the visual definition
- Reduces visual noise and competition with content
- Results in a softer, more modern aesthetic

### Why White Background for Active State?

The white background on the active button:
- Creates clear visual distinction
- Provides high contrast for readability
- Makes the active state immediately obvious
- Works well with the shadow for depth

## Customization Options

### Different Shadow Levels

```tsx
// Subtle shadow (default)
shadow="sm"

// Medium shadow
shadow="md"

// Prominent shadow
shadow="lg"
```

### Adding a Border (Optional)

If you want to add a border for more definition:

```tsx
// Thin border
borderWidth="1px"
borderColor="border"

// Thicker border
borderWidth="2px"
borderColor="border"

// Colored border
borderWidth="1px"
borderColor="primary.500"
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

