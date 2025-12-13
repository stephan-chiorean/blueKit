/**
 * IPC (Inter-Process Communication) wrapper functions.
 * 
 * This module provides type-safe wrappers around Tauri's `invoke` API.
 * Instead of calling `invoke` directly with string command names,
 * we create typed functions that provide:
 * - Type safety (TypeScript knows the return type)
 * - Better IDE autocomplete
 * - Centralized error handling
 * - Documentation via JSDoc comments
 * 
 * How IPC works:
 * 1. Frontend calls a function in this module (e.g., `invokePing()`)
 * 2. The function calls Tauri's `invoke` with the command name
 * 3. Tauri sends the request to the Rust backend
 * 4. Rust command handler processes the request
 * 5. Response is sent back to the frontend
 * 6. Promise resolves with the result
 * 
 * How to add a new IPC command:
 *
 * 1. Add the command handler in `src-tauri/src/commands.rs`:
 *    ```rust
 *    #[tauri::command]
 *    pub async fn my_command(param: String) -> Result<String, String> {
 *        Ok(format!("Received: {}", param))
 *    }
 *    ```
 *
 * 2. Register it in `src-tauri/src/main.rs`:
 *    Add `commands::my_command` to the `invoke_handler![]` macro
 *
 * 3. Add a typed wrapper function in the appropriate domain file:
 *    ```typescript
 *    export async function invokeMyCommand(param: string): Promise<string> {
 *        return await invoke<string>('my_command', { param });
 *    }
 *    ```
 *
 * 4. Export it from this index file:
 *    ```typescript
 *    export { invokeMyCommand } from './core'; // or appropriate domain file
 *    ```
 *
 * 5. Use it in your React components:
 *    ```typescript
 *    import { invokeMyCommand } from './ipc';
 *    const result = await invokeMyCommand('Hello');
 *    ```
 */

// Re-export all types
export * from './types';

// Re-export core commands
export * from './core';

// Re-export project commands
export * from './projects';

// Re-export file commands
export * from './files';

// Re-export artifact commands
export * from './artifacts';

// Re-export folder commands
export * from './folders';

// Re-export task commands
export * from './tasks';

// Re-export keychain commands
export * from './keychain';

// Re-export auth commands
export * from './auth';

// Re-export GitHub API commands
export * from './github';

// Re-export Library commands
export * from './library';

