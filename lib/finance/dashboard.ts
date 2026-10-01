import type { Projection, TodayState } from "@/types/finance";
import { roundCents } from "@/lib/utils/format";

import { describeDebtFree, type DebtFreeStatus } from "./chart-series";

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const MONTH_YEAR_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** One mini-chart point. */
export type DashboardPoint = {
  /** Axis tick: "Now" for today's position, else the month ("Oct"). */
  month: string;
  /** Tooltip title: "Today", else month and year — the 12 closes run into
   *  the same month a year on, so the bare month is ambiguous. */
  label: string;
  /** At cent precision, the figure the KPI tiles print. */
  netWorth: number;
};

/** What the dashboard's finance card shows. */
export type DashboardFigures = {
  /** Mini-chart: today's position, then the next 12 period closes. */
  points: DashboardPoint[];
  savings: number;
  investments: number;
  totalDebt: number;
  netWorth: number;
  /** Last chart point − today: the change the "12 mo" badge names. */
  delta: number;
  /** Periods the delta spans (12, fewer when the horizon ends sooner). */
  deltaPeriods: number;
  debtFree: DebtFreeStatus;
  status: TodayState["status"] | null;
};

/**
 * The dashboard card's figures, from the SAME calibrated projection and
 * day-aware today as the plan page. Its "now" tiles used to be the period's
 * projected close (a paycheque off) with the portfolio held flat; its badge
 * measured one period past the chart's last point.
 */
export function buildDashboardFigures(
  projection: Projection,
  today: TodayState | null,
  anchorDay: number,
  now: Date
): DashboardFigures {
  const months = projection.months;
  const debtFree = describeDebtFree(projection, anchorDay, now);
  if (!today || months.length === 0) {
    return {
      points: [],
      savings: 0,
      investments: 0,
      totalDebt: 0,
      netWorth: 0,
      delta: 0,
      deltaPeriods: 0,
      debtFree,
      status: null,
    };
  }
  // The closes that come AFTER today's position: from the next period on
  // (today's own period close is still ahead but the today point stands in
  // for it, as on the plan chart); for a plan that hasn't started, from its
  // first period.
  const firstAfter =
    today.status === "before-start" ? 0 : Math.min(today.periodIndex + 1, months.length);
  const ahead = months.slice(firstAfter, firstAfter + 12);
  // Cents, not whole dollars: the tooltip printed "-1,467" beside a
  // "-$1,467.28" tile for the same point.
  const points: DashboardPoint[] = [
    {
      month: today.status === "before-start" ? "Start" : "Now",
      label: today.status === "before-start" ? "At the start" : "Today",
      netWorth: roundCents(today.netWorth),
    },
    ...ahead.map((m) => ({
      month: MONTH_FMT.format(m.date),
      label: MONTH_YEAR_FMT.format(m.date),
      netWorth: roundCents(m.netWorth),
    })),
  ];
  const end = ahead.length > 0 ? ahead[ahead.length - 1].netWorth : today.netWorth;
  return {
    points,
    savings: today.savings,
    investments: today.investments,
    totalDebt: today.totalDebt,
    netWorth: today.netWorth,
    delta: end - today.netWorth,
    deltaPeriods: ahead.length,
    debtFree,
    status: today.status,
  };
}
