import { useState } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { CloneMetadata } from "../../ipc";

interface ClonesActionBarProps {
  selectedClones: CloneMetadata[];
  hasSelection: boolean;
  clearSelection: () => void;
  onClonesUpdated: () => void;
}

export default function ClonesActionBar({
  selectedClones,
  hasSelection,
  clearSelection,
  onClonesUpdated,
}: ClonesActionBarProps) {
  const [loading, setLoading] = useState(false);

  if (!hasSelection) {
    return null;
  }

  const handleDelete = async () => {
    try {
      setLoading(true);
      // TODO: Implement delete functionality
      // await Promise.all(selectedClones.map(clone => invokeDeleteClone(clone.id)));

      toaster.create({
        type: "error",
        title: "Clones deleted",
        description: `${selectedClones.length} clone${
          selectedClones.length !== 1 ? "s" : ""
        } deleted`,
      });

      clearSelection();
      onClonesUpdated();
    } catch (error) {
      console.error("[ClonesActionBar] Error in Delete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to delete clones: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToLibrary = async () => {
    try {
      setLoading(true);
      // TODO: Implement publish to library functionality
      // await Promise.all(selectedClones.map(clone => invokePublishCloneToLibrary(clone.id)));

      toaster.create({
        type: "success",
        title: "Clones published",
        description: `Published ${selectedClones.length} clone${
          selectedClones.length !== 1 ? "s" : ""
        } to library`,
      });

      clearSelection();
      onClonesUpdated();
    } catch (error) {
      console.error("[ClonesActionBar] Error in Publish to Library:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to publish clones: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToProject = async () => {
    try {
      setLoading(true);
      // TODO: Implement add to project functionality
      // await Promise.all(selectedClones.map(clone => invokeAddCloneToProject(clone.id)));

      toaster.create({
        type: "success",
        title: "Clones added",
        description: `Added ${selectedClones.length} clone${
          selectedClones.length !== 1 ? "s" : ""
        } to project`,
      });

      clearSelection();
      onClonesUpdated();
    } catch (error) {
      console.error("[ClonesActionBar] Error in Add to Project:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to add clones to project: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionBar.Root open={hasSelection} closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner>
          <ActionBar.Content>
            <Button
              variant="surface"
              colorPalette="red"
              size="sm"
              onClick={handleDelete}
              disabled={loading}
            >
              <HStack gap={2}>
                <LuTrash2 />
                <Text>Delete</Text>
              </HStack>
            </Button>
            <ActionBar.Separator />
            <Button
              variant="outline"
              size="sm"
              onClick={handlePublishToLibrary}
              disabled={loading}
            >
              <HStack gap={2}>
                <LuBookOpen />
                <Text>Publish to Library</Text>
              </HStack>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddToProject}
              disabled={loading}
            >
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

