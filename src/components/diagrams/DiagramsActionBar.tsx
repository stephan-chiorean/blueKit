import { useState } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { KitFile } from "../../ipc";

interface DiagramsActionBarProps {
  selectedDiagrams: KitFile[];
  hasSelection: boolean;
  clearSelection: () => void;
  onDiagramsUpdated: () => void;
}

export default function DiagramsActionBar({
  selectedDiagrams,
  hasSelection,
  clearSelection,
  onDiagramsUpdated,
}: DiagramsActionBarProps) {
  const [loading, setLoading] = useState(false);

  if (!hasSelection) {
    return null;
  }

  const handleDelete = async () => {
    try {
      setLoading(true);
      // TODO: Implement delete functionality
      // await Promise.all(selectedDiagrams.map(diagram => invokeDeleteDiagram(diagram.path)));

      toaster.create({
        type: "error",
        title: "Diagrams deleted",
        description: `${selectedDiagrams.length} diagram${
          selectedDiagrams.length !== 1 ? "s" : ""
        } deleted`,
      });

      clearSelection();
      onDiagramsUpdated();
    } catch (error) {
      console.error("[DiagramsActionBar] Error in Delete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to delete diagrams: ${
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
      // await Promise.all(selectedDiagrams.map(diagram => invokePublishDiagramToLibrary(diagram.path)));

      toaster.create({
        type: "success",
        title: "Diagrams published",
        description: `Published ${selectedDiagrams.length} diagram${
          selectedDiagrams.length !== 1 ? "s" : ""
        } to library`,
      });

      clearSelection();
      onDiagramsUpdated();
    } catch (error) {
      console.error("[DiagramsActionBar] Error in Publish to Library:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to publish diagrams: ${
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
      // await Promise.all(selectedDiagrams.map(diagram => invokeAddDiagramToProject(diagram.path)));

      toaster.create({
        type: "success",
        title: "Diagrams added",
        description: `Added ${selectedDiagrams.length} diagram${
          selectedDiagrams.length !== 1 ? "s" : ""
        } to project`,
      });

      clearSelection();
      onDiagramsUpdated();
    } catch (error) {
      console.error("[DiagramsActionBar] Error in Add to Project:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to add diagrams to project: ${
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

