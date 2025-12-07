import { useState, useEffect } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { ArtifactFile, ProjectEntry, invokeCopyWalkthroughToProject } from "../../ipc";
import AddToProjectPopover from "../shared/AddToProjectPopover";

interface WalkthroughsActionBarProps {
  selectedWalkthroughs: ArtifactFile[];
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
  const [isOpen, setIsOpen] = useState(false);

  // Sync isOpen with hasSelection and force close when hasSelection becomes false
  useEffect(() => {
    if (hasSelection) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [hasSelection]);

  // Don't render anything if there's no selection
  if (!hasSelection && !isOpen) {
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

  const handleConfirmAddToProject = async (selectedProjects: ProjectEntry[]) => {
    try {
      setLoading(true);
      
      // Copy each walkthrough to each selected project
      const copyPromises: Promise<void>[] = [];
      for (const walkthrough of selectedWalkthroughs) {
        for (const project of selectedProjects) {
          copyPromises.push(
            invokeCopyWalkthroughToProject(walkthrough.path, project.path)
              .then(() => {
                // Convert Promise<string> to Promise<void>
              })
              .catch((error) => {
                console.error(`[WalkthroughsActionBar] Error copying ${walkthrough.name} to ${project.title}:`, error);
                throw error;
              })
          );
        }
      }

      await Promise.all(copyPromises);

      toaster.create({
        type: "success",
        title: "Walkthroughs added",
        description: `Added ${selectedWalkthroughs.length} walkthrough${
          selectedWalkthroughs.length !== 1 ? "s" : ""
        } to ${selectedProjects.length} project${selectedProjects.length !== 1 ? "s" : ""}`,
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
      throw error; // Re-throw so popover can handle it
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionBar.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} closeOnInteractOutside={false}>
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
            <AddToProjectPopover
              onConfirm={handleConfirmAddToProject}
              itemType="walkthrough"
              itemCount={selectedWalkthroughs.length}
              disabled={loading}
              sourceFiles={selectedWalkthroughs.map(walkthrough => ({ path: walkthrough.path, name: walkthrough.name }))}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  <HStack gap={2}>
                    <LuFolderPlus />
                    <Text>Add to Project</Text>
                  </HStack>
                </Button>
              }
            />
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}

