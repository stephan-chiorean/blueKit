/**
 * GitHub Integration Context.
 *
 * Manages GitHub as an OPTIONAL integration, not identity.
 * Key differences from the old GitHubAuthProvider:
 * - No automatic prompt on app launch
 * - connectGitHub() called explicitly by user action
 * - App works fully without GitHub connection
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/api/shell';
import { GitHubToken, GitHubUser } from '../types/github';
import {
  invokeKeychainRetrieveToken,
  invokeKeychainDeleteToken,
  invokeAuthStartAuthorization,
  invokeAuthExchangeCode,
  invokeGitHubGetUser,
} from '../ipc';
import { toaster } from '../components/ui/toaster';

interface OAuthCallbackPayload {
  code?: string;
  state?: string;
  code_verifier?: string;
  redirect_uri?: string;
  error?: string;
  error_description?: string;
}

interface GitHubIntegrationContextValue {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  user: GitHubUser | null;
  accessToken: string | null;

  // Actions
  connectGitHub: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
}

const GitHubIntegrationContext = createContext<
  GitHubIntegrationContextValue | undefined
>(undefined);

export function GitHubIntegrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Track active auth flow
  const authUrlRef = useRef<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Load stored token on mount (silent check, no blocking)
  const loadStoredToken = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedToken = await invokeKeychainRetrieveToken();
      setAccessToken(storedToken.access_token);
      setIsConnected(true);

      // Fetch user info
      try {
        const userInfo = await invokeGitHubGetUser();
        setUser(userInfo);
      } catch (error) {
        console.warn('Failed to fetch user info:', error);
      }
    } catch {
      // No token stored - this is fine, user just hasn't connected
      setAccessToken(null);
      setIsConnected(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load token on mount
  useEffect(() => {
    loadStoredToken();
  }, [loadStoredToken]);

  // Handle successful token exchange
  const handleTokenExchangeSuccess = useCallback(async (token: GitHubToken) => {
    setAccessToken(token.access_token);
    setIsConnected(true);

    try {
      const userInfo = await invokeGitHubGetUser();
      setUser(userInfo);
    } catch (error) {
      console.warn('Failed to fetch user info:', error);
    }

    toaster.create({
      type: 'success',
      title: 'GitHub connected',
      description: 'You can now use GitHub features.',
    });
  }, []);

  // Connect GitHub - initiates OAuth flow
  const connectGitHub = useCallback(async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);

      // Start authorization flow
      const authUrl = await invokeAuthStartAuthorization();
      authUrlRef.current = authUrl;

      // Set up OAuth callback listener
      if (unlistenRef.current) {
        unlistenRef.current();
      }

      unlistenRef.current = await listen<OAuthCallbackPayload>(
        'oauth-callback',
        async (event) => {
          const payload = event.payload;

          if (payload.error) {
            toaster.create({
              type: 'error',
              title: 'GitHub connection failed',
              description: payload.error_description || payload.error,
            });
            setIsConnecting(false);
            return;
          }

          if (
            payload.code &&
            payload.state &&
            payload.code_verifier &&
            payload.redirect_uri
          ) {
            try {
              const status = await invokeAuthExchangeCode(
                payload.code,
                payload.state,
                payload.code_verifier,
                payload.redirect_uri
              );

              if (status.type === 'authorized') {
                await handleTokenExchangeSuccess(status.token);
              } else {
                toaster.create({
                  type: 'error',
                  title: 'GitHub connection failed',
                  description: status.message,
                });
              }
            } catch (err) {
              const errorMessage =
                err instanceof Error ? err.message : 'Failed to connect';
              toaster.create({
                type: 'error',
                title: 'GitHub connection failed',
                description: errorMessage,
              });
            } finally {
              setIsConnecting(false);

              // Clean up listener
              if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
              }
              authUrlRef.current = null;
            }
          }
        }
      );

      // Open GitHub in browser
      await open(authUrl);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start connection';
      toaster.create({
        type: 'error',
        title: 'GitHub connection failed',
        description: errorMessage,
      });
      setIsConnecting(false);
    }
  }, [isConnecting, handleTokenExchangeSuccess]);

  // Disconnect GitHub
  const disconnectGitHub = useCallback(async () => {
    try {
      await invokeKeychainDeleteToken();
      setAccessToken(null);
      setUser(null);
      setIsConnected(false);

      toaster.create({
        type: 'info',
        title: 'GitHub disconnected',
        description: 'You can reconnect anytime.',
      });
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to disconnect',
        description: 'Please try again.',
      });
    }
  }, []);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const value: GitHubIntegrationContextValue = {
    isConnected,
    isLoading,
    isConnecting,
    user,
    accessToken,
    connectGitHub,
    disconnectGitHub,
  };

  return (
    <GitHubIntegrationContext.Provider value={value}>
      {children}
    </GitHubIntegrationContext.Provider>
  );
}

export function useGitHubIntegration() {
  const context = useContext(GitHubIntegrationContext);
  if (!context) {
    throw new Error(
      'useGitHubIntegration must be used within GitHubIntegrationProvider'
    );
  }
  return context;
}
