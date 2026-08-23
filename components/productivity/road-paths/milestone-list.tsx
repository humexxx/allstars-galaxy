"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/typography";
import { Plus, Trash2 } from "lucide-react";
import {
  createRoadPathMilestoneAction,
  updateRoadPathMilestoneAction,
  deleteRoadPathMilestoneAction,
} from "@/app/actions/road-path";
import { createRoadPathMilestoneSchema, type CreateRoadPathMilestoneData } from "@/schemas/road-path";
import { runAction } from "@/lib/actions/run";
import type { RoadPathMilestone } from "@/types";

type MilestoneListProps = {
  roadPathId: string;
  milestones: RoadPathMilestone[];
  onRefresh: () => void;
};

export function MilestoneList({ roadPathId, milestones, onRefresh }: MilestoneListProps) {
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateRoadPathMilestoneData>({
    resolver: zodResolver(createRoadPathMilestoneSchema),
    defaultValues: {
      roadPathId,
      // Required by the schema. Nothing filled it, so every milestone failed
      // validation and the form sat there saying nothing.
      order: milestones.length,
    },
  });

  const onSubmit = async (data: CreateRoadPathMilestoneData) => {
    const { ok } = await runAction(createRoadPathMilestoneAction(data), {
      success: "Milestone created",
      failure: "Failed to create milestone",
    });
    if (!ok) return;
    reset({ roadPathId, order: milestones.length });
    setShowForm(false);
    onRefresh();
  };

  const handleToggle = async (milestone: RoadPathMilestone): Promise<void> => {
    const { ok } = await runAction(
      updateRoadPathMilestoneAction({
        id: milestone.id,
        completedAt: milestone.completedAt ? null : new Date(),
      }),
      { failure: "Failed to update milestone" }
    );
    if (ok) onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { ok } = await runAction(deleteRoadPathMilestoneAction(id), {
      success: "Milestone deleted",
      failure: "Failed to delete milestone",
    });
    if (ok) onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {milestones.map((milestone) => (
          <div key={milestone.id} className="flex items-center gap-2 p-2 rounded-lg border">
            <Checkbox
              checked={milestone.completedAt !== null}
              onCheckedChange={() => handleToggle(milestone)}
            />
            <span className={milestone.completedAt !== null ? "line-through text-muted-foreground flex-1" : "flex-1"}>
              {milestone.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDelete(milestone.id)}
              aria-label={`Delete ${milestone.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {milestones.length === 0 && !showForm && (
          <Text variant="muted" className="text-center py-4">
            No milestones yet
          </Text>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          <Input
            placeholder="Milestone title"
            {...register("title")}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              Add
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Milestone
        </Button>
      )}
    </div>
  );
}
