import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import type {
  F1Data,
  F1NewsArticle,
  F1WeekendResults,
  FootballLeagueData,
  FootballLeagueId,
  LolData,
  MlbData,
  NbaData,
  NewsStory,
  NflData,
  NhlData,
  PadelData,
  SportId,
  SurfData,
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
      /** The league's news, ESPN's. */
      news?: NewsStory[];
    }
  | {
      sport: "f1";
      data: F1Data;
      news: F1NewsArticle[];
      /** The sessions run so far of the race on now or next. */
      weekend?: F1WeekendResults;
    }
  | { sport: "lol"; data: LolData; news?: NewsStory[] }
  | { sport: "padel"; data: PadelData; news?: NewsStory[] }
  | { sport: "tennis"; data: TennisData; news?: NewsStory[] }
  | { sport: "nba"; data: NbaData; news?: NewsStory[] }
  | { sport: "nfl"; data: NflData; news?: NewsStory[] }
  | { sport: "mlb"; data: MlbData; news?: NewsStory[] }
  | { sport: "nhl"; data: NhlData; news?: NewsStory[] }
  | { sport: "surf"; data: SurfData; news?: NewsStory[] }
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
