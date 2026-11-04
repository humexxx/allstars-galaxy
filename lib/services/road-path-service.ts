import "server-only";

import { db } from "@/db";
import {
  roadPaths,
  roadPathMilestones,
  roadPathProgress,
  roadPathCheckIns,
  boardTasks,
} from "@/db/schema";
import { eq, and, asc, desc, gte, isNull } from "drizzle-orm";
import type {
  RoadPath,
  RoadPathDetail,
  RoadPathWithCheckIns,
  RoadPathWithDetails,
  RoadPathMilestone,
  RoadPathProgress,
  RoadPathStats,
} from "@/types";
import {
  checkInMessage,
  habitOf,
  habitStats,
  hasSchedule,
  normalizeSchedule,
} from "@/lib/productivity/habit";
import type {
  CreateRoadPathData,
  UpdateRoadPathData,
  CreateRoadPathMilestoneData,
  UpdateRoadPathMilestoneData,
  CreateRoadPathProgressData,
} from "@/schemas/road-path";

import { ensureOwnedRow } from "./ownership";

async function ensureRoadPathOwnership(roadPathId: string, userId: string): Promise<void> {
  await ensureOwnedRow({
    table: roadPaths,
    idColumn: roadPaths.id,
    id: roadPathId,
    userId,
    entity: "Road path",
  });
}

export async function getUserRoadPaths(userId: string): Promise<RoadPathWithCheckIns[]> {
  return db.query.roadPaths.findMany({
    where: eq(roadPaths.userId, userId),
    orderBy: [desc(roadPaths.createdAt)],
    with: {
      checkIns: { orderBy: [asc(roadPathCheckIns.day)] },
    },
  });
}

export async function getRoadPath(roadPathId: string, userId: string): Promise<RoadPathWithDetails | null> {
  const path = await db.query.roadPaths.findFirst({
    where: and(eq(roadPaths.id, roadPathId), eq(roadPaths.userId, userId)),
    with: {
      milestones: {
        orderBy: [asc(roadPathMilestones.order)],
      },
      progress: {
        orderBy: [desc(roadPathProgress.date), desc(roadPathProgress.createdAt)],
      },
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
      targetValue: data.targetValue?.toString(),
      unit: data.unit,
      startDate: data.startDate,
      targetDate: data.targetDate,
      scheduleDays: scheduleDays.length > 0 ? scheduleDays : null,
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

  const { targetValue, scheduleDays, ...rest } = data;

  const updateData: Partial<typeof roadPaths.$inferInsert> = {
    ...rest,
    updatedAt: new Date(),
  };

  if (targetValue !== undefined) {
    updateData.targetValue = targetValue?.toString() ?? null;
  }
  if (scheduleDays !== undefined) {
    const next = normalizeSchedule(scheduleDays);
    if (next.join() !== normalizeSchedule(current.scheduleDays).join()) {
      updateData.scheduleDays = next.length > 0 ? next : null;
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

export async function deleteRoadPath(roadPathId: string, userId: string): Promise<void> {
  await db.delete(roadPaths).where(and(eq(roadPaths.id, roadPathId), eq(roadPaths.userId, userId)));
}

export async function createRoadPathMilestone(
  userId: string,
  /** `order` is resolved by the caller — see `createRoadPathMilestoneAction`. */
  data: CreateRoadPathMilestoneData & { order: number }
): Promise<RoadPathMilestone> {
  await ensureRoadPathOwnership(data.roadPathId, userId);

  const [milestone] = await db
    .insert(roadPathMilestones)
    .values({
      roadPathId: data.roadPathId,
      title: data.title,
      description: data.description,
      targetValue: data.targetValue?.toString(),
      order: data.order,
    })
    .returning();

  return milestone;
}

export async function updateRoadPathMilestone(
  milestoneId: string,
  userId: string,
  data: Omit<UpdateRoadPathMilestoneData, "id">
): Promise<RoadPathMilestone | null> {
  const milestone = await db.query.roadPathMilestones.findFirst({
    where: eq(roadPathMilestones.id, milestoneId),
    with: {
      roadPath: true,
    },
  });

  if (!milestone || milestone.roadPath.userId !== userId) {
    throw new Error("Milestone not found");
  }

  const { targetValue, ...rest } = data;

  const updateData: Partial<typeof roadPathMilestones.$inferInsert> = {
    ...rest,
    updatedAt: new Date(),
  };

  if (targetValue !== undefined) {
    updateData.targetValue = targetValue?.toString() ?? null;
  }

  const [updatedMilestone] = await db
    .update(roadPathMilestones)
    .set(updateData)
    .where(
      and(
        eq(roadPathMilestones.id, milestoneId),
        eq(roadPathMilestones.roadPathId, milestone.roadPathId)
      )
    )
    .returning();

  // Deleted between the ownership read and the write.
  return updatedMilestone ?? null;
}

export async function deleteRoadPathMilestone(milestoneId: string, userId: string): Promise<void> {
  const milestone = await db.query.roadPathMilestones.findFirst({
    where: eq(roadPathMilestones.id, milestoneId),
    with: {
      roadPath: true,
    },
  });

  if (!milestone || milestone.roadPath.userId !== userId) {
    throw new Error("Milestone not found");
  }

  await db
    .delete(roadPathMilestones)
    .where(
      and(
        eq(roadPathMilestones.id, milestoneId),
        eq(roadPathMilestones.roadPathId, milestone.roadPathId)
      )
    );
}

export async function getNextMilestoneOrder(roadPathId: string, userId: string): Promise<number> {
  await ensureRoadPathOwnership(roadPathId, userId);

  const milestones = await db.query.roadPathMilestones.findMany({
    where: eq(roadPathMilestones.roadPathId, roadPathId),
    orderBy: [desc(roadPathMilestones.order)],
    limit: 1,
  });

  return milestones.length > 0 ? milestones[0].order + 1 : 0;
}

export async function createRoadPathProgress(
  userId: string,
  data: CreateRoadPathProgressData
): Promise<RoadPathProgress> {
  await ensureRoadPathOwnership(data.roadPathId, userId);

  return await db.transaction(async (tx) => {
    const [progress] = await tx
      .insert(roadPathProgress)
      .values({
        roadPathId: data.roadPathId,
        value: data.value.toString(),
        notes: data.notes,
        date: data.date ?? new Date(),
      })
      .returning();

    // currentValue is the NEWEST entry by date, not the last one typed: a
    // backdated entry used to overwrite a more recent figure. Form entries
    // land on the day's midnight, so two on the same day tie — the later
    // one written wins.
    const latest = await tx.query.roadPathProgress.findFirst({
      where: eq(roadPathProgress.roadPathId, data.roadPathId),
      orderBy: [desc(roadPathProgress.date), desc(roadPathProgress.createdAt)],
    });
    await tx
      .update(roadPaths)
      .set({
        currentValue: latest?.value ?? data.value.toString(),
        updatedAt: new Date(),
      })
      .where(and(eq(roadPaths.id, data.roadPathId), eq(roadPaths.userId, userId)));

    return progress;
  });
}

export async function deleteRoadPathProgress(progressId: string, userId: string): Promise<void> {
  const progress = await db.query.roadPathProgress.findFirst({
    where: eq(roadPathProgress.id, progressId),
    with: {
      roadPath: true,
    },
  });

  if (!progress || progress.roadPath.userId !== userId) {
    throw new Error("Progress entry not found");
  }

  await db
    .delete(roadPathProgress)
    .where(
      and(
        eq(roadPathProgress.id, progressId),
        eq(roadPathProgress.roadPathId, progress.roadPathId)
      )
    );

  const latestProgress = await db.query.roadPathProgress.findFirst({
    where: eq(roadPathProgress.roadPathId, progress.roadPathId),
    orderBy: [desc(roadPathProgress.date), desc(roadPathProgress.createdAt)],
  });

  // No entries left means no progress — the deleted figure must not linger.
  await db
    .update(roadPaths)
    .set({
      currentValue: latestProgress?.value ?? "0",
      updatedAt: new Date(),
    })
    .where(and(eq(roadPaths.id, progress.roadPathId), eq(roadPaths.userId, userId)));
}

/**
 * One road path with its stats, from a single read — the percentage and the
 * figure under it have to come from the same row or they disagree on screen
 * the moment progress is logged. `today` and `timeZone` are the reader's.
 */
export async function getRoadPathDetail(
  roadPathId: string,
  userId: string,
  today: string,
  timeZone: string
): Promise<RoadPathDetail | null> {
  const roadPath = await getRoadPath(roadPathId, userId);
  if (!roadPath) return null;
  return { roadPath, stats: computeRoadPathStats(roadPath, today, timeZone) };
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

export function computeRoadPathStats(
  path: RoadPathWithDetails,
  today: string,
  timeZone: string
): RoadPathStats {
  const targetValue = parseFloat(path.targetValue || "0");
  const currentValue = parseFloat(path.currentValue || "0");

  // Clamped so both the card and the detail agree, and a bar never exceeds
  // 100% or runs negative.
  const totalProgress =
    targetValue > 0 ? Math.max(0, Math.min(100, (currentValue / targetValue) * 100)) : 0;

  const habit = habitOf(path, timeZone);

  return {
    totalProgress,
    completedMilestones: path.milestones.filter((m) => m.completedAt !== null).length,
    totalMilestones: path.milestones.length,
    habit:
      hasSchedule(habit) || path.checkIns.length > 0
        ? habitStats(habit, path.checkIns.map((c) => c.day), today)
        : null,
  };
}
