import { useState } from 'react';
import { Box, VStack, Text, Button, Icon, Input, HStack } from '@chakra-ui/react';
import { LuArrowRight, LuLibrary } from 'react-icons/lu';
import { open } from '@tauri-apps/api/dialog';
import { invokeDbCreateProject, invokeCreateNewProject, invokeDbGetProjects, invokeDbDeleteProject } from '../ipc';
import { toaster } from '../components/ui/toaster';
import { useColorMode } from '../contexts/ColorModeContext';
import { ActiveLogo as BlueKitLogo } from '../components/logo';

interface LibrarySetupScreenProps {
    onLibraryCreated: () => void;
}

export default function LibrarySetupScreen({ onLibraryCreated }: LibrarySetupScreenProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [libraryName, setLibraryName] = useState('My Library');
    const { colorMode } = useColorMode();

    const handleCreateLibrary = async () => {
        try {
            setIsLoading(true);
            const selectedPath = await open({
                directory: true,
                multiple: false,
                title: 'Select Library Directory',
            });

            if (!selectedPath || typeof selectedPath !== 'string') {
                setIsLoading(false);
                return;
            }

            // 1. Construct the full path (create a subfolder)
            // Handle potentially missing trailing slash, though open dialog usually doesn't have it
            const vaultPath = selectedPath.endsWith('/')
                ? `${selectedPath}${libraryName}`
                : `${selectedPath}/${libraryName}`;

            // 2. Create the physical folder structure and initial project registration
            // This creates the folder and .bluekit directory
            await invokeCreateNewProject(
                vaultPath,
                libraryName,
                [] // No initial files needed
            );

            // 3. The project is now registered as a normal project. We need to convert it to a vault.
            // Since we can't update 'isVault' flag directly, we'll unregister and re-register.

            // Find the project we just created to get its ID
            const allProjects = await invokeDbGetProjects();
            const createdProject = allProjects.find(p => p.path === vaultPath);

            if (createdProject) {
                // Remove the standard project registration
                await invokeDbDeleteProject(createdProject.id);
            }

            // 4. Re-register as a Vault
            await invokeDbCreateProject(
                libraryName,
                vaultPath,
                'My BlueKit Library',
                ['vault'],
                true // isVault = true
            );

            toaster.create({
                title: 'Library Created',
                description: 'Your new library has been set up successfully.',
                type: 'success',
            });

            onLibraryCreated();
        } catch (error) {
            console.error('Failed to create library:', error);
            toaster.create({
                title: 'Error',
                description: 'Failed to create library. Please try again.',
                type: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const cardBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(30, 30, 40, 0.5)';

    return (
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            minH="100vh"
            w="100vw"
            css={{
                background: {
                    _light: 'rgba(255, 255, 255, 0.1)',
                    _dark: 'rgba(0, 0, 0, 0.15)',
                },
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            }}
        >
            <VStack gap={12} pb={16}>
                {/* Logo and Branding - Matches WelcomeScreen */}
                <VStack gap={6}>
                    <BlueKitLogo size={140} />
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
                        Create your library
                    </Text>
                </VStack>

                {/* Library Creation Card */}
                <Box
                    p={8}
                    borderRadius="2xl"
                    bg={cardBg}
                    css={{
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                    }}
                    border="1px solid"
                    borderColor={colorMode === 'light' ? 'whiteAlpha.400' : 'whiteAlpha.100'}
                    boxShadow="xl"
                    w={{ base: '340px', md: '420px' }}
                >
                    <VStack gap={6} w="100%">
                        <Box w="100%">
                            <Text mb={2} fontSize="sm" fontWeight="medium" color="fg.muted">Library Name</Text>
                            <Input
                                value={libraryName}
                                onChange={(e) => setLibraryName(e.target.value)}
                                placeholder="My Library"
                                size="lg"
                                bg={colorMode === 'light' ? 'whiteAlpha.500' : 'blackAlpha.300'}
                                border="1px solid" // Explicit border
                                borderColor="border" // Use theme token or explicit color
                                _focus={{
                                    borderColor: "primary.500",
                                    boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)"
                                }}
                            />
                        </Box>

                        <Button
                            colorPalette="primary"
                            size="lg"
                            w="100%"
                            onClick={handleCreateLibrary}
                            loading={isLoading}
                            css={{
                                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                                transition: 'all 0.2s ease',
                                _hover: {
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.5)',
                                },
                            }}
                        >
                            <HStack gap={2}>
                                <Icon as={LuLibrary} />
                                <Text>Create Library</Text>
                                <Icon as={LuArrowRight} />
                            </HStack>
                        </Button>

                        <Text fontSize="xs" color="fg.muted" textAlign="center">
                            Your library is stored locally on your device
                        </Text>
                    </VStack>
                </Box>
            </VStack>
        </Box>
    );
}
