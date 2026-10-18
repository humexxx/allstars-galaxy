"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LineChart, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import {
  createRoadPathProgressAction,
  deleteRoadPathProgressAction,
} from "@/app/actions/road-path";
import { runAction } from "@/lib/actions/run";
import { formatDay } from "@/lib/utils/date";
import { createRoadPathProgressSchema, type CreateRoadPathProgressInput } from "@/schemas/road-path";
import type { RoadPathProgress } from "@/types";

type ProgressTrackerProps = {
  roadPathId: string;
  progress: RoadPathProgress[];
  unit: string;
};

// The actions revalidate the page, so the log below re-renders from the
// server on its own — there is nothing to refresh by hand.
export function ProgressTracker({ roadPathId, progress, unit }: ProgressTrackerProps) {
  const [showForm, setShowForm] = useState(false);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  // No `value`: an empty number field, not a pre-filled zero.
  const emptyValues = { roadPathId, notes: "" };
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateRoadPathProgressInput>({
    resolver: zodResolver(createRoadPathProgressSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = async (data: CreateRoadPathProgressInput): Promise<void> => {
    const { ok } = await runAction(createRoadPathProgressAction(data), {
      success: "Progress recorded",
      failure: "Failed to record progress",
    });
    if (!ok) return;
    reset(emptyValues);
    setShowForm(false);
  };

  const handleDelete = async (id: string): Promise<void> => {
    const { ok } = await runAction(deleteRoadPathProgressAction(id), {
      success: "Entry removed",
      failure: "Failed to remove the entry",
    });
    // The row and its button are gone; keep focus in the list.
    if (ok) recordButtonRef.current?.focus();
  };

  const sortedProgress = progress.toSorted((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="flex flex-col gap-4">
      {sortedProgress.length > 0 ? (
        <ul className="flex max-h-75 flex-col gap-2 overflow-y-auto">
          {sortedProgress.map((entry) => {
            const value = parseFloat(entry.value);
            const day = entry.date ? formatDay(entry.date) : null;
            return (
              <li key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                <div>
                  <Text weight="medium">
                    <Mono>{value}</Mono> {unit}
                  </Text>
                  {day && (
                    <Text variant="small">
                      {/* A timestamp: server (UTC) and browser can land on
                          different days near midnight. */}
                      <Mono suppressHydrationWarning>{day}</Mono>
                    </Text>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entry.notes && <Text variant="muted">{entry.notes}</Text>}
                  {/* A mistyped figure moves the whole percentage, so it has to be
                      removable — the action existed, the button did not. */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => handleDelete(entry.id)}
                    aria-label={`Remove the ${value} ${unit} entry`.replace(/\s+/g, " ")}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !showForm && <EmptyState icon={LineChart} title="No progress recorded yet" className="p-6" />
      )}

      {showForm ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Field data-invalid={!!errors.value}>
            <FieldLabel htmlFor="progress-value">Value</FieldLabel>
            <Input
              id="progress-value"
              type="number"
              step="0.01"
              placeholder={`Current ${unit}`}
              aria-invalid={!!errors.value}
              autoFocus
              {...register("value", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.value]} />
          </Field>

          <Field data-invalid={!!errors.notes}>
            <FieldLabel htmlFor="progress-notes">Notes (optional)</FieldLabel>
            <Input
              id="progress-notes"
              placeholder="Any notes…"
              aria-invalid={!!errors.notes}
              {...register("notes")}
            />
            <FieldError errors={[errors.notes]} />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? "Recording…" : "Record"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          ref={recordButtonRef}
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setShowForm(true)}
        >
          <Plus />
          Record progress
        </Button>
      )}
    </div>
  );
}
