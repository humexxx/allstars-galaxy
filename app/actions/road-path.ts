"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { logImpersonatedMutation } from "@/lib/services/impersonation";
import { requireModuleContext } from "@/lib/services/module-access-service";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import {
  getRoadPath,
  createRoadPath,
  updateRoadPath,
  deleteRoadPath,
  reorderRoadPaths,
} from "@/lib/services/road-path-service";
import { idSchema } from "@/schemas/common";
import {
  createRoadPathSchema,
  updateRoadPathSchema,
  reorderRoadPathsSchema,
  type CreateRoadPathInput,
  type ReorderRoadPathsData,
  type UpdateRoadPathInput,
} from "@/schemas/road-path";
import type { RoadPath } from "@/types";

// The segment has no page of its own; the layout scope reaches /road-paths
// and /board, which is where road-path edits show up.
const PATH = "/portal/productivity";

export async function createRoadPathAction(
  data: CreateRoadPathInput
): Promise<ActionResult<RoadPath>> {
  return safe("road-path", async () => {
    const ctx = await requireModuleContext("road-paths");
    const parsed = createRoadPathSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    // A path due today gets today's task the next time the board opens.
    const path = await createRoadPath(ctx.effectiveUserId, parsed.data, await getRequestTodayIso());

    await logImpersonatedMutation({
      action: "roadPath.create",
      entityTable: "road_paths",
      entityId: path.id,
    });
    revalidatePath(PATH, "layout");
    return { success: true, data: path };
  });
}

export async function updateRoadPathAction(
  data: UpdateRoadPathInput
): Promise<ActionResult<RoadPath>> {
  return safe("road-path", async () => {
    const ctx = await requireModuleContext("road-paths");
    const parsed = updateRoadPathSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const { id, ...updateData } = parsed.data;

    const before = ctx.isImpersonating
      ? await getRoadPath(id, ctx.effectiveUserId)
      : undefined;

    const path = await updateRoadPath(
      id,
      ctx.effectiveUserId,
      updateData,
      await getRequestTodayIso()
    );
    if (!path) return { success: false, error: "Road path not found" };

    await logImpersonatedMutation({
      action: "roadPath.update",
      entityTable: "road_paths",
      entityId: path.id,
      before,
      after: path,
    });
    revalidatePath(PATH, "layout");
    return { success: true, data: path };
  });
}

export async function deleteRoadPathAction(roadPathId: string): Promise<ActionResult> {
  return safe("road-path", async () => {
    const ctx = await requireModuleContext("road-paths");
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

/** Saves the order the user dragged their road paths into. */
export async function reorderRoadPathsAction(data: ReorderRoadPathsData): Promise<ActionResult> {
  return safe("road-path", async () => {
    const ctx = await requireModuleContext("road-paths");
    const parsed = reorderRoadPathsSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Invalid order" };

    if (!(await reorderRoadPaths(ctx.effectiveUserId, parsed.data.ids))) {
      return { success: false, error: "Road path not found" };
    }

    await logImpersonatedMutation({
      action: "roadPath.reorder",
      entityTable: "road_paths",
      metadata: { ids: parsed.data.ids },
    });
    revalidatePath(PATH, "layout");
    return { success: true };
  });
}
