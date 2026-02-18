/**
 * Live Preview Plugin Assembly.
 *
 * Combines the ViewPlugin with theme extensions for a complete
 * Obsidian-style Live Preview experience.
 */

import { Extension } from '@codemirror/state';
import { livePreviewPlugin, readingModePlugin, livePreviewTableField, readingModeTableField, createLivePreviewCodeBlockField } from './viewPlugin';
import { createLivePreviewTheme } from '../../theme/livePreviewTheme';

/**
 * Create the complete Live Preview extension bundle.
 * Cursor-aware: reveals syntax when cursor enters formatted region.
 * Tables are handled via StateField (can replace multi-line content).
 */
export function createLivePreviewExtension(colorMode: 'light' | 'dark'): Extension {
  return [
    livePreviewPlugin,
    livePreviewTableField,
    createLivePreviewCodeBlockField(colorMode),
    createLivePreviewTheme(colorMode),
  ];
}

/**
 * Create the Reading mode extension bundle.
 * Same theme, but always hides all syntax markers.
 * Tables are handled via StateField (can replace multi-line content).
 */
export function createReadingExtension(colorMode: 'light' | 'dark'): Extension {
  return [
    readingModePlugin,
    readingModeTableField,
    createLivePreviewTheme(colorMode),
  ];
}

export { livePreviewPlugin, readingModePlugin };
