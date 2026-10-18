import type { Projection } from "@/types/finance";

import { periodIndexForDate } from "./period";

export type ScenarioComparison = {
  /** The period both plans are compared at: the earlier of the two ends. */
  at: Date | null;
  /** Scenario − base net worth at `at` (null when either has no row there). */
  netWorthDelta: number | null;
  scenarioDebtFreeDate: Date | null;
  baseDebtFreeDate: Date | null;
  /**
   * Scenario payoff − base payoff in PERIODS, compared as calendar dates
   * (negative = sooner). Null unless both clear their debt.
   */
  debtFreeDeltaMonths: number | null;
};

/**
 * Scenario vs its base, on one footing: both projections must be built the
 * same way (the plan page projects both from their plans as written, with the
 * base plan's as-of day), and they are compared at the SAME period — the
 * earlier of their two end dates — with debt-free compared as dates. (The old
 * card subtracted each plan's own ending figure and its own period count,
 * which showed an unchanged clone as "−$10,500, 8 mo later".)
 */
export function compareScenario(
  scenario: Projection,
  base: Projection,
  anchorDay: number
): ScenarioComparison {
  const a = anchorDay > 0 ? anchorDay : 1;
  const sLast = scenario.months.at(-1)?.date ?? null;
  const bLast = base.months.at(-1)?.date ?? null;
  const at =
    sLast && bLast ? (sLast.getTime() <= bLast.getTime() ? sLast : bLast) : null;
  const rowAt = (p: Projection) =>
    at ? p.months.find((m) => periodIndexForDate(m.date, a, at) === 0) : undefined;
  const sRow = rowAt(scenario);
  const bRow = rowAt(base);
  const netWorthDelta = sRow && bRow ? sRow.netWorth - bRow.netWorth : null;
  const sDate = scenario.debtFreeDate;
  const bDate = base.debtFreeDate;
  return {
    at,
    netWorthDelta,
    scenarioDebtFreeDate: sDate,
    baseDebtFreeDate: bDate,
    debtFreeDeltaMonths: sDate && bDate ? periodIndexForDate(bDate, a, sDate) : null,
  };
}
