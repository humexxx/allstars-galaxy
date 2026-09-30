"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createRoadPathAction } from "@/app/actions/road-path";
import { createRoadPathSchema, type CreateRoadPathInput } from "@/schemas/road-path";
import type { RoadPathFrequency } from "@/types";

type CreateRoadPathDialogProps = {
  children?: React.ReactNode;
};

/** Today as YYYY-MM-DD, in the user's own zone. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Every field is in here, so the controls start controlled (a Checkbox fed
 * `undefined` flips from uncontrolled to controlled on its first click) and
 * `reset()` puts every one of them back.
 */
function emptyValues(): CreateRoadPathInput {
  return {
    title: "",
    description: "",
    targetValue: undefined,
    unit: "",
    // The schema requires a start date. Leaving the field empty used to send
    // `new Date("")` — an Invalid Date the transform happily produced and
    // nothing downstream rejected until the insert.
    startDate: today(),
    targetDate: null,
    autoCreateTasks: false,
    taskFrequency: null,
    createFirstTask: true,
  };
}

export function CreateRoadPathDialog({ children }: CreateRoadPathDialogProps) {
  const [open, setOpen] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateRoadPathInput>({
    resolver: zodResolver(createRoadPathSchema),
    defaultValues: emptyValues(),
  });

  const autoCreateTasks = useWatch({ control, name: "autoCreateTasks" });
  const taskFrequency = useWatch({ control, name: "taskFrequency" });

  const onSubmit = async (data: CreateRoadPathInput): Promise<void> => {
    try {
      // The action reports failure in its return value, not by throwing. The
      // old code awaited it and announced success either way, so a rejected
      // road path closed the dialog with a green toast and saved nothing.
      const result = await createRoadPathAction(data);
      if (!result.success) {
        toast.error(result.error || "Failed to create road path");
        return;
      }
      // A message means the path saved but its first task did not.
      if (result.message) toast.warning(result.message);
      else toast.success("Road path created");
      setOpen(false);
      reset(emptyValues());
    } catch {
      toast.error("Failed to create road path");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button>
            <Plus />
            Create road path
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create road path</DialogTitle>
          <DialogDescription>
            Set up a long-term goal with measurable progress.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              id="title"
              placeholder="Learn Spanish"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            <FieldError errors={[errors.title]} />
          </Field>

          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea
              id="description"
              placeholder="Describe your goal…"
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldError errors={[errors.description]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.targetValue}>
              <FieldLabel htmlFor="targetValue">Target value</FieldLabel>
              <Input
                id="targetValue"
                type="number"
                inputMode="decimal"
                placeholder="100"
                aria-invalid={!!errors.targetValue}
                // An empty number input reads as NaN, and the schema rejects
                // that — so "no target" has to become undefined, not NaN.
                {...register("targetValue", {
                  setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                })}
              />
              <FieldError errors={[errors.targetValue]} />
            </Field>

            <Field data-invalid={!!errors.unit}>
              <FieldLabel htmlFor="unit">Unit</FieldLabel>
              <Input
                id="unit"
                placeholder="hours, lessons, etc."
                aria-invalid={!!errors.unit}
                {...register("unit")}
              />
              <FieldError errors={[errors.unit]} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.startDate}>
              <FieldLabel htmlFor="startDate">Start date</FieldLabel>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DateField
                    id="startDate"
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={field.onChange}
                    placeholder="Pick a start day"
                    aria-invalid={!!errors.startDate}
                  />
                )}
              />
              <FieldError errors={[errors.startDate]} />
            </Field>

            <Field data-invalid={!!errors.targetDate}>
              <FieldLabel htmlFor="targetDate">Target date</FieldLabel>
              <Controller
                control={control}
                name="targetDate"
                render={({ field }) => (
                  <DateField
                    id="targetDate"
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={(day) => field.onChange(day || null)}
                    placeholder="No deadline"
                    clearable
                    aria-invalid={!!errors.targetDate}
                  />
                )}
              />
              <FieldError errors={[errors.targetDate]} />
            </Field>
          </div>

          <Field orientation="horizontal">
            <Controller
              control={control}
              name="autoCreateTasks"
              render={({ field }) => (
                <Checkbox
                  id="autoCreateTasks"
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <FieldLabel htmlFor="autoCreateTasks" className="font-normal">
              Automatically create tasks on schedule
            </FieldLabel>
          </Field>

          {autoCreateTasks && (
            <>
              <Field data-invalid={!!errors.taskFrequency}>
                <FieldLabel htmlFor="frequency">Task creation frequency</FieldLabel>
                <Controller
                  control={control}
                  name="taskFrequency"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(value) => field.onChange(value as RoadPathFrequency)}
                    >
                      <SelectTrigger
                        id="frequency"
                        className="w-full"
                        aria-invalid={!!errors.taskFrequency}
                      >
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="every_other_day">Every other day</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  Tasks are created automatically at the start of each day based on this
                  frequency.
                </FieldDescription>
                <FieldError errors={[errors.taskFrequency]} />
              </Field>

              {taskFrequency && (
                <Field orientation="horizontal">
                  <Controller
                    control={control}
                    name="createFirstTask"
                    render={({ field }) => (
                      <Checkbox
                        id="createFirstTask"
                        checked={field.value ?? false}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    )}
                  />
                  <FieldLabel htmlFor="createFirstTask" className="font-normal">
                    Create first task immediately
                  </FieldLabel>
                </Field>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? "Creating…" : "Create road path"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
