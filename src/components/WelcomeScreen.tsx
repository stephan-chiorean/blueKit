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
      bg="gray.50"
    >
      <VStack spacing={6}>
        <Heading size="2xl">
          <Text as="span" color="blue.500">
            blue
          </Text>
          <Text as="span">Kit</Text>
        </Heading>
        <Button
          colorScheme="blue"
          size="lg"
          onClick={onGetStarted}
        >
          Get Started
        </Button>
      </VStack>
    </Box>
  );
}

