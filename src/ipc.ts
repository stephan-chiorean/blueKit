/**
 * IPC (Inter-Process Communication) wrapper functions.
 * 
 * This file provides type-safe wrappers around Tauri's `invoke` API.
 * Instead of calling `invoke` directly with string command names,
 * we create typed functions that provide:
 * - Type safety (TypeScript knows the return type)
 * - Better IDE autocomplete
 * - Centralized error handling
 * - Documentation via JSDoc comments
 * 
 * How IPC works:
 * 1. Frontend calls a function in this file (e.g., `invokePing()`)
 * 2. The function calls Tauri's `invoke` with the command name
 * 3. Tauri sends the request to the Rust backend
 * 4. Rust command handler processes the request
 * 5. Response is sent back to the frontend
 * 6. Promise resolves with the result
 */

import { invoke } from '@tauri-apps/api/tauri';

/**
 * Type definition for the AppInfo structure returned by `get_app_info`.
 * 
 * This interface must match the `AppInfo` struct in `src-tauri/src/commands.rs`.
 * TypeScript uses this to provide type checking and autocomplete.
 */
export interface AppInfo {
  /** Application name */
  name: string;
  /** Application version */
  version: string;
  /** Platform the app is running on (e.g., "windows", "macos", "linux") */
  platform: string;
}

/**
 * Type definition for a kit file returned by `get_project_kits`.
 * 
 * This interface must match the `KitFile` struct in `src-tauri/src/commands.rs`.
 */
export interface KitFile {
  /** Name of the kit file (without .md extension) */
  name: string;
  /** Full path to the kit file */
  path: string;
  /** Parsed YAML front matter */
  frontMatter?: KitFrontMatter;
}

/**
 * YAML front matter structure for kit files.
 */
export interface KitFrontMatter {
  /** Unique identifier for the kit */
  id?: string;
  /** Display alias/name for the kit */
  alias?: string;
  /** Whether this is a base kit */
  is_base?: boolean;
  /** Version number */
  version?: number;
  /** Tags array */
  tags?: string[];
  /** Description of the kit */
  description?: string;
}

/**
 * Type definition for a project entry in the project registry.
 * 
 * This interface must match the `ProjectEntry` struct in `src-tauri/src/commands.rs`.
 */
export interface ProjectEntry {
  /** Unique identifier for the project */
  id: string;
  /** Project title/name */
  title: string;
  /** Project description */
  description: string;
  /** Absolute path to the project directory */
  path: string;
}

/**
 * Simple ping command to test IPC communication.
 * 
 * This is the simplest IPC command - it takes no parameters and returns a string.
 * Use this to verify that IPC communication is working correctly.
 * 
 * @returns A promise that resolves to "pong"
 * 
 * @example
 * ```typescript
 * const result = await invokePing();
 * console.log(result); // "pong"
 * ```
 */
export async function invokePing(): Promise<string> {
  // `invoke<T>` is Tauri's function to call backend commands
  // The generic type parameter `<string>` tells TypeScript the return type
  // The first argument is the command name (must match the function name in Rust)
  // The second argument is an optional object with parameters (none needed here)
  return await invoke<string>('ping');
}

/**
 * Gets application information including name, version, and platform.
 * 
 * This command demonstrates how to receive structured data (an object) from the backend.
 * The backend returns a JSON object that TypeScript automatically converts to the AppInfo interface.
 * 
 * @returns A promise that resolves to an AppInfo object
 * 
 * @example
 * ```typescript
 * const info = await invokeGetAppInfo();
 * console.log(info.name);     // "bluekit-app"
 * console.log(info.version);  // "0.1.0"
 * console.log(info.platform); // "macos" (or "windows", "linux")
 * ```
 */
export async function invokeGetAppInfo(): Promise<AppInfo> {
  // The return type is `Promise<AppInfo>`, which means TypeScript knows
  // the structure of the returned object and will provide autocomplete
  return await invoke<AppInfo>('get_app_info');
}

/**
 * Example command that demonstrates error handling.
 * 
 * This command shows how to handle errors from IPC calls.
 * If the backend returns an error, the promise will reject and you can catch it.
 * 
 * @param shouldFail - If true, the command will return an error
 * @returns A promise that resolves to "Success!" or rejects with an error
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await invokeExampleError(false);
 *   console.log(result); // "Success!"
 * } catch (error) {
 *   console.error('Error:', error); // Error message if shouldFail is true
 * }
 * ```
 */
export async function invokeExampleError(shouldFail: boolean): Promise<string> {
  // Commands can accept parameters by passing an object as the second argument
  // The keys must match the parameter names in the Rust function
  return await invoke<string>('example_error', { shouldFail });
}

/**
 * Gets the list of kit files (.md files) from a project's .bluekit directory.
 * 
 * This command reads the .bluekit directory in the specified project path
 * and returns a list of all .md files found there. Each .md file represents a kit.
 * 
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves to an array of KitFile objects
 * 
 * @example
 * ```typescript
 * const kits = await invokeGetProjectKits('/path/to/project');
 * kits.forEach(kit => {
 *   console.log(kit.name); // "my-kit" (without .md extension)
 *   console.log(kit.path); // "/path/to/project/.bluekit/my-kit.md"
 * });
 * ```
 */
export async function invokeGetProjectKits(projectPath: string): Promise<KitFile[]> {
  return await invoke<KitFile[]>('get_project_kits', { projectPath });
}

/**
 * Gets the project registry from ~/.bluekit/projectRegistry.json.
 * 
 * This command reads the project registry file from the user's home directory
 * and returns a list of all registered projects.
 * 
 * @returns A promise that resolves to an array of ProjectEntry objects
 * 
 * @example
 * ```typescript
 * const projects = await invokeGetProjectRegistry();
 * projects.forEach(project => {
 *   console.log(project.title); // "project-name"
 *   console.log(project.path); // "/absolute/path/to/project"
 * });
 * ```
 */
export async function invokeGetProjectRegistry(): Promise<ProjectEntry[]> {
  return await invoke<ProjectEntry[]>('get_project_registry');
}

/**
 * Starts watching a project's .bluekit directory for kit file changes.
 * 
 * This command sets up a file watcher that monitors the .bluekit directory
 * in the specified project path. When any .md file is added, modified, or
 * removed, it emits a Tauri event that the frontend can listen to.
 * 
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves when the watcher is set up
 * 
 * @example
 * ```typescript
 * await invokeWatchProjectKits('/path/to/project');
 * // Then listen for 'project-kits-changed' events
 * ```
 */
export async function invokeWatchProjectKits(projectPath: string): Promise<void> {
  return await invoke<void>('watch_project_kits', { projectPath });
}

/**
 * Reads the contents of a file.
 * 
 * @param filePath - The absolute path to the file to read
 * @returns A promise that resolves to the file contents as a string
 * 
 * @example
 * ```typescript
 * const contents = await invokeReadFile('/path/to/file.md');
 * console.log(contents); // File contents as string
 * ```
 */
export async function invokeReadFile(filePath: string): Promise<string> {
  return await invoke<string>('read_file', { filePath });
}

/**
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
 * 3. Add a typed wrapper function in this file:
 *    ```typescript
 *    export async function invokeMyCommand(param: string): Promise<string> {
 *        return await invoke<string>('my_command', { param });
 *    }
 *    ```
 * 
 * 4. Use it in your React components:
 *    ```typescript
 *    import { invokeMyCommand } from './ipc';
 *    const result = await invokeMyCommand('Hello');
 *    ```
 */

