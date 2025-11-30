---
id: error-handling
type: task
version: 1
---

# Error Handling

Implement comprehensive error handling and user feedback throughout the application.

## Requirements

- Completed "Frontend-Backend Integration" task
- Toast/notification system available

## Steps

### 1. Create Error Boundary Component

Create `src/components/ErrorBoundary.tsx`:

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Heading, Text, Button } from '@chakra-ui/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box p={8}>
          <Heading>Something went wrong</Heading>
          <Text>{this.state.error?.message}</Text>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
```

### 2. Create Toast Utility

Create `src/utils/toast.ts`:

```typescript
import { toast } from '@chakra-ui/react';

export function showError(message: string) {
  toast.error({
    title: 'Error',
    description: message,
    duration: 5000,
  });
}

export function showSuccess(message: string) {
  toast.success({
    title: 'Success',
    description: message,
    duration: 3000,
  });
}

export function showInfo(message: string) {
  toast.info({
    title: 'Info',
    description: message,
    duration: 3000,
  });
}
```

### 3. Add Error Handling to Hooks

Update `useProjectKits.ts`:

```typescript
import { showError } from '../utils/toast';

export function useProjectKits(projectPath: string | null) {
  // ... existing code

  useEffect(() => {
    // ... existing fetch logic
    try {
      const result = await invokeGetMarkdownFiles(projectPath);
      setKits(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch kits';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  // ... rest of hook
}
```

### 4. Wrap App with Error Boundary

Update `src/main.tsx`:

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ChakraProvider value={theme}>
        <App />
      </ChakraProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

### 5. Add Error Handling to IPC Wrappers

Update `src/ipc.ts` with better error handling:

```typescript
export async function invokeReadFile(filePath: string): Promise<string> {
  try {
    return await invoke<string>('read_file', { filePath });
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

## Error Handling Strategies

1. **Error Boundaries**: Catch React component errors
2. **Try/Catch**: Handle async operation errors
3. **Toast Notifications**: Show user-friendly error messages
4. **Fallback UI**: Display fallback content on errors
5. **Error Logging**: Log errors for debugging

## Best Practices

1. **User-Friendly Messages**: Translate technical errors to user-friendly messages
2. **Error Recovery**: Provide ways to recover from errors
3. **Error Logging**: Log errors for debugging while showing friendly messages
4. **Graceful Degradation**: App should continue working when possible

## Verification

- Errors should be caught and displayed appropriately
- User-friendly messages should be shown
- App should not crash on errors
- Error boundaries should catch component errors

## Completion

Congratulations! You have completed the React/Tauri/Rust app blueprint. Your application should now have:

- ✅ Complete project setup
- ✅ Backend Rust modules and IPC commands
- ✅ Type-safe TypeScript IPC wrappers
- ✅ File system operations and watching
- ✅ React frontend with routing
- ✅ Context providers for state management
- ✅ Chakra UI components
- ✅ Frontend-backend integration
- ✅ Comprehensive error handling

You can now extend the application with additional features as needed!