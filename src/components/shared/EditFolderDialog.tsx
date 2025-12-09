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
  Badge,
  Checkbox,
  IconButton,
} from '@chakra-ui/react';
import { LuPackage, LuBookOpen, LuNetwork, LuX, LuPlus, LuTrash2, LuArrowUp, LuArrowDown } from 'react-icons/lu';
import { ArtifactFolder, ArtifactFile, FolderConfig, FolderGroup, invokeUpdateFolderConfig, invokeMoveArtifactToFolder } from '../../ipc';
import { toaster } from '../ui/toaster';

interface EditFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ArtifactFolder | null;
  artifacts: ArtifactFile[];
  artifactType: 'kits' | 'walkthroughs' | 'diagrams';
  projectPath: string;
  onUpdated?: () => void;
  onOptimisticMove?: (artifactPath: string, targetFolderPath: string) => (() => void);
  onConfirmMove?: (oldPath: string, newPath: string) => void;
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
  onOptimisticMove,
  onConfirmMove,
}: EditFolderDialogProps) {
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [removingArtifacts, setRemovingArtifacts] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

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
      setGroups(folder.config?.groups ? [...folder.config.groups] : []);
    } else {
      // Reset form when dialog closes
      setAlias('');
      setDescription('');
      setTags('');
      setRemovingArtifacts(new Set());
      setGroups([]);
      setEditingGroupId(null);
      setNewGroupName('');
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
        groups: groups.length > 0 ? groups : undefined,
        createdAt: folder.config?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await invokeUpdateFolderConfig(folder.path, updatedConfig);

      // Remove artifacts that were marked for removal
      if (removingArtifacts.size > 0) {
        // Move artifacts back to the artifact type root directory
        const artifactTypeRoot = `${projectPath}/.bluekit/${artifactType}`;
        const rollbacks: (() => void)[] = [];

        // Optimistically update UI immediately for each removed artifact
        for (const artifactPath of removingArtifacts) {
          if (onOptimisticMove) {
            const rollback = onOptimisticMove(artifactPath, artifactTypeRoot);
            rollbacks.push(rollback);
          }
        }

        // Move artifacts back to artifact type root directory
        for (const artifactPath of removingArtifacts) {
          try {
            const newPath = await invokeMoveArtifactToFolder(artifactPath, artifactTypeRoot);
            // Confirm the move with actual path from backend
            if (onConfirmMove) {
              onConfirmMove(artifactPath, newPath);
            }
          } catch (error) {
            console.error(`Failed to remove artifact ${artifactPath}:`, error);
            // Rollback this specific item
            const rollback = rollbacks.find((_, idx) => Array.from(removingArtifacts)[idx] === artifactPath);
            if (rollback) rollback();
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

  // Group management functions
  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    
    const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.order)) : 0;
    const newGroup: FolderGroup = {
      id: `group-${Date.now()}`,
      order: maxOrder + 1,
      name: newGroupName.trim(),
      resourcePaths: [],
    };
    
    setGroups([...groups, newGroup]);
    setNewGroupName('');
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
    if (editingGroupId === groupId) {
      setEditingGroupId(null);
    }
  };

  const handleUpdateGroupName = (groupId: string, newName: string) => {
    setGroups(groups.map(g => 
      g.id === groupId ? { ...g, name: newName.trim() } : g
    ));
  };

  const handleToggleResourceInGroup = (groupId: string, resourcePath: string) => {
    setGroups(groups.map(group => {
      if (group.id !== groupId) return group;
      
      const hasResource = group.resourcePaths.includes(resourcePath);
      return {
        ...group,
        resourcePaths: hasResource
          ? group.resourcePaths.filter(p => p !== resourcePath)
          : [...group.resourcePaths, resourcePath],
      };
    }));
  };

  const handleMoveGroupUp = (index: number) => {
    if (index === 0) return;
    const newGroups = [...groups];
    [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];
    // Update orders
    newGroups.forEach((g, i) => {
      g.order = i + 1;
    });
    setGroups(newGroups);
  };

  const handleMoveGroupDown = (index: number) => {
    if (index === groups.length - 1) return;
    const newGroups = [...groups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
    // Update orders
    newGroups.forEach((g, i) => {
      g.order = i + 1;
    });
    setGroups(newGroups);
  };

  // Get resources that are in any group
  const groupedResourcePaths = useMemo(() => {
    const paths = new Set<string>();
    groups.forEach(group => {
      group.resourcePaths.forEach(path => paths.add(path));
    });
    return paths;
  }, [groups]);

  // Get ungrouped artifacts
  const ungroupedArtifacts = useMemo(() => {
    return folderArtifacts.filter(artifact => !groupedResourcePaths.has(artifact.path));
  }, [folderArtifacts, groupedResourcePaths]);

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

                <Separator />

                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Groups
                  </Text>
                  <Text fontSize="xs" color="text.secondary" mb={3}>
                    Organize resources into groups (similar to blueprint layers)
                  </Text>

                  {/* Add new group */}
                  <HStack gap={2} mb={4}>
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group name (e.g., Core Systems)"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGroup();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddGroup}
                      disabled={!newGroupName.trim() || loading}
                    >
                      <Icon>
                        <LuPlus />
                      </Icon>
                      Add Group
                    </Button>
                  </HStack>

                  {/* List of groups */}
                  {groups.length > 0 && (
                    <VStack align="stretch" gap={3}>
                      {groups
                        .sort((a, b) => a.order - b.order)
                        .map((group, index) => {
                          const isEditing = editingGroupId === group.id;
                          const groupResources = folderArtifacts.filter(a => 
                            group.resourcePaths.includes(a.path)
                          );
                          
                          return (
                            <Box
                              key={group.id}
                              p={3}
                              borderWidth="1px"
                              borderColor="border.subtle"
                              borderRadius="md"
                              bg="bg.subtle"
                            >
                              <VStack align="stretch" gap={3}>
                                {/* Group header */}
                                <HStack justify="space-between">
                                  <HStack gap={1} flex={1}>
                                    <IconButton
                                      size="xs"
                                      variant="ghost"
                                      aria-label="Move up"
                                      onClick={() => handleMoveGroupUp(index)}
                                      disabled={index === 0 || loading}
                                    >
                                      <Icon>
                                        <LuArrowUp />
                                      </Icon>
                                    </IconButton>
                                    <IconButton
                                      size="xs"
                                      variant="ghost"
                                      aria-label="Move down"
                                      onClick={() => handleMoveGroupDown(index)}
                                      disabled={index === groups.length - 1 || loading}
                                    >
                                      <Icon>
                                        <LuArrowDown />
                                      </Icon>
                                    </IconButton>
                                    {isEditing ? (
                                      <Input
                                        size="sm"
                                        value={group.name}
                                        onChange={(e) => handleUpdateGroupName(group.id, e.target.value)}
                                        onBlur={() => setEditingGroupId(null)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            setEditingGroupId(null);
                                          }
                                        }}
                                        autoFocus
                                      />
                                    ) : (
                                      <Badge
                                        size="sm"
                                        colorPalette="primary"
                                        cursor="pointer"
                                        onClick={() => setEditingGroupId(group.id)}
                                      >
                                        {group.name}
                                      </Badge>
                                    )}
                                  </HStack>
                                  <HStack gap={2}>
                                    <Text fontSize="xs" color="text.secondary">
                                      {groupResources.length} resource{groupResources.length !== 1 ? 's' : ''}
                                    </Text>
                                    <IconButton
                                      size="xs"
                                      variant="ghost"
                                      colorPalette="red"
                                      aria-label="Delete group"
                                      onClick={() => handleDeleteGroup(group.id)}
                                      disabled={loading}
                                    >
                                      <Icon>
                                        <LuTrash2 />
                                      </Icon>
                                    </IconButton>
                                  </HStack>
                                </HStack>

                                {/* Resources in this group */}
                                {folderArtifacts.length > 0 && (
                                  <Box pl={4} borderLeft="2px solid" borderColor="primary.200">
                                    <Text fontSize="xs" fontWeight="medium" color="text.tertiary" mb={2}>
                                      Resources:
                                    </Text>
                                    <VStack align="stretch" gap={2} maxH="200px" overflowY="auto">
                                      {folderArtifacts.map((artifact) => {
                                        const isInGroup = group.resourcePaths.includes(artifact.path);
                                        return (
                                          <Checkbox.Root
                                            key={artifact.path}
                                            checked={isInGroup}
                                            onCheckedChange={(changes) => {
                                              if (changes.checked !== isInGroup) {
                                                handleToggleResourceInGroup(group.id, artifact.path);
                                              }
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                            }}
                                            cursor="pointer"
                                          >
                                            <Checkbox.HiddenInput />
                                            <Checkbox.Control cursor="pointer">
                                              <Checkbox.Indicator />
                                            </Checkbox.Control>
                                            <Checkbox.Label cursor="pointer">
                                              <HStack gap={2}>
                                                <Icon boxSize={3} color="text.secondary">
                                                  <ArtifactIcon />
                                                </Icon>
                                                <Text fontSize="xs">
                                                  {artifact.frontMatter?.alias || artifact.name}
                                                </Text>
                                              </HStack>
                                            </Checkbox.Label>
                                          </Checkbox.Root>
                                        );
                                      })}
                                    </VStack>
                                  </Box>
                                )}
                              </VStack>
                            </Box>
                          );
                        })}
                    </VStack>
                  )}

                  {/* Show ungrouped resources if groups exist */}
                  {groups.length > 0 && ungroupedArtifacts.length > 0 && (
                    <Box mt={4} p={3} borderWidth="1px" borderColor="border.subtle" borderRadius="md" bg="bg.subtle">
                      <VStack align="stretch" gap={1}>
                        {ungroupedArtifacts.map((artifact) => (
                          <HStack key={artifact.path} gap={2}>
                            <Icon boxSize={3} color="text.secondary">
                              <ArtifactIcon />
                            </Icon>
                            <Text fontSize="xs" color="text.secondary">
                              {artifact.frontMatter?.alias || artifact.name}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </Box>

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
