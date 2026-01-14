import { Box, HStack, Icon, Button, Text } from '@chakra-ui/react';
import { FaEye, FaCode, FaEdit } from 'react-icons/fa';
import { LuArrowLeft, LuArrowRight, LuEllipsisVertical } from 'react-icons/lu';
import { ResourceFile } from '../../types/resource';
import path from 'path';

interface NoteViewHeaderProps {
  resource: ResourceFile;
  viewMode: 'preview' | 'source' | 'edit';
  onViewModeChange: (mode: 'preview' | 'source' | 'edit') => void;
  editable?: boolean;
}

export function NoteViewHeader({
  resource,
  viewMode,
  onViewModeChange,
  editable = true,
}: NoteViewHeaderProps) {
  // Parse breadcrumbs relative to .bluekit
  const breadcrumbs = (() => {
    const pathStr = resource.path;
    
    // Find .bluekit in the path
    const bluekitIndex = pathStr.indexOf('.bluekit/');
    if (bluekitIndex === -1) {
      // If no .bluekit found, fallback to just the filename
      const basename = path.basename(pathStr);
      return [basename.replace(/\.(md|mmd)$/, '') || 'Untitled'];
    }
    
    // Extract path after .bluekit/
    const relativePath = pathStr.substring(bluekitIndex + '.bluekit/'.length);
    
    // Remove file extension
    const pathWithoutExt = relativePath.replace(/\.(md|mmd)$/, '');
    
    // Split by path separator and filter out empty parts
    const parts = pathWithoutExt.split(/[/\\]/).filter(part => part.length > 0);
    
    return parts.length > 0 ? parts : ['Untitled'];
  })();

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={100}
      bg="transparent"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      px={4}
      py={2}
      css={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <HStack justify="space-between" align="center" gap={4}>
        {/* Left: Navigation arrows */}
        <HStack gap={1}>
          <Button
            variant="ghost"
            size="sm"
            px={2}
            disabled
            opacity={0.5}
            cursor="not-allowed"
          >
            <Icon boxSize={4}>
              <LuArrowLeft />
            </Icon>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            px={2}
            disabled
            opacity={0.5}
            cursor="not-allowed"
          >
            <Icon boxSize={4}>
              <LuArrowRight />
            </Icon>
          </Button>
        </HStack>

        {/* Center: Breadcrumbs */}
        <HStack
          gap={2}
          flex={1}
          justify="center"
          minW={0}
          css={{
            '& > *': {
              fontSize: 'sm',
              color: 'text.secondary',
            },
          }}
        >
          {breadcrumbs.map((part, index) => (
            <HStack key={index} gap={2} align="center">
              {index > 0 && (
                <Text fontSize="sm" color="text.tertiary">
                  {'>'}
                </Text>
              )}
              <Text
                fontSize="sm"
                color={index === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}
                fontWeight={index === breadcrumbs.length - 1 ? 'medium' : 'normal'}
                noOfLines={1}
              >
                {part}
              </Text>
            </HStack>
          ))}
        </HStack>

        {/* Right: View mode icons + menu */}
        <HStack gap={1}>
          {/* Preview icon */}
          <Button
            variant="ghost"
            size="sm"
            px={2}
            onClick={() => onViewModeChange('preview')}
            colorScheme={viewMode === 'preview' ? 'primary' : undefined}
            bg={viewMode === 'preview' ? 'primary.50' : 'transparent'}
            _dark={{
              bg: viewMode === 'preview' ? 'primary.900/30' : 'transparent',
            }}
          >
            <Icon boxSize={4}>
              <FaEye />
            </Icon>
          </Button>

          {/* Source icon */}
          <Button
            variant="ghost"
            size="sm"
            px={2}
            onClick={() => onViewModeChange('source')}
            colorScheme={viewMode === 'source' ? 'primary' : undefined}
            bg={viewMode === 'source' ? 'primary.50' : 'transparent'}
            _dark={{
              bg: viewMode === 'source' ? 'primary.900/30' : 'transparent',
            }}
          >
            <Icon boxSize={4}>
              <FaCode />
            </Icon>
          </Button>

          {/* Edit icon (only if editable) */}
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              px={2}
              onClick={() => onViewModeChange('edit')}
              colorScheme={viewMode === 'edit' ? 'primary' : undefined}
              bg={viewMode === 'edit' ? 'primary.50' : 'transparent'}
              _dark={{
                bg: viewMode === 'edit' ? 'primary.900/30' : 'transparent',
              }}
            >
              <Icon boxSize={4}>
                <FaEdit />
              </Icon>
            </Button>
          )}

          {/* Menu icon */}
          <Button
            variant="ghost"
            size="sm"
            px={2}
            disabled
            opacity={0.5}
            cursor="not-allowed"
          >
            <Icon boxSize={4}>
              <LuEllipsisVertical />
            </Icon>
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}

