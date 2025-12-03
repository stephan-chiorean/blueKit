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
  NativeSelect,
  Icon,
  Portal,
  CloseButton,
} from '@chakra-ui/react';
import { LuPlus, LuPin } from 'react-icons/lu';
import { Task, TaskPriority } from '../../types/task';
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
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    defaultProjectId ? [defaultProjectId] : []
  );
  const [tags, setTags] = useState<string>('');
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
        tags.split(',').map(t => t.trim()).filter(Boolean),
        selectedProjectIds
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
      setSelectedProjectIds(defaultProjectId ? [defaultProjectId] : []);
      setTags('');

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
              <NativeSelect.Root
                value={priority}
                onChange={(e) => setPriority(e.currentTarget.value as typeof priority)}
              >
                <NativeSelect.Field>
                  <option value="pinned">
                    Pinned (appears at top)
                  </option>
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
              <Field.HelperText>
                Pinned tasks appear at the top of the list
              </Field.HelperText>
            </Field.Root>

            <ProjectMultiSelect
              projects={projects}
              selectedProjectIds={selectedProjectIds}
              onChange={setSelectedProjectIds}
            />

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
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={!title.trim()}
                >
                  <HStack gap={2}>
                    <LuPlus />
                    <Text>Add Task</Text>
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
