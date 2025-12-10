import { useState, useMemo } from 'react';
import {
  Dialog,
  Button,
  Field,
  Input,
  Textarea,
  HStack,
  VStack,
  Portal,
  CloseButton,
  TagsInput,
} from '@chakra-ui/react';
import { FolderConfig } from '../../ipc';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, config: Partial<FolderConfig>) => Promise<void>;
}

/**
 * Converts a display name/alias to a folder-friendly name (slugified).
 * - Converts to lowercase
 * - Removes special characters
 * - Replaces spaces/underscores with hyphens
 * - Removes leading/trailing hyphens
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * CreateFolderDialog - modal dialog for creating new folders.
 *
 * Collects folder alias (display name), description, and tags from the user.
 * The alias is stored in config.name and displayed in the UI.
 * A folder-friendly name is auto-generated from the alias and used as the directory name.
 * Calls onCreate with the folder-friendly name and a partial FolderConfig containing the alias.
 *
 * @example
 * ```tsx
 * <CreateFolderDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onCreate={async (folderName, config) => {
 *     const fullConfig = {
 *       ...config,
 *       id: `${folderName}-${Date.now()}`,
 *       createdAt: new Date().toISOString(),
 *       updatedAt: new Date().toISOString(),
 *     };
 *     // folderName is the slugified directory name, config.name is the alias
 *     await invokeCreateArtifactFolder(projectPath, 'kits', null, folderName, fullConfig);
 *   }}
 * />
 * ```
 */
export function CreateFolderDialog({ isOpen, onClose, onCreate }: CreateFolderDialogProps) {
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Generate folder-friendly name from alias
  const folderName = useMemo(() => {
    if (!alias.trim()) return '';
    return slugify(alias);
  }, [alias]);

  const handleCreate = async () => {
    if (!alias.trim() || !folderName) return;

    setIsCreating(true);
    try {
      const config: Partial<FolderConfig> = {
        name: alias, // Alias is stored as the display name in config
        description: description || undefined,
        tags: tags,
      };
      // Pass folder-friendly name as the directory name, alias goes in config.name
      await onCreate(folderName, config);

      // Reset form
      setAlias('');
      setDescription('');
      setTags([]);
      onClose();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      // Reset form on cancel
      setAlias('');
      setDescription('');
      setTags([]);
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Dialog.Backdrop />
      <Portal>
        <Dialog.Positioner>
          <Dialog.Content maxW="xl">
            <Dialog.Header>
              <Dialog.Title>Create Folder</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root required>
                  <Field.Label>Alias</Field.Label>
                  <Input
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="UI Components"
                    disabled={isCreating}
                    autoFocus
                    _placeholder={{ color: 'fg.muted', opacity: 0.6 }}
                  />
                  <Field.HelperText>
                    Display name for the folder (what's rendered)
                  </Field.HelperText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Folder Name</Field.Label>
                  <Input
                    value={folderName}
                    disabled
                    placeholder="ui-components"
                  />
                  <Field.HelperText>
                    Folder-friendly name (auto-generated from alias)
                  </Field.HelperText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Reusable UI patterns"
                    rows={3}
                    disabled={isCreating}
                    _placeholder={{ color: 'fg.muted', opacity: 0.6 }}
                  />
                </Field.Root>

                <Field.Root>
                  <TagsInput.Root
                    value={tags}
                    onValueChange={(details) => setTags(details.value)}
                    disabled={isCreating}
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
                <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleCreate}
                  loading={isCreating}
                  disabled={!alias.trim() || !folderName || isCreating}
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
