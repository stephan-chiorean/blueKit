import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  Portal,
} from '@chakra-ui/react';
import { ResourceFile } from '../../types/resource';
import SearchInMarkdown from './SearchInMarkdown';
import { useWorkstation } from '../../contexts/WorkstationContext';
import { ResourceMarkdownHeader } from './ResourceMarkdownHeader';
import { ResourceMarkdownContent } from './ResourceMarkdownContent';
import path from 'path';

interface ResourceMarkdownViewerProps {
  resource: ResourceFile;
  content: string;
}

export default function ResourceMarkdownViewer({ resource, content }: ResourceMarkdownViewerProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const { isSearchOpen, setIsSearchOpen } = useWorkstation();

  // Resolve relative paths for internal markdown links
  const resolveInternalPath = (href: string): string => {
    // Get the directory of the current resource
    const currentDir = path.dirname(resource.path);

    // Resolve the relative path
    const resolvedPath = path.resolve(currentDir, href);

    return resolvedPath;
  };

  // Keyboard shortcut for opening search (cmd+F / ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setIsSearchOpen]);

  return (
    <Box
      p={6}
      maxW="100%"
      h="100%"
      overflow="auto"
      css={{
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        _dark: {
          background: 'rgba(20, 20, 25, 0.5)',
        },
      }}
    >
      <VStack align="stretch" gap={6}>
        <ResourceMarkdownHeader
          resource={resource}
          content={content}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <ResourceMarkdownContent
          resource={resource}
          content={content}
          viewMode={viewMode}
          onResolveInternalPath={resolveInternalPath}
        />
      </VStack>

      {/* Search Component */}
      <Portal>
        {isSearchOpen && (
          <SearchInMarkdown
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            containerId={viewMode === 'source' ? 'markdown-content-source' : 'markdown-content-preview'}
            viewMode={viewMode as 'preview' | 'source'}
          />
        )}
      </Portal>
    </Box>
  );
}
