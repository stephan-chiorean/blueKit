/**
 * Live Preview theme for Obsidian-style editor.
 *
 * Reskins CodeMirror to match the app's existing markdown styling.
 */

import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { heading1Color, headingAccentColor } from '@/theme';

/**
 * Creates the Live Preview theme extension.
 */
export function createLivePreviewTheme(colorMode: 'light' | 'dark'): Extension {
  const isLight = colorMode === 'light';

  const text = isLight ? '#1a1a2e' : '#e4e4e7';
  const textMuted = isLight ? '#6b7280' : '#9ca3af';
  const accent = isLight ? headingAccentColor.light : headingAccentColor.dark;
  const accentHover = '#2563eb';
  const border = isLight ? '#e5e7eb' : '#374151';
  const surfaceSubtle = isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)';
  const textShadow = isLight
    ? '0 1px 2px rgba(0, 0, 0, 0.1)'
    : '0 1px 2px rgba(0, 0, 0, 0.5)';

  return EditorView.theme({

    // ========== Document Surface ==========

    '&': {
      backgroundColor: 'transparent',
      color: text,
      fontSize: '16px',
    },

    '.cm-scroller': {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      lineHeight: '1.75',
      padding: '20px 40px',
      overflowX: 'hidden',
    },

    '.cm-content': {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '16px',
      lineHeight: '1.75',
      padding: '0',
      caretColor: accent,
      maxWidth: '750px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },

    '.cm-line': {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '1px 0',
      textShadow,
    },

    '.cm-activeLine': {
      backgroundColor: surfaceSubtle,
      borderRadius: '2px',
    },

    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: isLight
        ? 'rgba(66, 135, 245, 0.15)'
        : 'rgba(96, 165, 250, 0.25)',
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: accent,
      borderLeftWidth: '1.5px',
    },

    '.cm-gutters': {
      display: 'none',
    },

    '&.cm-focused': {
      outline: 'none',
    },

    '.cm-placeholder': {
      color: textMuted,
      fontStyle: 'italic',
    },

    // ========== Text Formatting ==========

    '.cm-lp-strong': {
      fontWeight: '700',
    },

    '.cm-lp-emphasis': {
      fontStyle: 'italic',
    },

    '.cm-lp-strikethrough': {
      textDecoration: 'line-through',
      color: textMuted,
    },

    '.cm-lp-inline-code': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.9em',
      backgroundColor: isLight
        ? 'rgba(0, 0, 0, 0.06)'
        : 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      padding: '2px 6px',
    },

    // ========== Headings ==========
    // Match the app's heading hierarchy: h1 bold, h2+ semibold, h2 accent color

    '.cm-lp-heading': {
      fontWeight: '700',
      textShadow,
    },
    '.cm-lp-heading-1': {
      fontSize: '1.875rem',
      lineHeight: '2.25',
      color: isLight ? heading1Color.light : heading1Color.dark,
    },
    '.cm-lp-heading-2': {
      fontSize: '1.875rem',
      fontWeight: '600',
      lineHeight: '2.25',
      color: accent,
    },
    '.cm-lp-heading-3': {
      fontSize: '1.125rem',
      fontWeight: '600',
      lineHeight: '1.75',
    },
    '.cm-lp-heading-4': {
      fontSize: '1rem',
      fontWeight: '600',
      lineHeight: '1.75',
    },
    '.cm-lp-heading-5': {
      fontSize: '1rem',
      fontWeight: '600',
      lineHeight: '1.75',
    },
    '.cm-lp-heading-6': {
      fontSize: '1rem',
      fontWeight: '600',
      lineHeight: '1.75',
    },

    // ========== Links ==========

    '.cm-lp-link': {
      color: accent,
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      cursor: 'pointer',
    },
    '.cm-lp-link:hover': {
      color: accentHover,
    },
    '.cm-lp-link-url': {
      color: textMuted,
      fontSize: '0.9em',
    },

    // ========== Lists ==========

    '.cm-lp-list-marker': {
      color: textMuted,
    },
    '.cm-lp-bullet': {
      display: 'inline-block',
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      backgroundColor: textMuted,
      verticalAlign: 'middle',
      marginRight: '8px',
    },

    // Task checkbox
    '.cm-lp-checkbox': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '16px',
      height: '16px',
      marginRight: '0.5em',
      border: `1.5px solid ${isLight ? '#d1d5db' : '#4b5563'}`,
      borderRadius: '3px',
      cursor: 'pointer',
      verticalAlign: 'middle',
      transition: 'all 0.15s ease',
    },
    '.cm-lp-checkbox:hover': {
      borderColor: accent,
    },
    '.cm-lp-checkbox-checked': {
      backgroundColor: accent,
      borderColor: accent,
    },
    '.cm-lp-task-done': {
      textDecoration: 'line-through',
      color: textMuted,
    },

    // ========== Blockquotes ==========

    '.cm-lp-blockquote': {
      borderLeft: `4px solid ${border}`,
      paddingLeft: '16px',
      color: textMuted,
      fontStyle: 'italic',
    },

    // ========== Code Blocks ==========

    '.cm-lp-code-block': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.9em',
      lineHeight: '1.6',
    },
    '.cm-lp-code-block-container': {
      background: isLight
        ? 'rgba(0, 0, 0, 0.03)'
        : 'rgba(255, 255, 255, 0.05)',
      border: `1px solid ${isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)'}`,
      borderRadius: '6px',
      margin: '8px 0',
      overflow: 'hidden',
    },
    '.cm-lp-code-lang': {
      fontSize: '0.75rem',
      color: textMuted,
      padding: '4px 12px',
      borderBottom: `1px solid ${isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)'}`,
    },
    '.cm-lp-code-block-pre': {
      margin: '0',
      padding: '12px 16px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.9em',
      lineHeight: '1.6',
      overflowX: 'auto',
      whiteSpace: 'pre',
      color: text,
    },

    // ========== Tables ==========

    '.cm-lp-table-widget': {
      borderCollapse: 'collapse',
      width: '100%',
      marginBottom: '1rem',
      fontSize: '0.9375rem',
    },
    '.cm-lp-table-widget th': {
      padding: '6px 12px',
      fontWeight: '600',
      textAlign: 'left',
      borderBottom: `2px solid ${border}`,
      backgroundColor: surfaceSubtle,
      whiteSpace: 'nowrap',
    },
    '.cm-lp-table-widget td': {
      padding: '6px 12px',
      verticalAlign: 'top',
      borderBottom: `1px solid ${border}`,
    },
    '.cm-lp-table-widget tr:last-child td': {
      borderBottom: 'none',
    },

    // ========== Horizontal Rule ==========

    '.cm-lp-hr-widget': {
      display: 'block',
      border: 'none',
      borderTop: `1px solid ${border}`,
      margin: '16px 0',
      width: '100%',
    },

    // ========== Syntax Markers ==========

    '.cm-lp-syntax-hidden': {
      fontSize: '0',
      color: 'transparent',
    },
    '.cm-lp-syntax-visible': {
      color: isLight ? '#c4c4c8' : '#52525b',
    },

  }, { dark: !isLight });
}
