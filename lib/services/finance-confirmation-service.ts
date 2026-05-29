import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  financePlanConfirmations,
  financePlanDebtConfirmations,
  financePlans,
} from "@/db/schema";

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

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function ensurePlanOwnership(planId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ userId: financePlans.userId })
    .from(financePlans)
    .where(eq(financePlans.id, planId));
  if (!row || row.userId !== userId) {
    throw new Error("Plan not found");
  }
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
      monthAnchor: isoDate(startOfMonthUtc(today)),
      projectedState: null,
      existingConfirmation: null,
    };
  }

  const monthAnchor = startOfMonthUtc(today);
  // Strict "the day described by the plan" check — was `>=` which meant the
  // prompt fired any day from confirmationDayOfMonth to month-end. Now we
  // only fire on the exact day, with a clamp to the last day of the month
  // when the configured day is past month-end (e.g. day 31 in February).
  const todayDay = today.getUTCDate();
  const lastDayOfMonth = new Date(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    0
  ).getUTCDate();
  const targetDay = Math.min(plan.confirmationDayOfMonth, lastDayOfMonth);
  const dayReached = todayDay === targetDay;

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
    isDue: dayReached && !existing,
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
  await ensurePlanOwnership(input.planId, userId);

  const monthAnchor = isoDate(startOfMonthUtc(today));

  const conf = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(financePlanConfirmations)
      .values({
        planId: input.planId,
        confirmationMonth: monthAnchor,
        confirmedSavings: input.confirmedSavings,
        confirmedInvestments: input.confirmedInvestments,
        notes: input.notes ?? null,
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
 * Convenience export so callers don't have to re-import getPlanWithLines just
 * to get a confirmation-prompt-ready plan.
 */
export async function getPlanForConfirmation(
  planId: string,
  userId: string
): Promise<FinancePlanWithLines | null> {
  return getPlanWithLines(planId, userId);
}
