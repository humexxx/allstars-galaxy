import type { Projection, ProjectionMonth, TodayState } from "@/types/finance";
import { roundCents } from "@/lib/utils/format";

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const MONTH_YEAR_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** What net worth is made of, at one point. */
export type DashboardParts = {
  /** Can be negative: an overdrawn account. */
  savings: number;
  /** Investments AND the portfolio — see `partsOf`. */
  investments: number;
  /** Money owed to the user, not yet repaid. */
  receivables: number;
  /** Owed BY the user, as a positive amount. */
  debt: number;
  netWorth: number;
};

/** One mini-chart point, at cent precision: the tooltip printed "-1,467"
 *  beside a "-$1,467.28" tile for the same point. */
export type DashboardPoint = DashboardParts & {
  /** Axis tick: "Now" for today's position, else the month ("Oct"). */
  month: string;
  /** Tooltip title: "Today", else month and year — the 12 closes run into
   *  the same month a year on, so the bare month is ambiguous. */
  label: string;
};

/** What the dashboard's finance card shows. */
export type DashboardFigures = DashboardParts & {
  /** Mini-chart: today's position, then the next 12 period closes. */
  points: DashboardPoint[];
  /** Last chart point − today: the change the "12 mo" badge names. */
  delta: number;
  /** Periods the delta spans (12, fewer when the horizon ends sooner). */
  deltaPeriods: number;
  status: TodayState["status"] | null;
};

type State = Pick<
  TodayState & ProjectionMonth,
  "savings" | "investments" | "portfolioValue" | "receivables" | "totalDebt" | "netWorth"
>;

/**
 * The portfolio is folded into investments so the parts add up to net worth.
 * On its own line it had no tile: a plan holding its money in the portfolio
 * read "Investments $0.00" beside a net worth that the tiles could not explain.
 */
function partsOf(s: State): DashboardParts {
  return {
    savings: s.savings,
    investments: s.investments + s.portfolioValue,
    receivables: s.receivables,
    debt: s.totalDebt,
    netWorth: s.netWorth,
  };
}

function inCents(p: DashboardParts): DashboardParts {
  return {
    savings: roundCents(p.savings),
    investments: roundCents(p.investments),
    receivables: roundCents(p.receivables),
    debt: roundCents(p.debt),
    netWorth: roundCents(p.netWorth),
  };
}

/**
 * The dashboard card's figures, from the SAME calibrated projection and
 * day-aware today as the plan page. Its "now" tiles used to be the period's
 * projected close (a paycheque off) with the portfolio held flat; its badge
 * measured one period past the chart's last point.
 */
export function buildDashboardFigures(
  projection: Projection,
  today: TodayState | null
): DashboardFigures {
  const months = projection.months;
  if (!today || months.length === 0) {
    return {
      points: [],
      savings: 0,
      investments: 0,
      receivables: 0,
      debt: 0,
      netWorth: 0,
      delta: 0,
      deltaPeriods: 0,
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
  const now = partsOf(today);
  const points: DashboardPoint[] = [
    {
      month: today.status === "before-start" ? "Start" : "Now",
      label: today.status === "before-start" ? "At the start" : "Today",
      ...inCents(now),
    },
    ...ahead.map((m) => ({
      month: MONTH_FMT.format(m.date),
      label: MONTH_YEAR_FMT.format(m.date),
      ...inCents(partsOf(m)),
    })),
  ];
  const end = ahead.length > 0 ? ahead[ahead.length - 1].netWorth : today.netWorth;
  return {
    ...now,
    points,
    delta: end - today.netWorth,
    deltaPeriods: ahead.length,
    status: today.status,
  };
}
