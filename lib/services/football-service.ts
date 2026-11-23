import "server-only";

import { getFootballLeague } from "@/lib/data/sports/football";
import { clubMatchesAcross, mergeClubMatches, withRegionalDerbies } from "@/lib/sports/football-clubs";
import {
  ESPN_FOOTBALL_LEAGUE_IDS,
  type EspnFootballLeagueId,
  type FootballClubMatches,
  type FootballLeagueData,
  type FootballLeagueId,
} from "@/types/sports";

import { ESPN_FOOTBALL_LEAGUES, getEspnFootballLeague, isEspnFootballLeague } from "./espn-football-service";
import {
  FOOTBALL_DATA_LEAGUES,
  WORLD_CUP_LEAGUE,
  getFootballDataClubMatches,
  getFootballLeagueData,
  getWorldCupData,
} from "./football-data-service";

/**
 * What the league picker offers, in its order. Names only: nothing is fetched.
 * The World Cup comes last: a tournament every four years, not a season.
 */
export const FOOTBALL_COMPETITIONS: ReadonlyArray<{ id: FootballLeagueId; name: string }> = [
  ...FOOTBALL_DATA_LEAGUES,
  ...ESPN_FOOTBALL_LEAGUES,
  WORLD_CUP_LEAGUE,
];

/** The regional cups a domestic league's clubs play in, whose games between two of them it lists too. */
const REGIONAL_CUPS: Partial<Record<EspnFootballLeagueId, readonly EspnFootballLeagueId[]>> = {
  "costa-rica": ["concacaf-central-american-cup", "concacaf-champions-cup"],
  mls: ["concacaf-champions-cup"],
};

/** An ESPN competition's live answer; null while it has only its fixture to show. */
async function liveEspn(id: EspnFootballLeagueId): Promise<FootballLeagueData | null> {
  const data = await getEspnFootballLeague(id);
  return data === getFootballLeague(id) ? null : data;
}

async function liveEspnAll(ids: readonly EspnFootballLeagueId[]): Promise<FootballLeagueData[]> {
  const all = await Promise.all(ids.map(liveEspn));
  return all.filter((d): d is FootballLeagueData => d !== null);
}

/**
 * One competition from the feed that has it: MLS, Costa Rica and the Concacaf
 * cups from ESPN, which spends none of football-data's ten requests a minute,
 * the World Cup from its own call, and the rest from football-data. Each falls
 * back to its own fixture, the very object, so a caller can tell it is one.
 *
 * A domestic league from ESPN also lists the regional cup games its own clubs
 * play each other in (`withRegionalDerbies`), from those cups' own cached feeds.
 */
export async function getFootballCompetition(id: FootballLeagueId): Promise<FootballLeagueData> {
  if (id === "world-cup") return getWorldCupData();
  if (!isEspnFootballLeague(id)) return getFootballLeagueData(id);
  const cups = REGIONAL_CUPS[id];
  const [data, live] = await Promise.all([getEspnFootballLeague(id), cups ? liveEspnAll(cups) : Promise.resolve([])]);
  if (data === getFootballLeague(id) || live.length === 0) return data;
  return withRegionalDerbies(data, live);
}

/**
 * The clubs `teamIds` of the league on screen, in every competition the app
 * covers: a European club's league and Champions League games from one
 * football-data request each (cached), a Concacaf club's from ESPN's cached
 * feeds of every competition it could be in. A club whose other games do not
 * load keeps its league's. Null with no club picked, and for the World Cup,
 * whose teams play nothing else here.
 */
export async function getFootballClubMatches(
  home: FootballLeagueData,
  teamIds: readonly string[]
): Promise<FootballClubMatches | null> {
  const id = home.league.id;
  if (teamIds.length === 0 || id === "world-cup") return null;
  if (isEspnFootballLeague(id)) {
    const others = await liveEspnAll(ESPN_FOOTBALL_LEAGUE_IDS.filter((o) => o !== id));
    return clubMatchesAcross(home, others, teamIds);
  }
  const parts = await Promise.all(
    teamIds.map(async (teamId) => {
      const providerId = home.providerTeamIds?.[teamId];
      const live = providerId ? await getFootballDataClubMatches(providerId) : null;
      return live && live.teamIds.includes(teamId) ? live : clubMatchesAcross(home, [], [teamId]);
    })
  );
  return mergeClubMatches(teamIds, parts);
}
