import {
  Box,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Avatar,
  Popover,
  Badge,
  Stack,
  Text,
  Tag,
  Portal,
} from '@chakra-ui/react';
import { LuSearch, LuBell, LuUser, LuBriefcase } from 'react-icons/lu';
import { useSelection } from '../contexts/SelectionContext';
import { useColorMode } from '../contexts/ColorModeContext';

export default function Header() {
  const { selectedItems } = useSelection();
  const { colorMode } = useColorMode();
  const selectedCount = selectedItems.length;

  return (
    <Box
      bg="bg.subtle"
      px={6}
      py={2}
      position="sticky"
      top={0}
      zIndex={10}
      boxShadow="sm"
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
              borderWidth="1px"
              borderColor={colorMode === 'dark' ? 'gray.700' : 'primary.300'}
            />
          </InputGroup>
        </Box>

        {/* Right side icons */}
        <HStack gap={2} flex="1" justify="flex-end">
          <Popover.Root>
            <Popover.Trigger asChild>
              <Box position="relative" cursor="pointer">
                <IconButton variant="ghost" size="sm" aria-label="Workstation">
                  <LuBriefcase />
                </IconButton>
                {selectedCount > 0 && (
                  <Badge
                    position="absolute"
                    top="-1"
                    right="-1"
                    colorPalette="primary"
                    variant="solid"
                    borderRadius="full"
                    minW="18px"
                    h="18px"
                    fontSize="xs"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    px={1}
                  >
                    {selectedCount}
                  </Badge>
                )}
              </Box>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content maxW="300px">
                  <Popover.Header>
                    <Text fontWeight="semibold" fontSize="sm">
                      Selected Items
                    </Text>
                  </Popover.Header>
                  <Popover.Body>
                    {selectedItems.length > 0 ? (
                      <Stack gap={2}>
                        {selectedItems.map((item) => (
                          <Flex key={item.id} align="center" justify="space-between" gap={2}>
                            <Text fontSize="sm">{item.name}</Text>
                            <Tag.Root size="sm" variant="subtle">
                              <Tag.Label>{item.type}</Tag.Label>
                            </Tag.Root>
                          </Flex>
                        ))}
                      </Stack>
                    ) : (
                      <Text fontSize="sm" color="fg.muted">
                        No items selected
                      </Text>
                    )}
                  </Popover.Body>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
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
