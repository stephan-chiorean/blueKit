/**
 * Live Preview Editor component.
 *
 * CodeMirror 6 editor with cursor-aware decoration hiding.
 * Syntax markers are hidden when cursor is elsewhere, revealed when inside.
 */

import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  placeholder as placeholderExt,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { forceParsing } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { Box } from '@chakra-ui/react';
import { createLivePreviewExtension } from './plugins/livePreview';

export interface LivePreviewEditorProps {
  content: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  colorMode: 'light' | 'dark';
  placeholder?: string;
}

export interface LivePreviewEditorRef {
  focus: () => void;
  getContent: () => string;
  setContent: (content: string) => void;
  getView: () => EditorView | null;
}

// Compartments for dynamic reconfiguration
const themeCompartment = new Compartment();

const LivePreviewEditor = forwardRef<LivePreviewEditorRef, LivePreviewEditorProps>(
  function LivePreviewEditor(
    {
      content,
      onChange,
      onSave,
      colorMode,
      placeholder = 'Start writing...',
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);

    // Keep refs updated
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onSaveRef.current = onSave;
    }, [onSave]);

    // Save keymap
    const saveKeymap = useMemo(() => keymap.of([
      {
        key: 'Mod-s',
        run: (view) => {
          if (onSaveRef.current) {
            onSaveRef.current(view.state.doc.toString());
          }
          return true;
        },
      },
    ]), []);

    // Static extensions
    const staticExtensions = useMemo((): Extension[] => [
      // Core extensions
      history(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      drawSelection(),

      // Keymaps
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      saveKeymap,

      // Markdown language support
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),

      // Placeholder
      placeholderExt(placeholder),

      // Line wrapping
      EditorView.lineWrapping,

      // Update listener for content changes
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ], [placeholder, saveKeymap]);

    // Initialize editor
    useEffect(() => {
      if (!containerRef.current) return;

      // Clean up existing view
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const state = EditorState.create({
        doc: content,
        extensions: [
          ...staticExtensions,
          // Live Preview plugin with theme
          themeCompartment.of(createLivePreviewExtension(colorMode)),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      // Parse the full document synchronously before first paint so all
      // decoration plugins see a complete syntax tree on their first run.
      // This prevents the "flash of unstyled content" when entering edit mode.
      forceParsing(view, view.state.doc.length, 200);

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staticExtensions]);

    // Update theme when color mode changes
    useEffect(() => {
      if (!viewRef.current) return;

      viewRef.current.dispatch({
        effects: themeCompartment.reconfigure(createLivePreviewExtension(colorMode)),
      });
    }, [colorMode]);

    // Sync content from props
    useEffect(() => {
      if (!viewRef.current) return;

      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
        });
      }
    }, [content]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      getContent: () => {
        return viewRef.current?.state.doc.toString() || '';
      },
      setContent: (newContent: string) => {
        if (!viewRef.current) return;
        const currentContent = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: newContent,
          },
        });
      },
      getView: () => viewRef.current,
    }), []);

    return (
      <Box
        ref={containerRef}
        h="100%"
        w="100%"
        css={{
          '& .cm-editor': {
            height: '100%',
          },
          '& .cm-scroller': {
            overflow: 'auto',
          },
        }}
      />
    );
  }
);

export default LivePreviewEditor;
