import { useState } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { KitFile } from "../../ipc";

interface AgentsActionBarProps {
  selectedAgents: KitFile[];
  hasSelection: boolean;
  clearSelection: () => void;
  onAgentsUpdated: () => void;
}

export default function AgentsActionBar({
  selectedAgents,
  hasSelection,
  clearSelection,
  onAgentsUpdated,
}: AgentsActionBarProps) {
  const [loading, setLoading] = useState(false);

  if (!hasSelection) {
    return null;
  }

  const handleDelete = async () => {
    try {
      setLoading(true);
      // TODO: Implement delete functionality
      // await Promise.all(selectedAgents.map(agent => invokeDeleteAgent(agent.path)));

      toaster.create({
        type: "error",
        title: "Agents deleted",
        description: `${selectedAgents.length} agent${
          selectedAgents.length !== 1 ? "s" : ""
        } deleted`,
      });

      clearSelection();
      onAgentsUpdated();
    } catch (error) {
      console.error("[AgentsActionBar] Error in Delete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to delete agents: ${
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
      // await Promise.all(selectedAgents.map(agent => invokePublishAgentToLibrary(agent.path)));

      toaster.create({
        type: "success",
        title: "Agents published",
        description: `Published ${selectedAgents.length} agent${
          selectedAgents.length !== 1 ? "s" : ""
        } to library`,
      });

      clearSelection();
      onAgentsUpdated();
    } catch (error) {
      console.error("[AgentsActionBar] Error in Publish to Library:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to publish agents: ${
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
      // await Promise.all(selectedAgents.map(agent => invokeAddAgentToProject(agent.path)));

      toaster.create({
        type: "success",
        title: "Agents added",
        description: `Added ${selectedAgents.length} agent${
          selectedAgents.length !== 1 ? "s" : ""
        } to project`,
      });

      clearSelection();
      onAgentsUpdated();
    } catch (error) {
      console.error("[AgentsActionBar] Error in Add to Project:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to add agents to project: ${
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

