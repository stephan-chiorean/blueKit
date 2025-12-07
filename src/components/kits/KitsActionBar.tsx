import { useState, useEffect } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { ArtifactFile, ProjectEntry, invokeCopyKitToProject } from "../../ipc";
import AddToProjectPopover from "../shared/AddToProjectPopover";

interface KitsActionBarProps {
  selectedKits: ArtifactFile[];
  hasSelection: boolean;
  clearSelection: () => void;
  onKitsUpdated: () => void;
}

export default function KitsActionBar({
  selectedKits,
  hasSelection,
  clearSelection,
  onKitsUpdated,
}: KitsActionBarProps) {
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
      // await Promise.all(selectedKits.map(kit => invokeDeleteKit(kit.path)));

      toaster.create({
        type: "error",
        title: "Kits deleted",
        description: `${selectedKits.length} kit${
          selectedKits.length !== 1 ? "s" : ""
        } deleted`,
      });

      clearSelection();
      onKitsUpdated();
    } catch (error) {
      console.error("[KitsActionBar] Error in Delete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to delete kits: ${
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
      // await Promise.all(selectedKits.map(kit => invokePublishKitToLibrary(kit.path)));

      toaster.create({
        type: "success",
        title: "Kits published",
        description: `Published ${selectedKits.length} kit${
          selectedKits.length !== 1 ? "s" : ""
        } to library`,
      });

      clearSelection();
      onKitsUpdated();
    } catch (error) {
      console.error("[KitsActionBar] Error in Publish to Library:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to publish kits: ${
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
      
      // Copy each kit to each selected project
      const copyPromises: Promise<void>[] = [];
      for (const kit of selectedKits) {
        for (const project of selectedProjects) {
          copyPromises.push(
            invokeCopyKitToProject(kit.path, project.path)
              .then(() => {
                // Convert Promise<string> to Promise<void>
              })
              .catch((error) => {
                console.error(`[KitsActionBar] Error copying ${kit.name} to ${project.title}:`, error);
                throw error;
              })
          );
        }
      }

      await Promise.all(copyPromises);

      toaster.create({
        type: "success",
        title: "Kits added",
        description: `Added ${selectedKits.length} kit${
          selectedKits.length !== 1 ? "s" : ""
        } to ${selectedProjects.length} project${selectedProjects.length !== 1 ? "s" : ""}`,
      });

      clearSelection();
      onKitsUpdated();
    } catch (error) {
      console.error("[KitsActionBar] Error in Add to Project:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to add kits to project: ${
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
              itemType="kit"
              itemCount={selectedKits.length}
              disabled={loading}
              sourceFiles={selectedKits.map(kit => ({ path: kit.path, name: kit.name }))}
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
