import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { DEFAULT_FINANCE_MILESTONES } from "@/lib/finance/milestones";

export type UserPreferences = {
  showContextAvatar: boolean;
  /** Net-worth milestones annotated on the projection charts. */
  financeMilestones: number[];
};

// Defaults live here (not in the DB) so a user without a row — i.e. anyone
// who never touched settings — gets them without a backfill.
const DEFAULT_PREFERENCES: UserPreferences = {
  showContextAvatar: true,
  financeMilestones: [...DEFAULT_FINANCE_MILESTONES],
};

export async function getUserPreferences(
  userId: string
): Promise<UserPreferences> {
  const row = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!row) return DEFAULT_PREFERENCES;
  return {
    showContextAvatar: row.showContextAvatar,
    // NULL = never customised. An empty array IS a choice ("no milestones"),
    // so only null falls back.
    financeMilestones: row.financeMilestones ?? [...DEFAULT_FINANCE_MILESTONES],
  };
}

export async function setFinanceMilestones(
  userId: string,
  milestones: number[]
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, financeMilestones: milestones })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { financeMilestones: milestones, updatedAt: new Date() },
    });
}

export async function setShowContextAvatar(
  userId: string,
  show: boolean
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, showContextAvatar: show })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { showContextAvatar: show, updatedAt: new Date() },
    });
}
