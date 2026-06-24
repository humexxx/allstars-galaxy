import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  financePlanConfirmations,
  financePlanDebtConfirmations,
  financePlans,
} from "@/db/schema";

import {
  nextPeriodStart,
  periodAnchorIso,
  periodStartFor,
} from "@/lib/finance/period";

import { getPlanWithLines } from "./finance-plan-service";
import {
  createConfirmationSnapshot,
  getProjectedStateForMonth,
} from "./finance-snapshot-service";
import type {
  ConfirmationWithDebts,
  FinancePlanConfirmation,
  FinancePlanWithLines,
  ProjectionMonth,
} from "@/types/finance";

// ---------- helpers ----------

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves the bucket the confirmation belongs to. With the period-anchored
 * model, the bucket key is the start date of the period containing `today`.
 * confirmationDayOfMonth=0 (feature disabled) falls back to day=1, which is
 * equivalent to bucketing by calendar month — what the engine did before.
 */
function periodAnchorFor(today: Date, day: number): Date {
  return periodStartFor(today, day > 0 ? day : 1);
}

async function ensurePlanOwnership(
  planId: string,
  userId: string
): Promise<{ confirmationDayOfMonth: number }> {
  const [row] = await db
    .select({
      userId: financePlans.userId,
      confirmationDayOfMonth: financePlans.confirmationDayOfMonth,
    })
    .from(financePlans)
    .where(eq(financePlans.id, planId));
  if (!row || row.userId !== userId) {
    throw new Error("Plan not found");
  }
  return { confirmationDayOfMonth: row.confirmationDayOfMonth };
}

// ---------- public API ----------

/**
 * Latest user confirmation for a plan plus its per-debt balances. Used by the
 * snapshot service to recalibrate projections from real numbers.
 */
export async function getLatestConfirmation(
  planId: string
): Promise<ConfirmationWithDebts | null> {
  const [latest] = await db
    .select()
    .from(financePlanConfirmations)
    .where(eq(financePlanConfirmations.planId, planId))
    .orderBy(desc(financePlanConfirmations.confirmationMonth))
    .limit(1);

  if (!latest) return null;

  const debtConfirmations = await db
    .select()
    .from(financePlanDebtConfirmations)
    .where(eq(financePlanDebtConfirmations.confirmationId, latest.id));

  return { ...latest, debtConfirmations };
}

/**
 * Read whether today is the day to prompt the user for a monthly confirmation,
 * and what numbers the dialog should pre-fill from the projection.
 */
export async function getConfirmationStatus(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date = new Date()
): Promise<{
  isDue: boolean;
  monthAnchor: string;
  projectedState: ProjectionMonth | null;
  existingConfirmation: FinancePlanConfirmation | null;
}> {
  if (plan.confirmationDayOfMonth === 0) {
    return {
      isDue: false,
      monthAnchor: periodAnchorIso(today, 1),
      projectedState: null,
      existingConfirmation: null,
    };
  }

  // The bucket key is the start of the period containing today, anchored on
  // the plan's confirmation day. By construction, every day in a period
  // satisfies "today >= anchor", so the only practical guard is whether a
  // confirmation row already exists for this period — once it does, the
  // dialog stops; otherwise it keeps prompting every day. The per-day
  // localStorage dismiss in confirmation-prompt.tsx handles within-day
  // re-shows.
  const monthAnchor = periodAnchorFor(today, plan.confirmationDayOfMonth);

  const [existing] = await db
    .select()
    .from(financePlanConfirmations)
    .where(
      and(
        eq(financePlanConfirmations.planId, plan.id),
        eq(financePlanConfirmations.confirmationMonth, isoDate(monthAnchor))
      )
    );

  const projectedState = await getProjectedStateForMonth(plan, userId, monthAnchor);

  return {
    isDue: !existing,
    monthAnchor: isoDate(monthAnchor),
    projectedState,
    existingConfirmation: existing ?? null,
  };
}

export type ConfirmActualsInput = {
  planId: string;
  confirmedSavings: string;
  confirmedInvestments: string;
  notes?: string | null;
  debtBalances: { debtId: string; confirmedBalance: string }[];
};

/**
 * Save (upsert) a user confirmation for the current month and write a paired
 * snapshot tagged `confirmation` so the audit timeline has both events.
 */
export async function saveConfirmation(
  userId: string,
  input: ConfirmActualsInput,
  today: Date = new Date()
): Promise<FinancePlanConfirmation> {
  const { confirmationDayOfMonth } = await ensurePlanOwnership(
    input.planId,
    userId
  );

  const monthAnchor = isoDate(periodAnchorFor(today, confirmationDayOfMonth));

  const conf = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(financePlanConfirmations)
      .values({
        planId: input.planId,
        confirmationMonth: monthAnchor,
        confirmedSavings: input.confirmedSavings,
        confirmedInvestments: input.confirmedInvestments,
        notes: input.notes ?? null,
        source: "user",
      })
      .onConflictDoUpdate({
        target: [
          financePlanConfirmations.planId,
          financePlanConfirmations.confirmationMonth,
        ],
        set: {
          confirmedSavings: input.confirmedSavings,
          confirmedInvestments: input.confirmedInvestments,
          notes: input.notes ?? null,
          // A manual confirm over an auto-rolled row promotes it to "user".
          source: "user",
          confirmedAt: new Date(),
        },
      })
      .returning();

    // Replace any prior per-debt confirmations for this confirmation.
    await tx
      .delete(financePlanDebtConfirmations)
      .where(eq(financePlanDebtConfirmations.confirmationId, row.id));

    if (input.debtBalances.length > 0) {
      await tx.insert(financePlanDebtConfirmations).values(
        input.debtBalances.map((d) => ({
          confirmationId: row.id,
          debtId: d.debtId,
          confirmedBalance: d.confirmedBalance,
        }))
      );
    }

    return row;
  });

  // Snapshot is written outside the txn so a failure here doesn't roll back
  // the confirmation itself — the next cron run will heal the missing snapshot.
  try {
    await createConfirmationSnapshot(input.planId, userId, today);
  } catch (err) {
    console.error("createConfirmationSnapshot after saveConfirmation failed:", err);
  }

  return conf;
}

/**
 * Roll the baseline forward through any CLOSED period the user left
 * unconfirmed. Designed to run from the daily cron before snapshots.
 *
 * Rule (matches the product intent "don't advance debts automatically unless a
 * whole period was skipped"):
 *   - The CURRENT period is never auto-confirmed — the user is still prompted.
 *   - Every period strictly between the latest confirmation (or the plan start
 *     when there is none) and the current period is fully closed. For each one
 *     that has no confirmation yet, create a `source: "auto"` confirmation
 *     recording that period's projected OPENING (= the prior period's close),
 *     chaining the baseline forward one period at a time.
 *
 * Auto rows are best-estimates: the UI can flag them, and `getConfirmationStatus`
 * still prompts for the current period so the user can supply real numbers.
 * No-op when the feature is disabled (`confirmationDayOfMonth === 0`).
 */
export async function autoConfirmSkippedPeriods(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date = new Date()
): Promise<{ confirmationsCreated: number }> {
  const anchor = plan.confirmationDayOfMonth;
  if (anchor === 0) return { confirmationsCreated: 0 };

  const currStart = periodStartFor(today, anchor);

  // Period months already confirmed (any source) for this plan.
  const existing = await db
    .select({ month: financePlanConfirmations.confirmationMonth })
    .from(financePlanConfirmations)
    .where(eq(financePlanConfirmations.planId, plan.id));
  const confirmedMonths = new Set(existing.map((r) => r.month));

  const latest = await getLatestConfirmation(plan.id);
  const baselineStart = latest
    ? periodStartFor(new Date(latest.confirmationMonth), anchor)
    : periodStartFor(new Date(plan.startMonth), anchor);

  let confirmationsCreated = 0;
  // Walk forward from the period AFTER the baseline up to (but not including)
  // the current period — those are the closed periods.
  let cursor = nextPeriodStart(baselineStart, anchor);
  // Hard cap so a misconfigured/very-old plan can't spin forever.
  let guard = 0;
  while (cursor.getTime() < currStart.getTime() && guard < 600) {
    guard += 1;
    const monthKey = isoDate(cursor);
    if (!confirmedMonths.has(monthKey)) {
      // Projected opening of this skipped period, calibrated from the latest
      // confirmation so far (which includes any auto rows we just wrote).
      const opening = await getProjectedStateForMonth(plan, userId, cursor);
      if (opening) {
        const inserted = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(financePlanConfirmations)
            .values({
              planId: plan.id,
              confirmationMonth: monthKey,
              confirmedSavings: opening.savings.toFixed(2),
              confirmedInvestments: opening.investments.toFixed(2),
              notes: null,
              source: "auto",
            })
            .onConflictDoNothing({
              target: [
                financePlanConfirmations.planId,
                financePlanConfirmations.confirmationMonth,
              ],
            })
            .returning();

          // onConflictDoNothing returns nothing when the row already existed
          // (race with a concurrent run) — bail without writing debt rows.
          if (!row) return null;

          if (opening.debts.length > 0) {
            await tx.insert(financePlanDebtConfirmations).values(
              opening.debts.map((d) => ({
                confirmationId: row.id,
                debtId: d.debtId,
                confirmedBalance: Math.max(0, d.balance).toFixed(2),
              }))
            );
          }
          return row;
        });

        if (inserted) {
          confirmedMonths.add(monthKey);
          confirmationsCreated += 1;
          // Audit snapshot tagged `confirmation`, mirroring saveConfirmation.
          try {
            await createConfirmationSnapshot(plan.id, userId, cursor);
          } catch (err) {
            console.error("auto-confirm snapshot failed:", err);
          }
        }
      }
    }
    cursor = nextPeriodStart(cursor, anchor);
  }

  return { confirmationsCreated };
}

/**
 * Convenience export so callers don't have to re-import getPlanWithLines just
 * to get a confirmation-prompt-ready plan.
 */
export async function getPlanForConfirmation(
  planId: string,
  userId: string
): Promise<FinancePlanWithLines | null> {
  return getPlanWithLines(planId, userId);
}
