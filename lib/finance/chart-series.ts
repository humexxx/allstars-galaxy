import type { Projection } from "@/types/finance";

/** One real recorded monthly snapshot point (from `getRecentMonthlySnapshots`),
 *  used to draw the chart's past from actuals rather than a re-simulation. */
export type PlanHistoryPoint = {
  date: Date;
  savings: number;
  investments: number;
  totalDebt: number;
  netWorth: number;
};

/** One net-worth point on the chart timeline. */
export type ChartPoint = { date: Date; netWorth: number };

const monthKey = (d: Date): number => d.getUTCFullYear() * 12 + d.getUTCMonth();

/**
 * Pure-projection window: ~25% past + ~75% future, anchored on today's month.
 * Used for the forecast KPIs and the monthly-breakdown table, and as the chart
 * fallback when there are no real snapshots yet.
 *
 * Projection dates are generated at UTC midnight, so the today-bucket compare
 * is done in UTC on both sides — a local year/month would shift a month in
 * negative-offset timezones and mis-place "today".
 */
export function computeProjectionWindow(
  projection: Projection,
  totalMonths: number,
  today: Date = new Date()
): {
  startIndex: number;
  count: number;
  pastCount: number;
  todayIndex: number;
} {
  const targetPast = Math.max(1, Math.round(totalMonths * 0.25));
  const todayKey = monthKey(today);
  let projIdx = projection.months.findIndex((m) => monthKey(m.date) === todayKey);
  if (projIdx === -1) projIdx = 0;
  const pastCount = Math.min(targetPast, projIdx);
  const startIndex = Math.max(0, projIdx - pastCount);
  const count = Math.min(totalMonths, projection.months.length - startIndex);
  return { startIndex, count, pastCount, todayIndex: pastCount };
}

/**
 * Build the chart's net-worth series: months BEFORE the current calendar month
 * come from REAL recorded snapshots (today → backwards), the current month and
 * forward from the (confirmation-calibrated) projection. The two halves line up
 * because both are bucketed by calendar month (`year*12 + month`), so a
 * period-anchored projection date (e.g. day-15) and a snapshot dated day-30 of
 * the same month share one x-slot. `pastCount` is the solid/dashed boundary.
 *
 * Falls back to a pure-projection window (the historical re-simulated past)
 * when there are no usable snapshots yet — fresh plans before the cron has run
 * a few times — so the chart is never empty.
 */
export function buildChartSeries(
  history: PlanHistoryPoint[],
  projection: Projection,
  horizonMonths: number,
  today: Date = new Date()
): { points: ChartPoint[]; pastCount: number } {
  const currentKey = monthKey(today);
  const pastBudget = Math.max(1, Math.round(horizonMonths * 0.25));

  // Real past: snapshots strictly before this month, the latest `pastBudget`.
  const past = history
    .filter((h) => monthKey(h.date) < currentKey)
    .slice(-pastBudget)
    .map((h) => ({ date: h.date, netWorth: h.netWorth }));

  // Future: the projection from the current calendar month forward.
  const futureStart = projection.months.findIndex(
    (m) => monthKey(m.date) >= currentKey
  );

  if (past.length === 0 || futureStart === -1) {
    // No real history (or today sits outside the projection) → re-simulated
    // window, identical to the pre-snapshot behaviour.
    const w = computeProjectionWindow(projection, horizonMonths, today);
    const slice = projection.months
      .slice(w.startIndex, w.startIndex + w.count)
      .map((m) => ({ date: m.date, netWorth: m.netWorth }));
    return { points: slice, pastCount: w.pastCount };
  }

  const future = projection.months
    .slice(futureStart, futureStart + Math.max(1, horizonMonths - past.length))
    .map((m) => ({ date: m.date, netWorth: m.netWorth }));

  return { points: [...past, ...future], pastCount: past.length };
}
