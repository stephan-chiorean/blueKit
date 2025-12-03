import {
  Box,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Avatar,
  Badge,
  Heading,
  Text,
} from '@chakra-ui/react';
import { LuSearch, LuBell, LuUser, LuBriefcase } from 'react-icons/lu';
import { useSelection } from '../contexts/SelectionContext';
import { useTasks } from '../contexts/TaskContext';
import { useState } from 'react';
import TaskManagerDialog from './TaskManagerDialog';

export default function Header() {
  const { selectedItems } = useSelection();
  const { activeTasks } = useTasks();
  const taskCount = activeTasks.length;
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

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
        {/* blueKit branding on the left */}
        <Box flex="1">
          <Heading size="lg">
            <Text as="span" color="primary.500">
              blue
            </Text>
            <Text as="span">Kit</Text>
          </Heading>
        </Box>

        {/* Center search bar */}
        <Box flex="2" maxW="600px">
          <InputGroup startElement={<LuSearch />}>
            <Input
              placeholder="Search..."
              variant="subtle"
              borderWidth="1px"
              borderColor="primary.300"
            />
          </InputGroup>
        </Box>

        {/* Right side icons */}
        <HStack gap={2} flex="1" justify="flex-end">
          <Box position="relative" cursor="pointer">
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Tasks"
              onClick={() => setTaskDialogOpen(true)}
            >
              <LuBriefcase />
            </IconButton>
            {taskCount > 0 && (
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
                {taskCount}
              </Badge>
            )}
          </Box>
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
      <TaskManagerDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
      />
    </Box>
  );
}
