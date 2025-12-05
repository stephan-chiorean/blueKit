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

