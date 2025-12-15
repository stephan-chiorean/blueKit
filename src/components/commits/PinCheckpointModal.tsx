import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogContent,
  VStack,
  HStack,
  Field,
  Input,
  Textarea,
  Select,
  Button,
  Text,
  Box,
} from '@chakra-ui/react';
import { toaster } from '../ui/toaster';
import { invokePinCheckpoint } from '../../ipc/checkpoints';
import type { GitHubCommit } from '../../ipc/types';

interface PinCheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  commit: GitHubCommit | null;
  gitBranch?: string;
  gitUrl?: string;
  onCheckpointPinned: () => void;
}

export default function PinCheckpointModal({
  isOpen,
  onClose,
  projectId,
  commit,
  gitBranch,
  gitUrl,
  onCheckpointPinned,
}: PinCheckpointModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [checkpointType, setCheckpointType] = useState<'milestone' | 'experiment' | 'template' | 'backup'>('milestone');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill form when commit changes
  useEffect(() => {
    if (commit) {
      const commitMessage = commit.commit.message.split('\n')[0];
      setName(commitMessage);
      setDescription('');
      setCheckpointType('milestone');
      setTags('');
    }
  }, [commit]);

  const handleSubmit = async () => {
    if (!commit || !name.trim()) {
      toaster.create({
        title: 'Validation Error',
        description: 'Name is required',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      setLoading(true);

      // Parse tags (comma-separated)
      const tagsArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await invokePinCheckpoint(
        projectId,
        commit.sha,
        name.trim(),
        checkpointType,
        description.trim() || undefined,
        gitBranch,
        gitUrl,
        tagsArray.length > 0 ? tagsArray : undefined
      );

      toaster.create({
        title: 'Checkpoint Pinned',
        description: `Successfully pinned "${name}" as ${checkpointType}`,
        type: 'success',
        duration: 3000,
      });

      onCheckpointPinned();
      onClose();
    } catch (err) {
      toaster.create({
        title: 'Failed to Pin Checkpoint',
        description: err instanceof Error ? err.message : 'Unknown error',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pin Commit as Checkpoint</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={4}>
            <Field.Root>
              <Field.Label>Name *</Field.Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Checkpoint name"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Type *</Field.Label>
              <Select.Root
                value={checkpointType}
                onValueChange={(e) => setCheckpointType(e.value[0] as typeof checkpointType)}
              >
                <Select.Trigger>
                  <Select.ValueText />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="milestone">Milestone</Select.Item>
                  <Select.Item value="experiment">Experiment</Select.Item>
                  <Select.Item value="template">Template</Select.Item>
                  <Select.Item value="backup">Backup</Select.Item>
                </Select.Content>
              </Select.Root>
            </Field.Root>

            <Field.Root>
              <Field.Label>Description</Field.Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Tags</Field.Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comma-separated tags (e.g., release, stable)"
              />
              <Field.HelperText>
                Separate multiple tags with commas
              </Field.HelperText>
            </Field.Root>

            {commit && (
              <Box p={3} bg="bg.subtle" borderRadius="md">
                <Text fontSize="xs" color="fg.muted" mb={1}>
                  Commit SHA:
                </Text>
                <Text fontSize="xs" fontFamily="mono">
                  {commit.sha.substring(0, 7)}
                </Text>
              </Box>
            )}
          </VStack>
        </DialogBody>
        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={loading}
              loadingText="Pinning..."
            >
              Pin Checkpoint
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </Dialog.Root>
  );
}
