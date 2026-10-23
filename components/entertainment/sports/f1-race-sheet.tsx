"use client";

import { RotateCw, Timer } from "lucide-react";
import { useCallback, useRef, useState, type JSX, type ReactNode, type RefObject } from "react";

import { getF1RaceClassificationAction, getF1WeekendResultsAction } from "@/app/actions/f1";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { raceSessions, weekendWindow } from "@/lib/sports/f1-weekend";
import type {
  F1ClassificationRow,
  F1Driver,
  F1Race,
  F1SessionKind,
  F1SessionResult,
  F1WeekendResults,
} from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { racePlace, raceWhen, SprintBadge } from "./f1-race-labels";
import { Podium, sessionDriver, SessionList } from "./f1-race-parts";
import { Portrait } from "./shared/portrait";
import { useMatchTime } from "./shared/time-zone-context";
import { StatusPill } from "./shared/status-pill";
import { SportsTh } from "./shared/table-primitives";
import { useNow } from "./use-now";

export type ClassificationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: F1ClassificationRow[] };

/**
 * Each finished race's full classification, fetched the first time its sheet
 * opens and kept for the visit. A failure is forgotten, so opening the race
 * again (or Retry) asks once more.
 */
export function useRaceClassifications(season: number): {
  get: (round: number) => ClassificationState | undefined;
  load: (round: number) => Promise<void>;
} {
  const [byRound, setByRound] = useState<Record<number, ClassificationState>>({});
  // Loading or loaded: read in a handler, where state could be a render old.
  const requested = useRef(new Set<number>());

  const load = useCallback(
    async (round: number): Promise<void> => {
      if (requested.current.has(round)) return;
      requested.current.add(round);
      setByRound((prev) => ({ ...prev, [round]: { status: "loading" } }));
      const result = await getF1RaceClassificationAction({ season, round }).catch(() => ({
        success: false as const,
        error: "Couldn't load the classification",
      }));
      if (!result.success) requested.current.delete(round);
      setByRound((prev) => ({
        ...prev,
        [round]: result.success
          ? { status: "ready", rows: result.data.rows }
          : { status: "error", message: result.error },
      }));
    },
    [season]
  );

  const get = useCallback((round: number) => byRound[round], [byRound]);
  return { get, load };
}

export type WeekendState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sessions: F1SessionResult[] };

/**
 * Each weekend's session results, by round: the race on now or next's come
 * with the page, any other's the first time its sheet opens (only once a
 * session has run). Kept for the visit; a failure is forgotten, as above.
 */
export function useWeekendResults(
  season: number,
  initial?: F1WeekendResults
): {
  get: (round: number) => WeekendState | undefined;
  load: (race: F1Race) => Promise<void>;
} {
  const [byRound, setByRound] = useState<Record<number, WeekendState>>(() =>
    initial ? { [initial.round]: { status: "ready", sessions: initial.sessions } } : {}
  );
  const requested = useRef(new Set<number>(initial ? [initial.round] : []));

  const load = useCallback(
    async (race: F1Race): Promise<void> => {
      const window = weekendWindow(race, Date.now());
      if (!window || requested.current.has(race.round)) return;
      requested.current.add(race.round);
      setByRound((prev) => ({ ...prev, [race.round]: { status: "loading" } }));
      const result = await getF1WeekendResultsAction({ season, round: race.round, ...window }).catch(
        () => ({ success: false as const, error: "Couldn't load the sessions" })
      );
      if (!result.success) requested.current.delete(race.round);
      setByRound((prev) => ({
        ...prev,
        [race.round]: result.success
          ? { status: "ready", sessions: result.data.sessions }
          : { status: "error", message: result.error },
      }));
    },
    [season]
  );

  const get = useCallback((round: number) => byRound[round], [byRound]);
  return { get, load };
}

type F1RaceSheetProps = {
  /** The race last opened; it stays while the sheet slides away. */
  race: F1Race | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * What opened the sheet, which gets the focus back on close. Opened from a
   * tile rather than a trigger, Radix has nothing of its own to return it
   * to, and the focus fell to the top of the page.
   */
  returnFocus?: RefObject<HTMLElement | null>;
  season: number;
  drivers: F1Driver[];
  classification?: ClassificationState;
  onRetry: () => void;
  /** Its sessions' results, practice to race. */
  weekend?: WeekendState;
  onRetryWeekend?: () => void;
};

/**
 * One race in full: its circuit, every session's order as it comes in
 * (practice to race, from OpenF1), the timetable, podium, pole, fastest lap,
 * sprint and — for a finished race — the whole field with its points. From
 * the bottom on a phone, where a side panel would be a sliver; from the right
 * on a desktop.
 */
export function F1RaceSheet({
  race,
  open,
  onOpenChange,
  returnFocus,
  season,
  drivers,
  classification,
  onRetry,
  weekend,
  onRetryWeekend,
}: F1RaceSheetProps): JSX.Element {
  const isMobile = useIsMobile();
  return (
    <Sheet open={open && race !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="gap-0 data-[side=bottom]:max-h-5/6 data-[side=right]:sm:max-w-md"
        onCloseAutoFocus={(event) => {
          const opener = returnFocus?.current;
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        {race && (
          <RaceDetails
            race={race}
            season={season}
            drivers={drivers}
            classification={classification}
            onRetry={onRetry}
            weekend={weekend}
            onRetryWeekend={onRetryWeekend}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function RaceDetails({
  race,
  season,
  drivers,
  classification,
  onRetry,
  weekend,
  onRetryWeekend,
}: Omit<F1RaceSheetProps, "race" | "open" | "onOpenChange" | "returnFocus"> & {
  race: F1Race;
}): JSX.Element {
  const format = useMatchTime();
  const now = useNow();
  const hasSessions = raceSessions(race).length > 0;
  const hasMarks = race.pole || race.fastestLap || race.sprintWinner;
  // The race of a finished weekend is the classification below, with points.
  const sessions =
    weekend?.status === "ready"
      ? weekend.sessions.filter((s) => !(s.kind === "race" && race.status === "completed"))
      : [];

  return (
    <>
      <SheetHeader className="pr-12">
        <Eyebrow as="div">
          Round {race.round} · {season}
        </Eyebrow>
        <SheetTitle asChild>
          <Heading level="h5" as="h2" className="flex items-center gap-2">
            <span aria-hidden className="text-xl leading-none">
              {race.flagEmoji}
            </span>
            {race.name}
          </Heading>
        </SheetTitle>
        <SheetDescription>{racePlace(race)}</SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6">
        <div className="flex items-center gap-4">
          <F1CircuitOutline circuitId={race.circuitId} className="size-24 text-foreground" />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={race.status} />
              {race.sprint && <SprintBadge />}
            </div>
            <Mono className="text-sm">{raceWhen(race, format)}</Mono>
          </div>
        </div>

        {weekend && weekend.status !== "ready" && (
          <Section title="Results">
            <SessionsLoading state={weekend} onRetry={onRetryWeekend} />
          </Section>
        )}
        {sessions.length > 0 && (
          <Section title="Results">
            <SessionResults sessions={sessions} drivers={drivers} />
          </Section>
        )}

        {hasSessions && (
          <Section title="Weekend">
            <SessionList
              race={race}
              format={format}
              now={now}
              results={weekend?.status === "ready" ? weekend.sessions : []}
              drivers={drivers}
            />
          </Section>
        )}

        {race.podium && (
          <Section title="Podium">
            <Podium race={race} drivers={drivers} />
          </Section>
        )}

        {hasMarks && (
          <dl className="grid grid-cols-3 gap-2">
            {race.pole && <Mark label="Pole" code={race.pole.code} detail={race.pole.time} />}
            {race.fastestLap && (
              <Mark
                label="Fastest lap"
                code={race.fastestLap.code}
                detail={[race.fastestLap.time, race.fastestLap.lap && `Lap ${race.fastestLap.lap}`]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
            {race.sprintWinner && (
              <Mark label="Sprint" code={race.sprintWinner.code} detail={race.sprintWinner.team} />
            )}
          </dl>
        )}

        {race.status === "completed" && (
          <Section title="Classification">
            <Classification state={classification} onRetry={onRetry} />
          </Section>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <Eyebrow asChild>
        <h3>{title}</h3>
      </Eyebrow>
      {children}
    </section>
  );
}

/** "P1", "Q": short enough for every session of a sprint weekend to fit a phone. */
const SHORT_SESSION: Record<F1SessionKind, string> = {
  fp1: "P1",
  fp2: "P2",
  fp3: "P3",
  "sprint-qualifying": "SQ",
  sprint: "Sprint",
  qualifying: "Q",
  race: "Race",
};

const SESSION_NAME: Record<F1SessionKind, string> = {
  fp1: "Practice 1",
  fp2: "Practice 2",
  fp3: "Practice 3",
  "sprint-qualifying": "Sprint Qualifying",
  sprint: "Sprint",
  qualifying: "Qualifying",
  race: "Race",
};

/**
 * One session's order at a time, the latest first: position, driver and
 * team, the best lap (a race's winner: the race time) and the gap.
 */
function SessionResults({
  sessions,
  drivers,
}: {
  sessions: F1SessionResult[];
  drivers: F1Driver[];
}): JSX.Element {
  const [picked, setPicked] = useState<F1SessionKind>(sessions[sessions.length - 1].kind);
  const shown = sessions.find((s) => s.kind === picked) ?? sessions[sessions.length - 1];
  return (
    <div className="flex flex-col gap-3">
      {sessions.length > 1 && (
        <ToggleGroup
          type="single"
          size="sm"
          value={shown.kind}
          onValueChange={(v) => v && setPicked(v as F1SessionKind)}
          aria-label="Session"
          className="self-start"
        >
          {sessions.map((s) => (
            <ToggleGroupItem key={s.kind} value={s.kind} aria-label={SESSION_NAME[s.kind]}>
              {SHORT_SESSION[s.kind]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <div className="overflow-hidden rounded-lg border">
        <Table aria-label={SESSION_NAME[shown.kind]}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-10 pl-3">Pos</SportsTh>
              <SportsTh>Driver</SportsTh>
              <SportsTh className="text-right">Time</SportsTh>
              <SportsTh className="pr-3 text-right">Gap</SportsTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.rows.map((row, i) => {
              const { name, subject } = sessionDriver(row, drivers);
              return (
                <TableRow key={`${row.code}-${i}`}>
                  <TableCell className="pl-3">
                    <Mono className="text-xs text-muted-foreground">{row.position}</Mono>
                  </TableCell>
                  <TableCell className="w-full max-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Portrait size="table" subject={subject} />
                      <div className="flex min-w-0 flex-col leading-tight">
                        <Text as="span" weight="medium" className="truncate">
                          {name}
                        </Text>
                        <Text variant="small" as="span" className="truncate">
                          {row.team}
                        </Text>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {row.segment && (
                        <Mono className="text-2xs text-muted-foreground">{row.segment}</Mono>
                      )}
                      <Mono className="text-xs">{row.time ?? ""}</Mono>
                    </span>
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <Mono className="text-xs text-muted-foreground">{row.gap ?? ""}</Mono>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SessionsLoading({
  state,
  onRetry,
}: {
  state: Exclude<WeekendState, { status: "ready" }>;
  onRetry?: () => void;
}): JSX.Element {
  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading the sessions" className="flex flex-col gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }
  return (
    <Alert>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        {state.message}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw /> Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

function Mark({ label, code, detail }: { label: string; code: string; detail?: string }): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border p-2">
      <Eyebrow size="sm" asChild>
        <dt>{label}</dt>
      </Eyebrow>
      <dd className="flex min-w-0 flex-col">
        <Mono className="text-sm font-semibold">{code}</Mono>
        {detail && <Mono className="truncate text-2xs text-muted-foreground">{detail}</Mono>}
      </dd>
    </div>
  );
}

function Classification({
  state,
  onRetry,
}: {
  state?: ClassificationState;
  onRetry: () => void;
}): JSX.Element {
  if (!state || state.status === "loading") {
    return (
      <div role="status" aria-label="Loading the classification" className="flex flex-col gap-1">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      // Not destructive: a race just run usually has no results in yet.
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          {state.message}
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SportsTh className="w-10 pl-3">Pos</SportsTh>
            <SportsTh>Driver</SportsTh>
            <SportsTh className="text-right">Time</SportsTh>
            <SportsTh className="pr-3 text-right">Pts</SportsTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.rows.map((row, i) => (
            <TableRow key={`${row.code}-${i}`}>
              <TableCell className="pl-3">
                <Mono className="text-xs text-muted-foreground">{row.position}</Mono>
              </TableCell>
              {/* Takes what the other columns leave, so a long name truncates
                  instead of pushing the table sideways on a phone. */}
              <TableCell className="w-full max-w-0">
                <div className="flex min-w-0 flex-col leading-tight">
                  <Text as="span" weight="medium" className="truncate">
                    {row.name}
                  </Text>
                  <Text variant="small" as="span" className="truncate">
                    {row.team}
                  </Text>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-1">
                  {row.fastestLap && (
                    <Timer aria-label="Fastest lap" className="size-3.5 text-muted-foreground" />
                  )}
                  <Mono className="text-xs">{row.result}</Mono>
                </span>
              </TableCell>
              <TableCell className="pr-3 text-right">
                <Mono className="text-xs font-semibold">{row.points}</Mono>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
