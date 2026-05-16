import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { impersonationLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import {
  getCurrentUserCached,
  getUserRoleCached,
} from "./auth-server";

export const IMPERSONATION_COOKIE = "cg_impersonating";

export type EffectiveContext = {
  realUser: User;
  realRole: "admin" | "user" | null;
  impersonatedUser: { id: string; email: string | null; fullName: string | null } | null;
  effectiveUserId: string;
  isImpersonating: boolean;
};

async function loadEffectiveContext(): Promise<EffectiveContext | null> {
  const realUser = await getCurrentUserCached();
  if (!realUser) return null;

  const realRole = await getUserRoleCached(realUser.id);

  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  // Only admins can impersonate. If a non-admin somehow has the cookie, ignore it.
  if (!impersonatedUserId || realRole !== "admin") {
    return {
      realUser,
      realRole,
      impersonatedUser: null,
      effectiveUserId: realUser.id,
      isImpersonating: false,
    };
  }

  const [target] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, impersonatedUserId));

  if (!target) {
    return {
      realUser,
      realRole,
      impersonatedUser: null,
      effectiveUserId: realUser.id,
      isImpersonating: false,
    };
  }

  return {
    realUser,
    realRole,
    impersonatedUser: target,
    effectiveUserId: target.id,
    isImpersonating: true,
  };
}

export const getEffectiveContext = cache(loadEffectiveContext);

export async function requireEffectiveContext(): Promise<EffectiveContext> {
  const ctx = await getEffectiveContext();
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}

/**
 * Persist a row in impersonation_logs only when the current request is running
 * under an active impersonation session. No-op for normal admin/user activity.
 *
 * `before` / `after` are captured into the metadata column for forensic auditing
 * of updates and deletes (so admins can answer "what did I change?" later).
 */
export async function logImpersonatedMutation(params: {
  action: string;
  entityTable?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const ctx = await getEffectiveContext();
  if (!ctx?.isImpersonating || !ctx.impersonatedUser) return;

  const metadata: Record<string, unknown> = { ...(params.metadata ?? {}) };
  if (params.before !== undefined) metadata.before = params.before;
  if (params.after !== undefined) metadata.after = params.after;

  await db.insert(impersonationLogs).values({
    adminId: ctx.realUser.id,
    impersonatedUserId: ctx.impersonatedUser.id,
    action: params.action,
    entityTable: params.entityTable,
    entityId: params.entityId,
    metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
  });
}
