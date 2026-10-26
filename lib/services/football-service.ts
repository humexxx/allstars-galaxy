import "server-only";

import type { FootballLeagueData, FootballLeagueId } from "@/types/sports";

import { ESPN_FOOTBALL_LEAGUES, getEspnFootballLeague, isEspnFootballLeague } from "./espn-football-service";
import { FOOTBALL_DATA_LEAGUES, WORLD_CUP_LEAGUE, getFootballLeagueData, getWorldCupData } from "./football-data-service";

/**
 * What the league picker offers, in its order. Names only: nothing is fetched.
 * The World Cup comes last: a tournament every four years, not a season.
 */
export const FOOTBALL_COMPETITIONS: ReadonlyArray<{ id: FootballLeagueId; name: string }> = [
  ...FOOTBALL_DATA_LEAGUES,
  ...ESPN_FOOTBALL_LEAGUES,
  WORLD_CUP_LEAGUE,
];

/**
 * One competition from the feed that has it: MLS and Costa Rica from ESPN,
 * which spends none of football-data's ten requests a minute, the World Cup
 * from its own call, and the rest from football-data. Each falls back to its
 * own fixture, the very object, so a caller can tell it is one.
 */
export function getFootballCompetition(id: FootballLeagueId): Promise<FootballLeagueData> {
  if (id === "world-cup") return getWorldCupData();
  if (isEspnFootballLeague(id)) return getEspnFootballLeague(id);
  return getFootballLeagueData(id);
}
