/**
 * Core IPC commands for basic application functionality.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import type { AppInfo } from './types';

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
  return await invokeWithTimeout<string>('ping', {}, 5000); // Quick timeout for ping
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
  return await invokeWithTimeout<AppInfo>('get_app_info');
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
  return await invokeWithTimeout<string>('example_error', { shouldFail });
}

