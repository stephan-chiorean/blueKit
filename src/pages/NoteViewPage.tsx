import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Portal } from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { ResourceFile } from '@/types/resource';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { NoteViewHeader } from '@/features/workstation/components/NoteViewHeader';
import SearchInMarkdown from '@/features/workstation/components/SearchInMarkdown';
import { useWorkstation } from '@/app/WorkstationContext';
import { useAutoSave } from '@/hooks/useAutoSave';
import { toaster } from '@/shared/components/ui/toaster';
import { invokeGetFolderMarkdownFiles, deleteResources } from '@/ipc/artifacts';
import { invokeReadFile, invokeWriteFile } from '@/ipc/files';
import ObsidianEditor, { ObsidianEditorRef, EditorMode } from '@/shared/components/editor/obsidian';
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
  /** Initial view mode (default: 'preview') */
  initialViewMode?: ViewMode;
  /** Callback when file is renamed (for updating tree/tabs) */
  onFileRenamed?: (oldPath: string, newPath: string) => void;
}

type ViewMode = 'preview' | 'source' | 'edit';

// Map NoteViewPage's 3-way mode to ObsidianEditor's modes
function toEditorMode(viewMode: ViewMode): EditorMode {
  if (viewMode === 'edit') return 'live-preview';
  if (viewMode === 'source') return 'source';
  return 'reading';
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^# (.+)/m);
  return match ? match[1].trim() : '';
}

function extractBody(markdown: string): string {
  const firstLine = markdown.split('\n')[0];
  if (firstLine.startsWith('# ')) {
    return markdown.slice(firstLine.length + 1).replace(/^\n/, '');
  }
  return markdown;
}

export default function NoteViewPage({
  resource,
  content: initialContent,
  editable = true,
  onContentChange,
  onNavigate,
  initialViewMode = 'preview',
  onFileRenamed,
}: NoteViewPageProps) {
  const { colorMode } = useColorMode();
  const isLight = colorMode === 'light';
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [title, setTitle] = useState(() => extractTitle(initialContent));
  const [body, setBody] = useState(() => extractBody(initialContent));
  const { isSearchOpen, setIsSearchOpen } = useWorkstation();
  const editorRef = useRef<ObsidianEditorRef>(null);
  const isRenamingRef = useRef(false);

  // Reconstruct full markdown content
  const buildFullContent = useCallback((t: string, b: string) =>
    t ? `# ${t}\n\n${b}` : b,
    []);

  // State for sibling navigation
  const [siblingFiles, setSiblingFiles] = useState<ResourceFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Auto-save — active in edit and source modes
  const { save, saveNow } = useAutoSave(resource.path, {
    delay: 1500,
    enabled: editable && viewMode !== 'preview',
    onSaveSuccess: () => {
      toaster.create({ type: 'success', title: 'Saved', duration: 2000 });
    },
    onSaveError: (error) => {
      toaster.create({ type: 'error', title: 'Save failed', description: error.message });
    },
  });

  // Track previous resource path to detect file change
  const prevResourcePathRef = useRef(resource.path);

  // Update state when navigating to a different file
  useEffect(() => {
    const isNewFile = prevResourcePathRef.current !== resource.path;
    prevResourcePathRef.current = resource.path;

    if (isNewFile || viewMode !== 'edit') {
      setTitle(extractTitle(initialContent));
      setBody(extractBody(initialContent));
      if (isNewFile) setViewMode(initialViewMode);
    }
  }, [initialContent, resource.path, viewMode, initialViewMode]);

  // Fetch sibling files in the same directory
  useEffect(() => {
    const fetchSiblings = async () => {
      try {
        const currentDir = path.dirname(resource.path);
        const files = await invokeGetFolderMarkdownFiles(currentDir);
        const sortedFiles: ResourceFile[] = files
          .map(f => ({ name: f.name, path: f.path, relativePath: '', frontMatter: f.frontMatter }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSiblingFiles(sortedFiles);
        setCurrentIndex(sortedFiles.findIndex(f => f.path === resource.path));
      } catch {
        setSiblingFiles([]);
        setCurrentIndex(-1);
      }
    };
    fetchSiblings();
  }, [resource.path]);

  // File watcher for external changes (not while editing)
  useEffect(() => {
    if (viewMode === 'edit') return;

    let unlisten: (() => void) | null = null;
    let isMounted = true;

    const setupWatcher = async () => {
      try {
        const bluekitIndex = resource.path.indexOf('.bluekit');
        if (bluekitIndex === -1) return;
        const projectPath = resource.path.substring(0, bluekitIndex - 1);
        const sanitizedPath = projectPath
          .replace(/\//g, '_').replace(/\\/g, '_')
          .replace(/:/g, '_').replace(/\./g, '_').replace(/ /g, '_');
        const eventName = `project-artifacts-changed-${sanitizedPath}`;

        unlisten = await listen<string[]>(eventName, async (event) => {
          if (!isMounted) return;
          if (event.payload.includes(resource.path)) {
            try {
              const newContent = await invokeReadFile(resource.path);
              setTitle(extractTitle(newContent));
              setBody(extractBody(newContent));
            } catch { /* file may have been deleted */ }
          }
        });
      } catch { /* watcher setup failed */ }
    };

    setupWatcher();
    return () => { isMounted = false; if (unlisten) unlisten(); };
  }, [resource.path, viewMode]);

  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex >= 0 && currentIndex < siblingFiles.length - 1;

  const handleNavigatePrev = useCallback(async () => {
    if (!canNavigatePrev || !onNavigate) return;
    const prevFile = siblingFiles[currentIndex - 1];
    try {
      onNavigate(prevFile, await invokeReadFile(prevFile.path));
    } catch {
      toaster.create({ type: 'error', title: 'Failed to open file', description: 'Could not read the previous file' });
    }
  }, [canNavigatePrev, siblingFiles, currentIndex, onNavigate]);

  const handleNavigateNext = useCallback(async () => {
    if (!canNavigateNext || !onNavigate) return;
    const nextFile = siblingFiles[currentIndex + 1];
    try {
      onNavigate(nextFile, await invokeReadFile(nextFile.path));
    } catch {
      toaster.create({ type: 'error', title: 'Failed to open file', description: 'Could not read the next file' });
    }
  }, [canNavigateNext, siblingFiles, currentIndex, onNavigate]);

  // Body changes from the editor
  const handleBodyChange = useCallback((newBody: string) => {
    setBody(newBody);
    const full = buildFullContent(title, newBody);
    onContentChange?.(full);
    if (viewMode !== 'preview') save(full);
  }, [title, buildFullContent, onContentChange, save, viewMode]);

  // Title changes from the header input
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    const full = buildFullContent(newTitle, body);
    onContentChange?.(full);
    if (viewMode !== 'preview') save(full);
  }, [body, buildFullContent, onContentChange, save, viewMode]);

  // Manual save (Cmd+S)
  const handleSave = useCallback(async (savedBody: string) => {
    try {
      await saveNow(buildFullContent(title, savedBody));
    } catch { /* handled in hook */ }
  }, [saveNow, title, buildFullContent]);

  // Rename file when user commits the title (Enter or blur)
  const handleTitleCommit = useCallback(async (newTitle: string) => {
    if (isRenamingRef.current) return;
    const sanitizedTitle = newTitle.replace(/[/\\:*?"<>|]/g, '-').trim() || 'Untitled';
    if (sanitizedTitle === 'Untitled') return;

    const currentPath = resource.path;
    const newPath = path.join(path.dirname(currentPath), `${sanitizedTitle}.md`);
    if (newPath === currentPath) return;

    isRenamingRef.current = true;
    try {
      const updatedBody = body;
      const updatedContent = `# ${sanitizedTitle}\n\n${updatedBody}`;
      await invokeWriteFile(newPath, updatedContent);
      await deleteResources([currentPath]);
      setTitle(sanitizedTitle);
      onContentChange?.(updatedContent);
      onFileRenamed?.(currentPath, newPath);
    } catch (error) {
      toaster.create({
        type: 'error',
        title: 'Rename failed',
        description: error instanceof Error ? error.message : 'Could not rename file',
      });
    } finally {
      isRenamingRef.current = false;
    }
  }, [resource.path, body, onContentChange, onFileRenamed]);

  // Keyboard shortcut for search (Cmd+F / Ctrl+F)
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

  const editorMode = toEditorMode(viewMode);

  // Title input rendered as headerSlot — consistent across all modes
  const titleSlot = (
    <Box w="100%" css={{ padding: '20px 40px 4px 40px' }}>
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        onBlur={(e) => handleTitleCommit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        }}
        placeholder="Untitled"
        style={{
          display: 'block',
          width: '100%',
          padding: '0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          fontSize: '1.875rem',
          fontWeight: 700,
          lineHeight: 1.3,
          color: isLight ? '#1a1a2e' : '#e4e4e7',
          textShadow: isLight
            ? '0 1px 2px rgba(0,0,0,0.1)'
            : '0 1px 2px rgba(0,0,0,0.5)',
          background: 'transparent',
          border: 'none',
          outline: 'none',
        }}
      />
    </Box>
  );

  return (
    <Box h="100%" w="100%" display="flex" flexDirection="column">
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

      <Box flex={1} overflow="hidden">
        <ObsidianEditor
          ref={editorRef}
          initialContent={body}
          mode={editorMode}
          showModeToggle={false}
          onChange={handleBodyChange}
          onSave={handleSave}
          colorMode={colorMode}
          placeholder="Start writing..."
          headerSlot={titleSlot}
          contentId="markdown-content-container"
        />
      </Box>

      {/* Search */}
      <Portal>
        {isSearchOpen && (
          <SearchInMarkdown
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            containerId="markdown-content-container"
            viewMode={viewMode === 'edit' ? 'preview' : viewMode as 'preview' | 'source'}
          />
        )}
      </Portal>
    </Box>
  );
}
