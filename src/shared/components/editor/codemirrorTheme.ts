/**
 * CodeMirror theme configuration for glassmorphism styling.
 *
 * Creates a transparent theme that works with the app's glassmorphism design,
 * supporting both light and dark color modes.
 */

import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { heading1Color } from '@/theme';

/**
 * Creates a glassmorphism-compatible CodeMirror theme.
 *
 * @param colorMode - Current color mode ('light' or 'dark')
 * @returns CodeMirror extension with theme styling
 */
export function createGlassmorphismTheme(colorMode: 'light' | 'dark'): Extension {
  const isLight = colorMode === 'light';

  // Base theme styling
  const theme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: isLight ? '#1a1a2e' : '#e4e4e7',
      fontFamily: 'inherit',
      fontSize: '16px',
      lineHeight: '1.75',
    },
    '.cm-content': {
      caretColor: isLight ? '#4287f5' : '#60a5fa',
      padding: '16px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: isLight ? '#4287f5' : '#60a5fa',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: isLight
        ? 'rgba(66, 135, 245, 0.2)'
        : 'rgba(96, 165, 250, 0.3)',
    },
    '.cm-activeLine': {
      backgroundColor: isLight
        ? 'rgba(0, 0, 0, 0.03)'
        : 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      borderRight: 'none',
      color: isLight ? '#9ca3af' : '#6b7280',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 8px',
      minWidth: '32px',
    },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
    '.cm-line': {
      padding: '0',
    },
    // Search match highlighting
    '.cm-searchMatch': {
      backgroundColor: isLight
        ? 'rgba(66, 135, 245, 0.3)'
        : 'rgba(96, 165, 250, 0.4)',
      outline: `1px solid ${isLight ? 'rgba(66, 135, 245, 0.5)' : 'rgba(96, 165, 250, 0.5)'}`,
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: isLight
        ? 'rgba(66, 135, 245, 0.5)'
        : 'rgba(96, 165, 250, 0.6)',
    },
    // Placeholder text
    '.cm-placeholder': {
      color: isLight ? '#9ca3af' : '#6b7280',
      fontStyle: 'italic',
    },
    // Focus outline
    '&.cm-focused': {
      outline: 'none',
    },
    // Tooltip styling
    '.cm-tooltip': {
      backgroundColor: isLight
        ? 'rgba(255, 255, 255, 0.9)'
        : 'rgba(30, 30, 35, 0.9)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}`,
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      '& > ul > li': {
        padding: '4px 8px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: isLight
          ? 'rgba(66, 135, 245, 0.2)'
          : 'rgba(96, 165, 250, 0.3)',
      },
    },
  }, { dark: !isLight });

  return theme;
}

/**
 * Creates syntax highlighting styles for markdown.
 *
 * @param colorMode - Current color mode ('light' or 'dark')
 * @returns CodeMirror extension with syntax highlighting
 */
export function createMarkdownHighlighting(colorMode: 'light' | 'dark'): Extension {
  const isLight = colorMode === 'light';

  const highlightStyle = HighlightStyle.define([
    // Headings
    {
      tag: tags.heading1,
      fontSize: '1.875rem',
      fontWeight: '700',
      color: isLight ? heading1Color.light : heading1Color.dark,
      lineHeight: '2.25',
    },
    {
      tag: tags.heading2,
      fontSize: '1.5rem',
      fontWeight: '600',
      color: isLight ? '#4287f5' : '#60a5fa',
      lineHeight: '2',
    },
    {
      tag: tags.heading3,
      fontSize: '1.25rem',
      fontWeight: '600',
      color: isLight ? '#5b9cf5' : '#93c5fd',
      lineHeight: '1.75',
    },
    {
      tag: [tags.heading4, tags.heading5, tags.heading6],
      fontSize: '1rem',
      fontWeight: '600',
      color: isLight ? '#6ba8f6' : '#a5d4fc',
      lineHeight: '1.75',
    },
    // Links
    {
      tag: tags.link,
      color: isLight ? '#4287f5' : '#60a5fa',
      textDecoration: 'underline',
    },
    {
      tag: tags.url,
      color: isLight ? '#6b7280' : '#9ca3af',
    },
    // Emphasis
    {
      tag: tags.emphasis,
      fontStyle: 'italic',
    },
    {
      tag: tags.strong,
      fontWeight: '700',
    },
    {
      tag: tags.strikethrough,
      textDecoration: 'line-through',
      color: isLight ? '#9ca3af' : '#6b7280',
    },
    // Code
    {
      tag: tags.monospace,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.9em',
      backgroundColor: isLight
        ? 'rgba(0, 0, 0, 0.05)'
        : 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      padding: '2px 6px',
    },
    // Quotes
    {
      tag: tags.quote,
      fontStyle: 'italic',
      color: isLight ? '#6b7280' : '#9ca3af',
      borderLeft: `4px solid ${isLight ? '#e5e7eb' : '#374151'}`,
      paddingLeft: '12px',
    },
    // Lists
    {
      tag: tags.list,
      color: isLight ? '#4b5563' : '#d1d5db',
    },
    // Meta (front matter, etc.)
    {
      tag: tags.meta,
      color: isLight ? '#9ca3af' : '#6b7280',
    },
    // Processing instruction (like `---` delimiters)
    {
      tag: tags.processingInstruction,
      color: isLight ? '#9ca3af' : '#6b7280',
    },
    // Comments
    {
      tag: tags.comment,
      color: isLight ? '#9ca3af' : '#6b7280',
      fontStyle: 'italic',
    },
    // Content (default text)
    {
      tag: tags.content,
      color: isLight ? '#1a1a2e' : '#e4e4e7',
    },
  ]);

  return syntaxHighlighting(highlightStyle);
}

/**
 * Creates the complete CodeMirror theme extension bundle.
 *
 * @param colorMode - Current color mode ('light' or 'dark')
 * @returns Array of CodeMirror extensions for theming
 */
export function createEditorTheme(colorMode: 'light' | 'dark'): Extension[] {
  return [
    createGlassmorphismTheme(colorMode),
    createMarkdownHighlighting(colorMode),
  ];
}
