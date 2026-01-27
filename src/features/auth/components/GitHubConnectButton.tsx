import { Button, HStack, Icon, Text } from '@chakra-ui/react';
import { LuGithub } from 'react-icons/lu';
import { useGitHubIntegration } from '@/shared/contexts/GitHubIntegrationContext';

interface GitHubConnectButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
}

export function GitHubConnectButton({
  size = 'lg',
  variant = 'outline'
}: GitHubConnectButtonProps) {
  const { isConnected, isConnecting, connectGitHub } = useGitHubIntegration();

  if (isConnected) {
    return null; // Already connected
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={connectGitHub}
      loading={isConnecting}
      loadingText="Connecting..."
    >
      <HStack gap={2}>
        <Icon fontSize="xl"><LuGithub /></Icon>
        <Text>Connect to GitHub</Text>
      </HStack>
    </Button>
  );
}
