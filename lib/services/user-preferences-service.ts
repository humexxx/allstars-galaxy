import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { DEFAULT_FINANCE_MILESTONES } from "@/lib/finance/milestones";
import {
  DEFAULT_MASCOT_CHARACTER,
  MASCOT_CHARACTERS,
  type MascotCharacter,
  type UserPreferences,
} from "@/types/preferences";

// Defaults live here (not in the DB) so a user without a row — i.e. anyone
// who never touched settings — gets them without a backfill.
const DEFAULT_PREFERENCES: UserPreferences = {
  showContextAvatar: true,
  mascotCharacter: DEFAULT_MASCOT_CHARACTER,
  financeMilestones: [...DEFAULT_FINANCE_MILESTONES],
};

/** A stored id this build no longer draws (a character removed later) reads as the default. */
function toMascotCharacter(value: string): MascotCharacter {
  return (MASCOT_CHARACTERS as readonly string[]).includes(value)
    ? (value as MascotCharacter)
    : DEFAULT_MASCOT_CHARACTER;
}

/**
 * Request-cached: the plans layout and the plan page both read it during one
 * render.
 */
export const getUserPreferences = cache(async function getUserPreferences(
  userId: string
): Promise<UserPreferences> {
  const row = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!row) return DEFAULT_PREFERENCES;
  return {
    showContextAvatar: row.showContextAvatar,
    mascotCharacter: toMascotCharacter(row.mascotCharacter),
    // NULL = never customised. An empty array IS a choice ("no milestones"),
    // so only null falls back.
    financeMilestones: row.financeMilestones ?? [...DEFAULT_FINANCE_MILESTONES],
  };
});

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

export async function setMascotCharacter(
  userId: string,
  character: MascotCharacter
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, mascotCharacter: character })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { mascotCharacter: character, updatedAt: new Date() },
    });
}
