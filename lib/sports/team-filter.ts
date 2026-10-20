import type { FootballLeagueId, SportId, TeamFilterList } from "@/types/sports";

/**
 * The match list a sport's page shows, for the team filter to remember: the
 * football league on screen, or the NBA's or NFL's one list. Null for a sport
 * with no team filter.
 */
export function teamFilterList(sport: SportId, league: FootballLeagueId): TeamFilterList | null {
  switch (sport) {
    case "football":
      return { sportId: "football", competition: league };
    case "nba":
      return { sportId: "nba", competition: "nba" };
    case "nfl":
      return { sportId: "nfl", competition: "nfl" };
    default:
      return null;
  }
}
