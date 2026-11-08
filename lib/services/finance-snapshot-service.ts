import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  financePlans,
  financePlanSnapshots,
  financePlanSnapshotDebts,
} from "@/db/schema";
import type { FinanceSnapshotSource } from "@/schemas/finance-snapshot";

import {
  getAutoInvestRates,
  getMainPlan,
  getPlanWithLines,
  projectionOptionsFor,
  type PlanRestatement,
} from "./finance-plan-service";
import {
  changesOpeningBalances,
  effectiveEdits,
  restateOpeningSet,
  type OpeningBalanceEdits,
} from "@/lib/finance/opening-balances";
import {
  autoConfirmSkippedPeriods,
  getLatestConfirmation,
} from "./finance-confirmation-service";
import {
  debtKeyOf,
  historyOwner,
  recordedDebtKey,
  snapshotsOf,
  type HistoryOwner,
} from "./finance-history";
import { getManagedMarginHistory } from "./margin-service";
import { getTradingJournal } from "./trading-journal-service";
import { ensureOwnedRow } from "./ownership";
import {
  iteratePeriods,
  periodIndexForDate,
  periodStartFor,
} from "@/lib/finance/period";
import {
  deriveFinanceMood,
  planStartDate,
  projectPlan,
  projectStateAt,
  type ProjectOptions,
} from "@/lib/finance/projection";
import { owedAfter, owedRepayments, type OwedRepayment } from "@/lib/finance/receivables";
import { isoDay, monthKeyOf, parseIsoDay, planOccurrences } from "@/lib/finance/schedule";
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

  // Matched by key: the confirmation was read off the main plan's debts, and
  // a copy's debts carry the same keys. A debt no confirmation names (one a
  // what-if adds) keeps its own balance.
  const debtBalanceByKey = new Map(
    confirmation.debtConfirmations.flatMap((d) => {
      const key = recordedDebtKey(d);
      return key ? [[key, d.confirmedBalance] as const] : [];
    })
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
      initialBalance: debtBalanceByKey.get(debtKeyOf(d)) ?? d.initialBalance,
    })),
    asOf,
    baselineSource: "confirmation",
  };
}

/**
 * The plan every projection surface uses: the user's latest confirmation (if
 * any) as the opening balances, on the day they were read — see
 * `calibratePlan`. Every plan calibrates from the same one, so they all start
 * from the user's real position.
 * The plan page, the plans list, the compare page, the dashboard and the
 * mascot all project THIS, so they agree on every figure.
 */
export async function buildCalibratedPlan(
  plan: FinancePlanWithLines,
  options: CalibrationOptions = {}
): Promise<FinancePlanWithLines> {
  const latest = await getLatestConfirmation(plan.userId);
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
  return viewOf(baseline, await projectionOptionsFor(baseline, userId), today);
}

/** The projection and today's position of an already calibrated plan. */
function viewOf(
  baseline: FinancePlanWithLines,
  projectOptions: ProjectOptions,
  today: Date
): CalibratedView {
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

/** Every repayment of money owed to the user that the plan's lines schedule. */
function planRepayments(plan: FinancePlanWithLines): OwedRepayment[] {
  return owedRepayments(
    { startMonth: new Date(plan.startMonth), incomes: plan.incomes, overrides: plan.overrides },
    planStartDate(plan)
  );
}

/**
 * The day a plan's opening balances describe: its as-of day, or the day
 * before it starts. A repayment dated on or before it is already cash.
 */
function openingDay(plan: FinancePlanWithLines): Date {
  const dayBeforeStart = new Date(planStartDate(plan).getTime() - 24 * 60 * 60 * 1000);
  return plan.asOf && plan.asOf.getTime() > dayBeforeStart.getTime() ? plan.asOf : dayBeforeStart;
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
  const portfolioClaims = Math.max(0, options.portfolioClaims ?? 0);
  const tradingValue = Math.max(0, options.tradingValue ?? 0);
  const initialsState = (): ProjectionMonth => {
    const totalDebt = calibrated.debts.reduce(
      (s, d) => s + parseFloat(d.initialBalance),
      0
    );
    const savings = parseFloat(calibrated.initialSavings);
    const investments = parseFloat(calibrated.initialInvestments);
    const receivables = owedAfter(planRepayments(calibrated), openingDay(calibrated));
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
      portfolioClaims,
      tradingValue,
      receivables,
      netWorth:
        savings + investments + portfolioValue - portfolioClaims + tradingValue + receivables - totalDebt,
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
  // History is the user's, written by their main plan alone.
  const plans = await db.select().from(financePlans).where(eq(financePlans.isMain, true));
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
  // A what-if plan has no history of its own: it reads the main plan's.
  if (!plan || !plan.isMain) return { created: false };
  const owner: HistoryOwner = { userId, mainPlanId: plan.id };

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
          snapshotsOf(owner),
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
      userId,
      planId,
      date: day,
      savings: state.savings.toFixed(2),
      investments: state.investments.toFixed(2),
      totalDebt: state.totalDebt.toFixed(2),
      portfolioValue: state.portfolioValue.toFixed(2),
      // Without money owed to the user: `getRecentMonthlySnapshots` adds it
      // back from the plan's current lines, so history and forecast always
      // count it the same way — including snapshots taken before it existed.
      // Nor the trading balance: the journal holds it, and the reads add it
      // back for the snapshot's day (see `withTradingBalance`).
      netWorth: (state.netWorth - state.receivables - (state.tradingValue ?? 0)).toFixed(2),
      source,
    })
    .returning({ id: financePlanSnapshots.id });

  if (state.debts.length > 0) {
    await db.insert(financePlanSnapshotDebts).values(debtRows(row.id, plan, state.debts));
  }

  return { created: true };
}

/**
 * Movement snapshots are a day's position, not a period's opening: the
 * period history (plan page, list, compare) must never read them.
 */
const MOVEMENT = "movement" as const;
const CONFIRMATION = "confirmation" as const;

/**
 * The rows a plan's past is drawn from: the user's confirmations and the
 * history they entered by hand. The cron's daily rows (`system_cron`, no
 * longer written) were the plan's projection, not anything that happened,
 * and an edit's row (`movement`) is a day's position, not a period's. A
 * period the user never confirmed has no point: the line runs straight to
 * the next one that was.
 */
const CHECKPOINT_SOURCES: ("confirmation" | "manual")[] = [CONFIRMATION, "manual"];

/**
 * Where the plan stands on `day`, recorded as a movement snapshot: the same
 * day-aware position the dashboard shows as "Today". Written on days money
 * moves (by the daily cron) and when the plan is edited (by its actions); a
 * second one on the same day replaces the first, so the day keeps its last.
 */
export async function recordMovementSnapshot(
  planId: string,
  userId: string,
  day: Date,
  timeZone?: string
): Promise<{ created: boolean }> {
  const plan = await getPlanWithLines(planId, userId);
  if (!plan || !plan.isMain || plan.confirmationDayOfMonth === 0) return { created: false };
  const { today } = await loadCalibratedView(plan, userId, day, timeZone ? { timeZone } : {});
  if (!today || today.status !== "in-range") return { created: false };

  const dayStart = new Date(day);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setUTCHours(23, 59, 59, 999);
  await db.transaction(async (tx) => {
    // Snapshot debts go with their snapshot (ON DELETE CASCADE).
    await tx
      .delete(financePlanSnapshots)
      .where(
        and(
          snapshotsOf({ userId, mainPlanId: plan.id }),
          eq(financePlanSnapshots.source, MOVEMENT),
          gte(financePlanSnapshots.date, dayStart),
          lte(financePlanSnapshots.date, dayEnd)
        )
      );
    const [row] = await tx
      .insert(financePlanSnapshots)
      .values({
        userId,
        planId,
        date: dayStart,
        savings: today.savings.toFixed(2),
        investments: today.investments.toFixed(2),
        totalDebt: today.totalDebt.toFixed(2),
        portfolioValue: today.portfolioValue.toFixed(2),
        // Without receivables, like every snapshot (see createSnapshotForPlan).
        netWorth: (today.netWorth - today.receivables - (today.tradingValue ?? 0)).toFixed(2),
        source: MOVEMENT,
      })
      .returning({ id: financePlanSnapshots.id });
    if (today.debts.length > 0) {
      await tx.insert(financePlanSnapshotDebts).values(debtRows(row.id, plan, today.debts));
    }
  });
  return { created: true };
}

/** True when any income, expense or debt payment of the plan lands on `day`. */
export function movesOn(plan: FinancePlanWithLines, day: Date): boolean {
  const from = new Date(day);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(day);
  to.setUTCHours(23, 59, 59, 999);
  return (
    planOccurrences(
      {
        startMonth: new Date(plan.startMonth),
        incomes: plan.incomes,
        expenses: plan.expenses,
        debts: plan.debts,
        overrides: plan.overrides,
      },
      from,
      to
    ).length > 0
  );
}

/**
 * The cron's half: a movement snapshot for every plan with money moving on
 * the cron's day (the earliest calendar day on Earth, as for the period
 * snapshots). Edits record their own from the actions.
 */
export async function createMovementSnapshots(now: Date = new Date()): Promise<{
  snapshotsCreated: number;
  errors: string[];
}> {
  const day = earliestCalendarDay(now);
  const plans = await db.select().from(financePlans).where(eq(financePlans.isMain, true));
  let snapshotsCreated = 0;
  const errors: string[] = [];
  for (const row of plans) {
    try {
      const plan = await getPlanWithLines(row.id, row.userId);
      if (!plan || !movesOn(plan, day)) continue;
      const result = await recordMovementSnapshot(row.id, row.userId, day);
      if (result.created) snapshotsCreated += 1;
    } catch (err) {
      errors.push(`${row.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error(`createMovementSnapshots plan=${row.id}:`, err);
    }
  }
  return { snapshotsCreated, errors };
}

/**
 * The movement snapshots of the last `monthsBack` months, oldest first, with
 * what was still owed to the user added back — the dashboard's past.
 */
export async function getRecentMovementSnapshots(
  planId: string,
  userId: string,
  monthsBack: number,
  today: Date
): Promise<HistoryPoint[]> {
  const plan = await getPlanWithLines(planId, userId);
  if (!plan) return [];
  const rows = await db
    .select(HISTORY_COLUMNS)
    .from(financePlanSnapshots)
    .where(
      and(
        snapshotsOf(await historyOwner(userId)),
        eq(financePlanSnapshots.source, MOVEMENT),
        gte(financePlanSnapshots.date, historyCutoff(today, monthsBack))
      )
    )
    .orderBy(asc(financePlanSnapshots.date));
  return withTradingBalance(
    withReceivables(
      rows.map((r) => ({
        date: r.date,
        savings: parseFloat(r.savings),
        investments: parseFloat(r.investments),
        totalDebt: parseFloat(r.totalDebt),
        portfolioValue: r.portfolioValue == null ? null : parseFloat(r.portfolioValue),
        receivables: 0,
        netWorth: parseFloat(r.netWorth),
      })),
      plan
    ),
    userId
  );
}

/**
 * One snapshot per accounting PERIOD for the last `monthsBack` months: the
 * balance the period OPENED with (see `checkpointPerPeriod`). Used by the
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
): Promise<HistoryPoint[]> {
  await ensurePlanOwnership(planId, userId);
  const plan = await getPlanWithLines(planId, userId);

  const rows = await db
    .select(HISTORY_COLUMNS)
    .from(financePlanSnapshots)
    .where(
      and(
        snapshotsOf(await historyOwner(userId)),
        inArray(financePlanSnapshots.source, CHECKPOINT_SOURCES),
        gte(financePlanSnapshots.date, historyCutoff(today, monthsBack))
      )
    )
    .orderBy(desc(financePlanSnapshots.date));

  return withTradingBalance(
    await withManagedMargin(withReceivables(checkpointPerPeriod(rows, anchorDay), plan), plan, userId),
    userId
  );
}

/**
 * Adds the trading account's balance on each point's day, from the journal:
 * snapshots never store it (the journal is where it lives), so a trade logged
 * late still lands in every point after it.
 */
async function withTradingBalance(points: HistoryPoint[], userId: string): Promise<HistoryPoint[]> {
  if (points.length === 0) return points;
  const { equity } = await getTradingJournal(userId, null);
  if (equity.length === 0) return points;
  return points.map((p) => {
    const day = p.date.toISOString().slice(0, 10);
    const balance = equity.findLast((e) => e.day <= day)?.balance ?? 0;
    return balance === 0 ? p : { ...p, tradingValue: balance, netWorth: p.netWorth + balance };
  });
}

/**
 * Adds the managed money's MARGIN to the past the way the forecast counts it:
 * each point gets its month's positions (bought with investors' money) and
 * what was owed to the investors, from the margin history. Snapshots written
 * before the plan counted the managed money hold none of it in their net
 * worth, so it goes in; one that recorded its portfolio already has it and
 * only learns the claim. Computed on read: the stored rows stay as written.
 */
async function withManagedMargin(
  points: HistoryPoint[],
  plan: FinancePlanWithLines | null,
  userId: string
): Promise<HistoryPoint[]> {
  if (!plan?.includePortfolio || points.length === 0) return points;
  const history = await getManagedMarginHistory(userId);
  if (history.length === 0) return points;
  return points.map((p) => {
    const month = p.date.toISOString().slice(0, 7);
    const at = history.findLast((h) => h.month <= month);
    if (!at) return p;
    if (p.portfolioValue != null) return { ...p, portfolioClaims: at.liability };
    const positions = at.deployed - at.ownPosition;
    return {
      ...p,
      portfolioValue: positions,
      portfolioClaims: at.liability,
      netWorth: p.netWorth + positions - at.liability,
    };
  });
}

/**
 * Snapshots store net worth without money owed to the user (see
 * createSnapshotForPlan); this adds back what was still owed on each point's
 * day, from the plan's current lines, so history and forecast agree.
 */
function withReceivables(
  points: HistoryPoint[],
  plan: FinancePlanWithLines | null
): HistoryPoint[] {
  const repayments = plan ? planRepayments(plan) : [];
  if (repayments.length === 0) return points;
  return points.map((p) => {
    const owed = owedAfter(repayments, p.date);
    return { ...p, receivables: owed, netWorth: p.netWorth + owed };
  });
}

/** One recorded point of a plan's history, as the chart plots it. */
type HistoryPoint = {
  date: Date;
  savings: number;
  investments: number;
  totalDebt: number;
  portfolioValue: number | null;
  /** Still owed to the user on the point's day; already inside `netWorth`. */
  receivables: number;
  netWorth: number;
  /** Owed to the investors on the point's day; already off `netWorth`. */
  portfolioClaims?: number;
  /** The trading account on the point's day; already inside `netWorth`. */
  tradingValue?: number;
  /** Written by a confirmation: the user's own figures, not the cron's. */
  confirmed?: boolean;
};

const HISTORY_COLUMNS = {
  source: financePlanSnapshots.source,
  date: financePlanSnapshots.date,
  savings: financePlanSnapshots.savings,
  investments: financePlanSnapshots.investments,
  totalDebt: financePlanSnapshots.totalDebt,
  netWorth: financePlanSnapshots.netWorth,
  portfolioValue: financePlanSnapshots.portfolioValue,
};

type HistoryRow = {
  source: string;
  date: Date;
  savings: string;
  investments: string;
  totalDebt: string;
  netWorth: string;
  portfolioValue: string | null;
};

/** First day (UTC) of the month that is `monthsBack` months before `today`. */
function historyCutoff(today: Date, monthsBack: number): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1));
}

/**
 * The balance each accounting PERIOD opened with, one row per period, oldest
 * first: the period's confirmation (whenever in the period the user got to
 * it), else the earliest row of the period. Rows must be date-desc and come
 * from `CHECKPOINT_SOURCES`.
 */
function checkpointPerPeriod(rows: readonly HistoryRow[], anchorDay: number): HistoryPoint[] {
  const anchor = anchorDay > 0 ? anchorDay : 1;
  const byPeriod = new Map<string, HistoryRow>();
  for (const r of rows) {
    const key = periodStartFor(r.date, anchor).toISOString().slice(0, 10);
    const kept = byPeriod.get(key);
    const confirmed = r.source === CONFIRMATION;
    if (kept?.source === CONFIRMATION) continue;
    if (!kept || confirmed || r.date < kept.date) byPeriod.set(key, r);
  }

  return Array.from(byPeriod.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r) => ({
      date: r.date,
      savings: parseFloat(r.savings),
      investments: parseFloat(r.investments),
      totalDebt: parseFloat(r.totalDebt),
      portfolioValue: r.portfolioValue == null ? null : parseFloat(r.portfolioValue),
      receivables: 0,
      netWorth: parseFloat(r.netWorth),
      confirmed: r.source === CONFIRMATION,
    }));
}

/**
 * `getRecentMonthlySnapshots` for plans already loaded for their owner, in
 * one query: no ownership round trip, since each plan row carries its
 * `userId` and the caller has checked it. Every plan gets the user's one
 * history, bucketed by its own anchor.
 */
async function recentSnapshotsForPlans(
  plans: readonly FinancePlanWithLines[],
  owner: HistoryOwner,
  monthsBack: number,
  today: Date
): Promise<Map<string, HistoryPoint[]>> {
  const rows = await db
    .select(HISTORY_COLUMNS)
    .from(financePlanSnapshots)
    .where(
      and(
        snapshotsOf(owner),
        inArray(financePlanSnapshots.source, CHECKPOINT_SOURCES),
        gte(financePlanSnapshots.date, historyCutoff(today, monthsBack))
      )
    )
    .orderBy(desc(financePlanSnapshots.date));

  return new Map(
    await Promise.all(
      plans.map(
        async (p) =>
          [
            p.id,
            await withTradingBalance(
              await withManagedMargin(
                withReceivables(checkpointPerPeriod(rows, p.confirmationDayOfMonth), p),
                p,
                owner.userId
              ),
              owner.userId
            ),
          ] as const
      )
    )
  );
}

/** A recorded position's per-debt rows, each named by its key across plans. */
function debtRows(
  snapshotId: string,
  plan: FinancePlanWithLines,
  debts: readonly { debtId: string; balance: number }[]
): { snapshotId: string; debtId: string; debtKey: string; balance: string }[] {
  const keyById = new Map(plan.debts.map((d) => [d.id, debtKeyOf(d)]));
  return debts.map((d) => ({
    snapshotId,
    debtId: d.debtId,
    debtKey: keyById.get(d.debtId) ?? d.debtId,
    balance: d.balance.toFixed(2),
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
 *
 * `plans` are the user's, as `listUserPlansWithLines(userId)` loads them.
 * Their latest confirmations, auto-invest rates and history are batched (a
 * fixed handful of queries however many plans): going through
 * `loadCalibratedView` + `getRecentMonthlySnapshots` per plan cost about
 * five round trips each, ownership check included.
 */
export async function loadPlanOverviews(
  plans: FinancePlanWithLines[],
  userId: string,
  today: Date,
  timeZone: string | null,
  historyMonths: number = 6
): Promise<PlanOverview[]> {
  if (plans.length === 0) return [];
  // The rows carry their owner, so no ownership query is needed — but a plan
  // that isn't the caller's is still refused, like `ensureOwnedRow` does.
  if (plans.some((p) => p.userId !== userId)) throw new Error("Plan not found");

  const methodIds = [
    ...new Set(plans.flatMap((p) => (p.autoInvestMethodId ? [p.autoInvestMethodId] : []))),
  ];
  const owner = await historyOwner(userId);
  const [latest, rateByMethod, historyByPlan] = await Promise.all([
    getLatestConfirmation(userId),
    getAutoInvestRates(methodIds),
    recentSnapshotsForPlans(plans, owner, historyMonths, today),
  ]);

  const byId = new Map(plans.map((p) => [p.id, p]));
  return Promise.all(
    plans.map(async (plan) => {
      const base = plan.basedOnPlanId ? byId.get(plan.basedOnPlanId) : undefined;
      const asOfFallback = base ? calibratePlan(base, null, { timeZone }).asOf ?? null : null;
      const baseline = calibratePlan(plan, latest, {
        timeZone,
        asOfFallback,
      });
      const autoInvestRate =
        plan.autoInvestCustomRate != null
          ? parseFloat(plan.autoInvestCustomRate)
          : plan.autoInvestMethodId
            ? rateByMethod.get(plan.autoInvestMethodId) ?? 0
            : 0;
      const view = viewOf(
        baseline,
        await projectionOptionsFor(baseline, userId, { autoInvestRate }),
        today
      );
      const history = historyByPlan.get(plan.id) ?? [];
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
 * `today` — see `lib/finance/opening-balances.ts`. Which figures are edits is
 * judged against that same position (`effectiveEdits`), the one the plan
 * form shows. A confirmation made on `today` is flagged for syncing, so the
 * two statements of the day agree.
 */
export async function restateOpeningBalances(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date,
  edits: OpeningBalanceEdits,
  timeZone?: string | null
): Promise<PlanRestatement | null> {
  if (!changesOpeningBalances(plan, edits)) return null;
  const { latest, state } = await calibratedToday(plan, userId, today, timeZone);
  const changed = effectiveEdits(plan, state, edits);
  if (!changed) return null;
  const set = restateOpeningSet(plan, state, changed, today);
  // Only the main plan's statement is the user's: restating a what-if on the
  // day of a confirmation must leave that confirmation alone.
  const syncConfirmationId =
    plan.isMain && latest && isoDay(confirmationDay(latest)) === set.balancesAsOf ? latest.id : null;
  return { ...set, syncConfirmationId };
}

/** Where the plan, calibrated by its latest confirmation, stands on `today`. */
async function calibratedToday(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date,
  timeZone?: string | null
): Promise<{ latest: Awaited<ReturnType<typeof getLatestConfirmation>>; state: TodayState }> {
  const latest = await getLatestConfirmation(plan.userId);
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
    receivables: 0,
    netWorth: 0,
    debts: baseline.debts.map((d) => ({
      debtId: d.id,
      name: d.name,
      balance: parseFloat(d.initialBalance),
    })),
  };
  return { latest, state };
}
