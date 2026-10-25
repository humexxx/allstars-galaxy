import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { F1RacePage } from "@/components/entertainment/sports/f1-race-page";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserFavoriteSportIds } from "@/lib/services/sports-service";
import { loadF1Race } from "@/lib/sports/detail";
import { f1RoundSchema } from "@/schemas/f1";

type Props = { params: Promise<{ round: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const round = f1RoundSchema.safeParse((await params).round);
  const detail = round.success ? await loadF1Race(round.data) : null;
  // No detail is the page's notFound(), which keeps this title: name the miss, not the sport.
  return { title: detail ? detail.race.name : "Not on this season's calendar" };
}

/** One race of the season, by its round: what "View details" and the tiles open. */
export default async function F1RaceRoute({ params, searchParams }: Props): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  const round = f1RoundSchema.safeParse((await params).round);
  if (!round.success) notFound();
  const [detail, favorites, { tab }] = await Promise.all([
    loadF1Race(round.data),
    listUserFavoriteSportIds(ctx.effectiveUserId),
    searchParams,
  ]);
  if (!detail) notFound();
  return (
    <F1RacePage
      race={detail.race}
      season={detail.data.season}
      drivers={detail.data.drivers}
      classification={detail.classification}
      sessions={detail.sessions}
      current={detail.current}
      favoriteSportIds={favorites}
      initialTab={tab}
    />
  );
}
