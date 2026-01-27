/**
 * AuthScreen - Multi-provider sign-in UI.
 * Supports Google, GitHub, and email magic link authentication via Supabase.
 */
import { useState } from 'react';
import {
    Box,
    VStack,
    Button,
    Input,
    Text,
    Heading,
    Icon,
    HStack,
} from '@chakra-ui/react';
import { FaGoogle, FaGithub, FaEnvelope, FaCheckCircle } from 'react-icons/fa';
import { useSupabaseAuth } from '@/shared/contexts/SupabaseAuthContext';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { ActiveLogo as BlueKitLogo } from '@/shared/components/logo';
import { toaster } from '@/shared/components/ui/toaster';

export function AuthScreen() {
    const { signInWithGoogle, signInWithGitHub, signInWithEmail } = useSupabaseAuth();
    const { colorMode } = useColorMode();
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [isLoading, setIsLoading] = useState<'google' | 'github' | 'email' | null>(null);

    const handleEmailSignIn = async () => {
        if (!email || !email.includes('@')) {
            toaster.create({
                type: 'error',
                title: 'Invalid email',
                description: 'Please enter a valid email address.',
            });
            return;
        }

        setIsLoading('email');
        const { error } = await signInWithEmail(email);
        setIsLoading(null);

        if (error) {
            toaster.create({
                type: 'error',
                title: 'Failed to send magic link',
                description: error.message,
            });
        } else {
            setEmailSent(true);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading('google');
        try {
            await signInWithGoogle();
        } catch (err) {
            setIsLoading(null);
        }
    };

    const handleGitHubSignIn = async () => {
        setIsLoading('github');
        try {
            await signInWithGitHub();
        } catch (err) {
            setIsLoading(null);
        }
    };

    const cardBg = colorMode === 'light'
        ? 'rgba(255, 255, 255, 0.7)'
        : 'rgba(30, 30, 40, 0.7)';

    const inputBg = colorMode === 'light'
        ? 'whiteAlpha.800'
        : 'blackAlpha.400';

    return (
        <Box
            minH="100vh"
            display="flex"
            alignItems="center"
            justifyContent="center"
            px={4}
        >
            <Box
                p={8}
                maxW="400px"
                w="100%"
                borderRadius="2xl"
                bg={cardBg}
                css={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                }}
                border="1px solid"
                borderColor={colorMode === 'light' ? 'whiteAlpha.400' : 'whiteAlpha.100'}
                boxShadow="xl"
            >
                <VStack gap={6}>
                    {/* Logo and Title */}
                    <VStack gap={2}>
                        <BlueKitLogo size={48} />
                        <Heading size="lg">
                            <Text as="span" color="primary.500">blue</Text>
                            <Text as="span">Kit</Text>
                        </Heading>
                        <Text color="gray.500" textAlign="center">
                            Sign in to sync your vault and collaborate
                        </Text>
                    </VStack>

                    {/* OAuth Buttons */}
                    <VStack gap={3} w="100%">
                        <Button
                            w="100%"
                            size="lg"
                            variant="outline"
                            onClick={handleGoogleSignIn}
                            loading={isLoading === 'google'}
                            disabled={isLoading !== null}
                            borderRadius="xl"
                            _hover={{
                                bg: colorMode === 'light' ? 'whiteAlpha.600' : 'whiteAlpha.100',
                            }}
                        >
                            <HStack gap={2}>
                                <Icon as={FaGoogle} />
                                <Text>Continue with Google</Text>
                            </HStack>
                        </Button>

                        <Button
                            w="100%"
                            size="lg"
                            variant="outline"
                            onClick={handleGitHubSignIn}
                            loading={isLoading === 'github'}
                            disabled={isLoading !== null}
                            borderRadius="xl"
                            _hover={{
                                bg: colorMode === 'light' ? 'whiteAlpha.600' : 'whiteAlpha.100',
                            }}
                        >
                            <HStack gap={2}>
                                <Icon as={FaGithub} />
                                <Text>Continue with GitHub</Text>
                            </HStack>
                        </Button>
                    </VStack>

                    {/* Divider */}
                    <Box w="100%" display="flex" alignItems="center" gap={4}>
                        <Box flex={1} h="1px" bg="gray.300" />
                        <Text fontSize="sm" color="gray.500">or</Text>
                        <Box flex={1} h="1px" bg="gray.300" />
                    </Box>

                    {/* Email Magic Link */}
                    {emailSent ? (
                        <VStack gap={3} p={4} borderRadius="xl" bg="green.50" _dark={{ bg: 'green.900' }} w="100%">
                            <Icon as={FaCheckCircle} boxSize={8} color="green.500" />
                            <Text textAlign="center" fontWeight="medium" color="green.700" _dark={{ color: 'green.200' }}>
                                Magic link sent!
                            </Text>
                            <Text fontSize="sm" textAlign="center" color="green.600" _dark={{ color: 'green.300' }}>
                                Check your email at <strong>{email}</strong> and click the link to sign in.
                            </Text>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setEmailSent(false);
                                    setEmail('');
                                }}
                            >
                                Use different email
                            </Button>
                        </VStack>
                    ) : (
                        <VStack gap={3} w="100%">
                            <Input
                                placeholder="Email address"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                size="lg"
                                borderRadius="xl"
                                bg={inputBg}
                                border="1px solid"
                                borderColor={colorMode === 'light' ? 'gray.200' : 'whiteAlpha.100'}
                                _focus={{
                                    borderColor: 'primary.500',
                                    boxShadow: 'none',
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleEmailSignIn();
                                    }
                                }}
                            />
                            <Button
                                w="100%"
                                size="lg"
                                colorPalette="blue"
                                onClick={handleEmailSignIn}
                                loading={isLoading === 'email'}
                                disabled={isLoading !== null || !email}
                                borderRadius="xl"
                            >
                                <HStack gap={2}>
                                    <Icon as={FaEnvelope} />
                                    <Text>Continue with Email</Text>
                                </HStack>
                            </Button>
                        </VStack>
                    )}

                    {/* Skip Option */}
                    <Text fontSize="xs" color="gray.500" textAlign="center">
                        Sign in is optional. Your local vault works offline.
                    </Text>
                </VStack>
            </Box>
        </Box>
    );
}

export default AuthScreen;
