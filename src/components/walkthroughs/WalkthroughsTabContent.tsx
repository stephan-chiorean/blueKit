import {
  EmptyState,
  Highlight,
  Icon,
} from '@chakra-ui/react';
import { LuBookOpen } from 'react-icons/lu';

export default function WalkthroughsTabContent() {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="primary.500">
            <LuBookOpen />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>
          <Highlight
            query="generate walkthroughs"
            styles={{
              px: '1',
              py: '0.5',
              bg: 'primary.100',
              color: 'primary.700',
              borderRadius: 'sm',
            }}
          >
            Prompt your coding agent to generate walkthroughs of your code, and explore them here
          </Highlight>
        </EmptyState.Title>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}






