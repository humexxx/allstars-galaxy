"use client";

import { CalendarDays, ChevronDown, ChevronRight, Flag } from "lucide-react";
import { useMemo, useRef, useState, type JSX, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { isRaceWeekend, racesTabGroups, weekendPhrase } from "@/lib/sports/f1-weekend";
import { cn } from "@/lib/utils";
import type { F1Data, F1Race, F1SessionResult, F1WeekendResults } from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { racePlace, raceWhen, SprintBadge } from "./f1-race-labels";
import { ResultsLine, SessionList } from "./f1-race-parts";
import { F1RaceSheet, useRaceClassifications, useWeekendResults } from "./f1-race-sheet";
import { useMatchTime } from "./shared/time-zone-context";
import { StatusPill } from "./shared/status-pill";
import { useNow } from "./use-now";

/** `opener` gets the focus back when the sheet closes. */
type OpenRace = (race: F1Race, opener: HTMLElement) => void;

// A tile is a button, but it does not grey on hover: its border firms up.
const TILE =
  "flex w-full flex-col gap-3 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * F1's races, the left of its Overview: the race on now or next, large; the
 * three after it; the three just run; and the whole calendar on request.
 * Every race opens its sheet.
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

  const open: OpenRace = (next, from) => {
    opener.current = from;
    setRaceId(next.id);
    setSheetOpen(true);
    if (next.status === "completed") void classifications.load(next.round);
    void weekends.load(next);
  };

  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        <RaceHeading>{featured?.status === "live" ? "On now" : "Next race"}</RaceHeading>
        {featured ? (
          <FeaturedRace
            race={featured}
            onOpen={open}
            results={featuredResults?.status === "ready" ? featuredResults.sessions : []}
          />
        ) : (
          <EmptyState
            icon={Flag}
            title={`The ${data.season} season is over`}
            description="Every round is in the calendar below."
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

      {justFinished.length > 0 && (
        <RaceSection title="Just finished">
          {justFinished.map((r) => (
            <RaceTile key={r.id} race={r} onOpen={open} />
          ))}
        </RaceSection>
      )}

      <FullCalendar races={data.races} featuredId={featured?.id} onOpen={open} />

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

function RaceSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <RaceHeading>{title}</RaceHeading>
      <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">{children}</div>
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
}: {
  race: F1Race;
  onOpen: OpenRace;
  results: F1SessionResult[];
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
          <SessionList race={race} format={format} now={now} results={results} />
        </div>

        <div className="col-span-2 @2xl:col-span-1 @2xl:col-start-1">
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
    <button type="button" onClick={(event) => onOpen(race, event.currentTarget)} className={TILE}>
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

/** Every round on one line each, folded away until asked for. */
function FullCalendar({
  races,
  featuredId,
  onOpen,
}: {
  races: F1Race[];
  featuredId?: string;
  onOpen: OpenRace;
}): JSX.Element {
  const format = useMatchTime();
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="self-start">
          <CalendarDays />
          {open ? "Hide calendar" : "Full calendar"}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="gap-0 py-0">
          <ol aria-label="Season calendar" className="divide-y">
            {races.map((race) => (
              <li key={race.id}>
                <button
                  type="button"
                  onClick={(event) => onOpen(race, event.currentTarget)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40",
                    race.status === "completed" && "text-muted-foreground"
                  )}
                >
                  <Mono className="w-6 shrink-0 text-xs text-muted-foreground">{race.round}</Mono>
                  <span aria-hidden className="text-base leading-none">
                    {race.flagEmoji}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <Text
                      as="span"
                      weight={race.id === featuredId ? "semibold" : "medium"}
                      className={cn("truncate", race.status === "completed" && "text-muted-foreground")}
                    >
                      {race.name}
                    </Text>
                    <Mono className="text-2xs text-muted-foreground">{raceWhen(race, format)}</Mono>
                  </span>
                  <CalendarRowEnd race={race} isNext={race.id === featuredId} />
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CalendarRowEnd({ race, isNext }: { race: F1Race; isNext: boolean }): JSX.Element | null {
  if (race.status === "live") return <StatusPill status="live" />;
  if (isNext) return <Badge variant="info">Next</Badge>;
  const winner = race.winner?.code ?? race.podium?.[0];
  if (race.status === "completed" && winner) {
    return <Mono className="shrink-0 text-xs font-semibold text-foreground">{winner}</Mono>;
  }
  return race.sprint ? <SprintBadge /> : null;
}
