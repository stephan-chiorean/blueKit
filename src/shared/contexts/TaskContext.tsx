import { createContext, useContext, useMemo, useState } from 'react';

type TaskItem = {
  id: string;
  text: string;
  completed: boolean;
};

type TaskContextValue = {
  tasks: TaskItem[];
  activeTasks: TaskItem[];
  completedTasks: TaskItem[];
  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

function createTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function useTaskState(): TaskContextValue {
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const addTask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setTasks((prev) => [
      {
        id: createTaskId(),
        text: trimmed,
        completed: false,
      },
      ...prev,
    ]);
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.completed), [tasks]);

  return {
    tasks,
    activeTasks,
    completedTasks,
    addTask,
    toggleTask,
    deleteTask,
  };
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const value = useTaskState();
  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

/**
 * Provides task state for legacy task dialogs.
 * If no provider is mounted, this hook falls back to isolated local state.
 */
export function useTasks(): TaskContextValue {
  const context = useContext(TaskContext);
  const fallback = useTaskState();
  return context ?? fallback;
}
