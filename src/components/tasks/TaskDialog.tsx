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
  Icon,
  Menu,
  TagsInput,
} from '@chakra-ui/react';
import { LuSave, LuPin, LuCheck, LuArrowUp, LuClock, LuSparkles } from 'react-icons/lu';
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
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setComplexity(task.complexity || '');
      setTags(task.tags);
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
        tags,
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
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button variant="outline" w="100%" justifyContent="space-between">
                        <HStack gap={2}>
                          {priority === 'pinned' && (
                            <Icon color="blue.500">
                              <LuPin />
                            </Icon>
                          )}
                          {priority === 'high' && (
                            <Icon color="red.500">
                              <LuArrowUp />
                            </Icon>
                          )}
                          {priority === 'long term' && (
                            <Icon color="purple.500">
                              <LuClock />
                            </Icon>
                          )}
                          {priority === 'nit' && (
                            <Icon color="yellow.500">
                              <LuSparkles />
                            </Icon>
                          )}
                          <Text>
                            {priority === 'pinned' && 'Pinned (appears at top)'}
                            {priority === 'high' && 'High'}
                            {priority === 'standard' && 'Standard'}
                            {priority === 'long term' && 'Long Term'}
                            {priority === 'nit' && 'Nit'}
                          </Text>
                        </HStack>
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content>
                          <Menu.Item value="pinned" onSelect={() => setPriority('pinned')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <HStack gap={2}>
                                <Icon color="blue.500">
                                  <LuPin />
                                </Icon>
                                <Text>Pinned (appears at top)</Text>
                              </HStack>
                              {priority === 'pinned' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="high" onSelect={() => setPriority('high')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <HStack gap={2}>
                                <Icon color="red.500">
                                  <LuArrowUp />
                                </Icon>
                                <Text>High</Text>
                              </HStack>
                              {priority === 'high' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="standard" onSelect={() => setPriority('standard')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Standard</Text>
                              {priority === 'standard' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="long term" onSelect={() => setPriority('long term')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <HStack gap={2}>
                                <Icon color="purple.500">
                                  <LuClock />
                                </Icon>
                                <Text>Long Term</Text>
                              </HStack>
                              {priority === 'long term' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="nit" onSelect={() => setPriority('nit')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <HStack gap={2}>
                                <Icon color="yellow.500">
                                  <LuSparkles />
                                </Icon>
                                <Text>Nit</Text>
                              </HStack>
                              {priority === 'nit' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                  </Menu.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Complexity (optional)</Field.Label>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button variant="outline" w="100%" justifyContent="space-between">
                        <Text>
                          {complexity === '' && 'Not specified'}
                          {complexity === 'easy' && 'Easy'}
                          {complexity === 'hard' && 'Hard'}
                          {complexity === 'deep dive' && 'Deep dive'}
                        </Text>
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content>
                          <Menu.Item value="" onSelect={() => setComplexity('')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Not specified</Text>
                              {complexity === '' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="easy" onSelect={() => setComplexity('easy')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Easy</Text>
                              {complexity === 'easy' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="hard" onSelect={() => setComplexity('hard')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Hard</Text>
                              {complexity === 'hard' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="deep dive" onSelect={() => setComplexity('deep dive')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Deep dive</Text>
                              {complexity === 'deep dive' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                  </Menu.Root>
                </Field.Root>

                <Field.Root required>
                  <Field.Label>Status</Field.Label>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button variant="outline" w="100%" justifyContent="space-between">
                        <Text>
                          {status === 'backlog' && 'Backlog'}
                          {status === 'in_progress' && 'In Progress'}
                          {status === 'completed' && 'Completed'}
                          {status === 'blocked' && 'Blocked'}
                        </Text>
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content>
                          <Menu.Item value="backlog" onSelect={() => setStatus('backlog')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Backlog</Text>
                              {status === 'backlog' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="in_progress" onSelect={() => setStatus('in_progress')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>In Progress</Text>
                              {status === 'in_progress' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="completed" onSelect={() => setStatus('completed')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Completed</Text>
                              {status === 'completed' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                          <Menu.Item value="blocked" onSelect={() => setStatus('blocked')}>
                            <HStack gap={2} justify="space-between" width="100%">
                              <Text>Blocked</Text>
                              {status === 'blocked' && <LuCheck />}
                            </HStack>
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                  </Menu.Root>
                </Field.Root>

                <Field.Root>
                  <TagsInput.Root
                    value={tags}
                    onValueChange={(details) => setTags(details.value)}
                  >
                    <TagsInput.Label>Tags</TagsInput.Label>
                    <TagsInput.Control>
                      <TagsInput.Items />
                      <TagsInput.Input placeholder="Add tag..." />
                    </TagsInput.Control>
                    <TagsInput.HiddenInput />
                  </TagsInput.Root>
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



