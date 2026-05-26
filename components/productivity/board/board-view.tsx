"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
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
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const [pendingMutations, setPendingMutations] = useState<number>(0);
  const isSyncing = pendingMutations > 0;
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const { setOpen: setSidebarOpen, open: isSidebarOpen } = useSidebar();
  // Remember the sidebar state so we can restore it when the user collapses the board.
  const sidebarStateBeforeExpand = useRef<boolean>(isSidebarOpen);

  useEffect(() => {
    if (isExpanded) {
      sidebarStateBeforeExpand.current = isSidebarOpen;
      setSidebarOpen(false);
    } else {
      setSidebarOpen(sidebarStateBeforeExpand.current);
    }
    // We intentionally only react to the expand toggle; sidebar state changes from
    // elsewhere should not loop back through this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);
  // Serialize reorder mutations: rapid drags get queued and applied in order
  // so the server never sees them out of sequence.
  const reorderQueue = useRef<Promise<void>>(Promise.resolve());

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

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = taskIndex.byId.get(taskId);
    if (!task) return;

    const destinationColumnId = over.id as string;
    if (task.columnId === destinationColumnId) return;

    const sourceColumnId = task.columnId;
    const previousTasks = tasks;

    // Optimistic UI update — server call is enqueued below.
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, columnId: destinationColumnId } : t))
    );

    setPendingMutations((n) => n + 1);
    reorderQueue.current = reorderQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await reorderBoardTaskAction({
            taskId,
            sourceColumnId,
            destinationColumnId,
            order: 0,
          });
        } catch {
          setTasks(previousTasks);
          toast.error("Failed to move task");
        } finally {
          setPendingMutations((n) => n - 1);
        }
      });
  };

  const handleCreateTask = async (data: CreateBoardTaskData): Promise<void> => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const columnTasks = taskIndex.byColumnId[data.columnId] ?? [];
    const nextOrder = columnTasks.length > 0 ? Math.max(...columnTasks.map((t) => t.order)) + 1 : 0;
    const optimistic = buildOptimisticTask(data, tempId, nextOrder);

    setTasks((prev) => [...prev, optimistic]);

    try {
      setPendingMutations((n) => n + 1);
      const result = await createBoardTaskAction(data);
      if (result.success) {
        setTasks((prev) => prev.map((t) => (t.id === tempId ? result.data : t)));
      }
    } catch (error) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      toast.error("Failed to create task");
      throw error;
    } finally {
      setPendingMutations((n) => n - 1);
    }
  };

  const handleCreateColumn = async (data: CreateBoardColumnData): Promise<void> => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic = buildOptimisticColumn(data, tempId);

    setColumns((prev) => [...prev, optimistic]);

    try {
      setPendingMutations((n) => n + 1);
      const result = await createBoardColumnAction(data);
      if (result.success) {
        setColumns((prev) => prev.map((c) => (c.id === tempId ? result.data : c)));
      }
    } catch (error) {
      setColumns((prev) => prev.filter((c) => c.id !== tempId));
      toast.error("Failed to create column");
      throw error;
    } finally {
      setPendingMutations((n) => n - 1);
    }
  };

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      setPendingMutations((n) => n + 1);
      await deleteBoardTaskAction(taskId);
    } catch {
      setTasks(previous);
      toast.error("Failed to delete task");
    } finally {
      setPendingMutations((n) => n - 1);
    }
  };

  const handleDeleteColumn = async (columnId: string): Promise<void> => {
    const previous = columns;
    setColumns((prev) => prev.filter((c) => c.id !== columnId));

    try {
      setPendingMutations((n) => n + 1);
      await deleteBoardColumnAction(columnId);
    } catch {
      setColumns(previous);
      toast.error("Failed to delete column");
    } finally {
      setPendingMutations((n) => n - 1);
    }
  };

  const nextColumnOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) + 1 : 0;
  const isDraggingTask = activeTask !== null;

  return (
    <div
      // The viewport-escape trick: width:100vw + negative margin centers a wider
      // element than its parent's max-width allows. Combined with closing the
      // sidebar, the board really fills the screen.
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4",
        isExpanded && "w-screen -ml-[calc(50vw-50%)]"
      )}
    >
      <header
        className={cn(
          "flex flex-wrap items-start justify-between gap-3",
          isExpanded && "px-4 sm:px-6 lg:px-8"
        )}
      >
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? "Collapse board" : "Expand board"}
            title={isExpanded ? "Collapse board" : "Expand board"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
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
          <div
            className={cn(
              "-mx-1 flex min-h-0 flex-1 gap-3 overflow-x-auto px-1 pb-2",
              isExpanded && "px-4 sm:px-6 lg:px-8"
            )}
          >
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
