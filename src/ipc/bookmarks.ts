/**
 * IPC commands for bookmark operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import { BookmarksData, BookmarkItem } from './types';

/**
 * Gets bookmarks from a project's .bluekit/bookmarks.json file.
 *
 * @param projectPath - The root path of the project
 * @returns A promise that resolves to the bookmarks data (empty items array if file doesn't exist)
 *
 * @example
 * ```typescript
 * const bookmarks = await invokeGetBookmarks('/path/to/project');
 * console.log(bookmarks.items); // Array of bookmark items
 * ```
 */
export async function invokeGetBookmarks(projectPath: string): Promise<BookmarksData> {
  return await invokeWithTimeout<BookmarksData>('get_bookmarks', { projectPath });
}

/**
 * Saves bookmarks to a project's .bluekit/bookmarks.json file.
 * Uses atomic write (tmp file + rename) to prevent corruption.
 *
 * @param projectPath - The root path of the project
 * @param data - The bookmarks data to save
 * @returns Promise that resolves when the file is written
 * @throws Error if the file cannot be written
 *
 * @example
 * ```typescript
 * await invokeSaveBookmarks('/path/to/project', { items: [...] });
 * ```
 */
export async function invokeSaveBookmarks(
  projectPath: string,
  data: BookmarksData
): Promise<void> {
  return await invokeWithTimeout<void>('save_bookmarks', { projectPath, data });
}

/**
 * Adds a bookmark item to the root of the bookmarks list.
 *
 * @param projectPath - The root path of the project
 * @param item - The bookmark item to add (file or group)
 * @returns A promise that resolves to the updated bookmarks data
 * @throws Error if the file is already bookmarked
 *
 * @example
 * ```typescript
 * const updated = await invokeAddBookmark('/path/to/project', {
 *   type: 'file',
 *   ctime: Date.now(),
 *   path: '/path/to/file.md',
 *   title: 'My Note',
 * });
 * ```
 */
export async function invokeAddBookmark(
  projectPath: string,
  item: BookmarkItem
): Promise<BookmarksData> {
  return await invokeWithTimeout<BookmarksData>('add_bookmark', { projectPath, item });
}

/**
 * Removes a bookmark by file path (recursively searches through groups).
 *
 * @param projectPath - The root path of the project
 * @param bookmarkPath - The file path of the bookmark to remove
 * @returns A promise that resolves to the updated bookmarks data
 * @throws Error if the bookmark is not found
 *
 * @example
 * ```typescript
 * const updated = await invokeRemoveBookmark('/path/to/project', '/path/to/file.md');
 * ```
 */
export async function invokeRemoveBookmark(
  projectPath: string,
  bookmarkPath: string
): Promise<BookmarksData> {
  return await invokeWithTimeout<BookmarksData>('remove_bookmark', { projectPath, bookmarkPath });
}

/**
 * Reconciles bookmarks by removing any that point to non-existent files.
 * This is useful when files are deleted or moved outside the app.
 *
 * @param projectPath - The root path of the project
 * @returns A promise that resolves to the reconciled bookmarks data
 *
 * @example
 * ```typescript
 * const reconciled = await invokeReconcileBookmarks('/path/to/project');
 * // Stale bookmarks pointing to deleted files are now removed
 * ```
 */
export async function invokeReconcileBookmarks(
  projectPath: string
): Promise<BookmarksData> {
  return await invokeWithTimeout<BookmarksData>('reconcile_bookmarks', { projectPath });
}
