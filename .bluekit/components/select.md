# Select Component Design Pattern

This document captures the menu-based select component design pattern used throughout the application. This style should be the default for all select components, replacing native select dropdowns.

## Visual Design

The select component uses Chakra UI's `Menu.Root`, `Menu.Trigger`, `Menu.Positioner`, `Menu.Content`, and `Menu.Item` components to create a polished dropdown selection interface.

## Implementation Pattern

### Basic Structure

```tsx
import { Menu, Button, HStack, Text, Icon } from '@chakra-ui/react';
import { LuCheck } from 'react-icons/lu';

<Menu.Root>
  <Menu.Trigger asChild>
    <Button variant="outline" w="100%" justifyContent="space-between">
      <Text>{selectedValue || 'Select option...'}</Text>
    </Button>
  </Menu.Trigger>
  <Menu.Positioner>
    <Menu.Content>
      <Menu.Item value="option1" onSelect={() => setSelectedValue('option1')}>
        <HStack gap={2} justify="space-between" width="100%">
          <Text>Option 1</Text>
          {selectedValue === 'option1' && <LuCheck />}
        </HStack>
      </Menu.Item>
      <Menu.Item value="option2" onSelect={() => setSelectedValue('option2')}>
        <HStack gap={2} justify="space-between" width="100%">
          <Text>Option 2</Text>
          {selectedValue === 'option2' && <LuCheck />}
        </HStack>
      </Menu.Item>
    </Menu.Content>
  </Menu.Positioner>
</Menu.Root>
```

## Key Design Features

### 1. Menu Structure
- `Menu.Root` - Container for the menu
- `Menu.Trigger` - The clickable element that opens the menu
- `Menu.Positioner` - Handles positioning of the dropdown
- `Menu.Content` - The dropdown container
- `Menu.Item` - Individual selectable options

### 2. Menu Trigger
- Use `asChild` prop on `Menu.Trigger` to properly wrap the trigger element
- Can use `Button` with `variant="outline"` for form fields
- Can use `IconButton` with `variant="ghost"` for compact icon triggers
- Set `w="100%"` for full-width form fields
- Use `justifyContent="space-between"` to show selected value and indicate dropdown

### 3. Menu Items
- Each `Menu.Item` has a `value` prop for semantic meaning
- Use `onSelect` handler (not `onClick`) for selection logic
- `onSelect` receives no parameters - use closure to access state setter

### 4. Selected State Indicator
- Use `HStack` with `gap={2}` and `justify="space-between"` for layout
- `width="100%"` ensures proper spacing
- Show `LuCheck` icon when item is selected
- Conditional rendering: `{selectedValue === 'optionX' && <LuCheck />}`

### 5. Icons in Menu Items
- Icons can be included in menu items for visual distinction
- Place icons in an `HStack` with the text label
- Icons should appear on the left side of the text

### 6. Portal Usage
- **Important**: When inside a Dialog Portal, do NOT wrap `Menu.Positioner` in another `Portal`
- The Menu will automatically handle portal rendering when needed
- Only use `Portal` explicitly if you need custom portal behavior

## Examples

### Form Field Select (Inside Dialog)

```tsx
// From src/components/tasks/TaskCreateDialog.tsx

<Field.Root required>
  <Field.Label>Priority</Field.Label>
  <Menu.Root>
    <Menu.Trigger asChild>
      <Button variant="outline" w="100%" justifyContent="space-between">
        <HStack gap={2}>
          {priority === 'pinned' && (
            <Icon color="blue.500">
              <LuPin />
            </Icon>
          )}
          <Text>
            {priority === 'pinned' && 'Pinned (appears at top)'}
            {priority === 'high' && 'High'}
            {priority === 'standard' && 'Standard'}
            {priority === 'long term' && 'Long Term'}
            {priority === 'nit' && 'Nit'}
          </Text>
        </HStack>
      </Button>
    </Menu.Trigger>
    <Menu.Positioner>
      <Menu.Content>
        <Menu.Item value="pinned" onSelect={() => setPriority('pinned')}>
          <HStack gap={2} justify="space-between" width="100%">
            <HStack gap={2}>
              <Icon color="blue.500">
                <LuPin />
              </Icon>
              <Text>Pinned (appears at top)</Text>
            </HStack>
            {priority === 'pinned' && <LuCheck />}
          </HStack>
        </Menu.Item>
        <Menu.Item value="high" onSelect={() => setPriority('high')}>
          <HStack gap={2} justify="space-between" width="100%">
            <HStack gap={2}>
              <Icon color="red.500">
                <LuArrowUp />
              </Icon>
              <Text>High</Text>
            </HStack>
            {priority === 'high' && <LuCheck />}
          </HStack>
        </Menu.Item>
        {/* More items... */}
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
</Field.Root>
```

### Icon Button Select (Compact)

```tsx
// For compact icon-triggered selects

<Menu.Root>
  <Menu.Trigger asChild>
    <IconButton variant="ghost" size="sm" aria-label="Select option">
      <LuPalette />
    </IconButton>
  </Menu.Trigger>
  <Menu.Positioner>
    <Menu.Content>
      <Menu.Item value="option1" onSelect={() => handleSelect('option1')}>
        <HStack gap={2} justify="space-between" width="100%">
          <Text>Option 1</Text>
          {selectedValue === 'option1' && <LuCheck />}
        </HStack>
      </Menu.Item>
    </Menu.Content>
  </Menu.Positioner>
</Menu.Root>
```

## Usage Guidelines

### When to Use This Pattern

Use this select menu pattern when:
- You have 2-8 options to choose from
- You want to show the currently selected value
- You need a form field select (replaces NativeSelect)
- You need a compact, icon-triggered selector
- Selection is not the primary action on the page

### When NOT to Use This Pattern

- For large lists (10+ items), consider using a Combobox with search
- For multi-select, use TagsInput or Checkbox groups
- For simple boolean toggles, use Switch or Checkbox

### Customization Options

**Trigger Variations:**
- `Button` with `variant="outline"` - Form field selects (most common)
- `IconButton` with `variant="ghost"` - Compact icon triggers
- Custom elements via `asChild` prop

**Menu Item Variations:**
- Text only
- Icon + Text
- Icon + Text + Checkmark (selected state)

**Important Notes:**
- Always use `onSelect` (not `onClick`) for Menu.Item
- When inside a Dialog Portal, do NOT wrap Menu.Positioner in Portal
- Menu items can include icons for visual distinction
- Use conditional rendering to show selected state with checkmark

## Accessibility

- Always include `aria-label` on the trigger button
- Use semantic `value` props on menu items
- Ensure keyboard navigation works (provided by Chakra UI)
- Check icon provides visual confirmation of selection

## Common Patterns

### Simple Text Select

```tsx
<Menu.Root>
  <Menu.Trigger asChild>
    <Button variant="outline" w="100%">
      <Text>{status || 'Select status...'}</Text>
    </Button>
  </Menu.Trigger>
  <Menu.Positioner>
    <Menu.Content>
      <Menu.Item value="backlog" onSelect={() => setStatus('backlog')}>
        <HStack gap={2} justify="space-between" width="100%">
          <Text>Backlog</Text>
          {status === 'backlog' && <LuCheck />}
        </HStack>
      </Menu.Item>
      <Menu.Item value="in_progress" onSelect={() => setStatus('in_progress')}>
        <HStack gap={2} justify="space-between" width="100%">
          <Text>In Progress</Text>
          {status === 'in_progress' && <LuCheck />}
        </HStack>
      </Menu.Item>
    </Menu.Content>
  </Menu.Positioner>
</Menu.Root>
```

### Select with Icons

```tsx
<Menu.Root>
  <Menu.Trigger asChild>
    <Button variant="outline" w="100%" justifyContent="space-between">
      <HStack gap={2}>
        {priority === 'high' && (
          <Icon color="red.500">
            <LuArrowUp />
          </Icon>
        )}
        <Text>{getPriorityLabel(priority)}</Text>
      </HStack>
    </Button>
  </Menu.Trigger>
  <Menu.Positioner>
    <Menu.Content>
      <Menu.Item value="high" onSelect={() => setPriority('high')}>
        <HStack gap={2} justify="space-between" width="100%">
          <HStack gap={2}>
            <Icon color="red.500">
              <LuArrowUp />
            </Icon>
            <Text>High</Text>
          </HStack>
          {priority === 'high' && <LuCheck />}
        </HStack>
      </Menu.Item>
    </Menu.Content>
  </Menu.Positioner>
</Menu.Root>
```

## Related Components

- `src/components/tasks/TaskCreateDialog.tsx` - Form field selects with icons
- `src/components/tasks/TaskDialog.tsx` - Edit form selects
- Chakra UI Menu components documentation
