import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, VStack, Portal } from '@chakra-ui/react';
import { ResourceFile } from '../types/resource';
import { useColorMode } from '../contexts/ColorModeContext';
import { NoteViewHeader } from '../components/workstation/NoteViewHeader';
import { ResourceMarkdownContent } from '../components/workstation/ResourceMarkdownContent';
import MarkdownEditor, { MarkdownEditorRef } from '../components/editor/MarkdownEditor';
import SearchInMarkdown from '../components/workstation/SearchInMarkdown';
import { useWorkstation } from '../contexts/WorkstationContext';
import { useAutoSave } from '../hooks/useAutoSave';
import { toaster } from '../components/ui/toaster';
import path from 'path';

interface NoteViewPageProps {
  resource: ResourceFile;
  content: string;
  /** Whether editing is enabled (default: true) */
  editable?: boolean;
  /** Callback when content changes */
  onContentChange?: (newContent: string) => void;
}

type ViewMode = 'preview' | 'source' | 'edit';

export default function NoteViewPage({
  resource,
  content: initialContent,
  editable = true,
  onContentChange,
}: NoteViewPageProps) {
  const { colorMode } = useColorMode();
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [content, setContent] = useState(initialContent);
  const { isSearchOpen, setIsSearchOpen } = useWorkstation();
  const editorRef = useRef<MarkdownEditorRef>(null);

  // Auto-save hook for edit mode
  const { save, saveNow, status: saveStatus } = useAutoSave(resource.path, {
    delay: 1500,
    enabled: editable && viewMode === 'edit',
    onSaveSuccess: () => {
      toaster.create({
        type: 'success',
        title: 'Saved',
        duration: 2000,
      });
    },
    onSaveError: (error) => {
      toaster.create({
        type: 'error',
        title: 'Save failed',
        description: error.message,
      });
    },
  });

  // Update content when prop changes (external file change)
  // Only update if not in edit mode to avoid overwriting user edits
  useEffect(() => {
    if (initialContent !== content && viewMode !== 'edit') {
      setContent(initialContent);
    }
  }, [initialContent, viewMode]);

  // Handle content changes from editor
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
    if (viewMode === 'edit') {
      save(newContent);
    }
  }, [onContentChange, save, viewMode]);

  // Handle manual save (Cmd+S)
  const handleSave = useCallback(async (contentToSave: string) => {
    try {
      await saveNow(contentToSave);
    } catch {
      // Error handled in hook
    }
  }, [saveNow]);

  // Resolve relative paths for internal markdown links
  const resolveInternalPath = useCallback((href: string): string => {
    const currentDir = path.dirname(resource.path);
    return path.resolve(currentDir, href);
  }, [resource.path]);

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

  // Glass styling for light/dark mode - matching project cards
  const cardBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(20, 20, 25, 0.5)';

  return (
    <Box
      h="100%"
      w="100%"
      display="flex"
      flexDirection="column"
      style={{
        background: cardBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <NoteViewHeader
        resource={resource}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        editable={editable}
      />
      
      <Box flex={1} overflow={viewMode === 'edit' ? 'hidden' : 'auto'} p={6}>
        {viewMode === 'edit' ? (
          <MarkdownEditor
            ref={editorRef}
            content={content}
            onChange={handleContentChange}
            onSave={handleSave}
            colorMode={colorMode}
            readOnly={false}
            showLineNumbers={true}
            placeholder="Start writing..."
          />
        ) : (
          <ResourceMarkdownContent
            resource={resource}
            content={content}
            viewMode={viewMode}
            onResolveInternalPath={resolveInternalPath}
          />
        )}
      </Box>

      {/* Search Component */}
      <Portal>
        {isSearchOpen && viewMode !== 'edit' && (
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
