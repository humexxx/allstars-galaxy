"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  requireEffectiveContext,
  logImpersonatedMutation,
} from "@/lib/services/impersonation";
import {
  createAutomatedTasksForRoadPath,
  createAutomatedTasksForAllRoadPaths,
} from "@/lib/services/task-automation-service";
import { createAutomatedTaskSchema } from "@/schemas/task-automation";
import type { BoardTask } from "@/types";

export async function createAutomatedTaskAction(
  roadPathId: string
): Promise<ActionResult<BoardTask | null>> {
  return safe("task-automation", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createAutomatedTaskSchema.safeParse({ roadPathId });
    if (!parsed.success) {
      return { success: false, error: "Invalid roadPathId" };
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
    revalidatePath("/portal/productivity", "layout");

    return {
      success: true,
      data: task,
      message: task ? "Task created" : "No task needed at this time",
    };
  });
}

export async function createAutomatedTasksForAllAction(): Promise<ActionResult<BoardTask[]>> {
  return safe("task-automation", async () => {
    const ctx = await requireEffectiveContext();

    const tasks = await createAutomatedTasksForAllRoadPaths(ctx.effectiveUserId);

    for (const task of tasks) {
      await logImpersonatedMutation({
        action: "boardTask.createAutomated",
        entityTable: "board_tasks",
        entityId: task.id,
      });
    }
    revalidatePath("/portal/productivity", "layout");

    return {
      success: true,
      data: tasks,
      message: `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} created`,
    };
  });
}
