import {
  SINGLE_LIST_SPORTS,
  type FootballLeagueId,
  type SingleListSport,
  type SportId,
  type TeamFilterList,
} from "@/types/sports";

function isSingleListSport(sport: SportId): sport is SingleListSport {
  return (SINGLE_LIST_SPORTS as readonly SportId[]).includes(sport);
}

/**
 * The match list a sport's page shows, for the team filter to remember: the
 * football league on screen, or a US league's one list. Null for a sport
 * with no team filter.
 */
export function teamFilterList(sport: SportId, league: FootballLeagueId): TeamFilterList | null {
  if (sport === "football") return { sportId: "football", competition: league };
  return isSingleListSport(sport) ? ({ sportId: sport, competition: sport } as TeamFilterList) : null;
}
