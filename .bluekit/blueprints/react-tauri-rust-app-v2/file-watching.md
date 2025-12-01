---
id: file-watching
type: task
version: 1
blueprint: react-tauri-rust-app-v2
blueprint_name: React + Tauri + Rust Desktop App
layer: 5
layer_name: File Watching
---

# Task: File Watching

## Blueprint Context

**Blueprint Goal:** Build a fully functional React/Tauri/Rust desktop application with type-safe IPC, Chakra UI v3, file operations, and real-time file watching

**This Task:** File system watching implementation with notify crate, Tauri event emission, and directory monitoring (Layer 5/6, Task 1/1)

**Task Position:** Fifth layer - builds on backend foundation (Layer 2) and IPC system (Layer 4)

## Execution Instructions

When implementing this task:
1. Read all steps before making changes
2. Execute steps sequentially and completely
3. Run verification commands to ensure success
4. Report errors immediately
5. Only proceed after verification passes

## Requirements

- Backend foundation completed (Layer 2) - watcher.rs module exists
- IPC system completed (Layer 4) - watch_project_kits command available
- Understanding of Tauri events and file system watching

## Steps

### 1. Verify Backend File Watching

The file watching functionality should already be implemented in `src-tauri/src/watcher.rs` from Layer 2. Verify:

- `watch_file()` function exists
- `watch_directory()` function exists
- `get_registry_path()` function exists
- Functions use `notify` crate correctly
- Functions emit Tauri events properly

### 2. Verify Command Registration

Ensure file watching commands are registered in `src-tauri/src/main.rs` and setup function initializes watchers.

### 3. Implement Frontend Event Listeners

Create utility functions or hooks for listening to Tauri events:

```typescript
import { listen } from '@tauri-apps/api/event';

/**
 * Sets up a listener for project registry changes.
 */
export async function listenToRegistryChanges(
  callback: () => void
): Promise<() => void> {
  const unlisten = await listen('project-registry-changed', () => {
    callback();
  });
  return unlisten;
}

/**
 * Sets up a listener for project kit changes.
 */
export async function listenToProjectKitChanges(
  projectPath: string,
  callback: () => void
): Promise<() => void> {
  // Generate event name based on project path (matching backend logic)
  const sanitizedPath = projectPath
    .replace(/[\/\\:.\\s]/g, '_');
  const eventName = `project-kits-changed-${sanitizedPath}`;
  
  const unlisten = await listen(eventName, () => {
    callback();
  });
  return unlisten;
}
```

### 4. Use Event Listeners in Components

Integrate event listeners into React components:

- Use `useEffect` to set up listeners
- Call `invokeWatchProjectKits()` to start watching
- Reload data when events are received
- Clean up listeners on component unmount

### 5. Handle Errors Gracefully

Ensure error handling for:
- File watcher setup failures
- Event listener registration failures
- Network/communication errors
- Cleanup on component unmount

## Verification

Test file watching:

1. Start the application
2. Open a project
3. Add/modify/delete a file in the `.bluekit` directory
4. Verify the UI updates automatically without manual refresh
5. Check console for any errors

## Completion Criteria

- [ ] Backend file watching verified and working
- [ ] Frontend event listeners implemented
- [ ] Event listeners integrated into components
- [ ] File changes trigger UI updates automatically
- [ ] Error handling implemented
- [ ] Cleanup functions work correctly

## Next Steps

After verification passes, proceed to: `ui-components.md` in Layer 6.

