import { useState, useEffect } from "react";
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Icon,
  Spinner,
} from "@chakra-ui/react";
import { ActiveLogo as BlueKitLogo } from "./logo";
import { FaGoogle, FaGithub } from "react-icons/fa";
import { LuArrowRight, LuSparkles } from "react-icons/lu";
import { useSupabaseAuth } from "../contexts/SupabaseAuthContext";
import { useColorMode } from "../contexts/ColorModeContext";

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  const { colorMode } = useColorMode();
  const { isAuthenticated, isLoading, signInWithGoogle, signInWithGitHub } =
    useSupabaseAuth();
  const [signingIn, setSigningIn] = useState<"google" | "github" | null>(null);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const timer = setTimeout(() => {
        onGetStarted();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, onGetStarted]);

  const handleGoogleSignIn = async () => {
    setSigningIn("google");
    try {
      await signInWithGoogle();
    } catch (err) {
      setSigningIn(null);
    }
  };

  const handleGitHubSignIn = async () => {
    setSigningIn("github");
    try {
      await signInWithGitHub();
    } catch (err) {
      setSigningIn(null);
    }
  };

  const cardBg =
    colorMode === "light"
      ? "rgba(255, 255, 255, 0.5)"
      : "rgba(30, 30, 40, 0.5)";

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      css={{
        background: {
          _light: "rgba(255, 255, 255, 0.1)",
          _dark: "rgba(0, 0, 0, 0.15)",
        },
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
      }}
    >
      <VStack gap={12} pb={16}>
        {/* Logo and Branding */}
        <VStack gap={0}>
          <BlueKitLogo size={200} />
          <Box
            as="h1"
            fontSize={{ base: "5xl", md: "7xl", lg: "8xl" }}
            fontWeight="bold"
            letterSpacing="-0.02em"
            lineHeight="1"
            css={{
              userSelect: "none",
            }}
          >
            <Text
              as="span"
              color="primary.500"
              css={{
                textShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                _dark: {
                  textShadow: "0 4px 16px rgba(59, 130, 246, 0.4)",
                },
              }}
            >
              blue
            </Text>
            <Text
              as="span"
              css={{
                color: { _light: "gray.800", _dark: "white" },
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                _dark: {
                  textShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                },
              }}
            >
              Kit
            </Text>
          </Box>
          <Text
            fontSize="lg"
            color="fg.muted"
            textAlign="center"
            maxW="400px"
            css={{
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
            }}
          >
            The Notebook for Code
          </Text>
        </VStack>

        {/* Auth Card */}
        <Box
          p={8}
          borderRadius="2xl"
          bg={cardBg}
          css={{
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          border="1px solid"
          borderColor={
            colorMode === "light" ? "whiteAlpha.400" : "whiteAlpha.100"
          }
          boxShadow="xl"
          w={{ base: "340px", md: "380px" }}
        >
          {isLoading ? (
            <VStack gap={4} py={4}>
              <Spinner size="lg" color="primary.500" />
              <Text color="fg.muted">Loading...</Text>
            </VStack>
          ) : isAuthenticated ? (
            <VStack gap={4}>
              <HStack gap={2} color="green.500">
                <Icon as={LuSparkles} boxSize={5} />
                <Text fontWeight="medium">You're signed in!</Text>
              </HStack>
              <Button
                colorPalette="primary"
                size="lg"
                w="100%"
                onClick={onGetStarted}
                css={{
                  boxShadow: "0 4px 14px rgba(59, 130, 246, 0.4)",
                  transition: "all 0.2s ease",
                  _hover: {
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 20px rgba(59, 130, 246, 0.5)",
                  },
                }}
              >
                <HStack gap={2}>
                  <Text>Continue to BlueKit</Text>
                  <Icon as={LuArrowRight} />
                </HStack>
              </Button>
            </VStack>
          ) : (
            <VStack gap={4}>
              <Text fontSize="sm" color="fg.muted" textAlign="center">
                Sign in to sync across devices
              </Text>

              {/* OAuth Buttons */}
              <VStack gap={3} w="100%">
                <Button
                  w="100%"
                  size="lg"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  loading={signingIn === "google"}
                  disabled={signingIn !== null}
                  borderRadius="xl"
                  css={{
                    borderColor:
                      colorMode === "light" ? "gray.200" : "whiteAlpha.200",
                    _hover: {
                      bg:
                        colorMode === "light"
                          ? "whiteAlpha.600"
                          : "whiteAlpha.100",
                      borderColor: "primary.400",
                    },
                    transition: "all 0.2s",
                  }}
                >
                  <HStack gap={3}>
                    <Icon as={FaGoogle} color="red.500" />
                    <Text>Continue with Google</Text>
                  </HStack>
                </Button>

                <Button
                  w="100%"
                  size="lg"
                  variant="outline"
                  onClick={handleGitHubSignIn}
                  loading={signingIn === "github"}
                  disabled={signingIn !== null}
                  borderRadius="xl"
                  css={{
                    borderColor:
                      colorMode === "light" ? "gray.200" : "whiteAlpha.200",
                    _hover: {
                      bg:
                        colorMode === "light"
                          ? "whiteAlpha.600"
                          : "whiteAlpha.100",
                      borderColor: "primary.400",
                    },
                    transition: "all 0.2s",
                  }}
                >
                  <HStack gap={3}>
                    <Icon as={FaGithub} />
                    <Text>Continue with GitHub</Text>
                  </HStack>
                </Button>
              </VStack>

              {/* Divider */}
              <HStack w="100%" gap={4} py={2}>
                <Box
                  flex={1}
                  h="1px"
                  bg="gray.300"
                  _dark={{ bg: "whiteAlpha.200" }}
                />
                <Text fontSize="xs" color="fg.muted">
                  or
                </Text>
                <Box
                  flex={1}
                  h="1px"
                  bg="gray.300"
                  _dark={{ bg: "whiteAlpha.200" }}
                />
              </HStack>

              {/* Skip Button */}
              <Button
                w="100%"
                size="lg"
                variant="ghost"
                onClick={onGetStarted}
                borderRadius="xl"
                css={{
                  _hover: {
                    bg:
                      colorMode === "light"
                        ? "blackAlpha.50"
                        : "whiteAlpha.100",
                  },
                }}
              >
                <HStack gap={2}>
                  <Text>Continue without signing in</Text>
                  <Icon as={LuArrowRight} />
                </HStack>
              </Button>

              <Text fontSize="xs" color="fg.muted" textAlign="center">
                Your local vault works fully offline
              </Text>
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  );
}
