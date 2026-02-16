"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { BoardColumn } from "./board-column";
import { BoardTaskCard } from "./board-task-card";
import { CreateColumnDialog } from "./create-column-dialog";
import { CreateTaskDialog } from "./create-task-dialog";
import { RefreshCw } from "lucide-react";
import {
  getBoardDataAction,
  reorderBoardTaskAction,
} from "@/app/actions/board";
import type { BoardColumn as BoardColumnType, BoardTask } from "@/types";
import { toast } from "sonner";

type BoardViewProps = {
  initialColumns: BoardColumnType[];
  initialTasks: BoardTask[];
};

export function BoardView({ initialColumns, initialTasks }: BoardViewProps) {
  const [columns, setColumns] = useState<BoardColumnType[]>(initialColumns);
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await getBoardDataAction();

      if (result.success) {
        setColumns(result.data.columns);
        setTasks(result.data.tasks);
      }
    } catch (error) {
      toast.error("Failed to load board data");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const tasksByColumnId = useMemo(() => {
    const grouped: Record<string, BoardTask[]> = {};
    for (const task of tasks) {
      if (!grouped[task.columnId]) {
        grouped[task.columnId] = [];
      }
      grouped[task.columnId].push(task);
    }
    return grouped;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const destinationColumnId = over.id as string;
    if (task.columnId === destinationColumnId) return;

    const previousTasks = tasks;
    const updatedTasks = previousTasks.map((t) =>
      t.id === taskId ? { ...t, columnId: destinationColumnId } : t
    );
    setTasks(updatedTasks);

    try {
      await reorderBoardTaskAction({
        taskId,
        sourceColumnId: task.columnId,
        destinationColumnId,
        order: 0, // Will be recalculated by the service
      });
      toast.success("Task moved");
    } catch (error) {
      // Revert on error
      setTasks(previousTasks);
      toast.error("Failed to move task");
      console.error(error);
    }
  };

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">No columns yet. Create your first column.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <CreateTaskDialog columns={columns} onSuccess={loadData} />
          <CreateColumnDialog onSuccess={loadData} />
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mt-2" /> : null}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  tasks={tasksByColumnId[column.id] ?? []}
                  onRefresh={loadData}
                  isLoadingTasks={isLoading}
                />
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeTask && <BoardTaskCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
