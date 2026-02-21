import { Box, HStack, Icon, IconButton, Button, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuArrowRight, LuPanelRightOpen, LuPanelRightClose } from 'react-icons/lu';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { ResourceFile } from '@/types/resource';
import path from 'path';

interface NoteViewHeaderProps {
  resource: ResourceFile;
  viewMode: 'preview' | 'source' | 'edit';
  onViewModeChange: (mode: 'preview' | 'source' | 'edit') => void;
  editable?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
  isPanelOpen?: boolean;
  onTogglePanel?: () => void;
}

const MODE_CYCLE: Array<'preview' | 'edit'> = ['preview', 'edit'];
const MODE_LABEL: Record<string, string> = {
  preview: 'Reader',
  edit: 'Editor',
  source: 'Source',
};

export function NoteViewHeader({
  resource,
  viewMode,
  onViewModeChange,
  editable = true,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev = false,
  canNavigateNext = false,
  isPanelOpen = false,
  onTogglePanel,
}: NoteViewHeaderProps) {
  const { colorMode } = useColorMode();
  const breadcrumbs = (() => {
    const pathStr = resource.path;
    const bluekitIndex = pathStr.indexOf('.bluekit/');
    if (bluekitIndex === -1) {
      return [path.basename(pathStr).replace(/\.(md|mmd)$/, '') || 'Untitled'];
    }
    const relativePath = pathStr.substring(bluekitIndex + '.bluekit/'.length);
    const parts = relativePath.replace(/\.(md|mmd)$/, '').split(/[/\\]/).filter(Boolean);
    return parts.length > 0 ? parts : ['Untitled'];
  })();

  const handleModeToggle = () => {
    if (!editable) return;
    const currentIdx = MODE_CYCLE.indexOf(viewMode as 'preview' | 'edit');
    const nextMode = currentIdx === -1
      ? 'preview'
      : MODE_CYCLE[(currentIdx + 1) % MODE_CYCLE.length];
    onViewModeChange(nextMode);
  };

  const modeLabel = MODE_LABEL[viewMode] ?? 'Reader';

  return (
    <Box position="sticky" top={0} zIndex={100} bg="transparent" px={4} py={2}>
      <HStack justify="space-between" align="center" gap={4}>

        {/* Left: Navigation arrows */}
        <HStack gap={1}>
          <Button
            variant="ghost" size="sm" px={2} bg="transparent"
            disabled={!canNavigatePrev}
            opacity={canNavigatePrev ? 1 : 0.35}
            cursor={canNavigatePrev ? 'pointer' : 'not-allowed'}
            onClick={onNavigatePrev}
            _hover={{}}
          >
            <Icon boxSize={4}><LuArrowLeft /></Icon>
          </Button>
          <Button
            variant="ghost" size="sm" px={2} bg="transparent"
            disabled={!canNavigateNext}
            opacity={canNavigateNext ? 1 : 0.35}
            cursor={canNavigateNext ? 'pointer' : 'not-allowed'}
            onClick={onNavigateNext}
            _hover={{}}
          >
            <Icon boxSize={4}><LuArrowRight /></Icon>
          </Button>
        </HStack>

        {/* Center: Breadcrumbs */}
        <HStack gap={2} flex={1} justify="center" minW={0}>
          {breadcrumbs.map((part, index) => (
            <HStack key={index} gap={2} align="center">
              {index > 0 && (
                <Text fontSize="sm" color="text.tertiary">{'>'}</Text>
              )}
              <Text
                fontSize="sm"
                color={index === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}
                fontWeight={index === breadcrumbs.length - 1 ? 'medium' : 'normal'}
                lineClamp={1}
              >
                {part}
              </Text>
            </HStack>
          ))}
        </HStack>

        {/* Right: Mode toggle + Panel toggle */}
        <HStack gap={1}>
          <Button
            variant="ghost"
            size="sm"
            px={3}
            bg="transparent"
            onClick={editable ? handleModeToggle : undefined}
            cursor={editable ? 'pointer' : 'default'}
            _hover={editable ? { bg: 'whiteAlpha.100' } : {}}
            _dark={{ _hover: editable ? { bg: 'whiteAlpha.50' } : {} }}
          >
            <HStack gap={1}>
              <Text fontSize="xs" color="text.tertiary" fontWeight="normal">Mode:</Text>
              <Text fontSize="xs" color="text.secondary" fontWeight="medium">{modeLabel}</Text>
            </HStack>
          </Button>

          {onTogglePanel && (
            <IconButton
              variant="ghost"
              size="sm"
              onClick={onTogglePanel}
              aria-label={isPanelOpen ? "Close side panel" : "Open side panel"}
              css={{
                borderRadius: '10px',
                color: "text.secondary",
                _hover: {
                  bg: colorMode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
                },
              }}
            >
              <Icon boxSize={4}>
                {isPanelOpen ? <LuPanelRightClose /> : <LuPanelRightOpen />}
              </Icon>
            </IconButton>
          )}
        </HStack>

      </HStack>
    </Box>
  );
}
