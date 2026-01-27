/**
 * Utility functions for checkpoint operations.
 */

import { LuMilestone, LuFlaskConical, LuFileText, LuArchive } from 'react-icons/lu';

/**
 * Get the color for a checkpoint type.
 * 
 * @param type - Checkpoint type
 * @returns Chakra UI color token
 */
export function getCheckpointTypeColor(type: string): string {
  switch (type) {
    case 'milestone':
      return 'teal.500'; // Teal
    case 'experiment':
      return '#F54927'; // Scarlet
    case 'template':
      return 'purple.500'; // Purple
    case 'backup':
      return 'orange.500'; // Orange
    default:
      return 'gray.500';
  }
}

/**
 * Gets the checkpoint type icon component and color
 */
export function getCheckpointTypeIcon(type: string): { icon: React.ComponentType; color: string } | null {
  switch (type) {
    case 'milestone':
      return { icon: LuMilestone, color: 'teal.500' };
    case 'experiment':
      return { icon: LuFlaskConical, color: '#F54927' }; // Scarlet
    case 'template':
      return { icon: LuFileText, color: 'purple.500' };
    case 'backup':
      return { icon: LuArchive, color: 'orange.500' };
    default:
      return null;
  }
}

/**
 * Gets the color palette name for Chakra UI components based on checkpoint type
 */
export function getCheckpointTypeColorPalette(type: string): string | undefined {
  switch (type) {
    case 'milestone':
      return 'teal';
    case 'experiment':
      return 'red'; // Using red palette for scarlet
    case 'template':
      return 'purple';
    case 'backup':
      return 'orange';
    default:
      return undefined;
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
