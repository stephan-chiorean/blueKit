---
id: realtime-file-watching
alias: Real-Time File Watching
type: kit
is_base: false
version: 1
tags:
  - tauri
  - file-watching
  - react
description: Pattern for automatically reloading React component content when files change on disk, using Tauri event listeners.
---
## End State

After applying this kit, the application will have:

### File Watcher Event Subscription
- React components that display file content (markdown, config, etc.) automatically reload when those files change on disk
- Components subscribe to Tauri events emitted by backend file watchers
- Content updates happen without full page reload or manual refresh

### Edit Mode Protection
- When users are actively editing content, file change events are ignored to prevent disrupting their work
- The watcher re-enables automatically when exiting edit mode

### Event Flow
```
┌─────────────────┐     ┌────────────────┐     ┌──────────────────┐
│  Backend File   │────▶│  Tauri Event   │────▶│  React useEffect │
│    Watcher      │     │    Emission    │     │    Listener      │
└─────────────────┘     └────────────────┘     └──────────────────┘
                                                       │
                                                       ▼
                                               ┌──────────────────┐
                                               │  Content Reload  │
                                               │  (if not editing)│
                                               └──────────────────┘
```

## Implementation Principles

### Event Listener Pattern
```typescript
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
    if (!eventName || !currentFilePath) return;
    if (isEditMode) return; // Don't reload during edits
    
    let isMounted = true;
    
    const setupListener = async () => {
        const unlisten = await listen<string[]>(eventName, async (event) => {
            if (!isMounted) return;
            
            const changedPaths = event.payload;
            const currentFileChanged = changedPaths.some(
                path => path === currentFilePath
            );
            
            if (currentFileChanged) {
                const newContent = await readFile(currentFilePath);
                if (isMounted) {
                    setContent(newContent);
                }
            }
        });
        return unlisten;
    };
    
    const unlistenPromise = setupListener();
    
    return () => {
        isMounted = false;
        unlistenPromise.then(unlisten => unlisten?.());
    };
}, [eventName, currentFilePath, isEditMode]);
```

### Key Considerations
- **Capture values in closure**: Store values like `currentFilePath` in local variables before the async callback to avoid stale references
- **Mount tracking**: Use `isMounted` flag to prevent state updates after unmount
- **Dependency array**: Include `isEditMode` so the effect re-runs when edit mode changes
- **Cleanup**: Always return a cleanup function that stops listening

### Backend Event Naming Convention
Events should follow a predictable pattern:
- `{resource-type}-changed-{resource-id}` (e.g., `plan-documents-changed-abc123`)

## Verification Criteria

After generation, verify:
- ✓ Component content updates when file is modified externally
- ✓ No content reload occurs while in edit mode
- ✓ Listener is properly cleaned up on unmount
- ✓ No memory leaks or stale state updates
- ✓ Event subscription only happens when necessary props are available

## Interface Contracts

**Requires:**
- Tauri backend with file watcher emitting events with changed file paths as payload
- `@tauri-apps/api/event` for the `listen` function
- IPC function to read file content (e.g., `invokeReadFile`)

**Provides:**
- Pattern for real-time content synchronization in React components
- Edit mode protection to prevent disrupting user work

**Compatible With:**
- Any Tauri file watcher implementation
- Markdown viewers, code editors, config panels
- Components with editable content modes
