"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/services/auth-server";
import {
  createAutomatedTasksForRoadPath,
  createAutomatedTasksForAllRoadPaths,
} from "@/lib/services/task-automation-service";
import { createAutomatedTaskSchema } from "@/schemas/task-automation";

export async function createAutomatedTaskAction(roadPathId: string) {
  const user = await requireAuth();
  const parsed = createAutomatedTaskSchema.safeParse({ roadPathId });
  if (!parsed.success) {
    return { success: false as const, error: "Invalid roadPathId" };
  }

  const task = await createAutomatedTasksForRoadPath(user.id, parsed.data.roadPathId);

  revalidatePath("/portal/productivity");

  return {
    success: true as const,
    data: task,
    message: task ? "Task created successfully" : "No task needed at this time",
  };
}

export async function createAutomatedTasksForAllAction() {
  const user = await requireAuth();

  const tasks = await createAutomatedTasksForAllRoadPaths(user.id);

  revalidatePath("/portal/productivity");

  return {
    success: true,
    data: tasks,
    message: `${tasks.length} task(s) created`,
  };
}
