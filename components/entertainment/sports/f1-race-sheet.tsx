"use client";

import { RotateCw, Timer } from "lucide-react";
import { useCallback, useRef, useState, type JSX, type ReactNode } from "react";

import { getF1RaceClassificationAction } from "@/app/actions/f1";
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
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { raceSessions } from "@/lib/sports/f1-weekend";
import type { F1ClassificationRow, F1Driver, F1Race } from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { racePlace, raceWhen, SprintBadge } from "./f1-race-labels";
import { Podium, SessionList } from "./f1-race-parts";
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

type F1RaceSheetProps = {
  /** The race last opened; it stays while the sheet slides away. */
  race: F1Race | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: number;
  drivers: F1Driver[];
  classification?: ClassificationState;
  onRetry: () => void;
};

/**
 * One race in full: its circuit, timetable, podium, pole, fastest lap, sprint
 * and — for a finished race — the whole field. From the bottom on a phone,
 * where a side panel would be a sliver; from the right on a desktop.
 */
export function F1RaceSheet({
  race,
  open,
  onOpenChange,
  season,
  drivers,
  classification,
  onRetry,
}: F1RaceSheetProps): JSX.Element {
  const isMobile = useIsMobile();
  return (
    <Sheet open={open && race !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="gap-0 data-[side=bottom]:max-h-5/6 data-[side=right]:sm:max-w-md"
      >
        {race && (
          <RaceDetails
            race={race}
            season={season}
            drivers={drivers}
            classification={classification}
            onRetry={onRetry}
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
}: Omit<F1RaceSheetProps, "race" | "open" | "onOpenChange"> & { race: F1Race }): JSX.Element {
  const format = useMatchTime();
  const now = useNow();
  const hasSessions = raceSessions(race).length > 0;
  const hasMarks = race.pole || race.fastestLap || race.sprintWinner;

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

        {hasSessions && (
          <Section title="Weekend">
            <SessionList race={race} format={format} now={now} />
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
