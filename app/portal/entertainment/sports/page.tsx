import type { Metadata } from "next";

import { SportsHub } from "@/components/entertainment/sports/sports-hub";
import { DEFAULT_SPORT } from "@/lib/data/sports/registry";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserFavoriteSportIds } from "@/lib/services/sports-service";
import { loadSport } from "@/lib/sports/load";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import { isSportId } from "@/lib/sports/payload";

export const metadata: Metadata = {
  title: "Sports",
  description: "Live scores, standings and brackets across your favourite sports.",
};

export default async function SportsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; tab?: string; league?: string }>;
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
  // instead of all six. The World Cup was a sport of its own before it moved
  // into football, and links to it still land on it.
  const worldCupLink = sport === "worldcup";
  const active = worldCupLink ? "football" : isSportId(sport) ? sport : (favorites[0] ?? DEFAULT_SPORT);
  const payload = await loadSport(active, { league: worldCupLink ? "world-cup" : league });

  // No PageHeader: the sport bar names the page, and the favourites button
  // sits at the end of the sport strip (SportsHub).
  return (
    <SportsHub
      activeSport={active}
      favoriteSportIds={favorites}
      payload={payload}
      initialTab={tab}
      today={today}
    />
  );
}
