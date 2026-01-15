/**
 * CodeMirror-based Markdown Editor component.
 *
 * Provides a rich editing experience for markdown files with:
 * - Syntax highlighting for markdown
 * - Glassmorphism-compatible theming
 * - Read-only mode toggle
 * - Keyboard shortcuts
 * - Search functionality
 */

import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExt, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { createEditorTheme } from './codemirrorTheme';
import { Box } from '@chakra-ui/react';

export interface MarkdownEditorProps {
  /** The markdown content to edit */
  content: string;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when save is triggered (Cmd/Ctrl+S) */
  onSave?: (content: string) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Current color mode for theming */
  colorMode: 'light' | 'dark';
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
}

export interface MarkdownEditorRef {
  /** Focus the editor */
  focus: () => void;
  /** Get current content */
  getContent: () => string;
  /** Set content programmatically */
  setContent: (content: string) => void;
  /** Get scroll position */
  getScrollPosition: () => { top: number; left: number };
  /** Set scroll position */
  setScrollPosition: (position: { top: number; left: number }) => void;
  /** Get the EditorView instance */
  getView: () => EditorView | null;
  /** Select the H1 title text (after # ) and focus the editor */
  selectH1Title: () => void;
}

// Create compartments for dynamic reconfiguration
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();

/**
 * A CodeMirror-based markdown editor with glassmorphism styling.
 */
const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      content,
      onChange,
      onSave,
      readOnly = false,
      colorMode,
      placeholder = 'Start writing...',
      showLineNumbers = false,
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

    // Memoize save keymap
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

    // Build static extensions (those that don't change)
    const staticExtensions = useMemo((): Extension[] => [
      // Core extensions
      history(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),

      // Keymaps
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      saveKeymap,

      // Markdown language
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),

      // Placeholder
      placeholderExt(placeholder),

      // Update listener
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
          // Dynamic compartments
          themeCompartment.of(createEditorTheme(colorMode)),
          readOnlyCompartment.of([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Recreate editor when static extensions change
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staticExtensions]);

    // Update theme when color mode changes
    useEffect(() => {
      if (!viewRef.current) return;

      viewRef.current.dispatch({
        effects: themeCompartment.reconfigure(createEditorTheme(colorMode)),
      });
    }, [colorMode]);

    // Update read-only state
    useEffect(() => {
      if (!viewRef.current) return;

      viewRef.current.dispatch({
        effects: readOnlyCompartment.reconfigure([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
      });
    }, [readOnly]);

    // Update line numbers
    useEffect(() => {
      if (!viewRef.current) return;

      viewRef.current.dispatch({
        effects: lineNumbersCompartment.reconfigure(showLineNumbers ? lineNumbers() : []),
      });
    }, [showLineNumbers]);

    // Sync content from props (for external changes)
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
      getScrollPosition: () => {
        if (!viewRef.current) return { top: 0, left: 0 };
        const scrollDOM = viewRef.current.scrollDOM;
        return {
          top: scrollDOM.scrollTop,
          left: scrollDOM.scrollLeft,
        };
      },
      setScrollPosition: (position: { top: number; left: number }) => {
        if (!viewRef.current) return;
        const scrollDOM = viewRef.current.scrollDOM;
        scrollDOM.scrollTop = position.top;
        scrollDOM.scrollLeft = position.left;
      },
      getView: () => viewRef.current,
      selectH1Title: () => {
        if (!viewRef.current) return;
        const content = viewRef.current.state.doc.toString();
        // Find the H1 heading: # Title
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
          const titleStart = content.indexOf(h1Match[1]);
          const titleEnd = titleStart + h1Match[1].length;
          // Set selection and focus
          viewRef.current.dispatch({
            selection: { anchor: titleStart, head: titleEnd },
          });
          viewRef.current.focus();
        }
      },
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

export default MarkdownEditor;
