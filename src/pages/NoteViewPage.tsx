import { Box } from '@chakra-ui/react';
import ResourceMarkdownViewer from '../components/workstation/ResourceMarkdownViewer';
import { ResourceFile } from '../types/resource';
import { useColorMode } from '../contexts/ColorModeContext';

interface NoteViewPageProps {
  resource: ResourceFile;
  content: string;
}

export default function NoteViewPage({ resource, content }: NoteViewPageProps) {
  const { colorMode } = useColorMode();

  // Glass styling for light/dark mode - matching project cards
  const cardBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(20, 20, 25, 0.5)';

  return (
    <Box
      h="100%"
      w="100%"
      overflow="hidden"
      style={{
        background: cardBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <ResourceMarkdownViewer
        resource={resource}
        content={content}
      />
    </Box>
  );
}

