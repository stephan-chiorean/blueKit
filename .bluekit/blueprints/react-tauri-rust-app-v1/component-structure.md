---
id: component-structure
type: task
version: 1
---

# Component Structure

Build reusable UI components following the project's component patterns and organization.

## Requirements

- Completed "Chakra UI Setup" task
- Understanding of React component patterns

## Steps

### 1. Create Reusable Placeholder Component

Create `src/components/Placeholder.tsx`:

```typescript
interface PlaceholderProps {
  message: string;
  subtitle?: string;
}

export default function Placeholder({ message, subtitle }: PlaceholderProps) {
  return (
    <div>
      <p><strong>Placeholder:</strong> {message}</p>
      {subtitle && <p><em>{subtitle}</em></p>}
    </div>
  );
}
```

### 2. Create Tab Content Component Pattern

Create `src/components/TabContent.tsx`:

```typescript
import { Box, EmptyState, Heading } from '@chakra-ui/react';

interface TabContentProps {
  title: string;
  isEmpty: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export default function TabContent({
  title,
  isEmpty,
  emptyMessage = 'No items found',
  children,
}: TabContentProps) {
  return (
    <Box p={4}>
      <Heading mb={4}>{title}</Heading>
      {isEmpty ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Title>{emptyMessage}</EmptyState.Title>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        children
      )}
    </Box>
  );
}
```

### 3. Create Card List Component

Create `src/components/CardList.tsx`:

```typescript
import { SimpleGrid, Card, CardBody, CardHeader, Heading, Text } from '@chakra-ui/react';

interface CardItem {
  id: string;
  title: string;
  description: string;
}

interface CardListProps {
  items: CardItem[];
  onItemClick?: (item: CardItem) => void;
}

export default function CardList({ items, onItemClick }: CardListProps) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
      {items.map((item) => (
        <Card
          key={item.id}
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={() => onItemClick?.(item)}
        >
          <CardHeader>
            <Heading size="md">{item.title}</Heading>
          </CardHeader>
          <CardBody>
            <Text>{item.description}</Text>
          </CardBody>
        </Card>
      ))}
    </SimpleGrid>
  );
}
```

### 4. Organize Components by Feature

Create component directories:

```
src/components/
├── kits/
│   └── KitsTabContent.tsx
├── walkthroughs/
│   └── WalkthroughsTabContent.tsx
├── blueprints/
│   └── BlueprintsTabContent.tsx
└── shared/
    ├── Placeholder.tsx
    ├── TabContent.tsx
    └── CardList.tsx
```

## Component Patterns

1. **Props Interface**: Always define TypeScript interfaces for props
2. **Default Props**: Use default parameters for optional props
3. **Composition**: Build complex components from simple ones
4. **Reusability**: Extract common patterns into reusable components

## Best Practices

1. **Single Responsibility**: Each component should do one thing well
2. **Type Safety**: Use TypeScript for all props and state
3. **Documentation**: Add JSDoc comments for complex components
4. **Testing**: Structure components for easy testing

## Verification

- Components should render without errors
- Props should be type-checked
- Components should be reusable across pages

## Next Steps

After completing this task, proceed to "Frontend-Backend Integration" task.