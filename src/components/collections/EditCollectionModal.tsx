import { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  Field,
  Input,
  Textarea,
  Separator,
  VStack,
  Box,
} from '@chakra-ui/react';
import { Collection } from './AddCollectionDialog';
import CollectionItemsSelector from './CollectionItemsSelector';
import { ArtifactFile } from '../../ipc';

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (collection: Collection, selectedItemIds: string[]) => void;
  collection: Collection;
  selectedItemIds: string[];
  kits: ArtifactFile[];
  kitsLoading: boolean;
}

export default function EditCollectionModal({
  isOpen,
  onClose,
  onSave,
  collection,
  selectedItemIds: initialSelectedItemIds,
  kits,
  kitsLoading,
}: EditCollectionModalProps) {
  const [collectionName, setCollectionName] = useState(collection.name);
  const [collectionDescription, setCollectionDescription] = useState(collection.description || '');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set(initialSelectedItemIds));

  // Update local state when collection or selectedItemIds change
  useEffect(() => {
    setCollectionName(collection.name);
    setCollectionDescription(collection.description || '');
    setSelectedItemIds(new Set(initialSelectedItemIds));
  }, [collection, initialSelectedItemIds]);

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const isSelected = (itemId: string) => {
    return selectedItemIds.has(itemId);
  };

  const handleSave = () => {
    if (collectionName.trim()) {
      const updatedCollection: Collection = {
        ...collection,
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
      };
      onSave(updatedCollection, Array.from(selectedItemIds));
      handleClose();
    }
  };

  const handleClose = () => {
    // Reset to original values
    setCollectionName(collection.name);
    setCollectionDescription(collection.description || '');
    setSelectedItemIds(new Set(initialSelectedItemIds));
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="1000px" maxH="90vh" display="flex" flexDirection="column">
            <Dialog.Header>
              <Dialog.Title>Edit Collection</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body flex="1" overflowY="auto">
              <VStack align="stretch" gap={4}>
                {/* Collection Name and Description */}
                <Box>
                  <Field.Root mb={4}>
                    <Field.Label>Collection Name</Field.Label>
                    <Input
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      placeholder="Enter collection name"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Description</Field.Label>
                    <Textarea
                      value={collectionDescription}
                      onChange={(e) => setCollectionDescription(e.target.value)}
                      placeholder="Enter collection description (optional)"
                      rows={3}
                    />
                  </Field.Root>
                </Box>

                <Separator />

                {/* Items Selector */}
                <CollectionItemsSelector
                  kits={kits}
                  kitsLoading={kitsLoading}
                  selectedItemIds={selectedItemIds}
                  onToggleItem={handleToggleItem}
                  isSelected={isSelected}
                  mode="edit"
                />
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                onClick={handleSave}
                disabled={!collectionName.trim()}
                colorPalette="primary"
              >
                Save
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}






