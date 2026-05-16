import { createClient } from "@/lib/supabase-server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";

async function fetchCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function fetchUserRole(userId: string): Promise<"admin" | "user" | null> {
  const [dbUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  
  return dbUser?.role || null;
}

export const getCurrentUserCached = cache(fetchCurrentUser);
export const getUserRoleCached = cache(fetchUserRole);

// Server-side auth utilities
export async function getCurrentUser(): Promise<User | null> {
  return fetchCurrentUser();
}

export async function getUserRole(userId: string): Promise<"admin" | "user" | null> {
  return fetchUserRole(userId);
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAuthCached(): Promise<User> {
  const user = await getCurrentUserCached();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  const role = await getUserRole(user.id);
  
  if (role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  
  return user;
}

export async function requireAdminCached(): Promise<User> {
  const user = await requireAuthCached();
  const role = await getUserRoleCached(user.id);

  if (role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}

export async function requireAdminOrRedirect(fallback = "/portal"): Promise<User> {
  try {
    return await requireAdminCached();
  } catch {
    redirect(fallback);
  }
}
