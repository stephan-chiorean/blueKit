import { useState } from 'react';
import {
  Dialog,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Text,
  Field,
  Icon,
  Portal,
  CloseButton,
  Menu,
  TagsInput,
} from '@chakra-ui/react';
import { LuPin, LuCheck, LuArrowUp, LuClock, LuSparkles, LuMinus } from 'react-icons/lu';
import { Task, TaskPriority, TaskStatus, TaskComplexity } from '../../types/task';
import { ProjectEntry, invokeDbCreateTask } from '../../ipc';
import ProjectMultiSelect from './ProjectMultiSelect';
import { toaster } from '../ui/toaster';

interface TaskCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (task: Task) => void;
  projects: ProjectEntry[];
  defaultProjectId?: string;  // If opened from project view
}

export default function TaskCreateDialog({
  isOpen,
  onClose,
  onTaskCreated,
  projects,
  defaultProjectId,
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('standard');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    defaultProjectId ? [defaultProjectId] : []
  );
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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
      const createdTask = await invokeDbCreateTask(
        title.trim(),
        description.trim() || undefined,
        priority,
        tags,
        selectedProjectIds,
        status,
        complexity || undefined
      );

      toaster.create({
        type: 'success',
        title: 'Task created',
        description: `Created task: ${createdTask.title}`,
      });

      onTaskCreated(createdTask);

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('standard');
      setStatus('backlog');
      setComplexity('');
      setSelectedProjectIds(defaultProjectId ? [defaultProjectId] : []);
      setTags([]);

      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to create task',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Portal>
        <Dialog.Positioner>
          <Dialog.Content maxW="xl">
            <Dialog.Header>
              <Dialog.Title>Add Task</Dialog.Title>
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
                autoFocus
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Description</Field.Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this task..."
                rows={3}
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
                      {priority === 'standard' && (
                        <Icon color="orange.500">
                          <LuMinus />
                        </Icon>
                      )}
                      <Text>
                        {priority === 'pinned' && 'Pinned'}
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
                            <Text>Pinned</Text>
                          </HStack>
                          {priority === 'pinned' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
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
                          {priority === 'high' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value="standard" onSelect={() => setPriority('standard')}>
                        <HStack gap={2} justify="space-between" width="100%">
                          <HStack gap={2}>
                            <Icon color="orange.500">
                              <LuMinus />
                            </Icon>
                            <Text>Standard</Text>
                          </HStack>
                          {priority === 'standard' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
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
                          {priority === 'long term' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
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
                          {priority === 'nit' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
              </Menu.Root>
              <Field.HelperText>
                Pinned tasks appear at the top of the list
              </Field.HelperText>
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
                          {complexity === '' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value="easy" onSelect={() => setComplexity('easy')}>
                        <HStack gap={2} justify="space-between" width="100%">
                          <Text>Easy</Text>
                          {complexity === 'easy' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value="hard" onSelect={() => setComplexity('hard')}>
                        <HStack gap={2} justify="space-between" width="100%">
                          <Text>Hard</Text>
                          {complexity === 'hard' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value="deep dive" onSelect={() => setComplexity('deep dive')}>
                        <HStack gap={2} justify="space-between" width="100%">
                          <Text>Deep dive</Text>
                          {complexity === 'deep dive' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
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
                          {status === 'backlog' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value="in_progress" onSelect={() => setStatus('in_progress')}>
                        <HStack gap={2} justify="space-between" width="100%">
                          <Text>In Progress</Text>
                          {status === 'in_progress' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value="completed" onSelect={() => setStatus('completed')}>
                        <HStack gap={2} justify="space-between" width="100%">
                          <Text>Completed</Text>
                          {status === 'completed' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value="blocked" onSelect={() => setStatus('blocked')}>
                        <HStack gap={2} justify="space-between" width="100%">
                          <Text>Blocked</Text>
                          {status === 'blocked' && (
                            <Icon color="blue.500">
                              <LuCheck />
                            </Icon>
                          )}
                        </HStack>
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
              </Menu.Root>
            </Field.Root>

            <ProjectMultiSelect
              projects={projects}
              selectedProjectIds={selectedProjectIds}
              onChange={setSelectedProjectIds}
            />

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
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={!title.trim()}
                >
                  Create
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
