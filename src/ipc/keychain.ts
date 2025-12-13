/**
 * IPC commands for keychain operations.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import { GitHubToken } from '../types/github';

/**
 * Stores a GitHub token in the OS keychain.
 *
 * @param token - The GitHub token to store
 * @returns Promise that resolves when the token is stored
 *
 * @example
 * ```typescript
 * const token: GitHubToken = {
 *   access_token: 'gho_...',
 *   token_type: 'bearer',
 *   scope: 'repo,user',
 * };
 * await invokeKeychainStoreToken(token);
 * ```
 */
export async function invokeKeychainStoreToken(token: GitHubToken): Promise<void> {
  return await invokeWithTimeout<void>('keychain_store_token', { token }, 5000);
}

/**
 * Retrieves a GitHub token from the OS keychain.
 *
 * @returns Promise that resolves to the stored GitHub token, or rejects if not found
 *
 * @example
 * ```typescript
 * try {
 *   const token = await invokeKeychainRetrieveToken();
 *   console.log('Token found:', token.access_token);
 * } catch (error) {
 *   console.log('No token stored');
 * }
 * ```
 */
export async function invokeKeychainRetrieveToken(): Promise<GitHubToken> {
  return await invokeWithTimeout<GitHubToken>('keychain_retrieve_token', {}, 5000);
}

/**
 * Deletes a GitHub token from the OS keychain.
 *
 * @returns Promise that resolves when the token is deleted
 *
 * @example
 * ```typescript
 * await invokeKeychainDeleteToken();
 * console.log('Token deleted');
 * ```
 */
export async function invokeKeychainDeleteToken(): Promise<void> {
  return await invokeWithTimeout<void>('keychain_delete_token', {}, 5000);
}

