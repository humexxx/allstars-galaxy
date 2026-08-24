import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import type {
  F1Data,
  FootballLeagueData,
  LolData,
  NbaData,
  NflData,
  PadelData,
  SportId,
  TennisData,
} from "@/types/sports";

/**
 * What one sport's view needs, and nothing else.
 *
 * Client-safe on purpose: the hub renders it, and the fetching half
 * (`load.ts`) is `server-only`.
 */
export type SportPayload =
  | { sport: "football"; leagues: FootballLeagueData[] }
  | { sport: "worldcup"; data: FootballLeagueData }
  | { sport: "f1"; data: F1Data }
  | { sport: "lol"; data: LolData }
  | { sport: "padel"; data: PadelData }
  | { sport: "tennis"; data: TennisData }
  | { sport: "nba"; data: NbaData }
  | { sport: "nfl"; data: NflData };

export function isSportId(value: string | undefined): value is SportId {
  return value !== undefined && SPORTS_BY_ID.has(value as SportId);
}

/**
 * The sports with no live provider behind them.
 *
 * Worth saying out loud on screen: the NBA view shows a five-game May schedule
 * inside a "Season 2025–26" and nothing on the page admitted it was a fixture.
 */
export const SAMPLE_DATA_SPORTS: ReadonlySet<SportId> = new Set<SportId>(["nba", "nfl"]);
