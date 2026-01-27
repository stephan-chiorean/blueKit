import * as yaml from 'js-yaml';
import { KitFrontMatter } from '@/ipc';

/**
 * Parses YAML front matter from a markdown file.
 * 
 * Front matter is expected to be between `---` delimiters at the start of the file.
 * 
 * @param content - The file content to parse
 * @returns The parsed front matter object, or undefined if not found
 * 
 * @example
 * ```typescript
 * const content = `---
 * id: my-kit
 * alias: My Kit
 * description: "A great kit"
 * ---
 * 
 * # Content here
 * `;
 * const frontMatter = parseFrontMatter(content);
 * console.log(frontMatter?.alias); // "My Kit"
 * ```
 */
export function parseFrontMatter(content: string): KitFrontMatter | undefined {
  // Match front matter between --- delimiters
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontMatterRegex);
  
  if (!match || !match[1]) {
    return undefined;
  }
  
  try {
    const parsed = yaml.load(match[1]) as KitFrontMatter;
    return parsed;
  } catch (error) {
    console.error('Failed to parse YAML front matter:', error);
    return undefined;
  }
}

/**
 * Extracts the first heading (H1) from markdown content.
 * 
 * Looks for the first line that starts with `# ` (single hash followed by space).
 * Skips front matter if present.
 * 
 * @param content - The markdown content to parse
 * @returns The heading text without the `# ` prefix, or undefined if not found
 * 
 * @example
 * ```typescript
 * const content = `# My Plan Title
 * 
 * ## Overview
 * Content here`;
 * const heading = extractFirstHeading(content);
 * console.log(heading); // "My Plan Title"
 * ```
 */
export function extractFirstHeading(content: string): string | undefined {
  // Remove front matter if present
  const withoutFrontMatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  
  // Find the first line that starts with `# ` (single hash)
  const lines = withoutFrontMatter.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ') && trimmed.length > 2) {
      // Extract text after `# ` and trim whitespace
      return trimmed.slice(2).trim();
    }
  }
  
  return undefined;
}

