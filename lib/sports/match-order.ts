/**
 * Single source of truth for how match lists are ordered for display:
 * live first, then upcoming nearest-first, then results most-recent-first.
 *
 * The services previously sorted plain descending by date, which put fixtures
 * 60 days away at the TOP of every list (and a `find(scheduled)` on that order
 * picked the furthest-away match as the dashboard "Upcoming" highlight). With
 * this order, `slice(0, max)` naturally keeps what users care about: anything
 * live, the next few fixtures, and the freshest results.
 */
export function orderMatchesForDisplay<T>(
  matches: T[],
  getDate: (m: T) => string,
  getStatus: (m: T) => string,
  max?: number
): T[] {
  const rank = (m: T): number => {
    const s = getStatus(m);
    if (s === "live") return 0;
    if (s === "scheduled") return 1;
    return 2; // finished / postponed / cancelled
  };

  const sorted = [...matches].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const ta = new Date(getDate(a)).getTime();
    const tb = new Date(getDate(b)).getTime();
    // Upcoming: soonest first. Results (and live): most recent first.
    return ra === 1 ? ta - tb : tb - ta;
  });

  return max !== undefined ? sorted.slice(0, max) : sorted;
}
