import type { ChartDataPoint } from "@/types/chart";
import type { PortfolioTransaction } from "@/types/portfolio";

/** Approved cash in (+) or out (-) of a portfolio, at its timestamp. */
export type CashFlowPoint = { date: string; amount: number };

/**
 * The value series behind the performance chart, ending at the live value.
 *
 * With no snapshots (or only zero ones) the series is rebuilt from the
 * approved transactions instead of drawing a flat zero line. Either way the series ends on today's
 * total, so the chart cannot disagree with the "Total value" card beside it
 * (snapshots lag the interest the 1st of the month applies).
 */
export function performanceSeries(
  snapshots: ChartDataPoint[],
  transactions: Pick<PortfolioTransaction, "type" | "status" | "total" | "date">[],
  totalValue: number,
  today: Date
): ChartDataPoint[] {
  let series = snapshots.some((p) => p.value !== 0) ? snapshots : [];

  if (series.length === 0) {
    let runningTotal = 0;
    series = transactions
      // "closed" is a buy drained by withdrawals: its cash still came in.
      .filter((t) => t.status === "approved" || t.status === "closed")
      .map((t) => {
        runningTotal += t.type === "buy" ? parseFloat(t.total) : -parseFloat(t.total);
        return { date: new Date(t.date).toISOString(), value: runningTotal };
      });
  }
  if (series.length === 0) return [];

  const last = series[series.length - 1];
  const lastIsToday = new Date(last.date).toDateString() === today.toDateString();
  return lastIsToday
    ? [...series.slice(0, -1), { date: last.date, value: totalValue }]
    : [...series, { date: today.toISOString(), value: totalValue }];
}

/**
 * What the range EARNED: the change in value minus the money that moved in or
 * out after its first point, as a share of what was at work (the starting
 * value plus what was added).
 */
export function rangeGain(
  points: ChartDataPoint[],
  cashFlows: CashFlowPoint[]
): { gain: number; percent: number } {
  if (points.length < 2) return { gain: 0, percent: 0 };
  const start = new Date(points[0].date).getTime();
  const end = new Date(points[points.length - 1].date).getTime();
  let net = 0;
  let added = 0;
  for (const f of cashFlows) {
    const t = new Date(f.date).getTime();
    if (t <= start || t > end) continue;
    net += f.amount;
    if (f.amount > 0) added += f.amount;
  }
  const gain = points[points.length - 1].value - points[0].value - net;
  const base = points[0].value + added;
  return { gain, percent: base > 0 ? (gain / base) * 100 : 0 };
}
