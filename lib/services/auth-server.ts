import "server-only";

import { createClient } from "@/lib/supabase-server";
import { headers } from "next/headers";

import { decodeSessionUser, SESSION_USER_HEADER, type SessionUser } from "@/lib/auth/session-header";
import { cache } from "react";

import { getUserAccessRow } from "./user-access-row";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/user";

async function fetchCurrentUser(): Promise<SessionUser | null> {
  // The proxy verified this request's session already and handed the user on.
  const verified = decodeSessionUser((await headers()).get(SESSION_USER_HEADER));
  if (verified) return verified;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function fetchUserRole(userId: string): Promise<UserRole | null> {
  return (await getUserAccessRow(userId))?.role || null;
}

export const getCurrentUserCached = cache(fetchCurrentUser);
export const getUserRoleCached = cache(fetchUserRole);

// Server-side auth utilities
export async function getCurrentUser(): Promise<SessionUser | null> {
  return fetchCurrentUser();
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  return fetchUserRole(userId);
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAuthCached(): Promise<SessionUser> {
  const user = await getCurrentUserCached();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  const role = await getUserRole(user.id);
  
  if (role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  
  return user;
}

export async function requireAdminCached(): Promise<SessionUser> {
  const user = await requireAuthCached();
  const role = await getUserRoleCached(user.id);

  if (role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}

/** True for the two errors the gates above throw on purpose. */
function isAuthGateError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === "Unauthorized" || err.message.startsWith("Forbidden"))
  );
}

export async function requireAdminOrRedirect(fallback = "/portal"): Promise<SessionUser> {
  try {
    return await requireAdminCached();
  } catch (err) {
    // Only "not signed in / not an admin" means "go elsewhere". A database
    // outage swallowed here became a silent bounce to the dashboard, which
    // looks exactly like a permissions bug.
    if (isAuthGateError(err)) redirect(fallback);
    throw err;
  }
}

/**
 * May this account create investment methods?
 *
 * This is the ONLY question the `provider` role answers. Which methods someone
 * already runs comes from `investment_methods.owner_user_id`, and every
 * ownership check in the app reads that instead — restating it in the role
 * would give two sources of truth that can disagree.
 *
 * Admins pass because an admin can do anything a provider can.
 */
export async function requireProvider(): Promise<SessionUser> {
  const user = await requireAuth();
  const role = await getUserRole(user.id);

  if (role !== "provider" && role !== "admin") {
    throw new Error("Forbidden: provider access required");
  }

  return user;
}

/** Non-throwing form, for deciding whether to render an affordance. */
export async function isProvider(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "provider" || role === "admin";
}
