import { useState, useEffect } from "react";
import { Button, HStack, Text, ActionBar, Portal, Box, VStack, Icon } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen, LuNetwork } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { ArtifactFile, ProjectEntry, invokeCopyDiagramToProject } from "../../ipc";
import AddToProjectPopover from "../shared/AddToProjectPopover";

interface DiagramsActionBarProps {
  selectedDiagrams: ArtifactFile[];
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

  const handleConfirmAddToProject = async (selectedProjects: ProjectEntry[]) => {
    try {
      setLoading(true);
      
      // Copy each diagram to each selected project
      const copyPromises: Promise<void>[] = [];
      for (const diagram of selectedDiagrams) {
        for (const project of selectedProjects) {
          copyPromises.push(
            invokeCopyDiagramToProject(diagram.path, project.path)
              .then(() => {
                // Convert Promise<string> to Promise<void>
              })
              .catch((error) => {
                console.error(`[DiagramsActionBar] Error copying ${diagram.name} to ${project.title}:`, error);
                throw error;
              })
          );
        }
      }

      await Promise.all(copyPromises);

      toaster.create({
        type: "success",
        title: "Diagrams added",
        description: `Added ${selectedDiagrams.length} diagram${
          selectedDiagrams.length !== 1 ? "s" : ""
        } to ${selectedProjects.length} project${selectedProjects.length !== 1 ? "s" : ""}`,
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
            <VStack align="stretch" gap={0}>
              <Box pb={1} mt={-0.5}>
                <HStack gap={1} justify="center">
                  <Text fontSize="xs" color="text.secondary">
                    {selectedDiagrams.length}
                  </Text>
                  <Icon fontSize="xs" color="text.secondary">
                    <LuNetwork />
                  </Icon>
                  <Text fontSize="xs" color="text.secondary">
                    selected
                  </Text>
                </HStack>
              </Box>
              <HStack gap={2}>
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
                  itemType="diagram"
                  itemCount={selectedDiagrams.length}
                  disabled={loading}
                  sourceFiles={selectedDiagrams.map(diagram => ({ path: diagram.path, name: diagram.name }))}
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
              </HStack>
            </VStack>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}

