import {
  Dialog,
  Portal,
  CloseButton,
  Text,
  Button,
  VStack,
  HStack,
  Icon,
} from '@chakra-ui/react';
import { LuTrash2, LuFolder } from 'react-icons/lu';
import { ArtifactFolder } from '../../ipc';

interface DeleteFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ArtifactFolder | null;
  onConfirm: () => void;
}

export default function DeleteFolderDialog({
  isOpen,
  onClose,
  folder,
  onConfirm,
}: DeleteFolderDialogProps) {
  const displayName = folder?.config?.name || folder?.name || 'this folder';
  const itemCount = (folder?.artifactCount || 0) + (folder?.folderCount || 0);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="md">
            <Dialog.Header>
              <Dialog.Title>Delete Group</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Text>
                  Are you sure you want to delete <strong>{displayName}</strong>?
                </Text>

                <VStack gap={2} align="stretch" p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
                  <HStack gap={2}>
                    <Icon color="red.600">
                      <LuFolder />
                    </Icon>
                    <Text fontSize="sm" fontWeight="medium" color="red.800">
                      This will permanently delete:
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="red.700" pl={6}>
                    • The group and all its contents
                  </Text>
                  {itemCount > 0 && (
                    <Text fontSize="sm" color="red.700" pl={6}>
                      • {itemCount} {itemCount === 1 ? 'item' : 'items'} inside the group
                    </Text>
                  )}
                  <Text fontSize="sm" color="red.700" pl={6}>
                    • This action cannot be undone
                  </Text>
                </VStack>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  colorPalette="red"
                  onClick={handleConfirm}
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuTrash2 />
                    </Icon>
                    <Text>Delete Group</Text>
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

