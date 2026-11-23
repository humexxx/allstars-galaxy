import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * A user's role and switched-off modules, read in one query and shared by the
 * request: every portal page needs both before it can draw, and two separate
 * reads cost two round trips to the database in a row.
 */
export const getUserAccessRow = cache(async function getUserAccessRow(
  userId: string
): Promise<{ role: (typeof users.$inferSelect)["role"] | null; disabledModules: string[] | null } | null> {
  const [row] = await db
    .select({ role: users.role, disabledModules: users.disabledModules })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
});
