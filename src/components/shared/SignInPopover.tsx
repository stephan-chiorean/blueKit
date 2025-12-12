import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Menu,
  HStack,
  Text,
  Icon,
  Spinner,
  Box,
} from '@chakra-ui/react';
import { FaGithub } from 'react-icons/fa';
import { open } from '@tauri-apps/api/shell';
import { listen } from '@tauri-apps/api/event';
import { useGitHubAuth } from '../../auth/github/GitHubAuthProvider';
import {
  invokeAuthStartAuthorization,
  invokeAuthExchangeCode,
} from '../../ipc';
import { toaster } from '../ui/toaster';

interface OAuthCallbackPayload {
  code?: string;
  state?: string;
  code_verifier?: string;
  redirect_uri?: string;
  error?: string;
  error_description?: string;
}

interface SignInPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
}

export default function SignInPopover({ isOpen, onOpenChange, trigger }: SignInPopoverProps) {
  const { setToken, refreshAuth, isAuthenticated } = useGitHubAuth();
  
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  // Track if we're in an active auth flow (don't reset authUrl when menu closes during flow)
  const isAuthFlowActive = useRef(false);

  // Start authorization flow
  const startAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setAuthUrl(null); // Reset any previous URL
      isAuthFlowActive.current = true; // Mark auth flow as active
      console.log('[SignInPopover] Starting authorization...');
      const url = await invokeAuthStartAuthorization();
      console.log('[SignInPopover] Authorization URL received:', url.substring(0, 50) + '...');
      setAuthUrl(url);
      setIsLoading(false); // IMPORTANT: Set loading to false on success
    } catch (err) {
      console.error('[SignInPopover] Authorization failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start authentication';
      setAuthUrl(null); // Ensure authUrl is null on error
      setIsLoading(false);
      isAuthFlowActive.current = false; // Mark auth flow as inactive
      toaster.create({
        type: 'error',
        title: 'Authentication Error',
        description: errorMessage,
      });
      // Close popover on error so user can try again
      onOpenChange(false);
    }
  }, [onOpenChange]);

  // Reset state when popover closes (but only if not in active auth flow)
  useEffect(() => {
    if (!isOpen && !isAuthFlowActive.current) {
      setAuthUrl(null);
      setIsLoading(false);
      setIsExchanging(false);
    }
  }, [isOpen]);

  // Reset state when user signs out (becomes unauthenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      setAuthUrl(null);
      setIsLoading(false);
      setIsExchanging(false);
    }
  }, [isAuthenticated]);

  // Start auth when popover opens
  useEffect(() => {
    if (isOpen && !authUrl && !isLoading) {
      startAuth();
    }
  }, [isOpen, authUrl, isLoading, startAuth]);

  // Listen for OAuth callback event
  // Keep listener active as long as we have an authUrl (even if popover closes)
  useEffect(() => {
    // Only set up listener if we have started auth (have authUrl)
    if (!authUrl) return;

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        console.log('[SignInPopover] Setting up OAuth callback listener...');
        unlisten = await listen<OAuthCallbackPayload>('oauth-callback', async (event) => {
          console.log('[SignInPopover] Received oauth-callback event:', {
            hasCode: !!event.payload.code,
            hasState: !!event.payload.state,
            hasError: !!event.payload.error,
          });
          
          const payload = event.payload;
          
          if (payload.error) {
            console.error('[SignInPopover] OAuth error:', payload.error);
            toaster.create({
              type: 'error',
              title: 'Authorization Failed',
              description: payload.error_description || payload.error,
            });
            // Reset state on error
            setAuthUrl(null);
            setIsLoading(false);
            setIsExchanging(false);
            isAuthFlowActive.current = false;
            return;
          }

          if (payload.code && payload.state && payload.code_verifier && payload.redirect_uri) {
            console.log('[SignInPopover] Processing OAuth callback...');
            setIsExchanging(true);
            try {
              const status = await invokeAuthExchangeCode(
                payload.code,
                payload.state,
                payload.code_verifier,
                payload.redirect_uri
              );

              console.log('[SignInPopover] Token exchange result:', status.type);
              if (status.type === 'authorized') {
                console.log('[SignInPopover] Setting token and refreshing auth...');
                await setToken(status.token);
                // Refresh auth state to ensure UI updates with user info
                await refreshAuth();
                toaster.create({
                  type: 'success',
                  title: 'Signed in successfully',
                  description: 'You have been authenticated with GitHub.',
                });
                // Reset state and close popover
                setAuthUrl(null);
                setIsLoading(false);
                setIsExchanging(false);
                isAuthFlowActive.current = false;
                onOpenChange(false);
              } else {
                console.error('[SignInPopover] Token exchange failed:', status.message);
                toaster.create({
                  type: 'error',
                  title: 'Authentication error',
                  description: status.message,
                });
                setIsExchanging(false);
                isAuthFlowActive.current = false;
              }
            } catch (err) {
              console.error('[SignInPopover] Token exchange exception:', err);
              const errorMessage = err instanceof Error ? err.message : 'Failed to exchange code';
              toaster.create({
                type: 'error',
                title: 'Authentication error',
                description: errorMessage,
              });
              setIsExchanging(false);
              isAuthFlowActive.current = false;
            }
          } else {
            console.warn('[SignInPopover] Missing required OAuth parameters:', {
              hasCode: !!payload.code,
              hasState: !!payload.state,
              hasCodeVerifier: !!payload.code_verifier,
              hasRedirectUri: !!payload.redirect_uri,
            });
          }
        });
        console.log('[SignInPopover] OAuth callback listener set up successfully');
      } catch (err) {
        console.error('[SignInPopover] Failed to set up OAuth callback listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        console.log('[SignInPopover] Cleaning up OAuth callback listener');
        unlisten();
      }
    };
  }, [authUrl, setToken, refreshAuth, onOpenChange]);

  // Open GitHub in browser
  const handleOpenGitHub = useCallback(async () => {
    if (authUrl) {
      try {
        await open(authUrl);
      } catch (err) {
        toaster.create({
          type: 'warning',
          title: 'Failed to open browser',
          description: 'Please visit the URL manually.',
        });
      }
    }
  }, [authUrl]);

  return (
    <Menu.Root open={isOpen} onOpenChange={(e) => onOpenChange(e.open)}>
      <Menu.Trigger asChild>
        {trigger}
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content width="240px">
          {isLoading || !authUrl ? (
            <Box px={3} py={4}>
              <HStack gap={2} justify="center">
                <Spinner size="sm" colorPalette="primary" />
                <Text fontSize="sm" color="fg.muted">
                  Setting up...
                </Text>
              </HStack>
            </Box>
          ) : (
            <Menu.Item
              value="signin"
              onSelect={handleOpenGitHub}
              disabled={isExchanging}
            >
              <HStack gap={2}>
                <Icon>
                  {isExchanging ? (
                    <Spinner size="sm" colorPalette="primary" />
                  ) : (
                    <FaGithub />
                  )}
                </Icon>
                <Text>
                  {isExchanging ? 'Signing in...' : 'Sign In with GitHub'}
                </Text>
              </HStack>
            </Menu.Item>
          )}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
