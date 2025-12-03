/**
 * Generic resource types for the resource viewing system.
 * This replaces the kit-specific types and allows handling of multiple resource types
 * (kits, walkthroughs, agents, blueprints, diagrams, scrapbook) in a unified way.
 */

import { KitFile } from '../ipc';

/**
 * Resource type discriminator
 */
export type ResourceType = 'kit' | 'walkthrough' | 'agent' | 'blueprint' | 'task' | 'diagram' | 'scrapbook';

/**
 * Generic resource file interface
 * This is compatible with KitFile but adds a resourceType field
 */
export interface ResourceFile extends KitFile {
  /** Type of resource - used for routing and display */
  resourceType?: ResourceType;
}

/**
 * Type guard to check if a resource is a specific type
 */
export function isResourceType(resource: ResourceFile, type: ResourceType): boolean {
  // If resourceType is explicitly set, use it
  if (resource.resourceType) {
    return resource.resourceType === type;
  }

  // Fall back to frontMatter type for backwards compatibility
  if (resource.frontMatter?.type) {
    return resource.frontMatter.type === type;
  }

  // Default to 'kit' if no type specified
  return type === 'kit';
}

/**
 * Get the resource type from a resource file
 */
export function getResourceType(resource: ResourceFile): ResourceType {
  // Explicit resourceType takes precedence
  if (resource.resourceType) {
    return resource.resourceType;
  }

  // Check frontMatter type
  if (resource.frontMatter?.type) {
    return resource.frontMatter.type as ResourceType;
  }

  // Default to kit
  return 'kit';
}

/**
 * Get display name for a resource
 */
export function getResourceDisplayName(resource: ResourceFile): string {
  return resource.frontMatter?.alias || resource.name;
}

/**
 * Get display label for resource type (used in UI)
 */
export function getResourceTypeLabel(type: ResourceType): string {
  const labels: Record<ResourceType, string> = {
    kit: 'Kit',
    walkthrough: 'Walkthrough',
    agent: 'Agent',
    blueprint: 'Blueprint',
    task: 'Task',
    diagram: 'Diagram',
    scrapbook: 'Scrapbook',
  };
  return labels[type];
}
