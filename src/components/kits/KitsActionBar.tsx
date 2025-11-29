import {
  Button,
  HStack,
  Text,
  ActionBar,
  Portal,
} from '@chakra-ui/react';
import { LuLibrary, LuFolderPlus, LuTrash2 } from 'react-icons/lu';
import { useSelection } from '../../contexts/SelectionContext';
import { invokeCopyKitToProject } from '../../ipc';
import { open } from '@tauri-apps/api/dialog';
import { toaster } from '../ui/toaster';

export default function KitsActionBar() {
  const { selectedItems, hasSelection, clearSelection, removeItem } = useSelection();

  if (!hasSelection) {
    return null;
  }

  const handleDelete = () => {
    console.log('[KitsActionBar] Delete clicked, items to delete:', selectedItems);
    // Delete all selected items
    selectedItems.forEach((item) => removeItem(item.id));
  };

  const handlePublishToLibrary = () => {
    // TODO: Implement publish to library functionality
    console.log('[KitsActionBar] Publish to Library clicked', selectedItems);
    alert('Publish to Library feature coming soon');
  };

  const handleAddToProject = async () => {
    try {
      // Open directory picker to select a project
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project',
      });

      if (!selectedPath || typeof selectedPath !== 'string') {
        // User cancelled
        return;
      }

      // Copy each selected kit to the target project
      let successCount = 0;
      const errors: string[] = [];

      for (const item of selectedItems) {
        if (item.type === 'Kit' && item.path) {
          try {
            await invokeCopyKitToProject(item.path, selectedPath);
            successCount++;
          } catch (error) {
            console.error(`Failed to copy ${item.name}:`, error);
            errors.push(`${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      if (successCount > 0) {
        // Show success toast
        toaster.create({
          type: 'success',
          title: 'Success',
          description: `Successfully copied ${successCount} kit${successCount > 1 ? 's' : ''} to project`,
        });
        
        // If there were errors, show them separately
        if (errors.length > 0) {
          toaster.create({
            type: 'error',
            title: 'Some kits failed',
            description: `Errors: ${errors.join(', ')}`,
          });
        }
      } else if (errors.length > 0) {
        // Only errors, no successes
        toaster.create({
          type: 'error',
          title: 'Failed to copy kits',
          description: errors.join(', '),
        });
      }

      // Clear selection after operation
      clearSelection();
    } catch (error) {
      console.error('[KitsActionBar] Error in Add to Project:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: `Failed to add to project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  return (
    <ActionBar.Root 
      open={hasSelection} 
      closeOnInteractOutside={false}
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
            <Button variant="outline" size="sm" onClick={handlePublishToLibrary}>
              <HStack gap={2}>
                <LuLibrary />
                <Text>Publish to Library</Text>
              </HStack>
            </Button>
            <Button variant="outline" size="sm" onClick={handleAddToProject}>
              <HStack gap={2}>
                <LuFolderPlus />
                <Text>Add to Project</Text>
              </HStack>
            </Button>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}

