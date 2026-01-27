import {
  Dialog,
  Portal,
  Input,
  InputGroup,
  Stack,
  Text,
  Checkbox,
  Box,
  Separator,
  IconButton,
  Flex,
  Heading,
  CloseButton,
} from '@chakra-ui/react';
import { LuPlus, LuTrash2, LuCheck } from 'react-icons/lu';
import { useState, useRef, useEffect } from 'react';
import { useTasks } from '@/shared/contexts/TaskContext';

interface TaskManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TaskManagerDialog({
  open,
  onOpenChange,
}: TaskManagerDialogProps) {
  const { activeTasks, completedTasks, addTask, toggleTask, deleteTask } =
    useTasks();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleAddTask = () => {
    if (inputValue.trim()) {
      addTask(inputValue);
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px" w="90vw">
            <Dialog.Header>
              <Heading size="md">Tasks</Heading>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <Stack gap={4}>
                {/* Add Task Input */}
                <InputGroup
                  endElement={
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label="Add task"
                      onClick={handleAddTask}
                      disabled={!inputValue.trim()}
                    >
                      <LuPlus />
                    </IconButton>
                  }
                >
                  <Input
                    ref={inputRef}
                    placeholder="Add a task..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    variant="subtle"
                  />
                </InputGroup>

                {/* Active Tasks */}
                {activeTasks.length > 0 && (
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb={2}>
                      Active ({activeTasks.length})
                    </Text>
                    <Stack gap={2}>
                      {activeTasks.map((task) => (
                        <Flex
                          key={task.id}
                          align="center"
                          gap={3}
                          p={2}
                          borderRadius="md"
                          _hover={{ bg: 'bg.subtle' }}
                          transition="background 0.2s"
                        >
                          <Checkbox.Root
                            checked={task.completed}
                            onCheckedChange={() => toggleTask(task.id)}
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control />
                          </Checkbox.Root>
                          <Text
                            flex="1"
                            fontSize="sm"
                            cursor="pointer"
                            onClick={() => toggleTask(task.id)}
                          >
                            {task.text}
                          </Text>
                          <IconButton
                            variant="ghost"
                            size="xs"
                            aria-label="Delete task"
                            onClick={() => deleteTask(task.id)}
                            colorPalette="red"
                          >
                            <LuTrash2 />
                          </IconButton>
                        </Flex>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                  <Box>
                    {activeTasks.length > 0 && <Separator mb={3} />}
                    <Flex align="center" gap={2} mb={2}>
                      <Box color="green.500">
                        <LuCheck size={14} />
                      </Box>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                        Completed ({completedTasks.length})
                      </Text>
                    </Flex>
                    <Stack gap={2}>
                      {completedTasks.map((task) => (
                        <Flex
                          key={task.id}
                          align="center"
                          gap={3}
                          p={2}
                          borderRadius="md"
                          opacity={0.6}
                          _hover={{ bg: 'bg.subtle', opacity: 0.8 }}
                          transition="all 0.2s"
                        >
                          <Checkbox.Root
                            checked={task.completed}
                            onCheckedChange={() => toggleTask(task.id)}
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control />
                          </Checkbox.Root>
                          <Text
                            flex="1"
                            fontSize="sm"
                            textDecoration="line-through"
                            cursor="pointer"
                            onClick={() => toggleTask(task.id)}
                          >
                            {task.text}
                          </Text>
                          <IconButton
                            variant="ghost"
                            size="xs"
                            aria-label="Delete task"
                            onClick={() => deleteTask(task.id)}
                            colorPalette="red"
                          >
                            <LuTrash2 />
                          </IconButton>
                        </Flex>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Empty State */}
                {activeTasks.length === 0 && completedTasks.length === 0 && (
                  <Box textAlign="center" py={8}>
                    <Text fontSize="sm" color="fg.muted">
                      No tasks yet. Add one above to get started!
                    </Text>
                  </Box>
                )}
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

