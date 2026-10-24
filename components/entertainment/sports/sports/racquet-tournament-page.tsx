"use client";

import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/portal/page-header";
import { Heading, Text } from "@/components/ui/typography";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { drawVariant, playLine, topSeeds } from "@/lib/sports/racquet";
import type { DrawState, RacquetSport, RacquetTournament } from "@/types/sports";

import { SportsBreadcrumbs } from "../shared/sports-breadcrumbs";
import { StatusPill } from "../shared/status-pill";
import { DrawBody } from "./racquet-draw";
import { TournamentCard, TournamentFacts } from "./racquet-tournaments";

/**
 * One padel or tennis tournament on a page of its own: the way back to the
 * sport, the tournament's name, a card with its poster, facts (its champions
 * among them, once there are some) and three best seeds, and its whole draw
 * the width of the page.
 *
 * The draw comes with the page (read on the server); one that failed is
 * asked for again by refreshing the page.
 */
export function RacquetTournamentPage({
  sport,
  tournament: t,
  draw,
  today,
}: {
  sport: RacquetSport;
  tournament: RacquetTournament;
  draw: DrawState;
  /** The reader's today, for "Starts in 5 days". */
  today: string;
}): React.ReactElement {
  const router = useRouter();
  const variant = drawVariant(sport);
  const ready = draw.status === "ready" ? draw.draw : undefined;
  const champion = ready?.champion ?? t.champion;
  const runnerUp = ready?.runnerUp ?? t.runnerUp;
  const now = playLine(t, ready?.rounds, today);

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SportsBreadcrumbs sport={sport} current={t.name} />
        <PageHeader
          eyebrow={[t.tier, t.surface].filter(Boolean).join(" · ") || SPORTS_BY_ID.get(sport)?.label}
          title={t.name}
          badge={<StatusPill status={t.status} />}
        />
      </div>

      <TournamentCard tournament={t} seeds={ready ? topSeeds(ready) : []} variant={variant} posterHeight="@2xl:min-h-64">
        {(corner) => (
          <div className="flex min-w-0 flex-1 flex-col gap-4 @xl:flex-row @xl:items-start @xl:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <TournamentFacts tournament={{ ...t, champion, runnerUp }} variant={variant} />
              {now && (
                <Text as="p" weight="medium">
                  {now}
                </Text>
              )}
            </div>
            {corner}
          </div>
        )}
      </TournamentCard>

      <section className="flex min-w-0 flex-col gap-3">
        <Heading level="h5" as="h2">
          Draw
        </Heading>
        <DrawBody tournament={t} state={draw} variant={variant} onRetry={() => router.refresh()} />
      </section>
    </div>
  );
}
