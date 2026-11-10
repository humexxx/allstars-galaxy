import "server-only";

import { db } from "@/db";
import { roadPaths, roadPathCheckIns, boardTasks } from "@/db/schema";
import { eq, and, asc, desc, gte, inArray, isNull, sql } from "drizzle-orm";
import type { RoadPath, RoadPathDetail, RoadPathWithCheckIns } from "@/types";
import {
  checkInMessage,
  habitOf,
  habitStats,
  normalizeSchedule,
} from "@/lib/productivity/habit";
import type { CreateRoadPathData, UpdateRoadPathData } from "@/schemas/road-path";

/** In the order the user dragged them into; one never placed comes first, newest first. */
export async function getUserRoadPaths(userId: string): Promise<RoadPathWithCheckIns[]> {
  return db.query.roadPaths.findMany({
    where: eq(roadPaths.userId, userId),
    orderBy: [sql`${roadPaths.position} asc nulls first`, desc(roadPaths.createdAt)],
    with: {
      checkIns: { orderBy: [asc(roadPathCheckIns.day)] },
    },
  });
}

export async function getRoadPath(roadPathId: string, userId: string): Promise<RoadPathWithCheckIns | null> {
  const path = await db.query.roadPaths.findFirst({
    where: and(eq(roadPaths.id, roadPathId), eq(roadPaths.userId, userId)),
    with: {
      checkIns: { orderBy: [asc(roadPathCheckIns.day)] },
    },
  });

  return path ?? null;
}

function dayOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * `today` is the reader's day. The schedule judges from the later of the
 * start day and today: a path started in the past cannot be checked in for
 * those days, so they would only ever read as missed.
 */
export async function createRoadPath(
  userId: string,
  data: CreateRoadPathData,
  today: string
): Promise<RoadPath> {
  const scheduleDays = normalizeSchedule(data.scheduleDays);
  const startDay = dayOf(data.startDate);
  const [path] = await db
    .insert(roadPaths)
    .values({
      userId,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      scheduleDays,
      scheduleSince: startDay > today ? startDay : today,
    })
    .returning();

  return path;
}

/**
 * A changed schedule takes effect today, so the days before it are not
 * re-judged by days they were never due on. A new title follows onto the
 * path's open tasks from today on that still carry the old one.
 */
export async function updateRoadPath(
  roadPathId: string,
  userId: string,
  data: Omit<UpdateRoadPathData, "id">,
  today: string
): Promise<RoadPath | null> {
  const current = await db.query.roadPaths.findFirst({
    where: and(eq(roadPaths.id, roadPathId), eq(roadPaths.userId, userId)),
  });
  if (!current) return null;

  const { scheduleDays, ...rest } = data;

  const updateData: Partial<typeof roadPaths.$inferInsert> = {
    ...rest,
    // A road path is a habit now: whatever goal it carried from the old
    // model goes the first time it is saved.
    targetValue: null,
    unit: null,
    targetDate: null,
    updatedAt: new Date(),
  };

  if (scheduleDays !== undefined) {
    const next = normalizeSchedule(scheduleDays);
    if (next.join() !== normalizeSchedule(current.scheduleDays).join()) {
      updateData.scheduleDays = next;
      updateData.scheduleSince = today;
    }
  }

  return db.transaction(async (tx) => {
    const [path] = await tx
      .update(roadPaths)
      .set(updateData)
      .where(and(eq(roadPaths.id, roadPathId), eq(roadPaths.userId, userId)))
      .returning();

    if (path && data.title !== undefined && data.title !== current.title) {
      await tx
        .update(boardTasks)
        .set({ title: data.title, updatedAt: new Date() })
        .where(
          and(
            eq(boardTasks.userId, userId),
            eq(boardTasks.roadPathId, roadPathId),
            eq(boardTasks.title, current.title),
            gte(boardTasks.boardDate, today),
            isNull(boardTasks.completedAt)
          )
        );
    }

    return path ?? null;
  });
}

/**
 * Puts the user's road paths in `ids`' order, in one statement. Every one of
 * them must be the user's and listed once, and no other is touched; false
 * (nothing written) otherwise.
 */
export async function reorderRoadPaths(userId: string, ids: readonly string[]): Promise<boolean> {
  const owned = await db
    .select({ id: roadPaths.id })
    .from(roadPaths)
    .where(and(eq(roadPaths.userId, userId), inArray(roadPaths.id, [...ids])));
  if (new Set(ids).size !== ids.length || owned.length !== ids.length) return false;
  const places = ids.map((id, position) => sql`when ${id}::uuid then ${position}::int`);
  await db
    .update(roadPaths)
    .set({ position: sql<number>`case ${roadPaths.id} ${sql.join(places, sql` `)} end` })
    .where(and(eq(roadPaths.userId, userId), inArray(roadPaths.id, [...ids])));
  return true;
}

export async function deleteRoadPath(roadPathId: string, userId: string): Promise<void> {
  await db.delete(roadPaths).where(and(eq(roadPaths.id, roadPathId), eq(roadPaths.userId, userId)));
}

/** One road path and how its habit is going. `today` and `timeZone` are the reader's. */
export async function getRoadPathDetail(
  roadPathId: string,
  userId: string,
  today: string,
  timeZone: string
): Promise<RoadPathDetail | null> {
  const roadPath = await getRoadPath(roadPathId, userId);
  if (!roadPath) return null;
  return {
    roadPath,
    stats: habitStats(habitOf(roadPath, timeZone), roadPath.checkIns.map((c) => c.day), today),
  };
}

/**
 * The line the board shows when a habit's task has just been checked in for
 * `day`: the streak that makes, against the best run before it.
 */
export async function getCheckInMessage(
  roadPathId: string,
  userId: string,
  day: string,
  today: string,
  timeZone: string
): Promise<string | null> {
  const path = await getRoadPath(roadPathId, userId);
  if (!path) return null;
  const habit = habitOf(path, timeZone);
  const days = path.checkIns.map((c) => c.day);
  const now = habitStats(habit, days, today);
  const before = habitStats(
    habit,
    days.filter((d) => d !== day),
    today
  );
  return checkInMessage(path.title, now.currentStreak, before.bestStreak);
}
