"use server";

import { revalidatePath } from "next/cache";
import {
  requireEffectiveContext,
  logImpersonatedMutation,
} from "@/lib/services/impersonation";
import {
  getUserRoadPaths,
  getRoadPath,
  createRoadPath,
  updateRoadPath,
  deleteRoadPath,
  getRoadPathMilestones,
  createRoadPathMilestone,
  updateRoadPathMilestone,
  deleteRoadPathMilestone,
  getNextMilestoneOrder,
  getRoadPathProgress,
  createRoadPathProgress,
  deleteRoadPathProgress,
  calculateRoadPathStats,
} from "@/lib/services/road-path-service";
import { createAutomatedTasksForRoadPath } from "@/lib/services/task-automation-service";
import {
  createRoadPathSchema,
  updateRoadPathSchema,
  createRoadPathMilestoneSchema,
  updateRoadPathMilestoneSchema,
  createRoadPathProgressSchema,
  type CreateRoadPathInput,
  type UpdateRoadPathData,
  type CreateRoadPathMilestoneData,
  type UpdateRoadPathMilestoneData,
  type CreateRoadPathProgressInput,
} from "@/schemas/road-path";

const PATH = "/portal/productivity";

export async function getUserRoadPathsAction() {
  const ctx = await requireEffectiveContext();
  const paths = await getUserRoadPaths(ctx.effectiveUserId);
  return { success: true, data: paths };
}

export async function getRoadPathAction(roadPathId: string) {
  const ctx = await requireEffectiveContext();
  const path = await getRoadPath(roadPathId, ctx.effectiveUserId);
  if (!path) throw new Error("Road path not found");
  return { success: true, data: path };
}

export async function createRoadPathAction(data: CreateRoadPathInput) {
  const ctx = await requireEffectiveContext();
  const parsed = createRoadPathSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const { createFirstTask, ...roadPathData } = parsed.data;
  const validated = parsed.data;

  const path = await createRoadPath(ctx.effectiveUserId, {
    ...roadPathData,
    autoCreateTasks: validated.autoCreateTasks ?? false,
  });

  if (createFirstTask && path.autoCreateTasks && path.taskFrequency) {
    try {
      await createAutomatedTasksForRoadPath(ctx.effectiveUserId, path.id);
    } catch (error) {
      console.error("Failed to create first task:", error);
    }
  }

  await logImpersonatedMutation({
    action: "roadPath.create",
    entityTable: "road_paths",
    entityId: path.id,
  });
  revalidatePath(PATH);
  return { success: true, data: path };
}

export async function updateRoadPathAction(data: UpdateRoadPathData) {
  const ctx = await requireEffectiveContext();
  const parsed = updateRoadPathSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const { id, ...updateData } = parsed.data;

  const before = ctx.isImpersonating
    ? await getRoadPath(id, ctx.effectiveUserId)
    : undefined;

  const path = await updateRoadPath(id, ctx.effectiveUserId, updateData);
  if (!path) throw new Error("Road path not found");

  await logImpersonatedMutation({
    action: "roadPath.update",
    entityTable: "road_paths",
    entityId: path.id,
    before,
    after: path,
  });
  revalidatePath(PATH);
  return { success: true, data: path };
}

export async function deleteRoadPathAction(roadPathId: string) {
  const ctx = await requireEffectiveContext();

  const before = ctx.isImpersonating
    ? await getRoadPath(roadPathId, ctx.effectiveUserId)
    : undefined;

  await deleteRoadPath(roadPathId, ctx.effectiveUserId);

  await logImpersonatedMutation({
    action: "roadPath.delete",
    entityTable: "road_paths",
    entityId: roadPathId,
    before,
  });
  revalidatePath(PATH);
  return { success: true };
}

export async function getRoadPathMilestonesAction(roadPathId: string) {
  const ctx = await requireEffectiveContext();
  const milestones = await getRoadPathMilestones(roadPathId, ctx.effectiveUserId);
  return { success: true, data: milestones };
}

export async function createRoadPathMilestoneAction(data: CreateRoadPathMilestoneData) {
  const ctx = await requireEffectiveContext();
  const parsed = createRoadPathMilestoneSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const milestone = await createRoadPathMilestone(ctx.effectiveUserId, parsed.data);

  await logImpersonatedMutation({
    action: "roadPathMilestone.create",
    entityTable: "road_path_milestones",
    entityId: milestone.id,
  });
  revalidatePath(PATH);
  return { success: true, data: milestone };
}

export async function updateRoadPathMilestoneAction(data: UpdateRoadPathMilestoneData) {
  const ctx = await requireEffectiveContext();
  const parsed = updateRoadPathMilestoneSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const { id, ...updateData } = parsed.data;

  const milestone = await updateRoadPathMilestone(id, ctx.effectiveUserId, updateData);
  if (!milestone) throw new Error("Milestone not found");

  await logImpersonatedMutation({
    action: "roadPathMilestone.update",
    entityTable: "road_path_milestones",
    entityId: milestone.id,
  });
  revalidatePath(PATH);
  return { success: true, data: milestone };
}

export async function deleteRoadPathMilestoneAction(milestoneId: string) {
  const ctx = await requireEffectiveContext();
  await deleteRoadPathMilestone(milestoneId, ctx.effectiveUserId);

  await logImpersonatedMutation({
    action: "roadPathMilestone.delete",
    entityTable: "road_path_milestones",
    entityId: milestoneId,
  });
  revalidatePath(PATH);
  return { success: true };
}

export async function getNextMilestoneOrderAction(roadPathId: string) {
  const ctx = await requireEffectiveContext();
  const order = await getNextMilestoneOrder(roadPathId, ctx.effectiveUserId);
  return { success: true, data: order };
}

export async function getRoadPathProgressAction(
  roadPathId: string,
  startDate?: Date,
  endDate?: Date
) {
  const ctx = await requireEffectiveContext();
  const progress = await getRoadPathProgress(
    roadPathId,
    ctx.effectiveUserId,
    startDate,
    endDate
  );
  return { success: true, data: progress };
}

export async function getRoadPathDetailAction(roadPathId: string) {
  const ctx = await requireEffectiveContext();
  const [milestones, progress, stats] = await Promise.all([
    getRoadPathMilestones(roadPathId, ctx.effectiveUserId),
    getRoadPathProgress(roadPathId, ctx.effectiveUserId),
    calculateRoadPathStats(roadPathId, ctx.effectiveUserId),
  ]);

  return { success: true, data: { milestones, progress, stats } };
}

export async function createRoadPathProgressAction(data: CreateRoadPathProgressInput) {
  const ctx = await requireEffectiveContext();
  const parsed = createRoadPathProgressSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const progress = await createRoadPathProgress(ctx.effectiveUserId, parsed.data);

  await logImpersonatedMutation({
    action: "roadPathProgress.create",
    entityTable: "road_path_progress",
    entityId: progress.id,
  });
  revalidatePath(PATH);
  return { success: true, data: progress };
}

export async function deleteRoadPathProgressAction(progressId: string) {
  const ctx = await requireEffectiveContext();
  await deleteRoadPathProgress(progressId, ctx.effectiveUserId);

  await logImpersonatedMutation({
    action: "roadPathProgress.delete",
    entityTable: "road_path_progress",
    entityId: progressId,
  });
  revalidatePath(PATH);
  return { success: true };
}

export async function calculateRoadPathStatsAction(roadPathId: string) {
  const ctx = await requireEffectiveContext();
  const stats = await calculateRoadPathStats(roadPathId, ctx.effectiveUserId);
  return { success: true, data: stats };
}
