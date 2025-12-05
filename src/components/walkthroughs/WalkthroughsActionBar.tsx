import { useState } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { KitFile } from "../../ipc";

interface WalkthroughsActionBarProps {
  selectedWalkthroughs: KitFile[];
  hasSelection: boolean;
  clearSelection: () => void;
  onWalkthroughsUpdated: () => void;
}

export default function WalkthroughsActionBar({
  selectedWalkthroughs,
  hasSelection,
  clearSelection,
  onWalkthroughsUpdated,
}: WalkthroughsActionBarProps) {
  const [loading, setLoading] = useState(false);

  if (!hasSelection) {
    return null;
  }

  const handleDelete = async () => {
    try {
      setLoading(true);
      // TODO: Implement delete functionality
      // await Promise.all(selectedWalkthroughs.map(walkthrough => invokeDeleteWalkthrough(walkthrough.path)));

      toaster.create({
        type: "error",
        title: "Walkthroughs deleted",
        description: `${selectedWalkthroughs.length} walkthrough${
          selectedWalkthroughs.length !== 1 ? "s" : ""
        } deleted`,
      });

      clearSelection();
      onWalkthroughsUpdated();
    } catch (error) {
      console.error("[WalkthroughsActionBar] Error in Delete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to delete walkthroughs: ${
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
      // await Promise.all(selectedWalkthroughs.map(walkthrough => invokePublishWalkthroughToLibrary(walkthrough.path)));

      toaster.create({
        type: "success",
        title: "Walkthroughs published",
        description: `Published ${selectedWalkthroughs.length} walkthrough${
          selectedWalkthroughs.length !== 1 ? "s" : ""
        } to library`,
      });

      clearSelection();
      onWalkthroughsUpdated();
    } catch (error) {
      console.error("[WalkthroughsActionBar] Error in Publish to Library:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to publish walkthroughs: ${
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
      // await Promise.all(selectedWalkthroughs.map(walkthrough => invokeAddWalkthroughToProject(walkthrough.path)));

      toaster.create({
        type: "success",
        title: "Walkthroughs added",
        description: `Added ${selectedWalkthroughs.length} walkthrough${
          selectedWalkthroughs.length !== 1 ? "s" : ""
        } to project`,
      });

      clearSelection();
      onWalkthroughsUpdated();
    } catch (error) {
      console.error("[WalkthroughsActionBar] Error in Add to Project:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to add walkthroughs to project: ${
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

