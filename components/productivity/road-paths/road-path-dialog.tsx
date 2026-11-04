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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createRoadPathAction, updateRoadPathAction } from "@/app/actions/road-path";
import { WEEKDAYS, frequencyLabel, scheduleLabel } from "@/lib/productivity/habit";
import { createRoadPathSchema, type CreateRoadPathInput } from "@/schemas/road-path";
import type { RoadPath } from "@/types";

import { calendarDayKey } from "../zoned-date";
import { parseAmount } from "./format";

type RoadPathDialogProps = {
  /** Present = editing that path; absent = creating one. */
  roadPath?: RoadPath;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
function valuesOf(roadPath?: RoadPath): CreateRoadPathInput {
  if (!roadPath) {
    return {
      title: "",
      description: "",
      targetValue: undefined,
      unit: "",
      // The schema requires a start date. Leaving the field empty used to send
      // `new Date("")` — an Invalid Date nothing rejected until the insert.
      startDate: today(),
      targetDate: null,
      scheduleDays: [],
    };
  }
  return {
    title: roadPath.title,
    description: roadPath.description ?? "",
    targetValue: parseAmount(roadPath.targetValue) ?? undefined,
    unit: roadPath.unit ?? "",
    startDate: calendarDayKey(roadPath.startDate),
    targetDate: roadPath.targetDate ? calendarDayKey(roadPath.targetDate) : null,
    scheduleDays: roadPath.scheduleDays ?? [],
  };
}

function scheduleHint(days: readonly number[]): string {
  if (days.length === 0) return "No days picked: nothing goes on your board by itself.";
  const often = frequencyLabel(days);
  return `${scheduleLabel(days)}${often ? ` · ${often}` : ""}. On these days its task is on your board when you open it.`;
}

/**
 * One form for creating a road path and for editing every part of one: what
 * it is, the days it repeats on, its dates, the figure it tracks, and whether
 * it is finished.
 */
export function RoadPathDialog({
  roadPath,
  children,
  open: controlledOpen,
  onOpenChange,
}: RoadPathDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isEdit = roadPath !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children !== undefined || !isEdit ? (
        <DialogTrigger asChild>
          {children ?? (
            <Button>
              <Plus />
              Create road path
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit road path" : "Create road path"}</DialogTitle>
          <DialogDescription>
            A habit you repeat on set days, or a goal you measure — or both.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog's content, so every opening starts from
            the path as it is now. */}
        <RoadPathForm roadPath={roadPath} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RoadPathForm({ roadPath, onSaved }: { roadPath?: RoadPath; onSaved: () => void }) {
  const isEdit = roadPath !== undefined;
  const [completed, setCompleted] = useState(roadPath?.completedAt != null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoadPathInput>({
    resolver: zodResolver(createRoadPathSchema),
    defaultValues: valuesOf(roadPath),
  });

  const scheduleDays = useWatch({ control, name: "scheduleDays" }) ?? [];

  const onSubmit = async (data: CreateRoadPathInput): Promise<void> => {
    try {
      // The action reports failure in its return value, not by throwing.
      const result = roadPath
        ? await updateRoadPathAction({
            id: roadPath.id,
            ...data,
            // Only a change of state writes it: re-saving a finished path must
            // not move the day it was finished.
            ...(completed !== (roadPath.completedAt != null)
              ? { completedAt: completed ? new Date() : null }
              : {}),
          })
        : await createRoadPathAction(data);
      if (!result.success) {
        toast.error(result.error || (isEdit ? "Failed to save road path" : "Failed to create road path"));
        return;
      }
      toast.success(isEdit ? "Road path saved" : "Road path created");
      onSaved();
    } catch {
      toast.error(isEdit ? "Failed to save road path" : "Failed to create road path");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field data-invalid={!!errors.title}>
        <FieldLabel htmlFor="road-path-title">Title</FieldLabel>
        <Input
          id="road-path-title"
          placeholder="Exercise"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
        <FieldError errors={[errors.title]} />
      </Field>

      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="road-path-description">Description</FieldLabel>
        <Textarea
          id="road-path-description"
          placeholder="30 minutes, any kind"
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        <FieldError errors={[errors.description]} />
      </Field>

      <Field data-invalid={!!errors.scheduleDays}>
        <FieldLabel id="road-path-days-label">Repeat on</FieldLabel>
        <Controller
          control={control}
          name="scheduleDays"
          render={({ field }) => (
            <ToggleGroup
              type="multiple"
              variant="outline"
              aria-labelledby="road-path-days-label"
              value={(field.value ?? []).map(String)}
              onValueChange={(values) => field.onChange(values.map(Number))}
              className="gap-1.5"
            >
              {WEEKDAYS.map((day) => (
                <ToggleGroupItem
                  key={day.value}
                  value={String(day.value)}
                  aria-label={day.short}
                  title={day.short}
                  className="size-9 sm:size-10"
                >
                  {day.letter}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
        <FieldDescription>{scheduleHint(scheduleDays)}</FieldDescription>
        <FieldError errors={[errors.scheduleDays as { message?: string } | undefined]} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.startDate}>
          <FieldLabel htmlFor="road-path-start">Start date</FieldLabel>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DateField
                id="road-path-start"
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
          <FieldLabel htmlFor="road-path-target-date">Target date</FieldLabel>
          <Controller
            control={control}
            name="targetDate"
            render={({ field }) => (
              <DateField
                id="road-path-target-date"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.targetValue}>
          <FieldLabel htmlFor="road-path-target-value">Target value</FieldLabel>
          <Input
            id="road-path-target-value"
            type="number"
            inputMode="decimal"
            placeholder="Optional, e.g. 100"
            aria-invalid={!!errors.targetValue}
            // An empty number input reads as NaN, and the schema rejects
            // that — so "no target" has to become null, not NaN.
            {...register("targetValue", {
              setValueAs: (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
            })}
          />
          <FieldError errors={[errors.targetValue]} />
        </Field>

        <Field data-invalid={!!errors.unit}>
          <FieldLabel htmlFor="road-path-unit">Unit</FieldLabel>
          <Input
            id="road-path-unit"
            placeholder="km, hours, books…"
            aria-invalid={!!errors.unit}
            {...register("unit")}
          />
          <FieldError errors={[errors.unit]} />
        </Field>
      </div>

      {isEdit ? (
        <Field orientation="horizontal">
          <Checkbox
            id="road-path-completed"
            checked={completed}
            onCheckedChange={(checked) => setCompleted(checked === true)}
          />
          <FieldLabel htmlFor="road-path-completed" className="font-normal">
            Completed — stop putting its task on the board
          </FieldLabel>
        </Field>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {isSubmitting
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create road path"}
        </Button>
      </DialogFooter>
    </form>
  );
}
