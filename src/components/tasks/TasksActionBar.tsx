import { useState } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuCircleCheck, LuTrash2 } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { Task } from "../../types/task";

interface TasksActionBarProps {
  selectedTasks: Task[];
  hasSelection: boolean;
  clearSelection: () => void;
  removeTask: (id: string) => void;
}

export default function TasksActionBar({
  selectedTasks,
  hasSelection,
  clearSelection,
  removeTask,
}: TasksActionBarProps) {
  const [loading, setLoading] = useState(false);

  if (!hasSelection) {
    return null;
  }

  const handleComplete = async () => {
    try {
      setLoading(true);
      
      // For now, just show a success message
      // In the future, this would update the task status in state
      toaster.create({
        type: "success",
        title: "Tasks completed",
        description: `Marked ${selectedTasks.length} task${
          selectedTasks.length !== 1 ? "s" : ""
        } as completed`,
      });

      // Clear selection after operation
      clearSelection();
    } catch (error) {
      console.error("[TasksActionBar] Error in Complete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to complete tasks: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    console.log(
      "[TasksActionBar] Delete clicked, tasks to remove:",
      selectedTasks
    );
    // Remove selected tasks from selection
    selectedTasks.forEach((task) => {
      removeTask(task.id);
    });

    toaster.create({
      type: "info",
      title: "Selection cleared",
      description: `Cleared ${selectedTasks.length} task${
        selectedTasks.length !== 1 ? "s" : ""
      } from selection`,
    });
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
              variant="surface"
              colorPalette="green"
              size="sm"
              onClick={handleComplete}
              loading={loading}
            >
              <HStack gap={2}>
                <LuCircleCheck />
                <Text>Complete</Text>
              </HStack>
            </Button>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}
