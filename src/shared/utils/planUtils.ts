import { PlanPhaseWithMilestones, PlanMilestone } from '@/types/plan';
import { LuTarget, LuTrophy, LuArchive, LuMap } from 'react-icons/lu';
import { IconType } from 'react-icons';

/**
 * Maps status values to color palette names for Chakra UI
 */
export function getStatusColorPalette(status: 'active' | 'completed' | 'archived'): string {
  switch (status) {
    case 'active':
      return 'blue';
    case 'completed':
      return 'green';
    case 'archived':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Maps status values to display labels
 */
export function getStatusLabel(status: 'active' | 'completed' | 'archived'): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'Unknown';
  }
}

/**
 * Gets the status icon component (matches PlanResourceCard icons)
 */
export function getPlanStatusIcon(status: 'active' | 'completed' | 'archived'): IconType {
  switch (status) {
    case 'active':
      return LuTarget;
    case 'completed':
      return LuTrophy;
    case 'archived':
      return LuArchive;
    default:
      return LuMap;
  }
}

/**
 * Gets the status icon color
 */
export function getPlanStatusColor(status: 'active' | 'completed' | 'archived'): string {
  switch (status) {
    case 'active':
      return 'blue.500';
    case 'completed':
      return 'green.500';
    case 'archived':
      return 'gray.500';
    default:
      return 'gray.500';
  }
}

/**
 * Gets the progress bar color based on status and progress percentage
 */
export function getProgressColor(status: 'active' | 'completed' | 'archived', progress: number): string {
  if (status === 'completed') return 'green.500';
  if (status === 'archived') return 'gray.300';

  // Active - color code by progress
  if (progress >= 75) return 'blue.500';
  if (progress >= 50) return 'blue.400';
  if (progress >= 25) return 'blue.300';
  return 'blue.200';
}

/**
 * Calculates overall progress percentage from phases and milestones
 */
export function calculateProgress(phases: PlanPhaseWithMilestones[]): number {
  if (!phases || phases.length === 0) return 0;

  const allMilestones = phases.flatMap(phase => phase.milestones || []);
  if (allMilestones.length === 0) return 0;

  const completedMilestones = allMilestones.filter(m => m.completed).length;
  return Math.round((completedMilestones / allMilestones.length) * 100);
}

/**
 * Formats a timestamp to a readable date string
 */
export function formatDate(timestamp: number): string {
  try {
    const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  } catch (e) {
    return '-';
  }
}

/**
 * Formats a timestamp to a relative date string (e.g., "2 days ago")
 */
export function formatRelativeDate(timestamp: number): string {
  try {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch (e) {
    return '-';
  }
}

/**
 * Gets all active (uncompleted) milestones from phases
 */
export function getActiveMilestones(phases: PlanPhaseWithMilestones[]): PlanMilestone[] {
  if (!phases || phases.length === 0) return [];
  
  const allMilestones = phases.flatMap(phase => phase.milestones || []);
  return allMilestones.filter(m => !m.completed);
}

/**
 * Gets the next upcoming milestone from phases
 */
export function getNextMilestone(phases: PlanPhaseWithMilestones[]): PlanMilestone | undefined {
  if (!phases || phases.length === 0) return undefined;

  const allMilestones = phases.flatMap(phase => phase.milestones || []);
  
  // Find first uncompleted milestone
  return allMilestones.find(m => !m.completed);
}

/**
 * Gets the last completed milestone from phases
 */
export function getLastCompletedMilestone(phases: PlanPhaseWithMilestones[]): PlanMilestone | undefined {
  if (!phases || phases.length === 0) return undefined;

  const allMilestones = phases.flatMap(phase => phase.milestones || []);
  const completedMilestones = allMilestones.filter(m => m.completed);
  
  if (completedMilestones.length === 0) return undefined;

  // Sort by completion date (most recent first)
  completedMilestones.sort((a, b) => {
    if (!a.completedAt) return 1;
    if (!b.completedAt) return -1;
    return b.completedAt - a.completedAt;
  });

  return completedMilestones[0];
}

/**
 * Gets milestone progress statistics
 */
export function getMilestoneProgress(phases: PlanPhaseWithMilestones[]): { completed: number; total: number } {
  if (!phases || phases.length === 0) return { completed: 0, total: 0 };

  const allMilestones = phases.flatMap(phase => phase.milestones || []);
  const completedMilestones = allMilestones.filter(m => m.completed).length;

  return {
    completed: completedMilestones,
    total: allMilestones.length
  };
}

/**
 * Formats a short date string (e.g., "Jan 20")
 */
export function formatShortDate(timestamp: number): string {
  try {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return '-';
  }
}
