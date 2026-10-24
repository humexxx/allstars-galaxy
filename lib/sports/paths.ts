import type { SportId } from "@/types/sports";

/** The sports hub; every page of the module sits under it. */
export const SPORTS_PATH = "/portal/entertainment/sports";

/** One sport's view in the hub. */
export function sportPath(sport: SportId): string {
  return `${SPORTS_PATH}?sport=${sport}`;
}

/** A padel or tennis tournament's own page, by the id its feed knows it by. */
export function tournamentPath(sport: "padel" | "tennis", tournamentId: string): string {
  return `${SPORTS_PATH}/${sport}/${encodeURIComponent(tournamentId)}`;
}

/** A race of the season on its own page, by its round. */
export function f1RacePath(round: number): string {
  return `${SPORTS_PATH}/f1/${round}`;
}
