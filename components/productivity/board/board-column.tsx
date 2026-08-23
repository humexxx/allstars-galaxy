"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BoardTaskCard } from "./board-task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/typography";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import type { BoardColumn as BoardColumnType, BoardTask } from "@/types";
import type { CreateBoardTaskData } from "@/schemas/board";
import { TaskDialog } from "./task-dialog";
import { cn } from "@/lib/utils";

type BoardColumnProps = {
  column: BoardColumnType;
  /** Every column, so a task can be moved from its own edit form. */
  columns: BoardColumnType[];
  tasks: BoardTask[];
  onCreateTask: (data: CreateBoardTaskData) => Promise<void>;
  onRenameColumn: (columnId: string, name: string) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onUpdateTask: (taskId: string, data: CreateBoardTaskData) => Promise<void>;
  isDimmed?: boolean;
};

export function BoardColumn({
  column,
  columns,
  tasks,
  onCreateTask,
  onRenameColumn,
  onDeleteColumn,
  onDeleteTask,
  onUpdateTask,
  isDimmed = false,
}: BoardColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(column.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commitRename = async (): Promise<void> => {
    const name = draftName.trim();
    setRenaming(false);
    if (!name || name === column.name) {
      setDraftName(column.name);
      return;
    }
    await onRenameColumn(column.id, name).catch(() => setDraftName(column.name));
  };

  return (
    <div
      className={cn(
        "flex h-full min-w-72 flex-1 flex-col rounded-xl border bg-muted/30 transition-colors",
        isDimmed && !isOver && "opacity-60",
        isOver && "border-primary/60 bg-primary/5 ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {renaming ? (
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraftName(column.name);
                  setRenaming(false);
                }
              }}
              className="h-7 w-40 text-sm"
              aria-label="Column name"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(column.name);
                setRenaming(true);
              }}
              className="cursor-pointer truncate text-left outline-none focus-visible:underline"
              title="Rename column"
            >
              <Heading level="h6" as="h3">{column.name}</Heading>
            </button>
          )}
          <Badge variant="secondary" className="h-5 rounded-full px-2 text-2xs font-medium">
            {tasks.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <TaskDialog
            columns={columns}
            defaultColumnId={column.id}
            onSubmit={onCreateTask}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
              <span className="sr-only">Add task</span>
            </Button>
          </TaskDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Column options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setDraftName(column.name);
                  setRenaming(true);
                }}
              >
                Rename column
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmingDelete(true)}
                className="text-destructive"
              >
                Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2",
          tasks.length === 0 && "min-h-32"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <BoardTaskCard
              key={task.id}
              task={task}
              columns={columns}
              onDelete={onDeleteTask}
              onUpdate={onUpdateTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 ? (
          <div
            className={cn(
              "m-1 flex flex-1 items-center justify-center rounded-lg border border-dashed text-xs transition-colors",
              isOver
                ? "border-primary/60 bg-primary/5 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            {isOver ? "Drop here" : "No tasks yet"}
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete “{column.name}”?</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              {tasks.length > 0
                ? `Its ${tasks.length} ${tasks.length === 1 ? "task goes" : "tasks go"} with it. This cannot be undone.`
                : "The column is empty, so nothing else goes with it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDeleteColumn(column.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

