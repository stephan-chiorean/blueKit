import { useState, useEffect } from 'react';
import {
  Dialog,
  Portal,
  CloseButton,
  Text,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Field,
  NativeSelect,
  Icon,
} from '@chakra-ui/react';
import { LuSave, LuPin } from 'react-icons/lu';
import { Task, TaskPriority, TaskStatus, TaskComplexity } from '../../types/task';
import { invokeDbUpdateTask } from '../../ipc';
import { toaster } from '../ui/toaster';

interface TaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export default function TaskDialog({ task, isOpen, onClose, onTaskUpdated }: TaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('standard');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>('');
  const [tags, setTags] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setComplexity(task.complexity || '');
      setTags(task.tags.join(', '));
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toaster.create({
        type: 'error',
        title: 'Title required',
        description: 'Please enter a task title',
        closable: true,
      });
      return;
    }

    setLoading(true);
    try {
      await invokeDbUpdateTask(
        task.id,
        title.trim(),
        description.trim() || undefined,
        priority,
        tags.split(',').map(t => t.trim()).filter(Boolean),
        task.projectIds, // Keep existing project associations
        status,
        complexity || undefined
      );

      toaster.create({
        type: 'success',
        title: 'Task updated',
        description: `Updated task: ${title}`,
      });

      if (onTaskUpdated) {
        onTaskUpdated();
      }

      onClose();
    } catch (error) {
      console.error('Failed to update task:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to update task',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="2xl">
            <Dialog.Header>
              <Dialog.Title>Edit Task</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root required>
                  <Field.Label>Title</Field.Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title..."
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add details about this task..."
                    rows={4}
                  />
                </Field.Root>

                <Field.Root required>
                  <Field.Label>Priority</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={priority}
                      onChange={(e) => setPriority(e.currentTarget.value as TaskPriority)}
                    >
                      <option value="pinned">Pinned (appears at top)</option>
                      <option value="high">High</option>
                      <option value="standard">Standard</option>
                      <option value="long term">Long Term</option>
                      <option value="nit">Nit</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator>
                      {priority === 'pinned' && (
                        <Icon color="primary.500">
                          <LuPin />
                        </Icon>
                      )}
                    </NativeSelect.Indicator>
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Complexity (optional)</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={complexity}
                      onChange={(e) => setComplexity(e.currentTarget.value as TaskComplexity | '')}
                    >
                      <option value="">Not specified</option>
                      <option value="easy">Easy</option>
                      <option value="hard">Hard</option>
                      <option value="deep dive">Deep dive</option>
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root required>
                  <Field.Label>Status</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={status}
                      onChange={(e) => setStatus(e.currentTarget.value as TaskStatus)}
                    >
                      <option value="backlog">Backlog</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Tags</Field.Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="frontend, backend, bug"
                  />
                  <Field.HelperText>Comma-separated tags</Field.HelperText>
                </Field.Root>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleSave}
                  loading={loading}
                  disabled={!title.trim()}
                >
                  <HStack gap={2}>
                    <LuSave />
                    <Text>Save Changes</Text>
                  </HStack>
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}



