/**
 * Obsidian-style Markdown Editor.
 *
 * Three modes:
 * - Live Preview: WYSIWYG with syntax reveal on cursor
 * - Source: Raw markdown with syntax highlighting
 * - Reading: Clean rendered (read-only)
 */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle, ReactNode } from 'react';
import { Box, HStack, Button, IconButton } from '@chakra-ui/react';
import { LuEye, LuCode, LuBookOpen, LuMaximize2, LuMinimize2 } from 'react-icons/lu';
import LivePreviewEditor, { LivePreviewEditorRef } from './LivePreviewEditor';
import ReadingView from './ReadingView';
import MarkdownEditor, { MarkdownEditorRef } from '../MarkdownEditor';

export type EditorMode = 'live-preview' | 'source' | 'reading';

export interface ObsidianEditorProps {
  initialContent: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  colorMode: 'light' | 'dark';
  /** Controlled mode — parent drives which mode is active. */
  mode?: EditorMode;
  /** Initial mode when uncontrolled (ignored when `mode` prop is set). */
  defaultMode?: EditorMode;
  showModeToggle?: boolean;
  placeholder?: string;
  /** Rendered inside the scroll container, above editor content. */
  headerSlot?: ReactNode;
  /** DOM id applied to the scrollable content container (for search-in-page). */
  contentId?: string;
}

export interface ObsidianEditorRef {
  focus: () => void;
  getContent: () => string;
  setContent: (content: string) => void;
  getMode: () => EditorMode;
  setMode: (mode: EditorMode) => void;
}

const ObsidianEditor = forwardRef<ObsidianEditorRef, ObsidianEditorProps>(
  function ObsidianEditor(
    {
      initialContent,
      onChange,
      onSave,
      colorMode,
      mode: controlledMode,
      defaultMode = 'live-preview',
      showModeToggle = true,
      placeholder,
      headerSlot,
      contentId,
    },
    ref
  ) {
    const [internalMode, setInternalMode] = useState<EditorMode>(defaultMode);
    // Controlled when `mode` prop is provided, otherwise use internal state
    const mode = controlledMode ?? internalMode;
    const [content, setContent] = useState(initialContent);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const livePreviewRef = useRef<LivePreviewEditorRef>(null);
    const sourceRef = useRef<MarkdownEditorRef>(null);

    // Handle content changes
    const handleChange = useCallback((newContent: string) => {
      setContent(newContent);
      onChange?.(newContent);
    }, [onChange]);

    // Handle save
    const handleSave = useCallback((savedContent: string) => {
      onSave?.(savedContent);
    }, [onSave]);

    // Sync content when initial content changes
    useEffect(() => {
      setContent(initialContent);
    }, [initialContent]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (mode === 'live-preview') {
          livePreviewRef.current?.focus();
        } else if (mode === 'source') {
          sourceRef.current?.focus();
        }
      },
      getContent: () => content,
      setContent: (newContent: string) => {
        setContent(newContent);
        if (mode === 'live-preview') {
          livePreviewRef.current?.setContent(newContent);
        } else if (mode === 'source') {
          sourceRef.current?.setContent(newContent);
        }
      },
      getMode: () => mode,
      setMode: (newMode: EditorMode) => setInternalMode(newMode),
    }), [mode, content]);

    const modeButtons = [
      { mode: 'live-preview' as EditorMode, icon: LuEye, label: 'Live Preview' },
      { mode: 'source' as EditorMode, icon: LuCode, label: 'Source' },
      { mode: 'reading' as EditorMode, icon: LuBookOpen, label: 'Reading' },
    ];

    const isLight = colorMode === 'light';

    return (
      <Box
        position={isFullscreen ? 'fixed' : 'relative'}
        top={isFullscreen ? 0 : 'auto'}
        left={isFullscreen ? 0 : 'auto'}
        right={isFullscreen ? 0 : 'auto'}
        bottom={isFullscreen ? 0 : 'auto'}
        zIndex={isFullscreen ? 1000 : 'auto'}
        bg="transparent"
        display="flex"
        flexDirection="column"
        h="100%"
      >
        {/* Toolbar */}
        {showModeToggle && (
          <HStack
            justify="space-between"
            p={2}
            borderBottom="1px solid"
            borderColor={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}
          >
            <HStack gap={1}>
              {modeButtons.map(({ mode: btnMode, icon: Icon, label }) => (
                <Button
                  key={btnMode}
                  size="sm"
                  variant={mode === btnMode ? 'solid' : 'ghost'}
                  colorPalette={mode === btnMode ? 'blue' : 'gray'}
                  onClick={() => setInternalMode(btnMode)}
                  aria-label={label}
                  px={3}
                >
                  <Icon />
                  <Box as="span" display={{ base: 'none', md: 'inline' }} ml={2}>
                    {label}
                  </Box>
                </Button>
              ))}
            </HStack>

            <IconButton
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              size="sm"
              variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <LuMinimize2 /> : <LuMaximize2 />}
            </IconButton>
          </HStack>
        )}

        {/* Editor Area — headerSlot scrolls together with content */}
        <Box
          id={contentId}
          flex="1"
          overflow="auto"
          position="relative"
          css={headerSlot ? {
            // When a headerSlot is present, hand scroll control to this container.
            // CodeMirror's internal scroller becomes non-scrolling so everything
            // (title + content) moves as one document.
            '& .cm-editor': { height: 'auto', minHeight: '300px' },
            '& .cm-scroller': { overflow: 'hidden' },
          } : undefined}
        >
          {headerSlot}

          {mode === 'live-preview' && (
            <LivePreviewEditor
              ref={livePreviewRef}
              content={content}
              onChange={handleChange}
              onSave={handleSave}
              colorMode={colorMode}
              placeholder={placeholder}
            />
          )}

          {mode === 'source' && (
            <MarkdownEditor
              ref={sourceRef}
              content={content}
              onChange={handleChange}
              onSave={handleSave}
              colorMode={colorMode}
              placeholder={placeholder}
            />
          )}

          {mode === 'reading' && (
            <ReadingView content={content} colorMode={colorMode} />
          )}
        </Box>
      </Box>
    );
  }
);

export default ObsidianEditor;
