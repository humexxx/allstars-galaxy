"use client";

import { ChevronRight, Flag, History } from "lucide-react";
import { Children, useLayoutEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { isRaceWeekend, RACES_SHOWN, racesTabGroups, weekendPhrase } from "@/lib/sports/f1-weekend";
import type { F1Data, F1Race, F1SessionResult, F1WeekendResults } from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { racePlace, raceWhen, SprintBadge } from "./f1-race-labels";
import { ResultsLine, SessionList } from "./f1-race-parts";
import { F1RaceSheet, useRaceClassifications, useWeekendResults } from "./f1-race-sheet";
import { fadeIn, holdScrollStill } from "./shared/reveal";
import { RevealPill } from "./shared/reveal-pill";
import { useMatchTime } from "./shared/time-zone-context";
import { StatusPill } from "./shared/status-pill";
import { useNow } from "./use-now";

/** `opener` gets the focus back when the sheet closes. */
type OpenRace = (race: F1Race, opener: HTMLElement) => void;

// A tile is a button, but it does not grey on hover: its border firms up.
const TILE =
  "flex w-full flex-col gap-3 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * F1's races, the left of its Overview: the race on now or next, large, then
 * every race still to come, then the ones run — none until asked for: as the
 * match lists bring in earlier days, "Earlier" on the "Earlier races" line
 * brings in three a tap, latest first, right where it was tapped, until the
 * season runs out. Every race opens its sheet.
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
}): JSX.Element {
  const { featured, comingUp, justFinished } = useMemo(
    () => racesTabGroups(data.races),
    [data.races]
  );
  const classifications = useRaceClassifications(data.season);
  const weekends = useWeekendResults(data.season, weekend);
  const featuredResults = featured ? weekends.get(featured.round) : undefined;
  // Kept after the sheet closes, so its content does not vanish mid-slide.
  const [raceId, setRaceId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const race = raceId ? (data.races.find((r) => r.id === raceId) ?? null) : null;
  const opener = useRef<HTMLElement | null>(null);

  // The races run that are shown. None while there is a race to come; once
  // the season is over they are all there is, so it opens on the last few.
  const [shownEarlier, setShownEarlier] = useState(featured ? 0 : RACES_SHOWN);
  const listRef = useRef<HTMLDivElement>(null);
  const added = useRef<string[] | null>(null);
  const earlier = justFinished.slice(0, shownEarlier);
  const nextEarlier = justFinished.slice(earlier.length, earlier.length + RACES_SHOWN);

  // The new races are in, under the ones shown. They fade in; the focus
  // stays on the pill for the next three, or goes to the first of them once
  // the season has no more.
  useLayoutEffect(() => {
    const ids = added.current;
    const root = listRef.current;
    added.current = null;
    if (!ids || !root) return;
    const tiles = ids
      .map((id) => root.querySelector<HTMLElement>(`[data-race="${id}"]`))
      .filter((t): t is HTMLElement => t !== null);
    const pill = root.querySelector<HTMLElement>("[data-reveal]");
    (pill ?? tiles[0])?.focus({ preventScroll: true });
    tiles.forEach((tile, i) => fadeIn(tile, i * 40));
  }, [shownEarlier]);

  const revealEarlier = (): void => {
    if (!listRef.current) return;
    holdScrollStill(listRef.current);
    added.current = nextEarlier.map((r) => r.id);
    setShownEarlier(shownEarlier + RACES_SHOWN);
  };

  const open: OpenRace = (next, from) => {
    opener.current = from;
    setRaceId(next.id);
    setSheetOpen(true);
    if (next.status === "completed") void classifications.load(next.round);
    void weekends.load(next);
  };

  return (
    <div ref={listRef} className="@container flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        <RaceHeading>{featured?.status === "live" ? "On now" : "Next race"}</RaceHeading>
        {featured ? (
          <FeaturedRace
            race={featured}
            onOpen={open}
            results={featuredResults?.status === "ready" ? featuredResults.sessions : []}
            drivers={data.drivers}
          />
        ) : (
          <EmptyState
            icon={Flag}
            title={`The ${data.season} season is over`}
            description="Every round is under Earlier races below."
          />
        )}
      </section>

      {comingUp.length > 0 && (
        <RaceSection title="Coming up">
          {comingUp.map((r) => (
            <RaceTile key={r.id} race={r} onOpen={open} />
          ))}
        </RaceSection>
      )}

      {/* Its line stands from the start, the pill on it: what a tap brings in
          lands right under it rather than past the races to come. */}
      {justFinished.length > 0 && (
        <RaceSection
          title="Earlier races"
          action={
            nextEarlier.length > 0 && (
              <RevealPill
                icon={History}
                label="Earlier"
                detail={showRounds(nextEarlier)}
                data-reveal
                onClick={revealEarlier}
              />
            )
          }
        >
          {earlier.map((r) => (
            <RaceTile key={r.id} race={r} onOpen={open} />
          ))}
        </RaceSection>
      )}

      <F1RaceSheet
        race={race}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        returnFocus={opener}
        season={data.season}
        drivers={data.drivers}
        classification={race ? classifications.get(race.round) : undefined}
        onRetry={() => {
          if (race) void classifications.load(race.round);
        }}
        weekend={race ? weekends.get(race.round) : undefined}
        onRetryWeekend={() => {
          if (race) void weekends.load(race);
        }}
        current={race !== null && race.id === featured?.id}
      />
    </div>
  );
}

/** The size, padding and gap of a day heading in `MatchesByDate`. */
function RaceHeading({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Eyebrow size="sm" asChild>
      <h3 className="py-1">{children}</h3>
    </Eyebrow>
  );
}

/** What a tap brings in: "Show rounds 13 – 15", or "Show round 13". */
function showRounds(races: F1Race[]): string {
  const rounds = races.map((r) => r.round).sort((a, b) => a - b);
  return rounds.length > 1
    ? `Show rounds ${rounds[0]} – ${rounds[rounds.length - 1]}`
    : `Show round ${rounds[0]}`;
}

function RaceSection({
  title,
  action,
  children,
}: {
  title: string;
  /** At the end of the heading's line: the pill that brings in more. */
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <RaceHeading>{title}</RaceHeading>
        {action}
      </div>
      {Children.count(children) > 0 && (
        <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">{children}</div>
      )}
    </section>
  );
}

/**
 * The weekend as it stands: on track, next up, or a race weekend under way.
 * Read from the browser's clock after mount, never the server's render.
 */
function WhatsNext({ race }: { race: F1Race }): JSX.Element {
  const now = useNow();
  const phrase = now === null ? null : weekendPhrase(race, now);
  const weekend = now !== null && isRaceWeekend(race, now);
  return (
    // Holds a badge's height before mount, so the timetable does not jump.
    <div className="flex min-h-6 flex-wrap items-center gap-2">
      {weekend && phrase?.tone !== "live" && <Badge variant="info">Race weekend</Badge>}
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
  onOpen,
  results,
  drivers,
}: {
  race: F1Race;
  onOpen: OpenRace;
  results: F1SessionResult[];
  drivers: F1Data["drivers"];
}): JSX.Element {
  const format = useMatchTime();
  const now = useNow();
  return (
    // The card is not one big button that greys on hover: "View details"
    // opens the race, and the card itself stays still.
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

        {/* At the card's foot, on its right. */}
        <div className="col-span-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            aria-label={`View details: ${race.name}`}
            onClick={(event) => onOpen(race, event.currentTarget)}
          >
            View details
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RaceTile({ race, onOpen }: { race: F1Race; onOpen: OpenRace }): JSX.Element {
  const format = useMatchTime();
  return (
    <button
      type="button"
      data-race={race.id}
      onClick={(event) => onOpen(race, event.currentTarget)}
      className={TILE}
    >
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
    </button>
  );
}
