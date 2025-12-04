# BlueKit Development Notes

## Tasks System - File Reading Disabled

**Status:** Not currently in use

The tasks system was originally designed to read tasks from `.bluekit/tasks.json` files via the Rust backend and IPC layer. However, this functionality is currently disabled/cut off.

### Affected Components

- **Rust Backend:**
  - `src-tauri/src/commands.rs` - `get_project_tasks`, `save_project_tasks`, `add_project_task`, `update_project_tasks`, `delete_project_task` commands
  - `src-tauri/src/main.rs` - Task-related command registrations
  
- **IPC Layer:**
  - `src/ipc.ts` - `invokeGetProjectTasks`, `invokeSaveProjectTasks` functions
  
- **Frontend:**
  - Tasks are now managed entirely in the frontend with mock data
  - No file I/O operations for tasks

### Why This Was Done

The tasks feature was refactored to be frontend-only for faster iteration and development. The backend file reading infrastructure remains in place but is not actively used.

### Future Considerations

If we need to restore file-based task persistence:
1. The Rust commands are still available
2. The IPC wrappers exist
3. Would need to reconnect the frontend to use `invokeGetProjectTasks` and related functions

**Note:** This is "tribal knowledge" - important context that might not be obvious from the code alone.


