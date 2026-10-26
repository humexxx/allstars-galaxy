import type { Metadata } from "next";

import { SportsHub } from "@/components/entertainment/sports/sports-hub";
import { DEFAULT_SPORT, SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { FOOTBALL_COMPETITIONS } from "@/lib/services/football-service";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getSportTeamFilter, listUserFavoriteSportIds } from "@/lib/services/sports-service";
import { footballLeagueFrom, loadSport } from "@/lib/sports/load";
import { teamFilterList } from "@/lib/sports/team-filter";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import { isSportId } from "@/lib/sports/payload";
import type { SportId } from "@/types/sports";

type SearchParams = Promise<{ sport?: string; tab?: string; league?: string }>;

const DESCRIPTION = "Live scores, standings and brackets across your favourite sports.";

/**
 * The sport and league the URL names; no sport when it names none, and the
 * favourites pick one. The World Cup was a sport of its own before it moved
 * into football, and links to it still land on it.
 */
function fromUrl(
  sport: string | undefined,
  league: string | undefined
): { sport: SportId | null; league: string | undefined } {
  if (sport === "worldcup") return { sport: "football", league: "world-cup" };
  return { sport: isSportId(sport) ? sport : null, league };
}

/**
 * Named after the sport or competition on screen, so each has a tab and a
 * history entry of its own, and Next's route announcer, which speaks only a
 * changed title, says where a switch landed. With no sport in the URL it stays
 * "Sports": naming the favourite would mean fetching the favourites here too.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { sport, league } = await searchParams;
  const named = fromUrl(sport, league);
  if (!named.sport) return { title: "Sports", description: DESCRIPTION };
  const name =
    named.sport === "football"
      ? FOOTBALL_COMPETITIONS.find((c) => c.id === footballLeagueFrom(named.league))?.name
      : SPORTS_BY_ID.get(named.sport)?.label;
  return { title: name ? `${name} · Sports` : "Sports", description: DESCRIPTION };
}

export default async function SportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  // Kickoffs are formatted in the reader's zone by the portal-wide
  // ReaderTimeZoneProvider, so the server and the browser print the same time.
  const [favorites, { sport, tab, league }, today] = await Promise.all([
    listUserFavoriteSportIds(ctx.effectiveUserId),
    searchParams,
    getRequestTodayIso(),
  ]);

  // The sport is in the URL, so a refresh keeps it, Back walks between sports,
  // and a link can point at one. It also means the page fetches one provider
  // instead of all six.
  const named = fromUrl(sport, league);
  const active = named.sport ?? favorites[0] ?? DEFAULT_SPORT;
  // The teams last picked in this list, read beside the sport rather than after it.
  const list = teamFilterList(active, footballLeagueFrom(named.league));
  const [payload, teamIds] = await Promise.all([
    loadSport(active, { league: named.league }),
    list ? getSportTeamFilter(ctx.effectiveUserId, list) : Promise.resolve([]),
  ]);

  // No PageHeader: the sport's own name row names the page, with the
  // favourites button and the sport picker at its end (SportsHub).
  return (
    <SportsHub
      activeSport={active}
      favoriteSportIds={favorites}
      payload={payload}
      initialTab={tab}
      today={today}
      teamFilter={list ? { list, teamIds } : null}
      viewerId={ctx.effectiveUserId}
    />
  );
}
