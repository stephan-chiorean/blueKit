import { Box, Button, VStack, Text } from '@chakra-ui/react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      css={{
        background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      }}
    >
      <VStack gap={10} pb={16}>
        <Box
          as="h1"
          fontSize={{ base: '5xl', md: '7xl', lg: '8xl' }}
          fontWeight="bold"
          letterSpacing="-0.02em"
          lineHeight="1"
          css={{
            userSelect: 'none',
          }}
        >
          <Text
            as="span"
            color="primary.500"
            css={{
              textShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              _dark: {
                textShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
              },
            }}
          >
            blue
          </Text>
          <Text
            as="span"
            css={{
              color: { _light: 'gray.800', _dark: 'white' },
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              _dark: {
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
              },
            }}
          >
            Kit
          </Text>
        </Box>
        <Button
          colorPalette="primary"
          size="xl"
          px={10}
          py={6}
          fontSize="lg"
          fontWeight="semibold"
          onClick={onGetStarted}
          css={{
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.2s ease',
            _hover: {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(59, 130, 246, 0.5)',
            },
            _active: {
              transform: 'translateY(0)',
            },
          }}
        >
          Get Started
        </Button>
      </VStack>
    </Box>
  );
}

