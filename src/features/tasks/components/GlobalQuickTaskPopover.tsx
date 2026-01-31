import { Box } from '@chakra-ui/react';
import QuickTaskPopover from './QuickTaskPopover';
import { useQuickTaskPopover } from '@/shared/contexts/QuickTaskPopoverContext';

/**
 * Global QuickTaskPopover that's controlled by the QuickTaskPopoverContext.
 * This component should be rendered once at the app root level.
 */
export default function GlobalQuickTaskPopover() {
  const { isOpen, setOpen, popoverOptions } = useQuickTaskPopover();

  return (
    <QuickTaskPopover
      open={isOpen}
      onOpenChange={setOpen}
      defaultView={popoverOptions.defaultView}
      defaultProjectId={popoverOptions.defaultProjectId}
      onTaskCreated={popoverOptions.onTaskCreated}
      trigger={
        // Hidden trigger element (popover is controlled programmatically)
        <Box display="none" />
      }
    />
  );
}
