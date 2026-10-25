"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { isRaceWeekend, racesTabGroups, weekendPhrase } from "@/lib/sports/f1-weekend";
import { cn } from "@/lib/utils";
import { f1RacePath } from "@/lib/sports/paths";
import type { F1Data, F1Race, F1SessionResult, F1WeekendResults } from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { racePlace, raceWhen, SprintBadge } from "./f1-race-labels";
import { ResultsLine, SessionList } from "./f1-race-parts";
import { StatusPill } from "./shared/status-pill";
import {
  EarlierPill,
  SectionHeading,
  TILE,
  TileSection,
  useRevealEarlier,
  ViewDetailsLink,
} from "./shared/tile-section";
import { useMatchTime } from "./shared/time-zone-context";
import { useNow } from "./use-now";

/**
 * F1's races, the left of its Overview: the race on now or next, large, then
 * every race still to come, then the ones run, latest first, brought in from
 * their heading as the match lists bring in earlier days (`useRevealEarlier`).
 * Every race opens its own page.
 *
 * Its own container, so the tiles follow the column's width rather than the
 * page's. Each part opens on a heading set like a day heading in the match
 * lists, which is what puts the first card level with the standings card
 * beside it (`OverviewSplit`).
 */
export function F1Races({
  data,
  weekend,
}: {
  data: F1Data;
  /** The sessions run so far of the race on now or next, read with the page. */
  weekend?: F1WeekendResults;
}): React.ReactElement {
  const { featured, comingUp, justFinished } = useMemo(
    () => racesTabGroups(data.races),
    [data.races]
  );
  const featuredResults = featured && weekend?.round === featured.round ? weekend.sessions : [];
  const { listRef, earlier, next, reveal } = useRevealEarlier(justFinished, { open: !featured, attr: "data-race" });

  return (
    <div ref={listRef} className="@container flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionHeading>{featured?.status === "live" ? "On now" : "Next race"}</SectionHeading>
        {featured ? (
          <FeaturedRace race={featured} results={featuredResults} drivers={data.drivers} />
        ) : (
          <EmptyState
            icon={Flag}
            title={`The ${data.season} season is over`}
            description="Every round is under Earlier races below."
          />
        )}
      </section>

      {comingUp.length > 0 && (
        <TileSection title="Coming up">
          {comingUp.map((r) => (
            <RaceTile key={r.id} race={r} />
          ))}
        </TileSection>
      )}

      {/* Its line stands from the start, the pill on it: what a tap brings in
          lands right under it rather than past the races to come. */}
      {justFinished.length > 0 && (
        <TileSection
          title="Earlier races"
          action={next.length > 0 && <EarlierPill detail={showRounds(next)} onClick={reveal} />}
        >
          {earlier.map((r) => (
            <RaceTile key={r.id} race={r} />
          ))}
        </TileSection>
      )}
    </div>
  );
}

/** What a tap brings in: "Show rounds 13 – 15", or "Show round 13". */
function showRounds(races: F1Race[]): string {
  const rounds = races.map((r) => r.round).sort((a, b) => a - b);
  return rounds.length > 1
    ? `Show rounds ${rounds[0]} – ${rounds[rounds.length - 1]}`
    : `Show round ${rounds[0]}`;
}

/**
 * The weekend as it stands: on track, next up, or a race weekend under way.
 * Read from the browser's clock after mount, never the server's render.
 */
function WhatsNext({ race }: { race: F1Race }): React.ReactElement {
  const now = useNow();
  const phrase = now === null ? null : weekendPhrase(race, now);
  const weekend = now !== null && isRaceWeekend(race, now);
  return (
    // Holds a badge's height before mount, so the timetable does not jump.
    <div className="flex min-h-6 flex-wrap items-center gap-2">
      {weekend && phrase?.tone !== "live" && (
        <Badge variant="info" className="text-foreground">
          Race weekend
        </Badge>
      )}
      {phrase?.tone === "live" && <StatusPill status="live" label={phrase.text} />}
      {phrase && phrase.tone !== "live" && (
        <Text as="span" weight="medium">
          {phrase.text}
        </Text>
      )}
    </div>
  );
}

function FeaturedRace({
  race,
  results,
  drivers,
}: {
  race: F1Race;
  results: F1SessionResult[];
  drivers: F1Data["drivers"];
}): React.ReactElement {
  const format = useMatchTime();
  const now = useNow();
  return (
    // The card is not one big link that greys on hover: "View details"
    // opens the race's page, and the card itself stays still.
    <Card>
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-5 @2xl:gap-x-8">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* "Next race" or "On now" is the heading above the card. */}
            <Eyebrow>Round {race.round}</Eyebrow>
            {race.sprint && <SprintBadge />}
          </div>
          <Heading level="h3" className="flex items-center gap-3">
            <span aria-hidden className="text-3xl leading-none">
              {race.flagEmoji}
            </span>
            {race.name}
          </Heading>
          <Text variant="muted">{racePlace(race)}</Text>
          <Mono className="text-sm">{raceWhen(race, format)}</Mono>
        </div>

        <F1CircuitOutline
          circuitId={race.circuitId}
          className="size-20 text-foreground @2xl:row-span-3 @2xl:size-48 @2xl:self-center @4xl:size-56"
        />

        {/* Pinned to the first column: a circuit with no outline leaves the
            second one empty, and they would flow into it. */}
        <div className="col-span-2 @2xl:col-span-1 @2xl:col-start-1">
          <WhatsNext race={race} />
        </div>

        <div className="col-span-2 @2xl:col-span-1 @2xl:col-start-1">
          <SessionList race={race} format={format} now={now} results={results} drivers={drivers} />
        </div>

        <div className="col-span-2 flex justify-end">
          <ViewDetailsLink href={f1RacePath(race.round)} name={race.name} />
        </div>
      </CardContent>
    </Card>
  );
}

function RaceTile({ race }: { race: F1Race }): React.ReactElement {
  const format = useMatchTime();
  return (
    <Link href={f1RacePath(race.round)} data-race={race.id} className={cn(TILE, "gap-3")}>
      <span className="flex w-full items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="text-xl leading-none">
            {race.flagEmoji}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <Text variant="small" as="span">
              Round {race.round}
              {race.sprint && " · Sprint"}
            </Text>
            <Text as="span" weight="semibold" className="truncate">
              {race.name}
            </Text>
          </span>
        </span>
        <F1CircuitOutline circuitId={race.circuitId} className="size-10 text-muted-foreground" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <Text variant="small" as="span" className="truncate">
          {racePlace(race)}
        </Text>
        <Mono className="text-xs text-muted-foreground">{raceWhen(race, format)}</Mono>
      </span>
      {race.status === "completed" && (
        <span className="border-t pt-2">
          <ResultsLine race={race} />
        </span>
      )}
    </Link>
  );
}
