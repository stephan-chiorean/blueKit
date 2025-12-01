import {
  Box,
  EmptyState,
  Icon,
} from '@chakra-ui/react';
import { LuWorkflow } from 'react-icons/lu';

export default function WorkflowsTabContent() {
  return (
    <Box>
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon size="xl" color="primary.500">
              <LuWorkflow />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>No workflows yet</EmptyState.Title>
          <EmptyState.Description>
            Workflows will appear here once they are created.
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    </Box>
  );
}






