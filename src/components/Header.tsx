import {
  Box,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Avatar,
} from '@chakra-ui/react';
import { LuSearch, LuBell, LuUser } from 'react-icons/lu';

export default function Header() {
  return (
    <Box
      bg="header.bg"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      px={6}
      py={3}
    >
      <Flex align="center" justify="space-between" gap={4}>
        {/* Left spacer to balance the layout */}
        <Box flex="1" />

        {/* Center search bar */}
        <Box flex="2" maxW="600px">
          <InputGroup startElement={<LuSearch />}>
            <Input
              placeholder="Search..."
              variant="subtle"
            />
          </InputGroup>
        </Box>

        {/* Right side icons */}
        <HStack gap={2} flex="1" justify="flex-end">
          <IconButton variant="ghost" size="sm" aria-label="Notifications">
            <LuBell />
          </IconButton>
          <Avatar.Root size="sm">
            <Avatar.Fallback>
              <LuUser />
            </Avatar.Fallback>
          </Avatar.Root>
        </HStack>
      </Flex>
    </Box>
  );
}

