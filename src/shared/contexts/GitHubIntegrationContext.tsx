/**
 * GitHub Integration Context.
 *
 * Manages GitHub as an OPTIONAL integration, not identity.
 * Tokens are stored in Supabase user_integrations table, NOT keychain.
 * 
 * Key differences from old implementation:
 * - No keychain access (no system prompts)
 * - Tokens stored in Supabase (requires Supabase auth first)
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
import { GitHubToken, GitHubUser } from '@/types/github';
import {
  invokeAuthStartAuthorization,
  invokeAuthExchangeCode,
} from '@/ipc';
import { supabase } from '@/lib/supabase';
import { toaster } from '@/shared/components/ui/toaster';
import { useSupabaseAuth } from './SupabaseAuthContext';

/**
 * Fetch GitHub user info directly using token.
 * This avoids the backend keychain access.
 */
async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  return response.json();
}

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
  const { user: supabaseUser, isAuthenticated } = useSupabaseAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Track active auth flow
  const authUrlRef = useRef<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Load GitHub integration from Supabase when user authenticates
  const loadGitHubIntegration = useCallback(async () => {
    if (!supabaseUser) {
      // Not authenticated - no GitHub integration possible
      setIsConnected(false);
      setAccessToken(null);
      setUser(null);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch from Supabase user_integrations table
      const { data, error } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .eq('provider', 'github')
        .single();

      if (error || !data) {
        // No GitHub integration stored
        setIsConnected(false);
        setAccessToken(null);
        setUser(null);
        return;
      }

      // Found stored integration
      setAccessToken(data.access_token);
      setIsConnected(true);

      // Set user info from stored data
      if (data.provider_username) {
        setUser({
          login: data.provider_username,
          id: parseInt(data.provider_user_id || '0', 10),
          avatar_url: '',
          name: null,
          email: null,
          html_url: `https://github.com/${data.provider_username}`,
          bio: null,
          company: null,
          location: null,
          public_repos: 0,
          followers: 0,
          following: 0,
        });
      }
      // Note: We don't call invokeGitHubGetUser() anymore as it triggers keychain access.
      // User info is stored in Supabase and refreshed when connecting.
    } catch (err) {
      console.error('Failed to load GitHub integration:', err);
      setIsConnected(false);
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseUser]);

  // Load integration when Supabase user changes
  useEffect(() => {
    if (isAuthenticated) {
      loadGitHubIntegration();
    } else {
      // Clear state when logged out
      setIsConnected(false);
      setAccessToken(null);
      setUser(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadGitHubIntegration]);

  // Save GitHub token to Supabase
  const saveTokenToSupabase = useCallback(async (token: GitHubToken, githubUser: GitHubUser) => {
    if (!supabaseUser) {
      console.error('Cannot save GitHub token: No Supabase user');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: supabaseUser.id,
          provider: 'github',
          access_token: token.access_token,
          // @ts-ignore - GitHubToken type might be missing refresh_token definition but it might be present in runtime or Supabase expects it
          refresh_token: (token as any).refresh_token || null,
          expires_at: token.expires_at ? new Date(token.expires_at * 1000).toISOString() : null,
          scopes: token.scope ? token.scope.split(',') : [],
          provider_user_id: String(githubUser.id),
          provider_username: githubUser.login,
          connected_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider',
        });

      if (error) {
        console.error('Failed to save GitHub token to Supabase:', error);
        throw error;
      }
    } catch (err) {
      console.error('Error saving GitHub integration:', err);
      throw err;
    }
  }, [supabaseUser]);

  // Handle successful token exchange
  const handleTokenExchangeSuccess = useCallback(async (token: GitHubToken) => {
    setAccessToken(token.access_token);
    setIsConnected(true);

    try {
      // Fetch user info directly with token (avoids backend keychain)
      const userInfo = await fetchGitHubUser(token.access_token);
      setUser(userInfo);

      // Save to Supabase
      await saveTokenToSupabase(token, userInfo);

      toaster.create({
        type: 'success',
        title: 'GitHub connected',
        description: 'You can now use GitHub features.',
      });
    } catch (error) {
      console.warn('Failed to complete GitHub connection:', error);
      toaster.create({
        type: 'warning',
        title: 'GitHub connected locally',
        description: 'Connection saved locally but not synced to cloud.',
      });
    }
  }, [saveTokenToSupabase]);

  // Connect GitHub - initiates OAuth flow
  const connectGitHub = useCallback(async () => {
    if (isConnecting) return;

    // Require Supabase auth first
    if (!isAuthenticated) {
      toaster.create({
        type: 'info',
        title: 'Sign in required',
        description: 'Please sign in first to connect GitHub.',
      });
      return;
    }

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
  }, [isConnecting, isAuthenticated, handleTokenExchangeSuccess]);

  // Disconnect GitHub
  const disconnectGitHub = useCallback(async () => {
    try {
      // Remove from Supabase if authenticated
      if (supabaseUser) {
        const { error } = await supabase
          .from('user_integrations')
          .delete()
          .eq('user_id', supabaseUser.id)
          .eq('provider', 'github');

        if (error) {
          console.error('Failed to remove GitHub integration from Supabase:', error);
        }
      }

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
  }, [supabaseUser]);

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
