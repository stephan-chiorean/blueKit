/**
 * IPC wrapper functions for Walkthrough operations.
 * These functions provide type-safe communication between the frontend and Rust backend.
 */

import { invokeWithTimeout } from '../utils/ipcTimeout';
import type {
    Walkthrough,
    WalkthroughDetails,
    Takeaway,
    WalkthroughNote,
} from '../types/walkthrough';

// ============================================================================
// WALKTHROUGH CRUD OPERATIONS
// ============================================================================

/**
 * Create a new walkthrough with file and DB registration
 */
export async function invokeCreateWalkthrough(
    projectId: string,
    projectPath: string,
    name: string,
    description?: string,
    initialTakeaways: [string, string | null][] = []
): Promise<Walkthrough> {
    return await invokeWithTimeout<Walkthrough>('create_walkthrough', {
        projectId,
        projectPath,
        name,
        description,
        initialTakeaways,
    });
}

/**
 * Get all walkthroughs for a project (syncs with file system first if projectPath provided)
 */
export async function invokeGetProjectWalkthroughs(
    projectId: string,
    projectPath?: string
): Promise<Walkthrough[]> {
    return await invokeWithTimeout<Walkthrough[]>('get_project_walkthroughs', { projectId, projectPath });
}

/**
 * Get or create a walkthrough by file path (for file-based walkthroughs)
 */
export async function invokeGetOrCreateWalkthroughByPath(
    projectId: string,
    filePath: string
): Promise<Walkthrough> {
    return await invokeWithTimeout<Walkthrough>('get_or_create_walkthrough_by_path', { projectId, filePath });
}

/**
 * Get walkthrough details with takeaways and notes
 */
export async function invokeGetWalkthroughDetails(walkthroughId: string): Promise<WalkthroughDetails> {
    return await invokeWithTimeout<WalkthroughDetails>('get_walkthrough_details', { walkthroughId });
}

/**
 * Update a walkthrough
 */
export async function invokeUpdateWalkthrough(
    walkthroughId: string,
    name?: string,
    description?: string | null,
    status?: 'not_started' | 'in_progress' | 'completed'
): Promise<Walkthrough> {
    return await invokeWithTimeout<Walkthrough>('update_walkthrough', {
        walkthroughId,
        name,
        description,
        status,
    });
}

/**
 * Delete a walkthrough (removes file and database records)
 */
export async function invokeDeleteWalkthrough(walkthroughId: string): Promise<void> {
    return await invokeWithTimeout<void>('delete_walkthrough', { walkthroughId });
}

// ============================================================================
// TAKEAWAY OPERATIONS
// ============================================================================

/**
 * Add a takeaway to a walkthrough
 */
export async function invokeAddWalkthroughTakeaway(
    walkthroughId: string,
    title: string,
    description?: string
): Promise<Takeaway> {
    return await invokeWithTimeout<Takeaway>('add_walkthrough_takeaway', {
        walkthroughId,
        title,
        description,
    });
}

/**
 * Toggle takeaway completion
 */
export async function invokeToggleTakeawayComplete(takeawayId: string): Promise<Takeaway> {
    return await invokeWithTimeout<Takeaway>('toggle_takeaway_complete', { takeawayId });
}

/**
 * Update a takeaway
 */
export async function invokeUpdateWalkthroughTakeaway(
    takeawayId: string,
    title?: string,
    description?: string | null
): Promise<Takeaway> {
    return await invokeWithTimeout<Takeaway>('update_walkthrough_takeaway', {
        takeawayId,
        title,
        description,
    });
}

/**
 * Delete a takeaway
 */
export async function invokeDeleteWalkthroughTakeaway(takeawayId: string): Promise<void> {
    return await invokeWithTimeout<void>('delete_walkthrough_takeaway', { takeawayId });
}

/**
 * Reorder takeaways
 */
export async function invokeReorderWalkthroughTakeaways(
    walkthroughId: string,
    takeawayIdsInOrder: string[]
): Promise<void> {
    return await invokeWithTimeout<void>('reorder_walkthrough_takeaways', {
        walkthroughId,
        takeawayIdsInOrder,
    });
}

// ============================================================================
// NOTE OPERATIONS
// ============================================================================

/**
 * Get walkthrough notes
 */
export async function invokeGetWalkthroughNotes(walkthroughId: string): Promise<WalkthroughNote[]> {
    return await invokeWithTimeout<WalkthroughNote[]>('get_walkthrough_notes', { walkthroughId });
}

/**
 * Add a note to a walkthrough
 */
export async function invokeAddWalkthroughNote(
    walkthroughId: string,
    content: string
): Promise<WalkthroughNote> {
    return await invokeWithTimeout<WalkthroughNote>('add_walkthrough_note', {
        walkthroughId,
        content,
    });
}

/**
 * Update a walkthrough note
 */
export async function invokeUpdateWalkthroughNote(
    noteId: string,
    content: string
): Promise<WalkthroughNote> {
    return await invokeWithTimeout<WalkthroughNote>('update_walkthrough_note', {
        noteId,
        content,
    });
}

/**
 * Delete a walkthrough note
 */
export async function invokeDeleteWalkthroughNote(noteId: string): Promise<void> {
    return await invokeWithTimeout<void>('delete_walkthrough_note', { noteId });
}
