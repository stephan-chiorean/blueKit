import { Box, Button, VStack, Heading, Text } from '@chakra-ui/react';

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
      <VStack gap={6}>
        <Heading size="2xl">
          <Text
            as="span"
            color="primary.500"
            css={{
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              _dark: {
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
              },
            }}
          >
            blue
          </Text>
          <Text
            as="span"
            css={{
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              _dark: {
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
              },
            }}
          >
            Kit
          </Text>
        </Heading>
        <Button
          colorPalette="primary"
          size="lg"
          onClick={onGetStarted}
        >
          Get Started
        </Button>
      </VStack>
    </Box>
  );
}

