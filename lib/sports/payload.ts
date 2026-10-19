import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import type {
  F1Data,
  F1NewsArticle,
  FootballLeagueData,
  FootballLeagueId,
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
export type SportPayload = (
  | {
      sport: "football";
      /** The league on screen — the only one fetched (`?league=`). */
      league: FootballLeagueData;
      /** What the picker offers, by name; the other leagues are not loaded. */
      options: ReadonlyArray<{ id: FootballLeagueId; name: string }>;
    }
  | { sport: "f1"; data: F1Data; news: F1NewsArticle[] }
  | { sport: "lol"; data: LolData }
  | { sport: "padel"; data: PadelData }
  | { sport: "tennis"; data: TennisData }
  | { sport: "nba"; data: NbaData }
  | { sport: "nfl"; data: NflData }
) & {
  /**
   * The live feed has never answered, so the view is showing its fixture.
   * A hand-written season next to real scores elsewhere reads as a broken
   * live view unless something says so.
   */
  sample?: boolean;
};

export function isSportId(value: string | undefined): value is SportId {
  return value !== undefined && SPORTS_BY_ID.has(value as SportId);
}
