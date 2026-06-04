import "server-only";

import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { financePlans, financePlanSnapshots } from "@/db/schema";
import type { FinanceSnapshotSource } from "@/schemas/finance-snapshot";

import {
  getAutoInvestRate,
  getPlanWithLines,
  getPortfolioValueForUser,
  projectPlan,
} from "./finance-plan-service";
import { getLatestConfirmation } from "./finance-confirmation-service";
import { periodStartFor } from "@/lib/finance/period";
import type {
  FinancePlanWithLines,
  ProjectionMonth,
} from "@/types/finance";

// ---------- helpers ----------

/** Whole months between `start` and `target`, signed. Both inputs are
 *  expected to be period-anchor dates (same day-of-month, possibly clamped),
 *  so the calendar-month diff equals the period offset. */
function monthsBetween(start: Date, target: Date): number {
  return (
    (target.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - start.getUTCMonth())
  );
}

/**
 * Apply the latest confirmation (if any) as the new baseline so projections
 * recalibrate from the user's most recent real-world numbers instead of
 * always extrapolating from the original startMonth.
 */
export async function buildCalibratedPlan(
  plan: FinancePlanWithLines
): Promise<FinancePlanWithLines> {
  const latest = await getLatestConfirmation(plan.id);
  if (!latest) return plan;

  const debtBalanceById = new Map(
    latest.debtConfirmations.map((d) => [d.debtId, d.confirmedBalance])
  );

  return {
    ...plan,
    startMonth: new Date(latest.confirmationMonth),
    initialSavings: latest.confirmedSavings,
    initialInvestments: latest.confirmedInvestments,
    debts: plan.debts.map((d) => ({
      ...d,
      initialBalance: debtBalanceById.get(d.id) ?? d.initialBalance,
    })),
  };
}

/**
 * Snapshot of the projected position for the calendar date. Uses the
 * calibrated plan so confirmations are reflected immediately.
 */
async function computeStateAt(
  plan: FinancePlanWithLines,
  userId: string,
  targetDate: Date
): Promise<{ state: ProjectionMonth | null; calibrated: FinancePlanWithLines }> {
  const calibrated = await buildCalibratedPlan(plan);

  const [portfolioValue, autoInvestRate] = await Promise.all([
    calibrated.includePortfolio
      ? getPortfolioValueForUser(userId)
      : Promise.resolve(0),
    getAutoInvestRate(calibrated),
  ]);

  const projection = projectPlan(
    calibrated,
    calibrated.incomes,
    calibrated.expenses,
    calibrated.debts,
    {
      portfolioValue,
      autoInvestRate,
      overrides: calibrated.overrides,
    }
  );

  if (projection.months.length === 0) {
    return { state: null, calibrated };
  }

  // Both ends normalised to their period anchors so the month diff is the
  // period diff. Day-1 anchors collapse to first-of-month, which is the
  // historical (calendar-month) behaviour.
  const anchorDay =
    calibrated.confirmationDayOfMonth > 0
      ? calibrated.confirmationDayOfMonth
      : 1;
  const startAnchor = periodStartFor(calibrated.startMonth, anchorDay);
  const targetAnchor = periodStartFor(targetDate, anchorDay);
  const offset = monthsBetween(startAnchor, targetAnchor);
  if (offset < 0) {
    const totalDebt = calibrated.debts.reduce(
      (s, d) => s + parseFloat(d.initialBalance),
      0
    );
    return {
      calibrated,
      state: {
        monthOffset: -1,
        date: targetDate,
        income: 0,
        expenses: 0,
        scheduledDebtPayments: 0,
        extraDebtPayments: 0,
        debtPayments: 0,
        totalInterestAccrued: 0,
        cashFlow: 0,
        savings: parseFloat(calibrated.initialSavings),
        savingsInterest: 0,
        investments: parseFloat(calibrated.initialInvestments),
        investmentsContribution: 0,
        investmentsInterest: 0,
        totalDebt,
        portfolioValue: 0,
        netWorth:
          parseFloat(calibrated.initialSavings) +
          parseFloat(calibrated.initialInvestments) -
          totalDebt,
        debts: [],
      },
    };
  }
  const idx = Math.min(offset, projection.months.length - 1);
  return { state: projection.months[idx] ?? null, calibrated };
}

// ---------- public API (mirrors snapshot-service.ts) ----------

/**
 * Walk every finance plan and capture today's snapshot. Designed to be called
 * from the daily cron — analog of `createDailySnapshots()` in snapshot-service.ts.
 *
 * Skips a plan if its most recent snapshot is already on the same calendar day
 * AND came from the cron (idempotent re-runs are no-ops). Manual / confirmation
 * snapshots created earlier in the day stay intact.
 */
export async function createDailyFinanceSnapshots(today: Date = new Date()): Promise<{
  date: Date;
  snapshotsCreated: number;
  totalPlans: number;
  errors: string[];
}> {
  const plans = await db.select().from(financePlans);
  let snapshotsCreated = 0;
  const errors: string[] = [];

  for (const planRow of plans) {
    try {
      const result = await createSnapshotForPlan(
        planRow.id,
        planRow.userId,
        "system_cron",
        today
      );
      if (result.created) snapshotsCreated += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${planRow.id}: ${msg}`);
      console.error(`createDailyFinanceSnapshots plan=${planRow.id}:`, err);
    }
  }

  return { date: today, snapshotsCreated, totalPlans: plans.length, errors };
}

/**
 * Snapshot created when a user confirms their actuals. Analog of
 * `createApprovalSnapshot` in snapshot-service.ts.
 */
export async function createConfirmationSnapshot(
  planId: string,
  userId: string,
  confirmedAt: Date
): Promise<{ created: boolean }> {
  return createSnapshotForPlan(planId, userId, "confirmation", confirmedAt);
}

/**
 * Manual snapshot, requested by the user from the UI. Mirrors
 * `createManualSnapshot` in snapshot-service.ts.
 */
export async function createManualFinanceSnapshot(
  planId: string,
  userId: string,
  date: Date = new Date()
): Promise<{ created: boolean }> {
  return createSnapshotForPlan(planId, userId, "manual", date);
}

/**
 * Bulk delete of manual snapshots for a plan. Mirrors
 * `deleteManualSnapshots` in snapshot-service.ts.
 */
export async function deleteManualFinanceSnapshots(
  planId: string,
  userId: string
): Promise<void> {
  await ensurePlanOwnership(planId, userId);
  await db
    .delete(financePlanSnapshots)
    .where(
      and(
        eq(financePlanSnapshots.planId, planId),
        eq(financePlanSnapshots.source, "manual")
      )
    );
}

/**
 * Read-only access to a plan's snapshot history (newest first).
 */
export async function listSnapshots(
  planId: string,
  userId: string,
  options: { limit?: number } = {}
): Promise<
  Array<{
    date: Date;
    savings: string;
    investments: string;
    totalDebt: string;
    netWorth: string;
    source: FinanceSnapshotSource;
  }>
> {
  await ensurePlanOwnership(planId, userId);
  const limit = options.limit ?? 365;
  return db
    .select({
      date: financePlanSnapshots.date,
      savings: financePlanSnapshots.savings,
      investments: financePlanSnapshots.investments,
      totalDebt: financePlanSnapshots.totalDebt,
      netWorth: financePlanSnapshots.netWorth,
      source: financePlanSnapshots.source,
    })
    .from(financePlanSnapshots)
    .where(eq(financePlanSnapshots.planId, planId))
    .orderBy(desc(financePlanSnapshots.date))
    .limit(limit) as Promise<
    Array<{
      date: Date;
      savings: string;
      investments: string;
      totalDebt: string;
      netWorth: string;
      source: FinanceSnapshotSource;
    }>
  >;
}

// ---------- internal ----------

async function ensurePlanOwnership(planId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ userId: financePlans.userId })
    .from(financePlans)
    .where(eq(financePlans.id, planId));
  if (!row || row.userId !== userId) {
    throw new Error("Plan not found");
  }
}

/**
 * Shared INSERT helper, structurally identical to `createSnapshotForPortfolio`
 * in snapshot-service.ts. Skips inserts on these conditions:
 *
 *   - The plan does not exist.
 *   - A `system_cron` snapshot already exists for the same calendar day (idempotent).
 *
 * Manual + confirmation snapshots are NEVER skipped on day collision — they're
 * intentional events the user wants in the history.
 */
async function createSnapshotForPlan(
  planId: string,
  userId: string,
  source: FinanceSnapshotSource,
  date: Date = new Date()
): Promise<{ created: boolean }> {
  const plan = await getPlanWithLines(planId, userId);
  if (!plan) return { created: false };

  // Idempotency: if the cron is re-run on a day where we already wrote a
  // system_cron snapshot, skip. Other sources always create a fresh row.
  if (source === "system_cron") {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);
    const [existing] = await db
      .select({ id: financePlanSnapshots.id })
      .from(financePlanSnapshots)
      .where(
        and(
          eq(financePlanSnapshots.planId, planId),
          eq(financePlanSnapshots.source, "system_cron"),
          gte(financePlanSnapshots.date, dayStart),
          lte(financePlanSnapshots.date, dayEnd)
        )
      )
      .limit(1);
    if (existing) return { created: false };
  }

  const { state } = await computeStateAt(plan, userId, date);
  if (!state) return { created: false };

  await db.insert(financePlanSnapshots).values({
    planId,
    date,
    savings: state.savings.toFixed(2),
    investments: state.investments.toFixed(2),
    totalDebt: state.totalDebt.toFixed(2),
    netWorth: state.netWorth.toFixed(2),
    source,
  });

  return { created: true };
}

/**
 * One snapshot per calendar month for the last `monthsBack` months, taking the
 * most recent snapshot of each month as the representative. Used by the chart
 * to plot the recent past alongside the projected future on the same timeline.
 *
 * Returns an empty array (without throwing) when no snapshots exist yet — that
 * is the common case for fresh plans before the cron has run a few times.
 */
export async function getRecentMonthlySnapshots(
  planId: string,
  userId: string,
  monthsBack: number = 3,
  today: Date = new Date()
): Promise<
  Array<{
    date: Date;
    savings: number;
    investments: number;
    totalDebt: number;
    netWorth: number;
  }>
> {
  await ensurePlanOwnership(planId, userId);

  // First day (UTC) of the month that is `monthsBack` months before `today`.
  const cutoff = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1)
  );

  const rows = await db
    .select({
      date: financePlanSnapshots.date,
      savings: financePlanSnapshots.savings,
      investments: financePlanSnapshots.investments,
      totalDebt: financePlanSnapshots.totalDebt,
      netWorth: financePlanSnapshots.netWorth,
    })
    .from(financePlanSnapshots)
    .where(
      and(
        eq(financePlanSnapshots.planId, planId),
        gte(financePlanSnapshots.date, cutoff)
      )
    )
    .orderBy(desc(financePlanSnapshots.date));

  // Keep only the latest snapshot per calendar month so the chart gets a clean
  // month-by-month series even if the cron wrote multiple rows per day.
  const latestPerMonth = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = `${r.date.getUTCFullYear()}-${r.date.getUTCMonth()}`;
    if (!latestPerMonth.has(key)) latestPerMonth.set(key, r);
  }

  return Array.from(latestPerMonth.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r) => ({
      date: r.date,
      savings: parseFloat(r.savings),
      investments: parseFloat(r.investments),
      totalDebt: parseFloat(r.totalDebt),
      netWorth: parseFloat(r.netWorth),
    }));
}

// ---------- exposed for confirmation flow ----------

/**
 * Public view of the calibrated "current period" projection state for a
 * plan, used by the confirmation dialog to pre-fill the form. `targetDate`
 * is expected to be the period anchor — typically passed straight through
 * from `periodStartFor(today, confirmationDayOfMonth)`.
 */
export async function getProjectedStateForMonth(
  plan: FinancePlanWithLines,
  userId: string,
  targetDate: Date
): Promise<ProjectionMonth | null> {
  const { state } = await computeStateAt(plan, userId, targetDate);
  return state;
}
