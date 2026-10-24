import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RacquetTournamentPage } from "@/components/entertainment/sports/sports/racquet-tournament-page";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { loadRacquetTournament } from "@/lib/sports/detail";

type Props = { params: Promise<{ tournamentId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await loadRacquetTournament("padel", (await params).tournamentId);
  return { title: detail ? detail.tournament.name : "Padel" };
}

/** One padel tournament, its whole draw: what "View details" and the tiles open. */
export default async function PadelTournamentPage({ params }: Props): Promise<React.ReactElement> {
  await requireEffectiveContext();
  const detail = await loadRacquetTournament("padel", (await params).tournamentId);
  if (!detail) notFound();
  return (
    <RacquetTournamentPage
      sport="padel"
      tournament={detail.tournament}
      draw={detail.draw}
      today={detail.today}
    />
  );
}
