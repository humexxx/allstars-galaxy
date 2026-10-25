import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { F1RacePage } from "@/components/entertainment/sports/f1-race-page";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { loadF1Race } from "@/lib/sports/detail";
import { f1RoundSchema } from "@/schemas/f1";

type Props = { params: Promise<{ round: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const round = f1RoundSchema.safeParse((await params).round);
  const detail = round.success ? await loadF1Race(round.data) : null;
  // No detail is the page's notFound(), which keeps this title: name the miss, not the sport.
  return { title: detail ? detail.race.name : "Not on this season's calendar" };
}

/** One race of the season, by its round: what "View details" and the tiles open. */
export default async function F1RaceRoute({ params }: Props): Promise<React.ReactElement> {
  await requireEffectiveContext();
  const round = f1RoundSchema.safeParse((await params).round);
  if (!round.success) notFound();
  const detail = await loadF1Race(round.data);
  if (!detail) notFound();
  return (
    <F1RacePage
      race={detail.race}
      season={detail.data.season}
      drivers={detail.data.drivers}
      classification={detail.classification}
      sessions={detail.sessions}
      current={detail.current}
    />
  );
}
