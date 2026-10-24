import type { SportPayload } from "@/lib/sports/payload";
import type { SavedTeamFilter, TeamFilterList } from "@/types/sports";

/** How old a copy may be and still be shown while the fresh one loads. */
export const SEEN_MS = 30 * 60_000;

export type SeenSport = {
  payload: SportPayload;
  teamFilter: SavedTeamFilter | null;
  today: string;
  at: number;
};

/**
 * The sports opened in this visit, by the address that opened them ("nba|",
 * "football|la-liga"), so going back to one shows it at once while the server
 * answers. In memory only: gone on a reload. It belongs to one account and is
 * emptied when another is looked at — an impersonation starts and ends with a
 * soft navigation, which keeps this module alive.
 */
const seen = new Map<string, SeenSport>();
let owner: string | null = null;

function ownedBy(viewer: string): Map<string, SeenSport> {
  if (owner !== viewer) {
    seen.clear();
    owner = viewer;
  }
  return seen;
}

export function seenKey(sport: string, league: string | null | undefined): string {
  return `${sport}|${league ?? ""}`;
}

export function rememberSport(
  viewer: string,
  key: string,
  entry: Omit<SeenSport, "at">,
  now = Date.now()
): void {
  ownedBy(viewer).set(key, { ...entry, at: now });
}

export function recallSport(viewer: string, key: string, now = Date.now()): SeenSport | undefined {
  const entry = ownedBy(viewer).get(key);
  if (entry && now - entry.at > SEEN_MS) {
    seen.delete(key);
    return undefined;
  }
  return entry;
}

/**
 * A team pick just saved: every copy showing that list carries it from now
 * on. Saving does not refresh the page, so without this a copy would bring
 * back the teams picked before it.
 */
export function rememberTeams(list: TeamFilterList, teamIds: readonly string[]): void {
  const same = JSON.stringify(list);
  for (const entry of seen.values()) {
    if (entry.teamFilter && JSON.stringify(entry.teamFilter.list) === same) {
      entry.teamFilter = { ...entry.teamFilter, teamIds: [...teamIds] };
    }
  }
}

/** For tests: a visit starts with nothing seen. */
export function forgetSeenSports(): void {
  seen.clear();
  owner = null;
}
