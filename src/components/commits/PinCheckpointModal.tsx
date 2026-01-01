import { useState, useEffect } from 'react';
import {
  Dialog,
  VStack,
  HStack,
  Field,
  Input,
  Textarea,
  Button,
  Text,
  Box,
  Portal,
  CloseButton,
  SegmentGroup,
  TagsInput,
  Icon,
} from '@chakra-ui/react';
import { LuMilestone, LuFlaskConical, LuFileText, LuArchive } from 'react-icons/lu';
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
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Pre-fill form when commit changes or dialog opens
  useEffect(() => {
    if (isOpen && commit) {
      const commitMessage = commit.commit.message.split('\n')[0];
      setName(commitMessage);
      setDescription('');
      setCheckpointType('milestone');
      setTags([]);
    }
  }, [isOpen, commit]);

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

      await invokePinCheckpoint(
        projectId,
        commit.sha,
        name.trim(),
        checkpointType,
        description.trim() || undefined,
        gitBranch,
        gitUrl,
        tags.length > 0 ? tags : undefined
      );

      toaster.create({
        type: 'success',
        title: 'Checkpoint created',
        description: `Created checkpoint: ${name.trim()}`,
      });

      onCheckpointPinned();

      // Reset form
      setName('');
      setDescription('');
      setCheckpointType('milestone');
      setTags([]);

      onClose();
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to create checkpoint',
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
              <Dialog.Title>Add Checkpoint</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            {commit && (
              <Box px={6} pb={4}>
                <Text fontSize="xs" color="primary.200" as="span">
                  Commit SHA:{' '}
                  <Text as="span" fontFamily="mono" color="primary.500">
                    {commit.sha.substring(0, 7)}
                  </Text>
                </Text>
              </Box>
            )}

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root required>
                  <Field.Label>Name</Field.Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Checkpoint name"
                    autoFocus
                  />
                </Field.Root>

                <Field.Root required>
                  <Field.Label>Type</Field.Label>
                  <SegmentGroup.Root
                    value={checkpointType}
                    onValueChange={(e) => setCheckpointType(e.value as typeof checkpointType)}
                  >
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Items
                      items={[
                        {
                          value: 'milestone',
                          label: (
                            <HStack gap={1.5}>
                              <Icon color="teal.500" size="sm">
                                <LuMilestone />
                              </Icon>
                              <Text>Milestone</Text>
                            </HStack>
                          ),
                        },
                        {
                          value: 'experiment',
                          label: (
                            <HStack gap={1.5}>
                              <Icon color="#F54927" size="sm">
                                <LuFlaskConical />
                              </Icon>
                              <Text>Experiment</Text>
                            </HStack>
                          ),
                        },
                        {
                          value: 'template',
                          label: (
                            <HStack gap={1.5}>
                              <Icon color="purple.500" size="sm">
                                <LuFileText />
                              </Icon>
                              <Text>Template</Text>
                            </HStack>
                          ),
                        },
                        {
                          value: 'backup',
                          label: (
                            <HStack gap={1.5}>
                              <Icon color="orange.500" size="sm">
                                <LuArchive />
                              </Icon>
                              <Text>Backup</Text>
                            </HStack>
                          ),
                        },
                      ]}
                    />
                  </SegmentGroup.Root>
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
                  disabled={!name.trim()}
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
