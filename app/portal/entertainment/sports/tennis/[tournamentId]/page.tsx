import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RacquetTournamentPage } from "@/components/entertainment/sports/sports/racquet-tournament-page";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserFavoriteSportIds } from "@/lib/services/sports-service";
import { loadRacquetTournament } from "@/lib/sports/detail";

type Props = { params: Promise<{ tournamentId: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await loadRacquetTournament("tennis", (await params).tournamentId);
  // No detail is the page's notFound(), which keeps this title: name the miss, not the sport.
  return { title: detail ? detail.tournament.name : "Not on this season's calendar" };
}

/** One tennis tournament, its whole draw: what "View details" and the tiles open. */
export default async function TennisTournamentPage({ params, searchParams }: Props): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  const [detail, favorites, { tab }] = await Promise.all([
    params.then(({ tournamentId }) => loadRacquetTournament("tennis", tournamentId)),
    listUserFavoriteSportIds(ctx.effectiveUserId),
    searchParams,
  ]);
  if (!detail) notFound();
  return (
    // Keyed by tab: a link to another tab of this page opens it.
    <RacquetTournamentPage
      key={tab ?? ""}
      sport="tennis"
      tournament={detail.tournament}
      draw={detail.draw}
      today={detail.today}
      season={detail.season}
      favoriteSportIds={favorites}
      initialTab={tab}
    />
  );
}
