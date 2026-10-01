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
  /**
   * Exclusive: the entry stops counting from this month on. Set on the entry
   * that stands for money later WITHDRAWN — it was owed until the month it
   * left (see `withdrawnLiability`).
   */
  endMonth?: string;
};

/** Cash in (positive) or out (negative) in the month it moved. */
export type CashFlow = {
  month: string;
  amount: number;
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
  /** Cash contributed to date net of withdrawals, the owner's included. */
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

/**
 * The liability entry for money withdrawn from a promised balance.
 *
 * A withdrawal lowers the stored `currentValue` of the buy it came out of, so
 * discounting that value backwards understates every month BEFORE the
 * withdrawal by exactly the money that left — the chart drew the balance as
 * if it had never been there. This entry puts it back for those months: the
 * amount is carried forward to today's terms so the same discounting lands it
 * on the withdrawn figure in the month it left, and it stops counting from
 * that month on.
 */
export function withdrawnLiability(input: {
  amount: number;
  monthlyRoi: number;
  /** YYYY-MM of the buy the money was withdrawn from. */
  sourceMonth: string;
  /** YYYY-MM the withdrawal was approved. */
  withdrawalMonth: string;
  today: string;
  isOwn: boolean;
}): LiabilityEntry {
  const periods = Math.max(0, monthsBetween(input.withdrawalMonth, input.today));
  return {
    month: input.sourceMonth,
    endMonth: input.withdrawalMonth,
    currentValue: input.amount * Math.pow(1 + input.monthlyRoi, periods),
    monthlyRoi: input.monthlyRoi,
    isOwn: input.isOwn,
  };
}

export function buildMarginHistory(input: {
  contributions: ContributionUnits[];
  liabilities: LiabilityEntry[];
  /**
   * Cash that moved, from the TRANSACTIONS rather than from what was priced.
   * `invested` used to be summed from the priced allocations, so a book whose
   * contributions had not been priced yet read "Contributed $0.00" with tens
   * of thousands in it. Omitted, the priced amounts stand in (older callers).
   */
  cashFlows?: CashFlow[];
  /** Month-end price, keyed `assetId|YYYY-MM`. */
  prices: Map<string, number>;
  today: string;
}): MarginPoint[] {
  const { contributions, liabilities, prices, today } = input;
  const cashFlows =
    input.cashFlows ?? contributions.map((c) => ({ month: c.month, amount: c.amount }));
  if (contributions.length === 0 && liabilities.length === 0 && cashFlows.length === 0) {
    return [];
  }

  const months = [
    ...contributions.map((c) => c.month),
    ...liabilities.map((l) => l.month),
    ...cashFlows.map((c) => c.month),
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
    }
    for (const c of cashFlows) {
      if (c.month <= month) invested += c.amount;
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
      if (l.endMonth !== undefined && month >= l.endMonth) continue;
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
