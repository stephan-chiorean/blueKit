import {
  Button,
  HStack,
  Text,
  ActionBar,
  Portal,
  HoverCard,
  Tag,
  Stack,
  Flex,
} from '@chakra-ui/react';
import { LuTrash2, LuFolderPlus, LuFileText, LuLayers } from 'react-icons/lu';
import { useSelection } from '../contexts/SelectionContext';

export default function GlobalActionBar() {
  const { selectedItems, hasSelection, clearSelection, removeItem } = useSelection();

  console.log('[GlobalActionBar] Render - hasSelection:', hasSelection, 'selectedItems:', selectedItems);

  const handleDelete = () => {
    console.log('[GlobalActionBar] Delete clicked, items to delete:', selectedItems);
    // Delete all selected items
    selectedItems.forEach((item) => removeItem(item.id));
  };

  if (!hasSelection) {
    console.log('[GlobalActionBar] No selection, returning null');
    return null;
  }

  return (
    <>
      <ActionBar.Root 
        open={hasSelection} 
        closeOnInteractOutside={false}
        onOpenChange={(e) => {
          // Only clear selection if explicitly closed (not from clicking outside)
          // We'll handle clearing via explicit actions instead
          console.log('[GlobalActionBar] onOpenChange:', e.open);
          // Don't auto-clear on close - let user explicitly clear via actions
        }}
      >
        <Portal>
          <ActionBar.Positioner>
            <ActionBar.Content>
              <Button variant="surface" colorPalette="red" size="sm" onClick={handleDelete}>
                <HStack gap={2}>
                  <LuTrash2 />
                  <Text>Delete</Text>
                </HStack>
              </Button>
              <ActionBar.Separator />
              <Button variant="outline" size="sm">
                <HStack gap={2}>
                  <LuLayers />
                  <Text>Add to Collection</Text>
                </HStack>
              </Button>
              <Button variant="outline" size="sm">
                <HStack gap={2}>
                  <LuFileText />
                  <Text>Add to Blueprint</Text>
                </HStack>
              </Button>
              <Button variant="outline" size="sm">
                <HStack gap={2}>
                  <LuFolderPlus />
                  <Text>Add to Project</Text>
                </HStack>
              </Button>
            </ActionBar.Content>
          </ActionBar.Positioner>
        </Portal>
      </ActionBar.Root>
    </>
  );
}

