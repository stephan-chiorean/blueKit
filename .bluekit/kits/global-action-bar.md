---
id: global-action-bar
alias: Global Action Bar
type: kit
is_base: false
version: 1
tags: []
description: ''
---

# Global Action Bar Component

## Overview

A context-aware action bar component that appears when items are selected, providing bulk operations like delete, add to collection, add to template, and add to project. The component uses Chakra UI's ActionBar component with Portal rendering for global positioning.

## Prerequisites

### 1. Selection Context

You need a selection context that manages selected items across your application:

```typescript
// SelectionContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

export type SelectionType = 'Kit' | 'Template' | 'Collection' | 'Project';

export interface SelectedItem {
  id: string;
  name: string;
  type: SelectionType;
  path?: string;
}

interface SelectionContextType {
  selectedItems: SelectedItem[];
  addItem: (item: SelectedItem) => void;
  removeItem: (id: string) => void;
  toggleItem: (item: SelectedItem) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  hasSelection: boolean;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  const addItem = (item: SelectedItem) => {
    setSelectedItems((prev) => {
      if (prev.some((i) => i.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleItem = (item: SelectedItem) => {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      return exists
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item];
    });
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const isSelected = (id: string) => {
    return selectedItems.some((item) => item.id === id);
  };

  const hasSelection = selectedItems.length > 0;

  return (
    <SelectionContext.Provider
      value={{
        selectedItems,
        addItem,
        removeItem,
        toggleItem,
        clearSelection,
        isSelected,
        hasSelection,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}
```

### 2. UI Library Setup

Ensure you have Chakra UI v3 installed and configured with ActionBar component support.

### 3. Icon Library

Install `react-icons` for icon support:
```bash
npm install react-icons
```

## Implementation Steps

### Step 1: Create the Component File

Create `GlobalActionBar.tsx` in your components directory.

### Step 2: Import Dependencies

```typescript
import {
  Button,
  HStack,
  Text,
  ActionBar,
  Portal,
} from '@chakra-ui/react';
import { LuTrash2, LuFolderPlus, LuFileText, LuLayers } from 'react-icons/lu';
import { useSelection } from '../contexts/SelectionContext';
```

**Key Imports:**
- `ActionBar` components from Chakra UI for the floating action bar
- `Portal` for rendering outside the normal DOM hierarchy
- `HStack` for horizontal button layouts
- Icons from `react-icons/lu` (Lucide icons)
- `useSelection` hook from your selection context

### Step 3: Component Structure

```typescript
export default function GlobalActionBar() {
  const { selectedItems, hasSelection, removeItem } = useSelection();

  const handleDelete = () => {
    selectedItems.forEach((item) => removeItem(item.id));
  };

  if (!hasSelection) {
    return null;
  }

  return (
    <ActionBar.Root 
      open={hasSelection} 
      closeOnInteractOutside={false}
      onOpenChange={(e) => {
        // Handle open/close state if needed
      }}
    >
      <Portal>
        <ActionBar.Positioner>
          <ActionBar.Content>
            {/* Action buttons here */}
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}
```

### Step 4: Implement Delete Action

```typescript
const handleDelete = () => {
  selectedItems.forEach((item) => removeItem(item.id));
};
```

Add the delete button:

```typescript
<Button 
  variant="surface" 
  colorPalette="red" 
  size="sm" 
  onClick={handleDelete}
>
  <HStack gap={2}>
    <LuTrash2 />
    <Text>Delete</Text>
  </HStack>
</Button>
```

### Step 5: Add Action Separator

```typescript
<ActionBar.Separator />
```

### Step 6: Add Additional Actions

Implement additional action buttons with consistent styling:

```typescript
<Button variant="outline" size="sm">
  <HStack gap={2}>
    <LuLayers />
    <Text>Add to Collection</Text>
  </HStack>
</Button>

<Button variant="outline" size="sm">
  <HStack gap={2}>
    <LuFileText />
    <Text>Add to Template</Text>
  </HStack>
</Button>

<Button variant="outline" size="sm">
  <HStack gap={2}>
    <LuFolderPlus />
    <Text>Add to Project</Text>
  </HStack>
</Button>
```

### Step 7: Complete Implementation

```typescript
import {
  Button,
  HStack,
  Text,
  ActionBar,
  Portal,
} from '@chakra-ui/react';
import { LuTrash2, LuFolderPlus, LuFileText, LuLayers } from 'react-icons/lu';
import { useSelection } from '../contexts/SelectionContext';

export default function GlobalActionBar() {
  const { selectedItems, hasSelection, removeItem } = useSelection();

  const handleDelete = () => {
    selectedItems.forEach((item) => removeItem(item.id));
  };

  if (!hasSelection) {
    return null;
  }

  return (
    <ActionBar.Root 
      open={hasSelection} 
      closeOnInteractOutside={false}
      onOpenChange={(e) => {
        // Only clear selection if explicitly closed (not from clicking outside)
        // We'll handle clearing via explicit actions instead
      }}
    >
      <Portal>
        <ActionBar.Positioner>
          <ActionBar.Content>
            <Button variant="surface" colorPalette="red" size="sm" onClick={handleDelete}>
              <HStack gap={2}>
                <LuTrash2 />
                <Text>Delete</Text>
              </HStack>
            </Button>
            <ActionBar.Separator />
            <Button variant="outline" size="sm">
              <HStack gap={2}>
                <LuLayers />
                <Text>Add to Collection</Text>
              </HStack>
            </Button>
            <Button variant="outline" size="sm">
              <HStack gap={2}>
                <LuFileText />
                <Text>Add to Template</Text>
              </HStack>
            </Button>
            <Button variant="outline" size="sm">
              <HStack gap={2}>
                <LuFolderPlus />
                <Text>Add to Project</Text>
              </HStack>
            </Button>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}
```

## Integration

### Add to App Root

Import and render the component at the root level, inside your `SelectionProvider`:

```typescript
import GlobalActionBar from './components/GlobalActionBar';
import { SelectionProvider } from './contexts/SelectionContext';

function App() {
  return (
    <SelectionProvider>
      {/* Your app content */}
      <GlobalActionBar />
    </SelectionProvider>
  );
}
```

## Key Concepts

### 1. Conditional Rendering

The component returns `null` when there's no selection, preventing unnecessary DOM elements:

```typescript
if (!hasSelection) {
  return null;
}
```

### 2. Portal Rendering

Using `Portal` ensures the action bar renders outside the normal DOM hierarchy, allowing it to appear above other content and be positioned globally.

### 3. ActionBar Component Structure

- `ActionBar.Root`: Main container with open/close state
- `ActionBar.Positioner`: Handles positioning logic
- `ActionBar.Content`: The actual content container
- `ActionBar.Separator`: Visual separator between button groups

### 4. Selection Management

The component reads from the selection context but doesn't manage it directly. Selection is managed by the context provider, allowing multiple components to interact with the same selection state.

### 5. Bulk Operations

The delete handler iterates over all selected items, performing the operation on each:

```typescript
selectedItems.forEach((item) => removeItem(item.id));
```

## Customization Options

### Custom Actions

Add custom action handlers by creating handler functions and connecting them to buttons:

```typescript
const handleAddToCollection = () => {
  // Your logic here
  selectedItems.forEach((item) => {
    // Process each selected item
  });
};
```

### Styling

Modify button variants, sizes, and color palettes:
- `variant`: "surface", "outline", "solid", etc.
- `colorPalette`: "red", "blue", "gray", etc.
- `size`: "sm", "md", "lg"

### Icons

Replace icons by importing different icons from `react-icons`:
- `react-icons/lu` - Lucide icons
- `react-icons/fa` - Font Awesome
- `react-icons/md` - Material Design

## Best Practices

1. **Keep actions focused**: Only include actions that make sense for bulk operations
2. **Provide visual feedback**: Use appropriate button variants (e.g., red for destructive actions)
3. **Handle edge cases**: Check for empty selections before rendering
4. **Use Portal for global UI**: Ensures the action bar appears above all content
5. **Maintain separation of concerns**: Let the context manage state, component handles presentation

## Testing Considerations

- Test that the component doesn't render when `hasSelection` is false
- Verify delete action removes all selected items
- Ensure the action bar appears when items are selected
- Test that clicking outside doesn't interfere with selection (due to `closeOnInteractOutside={false}`)

## Related Components

- SelectionContext: Manages the selection state
- Items that can be selected (Kits, Templates, Collections, Projects)
- Other components that use `useSelection` hook
