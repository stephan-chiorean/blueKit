---
id: frontend-backend-integration
type: task
version: 1
---

# Frontend-Backend Integration

Connect frontend components to backend IPC commands, implementing data fetching, state management, and real-time updates.

## Requirements

- Completed "Component Structure" task
- All IPC commands and wrappers implemented
- Context providers set up

## Steps

### 1. Create Data Fetching Hook

Create `src/hooks/useProjectKits.ts`:

```typescript
import { useState, useEffect } from 'react';
import { invokeGetMarkdownFiles, KitFile } from '../ipc';

export function useProjectKits(projectPath: string | null) {
  const [kits, setKits] = useState<KitFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath) {
      setKits([]);
      return;
    }

    async function fetchKits() {
      setLoading(true);
      setError(null);
      try {
        const result = await invokeGetMarkdownFiles(projectPath);
        setKits(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch kits');
      } finally {
        setLoading(false);
      }
    }

    fetchKits();
  }, [projectPath]);

  return { kits, loading, error, refetch: () => fetchKits() };
}
```

### 2. Integrate with Component

Update a component to use the hook:

```typescript
import { useProjectKits } from '../hooks/useProjectKits';
import CardList from '../components/CardList';

function KitsTabContent({ projectPath }: { projectPath: string }) {
  const { kits, loading, error } = useProjectKits(projectPath);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <CardList
      items={kits.map(kit => ({
        id: kit.path,
        title: kit.name,
        description: kit.path,
      }))}
    />
  );
}
```

### 3. Set Up File Watcher Integration

Create `src/hooks/useFileWatcher.ts`:

```typescript
import { useEffect } from 'react';
import { invokeWatchProject, setupFileWatcher } from '../ipc';

export function useFileWatcher(
  projectPath: string | null,
  onFileChange: () => void
) {
  useEffect(() => {
    if (!projectPath) return;

    // Start watching
    invokeWatchProject(projectPath).catch(console.error);

    // Listen for changes
    setupFileWatcher(projectPath, onFileChange).catch(console.error);
  }, [projectPath, onFileChange]);
}
```

### 4. Combine in Component

```typescript
function KitsTabContent({ projectPath }: { projectPath: string }) {
  const { kits, loading, error, refetch } = useProjectKits(projectPath);

  // Auto-refetch when files change
  useFileWatcher(projectPath, () => {
    refetch();
  });

  // ... rest of component
}
```

## Integration Patterns

1. **Custom Hooks**: Encapsulate data fetching logic
2. **Error Handling**: Always handle errors gracefully
3. **Loading States**: Show loading indicators during async operations
4. **Real-time Updates**: Use file watchers for live updates

## Best Practices

1. **Separation of Concerns**: Keep data fetching separate from UI
2. **Error Boundaries**: Implement error boundaries for error handling
3. **Optimistic Updates**: Update UI optimistically when possible
4. **Caching**: Consider caching strategies for frequently accessed data

## Verification

- Components should fetch and display data correctly
- File changes should trigger UI updates
- Errors should be handled gracefully
- Loading states should display appropriately

## Next Steps

After completing this task, proceed to "Error Handling" task.