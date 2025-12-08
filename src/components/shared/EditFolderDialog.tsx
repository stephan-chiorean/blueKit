import { useState, useEffect, useMemo } from 'react';
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
  Icon,
  Box,
  Separator,
} from '@chakra-ui/react';
import { LuPackage, LuBookOpen, LuNetwork, LuX } from 'react-icons/lu';
import { ArtifactFolder, ArtifactFile, FolderConfig, invokeUpdateFolderConfig, invokeMoveArtifactToFolder } from '../../ipc';
import { toaster } from '../ui/toaster';

interface EditFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ArtifactFolder | null;
  artifacts: ArtifactFile[];
  artifactType: 'kits' | 'walkthroughs' | 'diagrams';
  projectPath: string;
  onUpdated?: () => void;
}

/**
 * Converts a display name/alias to a folder-friendly name (slugified).
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export default function EditFolderDialog({
  isOpen,
  onClose,
  folder,
  artifacts,
  artifactType,
  projectPath,
  onUpdated,
}: EditFolderDialogProps) {
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [removingArtifacts, setRemovingArtifacts] = useState<Set<string>>(new Set());

  // Get the icon for the artifact type
  const getArtifactIcon = () => {
    switch (artifactType) {
      case 'kits':
        return LuPackage;
      case 'walkthroughs':
        return LuBookOpen;
      case 'diagrams':
        return LuNetwork;
      default:
        return LuPackage;
    }
  };

  const ArtifactIcon = getArtifactIcon();

  // Load folder data when dialog opens
  useEffect(() => {
    if (isOpen && folder) {
      setAlias(folder.config?.name || folder.name);
      setDescription(folder.config?.description || '');
      setTags(folder.config?.tags?.join(', ') || '');
    } else {
      // Reset form when dialog closes
      setAlias('');
      setDescription('');
      setTags('');
      setRemovingArtifacts(new Set());
    }
  }, [isOpen, folder]);

  // Get artifacts in this folder
  const folderArtifacts = useMemo(() => {
    if (!folder) return [];
    return artifacts.filter(artifact => artifact.path.startsWith(folder.path + '/'));
  }, [artifacts, folder]);

  const handleSave = async () => {
    if (!folder) return;

    setLoading(true);
    try {
      // Update folder config
      const updatedConfig: FolderConfig = {
        id: folder.config?.id || `${slugify(alias)}-${Date.now()}`,
        name: alias,
        description: description || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [],
        color: folder.config?.color,
        icon: folder.config?.icon,
        createdAt: folder.config?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await invokeUpdateFolderConfig(folder.path, updatedConfig);

      // Remove artifacts that were marked for removal
      if (removingArtifacts.size > 0) {
        // Move artifacts back to the artifact type root directory
        const artifactTypeRoot = `${projectPath}/.bluekit/${artifactType}`;

        for (const artifactPath of removingArtifacts) {
          try {
            // Move artifact back to artifact type root directory
            await invokeMoveArtifactToFolder(artifactPath, artifactTypeRoot);
          } catch (error) {
            console.error(`Failed to remove artifact ${artifactPath}:`, error);
            toaster.create({
              type: 'error',
              title: 'Failed to remove artifact',
              description: `Could not remove ${artifactPath}`,
              closable: true,
            });
          }
        }
      }

      toaster.create({
        type: 'success',
        title: 'Folder updated',
        description: `Updated ${alias}`,
      });

      if (onUpdated) {
        onUpdated();
      }

      onClose();
    } catch (error) {
      console.error('Failed to update folder:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to update folder',
        description: error instanceof Error ? error.message : 'Unknown error',
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveArtifact = (artifactPath: string) => {
    setRemovingArtifacts(prev => new Set(prev).add(artifactPath));
  };

  const handleUndoRemove = (artifactPath: string) => {
    setRemovingArtifacts(prev => {
      const next = new Set(prev);
      next.delete(artifactPath);
      return next;
    });
  };

  if (!folder) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Edit Folder</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Field.Root required>
                  <Field.Label>Alias</Field.Label>
                  <Input
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder='UI Components'
                    disabled={loading}
                  />
                  <Field.HelperText>
                    Display name for the folder (what's rendered)
                  </Field.HelperText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder='Reusable UI patterns'
                    rows={3}
                    disabled={loading}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Tags (comma-separated)</Field.Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder='ui, components, chakra'
                    disabled={loading}
                  />
                  <Field.HelperText>
                    Optional tags for categorization
                  </Field.HelperText>
                </Field.Root>

                {folderArtifacts.length > 0 && (
                  <>
                    <Separator />
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={3}>
                        Artifacts in Folder ({folderArtifacts.length})
                      </Text>
                      <VStack align="stretch" gap={2} maxH="300px" overflowY="auto">
                        {folderArtifacts.map((artifact) => {
                          const isRemoving = removingArtifacts.has(artifact.path);
                          const displayName = artifact.frontMatter?.alias || artifact.name;
                          return (
                            <HStack
                              key={artifact.path}
                              p={2}
                              borderRadius="md"
                              bg={isRemoving ? 'red.50' : 'bg.subtle'}
                              borderWidth="1px"
                              borderColor={isRemoving ? 'red.200' : 'border.subtle'}
                              justify="space-between"
                            >
                              <HStack gap={2} flex={1}>
                                <Icon boxSize={4} color={isRemoving ? 'red.500' : 'text.secondary'}>
                                  <ArtifactIcon />
                                </Icon>
                                <Text
                                  fontSize="sm"
                                  textDecoration={isRemoving ? 'line-through' : 'none'}
                                  color={isRemoving ? 'red.600' : 'text.primary'}
                                >
                                  {displayName}
                                </Text>
                              </HStack>
                              {isRemoving ? (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => handleUndoRemove(artifact.path)}
                                >
                                  <HStack gap={1}>
                                    <Icon>
                                      <LuX />
                                    </Icon>
                                    <Text>Undo</Text>
                                  </HStack>
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorPalette="red"
                                  onClick={() => handleRemoveArtifact(artifact.path)}
                                >
                                  Remove
                                </Button>
                              )}
                            </HStack>
                          );
                        })}
                      </VStack>
                    </Box>
                  </>
                )}
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
                  disabled={!alias.trim()}
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
