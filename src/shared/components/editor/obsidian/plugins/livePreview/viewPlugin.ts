/**
 * ViewPlugin for Live Preview mode.
 *
 * This plugin manages decorations that:
 * - Hide markdown syntax when cursor is elsewhere
 * - Reveal syntax when cursor enters formatted region
 * - Apply styling to formatted content
 */

import {
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  EditorView,
  PluginValue,
} from '@codemirror/view';
import { StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { buildDecorations, buildTableDecorations, buildCodeBlockDecorations } from './decorationBuilder';

/**
 * Live Preview plugin class.
 */
class LivePreviewPlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      update.focusChanged ||
      // Rebuild when the async parser advances the syntax tree
      syntaxTree(update.view.state) !== syntaxTree(update.startState)
    ) {
      this.decorations = buildDecorations(update.view);
    }
  }

  destroy(): void {
    // Nothing to clean up
  }
}

/**
 * Create the Live Preview ViewPlugin.
 *
 * This plugin provides cursor-aware hiding of markdown syntax markers
 * while keeping the formatted content styled.
 */
export const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (v) => v.decorations,
});

/**
 * Reading mode plugin — always hides all syntax markers (no cursor awareness).
 */
class ReadingModePlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view, true);
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.viewportChanged ||
      syntaxTree(update.view.state) !== syntaxTree(update.startState)
    ) {
      this.decorations = buildDecorations(update.view, true);
    }
  }

  destroy(): void {}
}

export const readingModePlugin = ViewPlugin.fromClass(ReadingModePlugin, {
  decorations: (v) => v.decorations,
});

/**
 * Factory for the code-block StateField.
 *
 * Fenced code blocks span multiple lines, so they cannot be replaced inside a ViewPlugin.
 * A StateField has no such restriction.
 *
 * A factory (rather than a module-level singleton) is used so the colorMode can be
 * captured per-call.  The field lives inside the themeCompartment, so it is re-created
 * whenever the color mode changes, producing widgets with the correct Shiki theme.
 */
export function createLivePreviewCodeBlockField(colorMode: 'light' | 'dark') {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildCodeBlockDecorations(state, false, colorMode);
    },
    update(value, tr) {
      if (
        tr.docChanged ||
        tr.selection !== undefined ||
        syntaxTree(tr.state) !== syntaxTree(tr.startState)
      ) {
        return buildCodeBlockDecorations(tr.state, false, colorMode);
      }
      return value;
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });
}

/**
 * StateField for table decorations in Live Preview mode.
 *
 * Tables span multiple lines, so they cannot be replaced inside a ViewPlugin
 * (which forbids line-break-spanning replacements). StateField has no such
 * restriction and is rebuilt whenever the document or cursor selection changes.
 */
export const livePreviewTableField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state, false);
  },
  update(value, tr) {
    if (
      tr.docChanged ||
      tr.selection !== undefined ||
      syntaxTree(tr.state) !== syntaxTree(tr.startState)
    ) {
      return buildTableDecorations(tr.state, false);
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

/**
 * StateField for table decorations in Reading mode.
 * Always hides raw table syntax regardless of cursor position.
 */
export const readingModeTableField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state, true);
  },
  update(value, tr) {
    if (tr.docChanged || syntaxTree(tr.state) !== syntaxTree(tr.startState)) {
      return buildTableDecorations(tr.state, true);
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});
