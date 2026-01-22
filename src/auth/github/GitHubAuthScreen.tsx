/**
 * GitHub Authentication Screen.
 * 
 * This component handles the GitHub authorization code flow OAuth process.
 * It opens GitHub in the browser, listens for the callback, and exchanges the code for a token.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Center,
} from '@chakra-ui/react';
import { FaGithub } from 'react-icons/fa';
import { open } from '@tauri-apps/api/shell';
import { listen } from '@tauri-apps/api/event';
import { useGitHubAuth } from './GitHubAuthProvider';
import {
  invokeAuthStartAuthorization,
  invokeAuthExchangeCode,
} from '../../ipc';
import { toaster } from '../../components/ui/toaster';

interface GitHubAuthScreenProps {
  onSuccess?: () => void;
  onSkip?: () => void;
}

interface OAuthCallbackPayload {
  code?: string;
  state?: string;
  code_verifier?: string;
  redirect_uri?: string;
  error?: string;
  error_description?: string;
}

export function GitHubAuthScreen({ onSuccess, onSkip }: GitHubAuthScreenProps) {
  const { setToken } = useGitHubAuth();

  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExchanging, setIsExchanging] = useState(false);

  // Start authorization flow
  const startAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = await invokeAuthStartAuthorization();
      setAuthUrl(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start authentication';
      toaster.create({
        type: 'error',
        title: 'Authentication Error',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start auth on mount
  useEffect(() => {
    startAuth();
  }, [startAuth]);

  // Listen for OAuth callback event
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<OAuthCallbackPayload>('oauth-callback', async (event) => {
          const payload = event.payload;

          if (payload.error) {
            toaster.create({
              type: 'error',
              title: 'Authorization Failed',
              description: payload.error_description || payload.error,
            });
            return;
          }

          if (payload.code && payload.state && payload.code_verifier && payload.redirect_uri) {
            setIsExchanging(true);
            try {
              console.log('Exchanging code for token:', {
                code: payload.code.substring(0, 10) + '...',
                state: payload.state,
                redirect_uri: payload.redirect_uri,
                has_verifier: !!payload.code_verifier
              });

              const status = await invokeAuthExchangeCode(
                payload.code,
                payload.state,
                payload.code_verifier,
                payload.redirect_uri
              );

              if (status.type === 'authorized') {
                console.log('Token exchange successful, setting token...');
                await setToken(status.token);
                toaster.create({
                  type: 'success',
                  title: 'Signed in successfully',
                  description: 'You have been authenticated with GitHub.',
                });
                if (onSuccess) {
                  onSuccess();
                }
              } else {
                console.error('Token exchange failed:', status.message);
                toaster.create({
                  type: 'error',
                  title: 'Authentication error',
                  description: status.message,
                });
              }
            } catch (err) {
              console.error('Token exchange exception:', err);
              const errorMessage = err instanceof Error ? err.message : 'Failed to exchange code';
              toaster.create({
                type: 'error',
                title: 'Authentication error',
                description: errorMessage,
              });
            } finally {
              setIsExchanging(false);
            }
          } else {
            console.error('Missing required OAuth callback parameters:', {
              has_code: !!payload.code,
              has_state: !!payload.state,
              has_code_verifier: !!payload.code_verifier,
              has_redirect_uri: !!payload.redirect_uri
            });
            toaster.create({
              type: 'error',
              title: 'Authentication error',
              description: 'Missing required OAuth parameters. Please try again.',
            });
          }
        });
      } catch (err) {
        console.error('Failed to set up OAuth callback listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [setToken, onSuccess]);

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

  if (isLoading || !authUrl) {
    return (
      <Center
        h="100vh"
        css={{
          background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        }}
      >
        <Box
          borderRadius="2xl"
          pt={4}
          px={8}
          pb={8}
          w="400px"
          css={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
            _dark: {
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
            },
          }}
        >
          <VStack gap={3}>
            <Heading size="lg" textAlign="center">
              <Text as="span" color="primary.500">
                blue
              </Text>
              <Text as="span">Kit</Text>
            </Heading>
            <Heading size="2xl" fontWeight="bold" textAlign="center">
              Sign In
            </Heading>
            <Text color="fg.muted" textAlign="center">
              Setting up authentication...
            </Text>
          </VStack>
        </Box>
      </Center>
    );
  }

  return (
    <Center
      h="100vh"
      css={{
        background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      }}
    >
      <Box
        borderRadius="2xl"
        pt={4}
        px={8}
        pb={8}
        w="400px"
        css={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          _dark: {
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          },
        }}
      >
        <VStack gap={3} align="stretch">
          <Heading size="lg" textAlign="center">
            <Text as="span" color="primary.500">
              blue
            </Text>
            <Text as="span">Kit</Text>
          </Heading>
          <Heading size="3xl" fontWeight="bold" textAlign="center">
            Sign In
          </Heading>

          <VStack gap={4}>

            <Button
              onClick={handleOpenGitHub}
              width="100%"
              size="lg"
              colorPalette="blue"
              loading={isExchanging}
              disabled={isExchanging}
            >
              <FaGithub style={{ marginRight: '8px' }} />
              {isExchanging ? 'Completing sign in...' : 'Continue with GitHub'}
            </Button>

            {isExchanging && (
              <Text fontSize="sm" color="fg.muted" textAlign="center">
                Processing authorization...
              </Text>
            )}
          </VStack>

          {onSkip && (
            <Center mt={2}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                color="text.tertiary"
                fontWeight="normal"
                _hover={{ color: 'text.secondary', bg: 'bg.subtle' }}
              >
                Continue as guest
              </Button>
            </Center>
          )}

          <Text fontSize="xs" color="fg.muted" textAlign="center" mt={4}>
            By continuing, you acknowledge GitHub's Terms of Service and Privacy Policy.
          </Text>
        </VStack>
      </Box>
    </Center>
  );
}
