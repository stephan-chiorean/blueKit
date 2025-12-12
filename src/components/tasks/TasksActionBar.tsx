import { useState } from "react";
import { Button, HStack, Text, ActionBar, Portal } from "@chakra-ui/react";
import { LuCircleCheck, LuTrash2, LuPlay } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { Task } from "../../types/task";
import { invokeDbUpdateTask, invokeDbDeleteTask } from "../../ipc";

interface TasksActionBarProps {
  selectedTasks: Task[];
  hasSelection: boolean;
  clearSelection: () => void;
  onTasksUpdated: () => void;
}

export default function TasksActionBar({
  selectedTasks,
  hasSelection,
  clearSelection,
  onTasksUpdated,
}: TasksActionBarProps) {
  const [loading, setLoading] = useState(false);

  if (!hasSelection) {
    return null;
  }

  const handleSetInProgress = async () => {
    try {
      setLoading(true);

      // Update each selected task to in_progress status
      await Promise.all(
        selectedTasks.map(task =>
          invokeDbUpdateTask(
            task.id,
            task.title,
            task.description,
            task.priority,
            task.tags,
            task.projectIds,
            'in_progress',
            task.complexity
          )
        )
      );

      toaster.create({
        type: "success",
        title: "Tasks updated",
        description: `Set ${selectedTasks.length} task${
          selectedTasks.length !== 1 ? "s" : ""
        } to In Progress`,
      });

      clearSelection();
      onTasksUpdated();
    } catch (error) {
      console.error("[TasksActionBar] Error in Set to In Progress:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to update tasks: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);

      // Update each selected task to completed status
      await Promise.all(
        selectedTasks.map(task =>
          invokeDbUpdateTask(
            task.id,
            task.title,
            task.description,
            task.priority,
            task.tags,
            task.projectIds,
            'completed',
            task.complexity
          )
        )
      );

      toaster.create({
        type: "success",
        title: "Tasks completed",
        description: `Marked ${selectedTasks.length} task${
          selectedTasks.length !== 1 ? "s" : ""
        } as completed`,
      });

      clearSelection();
      onTasksUpdated();
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

  const handleDelete = async () => {
    try {
      setLoading(true);

      // Delete each selected task from database
      await Promise.all(
        selectedTasks.map(task => invokeDbDeleteTask(task.id))
      );

      toaster.create({
        type: "error",
        title: "Tasks deleted",
        description: `${selectedTasks.length} task${
          selectedTasks.length !== 1 ? "s" : ""
        } deleted`,
      });

      clearSelection();
      onTasksUpdated();
    } catch (error) {
      console.error("[TasksActionBar] Error in Delete:", error);
      toaster.create({
        type: "error",
        title: "Error",
        description: `Failed to delete tasks: ${
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
        <ActionBar.Positioner zIndex={1000}>
          <ActionBar.Content>
            <Button
              variant="surface"
              colorPalette="blue"
              size="sm"
              onClick={handleSetInProgress}
              disabled={loading}
            >
              <HStack gap={2}>
                <LuPlay />
                <Text>Set to In Progress</Text>
              </HStack>
            </Button>
            <ActionBar.Separator />
            <Button
              variant="surface"
              colorPalette="green"
              size="sm"
              onClick={handleComplete}
              disabled={loading}
            >
              <HStack gap={2}>
                <LuCircleCheck />
                <Text>Complete</Text>
              </HStack>
            </Button>
            <ActionBar.Separator />
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
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}
