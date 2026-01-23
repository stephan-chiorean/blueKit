import { HStack, Button, Icon, Text, Box } from '@chakra-ui/react';
import { LuLayoutGrid, LuTable } from 'react-icons/lu';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

/**
 * Configuration for a single view mode
 */
export interface ViewModeConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

/**
 * Props for ViewModeSwitcher component
 */
export interface ViewModeSwitcherProps {
  /** Current active view mode */
  value: string;
  /** Callback when view mode changes */
  onChange: (mode: string) => void;
  /** Array of view mode configurations */
  modes: ViewModeConfig[];
  /** Size of the buttons (default: sm) */
  size?: 'sm' | 'md' | 'lg';
  /** Accessibility label for the button group */
  'aria-label'?: string;
  /** Visual variant of the switcher (default: 'liquid') */
  variant?: 'standard' | 'liquid';
}

/**
 * Standard view modes that can be reused across components
 */
export const STANDARD_VIEW_MODES = {
  card: { id: 'card', label: 'Cards', icon: LuLayoutGrid },
  table: { id: 'table', label: 'Table', icon: LuTable },
} as const;

/**
 * ViewModeSwitcher - A reusable segmented control for switching between view modes
 * Supports 'standard' (segmented control) and 'liquid' (animated pill) variants.
 *
 * @example
 * ```tsx
 * <ViewModeSwitcher
 *   variant="liquid"
 *   value={viewMode}
 *   onChange={(mode) => setViewMode(mode as ViewMode)}
 *   modes={[
 *     STANDARD_VIEW_MODES.card,
 *     STANDARD_VIEW_MODES.table,
 *   ]}
 * />
 * ```
 */
export function ViewModeSwitcher({
  value,
  onChange,
  modes,
  size = 'sm',
  'aria-label': ariaLabel = 'View mode switcher',
  variant = 'liquid',
}: ViewModeSwitcherProps) {

  if (variant === 'liquid') {
    return (
      <HStack
        gap={0}
        p={1}
        borderRadius="full"
        css={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          _dark: {
            background: 'rgba(0, 0, 0, 0.2)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
        role="group"
        aria-label={ariaLabel}
      >
        {modes.map((mode) => {
          const isActive = value === mode.id;

          return (
            <Box
              key={mode.id}
              as="button"
              onClick={() => onChange(mode.id)}
              position="relative"
              px={4}
              py={1.5}
              borderRadius="full"
              cursor="pointer"
              outline="none"
              color={isActive ? 'text.success' : 'text.muted'}
              _hover={{
                color: isActive ? 'text.success' : 'text.primary',
              }}
              transition="color 0.2s"
              aria-current={isActive ? 'true' : undefined}
            >
              {isActive && (
                <MotionBox
                  layoutId="liquid-switcher-active"
                  position="absolute"
                  inset={0}
                  bg="bg.surface"
                  borderRadius="full"
                  boxShadow="sm"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  } as any}
                  css={{
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(8px)',
                    _dark: {
                      background: 'rgba(255, 255, 255, 0.15)',
                    }
                  }}
                />
              )}
              <HStack gap={2} position="relative" zIndex={1}>
                <Icon boxSize={4}>
                  <mode.icon />
                </Icon>
                <Text fontSize="sm" fontWeight="medium">
                  {mode.label}
                </Text>
              </HStack>
            </Box>
          );
        })}
      </HStack>
    );
  }

  // Standard implementation
  return (
    <HStack
      gap={0}
      borderRadius="md"
      overflow="hidden"
      bg="bg.subtle"
      shadow="sm"
      role="group"
      aria-label={ariaLabel}
    >
      {modes.map((mode, index) => {
        const isActive = value === mode.id;
        const isLast = index === modes.length - 1;

        return (
          <Button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            variant="ghost"
            borderRadius={0}
            borderRightWidth={isLast ? undefined : '1px'}
            borderRightColor={isLast ? undefined : 'border.subtle'}
            bg={isActive ? 'bg.surface' : 'transparent'}
            color={isActive ? 'text.primary' : 'text.secondary'}
            _hover={{ bg: isActive ? 'bg.surface' : 'bg.subtle' }}
            size={size}
            aria-current={isActive ? 'true' : undefined}
          >
            <HStack gap={2}>
              <Icon>
                <mode.icon />
              </Icon>
              <Text>{mode.label}</Text>
            </HStack>
          </Button>
        );
      })}
    </HStack>
  );
}
