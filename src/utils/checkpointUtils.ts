/**
 * Utility functions for checkpoint operations.
 */

/**
 * Get the color for a checkpoint type.
 * 
 * @param type - Checkpoint type
 * @returns Chakra UI color token
 */
export function getCheckpointTypeColor(type: string): string {
  switch (type) {
    case 'milestone':
      return 'primary.500'; // Blue
    case 'experiment':
      return 'purple.500'; // Purple
    case 'template':
      return 'green.500'; // Green
    case 'backup':
      return 'orange.500'; // Orange
    default:
      return 'gray.500';
  }
}

/**
 * Get the display label for a checkpoint type.
 * 
 * @param type - Checkpoint type
 * @returns Human-readable label
 */
export function getCheckpointTypeLabel(type: string): string {
  switch (type) {
    case 'milestone':
      return 'Milestone';
    case 'experiment':
      return 'Experiment';
    case 'template':
      return 'Template';
    case 'backup':
      return 'Backup';
    default:
      return type;
  }
}

/**
 * Parse checkpoint tags from JSON string to array.
 * 
 * @param tags - JSON string or undefined
 * @returns Array of tag strings
 */
export function parseCheckpointTags(tags?: string): string[] {
  if (!tags) {
    return [];
  }

  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Format checkpoint tags array to JSON string.
 * 
 * @param tags - Array of tag strings
 * @returns JSON string or undefined if empty
 */
export function formatCheckpointTags(tags: string[]): string | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  return JSON.stringify(tags);
}
