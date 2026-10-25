import type { RacquetSport, SportId } from "@/types/sports";

/** The sports hub; every page of the module sits under it. */
export const SPORTS_PATH = "/portal/entertainment/sports";

export function sportPath(sport: SportId): string {
  return `${SPORTS_PATH}?sport=${sport}`;
}

/** A padel or tennis tournament's own page, by the id its feed knows it by. */
export function tournamentPath(sport: RacquetSport, tournamentId: string): string {
  return `${SPORTS_PATH}/${sport}/${encodeURIComponent(tournamentId)}`;
}

export function f1RacePath(round: number): string {
  return `${SPORTS_PATH}/f1/${round}`;
}
