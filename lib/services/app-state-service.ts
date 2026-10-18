import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appState } from "@/db/schema";

/**
 * Record a job's last run (and its error, if it failed) under `key`.
 *
 * An upsert: the old find-then-insert raced a second run into a primary-key
 * violation.
 */
export async function setAppState(
  key: string,
  value: string,
  error: string | null = null
): Promise<void> {
  const updatedAt = new Date();
  await db
    .insert(appState)
    .values({ key, value, error, updatedAt })
    .onConflictDoUpdate({ target: appState.key, set: { value, error, updatedAt } });
}

/** The value stored under `key`, or null when nothing has been recorded. */
export async function getAppStateValue(key: string): Promise<string | null> {
  const row = await db.query.appState.findFirst({
    where: eq(appState.key, key),
    columns: { value: true },
  });
  return row?.value ?? null;
}
