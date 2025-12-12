/**
 * GitHub Authentication Module - Public Exports
 * 
 * This module provides a composable authentication system for GitHub integration.
 * All components and hooks are exported from here for easy importing.
 */

export { GitHubAuthProvider, useGitHubAuth } from './GitHubAuthProvider';
export { GitHubAuthScreen } from './GitHubAuthScreen';
export type { AuthStatus, GitHubToken } from './types';
