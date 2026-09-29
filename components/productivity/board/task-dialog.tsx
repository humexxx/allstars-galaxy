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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
              <Plus />
              Add task
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Create new task"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Change the details or move it to another column." : "Add a new task to your board."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              id="title"
              placeholder="Task title"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            <FieldError errors={[errors.title]} />
          </Field>

          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea
              id="description"
              placeholder="Task description (optional)"
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldError errors={[errors.description]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.columnId}>
              <FieldLabel htmlFor="columnId">Column</FieldLabel>
              <Controller
                control={control}
                name="columnId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="columnId"
                      className="w-full"
                      aria-invalid={!!errors.columnId}
                    >
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
              <FieldError errors={[errors.columnId]} />
            </Field>

            <Field data-invalid={!!errors.priority}>
              <FieldLabel htmlFor="priority">Priority</FieldLabel>
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
                    <SelectTrigger
                      id="priority"
                      className="w-full"
                      aria-invalid={!!errors.priority}
                    >
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
              <FieldError errors={[errors.priority]} />
            </Field>
          </div>

          <Field data-invalid={!!errors.dueDate}>
            <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
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
                  aria-invalid={!!errors.dueDate}
                />
              )}
            />
            <FieldError errors={[errors.dueDate]} />
          </Field>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
