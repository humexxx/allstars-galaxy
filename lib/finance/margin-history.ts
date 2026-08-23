/**
 * The margin, month by month.
 *
 * Liability is DISCOUNTED BACKWARDS from each transaction's stored
 * `currentValue` rather than recomputed forwards from `initialValue`. That is
 * deliberate: `currentValue` is whatever the interest cron actually applied,
 * and rebuilding it from a formula disagrees with it (the real data shows 14
 * compounding periods across ~11.5 calendar months). Discounting guarantees
 * the series lands exactly on the figure the headline shows, so the chart can
 * never contradict the card above it.
 */

export type ContributionUnits = {
  /** YYYY-MM the contribution landed. */
  month: string;
  assetId: string;
  /** Signed: negative for a withdrawal. */
  quantity: number;
  amount: number;
};

export type LiabilityEntry = {
  month: string;
  /** Value today, as stored. */
  currentValue: number;
  /** Method's monthly rate as a fraction, e.g. 0.007. */
  monthlyRoi: number;
  /** The owner's own money is capital, not debt. */
  isOwn: boolean;
};

export type MarginPoint = {
  month: string;
  /** Units x that month's price. */
  deployed: number;
  /** Owed to everyone but the owner. */
  liability: number;
  /** The owner's own stake at that month. */
  ownPosition: number;
  /** deployed - liability. */
  margin: number;
  /** Cash contributed to date, the owner's included. */
  invested: number;
};

/** Inclusive list of YYYY-MM from `first` to `last`. */
export function monthRange(first: string, last: string): string[] {
  const out: string[] = [];
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  let y = fy;
  let m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * What a promised balance was worth at an earlier month.
 *
 * Discounts today's value back at the same rate it grew: a stake worth 1102.59
 * now, at 0.7%/month, was 1000 fourteen periods ago.
 */
export function discountToMonth(
  currentValue: number,
  monthlyRoi: number,
  month: string,
  today: string
): number {
  const periods = monthsBetween(month, today);
  if (periods <= 0) return currentValue;
  return currentValue / Math.pow(1 + monthlyRoi, periods);
}

export function buildMarginHistory(input: {
  contributions: ContributionUnits[];
  liabilities: LiabilityEntry[];
  /** Month-end price, keyed `assetId|YYYY-MM`. */
  prices: Map<string, number>;
  today: string;
}): MarginPoint[] {
  const { contributions, liabilities, prices, today } = input;
  if (contributions.length === 0 && liabilities.length === 0) return [];

  const months = [
    ...contributions.map((c) => c.month),
    ...liabilities.map((l) => l.month),
  ].sort();
  const series = monthRange(months[0], today);

  // Carry the last known price forward. A month with no quote is a gap in our
  // data, not the asset becoming worthless — valuing it at zero would draw a
  // cliff that never happened.
  const lastPrice = new Map<string, number>();

  return series.map((month) => {
    const units = new Map<string, number>();
    let invested = 0;

    for (const c of contributions) {
      if (c.month > month) continue;
      units.set(c.assetId, (units.get(c.assetId) ?? 0) + c.quantity);
      invested += c.amount;
    }

    let deployed = 0;
    for (const [assetId, qty] of units) {
      const price = prices.get(`${assetId}|${month}`) ?? lastPrice.get(assetId);
      if (price === undefined) continue;
      lastPrice.set(assetId, price);
      deployed += qty * price;
    }

    let liability = 0;
    let ownPosition = 0;
    for (const l of liabilities) {
      if (l.month > month) continue;
      const value = discountToMonth(l.currentValue, l.monthlyRoi, month, today);
      if (l.isOwn) ownPosition += value;
      else liability += value;
    }

    return {
      month,
      deployed,
      liability,
      ownPosition,
      margin: deployed - liability,
      invested,
    };
  });
}
