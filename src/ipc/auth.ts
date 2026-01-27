/**
 * IPC commands for authentication operations.
 */

import { invokeWithTimeout } from '@/shared/utils/ipcTimeout';
import { AuthStatus } from '../types/github';

/**
 * Starts the GitHub authorization code flow.
 *
 * Generates authorization URL, starts local HTTP server, and returns the URL.
 * The server will listen for the OAuth callback and emit a Tauri event.
 *
 * @returns Promise that resolves to the authorization URL
 *
 * @example
 * ```typescript
 * const authUrl = await invokeAuthStartAuthorization();
 * // Open URL in browser, then listen for 'oauth-callback' event
 * ```
 */
export async function invokeAuthStartAuthorization(): Promise<string> {
  return await invokeWithTimeout<string>(
    'auth_start_authorization',
    {},
    10000
  );
}

/**
 * Exchanges the authorization code for an access token.
 *
 * @param code - The authorization code from GitHub
 * @param state - The state parameter for CSRF protection
 * @param codeVerifier - The PKCE code verifier
 * @param redirectUri - The redirect URI used in the authorization request (must match exactly)
 * @returns Promise that resolves to the authentication status
 *
 * @example
 * ```typescript
 * const status = await invokeAuthExchangeCode(code, state, codeVerifier, redirectUri);
 * if (status.type === 'authorized') {
 *   console.log('Authenticated!');
 * }
 * ```
 */
export async function invokeAuthExchangeCode(
  code: string,
  state: string,
  codeVerifier: string,
  redirectUri: string
): Promise<AuthStatus> {
  // Tauri v1.5 expects camelCase parameter names to match Rust function parameters
  const args = {
    code: code,
    state: state,
    codeVerifier: codeVerifier,
    redirectUri: redirectUri,
  };
  console.log('Invoking auth_exchange_code with args:', {
    code: code.substring(0, 10) + '...',
    state: state,
    codeVerifier: codeVerifier.substring(0, 10) + '...',
    redirectUri: redirectUri,
    argsKeys: Object.keys(args)
  });
  return await invokeWithTimeout<AuthStatus>(
    'auth_exchange_code',
    args,
    15000
  );
}

/**
 * Gets the current authentication status.
 *
 * @returns Promise that resolves to the current authentication status
 *
 * @example
 * ```typescript
 * const status = await invokeAuthGetStatus();
 * if (status.type === 'authorized') {
 *   console.log('User is authenticated');
 * }
 * ```
 */
export async function invokeAuthGetStatus(): Promise<AuthStatus> {
  return await invokeWithTimeout<AuthStatus>('auth_get_status', {}, 5000);
}

