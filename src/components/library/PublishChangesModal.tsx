import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Heading,
  HStack,
  Icon,
  Portal,
  Spinner,
  Text,
  VStack,
  CloseButton,
} from '@chakra-ui/react';
import {
  LuUpload,
  LuFolderPlus,
  LuTrash2,
  LuFolder,
  LuX,
  LuCheck,
} from 'react-icons/lu';
import { LibraryChange } from '../../types/github';
import { toaster } from '../ui/toaster';

interface PublishChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  changes: LibraryChange[];
  onPublish: (changes: LibraryChange[]) => Promise<void>;
  publishing: boolean;
}

export default function PublishChangesModal({
  isOpen,
  onClose,
  changes,
  onPublish,
  publishing,
}: PublishChangesModalProps) {
  const handlePublish = async () => {
    try {
      await onPublish(changes);
      onClose();
    } catch (error) {
      // Error is handled in onPublish
      console.error('Publish failed:', error);
    }
  };

  // Group changes by type
  const foldersToCreate = changes.filter(c => c.type === 'folder_created');
  const foldersToDelete = changes.filter(c => c.type === 'folder_deleted');
  const catalogsToMove = changes.filter(c => c.type === 'catalog_moved_to_folder');
  const catalogsToRemove = changes.filter(c => c.type === 'catalog_removed_from_folder');
  const catalogsToDelete = changes.filter(c => c.type === 'catalog_deleted');

  const hasChanges =
    foldersToCreate.length > 0 ||
    foldersToDelete.length > 0 ||
    catalogsToMove.length > 0 ||
    catalogsToRemove.length > 0 ||
    catalogsToDelete.length > 0;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && !publishing && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="lg">
            <Dialog.Header>
              <Dialog.Title>Publish Changes</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={publishing} />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Text>
                  The following changes will be published to GitHub:
                </Text>

                {!hasChanges ? (
                  <Box p={4} bg="bg.subtle" borderRadius="md" textAlign="center">
                    <Text color="text.secondary">No changes to publish</Text>
                  </Box>
                ) : (
                  <VStack align="stretch" gap={3}>
                    {/* Folders to create */}
                    {foldersToCreate.length > 0 && (
                      <Box p={3} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.200" _dark={{ bg: "green.950", borderColor: "green.800" }}>
                        <HStack gap={2} mb={2}>
                          <Icon color="green.600" _dark={{ color: "green.400" }}>
                            <LuFolderPlus />
                          </Icon>
                          <Text fontSize="sm" fontWeight="medium" color="green.800" _dark={{ color: "green.300" }}>
                            Create {foldersToCreate.length} folder{foldersToCreate.length !== 1 ? 's' : ''}
                          </Text>
                        </HStack>
                        <VStack align="start" gap={1} pl={6}>
                          {foldersToCreate.map((change, idx) => (
                            <Text key={idx} fontSize="sm" color="green.700" _dark={{ color: "green.300" }}>
                              • {change.folder_name}
                            </Text>
                          ))}
                        </VStack>
                      </Box>
                    )}

                    {/* Folders to delete */}
                    {foldersToDelete.length > 0 && (
                      <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200" _dark={{ bg: "red.950", borderColor: "red.800" }}>
                        <HStack gap={2} mb={2}>
                          <Icon color="red.600" _dark={{ color: "red.400" }}>
                            <LuTrash2 />
                          </Icon>
                          <Text fontSize="sm" fontWeight="medium" color="red.800" _dark={{ color: "red.300" }}>
                            Delete {foldersToDelete.length} folder{foldersToDelete.length !== 1 ? 's' : ''}
                          </Text>
                        </HStack>
                        <VStack align="start" gap={1} pl={6}>
                          {foldersToDelete.map((change, idx) => (
                            <Text key={idx} fontSize="sm" color="red.700" _dark={{ color: "red.300" }}>
                              • {change.folder_name}
                            </Text>
                          ))}
                        </VStack>
                      </Box>
                    )}

                    {/* Catalogs to move */}
                    {catalogsToMove.length > 0 && (
                      <Box p={3} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.200" _dark={{ bg: "blue.950", borderColor: "blue.800" }}>
                        <HStack gap={2} mb={2}>
                          <Icon color="blue.600" _dark={{ color: "blue.400" }}>
                            <LuFolder />
                          </Icon>
                          <Text fontSize="sm" fontWeight="medium" color="blue.800" _dark={{ color: "blue.300" }}>
                            Move {catalogsToMove.length} catalog{catalogsToMove.length !== 1 ? 's' : ''} to folder{catalogsToMove.length !== 1 ? 's' : ''}
                          </Text>
                        </HStack>
                        <VStack align="start" gap={1} pl={6}>
                          {catalogsToMove.map((change, idx) => (
                            <Text key={idx} fontSize="sm" color="blue.700" _dark={{ color: "blue.300" }}>
                              • {change.catalog_name} → {change.folder_name}
                            </Text>
                          ))}
                        </VStack>
                      </Box>
                    )}

                    {/* Catalogs to remove from folders */}
                    {catalogsToRemove.length > 0 && (
                      <Box p={3} bg="orange.50" borderRadius="md" borderWidth="1px" borderColor="orange.200" _dark={{ bg: "orange.950", borderColor: "orange.800" }}>
                        <HStack gap={2} mb={2}>
                          <Icon color="orange.600" _dark={{ color: "orange.400" }}>
                            <LuX />
                          </Icon>
                          <Text fontSize="sm" fontWeight="medium" color="orange.800" _dark={{ color: "orange.300" }}>
                            Remove {catalogsToRemove.length} catalog{catalogsToRemove.length !== 1 ? 's' : ''} from folder{catalogsToRemove.length !== 1 ? 's' : ''}
                          </Text>
                        </HStack>
                        <VStack align="start" gap={1} pl={6}>
                          {catalogsToRemove.map((change, idx) => (
                            <Text key={idx} fontSize="sm" color="orange.700" _dark={{ color: "orange.300" }}>
                              • {change.catalog_name}
                            </Text>
                          ))}
                        </VStack>
                      </Box>
                    )}

                    {/* Catalogs to delete */}
                    {catalogsToDelete.length > 0 && (
                      <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200" _dark={{ bg: "red.950", borderColor: "red.800" }}>
                        <HStack gap={2} mb={2}>
                          <Icon color="red.600" _dark={{ color: "red.400" }}>
                            <LuTrash2 />
                          </Icon>
                          <Text fontSize="sm" fontWeight="medium" color="red.800" _dark={{ color: "red.300" }}>
                            Delete {catalogsToDelete.length} catalog{catalogsToDelete.length !== 1 ? 's' : ''}
                          </Text>
                        </HStack>
                        <VStack align="start" gap={1} pl={6}>
                          {catalogsToDelete.map((change, idx) => (
                            <Text key={idx} fontSize="sm" color="red.700" _dark={{ color: "red.300" }}>
                              • {change.catalog_name}
                            </Text>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </VStack>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={onClose} disabled={publishing}>
                  Cancel
                </Button>
                <Button
                  colorPalette="green"
                  onClick={handlePublish}
                  disabled={!hasChanges || publishing}
                  loading={publishing}
                >
                  <HStack gap={2}>
                    {publishing ? <Spinner size="sm" /> : <LuUpload />}
                    <Text>Publish Changes</Text>
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

