/**
 * Decoration builder for Live Preview.
 *
 * Coordinates all decoration modules to build a complete DecorationSet.
 * Decorations are built in document order to ensure proper stacking.
 */

import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, EditorSelection, EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNodeRef } from '@lezer/common';

/**
 * Check if cursor is inside a given range (inclusive).
 */
function cursorInRange(
  selection: EditorSelection,
  from: number,
  to: number
): boolean {
  const main = selection.main;
  return main.from <= to && main.to >= from;
}

/**
 * Decoration entry for sorting
 */
interface DecorationEntry {
  from: number;
  to: number;
  decoration: Decoration;
  isLine?: boolean;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  sh: 'bash', yml: 'yaml', rs: 'rust', py: 'python',
};

// Module-level cache: colorMode:lang:code → highlighted HTML string.
// Eliminates the plain-text flash when the same block is re-rendered
// (e.g. after a decoration rebuild triggered by the syntax tree updating).
const shikiHtmlCache = new Map<string, string>();

/** Renders a styled, Shiki-highlighted code block in place of the raw fenced-code syntax. */
export class CodeBlockWidget extends WidgetType {
  constructor(
    readonly lang: string,
    readonly code: string,
    readonly colorMode: 'light' | 'dark',
  ) { super(); }

  private get cacheKey(): string {
    return `${this.colorMode}:${this.lang}:${this.code}`;
  }

  private applyHtml(placeholder: HTMLElement, html: string): void {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const shikiPre = tmp.querySelector('pre');
    if (shikiPre) {
      shikiPre.style.backgroundColor = 'transparent';
      shikiPre.style.margin = '0';
      shikiPre.style.padding = '12px 16px';
      shikiPre.style.lineHeight = '1.6';
      shikiPre.style.overflowX = 'auto';
      placeholder.replaceWith(shikiPre);
    }
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-lp-code-block-container';

    if (this.lang) {
      const langBar = document.createElement('div');
      langBar.className = 'cm-lp-code-lang';
      langBar.textContent = this.lang;
      container.appendChild(langBar);
    }

    const pre = document.createElement('pre');
    pre.className = 'cm-lp-code-block-pre';
    const codeEl = document.createElement('code');
    codeEl.textContent = this.code;
    pre.appendChild(codeEl);
    container.appendChild(pre);

    // If cached, apply highlighted HTML immediately — no flash
    const cached = shikiHtmlCache.get(this.cacheKey);
    if (cached) {
      this.applyHtml(pre, cached);
    } else {
      // First time: async highlight then cache
      this.highlightAsync(pre);
    }

    return container;
  }

  private async highlightAsync(pre: HTMLElement): Promise<void> {
    try {
      const { codeToHtml } = await import('shiki');
      const rawLang = this.lang || 'text';
      const lang = LANG_MAP[rawLang] || rawLang;
      const theme = this.colorMode === 'dark' ? 'github-dark' : 'github-light';
      const html = await codeToHtml(this.code, { lang, theme });

      shikiHtmlCache.set(this.cacheKey, html);

      if (!pre.isConnected) return;
      this.applyHtml(pre, html);
    } catch {
      // Keep plain-text fallback on error
    }
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof CodeBlockWidget &&
      other.lang === this.lang &&
      other.code === this.code &&
      other.colorMode === this.colorMode
    );
  }
  ignoreEvent(): boolean { return false; }
}

/** Renders a visual <table> in place of the raw GFM table syntax. */
export class TableWidget extends WidgetType {
  constructor(readonly source: string) { super(); }

  toDOM(): HTMLElement {
    const lines = this.source.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const table = document.createElement('table');
    table.className = 'cm-lp-table-widget';

    let headerCells: string[] | null = null;
    let sepFound = false;
    const bodyRows: string[][] = [];

    for (const line of lines) {
      // Parse pipe-delimited cells
      const cells = line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      // Separator row: every cell is dashes (with optional colons)
      if (!sepFound && cells.every(c => /^:?-+:?$/.test(c))) {
        sepFound = true;
        continue;
      }
      if (!sepFound) {
        headerCells = cells;
      } else {
        bodyRows.push(cells);
      }
    }

    if (headerCells) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      for (const cell of headerCells) {
        const th = document.createElement('th');
        th.textContent = cell;
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    for (const row of bodyRows) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
  }

  eq(other: WidgetType): boolean {
    return other instanceof TableWidget && other.source === this.source;
  }
  ignoreEvent(): boolean { return false; }
}

/** Renders a visual <hr> in place of the --- syntax. */
class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'cm-lp-hr-widget';
    return hr;
  }
  eq(): boolean { return true; }
  ignoreEvent(): boolean { return true; }
}

/**
 * Build all decorations for the Live Preview view.
 * When readingMode is true, all syntax is always hidden (no cursor awareness).
 */
export function buildDecorations(view: EditorView, readingMode = false): DecorationSet {
  const { state } = view;
  const selection = state.selection;
  const hasFocus = view.hasFocus;
  const entries: DecorationEntry[] = [];

  syntaxTree(state).iterate({
    enter: (node: SyntaxNodeRef) => {
      const cursorInside = (readingMode || !hasFocus) ? false : cursorInRange(selection, node.from, node.to);

      switch (node.name) {
        // Strong emphasis: **bold** or __bold__
        case 'StrongEmphasis': {
          const text = state.sliceDoc(node.from, node.to);
          const markerLen = text.startsWith('**') ? 2 : text.startsWith('__') ? 2 : 0;
          if (markerLen === 0) break;

          const contentStart = node.from + markerLen;
          const contentEnd = node.to - markerLen;
          if (contentEnd <= contentStart) break;

          if (!cursorInside) {
            entries.push({ from: node.from, to: contentStart, decoration: Decoration.replace({}) });
            entries.push({ from: contentEnd, to: node.to, decoration: Decoration.replace({}) });
          }
          entries.push({ from: contentStart, to: contentEnd, decoration: Decoration.mark({ class: 'cm-lp-strong' }) });
          break;
        }

        // Emphasis: *italic* or _italic_
        case 'Emphasis': {
          const text = state.sliceDoc(node.from, node.to);
          const markerLen = (text.startsWith('*') && !text.startsWith('**')) ? 1
            : (text.startsWith('_') && !text.startsWith('__')) ? 1 : 0;
          if (markerLen === 0) break;

          const contentStart = node.from + markerLen;
          const contentEnd = node.to - markerLen;
          if (contentEnd <= contentStart) break;

          if (!cursorInside) {
            entries.push({ from: node.from, to: contentStart, decoration: Decoration.replace({}) });
            entries.push({ from: contentEnd, to: node.to, decoration: Decoration.replace({}) });
          }
          entries.push({ from: contentStart, to: contentEnd, decoration: Decoration.mark({ class: 'cm-lp-emphasis' }) });
          break;
        }

        // Strikethrough: ~~text~~
        case 'Strikethrough': {
          const contentStart = node.from + 2;
          const contentEnd = node.to - 2;
          if (contentEnd <= contentStart) break;

          if (!cursorInside) {
            entries.push({ from: node.from, to: contentStart, decoration: Decoration.replace({}) });
            entries.push({ from: contentEnd, to: node.to, decoration: Decoration.replace({}) });
          }
          entries.push({ from: contentStart, to: contentEnd, decoration: Decoration.mark({ class: 'cm-lp-strikethrough' }) });
          break;
        }

        // Inline code: `code`
        case 'InlineCode': {
          const text = state.sliceDoc(node.from, node.to);
          let backtickCount = 0;
          for (let i = 0; i < text.length && text[i] === '`'; i++) {
            backtickCount++;
          }
          if (backtickCount === 0) break;

          const contentStart = node.from + backtickCount;
          const contentEnd = node.to - backtickCount;
          if (contentEnd <= contentStart) break;

          if (!cursorInside) {
            entries.push({ from: node.from, to: contentStart, decoration: Decoration.replace({}) });
            entries.push({ from: contentEnd, to: node.to, decoration: Decoration.replace({}) });
          }
          entries.push({ from: contentStart, to: contentEnd, decoration: Decoration.mark({ class: 'cm-lp-inline-code' }) });
          break;
        }

        // Headings: # H1, ## H2, etc.
        case 'ATXHeading1':
        case 'ATXHeading2':
        case 'ATXHeading3':
        case 'ATXHeading4':
        case 'ATXHeading5':
        case 'ATXHeading6': {
          const level = parseInt(node.name.slice(-1), 10);
          const lineText = state.sliceDoc(node.from, node.to);
          const hashMatch = lineText.match(/^(#{1,6})\s*/);
          if (!hashMatch) break;

          const markerLen = hashMatch[0].length;
          const contentStart = node.from + markerLen;
          const contentEnd = node.to;

          if (!cursorInside && contentStart < contentEnd) {
            entries.push({ from: node.from, to: contentStart, decoration: Decoration.replace({}) });
          }
          if (contentStart < contentEnd) {
            entries.push({ from: contentStart, to: contentEnd, decoration: Decoration.mark({ class: `cm-lp-heading cm-lp-heading-${level}` }) });
          }
          break;
        }

        // Links: [text](url)
        case 'Link': {
          const text = state.sliceDoc(node.from, node.to);
          const match = text.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
          if (!match) break;

          const linkText = match[1];
          const textStart = node.from + 1;
          const textEnd = textStart + linkText.length;
          const closeParen = node.to;

          if (!cursorInside) {
            entries.push({ from: node.from, to: textStart, decoration: Decoration.replace({}) });
            entries.push({ from: textEnd, to: closeParen, decoration: Decoration.replace({}) });
          }
          entries.push({
            from: textStart,
            to: textEnd,
            decoration: Decoration.mark({
              class: 'cm-lp-link',
              attributes: { 'data-url': match[2], title: match[2] }
            })
          });
          break;
        }

        // Blockquote
        case 'Blockquote': {
          entries.push({ from: node.from, to: node.to, decoration: Decoration.mark({ class: 'cm-lp-blockquote' }) });

          if (!cursorInside) {
            const text = state.sliceDoc(node.from, node.to);
            const lines = text.split('\n');
            let pos = node.from;

            for (const line of lines) {
              const quoteMatch = line.match(/^(\s*>+\s*)/);
              if (quoteMatch) {
                const markerEnd = pos + quoteMatch[1].length;
                entries.push({ from: pos, to: markerEnd, decoration: Decoration.replace({}) });
              }
              pos += line.length + 1;
            }
          }
          break;
        }

        // Horizontal rule: --- / *** / ___
        case 'HorizontalRule': {
          if (!cursorInside) {
            // Replace the --- text with a rendered <hr> widget
            entries.push({
              from: node.from,
              to: node.to,
              decoration: Decoration.replace({ widget: new HorizontalRuleWidget() }),
            });
          }
          // When cursor is inside, raw --- is visible (no decoration needed)
          break;
        }
      }
    },
  });

  // Sort entries by position (required by RangeSetBuilder)
  // Line decorations are handled separately
  const markEntries = entries.filter(e => !e.isLine);

  markEntries.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - b.to;
  });

  // Build the decoration set
  const builder = new RangeSetBuilder<Decoration>();
  for (const entry of markEntries) {
    try {
      builder.add(entry.from, entry.to, entry.decoration);
    } catch (e) {
      // Skip invalid ranges
    }
  }

  return builder.finish();
}

/**
 * Build table decorations separately via StateField.
 * StateField can replace multi-line content; ViewPlugin cannot.
 */
export function buildTableDecorations(state: EditorState, readingMode = false): DecorationSet {
  const selection = state.selection;
  const entries: DecorationEntry[] = [];

  syntaxTree(state).iterate({
    enter: (node: SyntaxNodeRef) => {
      if (node.name !== 'Table') return;

      const cursorInside = readingMode ? false : cursorInRange(selection, node.from, node.to);

      if (!cursorInside) {
        const source = state.sliceDoc(node.from, node.to);
        entries.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.replace({ widget: new TableWidget(source) }),
        });
      }

      // Don't descend — we replaced the whole node
      return false;
    },
  });

  entries.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - b.to;
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const entry of entries) {
    try {
      builder.add(entry.from, entry.to, entry.decoration);
    } catch {
      // Skip invalid ranges
    }
  }

  return builder.finish();
}

/**
 * Build code-block decorations via StateField.
 * StateField can replace multi-line content; ViewPlugin cannot.
 * When cursor is outside a FencedCode node, replaces it with a CodeBlockWidget.
 */
export function buildCodeBlockDecorations(
  state: EditorState,
  readingMode = false,
  colorMode: 'light' | 'dark' = 'dark',
): DecorationSet {
  const selection = state.selection;
  const entries: DecorationEntry[] = [];

  syntaxTree(state).iterate({
    enter: (node: SyntaxNodeRef) => {
      if (node.name !== 'FencedCode') return;

      const cursorInside = readingMode ? false : cursorInRange(selection, node.from, node.to);

      if (!cursorInside) {
        const text = state.sliceDoc(node.from, node.to);
        const lines = text.split('\n');

        const openMatch = lines[0]?.match(/^(`{3,}|~{3,})(\w*)?/);
        const lang = openMatch?.[2] ?? '';

        // Find last non-empty line as the closing fence
        let lastLineIdx = lines.length - 1;
        while (lastLineIdx > 0 && lines[lastLineIdx].trim() === '') lastLineIdx--;

        const hasClosing = lastLineIdx > 0 && /^(`{3,}|~{3,})\s*$/.test(lines[lastLineIdx]);
        const codeLines = lines.slice(1, hasClosing ? lastLineIdx : undefined);
        const code = codeLines.join('\n');

        entries.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.replace({ widget: new CodeBlockWidget(lang, code, colorMode), block: true }),
        });
      }

      // Don't descend — we replaced (or ignored) the whole node
      return false;
    },
  });

  entries.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - b.to;
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const entry of entries) {
    try {
      builder.add(entry.from, entry.to, entry.decoration);
    } catch {
      // Skip invalid ranges
    }
  }

  return builder.finish();
}
