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
  SegmentGroup,
  TagsInput,
} from '@chakra-ui/react';
import { LuPin, LuArrowUp, LuClock, LuSparkles, LuMinus } from 'react-icons/lu';
import { Task, TaskPriority, TaskStatus, TaskComplexity } from '../../types/task';
import { ProjectEntry, invokeDbUpdateTask, invokeGetProjectRegistry } from '../../ipc';
import { toaster } from '../ui/toaster';
import ProjectMultiSelect from './ProjectMultiSelect';

interface EditTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export default function EditTaskDialog({ task, isOpen, onClose, onTaskUpdated }: EditTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('standard');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const registryProjects = await invokeGetProjectRegistry();
        setProjects(registryProjects);
      } catch (error) {
        console.error('Failed to load projects in EditTaskDialog:', error);
      }
    };
    loadProjects();
  }, []);

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setComplexity(task.complexity || '');
      setTags(task.tags);
      setSelectedProjectIds(task.projectIds || []);
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
        selectedProjectIds,
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
          <Dialog.Content maxW="4xl">
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
                    rows={4}
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
                </Field.Root>

                <Field.Root>
                  <Field.Label>Complexity (optional)</Field.Label>
                  <SegmentGroup.Root
                    value={complexity || ''}
                    onValueChange={(e) => setComplexity(e.value as TaskComplexity | '')}
                  >
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Items
                      items={[
                        { value: '', label: 'Not specified' },
                        { value: 'easy', label: 'Easy' },
                        { value: 'hard', label: 'Hard' },
                        { value: 'deep dive', label: 'Deep dive' },
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
                  onClick={handleSave}
                  loading={loading}
                  disabled={!title.trim()}
                >
                  Save
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}



