import path from 'path';
import { ArtifactFile } from '../ipc';
import { ResourceType } from '../types/resource';

/**
 * Represents a link found in markdown content
 */
export interface MarkdownLink {
  /** Display text of the link */
  text: string;
  /** Relative or absolute path to the target file */
  path: string;
}

/**
 * Represents a backlink (another resource linking to the current one)
 */
export interface Backlink {
  /** The resource that contains the link */
  source: ArtifactFile;
  /** The text used for the link */
  linkText: string;
  /** The resource type for display */
  resourceType: ResourceType;
}

/**
 * Extracts all markdown links from content
 *
 * Matches: [text](./path.md), [text](../path.mmd), etc.
 *
 * @param markdown - Markdown content to parse
 * @returns Array of links found
 */
export function extractOutboundLinks(markdown: string): MarkdownLink[] {
  // Remove YAML front matter
  const content = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  // Regex to match markdown links ending in .md, .mmd, or .mermaid
  const linkRegex = /\[([^\]]+)\]\(([^)]+\.(?:md|mmd|mermaid))\)/g;
  const links: MarkdownLink[] = [];

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      path: match[2],
    });
  }

  return links;
}

/**
 * Finds all resources that link to the current resource (backlinks)
 *
 * @param currentPath - Absolute path of the current resource
 * @param allArtifacts - All artifacts in the project
 * @returns Array of backlinks
 */
export function findBacklinks(
  currentPath: string,
  allArtifacts: ArtifactFile[]
): Backlink[] {
  const backlinks: Backlink[] = [];

  for (const artifact of allArtifacts) {
    // Skip if artifact has no content
    if (!artifact.content) continue;

    // Extract all outbound links from this artifact
    const outboundLinks = extractOutboundLinks(artifact.content);

    // Check if any link resolves to currentPath
    for (const link of outboundLinks) {
      // Resolve relative path to absolute
      const artifactDir = path.dirname(artifact.path);
      const resolvedPath = path.resolve(artifactDir, link.path);

      // If this link points to current resource, it's a backlink
      if (resolvedPath === currentPath) {
        // Determine resource type
        const resourceType = determineResourceType(artifact);

        backlinks.push({
          source: artifact,
          linkText: link.text,
          resourceType,
        });
      }
    }
  }

  return backlinks;
}

/**
 * Determines the resource type of an artifact
 */
function determineResourceType(artifact: ArtifactFile): ResourceType {
  // Check file extension first
  if (artifact.path.endsWith('.mmd') || artifact.path.endsWith('.mermaid')) {
    return 'diagram';
  }

  // Check front matter type
  if (artifact.frontMatter?.type) {
    return artifact.frontMatter.type as ResourceType;
  }

  // Default to kit
  return 'kit';
}

/**
 * Resolves outbound links to absolute paths
 *
 * @param currentPath - Path of the resource containing the links
 * @param links - Outbound links to resolve
 * @returns Links with resolved absolute paths
 */
export function resolveOutboundLinks(
  currentPath: string,
  links: MarkdownLink[]
): Array<MarkdownLink & { absolutePath: string }> {
  const currentDir = path.dirname(currentPath);

  return links.map(link => ({
    ...link,
    absolutePath: path.resolve(currentDir, link.path),
  }));
}

