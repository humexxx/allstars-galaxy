import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { ManageFavoritesSheet } from "@/components/entertainment/sports/manage-favorites-sheet";
import { SportsHub } from "@/components/entertainment/sports/sports-hub";
import { DEFAULT_SPORT } from "@/lib/data/sports/registry";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserFavoriteSportIds } from "@/lib/services/sports-service";
import { loadSport } from "@/lib/sports/load";
import { isSportId } from "@/lib/sports/payload";

export const metadata: Metadata = {
  title: "Sports",
  description: "Live scores, standings and brackets across your favourite sports.",
};

export default async function SportsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; tab?: string }>;
}) {
  const ctx = await requireEffectiveContext();
  // Kickoffs are formatted in the reader's zone by the portal-wide
  // ReaderTimeZoneProvider, so the server and the browser print the same time.
  const [favorites, { sport, tab }] = await Promise.all([
    listUserFavoriteSportIds(ctx.effectiveUserId),
    searchParams,
  ]);

  // The sport is in the URL, so a refresh keeps it, Back walks between sports,
  // and a link can point at one. It also means the page fetches one provider
  // instead of all six.
  const active = isSportId(sport) ? sport : (favorites[0] ?? DEFAULT_SPORT);
  const payload = await loadSport(active);

  return (
    <>
      <PageHeader
        title="Sports"
        description="Live scores, tables, tournaments and brackets across football, the World Cup, F1, NBA, tennis, padel, NFL and League of Legends."
        actions={<ManageFavoritesSheet favoriteSportIds={favorites} />}
      />
      <SportsHub
        activeSport={active}
        favoriteSportIds={favorites}
        payload={payload}
        initialTab={tab}
      />
    </>
  );
}
