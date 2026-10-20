import "server-only";

import { db } from "@/db";
import { boardColumns, boardTasks, roadPathCheckIns } from "@/db/schema";
import { eq, and, asc, desc, gt, lt, ne, inArray, isNull, sql } from "drizzle-orm";
import type { BoardColumn, BoardTask, BoardTaskWithColumn, CarryOverTask } from "@/types";
import type {
  CreateBoardColumnData,
  UpdateBoardColumnData,
  CreateBoardTaskData,
  UpdateBoardTaskData,
} from "@/schemas/board";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Every board is a list of days. A task sits on one day's board
 * (`boardDate`), and its `order` is its place in its column ON THAT DAY — so
 * every positional write below is scoped to the column and the day.
 */

export const DEFAULT_COLUMNS = [
  { name: "Todo", order: 0, isDone: false },
  { name: "Working", order: 1, isDone: false },
  { name: "Done", order: 2, isDone: true },
] as const;

export async function getBoardColumns(userId: string): Promise<BoardColumn[]> {
  return db.query.boardColumns.findMany({
    where: eq(boardColumns.userId, userId),
    orderBy: [asc(boardColumns.order)],
  });
}

export async function getBoardColumn(columnId: string, userId: string): Promise<BoardColumn | null> {
  const column = await db.query.boardColumns.findFirst({
    where: and(eq(boardColumns.id, columnId), eq(boardColumns.userId, userId)),
  });
  return column ?? null;
}

/** One day's board: its tasks, in order. */
export async function getBoardTasksForDay(userId: string, day: string): Promise<BoardTask[]> {
  return db.query.boardTasks.findMany({
    where: and(eq(boardTasks.userId, userId), eq(boardTasks.boardDate, day)),
    orderBy: [asc(boardTasks.order), asc(boardTasks.createdAt)],
  });
}

export async function createBoardColumn(userId: string, data: CreateBoardColumnData): Promise<BoardColumn> {
  const [column] = await db
    .insert(boardColumns)
    .values({
      userId,
      ...data,
    })
    .returning();

  return column;
}

export async function updateBoardColumn(
  columnId: string,
  userId: string,
  data: Omit<UpdateBoardColumnData, "id">
): Promise<BoardColumn | null> {
  const [column] = await db
    .update(boardColumns)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(boardColumns.id, columnId), eq(boardColumns.userId, userId)))
    .returning();

  // No row: the id was not this user's column.
  return column ?? null;
}

/**
 * Make `columnId` the board's Done column. What was finished stays finished:
 * a task's `completedAt` and a habit's check-ins record what happened, and
 * moving the flag does not rewrite them.
 */
export async function setDoneColumn(columnId: string, userId: string): Promise<BoardColumn | null> {
  await ensureColumnOwnership(columnId, userId);
  return db.transaction(async (tx) => {
    const now = new Date();
    // The old one first: a board may hold one Done column at a time.
    await tx
      .update(boardColumns)
      .set({ isDone: false, updatedAt: now })
      .where(
        and(
          eq(boardColumns.userId, userId),
          eq(boardColumns.isDone, true),
          ne(boardColumns.id, columnId)
        )
      );
    const [column] = await tx
      .update(boardColumns)
      .set({ isDone: true, updatedAt: now })
      .where(and(eq(boardColumns.id, columnId), eq(boardColumns.userId, userId)))
      .returning();
    return column ?? null;
  });
}

/** How many columns the user's board has. */
export async function countBoardColumns(userId: string): Promise<number> {
  const rows = await db
    .select({ id: boardColumns.id })
    .from(boardColumns)
    .where(eq(boardColumns.userId, userId));
  return rows.length;
}

export async function deleteBoardColumn(columnId: string, userId: string): Promise<void> {
  await db
    .delete(boardColumns)
    .where(and(eq(boardColumns.id, columnId), eq(boardColumns.userId, userId)));
}

export async function initializeDefaultColumns(userId: string): Promise<BoardColumn[]> {
  const existingColumns = await getBoardColumns(userId);

  if (existingColumns.length > 0) {
    return existingColumns;
  }

  return db
    .insert(boardColumns)
    .values(DEFAULT_COLUMNS.map((col) => ({ userId, ...col })))
    .returning();
}

export async function getBoardTask(taskId: string, userId: string): Promise<BoardTaskWithColumn | null> {
  const task = await db.query.boardTasks.findFirst({
    where: and(eq(boardTasks.id, taskId), eq(boardTasks.userId, userId)),
    with: {
      column: true,
    },
  });

  return task ?? null;
}

/**
 * A column id is caller-supplied. Without this a task could be filed under
 * another user's column, where their column query would pick it up.
 */
async function ensureColumnOwnership(columnId: string, userId: string): Promise<BoardColumn> {
  const column = await db.query.boardColumns.findFirst({
    where: and(eq(boardColumns.id, columnId), eq(boardColumns.userId, userId)),
  });
  if (!column) throw new Error("Column not found");
  return column;
}

/**
 * A task reaching the Done column is finished: it gets its `completedAt`, and
 * a habit's task records the day as done. Leaving the column undoes both.
 */
async function settleCompletion(
  tx: Tx,
  task: Pick<BoardTask, "id" | "roadPathId" | "boardDate" | "completedAt">,
  finished: boolean
): Promise<void> {
  if (finished === (task.completedAt !== null)) return;
  await tx
    .update(boardTasks)
    .set({ completedAt: finished ? new Date() : null })
    .where(eq(boardTasks.id, task.id));
  if (!task.roadPathId) return;
  if (finished) {
    await tx
      .insert(roadPathCheckIns)
      .values({ roadPathId: task.roadPathId, day: task.boardDate, taskId: task.id })
      .onConflictDoNothing();
  } else {
    await tx.delete(roadPathCheckIns).where(eq(roadPathCheckIns.taskId, task.id));
  }
}

/**
 * Number one column's list on one day 0, 1, 2… in its current order. The
 * positional maths assumes no holes and no ties; rows written before the
 * daily board (two cards both at 0) had both.
 */
async function renumber(tx: Tx, userId: string, columnId: string, day: string): Promise<void> {
  await tx.execute(sql`
    UPDATE ${boardTasks} SET "order" = ranked.position
    FROM (
      SELECT id, row_number() OVER (ORDER BY "order", created_at) - 1 AS position
      FROM ${boardTasks}
      WHERE user_id = ${userId} AND column_id = ${columnId} AND board_date = ${day}
    ) AS ranked
    WHERE ${boardTasks.id} = ranked.id
  `);
}

export async function createBoardTask(
  userId: string,
  data: CreateBoardTaskData & { order: number }
): Promise<BoardTask> {
  const column = await ensureColumnOwnership(data.columnId, userId);

  const [task] = await db
    .insert(boardTasks)
    .values({
      userId,
      ...data,
      // Written straight into Done, it is finished from the start.
      completedAt: column.isDone ? new Date() : null,
    })
    .returning();

  return task;
}

/**
 * The form's edits. A new `columnId` is a move — to the end of that column on
 * the task's day — so it goes through `reorderTask`, not a field write that
 * would keep the old position in the new list.
 */
export async function updateBoardTask(
  taskId: string,
  userId: string,
  data: Omit<UpdateBoardTaskData, "id">
): Promise<BoardTask | null> {
  const { columnId, ...fields } = data;
  const current = await getBoardTask(taskId, userId);
  if (!current) return null;

  if (columnId && columnId !== current.columnId) {
    await reorderTask(taskId, userId, columnId, Number.MAX_SAFE_INTEGER);
  }

  const [task] = await db
    .update(boardTasks)
    .set({
      ...fields,
      updatedAt: new Date(),
    })
    .where(and(eq(boardTasks.id, taskId), eq(boardTasks.userId, userId)))
    .returning();

  return task ?? null;
}

async function countTasksInColumn(userId: string, columnId: string, day: string): Promise<number> {
  const rows = await db
    .select({ id: boardTasks.id })
    .from(boardTasks)
    .where(
      and(
        eq(boardTasks.userId, userId),
        eq(boardTasks.columnId, columnId),
        eq(boardTasks.boardDate, day)
      )
    );
  return rows.length;
}

export async function deleteBoardTask(taskId: string, userId: string): Promise<void> {
  const [deleted] = await db
    .delete(boardTasks)
    .where(and(eq(boardTasks.id, taskId), eq(boardTasks.userId, userId)))
    .returning({
      columnId: boardTasks.columnId,
      order: boardTasks.order,
      boardDate: boardTasks.boardDate,
    });
  if (!deleted) return;
  // Close the gap. `reorderTask` treats the drop index as an order VALUE, so a
  // column with holes (0, 2, 3) landed drags one slot off where the UI showed.
  await db
    .update(boardTasks)
    .set({ order: sql`"order" - 1`, updatedAt: new Date() })
    .where(
      and(
        eq(boardTasks.userId, userId),
        eq(boardTasks.columnId, deleted.columnId),
        eq(boardTasks.boardDate, deleted.boardDate),
        gt(boardTasks.order, deleted.order)
      )
    );
}

/**
 * Move a task within its day's board. `requestedOrder` is the drop index
 * measured against the destination list WITH the dragged card still in it,
 * clamped to that list. The source is the task's stored column.
 */
export async function reorderTask(
  taskId: string,
  userId: string,
  destinationColumnId: string,
  requestedOrder: number
): Promise<BoardTaskWithColumn | null> {
  const task = await getBoardTask(taskId, userId);
  if (!task) {
    throw new Error("Task not found");
  }

  const sourceColumnId = task.columnId;
  const oldOrder = task.order;
  const day = task.boardDate;
  const isSameColumn = sourceColumnId === destinationColumnId;
  const destination = isSameColumn
    ? task.column
    : await ensureColumnOwnership(destinationColumnId, userId);
  // A position past the end would leave a hole the next drag lands one off.
  const listLength = await countTasksInColumn(userId, destinationColumnId, day);
  const newOrder = Math.max(0, Math.min(requestedOrder, isSameColumn ? listLength - 1 : listLength));
  const inDay = (columnId: string) =>
    and(
      eq(boardTasks.userId, userId),
      eq(boardTasks.columnId, columnId),
      eq(boardTasks.boardDate, day)
    );

  await db.transaction(async (tx) => {
    const now = new Date();
    if (isSameColumn) {
      if (newOrder > oldOrder) {
        await tx
          .update(boardTasks)
          .set({ order: sql`"order" - 1`, updatedAt: now })
          .where(and(inDay(sourceColumnId), gt(boardTasks.order, oldOrder), lt(boardTasks.order, newOrder + 1)));
      } else if (newOrder < oldOrder) {
        await tx
          .update(boardTasks)
          .set({ order: sql`"order" + 1`, updatedAt: now })
          .where(and(inDay(sourceColumnId), lt(boardTasks.order, oldOrder), gt(boardTasks.order, newOrder - 1)));
      }

      await tx
        .update(boardTasks)
        .set({ order: newOrder, updatedAt: now })
        .where(and(eq(boardTasks.id, taskId), eq(boardTasks.userId, userId)));
      return;
    }

    await tx
      .update(boardTasks)
      .set({ order: sql`"order" - 1`, updatedAt: now })
      .where(and(inDay(sourceColumnId), gt(boardTasks.order, oldOrder)));

    await tx
      .update(boardTasks)
      .set({ order: sql`"order" + 1`, updatedAt: now })
      .where(and(inDay(destinationColumnId), gt(boardTasks.order, newOrder - 1)));

    await tx
      .update(boardTasks)
      .set({ columnId: destinationColumnId, order: newOrder, updatedAt: now })
      .where(and(eq(boardTasks.id, taskId), eq(boardTasks.userId, userId)));

    await settleCompletion(tx, task, destination.isDone);
  });

  return getBoardTask(taskId, userId);
}

export async function getNextTaskOrder(columnId: string, userId: string, day: string): Promise<number> {
  const tasks = await db.query.boardTasks.findMany({
    where: and(
      eq(boardTasks.columnId, columnId),
      eq(boardTasks.userId, userId),
      eq(boardTasks.boardDate, day)
    ),
    orderBy: [desc(boardTasks.order)],
    limit: 1,
  });

  return tasks.length > 0 ? tasks[0].order + 1 : 0;
}

export async function getNextColumnOrder(userId: string): Promise<number> {
  const columns = await db.query.boardColumns.findMany({
    where: eq(boardColumns.userId, userId),
    orderBy: [desc(boardColumns.order)],
    limit: 1,
  });

  return columns.length > 0 ? columns[0].order + 1 : 0;
}

/**
 * What is still open on an earlier day and has not been answered for:
 * not finished, not a habit's task (each due day gets its own, so carrying
 * one over would leave two), and not already left where it was.
 */
export async function getCarryOverCandidates(userId: string, today: string): Promise<CarryOverTask[]> {
  // Filtered in SQL: the history only grows, and this runs on every visit
  // to today's board. Only the column's flag needs the join.
  const tasks = await db.query.boardTasks.findMany({
    where: and(
      eq(boardTasks.userId, userId),
      lt(boardTasks.boardDate, today),
      isNull(boardTasks.completedAt),
      isNull(boardTasks.roadPathId),
      isNull(boardTasks.carryOverDeclinedAt)
    ),
    with: { column: true },
  });

  return tasks
    .filter((task) => !task.column.isDone)
    .sort((a, b) => a.boardDate.localeCompare(b.boardDate) || a.column.order - b.column.order || a.order - b.order)
    .map((task) => ({
      id: task.id,
      title: task.title,
      columnId: task.columnId,
      columnName: task.column.name,
      boardDate: task.boardDate,
    }));
}

export type CarryOverResult = { moved: number; left: number };

/**
 * Answer the carry-over question. Moved tasks keep their column and go to the
 * top of it on today's board, oldest first; the rest stay on their own day
 * and are not offered again. Ids that are not on offer are ignored.
 */
export async function carryOverTasks(
  userId: string,
  today: string,
  moveIds: readonly string[],
  leaveIds: readonly string[]
): Promise<CarryOverResult> {
  const candidates = await getCarryOverCandidates(userId, today);
  const moving = new Set(moveIds);
  const toMove = candidates.filter((task) => moving.has(task.id));
  const leaving = new Set(leaveIds);
  const toLeave = candidates.filter((task) => leaving.has(task.id) && !moving.has(task.id));
  if (toMove.length === 0 && toLeave.length === 0) return { moved: 0, left: 0 };

  await db.transaction(async (tx) => {
    const now = new Date();
    const sources = new Map<string, { columnId: string; day: string }>();
    const byColumn = new Map<string, CarryOverTask[]>();
    for (const task of toMove) {
      sources.set(`${task.columnId}|${task.boardDate}`, { columnId: task.columnId, day: task.boardDate });
      byColumn.set(task.columnId, [...(byColumn.get(task.columnId) ?? []), task]);
    }

    for (const [columnId, tasks] of byColumn) {
      // Ahead of everything already on today's list, then renumbered.
      for (const [index, task] of tasks.entries()) {
        await tx
          .update(boardTasks)
          .set({ boardDate: today, order: index - tasks.length, updatedAt: now })
          .where(and(eq(boardTasks.id, task.id), eq(boardTasks.userId, userId)));
      }
      await renumber(tx, userId, columnId, today);
    }
    for (const { columnId, day } of sources.values()) {
      await renumber(tx, userId, columnId, day);
    }

    if (toLeave.length > 0) {
      await tx
        .update(boardTasks)
        .set({ carryOverDeclinedAt: now })
        .where(
          and(
            eq(boardTasks.userId, userId),
            inArray(
              boardTasks.id,
              toLeave.map((task) => task.id)
            )
          )
        );
    }
  });

  return { moved: toMove.length, left: toLeave.length };
}

/**
 * Put a task from another day on `day`'s board, at the end of its column.
 * A habit's task stays on its own day: that day is the one it counts for.
 */
export async function moveTaskToDay(taskId: string, userId: string, day: string): Promise<BoardTask | null> {
  const task = await getBoardTask(taskId, userId);
  if (!task) return null;
  if (task.roadPathId) throw new Error("A road path's task stays on its own day");
  if (task.boardDate === day) return task;

  const order = await getNextTaskOrder(task.columnId, userId, day);
  return db.transaction(async (tx) => {
    const [moved] = await tx
      .update(boardTasks)
      .set({ boardDate: day, order, carryOverDeclinedAt: null, updatedAt: new Date() })
      .where(and(eq(boardTasks.id, taskId), eq(boardTasks.userId, userId)))
      .returning();
    await renumber(tx, userId, task.columnId, task.boardDate);
    return moved ?? null;
  });
}
