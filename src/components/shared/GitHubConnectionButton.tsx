/**
 * GitHub Connection Button.
 *
 * A simple button/menu for connecting or disconnecting GitHub.
 * Used in the header to show connection status and allow user actions.
 */

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
} from '@chakra-ui/react';
import { FaGithub } from 'react-icons/fa';
import { LuUser, LuLogOut } from 'react-icons/lu';
import { useGitHubIntegration } from '../../contexts/GitHubIntegrationContext';

export default function GitHubConnectionButton() {
  const {
    isConnected,
    isLoading,
    isConnecting,
    user,
    connectGitHub,
    disconnectGitHub,
  } = useGitHubIntegration();

  // Loading state (checking for stored token on mount)
  if (isLoading) {
    return (
      <Box p={1}>
        <Spinner size="sm" />
      </Box>
    );
  }

  // Connected state - show user menu
  if (isConnected && user) {
    return (
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

            {/* Disconnect */}
            <Menu.Item
              value="disconnect"
              onSelect={async () => {
                try {
                  await disconnectGitHub();
                } catch (error) {
                  console.error('Failed to disconnect:', error);
                }
              }}
            >
              <HStack gap={2}>
                <Icon>
                  <LuLogOut />
                </Icon>
                <Text>Disconnect GitHub</Text>
              </HStack>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    );
  }

  // Not connected state - show connect button
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={connectGitHub}
      loading={isConnecting}
      loadingText="Connecting..."
      _hover={{ bg: 'transparent' }}
    >
      <HStack gap={2}>
        <Icon>
          <FaGithub />
        </Icon>
        <Text display={{ base: 'none', md: 'inline' }}>Connect GitHub</Text>
      </HStack>
    </Button>
  );
}
