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
  /** Whether to select the H1 title on mount (for new file creation) */
  selectH1OnMount?: boolean;
  /** Callback when user exits H1 line (Enter or blur) - passes the new title */
  onH1Exit?: (newTitle: string) => void;
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
      selectH1OnMount = false,
      onH1Exit,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    const onH1ExitRef = useRef(onH1Exit);
    const wasOnH1Ref = useRef(false);

    // Keep refs updated
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onSaveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
      onH1ExitRef.current = onH1Exit;
    }, [onH1Exit]);

    // Memoize save keymap and H1 exit keymap
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

    // Keymap for detecting Enter on H1 line
    const h1ExitKeymap = useMemo(() => keymap.of([
      {
        key: 'Enter',
        run: (view) => {
          const line = view.state.doc.lineAt(view.state.selection.main.head);
          if (line.number === 1 && line.text.startsWith('# ')) {
            // Extract title from H1 line
            const h1Match = line.text.match(/^#\s+(.+)$/);
            if (h1Match && onH1ExitRef.current) {
              onH1ExitRef.current(h1Match[1].trim());
            }
            // Allow Enter to proceed normally (move to next line)
            return false;
          }
          return false;
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
      h1ExitKeymap,

      // Markdown language
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),

      // Placeholder
      placeholderExt(placeholder),

      // Update listener for content changes and H1 blur detection
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }

        // Detect H1 line exit (blur from H1 line)
        if (update.selectionSet) {
          const currentLine = update.state.doc.lineAt(update.state.selection.main.head);
          const isOnH1 = currentLine.number === 1;

          if (wasOnH1Ref.current && !isOnH1) {
            // User moved off H1 line - trigger H1 exit
            const firstLine = update.state.doc.line(1);
            const h1Match = firstLine.text.match(/^#\s+(.+)$/);
            if (h1Match && onH1ExitRef.current) {
              onH1ExitRef.current(h1Match[1].trim());
            }
          }

          wasOnH1Ref.current = isOnH1;
        }
      }),
    ], [placeholder, saveKeymap, h1ExitKeymap]);

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

      // Select H1 title on mount if requested (for new file creation flow)
      if (selectH1OnMount) {
        // Retry mechanism using RAF to ensure better alignment with render cycles
        let attempts = 0;
        const maxAttempts = 30; // Approx 500ms at 60fps

        const trySelectH1 = () => {
          // Check if view is still valid (matches current ref)
          if (!view || view !== viewRef.current) return;

          const content = view.state.doc.toString();
          const h1Match = content.match(/^#\s+(.+)$/m);

          // Conditions to stop retrying:
          // 1. Found key elements and have focus
          // 2. Max attempts reached

          if (h1Match) {
            const titleStart = content.indexOf(h1Match[1]);
            const titleEnd = titleStart + h1Match[1].length;

            // Dispatch selection
            view.dispatch({
              selection: { anchor: titleStart, head: titleEnd },
              scrollIntoView: true,
            });

            // Force focus
            view.focus();

            // Critical: Check if we actually have focus. 
            // If not, we keep trying. If yes, we do one more check in next frame to handle focus theft.
            if (view.hasFocus) {
              // We appear to have focus. One more check next frame to be sure.
              requestAnimationFrame(() => {
                if (view && view === viewRef.current && !view.hasFocus) {
                  view.focus();
                }
              });
              return; // Success path
            }
          }

          // If we are here, we either didn't find H1 or didn't have focus yet.
          if (attempts < maxAttempts) {
            attempts++;
            requestAnimationFrame(trySelectH1);
          }
        };

        // Start trying
        requestAnimationFrame(trySelectH1);
      }

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
