import { Box } from '@chakra-ui/react';
import EditableMarkdownViewer from '../components/workstation/EditableMarkdownViewer';
import { ResourceFile } from '../types/resource';
import { useColorMode } from '../contexts/ColorModeContext';

interface NoteViewPageProps {
  resource: ResourceFile;
  content: string;
  /** Whether editing is enabled (default: true) */
  editable?: boolean;
  /** Callback when content changes */
  onContentChange?: (newContent: string) => void;
}

export default function NoteViewPage({
  resource,
  content,
  editable = true,
  onContentChange,
}: NoteViewPageProps) {
  const { colorMode } = useColorMode();

  // Glass styling for light/dark mode - matching project cards
  const cardBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(20, 20, 25, 0.5)';

  return (
    <Box
      h="100%"
      w="100%"
      style={{
        background: cardBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <EditableMarkdownViewer
        resource={resource}
        content={content}
        editable={editable}
        onContentChange={onContentChange}
      />
    </Box>
  );
}
