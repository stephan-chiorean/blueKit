import {
  Box,
  Flex,
  Text,
  HStack,
} from '@chakra-ui/react';

export default function Workstation() {
  return (
    <Flex
      direction="column"
      h="100%"
      bg="gray.50"
      position="relative"
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        p={3}
        bg="white"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        minH="48px"
      >
        <HStack gap={2} flex="1">
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Workstation
          </Text>
        </HStack>
      </Flex>

      {/* Canvas Area */}
      <Box
        flex="1"
        bg="white"
        position="relative"
        overflow="auto"
      >
        {/* Simple canvas placeholder */}
        <Box
          w="100%"
          h="100%"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="text.secondary"
        >
          <Text fontSize="sm">Canvas Area</Text>
        </Box>
      </Box>
    </Flex>
  );
}

