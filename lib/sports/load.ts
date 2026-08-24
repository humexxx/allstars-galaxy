import "server-only";

import { F1_DATA } from "@/lib/data/sports/f1";
import { getFootballLeagues } from "@/lib/data/sports/football";
import { LOL_DATA } from "@/lib/data/sports/lol";
import { NBA_DATA } from "@/lib/data/sports/nba";
import { NFL_DATA } from "@/lib/data/sports/nfl";
import { PADEL_DATA } from "@/lib/data/sports/padel";
import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import { WORLD_CUP_DATA } from "@/lib/data/sports/world-cup";
import { getFootballData, getWorldCupData } from "@/lib/services/football-data-service";
import { getF1Data } from "@/lib/services/jolpica-f1-service";
import { getLolData } from "@/lib/services/lolesports-service";
import { getPadelData } from "@/lib/services/padel-api-service";
import { getTennisData } from "@/lib/services/thesportsdb-tennis-service";
import { type SportPayload } from "@/lib/sports/payload";
import type { SportId } from "@/types/sports";

/**
 * Fetch exactly the sport being shown.
 *
 * The page used to `Promise.all` all six providers on every load, for seven
 * views nobody was looking at. football-data.org allows ten requests a minute
 * on the free tier and this page spent two of them per visit before the user
 * had chosen anything.
 */
export async function loadSport(sport: SportId): Promise<SportPayload> {
  switch (sport) {
    case "football":
      return { sport, leagues: (await getFootballData()) ?? getFootballLeagues() };
    case "worldcup":
      return { sport, data: (await getWorldCupData()) ?? WORLD_CUP_DATA };
    case "f1":
      return { sport, data: (await getF1Data()) ?? F1_DATA };
    case "lol":
      return { sport, data: (await getLolData()) ?? LOL_DATA };
    case "padel":
      return { sport, data: (await getPadelData()) ?? PADEL_DATA };
    case "tennis":
      return { sport, data: (await getTennisData()) ?? TENNIS_DATA };
    case "nba":
      return { sport, data: NBA_DATA };
    case "nfl":
      return { sport, data: NFL_DATA };
  }
}
