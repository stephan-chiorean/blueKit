import { ReactNode } from 'react';
import { EmptyState, Button, VStack } from '@chakra-ui/react';
import { LuFolderOpen } from 'react-icons/lu';

interface ConditionalTabContentProps {
  /** Whether the dependency required for this tab is satisfied */
  hasDependency: boolean;
  /** Callback to satisfy the dependency (e.g., link data, configure, etc.) */
  onSatisfyDependency: () => void;
  /** Content to render when dependency is satisfied */
  children: ReactNode;
  /** Title shown in empty state */
  emptyStateTitle: string;
  /** Optional description for empty state */
  emptyStateDescription?: string;
  /** Optional icon for empty state */
  emptyStateIcon?: ReactNode;
  /** Optional text for the action button */
  actionButtonText?: string;
}

/**
 * Conditional tab content component that shows empty state when dependency is not met.
 * 
 * This component implements a pattern where tabs require a dependency (like linked data,
 * configuration, etc.) before they can display content. When the dependency is not satisfied,
 * it shows a helpful empty state with a call-to-action.
 */
export default function ConditionalTabContent({
  hasDependency,
  onSatisfyDependency,
  children,
  emptyStateTitle,
  emptyStateDescription,
  emptyStateIcon,
  actionButtonText = 'Get Started',
}: ConditionalTabContentProps) {
  if (!hasDependency) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            {emptyStateIcon || <LuFolderOpen />}
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>{emptyStateTitle}</EmptyState.Title>
            {emptyStateDescription && (
              <EmptyState.Description>
                {emptyStateDescription}
              </EmptyState.Description>
            )}
          </VStack>
          <Button onClick={onSatisfyDependency} mt={4}>
            {actionButtonText}
          </Button>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return <>{children}</>;
}

