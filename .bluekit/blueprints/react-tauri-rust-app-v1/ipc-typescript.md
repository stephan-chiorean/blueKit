---
id: ipc-typescript
type: task
version: 1
---

# Type-Safe TypeScript IPC Wrappers

Create type-safe TypeScript wrappers for all Rust IPC commands, ensuring type safety and better developer experience.

## Requirements

- Completed "IPC Commands" task
- TypeScript configured in project
- `@tauri-apps/api` installed

## Steps

### 1. Create IPC Types File

Create `src/ipc.ts`:

```typescript
/**
 * IPC (Inter-Process Communication) wrapper functions.
 * 
 * This file provides type-safe wrappers around Tauri's `invoke` API.
 */

import { invoke } from '@tauri-apps/api/tauri';

// Type definitions matching Rust structs
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface FileInfo {
  name: string;
  path: string;
  is_file: boolean;
}

/**
 * Simple ping command to test IPC communication.
 */
export async function invokePing(): Promise<string> {
  return await invoke<string>('ping');
}

/**
 * Gets application information.
 */
export async function invokeGetAppInfo(): Promise<AppInfo> {
  return await invoke<AppInfo>('get_app_info');
}

/**
 * Reads the contents of a file.
 */
export async function invokeReadFile(filePath: string): Promise<string> {
  return await invoke<string>('read_file', { filePath });
}

/**
 * Lists files and directories in a path.
 */
export async function invokeListDirectory(dirPath: string): Promise<FileInfo[]> {
  return await invoke<FileInfo[]>('list_directory', { dirPath });
}

/**
 * Writes content to a file.
 */
export async function invokeWriteFile(
  filePath: string,
  content: string
): Promise<string> {
  return await invoke<string>('write_file', { filePath, content });
}
```

### 2. Usage Example in React Component

Example usage in a component:

```typescript
import { invokeReadFile, invokeWriteFile } from './ipc';

function MyComponent() {
  const handleRead = async () => {
    try {
      const content = await invokeReadFile('/path/to/file.txt');
      console.log(content);
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  };
  
  const handleWrite = async () => {
    try {
      await invokeWriteFile('/path/to/file.txt', 'Hello World');
    } catch (error) {
      console.error('Failed to write file:', error);
    }
  };
  
  return (
    <div>
      <button onClick={handleRead}>Read File</button>
      <button onClick={handleWrite}>Write File</button>
    </div>
  );
}
```

## Type Safety Principles

1. **Match Rust Types**: TypeScript interfaces must match Rust structs exactly
2. **Generic Types**: Use TypeScript generics with `invoke<T>()` for return types
3. **Parameter Objects**: Pass parameters as objects matching Rust function signatures
4. **Error Handling**: Use try/catch for error handling (Tauri rejects promise on error)

## Best Practices

1. **JSDoc Comments**: Document all functions with JSDoc
2. **Type Exports**: Export types for use in components
3. **Consistent Naming**: Use `invoke` prefix for all wrapper functions
4. **Error Messages**: Handle errors gracefully with user-friendly messages

## Verification

- TypeScript should compile without errors
- IDE should provide autocomplete for IPC functions
- Types should match Rust structs exactly

## Next Steps

After completing this task, proceed to "File Operations" task to add more file system commands.