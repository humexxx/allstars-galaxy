"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { BoardColumn } from "./board-column";
import { BoardTaskCard } from "./board-task-card";
import { CreateColumnDialog } from "./create-column-dialog";
import { TaskDialog } from "./task-dialog";
import { Columns3, Maximize2, Minimize2 } from "lucide-react";
import { PageHeader } from "@/components/portal/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  createBoardColumnAction,
  createBoardTaskAction,
  deleteBoardColumnAction,
  deleteBoardTaskAction,
  reorderBoardTaskAction,
  updateBoardColumnAction,
  updateBoardTaskAction,
} from "@/app/actions/board";
import type { BoardColumn as BoardColumnType, BoardTask } from "@/types";
import type { CreateBoardColumnData, CreateBoardTaskData } from "@/schemas/board";
import { runAction } from "@/lib/actions/run";
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

  // The actions revalidate this page, so fresh server props arrive after every
  // mutation (and after edits made elsewhere, e.g. a road path's task). Adopt
  // them once nothing is in flight; mid-flight they would stomp the
  // optimistic state still waiting on its own response.
  const [serverData, setServerData] = useState({ initialColumns, initialTasks });
  if (
    pendingMutations === 0 &&
    (serverData.initialColumns !== initialColumns || serverData.initialTasks !== initialTasks)
  ) {
    setServerData({ initialColumns, initialTasks });
    setColumns(initialColumns);
    setTasks(initialTasks);
  }
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const { setOpen: setSidebarOpen, open: isSidebarOpen } = useSidebar();
  // Put the sidebar back the way the user had it. Set while expanded only.
  const restoreSidebar = useRef<(() => void) | null>(null);

  // In the toggle, not an effect on `isExpanded`: the effect also ran on mount
  // (rewriting the sidebar cookie) and never on the way out.
  const toggleExpanded = (): void => {
    if (isExpanded) {
      restoreSidebar.current?.();
      restoreSidebar.current = null;
    } else {
      const wasOpen = isSidebarOpen;
      restoreSidebar.current = () => setSidebarOpen(wasOpen);
      setSidebarOpen(false);
    }
    setIsExpanded(!isExpanded);
  };

  // Leaving the page while expanded must not strand the sidebar collapsed.
  useEffect(() => () => restoreSidebar.current?.(), []);
  // Serialize reorder mutations: rapid drags get queued and applied in order
  // so the server never sees them out of sequence.
  const reorderQueue = useRef<Promise<void>>(Promise.resolve());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    // Space picks a card up, the arrows move it, Space drops it.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
    // The server hands these back ordered; an optimistic move does not, and a
    // column that renders in insertion order shows the drop landing in the
    // wrong place until the next load.
    for (const list of Object.values(byColumnId)) {
      list.sort((a, b) => a.order - b.order);
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

    // A drop lands either on a column's empty space or on another task. Only
    // the first was handled, so reordering inside a column was impossible and
    // every move across columns went to position 0 regardless of where it was
    // released — the service has always taken an index, nothing ever sent one.
    const overId = over.id as string;
    const overTask = taskIndex.byId.get(overId);
    const destinationColumnId = overTask ? overTask.columnId : overId;
    if (!columns.some((c) => c.id === destinationColumnId)) return;

    const sourceColumnId = task.columnId;
    const sameColumn = sourceColumnId === destinationColumnId;
    // The index is taken against the destination column AS IT STANDS, with the
    // dragged card still in it — that is the convention `reorderTask` uses.
    // Measuring against the list with the card removed made every downward
    // move land one slot short, and made the shortest one (onto the next card)
    // compare equal to where it already was and get dropped by the guard.
    const column = taskIndex.byColumnId[destinationColumnId] ?? [];
    const at = overTask ? column.findIndex((t) => t.id === overTask.id) : -1;
    // Released on the column itself rather than on a card: the end of the list.
    const end = sameColumn ? Math.max(0, column.length - 1) : column.length;
    const newOrder = at === -1 ? end : at;

    if (sameColumn && task.order === newOrder) return;

    // Undo only this move. Restoring a whole-array snapshot taken here also
    // undid anything else that changed while the request was in flight.
    const sourceOrders = new Map(
      (taskIndex.byColumnId[sourceColumnId] ?? []).map((t) => [t.id, t.order])
    );
    const destinationOrders = new Map(column.map((t) => [t.id, t.order]));
    const rollback = (): void =>
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) return { ...t, columnId: sourceColumnId, order: task.order };
          const order = sourceOrders.get(t.id) ?? destinationOrders.get(t.id);
          return order === undefined ? t : { ...t, order };
        })
      );

    // Optimistic UI update — server call is enqueued below. BOTH columns are
    // renumbered: the service closes the gap the card leaves behind, and a
    // client that only renumbered the destination drifted out of step with it
    // until the next load.
    setTasks((prev) => {
      const moved = { ...task, columnId: destinationColumnId };
      const target = sameColumn ? column.filter((t) => t.id !== taskId) : [...column];
      target.splice(newOrder, 0, moved);
      const orders = new Map(target.map((t, i) => [t.id, i]));
      if (!sameColumn) {
        (taskIndex.byColumnId[sourceColumnId] ?? [])
          .filter((t) => t.id !== taskId)
          .forEach((t, i) => orders.set(t.id, i));
      }
      return prev.map((t) => {
        const order = orders.get(t.id);
        if (order === undefined) return t;
        return t.id === taskId ? { ...moved, order } : { ...t, order };
      });
    });

    setPendingMutations((n) => n + 1);
    reorderQueue.current = reorderQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const result = await reorderBoardTaskAction({
            taskId,
            sourceColumnId,
            destinationColumnId,
            order: newOrder,
          });
          if (!result.success) {
            rollback();
            toast.error(result.error || "Failed to move task");
          }
        } catch {
          rollback();
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
      } else {
        // The action reports failure in its return value, so throw and let the
        // one catch below roll back and report. Doing it here as well stacked
        // two toasts, the second of which discarded the server's message.
        throw new Error(result.error || "Failed to create task");
      }
    } catch (error) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      toast.error(error instanceof Error ? error.message : "Failed to create task");
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
      } else {
        throw new Error(result.error || "Failed to create column");
      }
    } catch (error) {
      setColumns((prev) => prev.filter((c) => c.id !== tempId));
      toast.error(error instanceof Error ? error.message : "Failed to create column");
      throw error;
    } finally {
      setPendingMutations((n) => n - 1);
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    data: CreateBoardTaskData
  ): Promise<void> => {
    const current = taskIndex.byId.get(taskId);
    if (!current) return;
    const restore = (): void =>
      setTasks((prev) => prev.map((t) => (t.id === taskId ? current : t)));
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              columnId: data.columnId,
              title: data.title,
              description: data.description ?? null,
              priority: data.priority ?? null,
              dueDate: data.dueDate ?? null,
            }
          : t
      )
    );

    try {
      setPendingMutations((n) => n + 1);
      // A column change is a move, not a field edit: `updateBoardTask` would
      // write the new columnId with the old `order`, leaving a hole in the
      // source column and a duplicate order in the destination. Reorder to
      // the end of the destination first, then save the other fields.
      if (current.columnId !== data.columnId) {
        const destinationCount = (taskIndex.byColumnId[data.columnId] ?? []).length;
        const moved = await reorderBoardTaskAction({
          taskId,
          sourceColumnId: current.columnId,
          destinationColumnId: data.columnId,
          order: destinationCount,
        });
        if (!moved.success) {
          toast.error(moved.error || "Failed to move task");
          throw new Error(moved.error || "Failed to move task");
        }
      }
      const result = await updateBoardTaskAction({ id: taskId, ...data });
      if (!result.success) {
        toast.error(result.error || "Failed to update task");
        throw new Error(result.error || "Failed to update task");
      }
    } catch (error) {
      restore();
      throw error;
    } finally {
      setPendingMutations((n) => n - 1);
    }
  };

  const handleRenameColumn = async (columnId: string, name: string): Promise<void> => {
    const previousName = columns.find((c) => c.id === columnId)?.name;
    if (previousName === undefined) return;
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name } : c)));

    try {
      setPendingMutations((n) => n + 1);
      const result = await updateBoardColumnAction({ id: columnId, name });
      if (!result.success) {
        toast.error(result.error || "Failed to rename column");
        throw new Error(result.error || "Failed to rename column");
      }
    } catch (error) {
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, name: previousName } : c))
      );
      throw error;
    } finally {
      setPendingMutations((n) => n - 1);
    }
  };

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    const removed = taskIndex.byId.get(taskId);
    if (!removed) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    setPendingMutations((n) => n + 1);
    const { ok } = await runAction(deleteBoardTaskAction(taskId), {
      failure: "Failed to delete task",
    });
    // Put back only the card that failed to go.
    if (!ok) setTasks((prev) => [...prev, removed]);
    setPendingMutations((n) => n - 1);
  };

  const handleDeleteColumn = async (columnId: string): Promise<void> => {
    const removedColumn = columns.find((c) => c.id === columnId);
    if (!removedColumn) return;
    const removedTasks = taskIndex.byColumnId[columnId] ?? [];
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    // board_tasks.column_id cascades, so the tasks are gone too. Leaving them
    // in state kept them counted and rendered by nothing.
    setTasks((prev) => prev.filter((t) => t.columnId !== columnId));

    setPendingMutations((n) => n + 1);
    const { ok } = await runAction(deleteBoardColumnAction(columnId), {
      failure: "Failed to delete column",
    });
    if (!ok) {
      setColumns((prev) => [...prev, removedColumn].sort((a, b) => a.order - b.order));
      setTasks((prev) => [...prev, ...removedTasks]);
    }
    setPendingMutations((n) => n - 1);
  };

  const nextColumnOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) + 1 : 0;
  const isDraggingTask = activeTask !== null;

  return (
    <div
      // The viewport-escape trick: width:100vw + negative margin centers a wider
      // element than its parent's max-width allows. Combined with closing the
      // sidebar, the board really fills the screen.
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-6",
        isExpanded && "w-screen -ml-[calc(50vw-50%)]"
      )}
    >
      <PageHeader
        className={cn(isExpanded && "px-4 sm:px-8 lg:px-12")}
        title="Task board"
        description="Manage your tasks with a visual board."
        badge={
          isSyncing ? (
            <Badge variant="secondary" role="status">
              <Spinner aria-hidden="true" />
              Syncing
            </Badge>
          ) : null
        }
        actions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleExpanded}
                  aria-label={isExpanded ? "Collapse board" : "Expand board"}
                >
                  {isExpanded ? <Minimize2 /> : <Maximize2 />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isExpanded ? "Collapse board" : "Expand board"}</TooltipContent>
            </Tooltip>
            {columns.length > 0 ? (
              <>
                <TaskDialog columns={columns} onSubmit={handleCreateTask} />
                <CreateColumnDialog onCreate={handleCreateColumn} nextOrder={nextColumnOrder} />
              </>
            ) : null}
          </>
        }
      />

      {columns.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Columns3}
          title="No columns yet"
          description="Create your first column to start."
          action={<CreateColumnDialog onCreate={handleCreateColumn} nextOrder={nextColumnOrder} />}
        />
      ) : (
        <DndContext
          // Without a fixed id dnd-kit numbers `aria-describedby` from a
          // module counter, and the server and the client land on different
          // numbers — a hydration mismatch on every load of this page.
          id="task-board"
          // Default rect-intersection resolves a drop to whichever droppable
          // overlaps most — and a column's rect contains every card in it, so
          // the column always won and a drop never named a card. Closest-corner
          // picks the nearest thing instead, which is how a card becomes a
          // drop target at all.
          collisionDetection={closestCorners}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              // `relative` is load-bearing: it makes the rail the containing
              // block for its absolutely-positioned descendants. Without it the
              // per-column `sr-only` labels resolve against SidebarInset (the
              // nearest positioned ancestor), escape this scroller's clip and
              // stretch the document to the rail's full scroll width — the whole
              // page scrolls sideways on phones. `min-w-0` does not fix it.
              "relative -mx-1 flex min-h-0 flex-1 gap-3 overflow-x-auto px-1 pb-2",
              isExpanded && "px-4 sm:px-8 lg:px-12"
            )}
          >
            <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {columns.map((column) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  columns={columns}
                  tasks={taskIndex.byColumnId[column.id] ?? []}
                  onCreateTask={handleCreateTask}
                  onRenameColumn={handleRenameColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
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
