import { useState, useEffect } from 'react';
import {
  Dialog,
  Portal,
  CloseButton,
  Text,
  Button,
  VStack,
  HStack,
  Field,
  Input,
  Textarea,
  TagsInput,
} from '@chakra-ui/react';
import { SelectedItem } from '../../contexts/SelectionContext';
import { invokeReadFile, updateResourceMetadata } from '../../ipc';
import { parseFrontMatter } from '../../utils/parseFrontMatter';
import { toaster } from '../ui/toaster';

interface EditResourceMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SelectedItem | null;
  onUpdated?: () => void;
}

export default function EditResourceMetadataModal({
  isOpen,
  onClose,
  item,
  onUpdated,
}: EditResourceMetadataModalProps) {
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initial values for dirty state tracking
  const [initialAlias, setInitialAlias] = useState('');
  const [initialDescription, setInitialDescription] = useState('');
  const [initialTags, setInitialTags] = useState<string[]>([]);

  // Load current metadata when dialog opens
  useEffect(() => {
    if (isOpen && item?.path) {
      loadCurrentMetadata();
    } else {
      // Reset form when dialog closes
      setAlias('');
      setDescription('');
      setTags([]);
      setHasChanges(false);
    }
  }, [isOpen, item]);

  // Check for changes
  useEffect(() => {
    if (isOpen) {
      const changed =
        alias !== initialAlias ||
        description !== initialDescription ||
        JSON.stringify(tags.sort()) !== JSON.stringify(initialTags.sort());
      setHasChanges(changed);
    }
  }, [alias, description, tags, initialAlias, initialDescription, initialTags, isOpen]);

  const loadCurrentMetadata = async () => {
    if (!item?.path) return;

    setInitialLoading(true);
    try {
      const content = await invokeReadFile(item.path);
      const frontMatter = parseFrontMatter(content);

      const currentAlias = frontMatter?.alias || item.name;
      const currentDescription = frontMatter?.description || '';
      const currentTags = frontMatter?.tags || [];

      setAlias(currentAlias);
      setDescription(currentDescription);
      setTags(currentTags);

      // Store initial values for dirty state tracking
      setInitialAlias(currentAlias);
      setInitialDescription(currentDescription);
      setInitialTags([...currentTags]);
    } catch (error) {
      console.error('Failed to load resource metadata:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to load metadata',
        description: error instanceof Error ? error.message : 'Unknown error',
        closable: true,
      });
      // Use item name as fallback
      setAlias(item.name);
      setInitialAlias(item.name);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!item?.path) return;

    setLoading(true);
    try {
      // Build metadata object with only changed fields
      const metadata: {
        alias?: string;
        description?: string;
        tags?: string[];
      } = {};

      if (alias !== initialAlias) {
        metadata.alias = alias.trim() || undefined;
      }
      if (description !== initialDescription) {
        metadata.description = description.trim() || undefined;
      }
      if (JSON.stringify(tags.sort()) !== JSON.stringify(initialTags.sort())) {
        metadata.tags = tags;
      }

      // Only update if there are changes
      if (Object.keys(metadata).length > 0) {
        await updateResourceMetadata(item.path, metadata);

        toaster.create({
          type: 'success',
          title: 'Metadata updated',
          description: `Updated metadata for ${item.name}`,
        });

        if (onUpdated) {
          onUpdated();
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to update metadata:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to update metadata',
        description: error instanceof Error ? error.message : 'Unknown error',
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="2xl">
            <Dialog.Header>
              <Dialog.Title>Edit Resource Metadata</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              {initialLoading ? (
                <Text>Loading metadata...</Text>
              ) : (
                <VStack gap={4} align="stretch">
                  <Field.Root>
                    <Field.Label>Alias / Title</Field.Label>
                    <Input
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="Enter resource alias or title..."
                    />
                    <Field.HelperText>
                      Display name for this resource
                    </Field.HelperText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Description</Field.Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter resource description..."
                      rows={4}
                    />
                    <Field.HelperText>
                      Brief description of what this resource contains
                    </Field.HelperText>
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
                    <Field.HelperText>
                      Add tags to categorize this resource
                    </Field.HelperText>
                  </Field.Root>
                </VStack>
              )}
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={onClose} disabled={loading || initialLoading}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleSave}
                  loading={loading}
                  disabled={!hasChanges || initialLoading}
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
