import { HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { LuCopy, LuCheck, LuEye, LuCode } from 'react-icons/lu';
import { useState } from 'react';
import { writeText } from '@tauri-apps/api/clipboard';

export type ViewMode = 'preview' | 'source';

interface ViewerToolbarProps {
  content: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewerToolbar({
  content,
  viewMode,
  onViewModeChange,
}: ViewerToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const toggleViewMode = () => {
    onViewModeChange(viewMode === 'preview' ? 'source' : 'preview');
  };

  return (
    <HStack
      position="absolute"
      top={4}
      right={4}
      gap={1}
      p={2}
      borderRadius="lg"
      zIndex={10}
      css={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        _dark: {
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <IconButton
            aria-label="Toggle view mode"
            variant="ghost"
            size="sm"
            onClick={toggleViewMode}
          >
            {viewMode === 'preview' ? <LuCode /> : <LuEye />}
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            {viewMode === 'preview' ? 'View source (Cmd+Shift+M)' : 'View preview (Cmd+Shift+M)'}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <IconButton
            aria-label="Copy markdown"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? <LuCheck /> : <LuCopy />}
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            {copied ? 'Copied!' : 'Copy markdown'}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
    </HStack>
  );
}
