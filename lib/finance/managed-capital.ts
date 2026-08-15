/**
 * Aggregation for the "capital under management" card, kept pure so the same
 * maths runs on the server for the initial render and in the browser when the
 * user changes a filter — one definition, no drift between the two.
 */

/** One approved buy, flattened with everything the filters key on. */
export type ManagedContribution = {
  /** ISO day (YYYY-MM-DD). */
  date: string;
  methodId: string;
  methodName: string;
  investorId: string;
  investorName: string;
  /** True when the investor IS the owner — their own money. */
  isOwn: boolean;
  /** `initialValue` — what was put in. */
  contributed: number;
  /** `currentValue` — what it is worth today. */
  holding: number;
};

export type ManagedCapitalFilters = {
  /** Empty = every method. */
  methodIds: string[];
  /** Empty = every investor. */
  investorIds: string[];
};

export type ManagedCapitalSummary = {
  points: { date: string; own: number; thirdParty: number }[];
  ownContributed: number;
  thirdPartyContributed: number;
  ownHolding: number;
  thirdPartyHolding: number;
};

export const NO_FILTERS: ManagedCapitalFilters = {
  methodIds: [],
  investorIds: [],
};

export function filterContributions(
  rows: readonly ManagedContribution[],
  filters: ManagedCapitalFilters
): ManagedContribution[] {
  return rows.filter(
    (r) =>
      (filters.methodIds.length === 0 ||
        filters.methodIds.includes(r.methodId)) &&
      (filters.investorIds.length === 0 ||
        filters.investorIds.includes(r.investorId))
  );
}

/**
 * Cumulative contributed capital by day, split own vs third-party, plus
 * present-day holdings. Rows need not arrive sorted.
 */
export function aggregateManagedCapital(
  rows: readonly ManagedContribution[]
): ManagedCapitalSummary {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  let own = 0;
  let thirdParty = 0;
  let ownHolding = 0;
  let thirdPartyHolding = 0;
  // Keyed by day so several buys on one date make a single step, not a
  // cluster of points sharing an x value.
  const byDay = new Map<string, { own: number; thirdParty: number }>();

  for (const r of sorted) {
    if (r.isOwn) {
      own += r.contributed;
      ownHolding += r.holding;
    } else {
      thirdParty += r.contributed;
      thirdPartyHolding += r.holding;
    }
    byDay.set(r.date, { own, thirdParty });
  }

  return {
    points: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    ownContributed: own,
    thirdPartyContributed: thirdParty,
    ownHolding,
    thirdPartyHolding,
  };
}
