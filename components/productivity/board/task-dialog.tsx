"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createBoardTaskSchema, type CreateBoardTaskData } from "@/schemas/board";
import { toast } from "sonner";
import type { BoardColumn, BoardTask, TaskPriority } from "@/types";

/** `Date` in, `YYYY-MM-DD` out — what DateField speaks. */
function toDay(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** The other way, at local noon so a timezone cannot walk it back a day. */
function fromDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

type TaskDialogProps = {
  columns: BoardColumn[];
  onSubmit: (data: CreateBoardTaskData) => Promise<void>;
  /** Present = editing that task; absent = creating a new one. */
  task?: BoardTask;
  defaultColumnId?: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * One form for creating and editing a task.
 *
 * Editing had no UI at all — `updateBoardTaskAction` was written and tested
 * and nothing called it, so a typo in a title meant deleting the card and
 * writing it again. The due date is here for the same reason: the card has
 * always rendered one and no form ever offered to set it.
 */
export function TaskDialog({
  columns,
  onSubmit,
  task,
  defaultColumnId,
  children,
  open: controlledOpen,
  onOpenChange,
}: TaskDialogProps): React.ReactElement {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isEdit = task !== undefined;

  const initial = (): CreateBoardTaskData => ({
    columnId: task?.columnId ?? defaultColumnId ?? columns[0]?.id ?? "",
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? null,
    dueDate: task?.dueDate ? new Date(task.dueDate) : null,
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateBoardTaskData>({
    resolver: zodResolver(createBoardTaskSchema),
    defaultValues: initial(),
  });

  // Reopening on a different task has to refill the fields; a dialog that
  // keeps the last one edited is worse than no dialog.
  useEffect(() => {
    if (open) reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const submit = async (data: CreateBoardTaskData): Promise<void> => {
    try {
      await onSubmit(data);
      toast.success(isEdit ? "Task updated" : "Task created");
      setOpen(false);
      if (!isEdit) reset(initial());
    } catch {
      // The parent already reported it.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children !== undefined || !isEdit ? (
        <DialogTrigger asChild>
          {children || (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Create New Task"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Change the details or move it to another column." : "Add a new task to your board"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Task title" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Task description (optional)"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="columnId">Column</Label>
              <Controller
                control={control}
                name="columnId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="columnId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.columnId && (
                <p className="text-sm text-destructive">{errors.columnId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? null : (value as TaskPriority))
                    }
                  >
                    <SelectTrigger id="priority" className="w-full">
                      <SelectValue placeholder="No priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Controller
              control={control}
              name="dueDate"
              render={({ field }) => (
                <DateField
                  id="dueDate"
                  value={toDay(field.value)}
                  onChange={(day) => field.onChange(fromDay(day))}
                  placeholder="No due date"
                  clearable
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
