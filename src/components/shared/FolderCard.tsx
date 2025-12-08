import { Box, Card, CardHeader, CardBody, Heading, HStack, Icon, Text, VStack, Button, Flex, Menu, IconButton } from '@chakra-ui/react';
import { LuFolder, LuChevronRight, LuFolderInput, LuPackage, LuBookOpen, LuNetwork, LuPencil, LuTrash2 } from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { FolderTreeNode, ArtifactFile, ArtifactFolder } from '../../ipc';

interface FolderCardProps {
  node: FolderTreeNode;
  artifactType: 'kits' | 'walkthroughs' | 'diagrams';
  onToggleExpand: () => void;
  onViewArtifact: (artifact: ArtifactFile) => void;
  onAddToFolder: (folder: ArtifactFolder) => void;
  onEdit: (folder: ArtifactFolder) => void;
  onDelete: (folder: ArtifactFolder) => void;
  hasCompatibleSelection: boolean;
  renderArtifactCard: (artifact: ArtifactFile) => React.ReactNode;
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
  renderArtifactCard,
}: FolderCardProps) {
  const { folder, children, artifacts, isExpanded } = node;

  const displayName = folder.config?.name || folder.name;
  const description = folder.config?.description;
  const color = folder.config?.color;

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

  return (
    <Card.Root
      variant='subtle'
      borderWidth='1px'
      borderColor={hasCompatibleSelection ? 'blue.400' : 'border.subtle'}
      bg={hasCompatibleSelection ? 'blue.25' : undefined}
      cursor='pointer'
      onClick={onToggleExpand}
      _hover={{ borderColor: 'blue.400', bg: 'blue.50' }}
      position='relative'
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
            <Icon boxSize={5} color={color || 'blue.500'}>
              <LuFolder />
            </Icon>
            <Heading size='md'>{displayName}</Heading>
          </HStack>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                variant='ghost'
                size='sm'
                aria-label='Folder options'
                onClick={(e) => e.stopPropagation()}
              >
                <Icon>
                  <IoIosMore />
                </Icon>
              </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value='edit' onSelect={() => {
                  onEdit(folder);
                }}>
                  <HStack gap={2}>
                    <Icon>
                      <LuPencil />
                    </Icon>
                    <Text>Edit</Text>
                  </HStack>
                </Menu.Item>
                <Menu.Item value='delete' onSelect={() => {
                  onDelete(folder);
                }}>
                  <HStack gap={2}>
                    <Icon>
                      <LuTrash2 />
                    </Icon>
                    <Text>Delete</Text>
                  </HStack>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </Flex>
      </CardHeader>
      <CardBody display='flex' flexDirection='column' flex='1'>
        <VStack align='stretch' gap={2}>
          {description && (
            <Text fontSize='sm' color='text.secondary'>
              {description}
            </Text>
          )}

          {hasCompatibleSelection && (
            <Button
              size='sm'
              variant='solid'
              colorPalette='blue'
              onClick={(e) => {
                e.stopPropagation();
                onAddToFolder(folder);
              }}
              mt={2}
            >
              <HStack gap={2}>
                <Icon>
                  <LuFolderInput />
                </Icon>
                <Text>Add items here</Text>
              </HStack>
            </Button>
          )}
        </VStack>

        {isExpanded && (artifacts.length > 0 || children.length > 0) && (
          <Box mt={4} pt={4} borderTopWidth='1px' borderColor='border.subtle'>
            <Text fontSize='xs' fontWeight='bold' color='text.tertiary' mb={2}>
              CONTENTS:
            </Text>
            <VStack align='stretch' gap={2}>
              {children.map((childNode) => (
                <Box key={childNode.folder.path} fontSize='sm' color='text.secondary'>
                  📁 {childNode.folder.config?.name || childNode.folder.name}
                </Box>
              ))}
              {artifacts.map((artifact) => (
                <HStack
                  key={artifact.path}
                  fontSize='sm'
                  color='text.secondary'
                  cursor='pointer'
                  _hover={{ color: 'blue.500' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewArtifact(artifact);
                  }}
                  gap={2}
                >
                  <Icon boxSize={4}>
                    <ArtifactIcon />
                  </Icon>
                  <Text>{artifact.frontMatter?.alias || artifact.name}</Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}
      </CardBody>
    </Card.Root>
  );
}
