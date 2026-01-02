import {
  Box,
  Flex,
  EmptyState,
} from '@chakra-ui/react';
import { useResource } from '../../contexts/ResourceContext';
import ResourceMarkdownViewer from './ResourceMarkdownViewer';

export default function Workstation() {
  const { selectedResource, resourceContent } = useResource();

  return (
    <Flex
      direction="column"
      h="100%"
      bg="transparent"
      position="relative"
      overflow="hidden"
    >
      {/* Content Area */}
      <Box
        flex="1"
        bg="transparent"
        position="relative"
        overflow="auto"
      >
        {selectedResource && resourceContent ? (
          <ResourceMarkdownViewer resource={selectedResource} content={resourceContent} />
        ) : (
          <EmptyState.Root>
            <EmptyState.Content>
              <EmptyState.Title>No Resource Selected</EmptyState.Title>
              <EmptyState.Description>
                Click "View" on a resource to see its content here
              </EmptyState.Description>
            </EmptyState.Content>
          </EmptyState.Root>
        )}
      </Box>
    </Flex>
  );
}




