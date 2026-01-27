/**
 * User Profile Button.
 *
 * Shows the Supabase-authenticated user's avatar/profile menu,
 * along with optional GitHub integration status.
 * Falls back to a sign-in button when not authenticated.
 */

import { useState } from 'react';
import {
    Box,
    HStack,
    VStack,
    Text,
    Icon,
    Avatar,
    Menu,
    Button,
    Spinner,
    Badge,
} from '@chakra-ui/react';
import { FaGoogle, FaGithub, FaEnvelope } from 'react-icons/fa';
import { LuUser, LuLogOut, LuLink, LuUnlink } from 'react-icons/lu';
import { useSupabaseAuth } from '@/shared/contexts/SupabaseAuthContext';
import { useGitHubIntegration } from '@/shared/contexts/GitHubIntegrationContext';

export default function UserProfileButton() {
    const {
        user,
        isLoading: isAuthLoading,
        isAuthenticated,
        signOut,
        signInWithGoogle,
        signInWithGitHub,
    } = useSupabaseAuth();

    const {
        isConnected: isGitHubConnected,
        isLoading: isGitHubLoading,
        isConnecting: isGitHubConnecting,
        user: gitHubUser,
        connectGitHub,
        disconnectGitHub,
    } = useGitHubIntegration();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [signingIn, setSigningIn] = useState<'google' | 'github' | null>(null);

    // Loading state
    if (isAuthLoading) {
        return (
            <Box p={1}>
                <Spinner size="sm" />
            </Box>
        );
    }

    // Not authenticated - show sign in menu
    if (!isAuthenticated || !user) {
        const handleGoogleSignIn = async () => {
            setSigningIn('google');
            try {
                await signInWithGoogle();
            } catch (err) {
                setSigningIn(null);
            }
        };

        const handleGitHubSignIn = async () => {
            setSigningIn('github');
            try {
                await signInWithGitHub();
            } catch (err) {
                setSigningIn(null);
            }
        };

        return (
            <Menu.Root open={isMenuOpen} onOpenChange={(e) => setIsMenuOpen(e.open)}>
                <Menu.Trigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        _hover={{ bg: 'transparent' }}
                    >
                        <HStack gap={2}>
                            <Icon as={LuUser} />
                            <Text display={{ base: 'none', md: 'inline' }}>Sign In</Text>
                        </HStack>
                    </Button>
                </Menu.Trigger>
                <Menu.Positioner>
                    <Menu.Content width="220px" p={2}>
                        <VStack gap={2}>
                            <Button
                                w="100%"
                                size="sm"
                                variant="outline"
                                onClick={handleGoogleSignIn}
                                loading={signingIn === 'google'}
                                disabled={signingIn !== null}
                            >
                                <HStack gap={2}>
                                    <Icon as={FaGoogle} color="red.500" />
                                    <Text>Google</Text>
                                </HStack>
                            </Button>
                            <Button
                                w="100%"
                                size="sm"
                                variant="outline"
                                onClick={handleGitHubSignIn}
                                loading={signingIn === 'github'}
                                disabled={signingIn !== null}
                            >
                                <HStack gap={2}>
                                    <Icon as={FaGithub} />
                                    <Text>GitHub</Text>
                                </HStack>
                            </Button>
                        </VStack>
                    </Menu.Content>
                </Menu.Positioner>
            </Menu.Root>
        );
    }

    // Get provider info for display
    const provider = user.app_metadata?.provider;
    const ProviderIcon = provider === 'google' ? FaGoogle : provider === 'github' ? FaGithub : FaEnvelope;
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];

    return (
        <Menu.Root open={isMenuOpen} onOpenChange={(e) => setIsMenuOpen(e.open)}>
            <Menu.Trigger asChild>
                <Box as="button" cursor="pointer" _hover={{ bg: 'transparent' }}>
                    <Avatar.Root size="sm">
                        {avatarUrl ? (
                            <Avatar.Image src={avatarUrl} alt={displayName || 'User'} />
                        ) : null}
                        <Avatar.Fallback>
                            <LuUser />
                        </Avatar.Fallback>
                    </Avatar.Root>
                </Box>
            </Menu.Trigger>
            <Menu.Positioner>
                <Menu.Content width="280px">
                    {/* User Info */}
                    <Box px={3} py={3} borderBottomWidth="1px" borderColor="border.subtle">
                        <HStack gap={3}>
                            <Avatar.Root size="md">
                                {avatarUrl ? (
                                    <Avatar.Image src={avatarUrl} alt={displayName || 'User'} />
                                ) : null}
                                <Avatar.Fallback>
                                    <LuUser />
                                </Avatar.Fallback>
                            </Avatar.Root>
                            <VStack align="start" gap={0} flex={1}>
                                <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>
                                    {displayName}
                                </Text>
                                <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                                    {user.email}
                                </Text>
                                <HStack gap={1} mt={1}>
                                    <Icon as={ProviderIcon} boxSize={3} color="fg.muted" />
                                    <Text fontSize="xs" color="fg.muted" textTransform="capitalize">
                                        {provider || 'email'}
                                    </Text>
                                </HStack>
                            </VStack>
                        </HStack>
                    </Box>

                    {/* GitHub Integration Section */}
                    <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                        <Text fontSize="xs" color="fg.muted" mb={2} fontWeight="medium">
                            Integrations
                        </Text>
                        {isGitHubLoading ? (
                            <HStack gap={2} py={1}>
                                <Spinner size="xs" />
                                <Text fontSize="sm" color="fg.muted">Checking GitHub...</Text>
                            </HStack>
                        ) : isGitHubConnected && gitHubUser ? (
                            <HStack justify="space-between">
                                <HStack gap={2}>
                                    <Icon as={FaGithub} />
                                    <Text fontSize="sm">@{gitHubUser.login}</Text>
                                    <Badge size="sm" colorPalette="green">Connected</Badge>
                                </HStack>
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={disconnectGitHub}
                                    _hover={{ color: 'red.500' }}
                                >
                                    <LuUnlink />
                                </Button>
                            </HStack>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                w="100%"
                                onClick={connectGitHub}
                                loading={isGitHubConnecting}
                            >
                                <HStack gap={2}>
                                    <Icon as={FaGithub} />
                                    <Icon as={LuLink} />
                                    <Text>Connect GitHub</Text>
                                </HStack>
                            </Button>
                        )}
                    </Box>

                    {/* Sign Out */}
                    <Menu.Item
                        value="signout"
                        onSelect={async () => {
                            try {
                                await signOut();
                                // Also disconnect GitHub when signing out
                                if (isGitHubConnected) {
                                    await disconnectGitHub();
                                }
                            } catch (error) {
                                console.error('Failed to sign out:', error);
                            }
                        }}
                    >
                        <HStack gap={2}>
                            <Icon as={LuLogOut} />
                            <Text>Sign Out</Text>
                        </HStack>
                    </Menu.Item>
                </Menu.Content>
            </Menu.Positioner>
        </Menu.Root>
    );
}
