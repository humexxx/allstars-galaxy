import type { RacquetSport, SportId } from "@/types/sports";

/** The sports hub; every page of the module sits under it. */
export const SPORTS_PATH = "/portal/entertainment/sports";

/** A sport in the hub, on a competition (`?league=`) and a tab (`?tab=`) when given. */
export function sportPath(sport: SportId, view: { league?: string; tab?: string } = {}): string {
  const query = new URLSearchParams({ sport });
  if (view.league) query.set("league", view.league);
  if (view.tab) query.set("tab", view.tab);
  return `${SPORTS_PATH}?${query}`;
}

/** A padel or tennis tournament's own page, by the id its feed knows it by. */
export function tournamentPath(sport: RacquetSport, tournamentId: string, tab?: string): string {
  return `${SPORTS_PATH}/${sport}/${encodeURIComponent(tournamentId)}${tab ? `?tab=${tab}` : ""}`;
}

export function f1RacePath(round: number, tab?: string): string {
  return `${SPORTS_PATH}/f1/${round}${tab ? `?tab=${tab}` : ""}`;
}
