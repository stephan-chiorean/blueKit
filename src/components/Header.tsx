import { useState } from 'react';
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Avatar,
  Heading,
  Text,
  Icon,
  Menu,
  VStack,
  Switch,
  Input,
} from '@chakra-ui/react';
import { LuBell, LuUser, LuLogOut, LuNotebookPen, LuMenu, LuSearch } from 'react-icons/lu';
import { Project } from '../ipc';
import QuickTaskPopover from './tasks/QuickTaskPopover';
import { useColorMode } from '../contexts/ColorModeContext';
import { useGitHubAuth } from '../auth/github/GitHubAuthProvider';
import { useNotepad } from '../contexts/NotepadContext';
import { useTimer } from '../contexts/TimerContext';
import TimerPopover from './shared/TimerPopover';
import SignInPopover from './shared/SignInPopover';
import { FaMoon, FaSun } from "react-icons/fa";

import NavigationMenu from './NavigationDrawer';

interface HeaderProps {
  currentProject?: Project;
  onNavigateToTasks?: () => void;
}

export default function Header({ currentProject, onNavigateToTasks }: HeaderProps = {}) {
  const [isSignInPopoverOpen, setIsSignInPopoverOpen] = useState(false);
  const { colorMode, toggleColorMode } = useColorMode();
  const { isAuthenticated, user, signOut } = useGitHubAuth();
  const { isOpen: isNotepadOpen, toggleNotepad } = useNotepad();
  const { isPinned, elapsedTime, formatTime } = useTimer();


  // Glass styling for light/dark mode
  const headerBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(20, 20, 25, 0.15)';

  return (
    <Box
      pl={3}
      pr={6}
      py={2}
      position="sticky"
      top={0}
      zIndex={10}
      style={{
        background: headerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Flex align="center" justify="space-between" gap={4}>
        {/* blueKit branding on the left with navigation menu */}
        <HStack gap={3} flex="1">
          <NavigationMenu>
            {({ onOpen }) => (
              <IconButton
                variant="ghost"
                size="md"
                aria-label="Open navigation menu"
                onClick={onOpen}
                _hover={{ bg: 'transparent' }}
                ml={-2}
              >
                <LuMenu />
              </IconButton>
            )}
          </NavigationMenu>
          <Heading size="xl">
            <Text
              as="span"
              color="primary.500"
              css={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              blue
            </Text>
            <Text
              as="span"
              css={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              Kit
            </Text>
          </Heading>
        </HStack>

        {/* Center Search Bar */}
        <Box flex="2" display="flex" justifyContent="center" maxW="600px" px={4}>
          <Box position="relative" width="100%" maxW="400px">
            <Box
              position="absolute"
              left={4}
              top="50%"
              transform="translateY(-50%)"
              pointerEvents="none"
              zIndex={2}
              color="gray.400"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={LuSearch} fontSize="lg" />
            </Box>
            <Input
              pl={12}
              placeholder="Search..."
              variant="subtle"
              size="lg"
              borderRadius="xl"
              bg={colorMode === 'light' ? 'whiteAlpha.600' : 'blackAlpha.300'}
              border="1px solid"
              borderColor={colorMode === 'light' ? 'whiteAlpha.400' : 'whiteAlpha.100'}
              fontSize="md"
              _placeholder={{ color: 'gray.500' }}
              _hover={{
                bg: colorMode === 'light' ? 'whiteAlpha.800' : 'blackAlpha.400',
                borderColor: colorMode === 'light' ? 'whiteAlpha.400' : 'whiteAlpha.100',
              }}
              _focus={{
                bg: colorMode === 'light' ? 'white' : 'blackAlpha.500',
                borderColor: colorMode === 'light' ? 'whiteAlpha.400' : 'whiteAlpha.100',
                boxShadow: 'none',
                outline: 'none',
              }}
              css={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'all 0.2s',
              }}
            />
          </Box>
        </Box>

        {/* Right side icons */}
        <HStack gap={2} flex="1" justify="flex-end">
          {/* Pinned Timer Display */}
          {isPinned && (
            <Text
              fontSize="sm"
              fontWeight="medium"
              fontFamily="mono"
              color="primary.500"
              letterSpacing="0.05em"
              px={2}
              py={1}
            >
              {formatTime(elapsedTime)}
            </Text>
          )}

          {/* Dark Mode Toggle */}
          <Switch.Root
            checked={colorMode === 'dark'}
            onCheckedChange={toggleColorMode}
            colorPalette="blue"
            size="lg"
            cursor="pointer"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
              <Switch.Indicator fallback={<Icon as={FaSun} color="orange.400" />}>
                <Icon as={FaMoon} color="yellow.400" />
              </Switch.Indicator>
            </Switch.Control>
          </Switch.Root>

          <QuickTaskPopover
            currentProject={currentProject}
            onNavigateToTasks={onNavigateToTasks}
          />

          <TimerPopover />

          <IconButton
            variant="ghost"
            size="sm"
            aria-label={isNotepadOpen ? 'Close notepad' : 'Open notepad'}
            onClick={toggleNotepad}
            _hover={{ bg: 'transparent' }}
          >
            <LuNotebookPen />
          </IconButton>

          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Notifications"
            _hover={{ bg: 'transparent' }}
          >
            <LuBell />
          </IconButton>

          {/* User Menu */}
          {isAuthenticated && user ? (
            <Menu.Root>
              <Menu.Trigger asChild>
                <Box as="button" cursor="pointer" _hover={{ bg: 'transparent' }}>
                  <Avatar.Root size="sm">
                    {user.avatar_url ? (
                      <Avatar.Image src={user.avatar_url} alt={user.login || 'User'} />
                    ) : null}
                    <Avatar.Fallback>
                      <LuUser />
                    </Avatar.Fallback>
                  </Avatar.Root>
                </Box>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content width="240px">
                  {/* User Info */}
                  <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                    <VStack align="start" gap={1}>
                      <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>
                        {user.name || user.login}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                        @{user.login}
                      </Text>
                    </VStack>
                  </Box>

                  {/* Logout */}
                  <Menu.Item
                    value="logout"
                    onSelect={async () => {
                      try {
                        await signOut();
                        // Close sign-in popover if it's open
                        setIsSignInPopoverOpen(false);
                      } catch (error) {
                        console.error('Failed to sign out:', error);
                      }
                    }}
                  >
                    <HStack gap={2}>
                      <Icon>
                        <LuLogOut />
                      </Icon>
                      <Text>Sign Out</Text>
                    </HStack>
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          ) : (
            <SignInPopover
              isOpen={isSignInPopoverOpen}
              onOpenChange={setIsSignInPopoverOpen}
              trigger={
                <Box as="button" cursor="pointer">
                  <Avatar.Root size="sm">
                    <Avatar.Fallback>
                      <LuUser />
                    </Avatar.Fallback>
                  </Avatar.Root>
                </Box>
              }
            />
          )}
        </HStack>
      </Flex>

    </Box>
  );
}
