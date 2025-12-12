import { TaskPriority, TaskType } from '../types/task';
import { LuPin, LuArrowUp, LuClock, LuSparkles, LuMinus, LuBug, LuSearch, LuStar, LuBrush, LuZap, LuSquareCheck } from 'react-icons/lu';

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
 * Uses semantic tokens that adapt to color mode
 * Background uses rgba with low opacity for subtle effect in dark mode
 */
export function getPriorityHoverColors(priority: TaskPriority): { borderColor: string; bg: string } {
  switch (priority) {
    case 'pinned':
      return { borderColor: 'blue.400', bg: 'blue.subtle' };
    case 'high':
      return { borderColor: 'red.400', bg: 'red.subtle' };
    case 'long term':
      return { borderColor: 'purple.400', bg: 'purple.subtle' };
    case 'nit':
      return { borderColor: 'yellow.400', bg: 'yellow.subtle' };
    case 'standard':
      return { borderColor: 'orange.400', bg: 'orange.subtle' };
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

/**
 * Gets the type icon component and color
 */
export function getTypeIcon(type: TaskType): { icon: React.ComponentType; color: string } | null {
  switch (type) {
    case 'bug':
      return { icon: LuBug, color: 'red.500' };
    case 'investigation':
      return { icon: LuSearch, color: 'purple.500' };
    case 'feature':
      return { icon: LuStar, color: 'blue.500' };
    case 'cleanup':
      return { icon: LuBrush, color: 'gray.500' };
    case 'optimization':
      return { icon: LuZap, color: 'yellow.500' };
    case 'chore':
      return { icon: LuSquareCheck, color: 'green.500' };
    default:
      return null;
  }
}

/**
 * Maps type values to display labels
 */
export function getTypeLabel(type?: TaskType): string | null {
  if (!type) return null;
  switch (type) {
    case 'bug':
      return 'Bug';
    case 'investigation':
      return 'Investigation';
    case 'feature':
      return 'Feature';
    case 'cleanup':
      return 'Cleanup';
    case 'optimization':
      return 'Optimization';
    case 'chore':
      return 'Chore';
    default:
      return type;
  }
}

/**
 * Gets the color palette name for Chakra UI components based on type
 */
export function getTypeColorPalette(type: TaskType): string | undefined {
  switch (type) {
    case 'bug':
      return 'red';
    case 'investigation':
      return 'purple';
    case 'feature':
      return 'blue';
    case 'cleanup':
      return 'gray';
    case 'optimization':
      return 'yellow';
    case 'chore':
      return 'green';
    default:
      return undefined;
  }
}

