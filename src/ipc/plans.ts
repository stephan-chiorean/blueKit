/**
 * IPC wrapper functions for Plan operations.
 * These functions provide type-safe communication between the frontend and Rust backend.
 */

import { invokeWithTimeout } from '@/shared/utils/ipcTimeout';
import type {
  Plan,
  PlanDetails,
  PlanPhase,
  PlanMilestone,
  PlanDocument,
} from '@/types/plan';

// ============================================================================
// PLAN CRUD OPERATIONS
// ============================================================================

/**
 * Create a new plan with folder structure
 */
export async function invokeCreatePlan(
  projectId: string,
  projectPath: string,
  name: string,
  description?: string
): Promise<Plan> {
  return await invokeWithTimeout<Plan>('create_plan', {
    projectId,
    projectPath,
    name,
    description,
  });
}

/**
 * Get all plans for a project
 */
export async function invokeGetProjectPlans(projectId: string): Promise<Plan[]> {
  return await invokeWithTimeout<Plan[]>('get_project_plans', { projectId });
}

/**
 * Get plan details with phases, milestones, and documents
 */
export async function invokeGetPlanDetails(planId: string): Promise<PlanDetails> {
  return await invokeWithTimeout<PlanDetails>('get_plan_details', { planId });
}

/**
 * Update a plan
 */
export async function invokeUpdatePlan(
  planId: string,
  name?: string,
  description?: string | null,
  status?: 'active' | 'completed' | 'archived'
): Promise<Plan> {
  return await invokeWithTimeout<Plan>('update_plan', {
    planId,
    name,
    description,
    status,
  });
}

/**
 * Delete a plan (removes folder and database records)
 */
export async function invokeDeletePlan(planId: string): Promise<void> {
  return await invokeWithTimeout<void>('delete_plan', { planId });
}

/**
 * Link a brainstorm file to a plan
 */
export async function invokeLinkBrainstormToPlan(
  planId: string,
  brainstormPath: string
): Promise<void> {
  return await invokeWithTimeout<void>('link_brainstorm_to_plan', {
    planId,
    brainstormPath,
  });
}

/**
 * Unlink the brainstorm from a plan
 */
export async function invokeUnlinkBrainstormFromPlan(planId: string): Promise<void> {
  return await invokeWithTimeout<void>('unlink_brainstorm_from_plan', { planId });
}

/**
 * Link multiple plans to a plan
 */
export async function invokeLinkMultiplePlansToPlan(
  planId: string,
  planPaths: string[],
  source: 'claude' | 'cursor'
): Promise<void> {
  return await invokeWithTimeout<void>('link_multiple_plans_to_plan', {
    planId,
    planPaths,
    source,
  });
}

/**
 * Unlink a specific plan from a plan
 */
export async function invokeUnlinkPlanFromPlan(
  planId: string,
  linkedPlanPath: string
): Promise<void> {
  return await invokeWithTimeout<void>('unlink_plan_from_plan', {
    planId,
    linkedPlanPath,
  });
}

// ============================================================================
// PHASE CRUD OPERATIONS
// ============================================================================

/**
 * Create a plan phase
 */
export async function invokeCreatePlanPhase(
  planId: string,
  name: string,
  description?: string,
  orderIndex?: number
): Promise<PlanPhase> {
  return await invokeWithTimeout<PlanPhase>('create_plan_phase', {
    planId,
    name,
    description,
    orderIndex: orderIndex ?? 0,
  });
}

/**
 * Update a plan phase
 */
export async function invokeUpdatePlanPhase(
  phaseId: string,
  name?: string,
  description?: string | null,
  status?: 'pending' | 'in_progress' | 'completed',
  orderIndex?: number
): Promise<PlanPhase> {
  return await invokeWithTimeout<PlanPhase>('update_plan_phase', {
    phaseId,
    name,
    description,
    status,
    orderIndex,
  });
}

/**
 * Delete a plan phase
 */
export async function invokeDeletePlanPhase(phaseId: string): Promise<void> {
  return await invokeWithTimeout<void>('delete_plan_phase', { phaseId });
}

/**
 * Reorder plan phases
 */
export async function invokeReorderPlanPhases(
  planId: string,
  phaseIdsInOrder: string[]
): Promise<void> {
  return await invokeWithTimeout<void>('reorder_plan_phases', {
    planId,
    phaseIdsInOrder,
  });
}

// ============================================================================
// MILESTONE CRUD OPERATIONS
// ============================================================================

/**
 * Create a plan milestone
 */
export async function invokeCreatePlanMilestone(
  phaseId: string,
  name: string,
  description?: string,
  orderIndex?: number
): Promise<PlanMilestone> {
  return await invokeWithTimeout<PlanMilestone>('create_plan_milestone', {
    phaseId,
    name,
    description,
    orderIndex: orderIndex ?? 0,
  });
}

/**
 * Update a plan milestone
 */
export async function invokeUpdatePlanMilestone(
  milestoneId: string,
  name?: string,
  description?: string | null,
  completed?: boolean
): Promise<PlanMilestone> {
  return await invokeWithTimeout<PlanMilestone>('update_plan_milestone', {
    milestoneId,
    name,
    description,
    completed,
  });
}

/**
 * Delete a plan milestone
 */
export async function invokeDeletePlanMilestone(milestoneId: string): Promise<void> {
  return await invokeWithTimeout<void>('delete_plan_milestone', { milestoneId });
}

/**
 * Toggle milestone completion
 */
export async function invokeToggleMilestoneCompletion(
  milestoneId: string
): Promise<PlanMilestone> {
  return await invokeWithTimeout<PlanMilestone>('toggle_milestone_completion', {
    milestoneId,
  });
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

/**
 * Get plan documents (scans folder and reconciles with DB)
 */
export async function invokeGetPlanDocuments(planId: string): Promise<PlanDocument[]> {
  return await invokeWithTimeout<PlanDocument[]>('get_plan_documents', { planId });
}

/**
 * Reorder plan documents
 */
export async function invokeReorderPlanDocuments(
  planId: string,
  documentIds: string[]
): Promise<void> {
  return await invokeWithTimeout<void>('reorder_plan_documents', {
    planId,
    documentIds,
  });
}

/**
 * Watch plan folder for file changes
 */
export async function invokeWatchPlanFolder(
  planId: string,
  folderPath: string
): Promise<void> {
  return await invokeWithTimeout<void>('watch_plan_folder', {
    planId,
    folderPath,
  });
}
