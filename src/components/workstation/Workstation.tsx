import {
  Box,
  Flex,
  EmptyState,
} from '@chakra-ui/react';
import { useWorkstation } from '../../contexts/WorkstationContext';
import KitMarkdownViewer from './KitMarkdownViewer';

export default function Workstation() {
  const { selectedKit, kitContent } = useWorkstation();

  return (
    <Flex
      direction="column"
      h="100%"
      bg="white"
      position="relative"
      overflow="hidden"
    >
      {/* Content Area */}
      <Box
        flex="1"
        bg="white"
        position="relative"
        overflow="auto"
      >
        {selectedKit && kitContent ? (
          <KitMarkdownViewer kit={selectedKit} content={kitContent} />
        ) : (
          <EmptyState.Root>
            <EmptyState.Content>
              <EmptyState.Title>No Kit Selected</EmptyState.Title>
              <EmptyState.Description>
                Click "View" on a kit to see its content here
              </EmptyState.Description>
            </EmptyState.Content>
          </EmptyState.Root>
        )}
      </Box>
    </Flex>
  );
}




