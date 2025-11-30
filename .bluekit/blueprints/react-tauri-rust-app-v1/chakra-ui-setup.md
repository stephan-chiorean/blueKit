---
id: chakra-ui-setup
type: task
version: 1
---

# Chakra UI Setup

Configure Chakra UI theme, provider, and integrate with React application.

## Requirements

- Completed "Context Providers" task
- Chakra UI dependencies installed

## Steps

### 1. Create Theme Configuration

Create `src/theme.ts`:

```typescript
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        // Add custom colors here
      },
    },
  },
});

export const theme = createSystem(defaultConfig, customConfig);
```

### 2. Wrap App with ChakraProvider

Update `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import App from './App';
import { theme } from './theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider value={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
);
```

### 3. Use Chakra Components

Example component using Chakra UI:

```typescript
import { Box, Button, Card, CardBody, Heading, VStack } from '@chakra-ui/react';

export default function MyComponent() {
  return (
    <Box p={4}>
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <Heading>My Component</Heading>
            <Button>Click Me</Button>
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
}
```

## Chakra UI v3 Features

1. **System API**: Uses new system-based API
2. **Tokens**: Theme tokens for colors, spacing, etc.
3. **Components**: Modern component library
4. **Styling**: CSS-in-JS with emotion

## Common Components

- `Box`, `Flex`, `Stack` - Layout components
- `Button`, `Input`, `Textarea` - Form components
- `Card`, `Modal`, `Dialog` - Container components
- `Heading`, `Text` - Typography components

## Verification

- Chakra components should render correctly
- Theme should apply consistently
- No console errors related to Chakra

## Next Steps

After completing this task, proceed to "Component Structure" task.