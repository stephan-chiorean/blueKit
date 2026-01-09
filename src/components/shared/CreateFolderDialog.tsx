import { useState } from 'react';
import {
  Dialog,
  Button,
  Field,
  Input,
  HStack,
  VStack,
  Portal,
  CloseButton,
} from '@chakra-ui/react';
import { FolderConfig } from '../../ipc';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, config: Partial<FolderConfig>) => Promise<void>;
}

/**
 * CreateFolderDialog - simple modal dialog for creating new folders.
 *
 * Only collects the folder name from the user.
 * Since folders no longer use config.json, the name is used as-is for the directory.
 */
export function CreateFolderDialog({ isOpen, onClose, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      // Config is passed for backward compatibility but not used
      const config: Partial<FolderConfig> = {
        name: name.trim(),
        tags: [],
      };
      await onCreate(name.trim(), config);

      // Reset form
      setName('');
      onClose();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setName('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !isCreating) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Dialog.Backdrop />
      <Portal>
        <Dialog.Positioner>
          <Dialog.Content maxW="md">
            <Dialog.Header>
              <Dialog.Title>Create Folder</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root required>
                  <Field.Label>Folder Name</Field.Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="my-folder"
                    disabled={isCreating}
                    autoFocus
                    _placeholder={{ color: 'fg.muted', opacity: 0.6 }}
                  />
                  <Field.HelperText>
                    Name for the new folder
                  </Field.HelperText>
                </Field.Root>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleCreate}
                  loading={isCreating}
                  disabled={!name.trim() || isCreating}
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
