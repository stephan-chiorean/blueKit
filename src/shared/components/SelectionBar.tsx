import {
  Box,
  Button,
  HStack,
  Icon,
  Portal,
  Separator,
  VStack,
} from '@chakra-ui/react';
import { useState, useEffect, useRef, useCallback } from 'react';

export interface SelectionBarAction {
  id: string;
  type: 'button' | 'popover' | 'separator';

  // Button config
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: string;
  colorPalette?: string;
  disabled?: boolean;
  rounded?: string;
  px?: number;

  // Popover config - render prop for custom popover content
  popover?: {
    trigger: React.ReactNode;
    onOpenChange?: (isOpen: boolean) => void;
  };
}

interface SelectionBarProps {
  isOpen: boolean;
  selectionSummary: React.ReactNode;
  actions: SelectionBarAction[];

  // Position config
  position?: 'fixed' | 'absolute';
  bottomOffset?: string;

  // Loading state
  isLoading?: boolean;
}

/**
 * Unified selection bar component with glassmorphic styling and spotlight popover support.
 * Provides a consistent UI pattern for bulk actions across different contexts.
 */
export function SelectionBar({
  isOpen,
  selectionSummary,
  actions,
  position = 'fixed',
  bottomOffset = '20px',
  isLoading = false,
}: SelectionBarProps) {
  // Track which popovers are open using refs (prevents flicker)
  const popoverOpenRefs = useRef<Map<string, boolean>>(new Map());
  const [shouldShowBlur, setShouldShowBlur] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update blur state based on any popover being open
  const updateBlurState = useCallback(() => {
    const anyPopoverOpen = Array.from(popoverOpenRefs.current.values()).some(Boolean);

    if (anyPopoverOpen) {
      // Clear any pending timeout and show blur immediately
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      setShouldShowBlur(true);
    } else {
      // Only hide blur after a delay to prevent flicker during rapid transitions
      blurTimeoutRef.current = setTimeout(() => {
        // Double-check refs before hiding (in case state changed during delay)
        const stillAnyOpen = Array.from(popoverOpenRefs.current.values()).some(Boolean);
        if (!stillAnyOpen) {
          setShouldShowBlur(false);
        }
      }, 100);
    }
  }, []);

  // Handle popover open/close for a specific action
  const handlePopoverChange = useCallback(
    (actionId: string, isOpen: boolean) => {
      popoverOpenRefs.current.set(actionId, isOpen);
      updateBlurState();
    },
    [updateBlurState]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Style config based on position
  const positionStyles = position === 'fixed' ? {
    position: 'fixed' as const,
    bottom: bottomOffset,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1400,
  } : {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  };

  // Render individual action
  const renderAction = (action: SelectionBarAction) => {
    if (action.type === 'separator') {
      return <Separator key={action.id} orientation="vertical" height="20px" />;
    }

    if (action.type === 'button') {
      return (
        <Button
          key={action.id}
          variant={action.variant || 'subtle'}
          colorPalette={action.colorPalette}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled || isLoading}
          rounded={action.rounded || 'full'}
          px={action.px ?? 4}
        >
          <HStack gap={2}>
            {action.icon && <Icon>{action.icon}</Icon>}
            {action.label}
          </HStack>
        </Button>
      );
    }

    if (action.type === 'popover' && action.popover) {
      // Wrap the trigger to inject onOpenChange handler
      const { trigger, onOpenChange } = action.popover;

      return (
        <Box key={action.id}>
          {trigger}
        </Box>
      );
    }

    return null;
  };

  return (
    <>
      {/* Backdrop blur when any popover is open */}
      {shouldShowBlur && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={position === 'fixed' ? 1300 : 5}
            css={{
              backdropFilter: 'blur(8px) saturate(120%)',
              WebkitBackdropFilter: 'blur(8px) saturate(120%)',
              background: 'rgba(0, 0, 0, 0.2)',
              _dark: {
                background: 'rgba(0, 0, 0, 0.4)',
              },
              pointerEvents: 'auto',
            }}
            onClick={() => {
              // Close all popovers on backdrop click
              popoverOpenRefs.current.forEach((_, actionId) => {
                const action = actions.find(a => a.id === actionId);
                if (action?.popover?.onOpenChange) {
                  action.popover.onOpenChange(false);
                }
              });
            }}
          />
        </Portal>
      )}

      {/* Selection bar */}
      {isOpen && (
        <Box
          {...positionStyles}
          width={position === 'absolute' ? '100%' : 'auto'}
          minWidth={position === 'fixed' ? '400px' : 'auto'}
          maxWidth="90vw"
          pointerEvents="auto"
          py={4}
          px={6}
          borderRadius={position === 'fixed' ? '12px' : '0 0 16px 16px'}
          css={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTopWidth: position === 'absolute' ? '1px' : '0',
            borderWidth: position === 'fixed' ? '1px' : '0',
            borderColor: 'rgba(0, 0, 0, 0.08)',
            boxShadow: position === 'fixed'
              ? '0 10px 40px -10px rgba(0,0,0,0.1)'
              : 'none',
            _dark: {
              background: 'rgba(30, 30, 30, 0.85)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              boxShadow: position === 'fixed'
                ? '0 10px 40px -10px rgba(0,0,0,0.5)'
                : 'none',
            },
          }}
        >
          <VStack gap={2} width="100%">
            {/* Selection summary */}
            {selectionSummary}

            {/* Action buttons */}
            <HStack gap={2} justify="center" wrap="wrap">
              {actions.map(renderAction)}
            </HStack>
          </VStack>
        </Box>
      )}
    </>
  );
}
