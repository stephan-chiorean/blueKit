import { useState, useRef, useCallback } from 'react';

export interface SmartHoverOptions<T> {
    initialDelay?: number;
    smartDelay?: number;
    gracePeriod?: number;
    shouldEnter?: (item: T) => boolean;
    placement?: 'top' | 'right'; // Added to determine distinct exit direction
}

export function useSmartHover<T>(options: SmartHoverOptions<T> = {}) {
    const {
        initialDelay = 600,
        smartDelay = 50,
        gracePeriod = 500,
        shouldEnter = () => true,
        placement = 'right',
    } = options;

    const [hoveredItem, setHoveredItem] = useState<T | null>(null);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isPopoverHoveredRef = useRef(false);

    // We use a ref to track the currently hovered item for instant access in event handlers
    // This avoids dependency cycles with useCallback
    const activeItemRef = useRef<T | null>(null);

    const handleMouseEnter = useCallback((item: T, event: React.MouseEvent) => {
        if (!shouldEnter(item)) return;

        // Clear any pending dismissal
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }

        // Clear any pending hover trigger
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        const targetRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

        // Determine delay: fast if already showing something, slow if starting from scratch
        const delay = activeItemRef.current ? smartDelay : initialDelay;

        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem(item);
            setAnchorRect(targetRect);
            activeItemRef.current = item;
        }, delay);
    }, [initialDelay, smartDelay, shouldEnter]);

    const handleMouseLeave = useCallback((event: React.MouseEvent) => {
        // Clear pending open
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        // Determine if we should apply grace period based on exit direction
        let timeToClose = 0; // Default to immediate close

        if (anchorRect) {
            const { clientX, clientY } = event;
            const { top, bottom, left, right } = anchorRect;

            // Buffer to account for borderline cases
            const BUFFER = 2;

            if (placement === 'top') {
                // If exiting upwards (clientY < top), allow grace period
                if (clientY < top + BUFFER) {
                    timeToClose = gracePeriod;
                }
            } else if (placement === 'right') {
                // If exiting rightwards (clientX > right), allow grace period
                if (clientX > right - BUFFER) {
                    timeToClose = gracePeriod;
                }
            }
        } else {
            // Fallback if no anchor rect (shouldn't happen if open)
            timeToClose = 0;
        }


        // Start grace period for close
        dismissTimeoutRef.current = setTimeout(() => {
            if (!isPopoverHoveredRef.current) {
                setHoveredItem(null);
                setAnchorRect(null);
                activeItemRef.current = null;
            }
        }, timeToClose);
    }, [gracePeriod, anchorRect, placement]);

    const handlePopoverMouseEnter = useCallback(() => {
        isPopoverHoveredRef.current = true;
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }
    }, []);

    const handlePopoverMouseLeave = useCallback(() => {
        isPopoverHoveredRef.current = false;
        dismissTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
            setAnchorRect(null);
            activeItemRef.current = null;
        }, gracePeriod);
    }, [gracePeriod]);

    return {
        hoveredItem,
        anchorRect,
        handleMouseEnter,
        handleMouseLeave,
        handlePopoverMouseEnter,
        handlePopoverMouseLeave
    };
}
