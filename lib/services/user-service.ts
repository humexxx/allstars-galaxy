import "server-only";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { UserListItem } from "@/types";
import type { UserRole } from "@/types/user";

export async function getAllUsers(): Promise<UserListItem[]> {
  return await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .orderBy(sql`${users.fullName} NULLS LAST, ${users.email}`);
}

/** False when no user has that id, so the caller can say so. */
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<boolean> {
  const updated = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return updated.length > 0;
}
