/**
 * Single source of truth for how match lists are ordered for display:
 * live first, then upcoming nearest-first, then results most-recent-first.
 *
 * The services previously sorted plain descending by date, which put fixtures
 * 60 days away at the TOP of every list (and a `find(scheduled)` on that order
 * picked the furthest-away match as the dashboard "Upcoming" highlight). With
 * this order, a cap keeps what users care about: anything live, then the
 * next fixtures and the freshest results, half the room each.
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

  if (max === undefined) return sorted;
  // A cap shares its room between fixtures and results. Filling it in rank
  // order let a 60-day window of fixtures take every slot, so a league's list
  // had no results at all and the afternoon's finished games vanished.
  const live = sorted.filter((m) => rank(m) === 0).slice(0, max);
  const upcoming = sorted.filter((m) => rank(m) === 1);
  const results = sorted.filter((m) => rank(m) === 2);
  const room = max - live.length;
  const forUpcoming = Math.min(
    upcoming.length,
    Math.max(Math.ceil(room / 2), room - results.length)
  );
  const forResults = Math.min(results.length, room - forUpcoming);
  return [...live, ...upcoming.slice(0, forUpcoming), ...results.slice(0, forResults)];
}
