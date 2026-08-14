"use server";

import { revalidatePath } from "next/cache";
import {
  requireEffectiveContext,
  logImpersonatedMutation,
} from "@/lib/services/impersonation";
import {
  createAutomatedTasksForRoadPath,
  createAutomatedTasksForAllRoadPaths,
} from "@/lib/services/task-automation-service";
import { createAutomatedTaskSchema } from "@/schemas/task-automation";

export async function createAutomatedTaskAction(roadPathId: string) {
  const ctx = await requireEffectiveContext();
  const parsed = createAutomatedTaskSchema.safeParse({ roadPathId });
  if (!parsed.success) {
    return { success: false as const, error: "Invalid roadPathId" };
  }

  const task = await createAutomatedTasksForRoadPath(
    ctx.effectiveUserId,
    parsed.data.roadPathId,
  );

  if (task) {
    await logImpersonatedMutation({
      action: "boardTask.createAutomated",
      entityTable: "board_tasks",
      entityId: task.id,
    });
  }
  revalidatePath("/portal/productivity");

  return {
    success: true as const,
    data: task,
    message: task ? "Task created successfully" : "No task needed at this time",
  };
}

export async function createAutomatedTasksForAllAction() {
  const ctx = await requireEffectiveContext();

  const tasks = await createAutomatedTasksForAllRoadPaths(ctx.effectiveUserId);

  for (const task of tasks) {
    await logImpersonatedMutation({
      action: "boardTask.createAutomated",
      entityTable: "board_tasks",
      entityId: task.id,
    });
  }
  revalidatePath("/portal/productivity");

  return {
    success: true,
    data: tasks,
    message: `${tasks.length} task(s) created`,
  };
}
