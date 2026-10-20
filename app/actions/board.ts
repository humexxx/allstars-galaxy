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
  setDoneColumn,
  countBoardColumns,
  deleteBoardColumn,
  getBoardTask,
  createBoardTask,
  updateBoardTask,
  deleteBoardTask,
  reorderTask,
  getNextTaskOrder,
  carryOverTasks,
  moveTaskToDay,
  type CarryOverResult,
} from "@/lib/services/board-service";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import { idSchema } from "@/schemas/common";
import {
  createBoardColumnSchema,
  updateBoardColumnSchema,
  createBoardTaskSchema,
  updateBoardTaskSchema,
  reorderTasksSchema,
  carryOverSchema,
  type CreateBoardColumnData,
  type UpdateBoardColumnData,
  type CreateBoardTaskData,
  type UpdateBoardTaskData,
  type ReorderTasksData,
  type CarryOverData,
} from "@/schemas/board";
import type { BoardColumn, BoardTask, BoardTaskWithColumn } from "@/types";

// A task reaching Done checks its road path in, so board writes show on the
// road paths too: revalidate the whole segment (it has no page of its own,
// hence the "layout" type).
const PRODUCTIVITY_PATH = "/portal/productivity";

function revalidateProductivity(): void {
  revalidatePath(PRODUCTIVITY_PATH, "layout");
}

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
    revalidateProductivity();
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
    revalidateProductivity();
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

    const before = await getBoardColumn(parsed.data, ctx.effectiveUserId);
    if (!before) return { success: false, error: "Column not found" };
    // Without one, nothing on the board could be finished.
    if (before.isDone) {
      return { success: false, error: "Choose another Done column before deleting this one" };
    }

    await deleteBoardColumn(parsed.data, ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "boardColumn.delete",
      entityTable: "board_columns",
      entityId: parsed.data,
      before: ctx.isImpersonating ? before : undefined,
    });
    revalidateProductivity();
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

    const order = await getNextTaskOrder(
      validated.columnId,
      ctx.effectiveUserId,
      validated.boardDate
    );

    const task = await createBoardTask(ctx.effectiveUserId, { ...validated, order });

    await logImpersonatedMutation({
      action: "boardTask.create",
      entityTable: "board_tasks",
      entityId: task.id,
    });
    revalidateProductivity();
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
    revalidateProductivity();
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
    revalidateProductivity();
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
      validated.destinationColumnId,
      validated.order
    );

    await logImpersonatedMutation({
      action: "boardTask.reorder",
      entityTable: "board_tasks",
      entityId: validated.taskId,
    });
    revalidateProductivity();
    return { success: true, data: task };
  });
}

export async function setDoneColumnAction(columnId: string): Promise<ActionResult<BoardColumn>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(columnId);
    if (!parsed.success) return { success: false, error: "Invalid column" };

    const column = await setDoneColumn(parsed.data, ctx.effectiveUserId);
    if (!column) return { success: false, error: "Column not found" };

    await logImpersonatedMutation({
      action: "boardColumn.setDone",
      entityTable: "board_columns",
      entityId: column.id,
    });
    revalidateProductivity();
    return { success: true, data: column };
  });
}

/** "You didn't finish some things. Move them to today?" — today is the reader's. */
export async function carryOverTasksAction(
  data: CarryOverData
): Promise<ActionResult<CarryOverResult>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = carryOverSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const result = await carryOverTasks(
      ctx.effectiveUserId,
      await getRequestTodayIso(),
      parsed.data.moveIds,
      parsed.data.leaveIds
    );

    for (const taskId of [...parsed.data.moveIds, ...parsed.data.leaveIds]) {
      await logImpersonatedMutation({
        action: "boardTask.carryOver",
        entityTable: "board_tasks",
        entityId: taskId,
      });
    }
    revalidateProductivity();
    return { success: true, data: result };
  });
}

/** From an earlier day's board: put the task on today's. */
export async function moveTaskToTodayAction(taskId: string): Promise<ActionResult<BoardTask>> {
  return safe("board", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(taskId);
    if (!parsed.success) return { success: false, error: "Invalid task" };

    const current = await getBoardTask(parsed.data, ctx.effectiveUserId);
    if (!current) return { success: false, error: "Task not found" };
    if (current.roadPathId) {
      return { success: false, error: "A road path's task counts for its own day" };
    }

    const task = await moveTaskToDay(parsed.data, ctx.effectiveUserId, await getRequestTodayIso());
    if (!task) return { success: false, error: "Task not found" };

    await logImpersonatedMutation({
      action: "boardTask.moveToToday",
      entityTable: "board_tasks",
      entityId: task.id,
    });
    revalidateProductivity();
    return { success: true, data: task };
  });
}
