import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  EmptyState,
} from '@chakra-ui/react';
import { useResource } from '../../contexts/ResourceContext';
import ResourceMarkdownViewer from './ResourceMarkdownViewer';
import ViewerToolbar, { ViewMode } from './ViewerToolbar';
import MarkdownSource from './MarkdownSource';

export default function Workstation() {
  const { selectedResource, resourceContent } = useResource();
  const [viewMode, setViewMode] = useState<ViewMode>('preview');

  // Reset view mode when resource changes
  useEffect(() => {
    setViewMode('preview');
  }, [selectedResource?.path]);

  // Keyboard shortcut: Cmd/Ctrl + Shift + M to toggle view mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        setViewMode(prev => prev === 'preview' ? 'source' : 'preview');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Flex
      direction="column"
      h="100%"
      bg="transparent"
      position="relative"
      overflow="hidden"
    >
      {/* Content Area */}
      <Box
        flex="1"
        bg="transparent"
        position="relative"
        overflow="hidden"
      >
        {selectedResource && resourceContent ? (
          <>
            <ViewerToolbar
              content={resourceContent}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {viewMode === 'preview' ? (
              <ResourceMarkdownViewer resource={selectedResource} content={resourceContent} />
            ) : (
              <MarkdownSource content={resourceContent} />
            )}
          </>
        ) : (
          <EmptyState.Root>
            <EmptyState.Content>
              <EmptyState.Title>No Resource Selected</EmptyState.Title>
              <EmptyState.Description>
                Click "View" on a resource to see its content here
              </EmptyState.Description>
            </EmptyState.Content>
          </EmptyState.Root>
        )}
      </Box>
    </Flex>
  );
}




