import { useState, useEffect } from 'react';
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
  SegmentGroup,
  TagsInput,
} from '@chakra-ui/react';
import { LuPin, LuArrowUp, LuClock, LuSparkles, LuMinus, LuBug, LuSearch, LuStar, LuBrush, LuZap, LuSquareCheck } from 'react-icons/lu';
import { Task, TaskPriority, TaskStatus, TaskComplexity, TaskType } from '../../types/task';
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
  const [type, setType] = useState<TaskType | ''>('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    defaultProjectId ? [defaultProjectId] : []
  );
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset selected projects when defaultProjectId changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectIds(defaultProjectId ? [defaultProjectId] : []);
    }
  }, [isOpen, defaultProjectId]);

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
        complexity || undefined,
        type || undefined
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
      setType('');
      setTags([]);
      // Note: selectedProjectIds will be reset by useEffect when dialog reopens

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
          <Dialog.Content maxW="4xl">
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
              <SegmentGroup.Root
                value={priority}
                onValueChange={(e) => setPriority(e.value as TaskPriority)}
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items
                  items={[
                    {
                      value: 'pinned',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="blue.500" size="sm">
                            <LuPin />
                          </Icon>
                          <Text>Pinned</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'high',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="red.500" size="sm">
                            <LuArrowUp />
                          </Icon>
                          <Text>High</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'standard',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="orange.500" size="sm">
                            <LuMinus />
                          </Icon>
                          <Text>Standard</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'long term',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="purple.500" size="sm">
                            <LuClock />
                          </Icon>
                          <Text>Long Term</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'nit',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="yellow.500" size="sm">
                            <LuSparkles />
                          </Icon>
                          <Text>Nit</Text>
                        </HStack>
                      ),
                    },
                  ]}
                />
              </SegmentGroup.Root>
              <Field.HelperText>
                Pinned tasks appear at the top of the list
              </Field.HelperText>
            </Field.Root>

            <Field.Root>
              <Field.Label>Complexity (optional)</Field.Label>
              <SegmentGroup.Root
                value={complexity || undefined}
                onValueChange={(e) => setComplexity(e.value as TaskComplexity | '')}
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items
                  items={[
                    { value: 'easy', label: 'Easy' },
                    { value: 'hard', label: 'Hard' },
                    { value: 'deep dive', label: 'Deep dive' },
                  ]}
                />
              </SegmentGroup.Root>
            </Field.Root>

            <Field.Root>
              <Field.Label>Type (optional)</Field.Label>
              <SegmentGroup.Root
                value={type || undefined}
                onValueChange={(e) => setType(e.value as TaskType | '')}
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items
                  items={[
                    {
                      value: 'bug',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="red.500" size="sm">
                            <LuBug />
                          </Icon>
                          <Text>Bug</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'investigation',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="purple.500" size="sm">
                            <LuSearch />
                          </Icon>
                          <Text>Investigation</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'feature',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="blue.500" size="sm">
                            <LuStar />
                          </Icon>
                          <Text>Feature</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'cleanup',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="gray.500" size="sm">
                            <LuBrush />
                          </Icon>
                          <Text>Cleanup</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'optimization',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="yellow.500" size="sm">
                            <LuZap />
                          </Icon>
                          <Text>Optimization</Text>
                        </HStack>
                      ),
                    },
                    {
                      value: 'chore',
                      label: (
                        <HStack gap={1.5}>
                          <Icon color="green.500" size="sm">
                            <LuSquareCheck />
                          </Icon>
                          <Text>Chore</Text>
                        </HStack>
                      ),
                    },
                  ]}
                />
              </SegmentGroup.Root>
            </Field.Root>

            <Field.Root required>
              <Field.Label>Status</Field.Label>
              <SegmentGroup.Root
                value={status}
                onValueChange={(e) => setStatus(e.value as TaskStatus)}
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items
                  items={[
                    { value: 'backlog', label: 'Backlog' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'blocked', label: 'Blocked' },
                  ]}
                />
              </SegmentGroup.Root>
            </Field.Root>

            <ProjectMultiSelect
              projects={projects}
              selectedProjectIds={selectedProjectIds}
              onChange={setSelectedProjectIds}
            />
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
