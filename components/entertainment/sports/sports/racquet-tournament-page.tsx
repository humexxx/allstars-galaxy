"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/portal/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { roundInPlay } from "@/lib/sports/bracket";
import { SPORTS_PATH, sportPath } from "@/lib/sports/paths";
import { formatDayRange } from "@/lib/utils/date";
import type { RacquetTournament } from "@/types/sports";

import { SportsBreadcrumbs } from "../shared/sports-breadcrumbs";
import { StatusPill } from "../shared/status-pill";
import { DrawBody, type DrawState, type DrawVariant, type RacquetSport } from "./racquet-draw";
import {
  placeOf,
  startsIn,
  TopSeeds,
  topSeeds,
  TournamentFacts,
  TournamentPoster,
} from "./racquet-tournaments";

const SPORT_LABEL: Record<RacquetSport, string> = { padel: "Padel", tennis: "Tennis" };

/**
 * One padel or tennis tournament on a page of its own: the way back to the
 * sport, the tournament's name and when and where, a card with its poster,
 * facts (its champions among them, once there are some) and three best
 * seeds, and its whole draw the width of the page.
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
}) {
  const router = useRouter();
  const variant: DrawVariant = sport === "padel" ? "pair" : "player";
  const ready = draw.status === "ready" ? draw.draw : undefined;
  const round = t.status === "live" && ready ? roundInPlay(ready.rounds) : undefined;
  const seeds = ready ? topSeeds(ready) : [];
  const champion = ready?.champion ?? t.champion;
  const runnerUp = ready?.runnerUp ?? t.runnerUp;
  const [posterGone, setPosterGone] = useState(false);
  const withPoster = Boolean(t.imageUrl) && !posterGone;
  const now =
    t.status === "live"
      ? round
        ? `${round.label} under way`
        : null
      : t.status === "upcoming"
        ? startsIn(t.startDate, today)
        : null;

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SportsBreadcrumbs
          trail={[
            { label: "Sports", href: SPORTS_PATH },
            { label: SPORT_LABEL[sport], href: sportPath(sport) },
          ]}
          current={t.name}
        />
        <PageHeader
          eyebrow={[t.tier, t.surface].filter(Boolean).join(" · ") || SPORT_LABEL[sport]}
          title={t.name}
          badge={<StatusPill status={t.status} />}
          description={[formatDayRange(t.startDate, t.endDate), placeOf(t)].filter(Boolean).join(" · ")}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 @2xl:flex-row @2xl:items-stretch @2xl:gap-6">
          {/* As on Overview: beside the facts the poster runs the card's whole
              height, flush with its edge; above them on a phone. */}
          {t.imageUrl && (
            <TournamentPoster
              key={t.imageUrl}
              src={t.imageUrl}
              className="@2xl:-my-6 @2xl:-ml-6 @2xl:aspect-auto @2xl:min-h-64 @2xl:w-2/5 @2xl:rounded-none"
              onFail={() => setPosterGone(true)}
            >
              {seeds.length > 0 && (
                <span className="absolute inset-x-0 bottom-0 flex justify-end bg-linear-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5">
                  <TopSeeds seeds={seeds} variant={variant} onImage />
                </span>
              )}
            </TournamentPoster>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-4 @xl:flex-row @xl:items-start @xl:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <TournamentFacts tournament={{ ...t, champion, runnerUp }} variant={variant} />
              {now && (
                <Text as="p" weight="medium">
                  {now}
                </Text>
              )}
            </div>
            {seeds.length > 0 && !withPoster && <TopSeeds seeds={seeds} variant={variant} />}
          </div>
        </CardContent>
      </Card>

      <section className="flex min-w-0 flex-col gap-3">
        <Heading level="h5" as="h2">
          Draw
        </Heading>
        <DrawBody tournament={t} state={draw} variant={variant} onRetry={() => router.refresh()} />
      </section>
    </div>
  );
}
