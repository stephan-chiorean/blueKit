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
import { invokeGetFolderMarkdownFiles } from '../ipc/artifacts';
import { invokeReadFile } from '../ipc/files';
import path from 'path';

interface NoteViewPageProps {
  resource: ResourceFile;
  content: string;
  /** Whether editing is enabled (default: true) */
  editable?: boolean;
  /** Callback when content changes */
  onContentChange?: (newContent: string) => void;
  /** Callback when navigating to a different file in the same directory */
  onNavigate?: (resource: ResourceFile, content: string) => void;
}

type ViewMode = 'preview' | 'source' | 'edit';

export default function NoteViewPage({
  resource,
  content: initialContent,
  editable = true,
  onContentChange,
  onNavigate,
}: NoteViewPageProps) {
  const { colorMode } = useColorMode();
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [content, setContent] = useState(initialContent);
  const { isSearchOpen, setIsSearchOpen } = useWorkstation();
  const editorRef = useRef<MarkdownEditorRef>(null);

  // State for sibling navigation
  const [siblingFiles, setSiblingFiles] = useState<ResourceFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

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

  // Fetch sibling files in the same directory
  useEffect(() => {
    const fetchSiblings = async () => {
      try {
        const currentDir = path.dirname(resource.path);
        const files = await invokeGetFolderMarkdownFiles(currentDir);

        // Sort files alphabetically by name
        const sortedFiles: ResourceFile[] = files
          .map(f => ({
            name: f.name,
            path: f.path,
            relativePath: '',
            frontMatter: f.frontMatter,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setSiblingFiles(sortedFiles);

        // Find current file index
        const idx = sortedFiles.findIndex(f => f.path === resource.path);
        setCurrentIndex(idx);
      } catch (error) {
        console.error('Failed to fetch sibling files:', error);
        setSiblingFiles([]);
        setCurrentIndex(-1);
      }
    };

    fetchSiblings();
  }, [resource.path]);

  // Navigation computed values
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex >= 0 && currentIndex < siblingFiles.length - 1;

  // Navigate to previous file
  const handleNavigatePrev = useCallback(async () => {
    if (!canNavigatePrev || !onNavigate) return;

    const prevFile = siblingFiles[currentIndex - 1];
    try {
      const fileContent = await invokeReadFile(prevFile.path);
      onNavigate(prevFile, fileContent);
    } catch (error) {
      console.error('Failed to read previous file:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to open file',
        description: 'Could not read the previous file',
      });
    }
  }, [canNavigatePrev, siblingFiles, currentIndex, onNavigate]);

  // Navigate to next file
  const handleNavigateNext = useCallback(async () => {
    if (!canNavigateNext || !onNavigate) return;

    const nextFile = siblingFiles[currentIndex + 1];
    try {
      const fileContent = await invokeReadFile(nextFile.path);
      onNavigate(nextFile, fileContent);
    } catch (error) {
      console.error('Failed to read next file:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to open file',
        description: 'Could not read the next file',
      });
    }
  }, [canNavigateNext, siblingFiles, currentIndex, onNavigate]);

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
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
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
