/** Room of its own for each side, rather than one cap they share. */
export type MatchCaps = { upcoming: number; results: number };

/**
 * Single source of truth for how match lists are ordered for display: live
 * first, then fixtures soonest first, then results latest first, so the top
 * of a list is what is on, what is next and what just finished. `max` gives
 * each side a cap of its own, so a long window of fixtures cannot crowd out
 * the results; live is always in.
 */
export function orderMatchesForDisplay<T>(
  matches: T[],
  getDate: (m: T) => string,
  getStatus: (m: T) => string,
  max?: MatchCaps
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

  if (max === undefined) return sorted;
  return [
    ...sorted.filter((m) => rank(m) === 0),
    ...sorted.filter((m) => rank(m) === 1).slice(0, max.upcoming),
    ...sorted.filter((m) => rank(m) === 2).slice(0, max.results),
  ];
}
