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

/**
 * Opens HTML content in the default browser.
 *
 * Creates a temporary HTML file and opens it in the system's default browser.
 * Useful for previewing content in a new window.
 *
 * @param htmlContent - The HTML content to display
 * @param title - Optional title for the document (used in filename)
 * @returns Promise that resolves when the browser is opened
 * @throws Error if the file cannot be created or browser cannot be opened
 *
 * @example
 * ```typescript
 * await invokeOpenHtmlInBrowser('<html><body><h1>Hello</h1></body></html>', 'preview');
 * ```
 */
export async function invokeOpenHtmlInBrowser(
  htmlContent: string,
  title?: string
): Promise<void> {
  return await invokeWithTimeout<void>('open_html_in_browser', {
    htmlContent,
    title,
  }, 5000); // 5 second timeout for file creation and browser launch
}

/**
 * Configuration for opening a resource in a new window.
 */
export interface PreviewWindowConfig {
  /** Unique identifier for the window (used as window label) */
  windowId: string;
  /** Resource ID or path to display */
  resourceId: string;
  /** Resource type (kit, plan, walkthrough, etc.) */
  resourceType: string;
  /** Window title */
  title: string;
  /** Optional window width (default: 1200) */
  width?: number;
  /** Optional window height (default: 900) */
  height?: number;
}

/**
 * Opens a resource in a new Tauri window.
 *
 * Creates a new OS-level window that displays the resource content.
 * The window can be moved across monitors and is independently manageable.
 *
 * @param config - Window configuration
 * @returns Promise that resolves when window is created
 * @throws Error if window already exists or creation fails
 *
 * @example
 * ```typescript
 * await invokeOpenResourceInWindow({
 *   windowId: 'preview-kit-123',
 *   resourceId: '/path/to/kit.md',
 *   resourceType: 'kit',
 *   title: 'My Kit',
 *   width: 1200,
 *   height: 900,
 * });
 * ```
 */
export async function invokeOpenResourceInWindow(
  config: PreviewWindowConfig
): Promise<void> {
  return await invokeWithTimeout<void>(
    'open_resource_in_window',
    { config },
    5000 // 5 second timeout for window creation
  );
}

/**
 * Closes a preview window by ID.
 *
 * @param windowId - The window ID (without 'preview-' prefix)
 * @returns Promise that resolves when window is closed
 * @throws Error if window not found or close fails
 *
 * @example
 * ```typescript
 * await invokeClosePreviewWindow('kit-123');
 * ```
 */
export async function invokeClosePreviewWindow(
  windowId: string
): Promise<void> {
  return await invokeWithTimeout<void>(
    'close_preview_window',
    { windowId },
    3000 // 3 second timeout
  );
}

