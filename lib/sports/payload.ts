import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import type { F1NewsArticle } from "@/lib/services/rapidapi-f1-news-service";
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
  | { sport: "f1"; data: F1Data; news: F1NewsArticle[] }
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
 * Worth saying out loud on screen: a hand-written season next to real scores
 * elsewhere reads as a broken live view rather than a fixture. The NBA left
 * this set when balldontlie was wired up; the NFL has no free provider with
 * current data.
 */
export const SAMPLE_DATA_SPORTS: ReadonlySet<SportId> = new Set<SportId>(["nfl"]);
