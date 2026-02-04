import { Box, HStack, Text, Button, Icon, Badge } from '@chakra-ui/react';
import { LuCheck, LuTrash2, LuX } from 'react-icons/lu';
import { Task } from '@/types/task';
import { invokeDbUpdateTask, invokeDbDeleteTask } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';

interface TasksSelectionFooterProps {
  selectedTasks: Task[];
  isOpen: boolean;
  onClearSelection: () => void;
  onTasksUpdated: () => void;
}

export default function TasksSelectionFooter({
  selectedTasks,
  isOpen,
  onClearSelection,
  onTasksUpdated,
}: TasksSelectionFooterProps) {
  const handleComplete = async () => {
    try {
      // Update all selected tasks to completed status
      await Promise.all(
        selectedTasks.map((task) =>
          invokeDbUpdateTask(
            task.id,
            task.title,
            task.description,
            task.priority,
            task.tags,
            task.projectIds,
            'completed',
            task.complexity,
            task.type
          )
        )
      );

      toaster.create({
        type: 'success',
        title: 'Tasks completed',
        description: `Marked ${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''} as completed`,
      });

      onClearSelection();
      onTasksUpdated();
    } catch (error) {
      console.error('Failed to complete tasks:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to complete tasks',
        description: String(error),
        closable: true,
      });
    }
  };

  const handleDelete = async () => {
    try {
      // Delete all selected tasks
      await Promise.all(
        selectedTasks.map((task) => invokeDbDeleteTask(task.id))
      );

      toaster.create({
        type: 'success',
        title: 'Tasks deleted',
        description: `Deleted ${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''}`,
      });

      onClearSelection();
      onTasksUpdated();
    } catch (error) {
      console.error('Failed to delete tasks:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete tasks',
        description: String(error),
        closable: true,
      });
    }
  };

  return (
    <Box
      position="sticky"
      bottom={0}
      width="100%"
      display="grid"
      css={{
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        transition: "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <Box overflow="hidden" minHeight={0}>
        <Box
          borderTopWidth="1px"
          borderColor="border.subtle"
          py={4}
          px={6}
          css={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            _dark: {
              background: 'rgba(20, 20, 20, 0.85)',
            }
          }}
        >
          <HStack justify="space-between">
            <HStack gap={3}>
              <Badge colorPalette="blue" size="lg" variant="solid">
                {selectedTasks.length}
              </Badge>
              <Text fontWeight="medium" fontSize="sm">
                task{selectedTasks.length > 1 ? 's' : ''} selected
              </Text>
            </HStack>
            <HStack gap={2}>
              <Button size="sm" variant="ghost" colorPalette="green" onClick={handleComplete}>
                <HStack gap={1}>
                  <Icon>
                    <LuCheck />
                  </Icon>
                  <Text>Complete</Text>
                </HStack>
              </Button>
              <Button size="sm" variant="ghost" colorPalette="red" onClick={handleDelete}>
                <HStack gap={1}>
                  <Icon>
                    <LuTrash2 />
                  </Icon>
                  <Text>Delete</Text>
                </HStack>
              </Button>
              <Button size="sm" variant="ghost" colorPalette="gray" onClick={onClearSelection}>
                <HStack gap={1}>
                  <Icon>
                    <LuX />
                  </Icon>
                  <Text>Clear</Text>
                </HStack>
              </Button>
            </HStack>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}
