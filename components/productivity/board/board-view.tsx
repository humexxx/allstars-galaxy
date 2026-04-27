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
  createBoardColumnAction,
  createBoardTaskAction,
  deleteBoardColumnAction,
  deleteBoardTaskAction,
  reorderBoardTaskAction,
} from "@/app/actions/board";
import type { BoardColumn as BoardColumnType, BoardTask } from "@/types";
import type { CreateBoardColumnData, CreateBoardTaskData } from "@/schemas/board";
import { toast } from "sonner";

type BoardViewProps = {
  initialColumns: BoardColumnType[];
  initialTasks: BoardTask[];
};

function buildOptimisticTask(data: CreateBoardTaskData, tempId: string, order: number): BoardTask {
  return {
    id: tempId,
    userId: "",
    columnId: data.columnId,
    roadPathId: data.roadPathId ?? null,
    title: data.title,
    description: data.description ?? null,
    priority: data.priority ?? null,
    order,
    dueDate: data.dueDate ?? null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function buildOptimisticColumn(data: CreateBoardColumnData, tempId: string): BoardColumnType {
  return {
    id: tempId,
    userId: "",
    name: data.name,
    order: data.order,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function BoardView({ initialColumns, initialTasks }: BoardViewProps): React.ReactElement {
  const [columns, setColumns] = useState<BoardColumnType[]>(initialColumns);
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const taskIndex = useMemo(() => {
    const byId = new Map<string, BoardTask>();
    const byColumnId: Record<string, BoardTask[]> = {};
    for (const task of tasks) {
      byId.set(task.id, task);
      if (!byColumnId[task.columnId]) {
        byColumnId[task.columnId] = [];
      }
      byColumnId[task.columnId].push(task);
    }
    return { byId, byColumnId };
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent): void => {
    const task = taskIndex.byId.get(event.active.id as string);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = taskIndex.byId.get(taskId);
    if (!task) return;

    const destinationColumnId = over.id as string;
    if (task.columnId === destinationColumnId) return;

    const previousTasks = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, columnId: destinationColumnId } : t))
    );

    try {
      setIsSyncing(true);
      await reorderBoardTaskAction({
        taskId,
        sourceColumnId: task.columnId,
        destinationColumnId,
        order: 0,
      });
    } catch {
      setTasks(previousTasks);
      toast.error("Failed to move task");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateTask = async (data: CreateBoardTaskData): Promise<void> => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const columnTasks = taskIndex.byColumnId[data.columnId] ?? [];
    const nextOrder = columnTasks.length > 0 ? Math.max(...columnTasks.map((t) => t.order)) + 1 : 0;
    const optimistic = buildOptimisticTask(data, tempId, nextOrder);

    setTasks((prev) => [...prev, optimistic]);

    try {
      setIsSyncing(true);
      const result = await createBoardTaskAction(data);
      if (result.success) {
        setTasks((prev) => prev.map((t) => (t.id === tempId ? result.data : t)));
      }
    } catch (error) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      toast.error("Failed to create task");
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateColumn = async (data: CreateBoardColumnData): Promise<void> => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic = buildOptimisticColumn(data, tempId);

    setColumns((prev) => [...prev, optimistic]);

    try {
      setIsSyncing(true);
      const result = await createBoardColumnAction(data);
      if (result.success) {
        setColumns((prev) => prev.map((c) => (c.id === tempId ? result.data : c)));
      }
    } catch (error) {
      setColumns((prev) => prev.filter((c) => c.id !== tempId));
      toast.error("Failed to create column");
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      setIsSyncing(true);
      await deleteBoardTaskAction(taskId);
    } catch {
      setTasks(previous);
      toast.error("Failed to delete task");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteColumn = async (columnId: string): Promise<void> => {
    const previous = columns;
    setColumns((prev) => prev.filter((c) => c.id !== columnId));

    try {
      setIsSyncing(true);
      await deleteBoardColumnAction(columnId);
    } catch {
      setColumns(previous);
      toast.error("Failed to delete column");
    } finally {
      setIsSyncing(false);
    }
  };

  const nextColumnOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) + 1 : 0;
  const isDraggingTask = activeTask !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Task Board</h1>
            {isSyncing ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="size-3 animate-spin" />
                Syncing
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">Manage your tasks with a visual board</p>
        </div>
        <div className="flex items-center gap-2">
          {columns.length > 0 ? (
            <CreateTaskDialog columns={columns} onCreate={handleCreateTask} />
          ) : null}
          <CreateColumnDialog onCreate={handleCreateColumn} nextOrder={nextColumnOrder} />
        </div>
      </header>

      {columns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">No columns yet. Create your first column to start.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="-mx-1 flex min-h-0 flex-1 gap-3 overflow-x-auto px-1 pb-2">
            <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {columns.map((column) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  tasks={taskIndex.byColumnId[column.id] ?? []}
                  onCreateTask={handleCreateTask}
                  onDeleteColumn={handleDeleteColumn}
                  onDeleteTask={handleDeleteTask}
                  isDimmed={isDraggingTask && activeTask?.columnId !== column.id}
                />
              ))}
            </SortableContext>
          </div>

          <DragOverlay>
            {activeTask ? <BoardTaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
