import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { parseDisabledModules, type AppModule } from "@/lib/access/modules";

import { requireEffectiveContext, type EffectiveContext } from "./impersonation";

/** A module the account may not use, refused by an action or a route. */
export class ModuleDisabledError extends Error {
  constructor(readonly module: AppModule) {
    super(`The ${module} module is not enabled for this account`);
  }
}

/** The modules an admin turned off for this account. Request-cached: the nav, the page and its cards all ask. */
export const getDisabledModules = cache(async function getDisabledModules(userId: string): Promise<AppModule[]> {
  const [row] = await db
    .select({ disabledModules: users.disabledModules })
    .from(users)
    .where(eq(users.id, userId));
  return parseDisabledModules(row?.disabledModules);
});

export async function isModuleEnabled(userId: string, module: AppModule): Promise<boolean> {
  return !(await getDisabledModules(userId)).includes(module);
}

/**
 * A module page's gate: the effective user (the impersonated one, while an
 * admin impersonates) must have the module, or the page sends them to the
 * dashboard before it reads anything. Replaces `requireEffectiveContext()`.
 */
export async function requireModulePage(module: AppModule): Promise<EffectiveContext> {
  const ctx = await requireEffectiveContext();
  if (!(await isModuleEnabled(ctx.effectiveUserId, module))) redirect("/portal");
  return ctx;
}

/** The same gate for a module's actions and routes: throws `ModuleDisabledError`. */
export async function requireModuleContext(module: AppModule): Promise<EffectiveContext> {
  const ctx = await requireEffectiveContext();
  if (!(await isModuleEnabled(ctx.effectiveUserId, module))) throw new ModuleDisabledError(module);
  return ctx;
}

/** Turns one module on or off for an account. False when no user has that id. */
export async function setModuleEnabled(userId: string, module: AppModule, enabled: boolean): Promise<boolean> {
  const [row] = await db
    .select({ disabledModules: users.disabledModules })
    .from(users)
    .where(eq(users.id, userId));
  if (!row) return false;
  const current = parseDisabledModules(row.disabledModules);
  const next = enabled ? current.filter((m) => m !== module) : [...new Set([...current, module])];
  await db.update(users).set({ disabledModules: next, updatedAt: new Date() }).where(eq(users.id, userId));
  return true;
}
