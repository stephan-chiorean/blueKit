/**
 * IPC commands for file operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';

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
  return await invokeWithTimeout<string>('read_file', { filePath });
}

/**
 * Writes content to a file.
 *
 * This command writes the provided content to the specified file path.
 * The file will be created if it doesn't exist, or overwritten if it does.
 *
 * @param filePath - The absolute path to the file to write
 * @param content - The content to write to the file
 * @returns Promise that resolves when the file is written
 * @throws Error if the file cannot be written
 */
export async function invokeWriteFile(filePath: string, content: string): Promise<void> {
  return await invokeWithTimeout<void>('write_file', { filePath, content });
}

