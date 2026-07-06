import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userPreferences } from "@/db/schema";

export type UserPreferences = {
  showContextAvatar: boolean;
};

// Defaults live here (not in the DB) so a user without a row — i.e. anyone
// who never touched settings — gets them without a backfill.
const DEFAULT_PREFERENCES: UserPreferences = {
  showContextAvatar: true,
};

export async function getUserPreferences(
  userId: string
): Promise<UserPreferences> {
  const row = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!row) return DEFAULT_PREFERENCES;
  return { showContextAvatar: row.showContextAvatar };
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
