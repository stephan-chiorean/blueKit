import { useState, useEffect } from "react";
import { Button, HStack, Text, ActionBar, Portal, Box, VStack, Icon } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen, LuPackage, LuBot, LuNetwork, LuPencil, LuUpload } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { useSelection } from "../../contexts/SelectionContext";
import { Project, invokeCopyKitToProject, invokeCopyWalkthroughToProject, invokeCopyDiagramToProject, deleteResources } from "../../ipc";
import AddToProjectPopover from "./AddToProjectPopover";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import EditResourceMetadataModal from "./EditResourceMetadataModal";
import PublishToLibraryDialog from "../library/PublishToLibraryDialog";

export default function GlobalActionBar() {
  const { selectedItems, hasArtifactSelection, hasTaskSelection, clearSelection, getItemsByType } = useSelection();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Sync isOpen with hasArtifactSelection and force close when hasArtifactSelection becomes false
  // Hide when tasks are selected (TasksActionBar takes priority)
  useEffect(() => {
    if (hasArtifactSelection && !hasTaskSelection) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [hasArtifactSelection, hasTaskSelection]);

  // Don't render anything if there's no artifact selection, or if there are task selections
  if (!hasArtifactSelection || hasTaskSelection || !isOpen) {
    return null;
  }

  const kits = getItemsByType('Kit');
  const walkthroughs = getItemsByType('Walkthrough');
  const agents = getItemsByType('Agent');
  const diagrams = getItemsByType('Diagram');

  const totalCount = selectedItems.length;

  // Build selection summary with icons
  const getSelectionSummary = () => {
    const parts: { count: number; label: string; icon: React.ReactNode }[] = [];

    if (kits.length > 0) {
      parts.push({ count: kits.length, label: kits.length === 1 ? 'kit' : 'kits', icon: <LuPackage /> });
    }
    if (walkthroughs.length > 0) {
      parts.push({ count: walkthroughs.length, label: walkthroughs.length === 1 ? 'walkthrough' : 'walkthroughs', icon: <LuBookOpen /> });
    }
    if (agents.length > 0) {
      parts.push({ count: agents.length, label: agents.length === 1 ? 'agent' : 'agents', icon: <LuBot /> });
    }
    if (diagrams.length > 0) {
      parts.push({ count: diagrams.length, label: diagrams.length === 1 ? 'diagram' : 'diagrams', icon: <LuNetwork /> });
    }

    return parts;
  };

  const selectionSummary = getSelectionSummary();

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      
      // Extract file paths from selected items
      const filePaths = selectedItems
        .map(item => item.path)
        .filter((path): path is string => path !== undefined);

      if (filePaths.length === 0) {
        toaster.create({
          type: "error",
          title: "Error",
          description: "No valid file paths found for deletion",
        });
        return;
      }

      await deleteResources(filePaths);

      toaster.create({
        type: "success",
        title: "Resources deleted",
        description: `${totalCount} resource${
          totalCount !== 1 ? "s" : ""
        } deleted successfully`,
      });

      clearSelection();
    } catch (error) {
      console.error("[GlobalActionBar] Error in Delete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to delete resources: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (selectedItems.length === 1) {
      setEditModalOpen(true);
    }
  };

  const handleEditUpdated = () => {
    // File watcher will automatically update the UI
    // No need to manually refresh
  };

  const handlePublishToLibrary = () => {
    setPublishDialogOpen(true);
  };

  const handlePublishComplete = () => {
    clearSelection();
  };

  const handleConfirmAddToProject = async (selectedProjects: Project[]) => {
    try {
      setLoading(true);

      const copyPromises: Promise<void>[] = [];

      // Copy kits
      for (const kit of kits) {
        for (const project of selectedProjects) {
          if (kit.path) {
            copyPromises.push(
              invokeCopyKitToProject(kit.path, project.path)
                .then(() => {})
                .catch((error) => {
                  console.error(`[GlobalActionBar] Error copying kit ${kit.name} to ${project.title}:`, error);
                  throw error;
                })
            );
          }
        }
      }

      // Copy walkthroughs
      for (const walkthrough of walkthroughs) {
        for (const project of selectedProjects) {
          if (walkthrough.path) {
            copyPromises.push(
              invokeCopyWalkthroughToProject(walkthrough.path, project.path)
                .then(() => {})
                .catch((error) => {
                  console.error(`[GlobalActionBar] Error copying walkthrough ${walkthrough.name} to ${project.title}:`, error);
                  throw error;
                })
            );
          }
        }
      }

      // Copy agents (TODO: Implement invokeCopyAgentToProject)
      if (agents.length > 0) {
        console.warn(`[GlobalActionBar] Agent copying not yet implemented. Skipping ${agents.length} agents.`);
      }

      // Copy diagrams
      for (const diagram of diagrams) {
        for (const project of selectedProjects) {
          if (diagram.path) {
            copyPromises.push(
              invokeCopyDiagramToProject(diagram.path, project.path)
                .then(() => {})
                .catch((error) => {
                  console.error(`[GlobalActionBar] Error copying diagram ${diagram.name} to ${project.title}:`, error);
                  throw error;
                })
            );
          }
        }
      }

      await Promise.all(copyPromises);

      toaster.create({
        type: "success",
        title: "Artifacts added",
        description: `Added ${totalCount} artifact${
          totalCount !== 1 ? "s" : ""
        } to ${selectedProjects.length} project${selectedProjects.length !== 1 ? "s" : ""}`,
      });

      clearSelection();
    } catch (error) {
      console.error("[GlobalActionBar] Error in Add to Project:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to add artifacts to project: ${
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
        <ActionBar.Positioner zIndex={1000}>
          <ActionBar.Content>
            <VStack align="stretch" gap={0}>
              <Box pb={1} mt={-0.5}>
                <HStack gap={1.5} justify="center" wrap="wrap">
                  {selectionSummary.map((part, index) => (
                    <HStack key={index} gap={1}>
                      {index > 0 && (
                        <Text fontSize="xs" color="text.secondary">
                          •
                        </Text>
                      )}
                      <Text fontSize="xs" color="text.secondary">
                        {part.count}
                      </Text>
                      <Icon fontSize="xs" color="text.secondary">
                        {part.icon}
                      </Icon>
                    </HStack>
                  ))}
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
                  onClick={handleDeleteClick}
                  disabled={loading}
                >
                  <HStack gap={2}>
                    <LuTrash2 />
                    <Text>Delete</Text>
                  </HStack>
                </Button>
                {selectedItems.length === 1 && (
                  <>
                    <ActionBar.Separator />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditClick}
                      disabled={loading}
                    >
                      <HStack gap={2}>
                        <LuPencil />
                        <Text>Edit</Text>
                      </HStack>
                    </Button>
                  </>
                )}
                <ActionBar.Separator />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePublishToLibrary}
                  disabled={loading}
                >
                  <HStack gap={2}>
                    <LuUpload />
                    <Text>Publish to Library</Text>
                  </HStack>
                </Button>
                <AddToProjectPopover
                  onConfirm={handleConfirmAddToProject}
                  itemCount={totalCount}
                  sourceFiles={selectedItems.map(item => ({
                    path: item.path || '',
                    name: item.name,
                    type: item.type.toLowerCase() as 'kit' | 'walkthrough' | 'diagram' | 'agent'
                  }))}
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

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        items={selectedItems}
      />

      <EditResourceMetadataModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        item={selectedItems.length === 1 ? selectedItems[0] : null}
        onUpdated={handleEditUpdated}
      />

      <PublishToLibraryDialog
        isOpen={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        items={selectedItems.map(item => ({
          path: item.path,
          name: item.name,
          type: item.type,
          projectId: item.projectId,
          projectPath: item.projectPath,
        }))}
        onPublished={handlePublishComplete}
      />
    </ActionBar.Root>
  );
}
