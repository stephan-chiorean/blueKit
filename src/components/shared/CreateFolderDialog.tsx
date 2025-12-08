import { useState, useMemo } from 'react';
import { DialogRoot, DialogBackdrop, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogCloseTrigger, Button, Field, Input, Textarea, HStack, VStack } from '@chakra-ui/react';
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
  const [tags, setTags] = useState('');
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
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [],
      };
      // Pass folder-friendly name as the directory name, alias goes in config.name
      await onCreate(folderName, config);

      // Reset form
      setAlias('');
      setDescription('');
      setTags('');
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
      setTags('');
      onClose();
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(details) => {
      if (!details.open) {
        handleClose();
      }
    }}>
      <DialogBackdrop />
      <DialogContent maxW="500px" position="fixed" top="50%" left="50%" transform="translate(-50%, -50%)" zIndex={1500}>
        <DialogHeader>Create Folder</DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack align='stretch' gap={4}>
            <Field.Root required>
              <Field.Label>Alias</Field.Label>
              <Input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder='UI Components'
                disabled={isCreating}
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
                placeholder='ui-components'
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
                placeholder='Reusable UI patterns'
                rows={3}
                disabled={isCreating}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Tags (comma-separated)</Field.Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder='ui, components, chakra'
                disabled={isCreating}
              />
              <Field.HelperText>
                Optional tags for categorization
              </Field.HelperText>
            </Field.Root>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <HStack gap={3}>
            <Button variant='ghost' onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              colorPalette='blue'
              onClick={handleCreate}
              loading={isCreating}
              disabled={!alias.trim() || !folderName || isCreating}
            >
              Create
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
