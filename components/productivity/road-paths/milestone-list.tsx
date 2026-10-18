"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Flag, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  createRoadPathMilestoneAction,
  updateRoadPathMilestoneAction,
  deleteRoadPathMilestoneAction,
} from "@/app/actions/road-path";
import { createRoadPathMilestoneSchema, type CreateRoadPathMilestoneData } from "@/schemas/road-path";
import { runAction } from "@/lib/actions/run";
import { cn } from "@/lib/utils";
import type { RoadPathMilestone } from "@/types";

type MilestoneListProps = {
  roadPathId: string;
  milestones: RoadPathMilestone[];
};

// The actions revalidate the page, so the list below re-renders from the
// server on its own — there is nothing to refresh by hand.
export function MilestoneList({ roadPathId, milestones }: MilestoneListProps) {
  const [showForm, setShowForm] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateRoadPathMilestoneData>({
    resolver: zodResolver(createRoadPathMilestoneSchema),
    defaultValues: { roadPathId, title: "" },
  });

  const onSubmit = async (data: CreateRoadPathMilestoneData): Promise<void> => {
    const { ok } = await runAction(createRoadPathMilestoneAction(data), {
      success: "Milestone created",
      failure: "Failed to create milestone",
    });
    if (!ok) return;
    reset({ roadPathId, title: "" });
    setShowForm(false);
  };

  const handleToggle = async (milestone: RoadPathMilestone): Promise<void> => {
    await runAction(
      updateRoadPathMilestoneAction({
        id: milestone.id,
        completedAt: milestone.completedAt ? null : new Date(),
      }),
      { failure: "Failed to update milestone" }
    );
  };

  const handleDelete = async (id: string): Promise<void> => {
    const { ok } = await runAction(deleteRoadPathMilestoneAction(id), {
      success: "Milestone deleted",
      failure: "Failed to delete milestone",
    });
    // The row and its button are gone; keep focus in the list.
    if (ok) addButtonRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      {milestones.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {milestones.map((milestone) => {
            const done = milestone.completedAt !== null;
            return (
              <li key={milestone.id} className="flex items-center gap-2 rounded-lg border p-2">
                <Checkbox
                  checked={done}
                  onCheckedChange={() => handleToggle(milestone)}
                  aria-label={`Mark ${milestone.title} ${done ? "incomplete" : "complete"}`}
                />
                <span className={cn("flex-1 text-sm", done && "text-muted-foreground line-through")}>
                  {milestone.title}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => handleDelete(milestone.id)}
                  aria-label={`Delete ${milestone.title}`}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        !showForm && <EmptyState icon={Flag} title="No milestones yet" className="p-6" />
      )}

      {showForm ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <Field data-invalid={!!errors.title}>
            <Input
              placeholder="Milestone title"
              aria-label="Milestone title"
              aria-invalid={!!errors.title}
              autoFocus
              {...register("title")}
            />
            <FieldError errors={[errors.title]} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? "Adding…" : "Add"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          ref={addButtonRef}
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setShowForm(true)}
        >
          <Plus />
          Add milestone
        </Button>
      )}
    </div>
  );
}
