import "server-only";

import { and, eq, isNull, or, type SQL } from "drizzle-orm";

import { financePlanConfirmations, financePlanSnapshots } from "@/db/schema";

import { getMainPlan } from "./finance-plan-service";

/**
 * The user's one timeline: every snapshot and confirmation is the USER's, not
 * a plan's. Only the main plan writes them; every plan reads them as its
 * past and calibrates from the latest confirmation, so the past is drawn
 * once and each plan only differs from today on.
 *
 * Code older than this wrote rows for every plan and without `user_id`. Those
 * count only when the plan that wrote them is the current main plan, so a
 * what-if plan's own records never reach the timeline.
 */
export type HistoryOwner = { userId: string; mainPlanId: string | null };

export async function historyOwner(userId: string): Promise<HistoryOwner> {
  return { userId, mainPlanId: (await getMainPlan(userId))?.id ?? null };
}

type Owned = typeof financePlanSnapshots | typeof financePlanConfirmations;

function ownedBy(table: Owned, owner: HistoryOwner): SQL {
  const legacy = owner.mainPlanId
    ? and(isNull(table.userId), eq(table.planId, owner.mainPlanId))
    : undefined;
  return (legacy ? or(eq(table.userId, owner.userId), legacy) : eq(table.userId, owner.userId)) as SQL;
}

/** The user's snapshots. */
export const snapshotsOf = (owner: HistoryOwner): SQL => ownedBy(financePlanSnapshots, owner);

/** The user's confirmations. */
export const confirmationsOf = (owner: HistoryOwner): SQL => ownedBy(financePlanConfirmations, owner);

/**
 * The debt a line stands for across plans: a copy carries its source's key,
 * and a line with none is its own (every debt from before copies had keys).
 */
export function debtKeyOf(debt: { id: string; debtKey?: string | null }): string {
  return debt.debtKey ?? debt.id;
}

/** The key a recorded balance names: its own, or the debt it was read from. */
export function recordedDebtKey(row: { debtId: string | null; debtKey: string | null }): string | null {
  return row.debtKey ?? row.debtId;
}
