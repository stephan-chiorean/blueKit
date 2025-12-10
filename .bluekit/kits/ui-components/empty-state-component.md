---
id: empty-state-component
alias: Empty State Component
type: kit
is_base: false
version: 1
tags: []
description: ''
---

# Empty State Component

A reusable empty state component pattern using Chakra UI's EmptyState component. This pattern is used throughout the application to display helpful messages when lists or content areas are empty.

## Pattern Overview

The empty state component provides a consistent way to communicate to users when there's no content to display, with optional actions to help users get started.

## Component Structure

```tsx
<EmptyState.Root>
  <EmptyState.Content>
    <EmptyState.Indicator>
      <Icon size={ICON_SIZE} color={ICON_COLOR}>
        {ICON_COMPONENT}
      </Icon>
    </EmptyState.Indicator>
    <EmptyState.Title>
      {TITLE_CONTENT}
    </EmptyState.Title>
    {DESCRIPTION && (
      <EmptyState.Description>
        {DESCRIPTION_TEXT}
      </EmptyState.Description>
    )}
    {ACTION_BUTTON && (
      <Button
        colorPalette="primary"
        onClick={ACTION_HANDLER}
        mt={4}
      >
        {BUTTON_CONTENT}
      </Button>
    )}
  </EmptyState.Content>
</EmptyState.Root>
```

## Required Imports

```tsx
import {
  EmptyState,
  Icon,
  Button,
  HStack,
  Text,
  Highlight,
  Box,
} from '@chakra-ui/react';
import { ICON_IMPORT } from 'react-icons/lu'; // or other icon library
```

## Tokens

### Required Tokens
- `ICON_COMPONENT` - The icon component to display (e.g., `LuLibrary`, `LuBot`, `LuFolder`)
- `TITLE_TEXT` - The main title text for the empty state

### Optional Tokens
- `DESCRIPTION_TEXT` - Additional descriptive text explaining the empty state
- `ICON_SIZE` - Size of the icon (default: `"xl"` or `boxSize={12}`)
- `ICON_COLOR` - Color of the icon (default: `"primary.500"` or `"text.tertiary"`)
- `ACTION_BUTTON_TEXT` - Text for the action button
- `ACTION_BUTTON_ICON` - Icon component for the action button
- `ACTION_HANDLER` - Function to call when action button is clicked
- `HIGHLIGHT_QUERY` - Array of strings to highlight in the title (optional)
- `HIGHLIGHT_STYLES` - Styles object for highlighted text (optional)
- `WRAP_IN_BOX` - Boolean to wrap in Box with textAlign and padding (default: false)

## Usage Examples

### Basic Empty State (Title + Description)

```tsx
import { EmptyState, Icon } from '@chakra-ui/react';
import { LuBot } from 'react-icons/lu';

if (items.length === 0) {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="primary.500">
            <LuBot />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>No items found</EmptyState.Title>
        <EmptyState.Description>
          Items will appear here once they are created.
        </EmptyState.Description>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
```

### Empty State with Action Button

```tsx
import { EmptyState, Icon, Button, HStack, Text } from '@chakra-ui/react';
import { LuLibrary, LuPlus } from 'react-icons/lu';

if (collections.length === 0) {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="primary.500">
            <LuLibrary />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>No collections found</EmptyState.Title>
        <EmptyState.Description>
          Create your first collection to get started.
        </EmptyState.Description>
        <Button
          colorPalette="primary"
          onClick={handleCreate}
          mt={4}
        >
          <HStack gap={2}>
            <LuPlus />
            <Text>Add Collection</Text>
          </HStack>
        </Button>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
```

### Empty State with Highlighted Title

```tsx
import { EmptyState, Icon, Highlight } from '@chakra-ui/react';
import { LuLibrary } from 'react-icons/lu';

if (collections.length === 0) {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="primary.500">
            <LuLibrary />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>
          <Highlight
            query={['kits', 'templates', 'resources']}
            styles={{
              px: '1',
              py: '0.5',
              bg: 'primary.100',
              color: 'primary.700',
              borderRadius: 'sm',
            }}
          >
            Save and organize your kits, templates, and resources into collections
          </Highlight>
        </EmptyState.Title>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
```

### Empty State Wrapped in Box (Centered)

```tsx
import { EmptyState, Icon, Box } from '@chakra-ui/react';
import { LuFolder } from 'react-icons/lu';

if (projects.length === 0) {
  return (
    <Box textAlign="center" py={12}>
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon boxSize={12} color="text.tertiary">
              <LuFolder />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>No projects found</EmptyState.Title>
          <EmptyState.Description>
            Projects are managed via CLI and will appear here automatically when linked.
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    </Box>
  );
}
```

## Implementation Steps

1. **Import required components** from `@chakra-ui/react` and icon library
2. **Check the condition** that triggers the empty state (e.g., `items.length === 0`)
3. **Render EmptyState.Root** as the container
4. **Add EmptyState.Content** wrapper
5. **Add EmptyState.Indicator** with Icon component
6. **Add EmptyState.Title** with your title text (optionally with Highlight)
7. **Optionally add EmptyState.Description** for additional context
8. **Optionally add Button** with action handler
9. **Optionally wrap in Box** for centering and padding

## Design Guidelines

- Use `primary.500` for icons when you want to draw attention
- Use `text.tertiary` for icons when you want a more subtle appearance
- Icon size `xl` is standard, but `boxSize={12}` can be used for consistency
- Action buttons should use `colorPalette="primary"` and `mt={4}` for spacing
- When using Highlight, maintain consistent styling with primary color palette
- Wrap in Box with `textAlign="center"` and `py={12}` when you want centered, padded layout

## Common Icon Choices

- `LuLibrary` - For collections/libraries
- `LuBot` - For agents
- `LuFolder` - For projects/folders
- `LuPackage` - For blueprints/packages
- `LuPlus` - For action buttons (add/create actions)

## Notes

- The EmptyState component is part of Chakra UI v3
- This pattern is used consistently across all tab content components
- Always provide helpful, actionable messaging in the title and description
- Include action buttons when there's a clear next step for the user