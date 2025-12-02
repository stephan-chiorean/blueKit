/**
 * Timeout wrapper for Tauri invoke calls.
 *
 * Prevents indefinite hangs from backend issues by wrapping all IPC calls
 * with a timeout. If the backend doesn't respond within the timeout period,
 * the promise rejects with a TimeoutError.
 *
 * Usage:
 * ```typescript
 * import { invokeWithTimeout } from './utils/ipcTimeout';
 *
 * // Use default 15 second timeout
 * const result = await invokeWithTimeout<MyType>('my_command', { arg: 'value' });
 *
 * // Custom timeout
 * const result = await invokeWithTimeout<MyType>('my_command', { arg: 'value' }, 5000);
 * ```
 */

import { invoke } from '@tauri-apps/api/tauri';

const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Custom error class for timeout errors.
 * Use this to distinguish timeout errors from other errors.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a Tauri invoke call with a timeout.
 *
 * @template T The expected return type of the IPC command
 * @param command The Tauri command name to invoke
 * @param args Optional arguments to pass to the command
 * @param timeoutMs Timeout in milliseconds (default: 15000)
 * @returns Promise that resolves with the command result or rejects with TimeoutError
 * @throws {TimeoutError} If the command doesn't complete within the timeout
 */
export async function invokeWithTimeout<T>(
  command: string,
  args?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    invoke<T>(command, args),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(`Command '${command}' timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}
