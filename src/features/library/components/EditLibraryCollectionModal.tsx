import { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  Field,
  Input,
  Textarea,
  VStack,
  Box,
  HStack,
} from '@chakra-ui/react';
import { LibraryCollection } from '@/ipc/library';

interface EditLibraryCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (collection: LibraryCollection) => Promise<void>;
  collection: LibraryCollection | null;
}

export default function EditLibraryCollectionModal({
  isOpen,
  onClose,
  onSave,
  collection,
}: EditLibraryCollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState('');

  // Update local state when collection changes
  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription(collection.description || '');
      
      // Parse tags from JSON array string to comma-separated string
      if (collection.tags) {
        try {
          const parsed = JSON.parse(collection.tags);
          if (Array.isArray(parsed)) {
            setTags(parsed.join(', '));
          } else {
            setTags('');
          }
        } catch {
          setTags('');
        }
      } else {
        setTags('');
      }
      
      setColor(collection.color || '');
    }
  }, [collection]);

  const handleSave = async () => {
    if (!collection || !name.trim()) return;

    // Convert comma-separated tags to JSON array string
    const tagsArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    const tagsJson = tagsArray.length > 0 ? JSON.stringify(tagsArray) : undefined;

    const updatedCollection: LibraryCollection = {
      ...collection,
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tagsJson,
      color: color.trim() || undefined,
    };

    await onSave(updatedCollection);
    handleClose();
  };

  const handleClose = () => {
    if (collection) {
      // Reset to original values
      setName(collection.name);
      setDescription(collection.description || '');
      
      if (collection.tags) {
        try {
          const parsed = JSON.parse(collection.tags);
          if (Array.isArray(parsed)) {
            setTags(parsed.join(', '));
          } else {
            setTags('');
          }
        } catch {
          setTags('');
        }
      } else {
        setTags('');
      }
      
      setColor(collection.color || '');
    }
    onClose();
  };

  if (!collection) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Edit Collection</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Field.Root>
                  <Field.Label>Collection Name</Field.Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter collection name"
                    autoFocus
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter collection description (optional)"
                    rows={3}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Tags</Field.Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Enter tags separated by commas (e.g., ui, components)"
                  />
                  <Field.HelperText>
                    Separate multiple tags with commas
                  </Field.HelperText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Color</Field.Label>
                  <HStack gap={2}>
                    <Input
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="Enter hex color (e.g., #3B82F6)"
                      maxLength={7}
                    />
                    {color && (
                      <Box
                        w={8}
                        h={8}
                        borderRadius="md"
                        bg={color}
                        borderWidth="1px"
                        borderColor="border.subtle"
                      />
                    )}
                  </HStack>
                  <Field.HelperText>
                    Optional hex color for collection border
                  </Field.HelperText>
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                onClick={handleSave}
                disabled={!name.trim()}
                colorPalette="primary"
              >
                Save
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}


