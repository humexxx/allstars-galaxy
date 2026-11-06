import type { Projection, ProjectionMonth, TodayState } from "@/types/finance";
import { formatCurrencyCompact, moneySign, roundCents } from "@/lib/utils/format";
import { describeDebtFree, formatDebtFree, type ChartPoint } from "./chart-series";
import { nextPeriodStart } from "./period";

/** Closed periods the chart shows before today, drawn solid. */
export const DASHBOARD_PAST_MONTHS = 3;

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const CLOSE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The last day of the period that starts on `start`. Points are named after
 * it: a period anchored on the 5th runs Oct 5 – Nov 4, and calling its close
 * "Oct" put "Now" (Nov 3) where October belonged and skipped November.
 */
function periodClose(start: Date, anchorDay: number): Date {
  return new Date(nextPeriodStart(start, anchorDay > 0 ? anchorDay : 1).getTime() - DAY_MS);
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
  /** Where the point sits on the time axis (epoch ms): a close's last day,
   *  a movement's day, today. */
  time: number;
  /** Whether the axis labels this point. */
  tick: boolean;
  /** A period's close, a day money moved, or today's position. */
  kind: "close" | "movement" | "today";
  /** Axis tick: "Now" for today's position, else the month ("Oct"). */
  month: string;
  /** Tooltip title: "Today", else the close's date — the 12 closes run into
   *  the same month a year on, so the bare month is ambiguous. */
  label: string;
};

/** What the dashboard's finance card shows. */
export type DashboardFigures = DashboardParts & {
  /**
   * Mini-chart: up to three closed periods, today's position, then the next
   * 12 period closes.
   */
  points: DashboardPoint[];
  /** Points before today's; `points[pastCount]` is today. */
  pastCount: number;
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

/**
 * A closed period from the plan's timeline. A snapshot records no portfolio
 * figure of its own, only the net worth it is part of, so investments are
 * what net worth holds besides the other parts — for a projected row that is
 * exactly investments + portfolio, as in `partsOf`.
 */
function partsOfPoint(p: ChartPoint): DashboardParts {
  const savings = p.savings ?? 0;
  const debt = p.totalDebt ?? 0;
  const receivables = p.receivables ?? 0;
  return {
    savings,
    investments: p.netWorth - savings - receivables + debt,
    receivables,
    debt,
    netWorth: p.netWorth,
  };
}

/** A closed period's names, after its last day: "Nov" and "Nov 4, 2026". */
export function closeLabels(
  start: Date,
  anchorDay: number
): { time: number; month: string; label: string } {
  const close = periodClose(start, anchorDay);
  return { time: close.getTime(), month: MONTH_FMT.format(close), label: CLOSE_FMT.format(close) };
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
 *
 * `past` is the plan's timeline before today's period (`buildPlanTimeline`),
 * oldest first: recorded snapshots where there are any, as on the plan page.
 * The last `DASHBOARD_PAST_MONTHS` of it lead the chart.
 */
export function buildDashboardFigures(
  projection: Projection,
  today: TodayState | null,
  past: readonly ChartPoint[] = [],
  anchorDay = 1,
  /** Days money moved (movement snapshots), oldest first: drawn between the
   *  closes, at their own dates. */
  movements: readonly ChartPoint[] = []
): DashboardFigures {
  const months = projection.months;
  if (!today || months.length === 0) {
    return {
      points: [],
      pastCount: 0,
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
  const behind =
    today.status === "before-start" ? [] : past.slice(-DASHBOARD_PAST_MONTHS);
  const now = partsOf(today);
  const todayStart = new Date(today.date);
  todayStart.setUTCHours(0, 0, 0, 0);
  const closes = behind.map((p) => ({
    kind: "close" as const,
    ...closeLabels(p.date, anchorDay),
    ...inCents(partsOfPoint(p)),
  }));
  const since = closes[0]?.time ?? -Infinity;
  const moved =
    today.status === "before-start"
      ? []
      : movements
          .filter((p) => p.date.getTime() > since && p.date.getTime() < todayStart.getTime())
          .map((p) => ({
            kind: "movement" as const,
            time: p.date.getTime(),
            month: MONTH_FMT.format(p.date),
            label: CLOSE_FMT.format(p.date),
            ...inCents(partsOfPoint(p)),
          }));
  const pastPoints = [...closes, ...moved]
    .sort((a, b) => a.time - b.time)
    .map((p, i) => ({ ...p, tick: i === 0 }));
  const points: DashboardPoint[] = [
    ...pastPoints,
    {
      kind: "today",
      time: today.date.getTime(),
      tick: true,
      month: today.status === "before-start" ? "Start" : "Now",
      label: today.status === "before-start" ? "At the start" : "Today",
      ...inCents(now),
    },
    ...ahead.map((m, i) => ({
      kind: "close" as const,
      ...closeLabels(m.date, anchorDay),
      tick: (i + 1) % 3 === 0,
      ...inCents(partsOf(m)),
    })),
  ];
  const end = ahead.length > 0 ? ahead[ahead.length - 1].netWorth : today.netWorth;
  return {
    ...now,
    points,
    pastCount: pastPoints.length,
    delta: end - today.netWorth,
    deltaPeriods: ahead.length,
    status: today.status,
  };
}

const MILESTONE_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** The card's goal, and which figure it belongs under. */
export type DashboardGoal = { kind: "debt-free" | "milestone"; text: string };

/**
 * The card's goal: while there is debt, when it is gone; after that, the
 * next net-worth milestone the projection reaches. Null when neither is
 * within the plan's horizon.
 */
export function dashboardGoal(
  projection: Projection,
  today: TodayState | null,
  milestones: readonly number[],
  anchorDay: number,
  now: Date
): DashboardGoal | null {
  if (!today) return null;
  if (projection.hadDebt && moneySign(today.totalDebt) > 0) {
    const status = describeDebtFree(projection, anchorDay, now);
    return status.kind === "beyond-horizon"
      ? null
      : { kind: "debt-free", text: formatDebtFree(status) };
  }
  const next = [...milestones].sort((a, b) => a - b).find((m) => m > today.netWorth);
  if (next === undefined) return null;
  const firstAfter =
    today.status === "before-start" ? 0 : Math.min(today.periodIndex + 1, projection.months.length);
  const reached = projection.months.slice(firstAfter).find((m) => m.netWorth >= next);
  if (!reached) return null;
  return {
    kind: "milestone",
    text: `${formatCurrencyCompact(next)} net worth · ${MILESTONE_MONTH.format(
      periodClose(reached.date, anchorDay)
    )}`,
  };
}
