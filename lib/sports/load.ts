import "server-only";

import { F1_DATA } from "@/lib/data/sports/f1";
import { getFootballLeague } from "@/lib/data/sports/football";
import { LOL_DATA } from "@/lib/data/sports/lol";
import { MLB_DATA } from "@/lib/data/sports/mlb";
import { NBA_DATA } from "@/lib/data/sports/nba";
import { NFL_DATA } from "@/lib/data/sports/nfl";
import { NHL_DATA } from "@/lib/data/sports/nhl";
import { PADEL_DATA } from "@/lib/data/sports/padel";
import { SURF_DATA } from "@/lib/data/sports/surf";
import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import { WORLD_CUP_DATA } from "@/lib/data/sports/world-cup";
import {
  FOOTBALL_COMPETITIONS,
  getFootballLeagueData,
  getWorldCupData,
} from "@/lib/services/football-data-service";
import { getNbaData } from "@/lib/services/balldontlie-nba-service";
import { getEspnNews } from "@/lib/services/espn-news-service";
import { getMlbData } from "@/lib/services/espn-mlb-service";
import { getNflData } from "@/lib/services/espn-nfl-service";
import { getNhlData } from "@/lib/services/espn-nhl-service";
import { getF1Data } from "@/lib/services/jolpica-f1-service";
import { getF1WeekendResults } from "@/lib/services/openf1-service";
import { getF1News } from "@/lib/services/rapidapi-f1-news-service";
import { getLolNews } from "@/lib/services/lolesports-news-service";
import { getLolData } from "@/lib/services/lolesports-service";
import { getPadelData } from "@/lib/services/padel-api-service";
import { getTennisData } from "@/lib/services/espn-tennis-service";
import { getSurfData } from "@/lib/services/wsl-surf-service";
import { getPadelNews } from "@/lib/services/premier-padel-news-service";
import { getSurfNews } from "@/lib/services/stab-surf-news-service";
import { racesTabGroups, weekendWindow } from "@/lib/sports/f1-weekend";
import { type SportPayload } from "@/lib/sports/payload";
import type { FootballLeagueId, SportId } from "@/types/sports";

/** A `?league=` value, or the first league on offer when it names none of them. */
export function footballLeagueFrom(value: string | undefined): FootballLeagueId {
  return (FOOTBALL_COMPETITIONS.find((c) => c.id === value) ?? FOOTBALL_COMPETITIONS[0]).id;
}

/**
 * Fetch exactly the sport being shown.
 *
 * The page used to `Promise.all` all six providers on every load, for seven
 * views nobody was looking at. football-data.org allows ten requests a minute
 * on the free tier and this page spent two of them per visit before the user
 * had chosen anything.
 *
 * Football goes one step further and fetches only the league in the URL: all
 * four cost eight of those ten requests, for three tables behind a picker.
 *
 * `sample` is an identity check: a feed hands back the fixture object itself
 * only when it has no live answer to serve, never a copy.
 */
export async function loadSport(
  sport: SportId,
  params: { league?: string } = {}
): Promise<SportPayload> {
  switch (sport) {
    case "football": {
      const id = footballLeagueFrom(params.league);
      // The World Cup is one of football's competitions, with a feed of its
      // own: one call covers its groups, fixtures and bracket.
      // Each league's news beside it, from ESPN (key-less, cached a quarter
      // of an hour): no football-data request is spent on it.
      if (id === "world-cup") {
        const [league, news] = await Promise.all([getWorldCupData(), getEspnNews(id)]);
        return { sport, league, options: FOOTBALL_COMPETITIONS, news, sample: league === WORLD_CUP_DATA };
      }
      const [league, news] = await Promise.all([getFootballLeagueData(id), getEspnNews(id)]);
      return {
        sport,
        league,
        options: FOOTBALL_COMPETITIONS,
        news,
        sample: league === getFootballLeague(id),
      };
    }
    case "f1": {
      // Two providers: Jolpica for the championship, the stored RapidAPI feed
      // for the news. The news read is the database, never the provider.
      const [data, news] = await Promise.all([getF1Data(), getF1News()]);
      // The race on now or next shows each session's result as it comes in,
      // from OpenF1 (practice too, which Jolpica does not carry).
      const { featured } = racesTabGroups(data.races);
      const window = featured ? weekendWindow(featured, Date.now()) : null;
      const weekend =
        featured && window
          ? await getF1WeekendResults(data.season, featured.round, window.from, window.to)
          : undefined;
      return { sport, data, news, weekend, sample: data === F1_DATA };
    }
    case "lol": {
      const [data, news] = await Promise.all([getLolData(), getLolNews()]);
      return { sport, data, news, sample: data === LOL_DATA };
    }
    case "padel": {
      const [data, news] = await Promise.all([getPadelData(), getPadelNews()]);
      return { sport, data, news, sample: data === PADEL_DATA };
    }
    case "tennis": {
      const [data, news] = await Promise.all([getTennisData(), getEspnNews("atp")]);
      return { sport, data, news, sample: data === TENNIS_DATA };
    }
    case "nba": {
      const [data, news] = await Promise.all([getNbaData(), getEspnNews("nba")]);
      return { sport, data, news, sample: data === NBA_DATA };
    }
    case "nfl": {
      const [data, news] = await Promise.all([getNflData(), getEspnNews("nfl")]);
      return { sport, data, news, sample: data === NFL_DATA };
    }
    case "mlb": {
      const [data, news] = await Promise.all([getMlbData(), getEspnNews("mlb")]);
      return { sport, data, news, sample: data === MLB_DATA };
    }
    case "nhl": {
      const [data, news] = await Promise.all([getNhlData(), getEspnNews("nhl")]);
      return { sport, data, news, sample: data === NHL_DATA };
    }
    case "surf": {
      const [data, news] = await Promise.all([getSurfData(), getSurfNews()]);
      return { sport, data, news, sample: data === SURF_DATA };
    }
  }
}
