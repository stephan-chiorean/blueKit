import { useState, useEffect } from 'react';
import {
  Dialog,
  Portal,
  CloseButton,
  Text,
  Button,
  VStack,
  HStack,
  Icon,
  Box,
} from '@chakra-ui/react';
import { LuPackage, LuBookOpen, LuBot, LuNetwork, LuTrash2 } from 'react-icons/lu';
import { SelectedItem } from '../../contexts/SelectionContext';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: SelectedItem[];
}

export default function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  items,
}: DeleteConfirmationDialogProps) {
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Count items by type
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });
    setItemCounts(counts);
  }, [items]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Kit':
        return <LuPackage />;
      case 'Walkthrough':
        return <LuBookOpen />;
      case 'Agent':
        return <LuBot />;
      case 'Diagram':
        return <LuNetwork />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string, count: number) => {
    const labels: Record<string, string> = {
      Kit: count === 1 ? 'kit' : 'kits',
      Walkthrough: count === 1 ? 'walkthrough' : 'walkthroughs',
      Agent: count === 1 ? 'agent' : 'agents',
      Diagram: count === 1 ? 'diagram' : 'diagrams',
    };
    return labels[type] || 'item';
  };

  const totalCount = items.length;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="md">
            <Dialog.Header>
              <Dialog.Title>Delete Resources</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Text>
                  Are you sure you want to delete {totalCount} {totalCount === 1 ? 'resource' : 'resources'}?
                  This action cannot be undone.
                </Text>

                {Object.keys(itemCounts).length > 0 && (
                  <Box p={3} bg="bg.subtle" borderRadius="md">
                    <VStack gap={2} align="stretch">
                      {Object.entries(itemCounts).map(([type, count]) => (
                        <HStack key={type} gap={2}>
                          <Icon color="text.secondary">
                            {getTypeIcon(type)}
                          </Icon>
                          <Text fontSize="sm">
                            {count} {getTypeLabel(type, count)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                )}

                {totalCount <= 5 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Files to be deleted:
                    </Text>
                    <VStack gap={1} align="stretch">
                      {items.map((item, index) => (
                        <Text key={index} fontSize="xs" color="text.secondary" fontFamily="mono">
                          {item.name}
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                >
                  <HStack gap={2}>
                    <LuTrash2 />
                    <Text>Delete</Text>
                  </HStack>
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
