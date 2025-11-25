import { useState } from 'react';
import {
  Dialog,
  Button,
  Field,
  Input,
  Portal,
  CloseButton,
} from '@chakra-ui/react';

export interface Collection {
  id: string;
  name: string;
}

interface AddCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (collection: Collection) => void;
}

export default function AddCollectionDialog({
  isOpen,
  onClose,
  onAdd,
}: AddCollectionDialogProps) {
  const [collectionName, setCollectionName] = useState('');

  const handleAdd = () => {
    if (collectionName.trim()) {
      const newCollection: Collection = {
        id: `collection-${Date.now()}`,
        name: collectionName.trim(),
      };
      onAdd(newCollection);
      setCollectionName('');
      onClose();
    }
  };

  const handleClose = () => {
    setCollectionName('');
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Add Collection</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Field.Root>
                <Field.Label>Collection Name</Field.Label>
                <Input
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="Enter collection name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && collectionName.trim()) {
                      handleAdd();
                    }
                  }}
                />
              </Field.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                onClick={handleAdd}
                disabled={!collectionName.trim()}
                colorPalette="primary"
              >
                Add
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

