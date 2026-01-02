import { HStack, Button, Icon, Text } from '@chakra-ui/react';
import { LuLayoutGrid, LuTable } from 'react-icons/lu';

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
 *
 * @example
 * ```tsx
 * <ViewModeSwitcher
 *   value={viewMode}
 *   onChange={(mode) => setViewMode(mode as ViewMode)}
 *   modes={[
 *     STANDARD_VIEW_MODES.card,
 *     STANDARD_VIEW_MODES.table,
 *     { id: 'roadmap', label: 'Roadmap', icon: GrNavigate },
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
}: ViewModeSwitcherProps) {
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
