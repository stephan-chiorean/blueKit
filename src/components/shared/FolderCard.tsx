import { Box, Card, CardHeader, CardBody, Heading, HStack, Icon, Text, VStack, Flex, Menu, IconButton, Badge, Checkbox, Portal, Spinner } from '@chakra-ui/react';
import { LuFolder, LuChevronRight, LuPackage, LuBookOpen, LuNetwork, LuPencil, LuTrash2, LuPlus } from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { FolderTreeNode, ArtifactFile, ArtifactFolder, FolderGroup } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';

interface FolderCardProps {
  node: FolderTreeNode;
  artifactType: 'kits' | 'walkthroughs' | 'diagrams';
  onToggleExpand: () => void;
  onViewArtifact: (artifact: ArtifactFile) => void;
  onAddToFolder: (folder: ArtifactFolder) => void;
  onEdit: (folder: ArtifactFolder) => void;
  onDelete: (folder: ArtifactFolder) => void;
  hasCompatibleSelection: boolean;
  renderArtifactCard: (artifact: ArtifactFile) => React.ReactNode; // Currently unused, kept for API compatibility
  movingArtifacts?: Set<string>;
}

/**
 * FolderCard component - displays a collapsible folder with click-to-add support.
 *
 * Features:
 * - Collapsible (expand/collapse to show contents)
 * - Click to add selected items to folder
 * - 3-dots menu for Edit/Delete actions
 * - Displays folder metadata (name, description, color)
 */
export function FolderCard({
  node,
  artifactType,
  onToggleExpand,
  onViewArtifact,
  onAddToFolder,
  onEdit,
  onDelete,
  hasCompatibleSelection,
  movingArtifacts = new Set(),
}: FolderCardProps) {
  const { folder, children, artifacts, isExpanded } = node;
  const { isSelected, toggleItem } = useSelection();

  const displayName = folder.config?.name || folder.name;
  const description = folder.config?.description;
  const color = folder.config?.color;
  const groups = folder.config?.groups;

  // Map artifact type to selection type
  const getSelectionType = (): 'Kit' | 'Walkthrough' | 'Diagram' => {
    switch (artifactType) {
      case 'kits':
        return 'Kit';
      case 'walkthroughs':
        return 'Walkthrough';
      case 'diagrams':
        return 'Diagram';
    }
  };

  const selectionType = getSelectionType();

  const handleArtifactToggle = (artifact: ArtifactFile) => {
    toggleItem({
      id: artifact.path,
      name: artifact.frontMatter?.alias || artifact.name,
      type: selectionType,
      path: artifact.path,
    });
  };

  // Get the icon for the artifact type (matching tab icons)
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

  // Organize artifacts by groups if groups exist
  const organizeArtifactsByGroups = () => {
    if (!groups || groups.length === 0) {
      return null;
    }

    // Create a map of resource paths to artifacts
    const artifactMap = new Map<string, ArtifactFile>();
    artifacts.forEach(artifact => {
      artifactMap.set(artifact.path, artifact);
    });

    // Create a set of all grouped resource paths
    const groupedPaths = new Set<string>();
    groups.forEach(group => {
      group.resourcePaths.forEach(path => groupedPaths.add(path));
    });

    // Organize artifacts by group
    const groupedArtifacts: Array<{ group: FolderGroup; artifacts: ArtifactFile[] }> = [];
    const ungroupedArtifacts: ArtifactFile[] = [];

    // Process each group
    groups
      .sort((a, b) => a.order - b.order)
      .forEach(group => {
        const groupArtifacts: ArtifactFile[] = [];
        group.resourcePaths.forEach(path => {
          const artifact = artifactMap.get(path);
          if (artifact) {
            groupArtifacts.push(artifact);
          }
        });
        if (groupArtifacts.length > 0) {
          groupedArtifacts.push({ group, artifacts: groupArtifacts });
        }
      });

    // Find ungrouped artifacts
    artifacts.forEach(artifact => {
      if (!groupedPaths.has(artifact.path)) {
        ungroupedArtifacts.push(artifact);
      }
    });

    return { groupedArtifacts, ungroupedArtifacts };
  };

  const groupedData = organizeArtifactsByGroups();

  return (
    <Card.Root
      variant='subtle'
      borderWidth='1px'
      borderColor='border.subtle'
      cursor='pointer'
      onClick={onToggleExpand}
      _hover={{ borderColor: 'blue.400', bg: 'primary.hover.bg' }}
      position='relative'
      overflow='visible'
      css={{
        contain: 'layout style',
      }}
    >
      <CardHeader>
        <Flex align='center' justify='space-between' gap={4}>
          <HStack gap={2} align='center' flex={1}>
            <Icon
              transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
              transition='transform 0.2s'
            >
              <LuChevronRight />
            </Icon>
            <Icon boxSize={6} color={color || 'blue.500'}>
              <LuFolder />
            </Icon>
            <Heading size='lg'>{displayName}</Heading>
          </HStack>
          <Box flexShrink={0}>
            {hasCompatibleSelection ? (
              <IconButton
                variant='ghost'
                size='sm'
                aria-label='Add selected items to folder'
                colorPalette='blue'
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToFolder(folder);
                }}
              >
                <Icon>
                  <LuPlus />
                </Icon>
              </IconButton>
            ) : (
              <Menu.Root>
                <Menu.Trigger asChild>
                  <IconButton
                    variant='ghost'
                    size='sm'
                    aria-label='Folder options'
                    onClick={(e) => e.stopPropagation()}
                    bg="transparent"
                    _hover={{ bg: "transparent" }}
                    _active={{ bg: "transparent" }}
                    _focus={{ bg: "transparent" }}
                    _focusVisible={{ bg: "transparent" }}
                  >
                    <Icon>
                      <IoIosMore />
                    </Icon>
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item value='edit' onSelect={() => {
                        onEdit(folder);
                      }}>
                        <HStack gap={2}>
                          <Icon>
                            <LuPencil />
                          </Icon>
                          <Text fontSize='md'>Edit</Text>
                        </HStack>
                      </Menu.Item>
                      <Menu.Item value='delete' onSelect={() => {
                        onDelete(folder);
                      }}>
                        <HStack gap={2}>
                          <Icon>
                            <LuTrash2 />
                          </Icon>
                          <Text fontSize='md'>Delete</Text>
                        </HStack>
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            )}
          </Box>
        </Flex>
      </CardHeader>
      <CardBody display='flex' flexDirection='column' flex='1'>
        <VStack align='stretch' gap={2}>
          {description && (
            <Text fontSize='md' color='text.secondary'>
              {description}
            </Text>
          )}
        </VStack>

        <Box
          maxHeight={isExpanded ? '2000px' : '0px'}
          overflow='hidden'
          opacity={isExpanded ? 1 : 0}
          transition='max-height 0.3s ease-out, opacity 0.2s ease-out'
        >
          {(artifacts.length > 0 || children.length > 0) && (
            <Box mt={4} pt={4} borderTopWidth='1px' borderColor='border.subtle'>
              <Text fontSize='sm' fontWeight='bold' color='text.tertiary' mb={2}>
                CONTENTS:
              </Text>
              <VStack align='stretch' gap={2}>
              {/* Child folders */}
              {children.map((childNode) => (
                <Box key={childNode.folder.path} fontSize='md' color='text.secondary'>
                  📁 {childNode.folder.config?.name || childNode.folder.name}
                </Box>
              ))}

              {/* Grouped artifacts (if groups exist) */}
              {groupedData && (
                <VStack align='stretch' gap={4} mt={2}>
                  {groupedData.groupedArtifacts.map(({ group, artifacts: groupArtifacts }) => (
                    <Box key={group.id} pl={4} borderLeft='2px solid' borderColor='primary.200'>
                      <VStack align='stretch' gap={2}>
                              <HStack justify='space-between'>
                                <Badge size='md' colorPalette='primary'>
                                  {group.name}
                                </Badge>
                                <Text fontSize='sm' color='text.secondary'>
                                  {groupArtifacts.length} resource{groupArtifacts.length !== 1 ? 's' : ''}
                                </Text>
                              </HStack>
                        <VStack align='stretch' gap={2} pl={4}>
                          {groupArtifacts.map((artifact) => {
                            const isMoving = movingArtifacts.has(artifact.path);
                            return (
                              <HStack
                                key={artifact.path}
                                fontSize='md'
                                color={isMoving ? 'text.tertiary' : 'text.secondary'}
                                cursor={isMoving ? 'default' : 'pointer'}
                                _hover={isMoving ? {} : { color: 'blue.500' }}
                                onClick={(e) => {
                                  if (!isMoving) {
                                    e.stopPropagation();
                                    onViewArtifact(artifact);
                                  }
                                }}
                                gap={2}
                                justify='space-between'
                                opacity={isMoving ? 0.6 : 1}
                                animation='fadeInUp 0.2s ease-out'
                                css={{
                                  '@keyframes fadeInUp': {
                                    from: {
                                      opacity: 0,
                                      transform: 'translateY(8px)',
                                    },
                                    to: {
                                      opacity: 1,
                                      transform: 'translateY(0)',
                                    },
                                  },
                                }}
                              >
                                <HStack gap={2} flex={1}>
                                  {isMoving ? (
                                    <Spinner size="sm" color="primary.500" />
                                  ) : (
                                    <Icon boxSize={5}>
                                      <ArtifactIcon />
                                    </Icon>
                                  )}
                                  <Text fontSize='md'>{artifact.frontMatter?.alias || artifact.name}</Text>
                                </HStack>
                                <Checkbox.Root
                                  checked={isSelected(artifact.path)}
                                  colorPalette='blue'
                                  onCheckedChange={() => {
                                    handleArtifactToggle(artifact);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  cursor='pointer'
                                >
                                  <Checkbox.HiddenInput />
                                  <Checkbox.Control cursor='pointer'>
                                    <Checkbox.Indicator />
                                  </Checkbox.Control>
                                </Checkbox.Root>
                              </HStack>
                            );
                          })}
                        </VStack>
                      </VStack>
                    </Box>
                  ))}

                  {/* Ungrouped artifacts */}
                  {groupedData.ungroupedArtifacts.length > 0 && (
                    <Box pl={4} borderLeft='2px solid' borderColor='border.subtle'>
                      <VStack align='stretch' gap={2} pl={4}>
                        {groupedData.ungroupedArtifacts.map((artifact) => {
                          const isMoving = movingArtifacts.has(artifact.path);
                          return (
                          <HStack
                            key={artifact.path}
                            fontSize='md'
                            color={isMoving ? 'text.tertiary' : 'text.secondary'}
                            cursor={isMoving ? 'default' : 'pointer'}
                            _hover={isMoving ? {} : { color: 'blue.500' }}
                            onClick={(e) => {
                              if (!isMoving) {
                                e.stopPropagation();
                                onViewArtifact(artifact);
                              }
                            }}
                            gap={2}
                            justify='space-between'
                            opacity={isMoving ? 0.6 : 1}
                            animation='fadeInUp 0.2s ease-out'
                            css={{
                              '@keyframes fadeInUp': {
                                from: {
                                  opacity: 0,
                                  transform: 'translateY(8px)',
                                },
                                to: {
                                  opacity: 1,
                                  transform: 'translateY(0)',
                                },
                              },
                            }}
                          >
                            <HStack gap={2} flex={1}>
                              {isMoving ? (
                                <Spinner size="sm" color="primary.500" />
                              ) : (
                                <Icon boxSize={5}>
                                  <ArtifactIcon />
                                </Icon>
                              )}
                              <Text fontSize='md'>{artifact.frontMatter?.alias || artifact.name}</Text>
                            </HStack>
                            <Checkbox.Root
                              checked={isSelected(artifact.path)}
                              colorPalette='blue'
                              onCheckedChange={() => {
                                handleArtifactToggle(artifact);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              cursor='pointer'
                            >
                              <Checkbox.HiddenInput />
                              <Checkbox.Control cursor='pointer'>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Root>
                          </HStack>
                          );
                        })}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              )}

              {/* Flat list of artifacts (if no groups) */}
              {!groupedData && artifacts.map((artifact) => {
                const isMoving = movingArtifacts.has(artifact.path);
                return (
                <HStack
                  key={artifact.path}
                  fontSize='md'
                  color={isMoving ? 'text.tertiary' : 'text.secondary'}
                  cursor={isMoving ? 'default' : 'pointer'}
                  _hover={isMoving ? {} : { color: 'blue.500' }}
                  onClick={(e) => {
                    if (!isMoving) {
                      e.stopPropagation();
                      onViewArtifact(artifact);
                    }
                  }}
                  gap={2}
                  justify='space-between'
                  opacity={isMoving ? 0.6 : 1}
                  animation='fadeInUp 0.2s ease-out'
                  css={{
                    '@keyframes fadeInUp': {
                      from: {
                        opacity: 0,
                        transform: 'translateY(8px)',
                      },
                      to: {
                        opacity: 1,
                        transform: 'translateY(0)',
                      },
                    },
                  }}
                >
                  <HStack gap={2} flex={1}>
                    {isMoving ? (
                      <Spinner size="sm" color="primary.500" />
                    ) : (
                      <Icon boxSize={5}>
                        <ArtifactIcon />
                      </Icon>
                    )}
                    <Text fontSize='md'>{artifact.frontMatter?.alias || artifact.name}</Text>
                  </HStack>
                  <Checkbox.Root
                    checked={isSelected(artifact.path)}
                    colorPalette='blue'
                    onCheckedChange={() => {
                      handleArtifactToggle(artifact);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    cursor='pointer'
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control cursor='pointer'>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Root>
                </HStack>
                );
              })}
            </VStack>
          </Box>
        )}
        </Box>
      </CardBody>
    </Card.Root>
  );
}
