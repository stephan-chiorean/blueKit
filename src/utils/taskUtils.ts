import { TaskPriority } from '../types/task';
import { LuPin, LuArrowUp, LuClock, LuSparkles, LuMinus } from 'react-icons/lu';

/**
 * Maps priority values to display labels
 */
export function getPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'high':
      return 'high priority';
    case 'pinned':
      return 'Pinned';
    case 'standard':
      return 'Standard';
    case 'long term':
      return 'Long Term';
    case 'nit':
      return 'Nit';
    default:
      return priority;
  }
}

/**
 * Returns whether a priority badge should be displayed
 */
export function shouldShowPriorityBadge(priority: TaskPriority): boolean {
  return priority !== 'standard';
}

/**
 * Gets the priority icon component and color
 */
export function getPriorityIcon(priority: TaskPriority): { icon: React.ComponentType; color: string } | null {
  switch (priority) {
    case 'pinned':
      return { icon: LuPin, color: 'blue.500' };
    case 'high':
      return { icon: LuArrowUp, color: 'red.500' };
    case 'long term':
      return { icon: LuClock, color: 'purple.500' };
    case 'nit':
      return { icon: LuSparkles, color: 'yellow.500' };
    case 'standard':
      return { icon: LuMinus, color: 'orange.500' };
    default:
      return null;
  }
}

/**
 * Gets hover colors (border and background) based on priority
 * Background matches tag subtle variant background (100 shade) for seamless blending
 */
export function getPriorityHoverColors(priority: TaskPriority): { borderColor: string; bg: string } {
  switch (priority) {
    case 'pinned':
      return { borderColor: 'blue.400', bg: 'blue.100' };
    case 'high':
      return { borderColor: 'red.400', bg: 'red.100' };
    case 'long term':
      return { borderColor: 'purple.400', bg: 'purple.100' };
    case 'nit':
      return { borderColor: 'yellow.400', bg: 'yellow.100' };
    case 'standard':
      return { borderColor: 'orange.400', bg: 'orange.100' };
    default:
      return { borderColor: 'border.subtle', bg: 'bg.subtle' };
  }
}

/**
 * Gets the color palette name for Chakra UI components based on priority
 */
export function getPriorityColorPalette(priority: TaskPriority): string | undefined {
  switch (priority) {
    case 'pinned':
      return 'blue';
    case 'high':
      return 'red';
    case 'long term':
      return 'purple';
    case 'nit':
      return 'yellow';
    case 'standard':
      return 'orange';
    default:
      return undefined;
  }
}

