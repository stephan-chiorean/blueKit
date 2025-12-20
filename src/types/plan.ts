/**
 * TypeScript type definitions for the Plans system.
 * These types match the Rust DTOs in src-tauri/src/db/plan_operations.rs
 */

export interface Plan {
  id: string;
  name: string;
  projectId: string;
  folderPath: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  brainstormLink?: string;
  createdAt: number;
  updatedAt: number;
  progress: number; // 0-100 based on milestone completion
}

export interface PlanPhase {
  id: string;
  planId: string;
  name: string;
  description?: string;
  orderIndex: number;
  status: 'pending' | 'in_progress' | 'completed';
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlanMilestone {
  id: string;
  phaseId: string;
  name: string;
  description?: string;
  orderIndex: number;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlanDocument {
  id: string;
  planId: string;
  phaseId?: string;
  filePath: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlanLink {
  id: string;
  planId: string;
  linkedPlanPath: string;
  source: 'claude' | 'cursor';
  createdAt: number;
  updatedAt: number;
}

export interface PlanPhaseWithMilestones extends PlanPhase {
  milestones: PlanMilestone[];
}

export interface PlanDetails extends Plan {
  phases: PlanPhaseWithMilestones[];
  documents: PlanDocument[];
  linkedPlans: PlanLink[];
  progress: number; // 0-100 based on milestone completion
}
