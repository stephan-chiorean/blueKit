/**
 * Utilities for serializing and manipulating markdown files with YAML front matter.
 */

import * as yaml from 'js-yaml';
import { KitFrontMatter } from '@/ipc';
import { parseFrontMatter } from './parseFrontMatter';

/**
 * Strips YAML front matter from markdown content.
 *
 * @param content - The markdown content with potential front matter
 * @returns The content without front matter
 *
 * @example
 * ```typescript
 * const content = `---
 * id: my-kit
 * ---
 *
 * # Content here`;
 * const body = stripFrontMatter(content);
 * // Returns: "# Content here"
 * ```
 */
export function stripFrontMatter(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

/**
 * Extracts the raw YAML front matter string from markdown content.
 *
 * @param content - The markdown content to extract from
 * @returns The raw YAML string (without delimiters), or null if not found
 */
export function extractFrontMatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  return match ? match[1] : null;
}

/**
 * Serializes front matter and body back into a complete markdown string.
 *
 * @param frontMatter - The front matter object to serialize
 * @param body - The markdown body content
 * @returns Complete markdown string with front matter
 *
 * @example
 * ```typescript
 * const result = serializeMarkdown(
 *   { id: 'my-kit', alias: 'My Kit' },
 *   '# Content here'
 * );
 * // Returns: "---\nid: my-kit\nalias: My Kit\n---\n\n# Content here"
 * ```
 */
export function serializeMarkdown(
  frontMatter: KitFrontMatter | null,
  body: string
): string {
  if (!frontMatter || Object.keys(frontMatter).length === 0) {
    return body;
  }

  const yamlStr = yaml.dump(frontMatter, {
    indent: 2,
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
  });

  return `---\n${yamlStr}---\n\n${body}`;
}

/**
 * Updates a specific field in the front matter and returns the new content.
 *
 * @param content - The original markdown content
 * @param field - The field to update
 * @param value - The new value for the field
 * @returns Updated markdown content
 *
 * @example
 * ```typescript
 * const updated = updateFrontMatterField(content, 'tags', ['new', 'tags']);
 * ```
 */
export function updateFrontMatterField<K extends keyof KitFrontMatter>(
  content: string,
  field: K,
  value: KitFrontMatter[K]
): string {
  const frontMatter = parseFrontMatter(content) || {};
  const body = stripFrontMatter(content);
  frontMatter[field] = value;
  return serializeMarkdown(frontMatter, body);
}

/**
 * Updates multiple fields in the front matter at once.
 *
 * @param content - The original markdown content
 * @param updates - Object with field-value pairs to update
 * @returns Updated markdown content
 */
export function updateFrontMatterFields(
  content: string,
  updates: Partial<KitFrontMatter>
): string {
  const frontMatter = parseFrontMatter(content) || {};
  const body = stripFrontMatter(content);
  Object.assign(frontMatter, updates);
  return serializeMarkdown(frontMatter, body);
}
