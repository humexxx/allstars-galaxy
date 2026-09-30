import "server-only";

import { cache } from "react";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  financePlans,
  financePlanSnapshots,
  financePlanSnapshotDebts,
} from "@/db/schema";
import type { FinanceSnapshotSource } from "@/schemas/finance-snapshot";

import {
  getMainPlan,
  getPlanWithLines,
  projectionOptionsFor,
  type PlanRestatement,
} from "./finance-plan-service";
import {
  changesOpeningBalances,
  restateOpeningSet,
  type OpeningBalanceEdits,
} from "@/lib/finance/opening-balances";
import {
  autoConfirmSkippedPeriods,
  getLatestConfirmation,
} from "./finance-confirmation-service";
import { ensureOwnedRow } from "./ownership";
import {
  iteratePeriods,
  periodIndexForDate,
  periodStartFor,
} from "@/lib/finance/period";
import {
  deriveFinanceMood,
  projectPlan,
  projectStateAt,
  type ProjectOptions,
} from "@/lib/finance/projection";
import { isoDay, monthKeyOf, parseIsoDay } from "@/lib/finance/schedule";
import { calendarDayInTimeZone, earliestCalendarDay } from "@/lib/utils/date";
import {
  alignTimelineToday,
  buildPlanTimeline,
  debtFreeMonthsFromNow,
  type PlanTimeline,
} from "@/lib/finance/chart-series";
import type {
  ConfirmationWithDebts,
  FinanceMood,
  FinancePlanWithLines,
  PlanSummary,
  Projection,
  ProjectionMonth,
  TodayState,
} from "@/types/finance";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------- calibration ----------

export type CalibrationOptions = {
  /** Reader's IANA zone — the plan's creation day is read in it. */
  timeZone?: string | null;
  /**
   * For a plan with no confirmation: the day its opening balances were read
   * on. Defaults to the plan's creation day; a scenario passes its base
   * plan's, so an unchanged scenario and its base open identically.
   */
  asOfFallback?: Date | null;
};

/**
 * The day a confirmation describes (UTC midnight). A user confirmation is
 * stored under the calendar day it was made on; an auto confirmation under
 * the period start whose OPENING it records. Rows saved before that change
 * carry their period start either way.
 */
export function confirmationDay(row: { confirmationMonth: string }): Date {
  return parseIsoDay(row.confirmationMonth) ?? new Date(row.confirmationMonth);
}

function withPinnedRecurrence<T extends { recurrenceType: string; recurrenceStart: string | null }>(
  lines: T[],
  anchorIso: string
): T[] {
  return lines.map((l) =>
    l.recurrenceType === "every_n_months" && !l.recurrenceStart
      ? { ...l, recurrenceStart: anchorIso }
      : l
  );
}

/**
 * Pure calibration — see `buildCalibratedPlan`. Exported for tests.
 *
 * - Every-N-months lines without a "First month" are pinned to the ORIGINAL
 *   start month, so moving `startMonth` to the confirmation doesn't move
 *   their cycle (it used to follow the confirmation month and land a
 *   quarterly bill in every confirmed period).
 * - The end date stays the plan's own: `monthsAhead` is recomputed so the
 *   last period is the one the plan always ended on, rather than sliding a
 *   whole horizon forward with every confirmation.
 * - `asOf` = the confirmed day (user) or the day before the recorded period
 *   start (auto — an opening, nothing in that period happened yet); with no
 *   confirmation, the fallback or the plan's creation day.
 */
export function calibratePlan(
  plan: FinancePlanWithLines,
  latest: ConfirmationWithDebts | null,
  options: CalibrationOptions = {}
): FinancePlanWithLines {
  const anchor = plan.confirmationDayOfMonth > 0 ? plan.confirmationDayOfMonth : 1;
  const originalStart = new Date(plan.startMonth);
  const startKey = monthKeyOf(originalStart);
  const anchorIso = isoDay(
    new Date(Date.UTC(Math.floor(startKey / 12), startKey % 12, 1))
  );
  const pinned = {
    incomes: withPinnedRecurrence(plan.incomes, anchorIso),
    expenses: withPinnedRecurrence(plan.expenses, anchorIso),
  };

  // The plan keeps its own END date whatever period it is rebased to.
  const originalPeriods = iteratePeriods(originalStart, anchor, Math.max(1, plan.monthsAhead));
  const originalFirst = originalPeriods[0].start;
  const originalLast = originalPeriods[originalPeriods.length - 1].start;
  const monthsAheadFrom = (start: Date): number =>
    Math.max(1, periodIndexForDate(start, anchor, originalLast) + 1);

  // Which statement of the opening balances is newest: the latest
  // confirmation, or the plan's own (`balances_as_of`, re-dated whenever an
  // opening balance is edited). A tie goes to the confirmation — restating on
  // a day that already has one updates that confirmation too, so both agree.
  const statedDay = parseIsoDay(plan.balancesAsOf ?? null);
  const confirmationWins =
    latest !== null &&
    (statedDay === null || confirmationDay(latest).getTime() >= statedDay.getTime());

  if (!confirmationWins) {
    if (statedDay) {
      // Balances stated on a day after the plan's first period: the plan
      // starts from them, in the period that contains that day (like a
      // confirmation), so nothing before it is replayed. Stated on or before
      // the first period: the plan starts where it always did and the engine
      // skips what the balances already hold.
      const statedPeriod = periodStartFor(statedDay, anchor);
      const rebase = statedPeriod.getTime() > originalFirst.getTime();
      return {
        ...plan,
        ...pinned,
        ...(rebase ? { startMonth: statedPeriod, monthsAhead: monthsAheadFrom(statedPeriod) } : {}),
        debts: withPinnedRecurrence(plan.debts, anchorIso),
        asOf: statedDay,
        baselineSource: "plan",
      };
    }
    // Rows from before `balances_as_of` existed: the creation day, which the
    // engine only honours inside the first period (a backdated legacy plan
    // keeps meaning "balances at the start").
    const created = plan.createdAt ? new Date(plan.createdAt) : null;
    const asOf =
      options.asOfFallback ??
      (created && !Number.isNaN(created.getTime())
        ? calendarDayInTimeZone(created, options.timeZone)
        : null);
    return {
      ...plan,
      ...pinned,
      debts: withPinnedRecurrence(plan.debts, anchorIso),
      asOf,
      baselineSource: "plan",
    };
  }

  // Past this point the confirmation is the baseline.
  const confirmation = latest as ConfirmationWithDebts;
  const day = confirmationDay(confirmation);
  const startMonth = periodStartFor(day, anchor);
  const monthsAhead = monthsAheadFrom(startMonth);
  const asOf =
    confirmation.source === "auto" ? new Date(day.getTime() - MS_PER_DAY) : day;

  const debtBalanceById = new Map(
    confirmation.debtConfirmations.map((d) => [d.debtId, d.confirmedBalance])
  );

  return {
    ...plan,
    ...pinned,
    startMonth,
    monthsAhead,
    initialSavings: confirmation.confirmedSavings,
    initialInvestments: confirmation.confirmedInvestments,
    debts: withPinnedRecurrence(plan.debts, anchorIso).map((d) => ({
      ...d,
      initialBalance: debtBalanceById.get(d.id) ?? d.initialBalance,
    })),
    asOf,
    baselineSource: "confirmation",
  };
}

/**
 * The plan every projection surface uses: its latest confirmation (if any)
 * as the opening balances, on the day they were read — see `calibratePlan`.
 * The plan page, the plans list, the compare page, the dashboard and the
 * mascot all project THIS, so they agree on every figure.
 */
export async function buildCalibratedPlan(
  plan: FinancePlanWithLines,
  options: CalibrationOptions = {}
): Promise<FinancePlanWithLines> {
  const latest = await getLatestConfirmation(plan.id);
  return calibratePlan(plan, latest, options);
}

/** A calibrated plan with everything the pages render from it. */
export type CalibratedView = {
  baseline: FinancePlanWithLines;
  options: ProjectOptions;
  projection: Projection;
  /** Where the plan stands today (null only for a plan with no periods). */
  today: TodayState | null;
};

/** Calibrates, projects and resolves today's position in one go. */
export async function loadCalibratedView(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date,
  options: CalibrationOptions = {}
): Promise<CalibratedView> {
  const baseline = await buildCalibratedPlan(plan, options);
  const projectOptions = await projectionOptionsFor(baseline, userId);
  const projection = projectPlan(
    baseline,
    baseline.incomes,
    baseline.expenses,
    baseline.debts,
    projectOptions
  );
  const todayState = projectStateAt(
    baseline,
    baseline.incomes,
    baseline.expenses,
    baseline.debts,
    projectOptions,
    today
  );
  return { baseline, options: projectOptions, projection, today: todayState };
}

/**
 * Projected position for a calendar date, from the calibrated plan.
 *
 * `boundary`:
 *   - `"close"` (default): the END of the period containing `targetDate`.
 *   - `"open"`: its OPENING (= the previous period's close, or the calibrated
 *     opening balances for the first period). Snapshots and the auto
 *     roll-forward record this, so a snapshot never contains projected
 *     paydown for a period nobody confirmed.
 * Past the horizon both return the LAST period's close.
 */
async function computeStateAt(
  plan: FinancePlanWithLines,
  userId: string,
  targetDate: Date,
  boundary: "open" | "close" = "close"
): Promise<{ state: ProjectionMonth | null; calibrated: FinancePlanWithLines }> {
  const calibrated = await buildCalibratedPlan(plan);
  const options = await projectionOptionsFor(calibrated, userId);
  const projection = projectPlan(
    calibrated,
    calibrated.incomes,
    calibrated.expenses,
    calibrated.debts,
    options
  );

  if (projection.months.length === 0) {
    return { state: null, calibrated };
  }

  const portfolioValue = Math.max(0, options.portfolioValue ?? 0);
  const initialsState = (): ProjectionMonth => {
    const totalDebt = calibrated.debts.reduce(
      (s, d) => s + parseFloat(d.initialBalance),
      0
    );
    const savings = parseFloat(calibrated.initialSavings);
    const investments = parseFloat(calibrated.initialInvestments);
    return {
      monthOffset: -1,
      date: targetDate,
      income: 0,
      expenses: 0,
      scheduledDebtPayments: 0,
      extraDebtPayments: 0,
      debtPayments: 0,
      totalInterestAccrued: 0,
      cashFlow: 0,
      savings,
      savingsInterest: 0,
      investments,
      investmentsContribution: 0,
      investmentsInterest: 0,
      totalDebt,
      // The portfolio exists on day one too; leaving it out made the
      // confirmation-day snapshot drop a cliff the size of the portfolio.
      portfolioValue,
      netWorth: savings + investments + portfolioValue - totalDebt,
      preAsOfCashFlow: 0,
      debts: calibrated.debts.map((d) => ({
        debtId: d.id,
        name: d.name,
        balance: parseFloat(d.initialBalance),
        scheduledPayment: 0,
        extraPayment: 0,
        interestAccrued: 0,
        payments: [],
      })),
    };
  };

  const anchorDay =
    calibrated.confirmationDayOfMonth > 0 ? calibrated.confirmationDayOfMonth : 1;
  const offset = periodIndexForDate(calibrated.startMonth, anchorDay, targetDate);
  if (offset < 0) {
    return { calibrated, state: initialsState() };
  }
  const lastIdx = projection.months.length - 1;
  if (offset > lastIdx) {
    // Past the horizon: nothing moves any more — the last close, for both
    // edges (it used to return the second-to-last period, frozen forever).
    return { calibrated, state: projection.months[lastIdx] };
  }
  if (boundary === "open") {
    return {
      calibrated,
      state: offset > 0 ? projection.months[offset - 1] : initialsState(),
    };
  }
  return { state: projection.months[offset], calibrated };
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

// ---------- internal ----------

async function ensurePlanOwnership(planId: string, userId: string): Promise<void> {
  await ensureOwnedRow({
    table: financePlans,
    idColumn: financePlans.id,
    id: planId,
    userId,
    entity: "Plan",
  });
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

  // With confirmations off there is nothing real to record: every "open"
  // state would be the plan's own forecast, and the chart draws snapshots as
  // the solid REAL past. So the cron writes none for such plans; manual and
  // confirmation snapshots are explicit user events and still go through.
  if (source === "system_cron" && plan.confirmationDayOfMonth === 0) {
    return { created: false };
  }

  // The cron runs once for every user, and no user's time zone is stored.
  // Its "today" — which decides whether a period has closed, which period's
  // opening the snapshot records, and where the horizon clamps — is therefore
  // the EARLIEST calendar day on Earth (UTC−12): a period counts as closed
  // only once it has closed everywhere, so nobody gets a period auto-confirmed
  // (or a projected close recorded as history) while it is still open where
  // they live. The cost is a lag of up to a day for zones ahead of UTC−12.
  // Manual / confirmation snapshots keep the instant they were given.
  const day = source === "system_cron" ? earliestCalendarDay(date) : date;

  // Idempotency: if the cron is re-run on a day where we already wrote a
  // system_cron snapshot, skip. Other sources always create a fresh row.
  if (source === "system_cron") {
    const dayStart = new Date(day);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
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

    // Before snapshotting, roll the baseline through any period the user left
    // unconfirmed so today's snapshot reflects the rolled opening (and the
    // skipped periods get an auditable auto-confirmation). Cron-only — manual /
    // confirmation snapshots must not trigger silent baseline rolls.
    await autoConfirmSkippedPeriods(plan, userId, day);
  }

  // "open" → the period's OPENING balances (last confirmed baseline held flat),
  // NOT the projected period close. A snapshot records where the user *actually*
  // is per their last confirmation; debt paydown / interest only enters the
  // historical record when the user confirms (or the cron auto-confirms a
  // skipped period). Pre-"open" this used the projected close, which silently
  // recorded forecast numbers as if they were real.
  const { state } = await computeStateAt(plan, userId, day, "open");
  if (!state) return { created: false };

  const [row] = await db
    .insert(financePlanSnapshots)
    .values({
      planId,
      date: day,
      savings: state.savings.toFixed(2),
      investments: state.investments.toFixed(2),
      totalDebt: state.totalDebt.toFixed(2),
      netWorth: state.netWorth.toFixed(2),
      source,
    })
    .returning({ id: financePlanSnapshots.id });

  if (state.debts.length > 0) {
    await db.insert(financePlanSnapshotDebts).values(
      state.debts.map((d) => ({
        snapshotId: row.id,
        debtId: d.debtId,
        balance: d.balance.toFixed(2),
      }))
    );
  }

  return { created: true };
}

/**
 * One snapshot per accounting PERIOD for the last `monthsBack` months, taking
 * the most recent snapshot of each period as the representative. Used by the
 * chart to plot the recent past alongside the projected future on the same
 * timeline.
 *
 * Buckets by PERIOD anchor (not raw calendar month) so it lines up with
 * `buildChartSeries`, which classifies past/future via `periodIndexForDate`.
 * With a non-1 `anchorDay` a period straddles two calendar months, so a
 * calendar-month dedup could drop two snapshots into different buckets than the
 * chart expects (one period getting two points, another none). Pass the plan's
 * `confirmationDayOfMonth`; the default 1 keeps calendar-month behaviour.
 *
 * Returns an empty array (without throwing) when no snapshots exist yet — that
 * is the common case for fresh plans before the cron has run a few times.
 */
export async function getRecentMonthlySnapshots(
  planId: string,
  userId: string,
  monthsBack: number = 3,
  today: Date = new Date(),
  anchorDay: number = 1
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

  // Keep only the latest snapshot per accounting PERIOD (rows are date-desc, so
  // the first seen per bucket is the latest) so the chart gets one clean point
  // per period even if the cron wrote multiple rows per day. Bucket key = the
  // period's anchor date, which collapses to first-of-month when anchorDay = 1.
  const anchor = anchorDay > 0 ? anchorDay : 1;
  const latestPerPeriod = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = periodStartFor(r.date, anchor).toISOString().slice(0, 10);
    if (!latestPerPeriod.has(key)) latestPerPeriod.set(key, r);
  }

  return Array.from(latestPerPeriod.values())
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
 * The calibrated OPENING of the period containing `targetDate` (the previous
 * period's close, or the calibrated balances for the first period). The auto
 * roll-forward records this for every skipped period.
 */
export async function getProjectedStateForMonth(
  plan: FinancePlanWithLines,
  userId: string,
  targetDate: Date
): Promise<ProjectionMonth | null> {
  const { state } = await computeStateAt(plan, userId, targetDate, "open");
  return state;
}

/**
 * Where the calibrated plan stands on `day` — what the confirmation dialog
 * pre-fills. A confirmation records the balances ON the day it is made, so
 * pre-filling the projected position for that same day makes a blind "Save"
 * a no-op instead of moving the baseline.
 */
export async function getProjectedStateOnDay(
  plan: FinancePlanWithLines,
  userId: string,
  day: Date
): Promise<TodayState | null> {
  const calibrated = await buildCalibratedPlan(plan);
  const options = await projectionOptionsFor(calibrated, userId);
  return projectStateAt(
    calibrated,
    calibrated.incomes,
    calibrated.expenses,
    calibrated.debts,
    options,
    day
  );
}

/**
 * Mood of the user's main plan, from the same calibrated projection every
 * other surface shows (it used to read the raw plan, so a user whose
 * confirmed reality was underwater still got a "thriving" mascot). Cached per
 * request; `getPlanWithLines` is cached too.
 */
export const getFinanceMood = cache(async function getFinanceMood(
  userId: string
): Promise<FinanceMood> {
  const main = await getMainPlan(userId);
  if (!main) return "idle";
  const full = await getPlanWithLines(main.id, userId);
  if (!full) return "idle";
  const calibrated = await buildCalibratedPlan(full);
  const options = await projectionOptionsFor(calibrated, userId);
  return deriveFinanceMood(
    projectPlan(calibrated, calibrated.incomes, calibrated.expenses, calibrated.debts, options)
  );
});

/** One plan as the list / compare surfaces show it. */
export type PlanOverview = {
  plan: FinancePlanWithLines;
  projection: Projection;
  today: TodayState | null;
  timeline: PlanTimeline;
  summary: PlanSummary;
};

/**
 * Every plan calibrated, projected and put on a timeline the same way the
 * plan page does it — so the rail, the comparison chart and the plan page
 * agree on each figure. A scenario opens on its base plan's as-of day.
 */
export async function loadPlanOverviews(
  plans: FinancePlanWithLines[],
  userId: string,
  today: Date,
  timeZone: string | null,
  historyMonths: number = 6
): Promise<PlanOverview[]> {
  const byId = new Map(plans.map((p) => [p.id, p]));
  return Promise.all(
    plans.map(async (plan) => {
      const base = plan.basedOnPlanId ? byId.get(plan.basedOnPlanId) : undefined;
      const asOfFallback = base ? calibratePlan(base, null, { timeZone }).asOf ?? null : null;
      const [view, history] = await Promise.all([
        loadCalibratedView(plan, userId, today, { timeZone, asOfFallback }),
        getRecentMonthlySnapshots(plan.id, userId, historyMonths, today, plan.confirmationDayOfMonth),
      ]);
      const anchor = plan.confirmationDayOfMonth;
      const timeline = alignTimelineToday(
        buildPlanTimeline(
          history,
          view.projection,
          today,
          anchor,
          view.baseline.baselineSource === "plan" ? view.projection : null
        ),
        view.today,
        anchor
      );
      const summary: PlanSummary = {
        monthsToDebtFree: debtFreeMonthsFromNow(view.projection, today),
        debtFreeDate: view.projection.debtFreeDate,
        hadDebt: view.projection.hadDebt,
        endingNetWorth: view.projection.endingNetWorth,
        endingDebt: view.projection.endingDebt,
        endDate: view.projection.months.at(-1)?.date ?? null,
      };
      return { plan, projection: view.projection, today: view.today, timeline, summary };
    })
  );
}

/**
 * The restatement an edit of opening balances implies, or null when the edit
 * changes none of them (a no-op save must not re-date anything). Edited
 * figures keep their new values; the others move to where the CURRENT
 * calibrated plan (latest confirmation or plan statement) projects them on
 * `today` — see `lib/finance/opening-balances.ts`. A confirmation made on
 * `today` is flagged for syncing, so the two statements of the day agree.
 */
export async function restateOpeningBalances(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date,
  edits: OpeningBalanceEdits,
  timeZone?: string | null
): Promise<PlanRestatement | null> {
  if (!changesOpeningBalances(plan, edits)) return null;
  const latest = await getLatestConfirmation(plan.id);
  const baseline = calibratePlan(plan, latest, { timeZone });
  const options = await projectionOptionsFor(baseline, userId);
  const state: TodayState = projectStateAt(
    baseline,
    baseline.incomes,
    baseline.expenses,
    baseline.debts,
    options,
    today
  ) ?? {
    status: "before-start",
    date: today,
    periodIndex: 0,
    periodStart: today,
    savings: parseFloat(baseline.initialSavings),
    investments: parseFloat(baseline.initialInvestments),
    portfolioValue: 0,
    totalDebt: 0,
    netWorth: 0,
    debts: baseline.debts.map((d) => ({
      debtId: d.id,
      name: d.name,
      balance: parseFloat(d.initialBalance),
    })),
  };
  const set = restateOpeningSet(plan, state, edits, today);
  const syncConfirmationId =
    latest && isoDay(confirmationDay(latest)) === set.balancesAsOf ? latest.id : null;
  return { ...set, syncConfirmationId };
}
