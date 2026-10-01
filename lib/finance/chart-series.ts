import type { PlanSummary, Projection, TodayState } from "@/types/finance";

import { periodIndexForDate, periodStartFor } from "./period";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** One real recorded snapshot (from `getRecentMonthlySnapshots`). */
export type PlanHistoryPoint = {
  date: Date;
  savings: number;
  investments: number;
  totalDebt: number;
  netWorth: number;
};

/**
 * One point on a plan's timeline, dated at its period start. EVERY point
 * means the same thing: the balances at that period's CLOSE (except the
 * today point, which the editor replaces with the day-aware position).
 * `savings` / `totalDebt` / `investments` ride along for tooltips and
 * dialogs; only `netWorth` is plotted.
 */
export type ChartPoint = {
  date: Date;
  netWorth: number;
  savings?: number;
  totalDebt?: number;
  investments?: number;
};

function effAnchor(anchorDay: number): number {
  return anchorDay > 0 ? anchorDay : 1;
}

/**
 * The period whose CLOSE a snapshot records. Snapshots store the OPENING of
 * the period they were taken in — the previous period's close — so a
 * snapshot taken on any day of the September period belongs on the August
 * slot. Plotting it at its own period put openings next to projected closes,
 * one period out of step.
 */
export function snapshotClosePeriod(date: Date, anchorDay: number): Date {
  const a = effAnchor(anchorDay);
  const ownStart = periodStartFor(date, a);
  return periodStartFor(new Date(ownStart.getTime() - MS_PER_DAY), a);
}

/**
 * Real snapshots as close-of-period points, one per period (the latest
 * snapshot wins), oldest first.
 */
export function historyToClosePoints(
  history: readonly PlanHistoryPoint[],
  anchorDay: number
): ChartPoint[] {
  const byPeriod = new Map<number, { taken: number; point: ChartPoint }>();
  for (const h of history) {
    const at = snapshotClosePeriod(h.date, anchorDay);
    const key = at.getTime();
    const prev = byPeriod.get(key);
    if (prev && prev.taken >= h.date.getTime()) continue;
    byPeriod.set(key, {
      taken: h.date.getTime(),
      point: {
        date: at,
        netWorth: h.netWorth,
        savings: h.savings,
        totalDebt: h.totalDebt,
        investments: h.investments,
      },
    });
  }
  return [...byPeriod.values()]
    .map((v) => v.point)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** A plan's whole timeline: real past + today's period onward. */
export type PlanTimeline = {
  points: ChartPoint[];
  /** Index of the point for the period that contains today. */
  todayIndex: number;
};

/**
 * The past and future of one plan on one axis.
 *
 * - Past (periods that closed before today's): REAL snapshots, as closes.
 *   With none, `simulatedPast` (the plan's own forecast — only passed while
 *   the plan has no confirmation) or else the calibrated projection's own
 *   rows before today.
 * - Today's period onward: the (calibrated) projection.
 *
 * A plan that starts after today has no past and `todayIndex` 0 on its first
 * period; one whose horizon ended has no future and `todayIndex` on its last.
 */
export function buildPlanTimeline(
  history: readonly PlanHistoryPoint[],
  projection: Projection,
  today: Date,
  anchorDay: number = 1,
  simulatedPast?: Projection | null
): PlanTimeline {
  const months = projection.months;
  if (months.length === 0) {
    const past = historyToClosePoints(history, anchorDay);
    return { points: past, todayIndex: Math.max(0, past.length - 1) };
  }
  const a = effAnchor(anchorDay);
  const base = months[0].date;
  const todayIdx = periodIndexForDate(base, a, today);
  const isPast = (d: Date): boolean => periodIndexForDate(base, a, d) < todayIdx;
  const toPoint = (m: Projection["months"][number]): ChartPoint => ({
    date: m.date,
    netWorth: m.netWorth,
    savings: m.savings,
    totalDebt: m.totalDebt,
    investments: m.investments,
  });

  let past = historyToClosePoints(history, a).filter((p) => isPast(p.date));
  if (past.length === 0 && simulatedPast) {
    past = simulatedPast.months.filter((m) => isPast(m.date)).map(toPoint);
  }
  if (past.length === 0) {
    past = months.filter((m) => isPast(m.date)).map(toPoint);
  }
  const future = months.filter((m) => !isPast(m.date)).map(toPoint);

  if (future.length === 0) {
    // Past the horizon: the last close stands in for today.
    return { points: past, todayIndex: Math.max(0, past.length - 1) };
  }
  return { points: [...past, ...future], todayIndex: past.length };
}

/**
 * The chart's window onto a plan's timeline: ~25% past (at most what exists)
 * then the future, `horizonMonths` points in total. The chart, the End KPI
 * and the table all read THIS series, so they can't disagree on where the
 * window ends.
 */
export function buildChartSeries(
  history: PlanHistoryPoint[],
  projection: Projection,
  horizonMonths: number,
  today: Date = new Date(),
  anchorDay: number = 1,
  simulatedPast?: Projection | null
): { points: ChartPoint[]; pastCount: number } {
  const timeline = buildPlanTimeline(history, projection, today, anchorDay, simulatedPast);
  const pastBudget = Math.max(1, Math.round(horizonMonths * 0.25));
  const pastCount = Math.min(pastBudget, timeline.todayIndex);
  const start = timeline.todayIndex - pastCount;
  const points = timeline.points.slice(start, start + Math.max(1, horizonMonths));
  return { points, pastCount };
}

/**
 * Puts the day-aware position (`projectStateAt` for today) on the timeline's
 * today point, which otherwise holds the period's projected CLOSE. The Today
 * KPI, this dot and its tooltip then show one figure. Only for a today that
 * falls inside the horizon.
 */
export function alignTodayPoint(
  series: { points: ChartPoint[]; pastCount: number },
  today: TodayState | null,
  anchorDay: number
): { points: ChartPoint[]; pastCount: number } {
  if (!today || today.status !== "in-range") return series;
  const point = series.points[series.pastCount];
  if (!point || periodIndexForDate(point.date, effAnchor(anchorDay), today.date) !== 0) {
    return series;
  }
  const points = series.points.slice();
  points[series.pastCount] = {
    ...point,
    netWorth: today.netWorth,
    savings: today.savings,
    totalDebt: today.totalDebt,
    investments: today.investments,
  };
  return { points, pastCount: series.pastCount };
}

/**
 * The header's Today and Next points (and the compare dialog's "from").
 * In range: the today point and the close after it. Before the plan starts
 * there is no today point on the chart — its first point is the first
 * period's CLOSE — so Today is the opening position and Next is that first
 * close (it used to skip to the second close, and the opening KPI sat beside
 * a chart whose first point showed a different figure under the same month).
 */
export function forecastKpiPoints(
  series: { points: ChartPoint[]; pastCount: number },
  today: TodayState | null
): { todayPoint: ChartPoint | undefined; nextPoint: ChartPoint | undefined } {
  if (today?.status === "before-start") {
    return {
      todayPoint: {
        date: today.periodStart,
        netWorth: today.netWorth,
        savings: today.savings,
        totalDebt: today.totalDebt,
        investments: today.investments,
      },
      nextPoint: series.points[0],
    };
  }
  return {
    todayPoint: series.points[series.pastCount],
    nextPoint: series.points[series.pastCount + 1],
  };
}

/** `alignTodayPoint` for a whole timeline. */
export function alignTimelineToday(
  timeline: PlanTimeline,
  today: TodayState | null,
  anchorDay: number
): PlanTimeline {
  const aligned = alignTodayPoint(
    { points: timeline.points, pastCount: timeline.todayIndex },
    today,
    anchorDay
  );
  return { points: aligned.points, todayIndex: timeline.todayIndex };
}

/**
 * Pure-projection window: ~25% past + ~75% future, anchored on today's
 * period (found with `periodIndexForDate`, so a non-1 anchor day lands on the
 * period that really contains today).
 */
export function computeProjectionWindow(
  projection: Projection,
  totalMonths: number,
  today: Date = new Date(),
  anchorDay: number = 1,
  /** Fixed number of past periods; omit for ~25% of the range. */
  pastMonths?: number
): {
  startIndex: number;
  count: number;
  pastCount: number;
  todayIndex: number;
} {
  const targetPast = Math.max(1, pastMonths ?? Math.round(totalMonths * 0.25));
  const base = projection.months[0]?.date;
  let projIdx = base ? periodIndexForDate(base, anchorDay, today) : 0;
  if (projIdx < 0) projIdx = 0;
  else if (projIdx > projection.months.length - 1) {
    projIdx = Math.max(0, projection.months.length - 1);
  }
  const pastCount = Math.min(targetPast, projIdx);
  const startIndex = Math.max(0, projIdx - pastCount);
  const count = Math.min(totalMonths, projection.months.length - startIndex);
  return { startIndex, count, pastCount, todayIndex: pastCount };
}

/**
 * Aligns a base plan's projection ("ghost") to a chart series by accounting
 * PERIOD, never by array index. Periods the ghost doesn't cover map to null.
 */
export function mapGhostValues(
  points: readonly ChartPoint[],
  ghost: Projection,
  anchorDay: number = 1
): (number | null)[] {
  const a = effAnchor(anchorDay);
  return points.map((p) => {
    const m = ghost.months.find((gm) => periodIndexForDate(gm.date, a, p.date) === 0);
    return m ? m.netWorth : null;
  });
}

/**
 * Portfolio series aligned to a chart series: past points read the latest
 * recorded portfolio value inside the period they describe; today and forward
 * read the projection's portfolioValue, matched by period.
 */
export function mapPortfolioValues(
  points: readonly ChartPoint[],
  history: readonly { date: Date; value: number }[],
  projection: Projection,
  pastCount: number,
  anchorDay: number = 1
): (number | null)[] {
  const a = effAnchor(anchorDay);
  return points.map((p, i) => {
    if (i < pastCount) {
      let latest: number | null = null;
      for (const h of history) {
        if (periodIndexForDate(h.date, a, p.date) === 0) latest = h.value;
      }
      return latest;
    }
    const m = projection.months.find((pm) => periodIndexForDate(pm.date, a, p.date) === 0);
    return m ? m.portfolioValue : null;
  });
}

// ---------- debt-free: one definition everywhere ----------

/**
 * Months from TODAY until the period the debt clears in (counting that
 * period): payoff in today's own period is 1, already cleared is 0. Every
 * "Debt-free in N mo" label uses this.
 */
export function debtFreeMonthsFromDate(
  payoffPeriodStart: Date,
  anchorDay: number,
  today: Date
): number {
  return Math.max(0, periodIndexForDate(today, effAnchor(anchorDay), payoffPeriodStart) + 1);
}

/** `debtFreeMonthsFromDate` for a projection; null when never within it. */
export function debtFreeMonthsFromNow(
  projection: Projection,
  today: Date = new Date()
): number | null {
  if (projection.monthsToDebtFree === null) return null;
  const payoff = projection.months[projection.monthsToDebtFree - 1]?.date;
  if (!payoff) return projection.monthsToDebtFree;
  return debtFreeMonthsFromDate(payoff, projection.plan.confirmationDayOfMonth, today);
}

export type DebtFreeStatus =
  | { kind: "no-debt" }
  | { kind: "debt-free"; date: Date }
  | { kind: "on-track"; months: number; date: Date }
  | { kind: "beyond-horizon" };

/**
 * What to say about a plan's debt. A plan whose debts all start at 0 (or has
 * none) says "No debt" — it used to fall through to "Beyond horizon".
 */
export function describeDebtFree(
  outcome: { hadDebt: boolean; debtFreeDate: Date | null },
  anchorDay: number,
  today: Date
): DebtFreeStatus {
  if (!outcome.hadDebt) return { kind: "no-debt" };
  if (!outcome.debtFreeDate) return { kind: "beyond-horizon" };
  const months = debtFreeMonthsFromDate(outcome.debtFreeDate, anchorDay, today);
  if (months === 0) return { kind: "debt-free", date: outcome.debtFreeDate };
  return { kind: "on-track", months, date: outcome.debtFreeDate };
}

/** `DebtFreeStatus` from a precomputed `PlanSummary` (rail, compare tiles). */
export function summaryDebtFree(summary: PlanSummary): DebtFreeStatus {
  if (!summary.hadDebt) return { kind: "no-debt" };
  if (summary.monthsToDebtFree === null || !summary.debtFreeDate) {
    return { kind: "beyond-horizon" };
  }
  if (summary.monthsToDebtFree === 0) return { kind: "debt-free", date: summary.debtFreeDate };
  return { kind: "on-track", months: summary.monthsToDebtFree, date: summary.debtFreeDate };
}

const DEBT_FREE_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "No debt" · "Debt-free" · "Debt-free in 4 mo · Jan 2027" · "Beyond horizon". */
export function formatDebtFree(status: DebtFreeStatus): string {
  switch (status.kind) {
    case "no-debt":
      return "No debt";
    case "debt-free":
      return "Debt-free";
    case "on-track":
      return `Debt-free in ${status.months} mo · ${DEBT_FREE_MONTH.format(status.date)}`;
    case "beyond-horizon":
      return "Beyond horizon";
  }
}

// ---------- plans comparison chart ----------

export type CompareSeries = {
  key: string;
  timeline: PlanTimeline;
};

export type CompareRow = {
  /** Calendar month (UTC midnight of its 1st) the row stands for. */
  month: Date;
  /** Per series: the value in that month, or null when the plan has none. */
  values: Record<string, number | null>;
};

function monthKey(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/**
 * Rows for the plans comparison chart, JOINED BY CALENDAR MONTH: each plan
 * contributes the point whose period starts in that month. (Rows used to be
 * joined by array index, so a plan that started five months later was drawn
 * five months early.) `boundary` is the row of today's month; with `months`
 * the window is `pastMonths` rows before it plus the rest up to `months`,
 * otherwise every month any plan covers.
 */
export function buildCompareRows(
  series: readonly CompareSeries[],
  metric: "netWorth" | "totalDebt",
  today: Date,
  months?: number,
  pastMonths: number = 3
): { rows: CompareRow[]; boundary: number } {
  const lookups = series.map((s) => {
    const map = new Map<number, number>();
    for (const p of s.timeline.points) {
      const v = metric === "netWorth" ? p.netWorth : p.totalDebt ?? 0;
      map.set(monthKey(p.date), Number(v.toFixed(2)));
    }
    return { key: s.key, map };
  });
  const allKeys = lookups.flatMap((l) => [...l.map.keys()]);
  if (allKeys.length === 0) return { rows: [], boundary: -1 };

  const todayKey = monthKey(today);
  let startKey: number;
  let endKey: number;
  if (months) {
    startKey = todayKey - pastMonths;
    endKey = startKey + months - 1;
  } else {
    startKey = Math.min(...allKeys);
    endKey = Math.max(...allKeys);
  }

  const rows: CompareRow[] = [];
  for (let k = startKey; k <= endKey; k++) {
    const values: Record<string, number | null> = {};
    for (const l of lookups) values[l.key] = l.map.get(k) ?? null;
    rows.push({ month: new Date(Date.UTC(Math.floor(k / 12), k % 12, 1)), values });
  }
  const boundary = todayKey >= startKey && todayKey <= endKey ? todayKey - startKey : -1;
  return { rows, boundary };
}

const TICK_STEPS = [1, 2, 3, 6, 12, 24, 60] as const;

/**
 * X-axis ticks for month rows, on calendar boundaries: every `step` months
 * counted from January (so a 6-month step reads Jan / Jul every year), with
 * the smallest step that keeps the count within `maxTicks`. Recharts' own
 * thinning forced the last month in, so the final gap was uneven ("Aug 28,
 * Dec 28" after a run of 3-month steps). Exported for tests.
 */
export function calendarTicks(months: readonly Date[], maxTicks: number): number[] {
  if (months.length === 0) return [];
  const limit = Math.max(2, Math.floor(maxTicks));
  for (const step of TICK_STEPS) {
    const picked: number[] = [];
    months.forEach((m, i) => {
      if (m.getUTCMonth() % step === 0 && (step < 12 || m.getUTCMonth() === 0)) picked.push(i);
    });
    // A step longer than a year counts whole years from the first January.
    const ticks =
      step > 12
        ? picked.filter((_, k) => k % (step / 12) === 0)
        : picked;
    if (ticks.length <= limit && ticks.length > 0) return ticks;
  }
  return [0];
}

// ---------- milestones ----------

function monthsBetweenDates(a: Date, b: Date): number {
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  );
}

/**
 * First crossing of each milestone along a series: `x` is the fractional
 * point index (for placing the marker between points) and `monthsFromToday`
 * the distance from the today point in CALENDAR months, interpolated between
 * the two points' dates — so a gap in the recorded past (two points a
 * quarter apart) still counts three months, not one step.
 */
export function milestoneCrossings(
  points: readonly { date: Date; value: number }[],
  todayIndex: number,
  milestones: readonly number[]
): { x: number; milestone: number; monthsFromToday: number }[] {
  const out: { x: number; milestone: number; monthsFromToday: number }[] = [];
  const todayDate = points[Math.min(Math.max(0, todayIndex), points.length - 1)]?.date;
  if (!todayDate) return out;
  for (const m of milestones) {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1].value;
      const curr = points[i].value;
      if (
        (prev < m && curr >= m) ||
        (prev > m && curr <= m) ||
        // Starting exactly on the milestone (0 is the common case) counts.
        (i === 1 && prev === m)
      ) {
        const span = curr - prev;
        const t = Math.max(0, Math.min(1, span === 0 ? 0 : (m - prev) / span));
        const from = points[i - 1].date;
        const monthsFromToday =
          monthsBetweenDates(todayDate, from) + t * monthsBetweenDates(from, points[i].date);
        out.push({ x: i - 1 + t, milestone: m, monthsFromToday });
        break;
      }
    }
  }
  return out;
}
