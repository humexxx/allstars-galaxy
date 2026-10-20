"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BoardTaskCard } from "./board-task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/typography";
import { CircleCheck, MoreHorizontal, Plus } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  onUpdateTask: (taskId: string, data: CreateBoardTaskData) => Promise<string | undefined>;
  onSetDoneColumn: (columnId: string) => Promise<void>;
  /** Present on an earlier day's board: puts an open task on today's. */
  onMoveToToday?: (taskId: string) => Promise<void>;
  isDimmed?: boolean;
  /** The day's board this column is on. */
  day: string;
  /** The reader's zone and today in it, for the cards' due dates. */
  timeZone?: string;
  today?: string;
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
  onSetDoneColumn,
  onMoveToToday,
  isDimmed = false,
  day,
  timeZone,
  today,
}: BoardColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(column.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isOnlyColumn = columns.length <= 1;
  // Deleting it would leave nothing on the board able to be finished.
  const deleteBlocked = isOnlyColumn || column.isDone;

  const startRename = (): void => {
    setDraftName(column.name);
    setRenaming(true);
  };

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
              className="h-8 w-40"
              aria-label="Column name"
            />
          ) : (
            <Heading level="h6" as="h2" className="min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={startRename}
                    className="block max-w-full cursor-pointer truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {column.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Rename column</TooltipContent>
              </Tooltip>
            </Heading>
          )}
          {column.isDone ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0 text-success" tabIndex={0}>
                  <CircleCheck className="size-4" aria-hidden="true" />
                  <span className="sr-only">Done column</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>Tasks here are finished</TooltipContent>
            </Tooltip>
          ) : null}
          <Badge variant="secondary" className="tabular-nums">
            {tasks.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <TaskDialog
            columns={columns}
            day={day}
            defaultColumnId={column.id}
            onSubmit={onCreateTask}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Add task to ${column.name}`}
            >
              <Plus />
            </Button>
          </TaskDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Options for ${column.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={startRename}>Rename column</DropdownMenuItem>
              {!column.isDone ? (
                <DropdownMenuItem onSelect={() => void onSetDoneColumn(column.id)}>
                  Use as Done column
                </DropdownMenuItem>
              ) : null}
              {/* The last column cannot go: the page re-creates the default
                  three for a board with none, so deleting it brought back
                  Todo / Working / Done the moment the page revalidated. */}
              <DropdownMenuItem
                variant="destructive"
                disabled={deleteBlocked}
                onSelect={() => setConfirmingDelete(true)}
              >
                {isOnlyColumn
                  ? "Can’t delete the only column"
                  : column.isDone
                    ? "Can’t delete the Done column"
                    : "Delete column"}
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
              day={day}
              timeZone={timeZone}
              today={today}
              isDone={column.isDone}
              onDelete={onDeleteTask}
              onUpdate={onUpdateTask}
              onMoveToToday={column.isDone ? undefined : onMoveToToday}
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
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{column.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its tasks on every day go with it, not only the ones shown here. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            {/* Closing on click is right here: the delete is optimistic, so
                the column (and this dialog) leaves the board at once and a
                failure puts it back with a toast. */}
            <AlertDialogAction
              variant="destructive"
              onClick={() => void onDeleteColumn(column.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

