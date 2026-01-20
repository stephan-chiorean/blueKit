/**
 * TypeScript type definitions for the Walkthroughs system.
 * These types match the Rust DTOs in src-tauri/src/db/walkthrough_operations.rs
 */

export interface Walkthrough {
    id: string;
    name: string;
    projectId: string;
    filePath: string;
    description?: string;
    status: 'not_started' | 'in_progress' | 'completed';
    createdAt: number;
    updatedAt: number;
    progress: number; // 0-100 based on takeaway completion
}

export interface Takeaway {
    id: string;
    walkthroughId: string;
    title: string;
    description?: string;
    sortOrder: number;
    completed: boolean;
    completedAt?: number;
    createdAt: number;
}

export interface WalkthroughNote {
    id: string;
    walkthroughId: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}

export interface WalkthroughDetails extends Walkthrough {
    takeaways: Takeaway[];
    notes: WalkthroughNote[];
}
