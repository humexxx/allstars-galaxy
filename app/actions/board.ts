"use server";

import { revalidatePath } from "next/cache";
import {
  requireEffectiveContext,
  logImpersonatedMutation,
} from "@/lib/services/impersonation";
import {
  getUserBoardColumns,
  getBoardColumn,
  createBoardColumn,
  updateBoardColumn,
  deleteBoardColumn,
  initializeDefaultColumns,
  getBoardTask,
  getUserBoardTasks,
  createBoardTask,
  updateBoardTask,
  deleteBoardTask,
  reorderTask,
  getNextTaskOrder,
  getNextColumnOrder,
} from "@/lib/services/board-service";
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

const BOARD_PATH = "/portal/productivity/board";

export async function getUserBoardColumnsAction() {
  const ctx = await requireEffectiveContext();
  const columns = await getUserBoardColumns(ctx.effectiveUserId);
  return { success: true, data: columns };
}

export async function getBoardColumnAction(columnId: string) {
  const ctx = await requireEffectiveContext();
  const column = await getBoardColumn(columnId, ctx.effectiveUserId);
  if (!column) throw new Error("Column not found");
  return { success: true, data: column };
}

export async function createBoardColumnAction(data: CreateBoardColumnData) {
  const ctx = await requireEffectiveContext();
  const validated = createBoardColumnSchema.parse(data);
  const column = await createBoardColumn(ctx.effectiveUserId, validated);

  await logImpersonatedMutation({
    action: "boardColumn.create",
    entityTable: "board_columns",
    entityId: column.id,
  });
  revalidatePath(BOARD_PATH);
  return { success: true, data: column };
}

export async function updateBoardColumnAction(data: UpdateBoardColumnData) {
  const ctx = await requireEffectiveContext();
  const validated = updateBoardColumnSchema.parse(data);
  const { id, ...updateData } = validated;

  const before = ctx.isImpersonating
    ? await getBoardColumn(id, ctx.effectiveUserId)
    : undefined;

  const column = await updateBoardColumn(id, ctx.effectiveUserId, updateData);
  if (!column) throw new Error("Column not found");

  await logImpersonatedMutation({
    action: "boardColumn.update",
    entityTable: "board_columns",
    entityId: column.id,
    before,
    after: column,
  });
  revalidatePath(BOARD_PATH);
  return { success: true, data: column };
}

export async function deleteBoardColumnAction(columnId: string) {
  const ctx = await requireEffectiveContext();

  const before = ctx.isImpersonating
    ? await getBoardColumn(columnId, ctx.effectiveUserId)
    : undefined;

  await deleteBoardColumn(columnId, ctx.effectiveUserId);

  await logImpersonatedMutation({
    action: "boardColumn.delete",
    entityTable: "board_columns",
    entityId: columnId,
    before,
  });
  revalidatePath(BOARD_PATH);
  return { success: true };
}

export async function initializeDefaultColumnsAction() {
  const ctx = await requireEffectiveContext();
  const columns = await initializeDefaultColumns(ctx.effectiveUserId);

  revalidatePath(BOARD_PATH);
  return { success: true, data: columns };
}

export async function getUserBoardTasksAction() {
  const ctx = await requireEffectiveContext();
  const tasks = await getUserBoardTasks(ctx.effectiveUserId);
  return { success: true, data: tasks };
}

export async function getBoardDataAction() {
  const ctx = await requireEffectiveContext();
  const [columns, tasks] = await Promise.all([
    getUserBoardColumns(ctx.effectiveUserId),
    getUserBoardTasks(ctx.effectiveUserId),
  ]);
  return { success: true, data: { columns, tasks } };
}

export async function getBoardTaskAction(taskId: string) {
  const ctx = await requireEffectiveContext();
  const task = await getBoardTask(taskId, ctx.effectiveUserId);
  if (!task) throw new Error("Task not found");
  return { success: true, data: task };
}

export async function createBoardTaskAction(data: CreateBoardTaskData) {
  const ctx = await requireEffectiveContext();
  const validated = createBoardTaskSchema.parse(data);

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
}

export async function updateBoardTaskAction(data: UpdateBoardTaskData) {
  const ctx = await requireEffectiveContext();
  const validated = updateBoardTaskSchema.parse(data);
  const { id, ...updateData } = validated;

  const before = ctx.isImpersonating
    ? await getBoardTask(id, ctx.effectiveUserId)
    : undefined;

  const task = await updateBoardTask(id, ctx.effectiveUserId, updateData);
  if (!task) throw new Error("Task not found");

  await logImpersonatedMutation({
    action: "boardTask.update",
    entityTable: "board_tasks",
    entityId: task.id,
    before,
    after: task,
  });
  revalidatePath(BOARD_PATH);
  return { success: true, data: task };
}

export async function deleteBoardTaskAction(taskId: string) {
  const ctx = await requireEffectiveContext();

  const before = ctx.isImpersonating
    ? await getBoardTask(taskId, ctx.effectiveUserId)
    : undefined;

  await deleteBoardTask(taskId, ctx.effectiveUserId);

  await logImpersonatedMutation({
    action: "boardTask.delete",
    entityTable: "board_tasks",
    entityId: taskId,
    before,
  });
  revalidatePath(BOARD_PATH);
  return { success: true };
}

export async function reorderBoardTaskAction(data: ReorderTasksData) {
  const ctx = await requireEffectiveContext();
  const validated = reorderTasksSchema.parse(data);
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
}

export async function getNextTaskOrderAction(columnId: string) {
  const ctx = await requireEffectiveContext();
  const order = await getNextTaskOrder(columnId, ctx.effectiveUserId);
  return { success: true, data: order };
}

export async function getNextColumnOrderAction() {
  const ctx = await requireEffectiveContext();
  const order = await getNextColumnOrder(ctx.effectiveUserId);
  return { success: true, data: order };
}
