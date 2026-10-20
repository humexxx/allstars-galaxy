import "server-only";

import { db } from "@/db";
import { roadPaths, boardTasks } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import type { BoardTask } from "@/types";
import { habitOf, isDueOn } from "@/lib/productivity/habit";
import { calendarDayInTimeZone } from "@/lib/utils/date";
import { getBoardColumns, getNextTaskOrder } from "./board-service";

/**
 * Put `day`'s habit tasks on the board: one per road path due that day, in
 * the first column that is not Done.
 *
 * It runs when the board for the reader's today is opened, not on a cron: a
 * day is a day in the reader's zone, which the server only learns from the
 * request, and a midnight-UTC job put Costa Rica's Monday task on the board
 * at 6 pm on Sunday, already dated the day before.
 *
 * A path generates at most once a day (`lastTaskCreatedAt`), so a task the
 * owner deleted does not come back on the next load; the unique index on
 * (road path, day) keeps two tabs loading at once from writing it twice.
 */
export async function ensureHabitTasksForDay(
  userId: string,
  day: string,
  timeZone: string
): Promise<BoardTask[]> {
  const paths = await db.query.roadPaths.findMany({
    where: and(eq(roadPaths.userId, userId), isNull(roadPaths.completedAt)),
  });

  const due = paths.filter((path) => {
    if (!isDueOn(habitOf(path, timeZone), day)) return false;
    if (!path.lastTaskCreatedAt) return true;
    const generatedOn = calendarDayInTimeZone(path.lastTaskCreatedAt, timeZone)
      .toISOString()
      .slice(0, 10);
    return generatedOn < day;
  });
  if (due.length === 0) return [];

  const column = (await getBoardColumns(userId)).find((c) => !c.isDone);
  if (!column) return [];

  const baseOrder = await getNextTaskOrder(column.id, userId, day);
  const now = new Date();

  return db.transaction(async (tx) => {
    const created = await tx
      .insert(boardTasks)
      .values(
        due.map((path, index) => ({
          userId,
          columnId: column.id,
          roadPathId: path.id,
          title: path.title,
          description: path.description,
          order: baseOrder + index,
          boardDate: day,
        }))
      )
      .onConflictDoNothing()
      .returning();

    await tx
      .update(roadPaths)
      .set({ lastTaskCreatedAt: now })
      .where(
        and(
          eq(roadPaths.userId, userId),
          inArray(
            roadPaths.id,
            due.map((path) => path.id)
          )
        )
      );

    return created;
  });
}
