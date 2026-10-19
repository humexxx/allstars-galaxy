"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { GripVertical, MoreHorizontal, Calendar } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskDialog } from "./task-dialog";
import { dayKey, dueTone, formatDueDay, type DueTone } from "./due-date";
import type { BoardColumn, BoardTask, TaskPriority } from "@/types";
import type { CreateBoardTaskData } from "@/schemas/board";
import { cn } from "@/lib/utils";

type BoardTaskCardProps = {
  task: BoardTask;
  isOverlay?: boolean;
  /** Every column, so the edit form can move the task. */
  columns?: BoardColumn[];
  /** The reader's IANA zone — due dates are days in it. */
  timeZone?: string;
  /** Today in that zone (`YYYY-MM-DD`), from the server so both renders agree. */
  today?: string;
  /** The task sits in a finished column: a past due date is not a warning. */
  isDone?: boolean;
  onDelete?: (taskId: string) => Promise<void>;
  onUpdate?: (taskId: string, data: CreateBoardTaskData) => Promise<void>;
};

const PRIORITY_STYLES: Record<TaskPriority, { bar: string; label: string; tone: string }> = {
  low: { bar: "bg-success", label: "Low", tone: "text-success" },
  medium: { bar: "bg-warning", label: "Medium", tone: "text-warning" },
  high: { bar: "bg-destructive", label: "High", tone: "text-destructive" },
};

const DUE_STYLES: Record<DueTone, { tone: string; prefix: string | null }> = {
  overdue: { tone: "font-medium text-destructive", prefix: "Overdue" },
  today: { tone: "font-medium text-warning", prefix: "Today" },
  tomorrow: { tone: "text-muted-foreground", prefix: "Tomorrow" },
  later: { tone: "text-muted-foreground", prefix: null },
};

export function BoardTaskCard({
  task,
  isOverlay,
  columns = [],
  timeZone,
  today,
  isDone = false,
  onDelete,
  onUpdate,
}: BoardTaskCardProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityStyle = task.priority ? PRIORITY_STYLES[task.priority] : null;
  const isOptimistic = task.id.startsWith("temp-");

  const due = task.dueDate
    ? {
        label: formatDueDay(task.dueDate, timeZone),
        ...DUE_STYLES[
          today && !isDone ? dueTone(dayKey(task.dueDate, timeZone), today) : "later"
        ],
      }
    : null;

  return (
    // Only the grip drags. With the whole card as the drag button, the card
    // was a `role="button"` that contained the options button, and a keyboard
    // user had no way to pick one without the other.
    //
    // The grip is a column of its own, so the title, the description and the
    // meta line all start at the same edge. With the grip inline before the
    // title, the title sat 18px to the right of everything under it.
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex gap-1 rounded-lg border bg-card py-3 pr-2 pl-2 shadow-sm transition-shadow",
        isDragging && "opacity-40",
        isOverlay && "shadow-lg ring-1 ring-primary/30",
        isOptimistic && "opacity-70",
        !isOverlay && "hover:shadow-md"
      )}
    >
      {priorityStyle ? (
        <span
          className={cn("absolute left-0 top-2 bottom-2 w-1 rounded-r-full", priorityStyle.bar)}
          aria-hidden="true"
        />
      ) : null}

      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag ${task.title}`}
        className={cn(
          "mt-0.5 h-5 shrink-0 cursor-grab touch-none self-start rounded-sm text-muted-foreground/60 opacity-60 transition hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100",
          isOverlay && "cursor-grabbing opacity-100 sm:opacity-100"
        )}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Heading level="h6" as="h3" className="min-w-0 break-words">
            {task.title}
          </Heading>
          {onDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-my-1.5 shrink-0 text-muted-foreground/60 opacity-60 transition hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 sm:-my-0.5 sm:size-6 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Options for ${task.title}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onUpdate ? (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    Edit task
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {task.description ? (
          <Text variant="small" className="line-clamp-2 break-words">
            {task.description}
          </Text>
        ) : null}

        {priorityStyle || due ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
            {priorityStyle ? (
              <span className={cn("inline-flex items-center gap-1 font-medium", priorityStyle.tone)}>
                <span className={cn("size-1.5 rounded-full", priorityStyle.bar)} aria-hidden="true" />
                {priorityStyle.label}
              </span>
            ) : null}
            {due ? (
              <span className={cn("inline-flex items-center gap-1", due.tone)}>
                <Calendar className="size-3" aria-hidden="true" />
                {due.prefix ? <span>{due.prefix} ·</span> : <span className="sr-only">Due</span>}
                <Mono>{due.label}</Mono>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {onUpdate ? (
        <TaskDialog
          columns={columns}
          task={task}
          open={editing}
          onOpenChange={setEditing}
          onSubmit={(data) => onUpdate(task.id, data)}
        />
      ) : null}

      {onDelete ? (
        // The column asks before it deletes; a card went at the first click
        // with no way back.
        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="break-words">Delete “{task.title}”?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              {/* The delete is optimistic: the card leaves at once and a
                  failure puts it back with a toast. */}
              <AlertDialogAction variant="destructive" onClick={() => void onDelete(task.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
