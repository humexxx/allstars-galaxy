"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  requireEffectiveContext,
  logImpersonatedMutation,
} from "@/lib/services/impersonation";
import {
  getRoadPath,
  createRoadPath,
  deleteRoadPath,
  createRoadPathMilestone,
  updateRoadPathMilestone,
  deleteRoadPathMilestone,
  getNextMilestoneOrder,
  createRoadPathProgress,
  deleteRoadPathProgress,
} from "@/lib/services/road-path-service";
import { createAutomatedTasksForRoadPath } from "@/lib/services/task-automation-service";
import { idSchema } from "@/schemas/common";
import {
  createRoadPathSchema,
  createRoadPathMilestoneSchema,
  updateRoadPathMilestoneSchema,
  createRoadPathProgressSchema,
  type CreateRoadPathInput,
  type CreateRoadPathMilestoneData,
  type UpdateRoadPathMilestoneInput,
  type CreateRoadPathProgressInput,
} from "@/schemas/road-path";
import type { RoadPath, RoadPathMilestone, RoadPathProgress } from "@/types";

// The segment has no page of its own; the layout scope reaches /road-paths
// and /board, which is where road-path edits show up.
const PATH = "/portal/productivity";

export async function createRoadPathAction(
  data: CreateRoadPathInput
): Promise<ActionResult<RoadPath>> {
  return safe("road-path", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createRoadPathSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const { createFirstTask, ...roadPathData } = parsed.data;

    const path = await createRoadPath(ctx.effectiveUserId, {
      ...roadPathData,
      autoCreateTasks: roadPathData.autoCreateTasks ?? false,
    });

    // The path is saved either way; a failed first task is worth saying, not
    // worth failing the whole create over.
    let message: string | undefined;
    if (createFirstTask && path.autoCreateTasks && path.taskFrequency) {
      try {
        await createAutomatedTasksForRoadPath(ctx.effectiveUserId, path.id);
      } catch (error) {
        console.error("Failed to create first task:", error);
        message = "Road path created, but its first task could not be added";
      }
    }

    await logImpersonatedMutation({
      action: "roadPath.create",
      entityTable: "road_paths",
      entityId: path.id,
    });
    revalidatePath(PATH, "layout");
    return { success: true, data: path, message };
  });
}

export async function deleteRoadPathAction(roadPathId: string): Promise<ActionResult> {
  return safe("road-path", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(roadPathId);
    if (!parsed.success) return { success: false, error: "Invalid road path" };

    const before = ctx.isImpersonating
      ? await getRoadPath(parsed.data, ctx.effectiveUserId)
      : undefined;

    await deleteRoadPath(parsed.data, ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "roadPath.delete",
      entityTable: "road_paths",
      entityId: parsed.data,
      before,
    });
    revalidatePath(PATH, "layout");
    return { success: true };
  });
}

export async function createRoadPathMilestoneAction(
  data: CreateRoadPathMilestoneData
): Promise<ActionResult<RoadPathMilestone>> {
  return safe("road-path", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createRoadPathMilestoneSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const milestone = await createRoadPathMilestone(ctx.effectiveUserId, {
      ...parsed.data,
      order:
        parsed.data.order ??
        (await getNextMilestoneOrder(parsed.data.roadPathId, ctx.effectiveUserId)),
    });

    await logImpersonatedMutation({
      action: "roadPathMilestone.create",
      entityTable: "road_path_milestones",
      entityId: milestone.id,
    });
    revalidatePath(PATH, "layout");
    return { success: true, data: milestone };
  });
}

export async function updateRoadPathMilestoneAction(
  data: UpdateRoadPathMilestoneInput
): Promise<ActionResult<RoadPathMilestone>> {
  return safe("road-path", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateRoadPathMilestoneSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const { id, ...updateData } = parsed.data;

    const milestone = await updateRoadPathMilestone(id, ctx.effectiveUserId, updateData);
    if (!milestone) return { success: false, error: "Milestone not found" };

    await logImpersonatedMutation({
      action: "roadPathMilestone.update",
      entityTable: "road_path_milestones",
      entityId: milestone.id,
    });
    revalidatePath(PATH, "layout");
    return { success: true, data: milestone };
  });
}

export async function deleteRoadPathMilestoneAction(milestoneId: string): Promise<ActionResult> {
  return safe("road-path", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(milestoneId);
    if (!parsed.success) return { success: false, error: "Invalid milestone" };

    await deleteRoadPathMilestone(parsed.data, ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "roadPathMilestone.delete",
      entityTable: "road_path_milestones",
      entityId: parsed.data,
    });
    revalidatePath(PATH, "layout");
    return { success: true };
  });
}

export async function createRoadPathProgressAction(
  data: CreateRoadPathProgressInput
): Promise<ActionResult<RoadPathProgress>> {
  return safe("road-path", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createRoadPathProgressSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const progress = await createRoadPathProgress(ctx.effectiveUserId, parsed.data);

    await logImpersonatedMutation({
      action: "roadPathProgress.create",
      entityTable: "road_path_progress",
      entityId: progress.id,
    });
    revalidatePath(PATH, "layout");
    return { success: true, data: progress };
  });
}

export async function deleteRoadPathProgressAction(progressId: string): Promise<ActionResult> {
  return safe("road-path", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(progressId);
    if (!parsed.success) return { success: false, error: "Invalid progress entry" };

    await deleteRoadPathProgress(parsed.data, ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "roadPathProgress.delete",
      entityTable: "road_path_progress",
      entityId: parsed.data,
    });
    revalidatePath(PATH, "layout");
    return { success: true };
  });
}
