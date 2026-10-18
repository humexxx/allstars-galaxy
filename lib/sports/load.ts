import "server-only";

import { F1_DATA } from "@/lib/data/sports/f1";
import { getFootballLeague } from "@/lib/data/sports/football";
import { LOL_DATA } from "@/lib/data/sports/lol";
import { NBA_DATA } from "@/lib/data/sports/nba";
import { NFL_DATA } from "@/lib/data/sports/nfl";
import { PADEL_DATA } from "@/lib/data/sports/padel";
import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import { WORLD_CUP_DATA } from "@/lib/data/sports/world-cup";
import { getFootballData, getWorldCupData } from "@/lib/services/football-data-service";
import { getNbaData } from "@/lib/services/balldontlie-nba-service";
import { getNflData } from "@/lib/services/espn-nfl-service";
import { getF1Data } from "@/lib/services/jolpica-f1-service";
import { getF1News } from "@/lib/services/rapidapi-f1-news-service";
import { getLolData } from "@/lib/services/lolesports-service";
import { getPadelData } from "@/lib/services/padel-api-service";
import { getTennisData } from "@/lib/services/espn-tennis-service";
import { type SportPayload } from "@/lib/sports/payload";
import type { SportId } from "@/types/sports";

/**
 * Fetch exactly the sport being shown.
 *
 * The page used to `Promise.all` all six providers on every load, for seven
 * views nobody was looking at. football-data.org allows ten requests a minute
 * on the free tier and this page spent two of them per visit before the user
 * had chosen anything.
 *
 * `sample` is an identity check: a feed hands back the fixture object itself
 * only when it has no live answer to serve, never a copy.
 */
export async function loadSport(sport: SportId): Promise<SportPayload> {
  switch (sport) {
    case "football": {
      const leagues = await getFootballData();
      return {
        sport,
        leagues,
        sample: leagues.some((l) => l === getFootballLeague(l.league.id)),
      };
    }
    case "worldcup": {
      const data = await getWorldCupData();
      return { sport, data, sample: data === WORLD_CUP_DATA };
    }
    case "f1": {
      // Two providers: Jolpica for the championship, the stored RapidAPI feed
      // for the news. The news read is the database, never the provider.
      const [data, news] = await Promise.all([getF1Data(), getF1News()]);
      return { sport, data, news, sample: data === F1_DATA };
    }
    case "lol": {
      const data = await getLolData();
      return { sport, data, sample: data === LOL_DATA };
    }
    case "padel": {
      const data = await getPadelData();
      return { sport, data, sample: data === PADEL_DATA };
    }
    case "tennis": {
      const data = await getTennisData();
      return { sport, data, sample: data === TENNIS_DATA };
    }
    case "nba": {
      const data = await getNbaData();
      return { sport, data, sample: data === NBA_DATA };
    }
    case "nfl": {
      const data = await getNflData();
      return { sport, data, sample: data === NFL_DATA };
    }
  }
}
