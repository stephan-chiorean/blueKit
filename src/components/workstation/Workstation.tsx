import {
  Box,
  Flex,
  Text,
  HStack,
  IconButton,
  EmptyState,
} from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';
import { useWorkstation } from '../../contexts/WorkstationContext';
import KitMarkdownViewer from './KitMarkdownViewer';

export default function Workstation() {
  const { selectedKit, kitContent, clearSelectedKit } = useWorkstation();

  return (
    <Flex
      direction="column"
      h="100%"
      bg="gray.50"
      position="relative"
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        p={3}
        bg="white"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        minH="48px"
      >
        <HStack gap={2} flex="1">
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            {selectedKit ? (selectedKit.frontMatter?.alias || selectedKit.name) : 'Workstation'}
          </Text>
        </HStack>
        {selectedKit && (
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Close"
            onClick={clearSelectedKit}
          >
            <LuX />
          </IconButton>
        )}
      </Flex>

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

