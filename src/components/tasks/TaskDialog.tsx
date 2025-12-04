import {
  Dialog,
  Portal,
  CloseButton,
  Heading,
  Text,
  Box,
} from '@chakra-ui/react';
import { Task } from '../../types/task';

interface TaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDialog({ task, isOpen, onClose }: TaskDialogProps) {
  if (!task) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="2xl">
            <Dialog.Header>
              <Dialog.Title>{task.name}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              {task.description && (
                <Text fontSize="md" color="text.secondary" mb={4}>
                  {task.description}
                </Text>
              )}

              {task.acceptanceCriteria && (
                <Box>
                  <Heading size="sm" mb={3} color="text.primary">
                    Acceptance Criteria
                  </Heading>
                  <Box
                    p={4}
                    bg="bg.subtle"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Text
                      fontSize="sm"
                      color="text.secondary"
                      whiteSpace="pre-wrap"
                      lineHeight="1.6"
                    >
                      {task.acceptanceCriteria}
                    </Text>
                  </Box>
                </Box>
              )}

              {!task.acceptanceCriteria && (
                <Text fontSize="sm" color="text.tertiary" fontStyle="italic">
                  No acceptance criteria defined for this task.
                </Text>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}


