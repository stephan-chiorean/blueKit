/**
 * Hook for debounced auto-saving of file content.
 *
 * Provides automatic saving with configurable delay and tracks save status.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { invokeWriteFile } from '@/ipc/files';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface UseAutoSaveOptions {
  /** Debounce delay in milliseconds (default: 1000) */
  delay?: number;
  /** Callback when save succeeds */
  onSaveSuccess?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: Error) => void;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

export interface UseAutoSaveResult {
  /** Trigger a save with the given content */
  save: (content: string) => void;
  /** Force immediate save (bypasses debounce) */
  saveNow: (content: string) => Promise<void>;
  /** Current save status */
  status: SaveStatus;
  /** Last error if status is 'error' */
  error: Error | null;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Cancel pending save */
  cancel: () => void;
  /** Timestamp of last successful save (ms since epoch) */
  lastSaveTime: number;
}

/**
 * Hook for debounced auto-saving.
 *
 * @param filePath - The path to save to
 * @param options - Configuration options
 * @returns Save functions and status
 *
 * @example
 * ```typescript
 * const { save, status, isDirty } = useAutoSave('/path/to/file.md', {
 *   delay: 1500,
 *   onSaveSuccess: () => console.log('Saved!'),
 * });
 *
 * // In your editor's onChange:
 * onChange={(content) => save(content)}
 * ```
 */
export function useAutoSave(
  filePath: string,
  options: UseAutoSaveOptions = {}
): UseAutoSaveResult {
  const {
    delay = 1000,
    onSaveSuccess,
    onSaveError,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<Error | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(0);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const pendingContentRef = useRef<string | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Reset state when file path changes
  useEffect(() => {
    setStatus('saved');
    setError(null);
    setIsDirty(false);
    setLastSaveTime(0);
    lastSavedContentRef.current = '';
    pendingContentRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [filePath]);

  const performSave = useCallback(async (content: string): Promise<void> => {
    if (!enabled) return;

    // Skip if content hasn't changed from last save
    if (content === lastSavedContentRef.current) {
      setStatus('saved');
      setIsDirty(false);
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      await invokeWriteFile(filePath, content);
      lastSavedContentRef.current = content;
      setStatus('saved');
      setIsDirty(false);
      setLastSaveTime(Date.now());
      onSaveSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setStatus('error');
      setError(error);
      onSaveError?.(error);
      throw error;
    }
  }, [filePath, enabled, onSaveSuccess, onSaveError]);

  const save = useCallback((content: string) => {
    if (!enabled) return;

    // Mark as dirty immediately
    setIsDirty(true);
    setStatus('unsaved');
    pendingContentRef.current = content;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      if (pendingContentRef.current !== null) {
        performSave(pendingContentRef.current).catch(() => {
          // Error handled in performSave
        });
      }
    }, delay);
  }, [delay, enabled, performSave]);

  const saveNow = useCallback(async (content: string): Promise<void> => {
    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingContentRef.current = null;

    // Perform immediate save
    await performSave(content);
  }, [performSave]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingContentRef.current = null;
    // Don't reset dirty status - user can decide what to do
  }, []);

  return {
    save,
    saveNow,
    status,
    error,
    isDirty,
    cancel,
    lastSaveTime,
  };
}
