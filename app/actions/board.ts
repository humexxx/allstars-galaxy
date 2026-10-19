"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  requireEffectiveContext,
  logImpersonatedMutation,
} from "@/lib/services/impersonation";
import {
  getBoardColumn,
  createBoardColumn,
  updateBoardColumn,
  countBoardColumns,
  deleteBoardColumn,
  getBoardTask,
  createBoardTask,
  updateBoardTask,
  deleteBoardTask,
  reorderTask,
  getNextTaskOrder,
} from "@/lib/services/board-service";
import { idSchema } from "@/schemas/common";
import {
  createBoardColumnSchema,
  updateBoardColumnSchema,
  createBoardTaskSchema,
  updateBoardTaskSchema,
  reorderTasksSchema,
  type CreateBoardColumnData,
  type UpdateBoardColumnData,
  type CreateBoardTaskData,
  type UpdateBoardTaskData,
  type ReorderTasksData,
} from "@/schemas/board";
import type { BoardColumn, BoardTask, BoardTaskWithColumn } from "@/types";

const BOARD_PATH = "/portal/productivity/board";

export async function createBoardColumnAction(
  data: CreateBoardColumnData
): Promise<ActionResult<BoardColumn>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createBoardColumnSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const column = await createBoardColumn(ctx.effectiveUserId, parsed.data);

    await logImpersonatedMutation({
      action: "boardColumn.create",
      entityTable: "board_columns",
      entityId: column.id,
    });
    revalidatePath(BOARD_PATH);
    return { success: true, data: column };
  });
}

export async function updateBoardColumnAction(
  data: UpdateBoardColumnData
): Promise<ActionResult<BoardColumn>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateBoardColumnSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const { id, ...updateData } = parsed.data;

    const before = ctx.isImpersonating
      ? await getBoardColumn(id, ctx.effectiveUserId)
      : undefined;

    const column = await updateBoardColumn(id, ctx.effectiveUserId, updateData);
    if (!column) return { success: false, error: "Column not found" };

    await logImpersonatedMutation({
      action: "boardColumn.update",
      entityTable: "board_columns",
      entityId: column.id,
      before,
      after: column,
    });
    revalidatePath(BOARD_PATH);
    return { success: true, data: column };
  });
}

export async function deleteBoardColumnAction(columnId: string): Promise<ActionResult> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(columnId);
    if (!parsed.success) return { success: false, error: "Invalid column" };

    // The board page re-creates the default columns whenever a user has
    // none, so deleting the last one would bring three back. Refuse it here
    // too — the menu disabling it is only a convenience.
    if ((await countBoardColumns(ctx.effectiveUserId)) <= 1) {
      return { success: false, error: "A board needs at least one column" };
    }

    const before = ctx.isImpersonating
      ? await getBoardColumn(parsed.data, ctx.effectiveUserId)
      : undefined;

    await deleteBoardColumn(parsed.data, ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "boardColumn.delete",
      entityTable: "board_columns",
      entityId: parsed.data,
      before,
    });
    revalidatePath(BOARD_PATH);
    return { success: true };
  });
}

export async function createBoardTaskAction(
  data: CreateBoardTaskData
): Promise<ActionResult<BoardTask>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createBoardTaskSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const validated = parsed.data;

    const order =
      validated.order ?? (await getNextTaskOrder(validated.columnId, ctx.effectiveUserId));

    const task = await createBoardTask(ctx.effectiveUserId, { ...validated, order });

    await logImpersonatedMutation({
      action: "boardTask.create",
      entityTable: "board_tasks",
      entityId: task.id,
    });
    revalidatePath(BOARD_PATH);
    return { success: true, data: task };
  });
}

export async function updateBoardTaskAction(
  data: UpdateBoardTaskData
): Promise<ActionResult<BoardTask>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateBoardTaskSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const { id, ...updateData } = parsed.data;

    const before = ctx.isImpersonating
      ? await getBoardTask(id, ctx.effectiveUserId)
      : undefined;

    const task = await updateBoardTask(id, ctx.effectiveUserId, updateData);
    if (!task) return { success: false, error: "Task not found" };

    await logImpersonatedMutation({
      action: "boardTask.update",
      entityTable: "board_tasks",
      entityId: task.id,
      before,
      after: task,
    });
    revalidatePath(BOARD_PATH);
    return { success: true, data: task };
  });
}

export async function deleteBoardTaskAction(taskId: string): Promise<ActionResult> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(taskId);
    if (!parsed.success) return { success: false, error: "Invalid task" };

    const before = ctx.isImpersonating
      ? await getBoardTask(parsed.data, ctx.effectiveUserId)
      : undefined;

    await deleteBoardTask(parsed.data, ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "boardTask.delete",
      entityTable: "board_tasks",
      entityId: parsed.data,
      before,
    });
    revalidatePath(BOARD_PATH);
    return { success: true };
  });
}

export async function reorderBoardTaskAction(
  data: ReorderTasksData
): Promise<ActionResult<BoardTaskWithColumn | null>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = reorderTasksSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const validated = parsed.data;
    const task = await reorderTask(
      validated.taskId,
      ctx.effectiveUserId,
      validated.sourceColumnId,
      validated.destinationColumnId,
      validated.order
    );

    await logImpersonatedMutation({
      action: "boardTask.reorder",
      entityTable: "board_tasks",
      entityId: validated.taskId,
    });
    revalidatePath(BOARD_PATH);
    return { success: true, data: task };
  });
}
