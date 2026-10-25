"use client";

import { Lock, RotateCw, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode, type Ref } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { raceSessions, SESSION_LABEL, weekendNow } from "@/lib/sports/f1-weekend";
import { sportPath } from "@/lib/sports/paths";
import { cn } from "@/lib/utils";
import type {
  F1ClassificationRow,
  F1Driver,
  F1Race,
  F1SessionKind,
  F1SessionResult,
  SportId,
} from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { racePlace, raceWhen, SprintBadge } from "./f1-race-labels";
import { Podium, sessionDriver, SessionList } from "./f1-race-parts";
import { Portrait } from "./shared/portrait";
import { ShowMoreRows, useShownRows } from "./shared/show-more";
import { SportShell } from "./shared/sport-shell";
import { useMatchTime } from "./shared/time-zone-context";
import { StatusPill } from "./shared/status-pill";
import { SportsTh } from "./shared/table-primitives";
import { SportPageControls } from "./sport-page-controls";
import { useNow } from "./use-now";

const F1 = SPORTS_BY_ID.get("f1");

type F1RacePageProps = {
  race: F1Race;
  season: number;
  drivers: F1Driver[];
  /** A finished race's whole field, or null when Jolpica has none in yet. */
  classification?: F1ClassificationRow[] | null;
  /** Its sessions' results so far, practice to race (OpenF1). */
  sessions: F1SessionResult[];
  /**
   * The race on now or next: beside its circuit goes the session on track or
   * the next one, by name and time, rather than the race's own start.
   */
  current?: boolean;
  favoriteSportIds: SportId[];
  /** `?tab=results` opens on the results, once there are some. */
  initialTab?: string;
};

/**
 * One race on a page of its own, laid out as F1's page is: the same name
 * row with the favourites and the sport picker, its title a breadcrumb
 * ("Formula 1 › Mexico City Grand Prix"). Overview: the circuit, big, with
 * its place and what is on or next, beside the weekend's timetable, the
 * podium, pole, fastest lap and sprint. Results (locked until a session has
 * run): every session's order as it comes in and, for a finished race, the
 * whole field with its points.
 *
 * Everything comes with the page (read on the server); what was not in yet is
 * asked for again by refreshing it.
 */
export function F1RacePage({
  race,
  season,
  drivers,
  classification,
  sessions,
  current = false,
  favoriteSportIds,
  initialTab,
}: F1RacePageProps): React.ReactElement {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const [retried, setRetried] = useState(false);
  const classificationHeading = useRef<HTMLHeadingElement>(null);
  const handOff = useRef(false);
  const format = useMatchTime();
  const now = useNow();
  // The weekend under way, or about to be: what is on track, else what is next.
  const state = current && now !== null ? weekendNow(race, now) : {};
  const session = state.live ?? state.next;
  const hasSessions = raceSessions(race).length > 0;
  const hasMarks = race.pole || race.fastestLap || race.sprintWinner;
  // The race of a finished weekend is the classification below, with points.
  const tabled = sessions.filter((s) => !(s.kind === "race" && race.status === "completed"));
  const hasTables = tabled.length > 0 || race.status === "completed";
  const retryStatus = retrying
    ? "Checking for the classification…"
    : retried && !classification
      ? "Still not available"
      : "";

  // The table a Retry brought in replaced the alert, and the focused button
  // with it: the reader carries on from the table's heading, not the page's
  // top. Once, so a later refresh never takes focus there.
  useEffect(() => {
    if (!handOff.current || !classification) return;
    handOff.current = false;
    if (document.activeElement === document.body) classificationHeading.current?.focus();
  }, [classification]);

  return (
    <SportPageControls sport="f1" favoriteSportIds={favoriteSportIds}>
      <Tabs defaultValue={initialTab === "results" && hasTables ? "results" : "overview"} className="gap-6">
        <SportShell
          emoji={F1?.emoji}
          title={race.name}
          subtitle={`Round ${race.round} · ${season} Season`}
          parent={{ label: F1?.label ?? "Formula 1", href: sportPath("f1") }}
          tabs={
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {/* Locked until a session has run: where its orders will be is worth knowing. */}
              <TabsTrigger value="results" disabled={!hasTables}>
                {!hasTables && <Lock aria-hidden />}
                Results
              </TabsTrigger>
            </TabsList>
          }
        >
          <TabsContent value="overview">
            <div className="grid gap-6 @4xl:grid-cols-2 @4xl:items-start">
              <Card>
                <CardContent className="flex flex-col items-center gap-4 text-center">
                  <F1CircuitOutline circuitId={race.circuitId} className="h-auto w-full max-w-72 text-foreground" />
                  <div className="flex flex-col items-center gap-2">
                    <Text variant="muted">{racePlace(race)}</Text>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {session ? (
                        <StatusPill
                          status={state.live ? "live" : "upcoming"}
                          label={`${state.live ? "On track" : "Next"} · ${SESSION_LABEL[session.kind]}`}
                        />
                      ) : (
                        <StatusPill status={race.status} />
                      )}
                      {race.sprint && <SprintBadge />}
                    </div>
                    <Mono className="text-sm">
                      {session ? format.dayTime(session.startsAt) : raceWhen(race, format)}
                    </Mono>
                  </div>
                </CardContent>
              </Card>

              <div className="flex min-w-0 flex-col gap-6">
                {hasSessions && (
                  <Section title="Weekend">
                    <div className="rounded-lg border bg-card px-3">
                      <SessionList race={race} format={format} now={now} results={sessions} drivers={drivers} />
                    </div>
                  </Section>
                )}

                {race.podium && (
                  <Section title="Podium">
                    <div className="rounded-lg border bg-card p-1">
                      <Podium race={race} drivers={drivers} />
                    </div>
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
              </div>
            </div>
          </TabsContent>

          {hasTables && (
            <TabsContent value="results">
              <div className="grid gap-6 @4xl:grid-cols-2 @4xl:items-start">
                {tabled.length > 0 && (
                  <Section title="Sessions">
                    <SessionResults sessions={tabled} drivers={drivers} />
                  </Section>
                )}
                {race.status === "completed" && (
                  <Section title="Classification" headingRef={classificationHeading}>
                    {classification ? (
                      <ClassificationTable rows={classification} />
                    ) : (
                      // Not destructive: a race just run usually has no results in yet.
                      <Alert>
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                          The classification isn&apos;t available yet
                          {/* aria-disabled, not disabled, so the button keeps focus while it asks. */}
                          <Button
                            variant="outline"
                            size="sm"
                            aria-disabled={retrying || undefined}
                            onClick={() => {
                              if (retrying) return;
                              setRetried(true);
                              handOff.current = true;
                              startRetry(() => router.refresh());
                            }}
                          >
                            <RotateCw className={cn(retrying && "motion-safe:animate-spin")} /> Retry
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    {/* Outside the branch, so it is there before its words change. */}
                    <span role="status" className="sr-only">
                      {retryStatus}
                    </span>
                  </Section>
                )}
              </div>
            </TabsContent>
          )}
        </SportShell>
      </Tabs>
    </SportPageControls>
  );
}

function Section({
  title,
  headingRef,
  children,
}: {
  title: string;
  /** A heading focus can be sent to. */
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <Eyebrow asChild>
        <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="outline-none">
          {title}
        </h2>
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
}): React.ReactElement {
  // Unpicked, the latest: a refresh that brings in a newer session moves to it.
  const [picked, setPicked] = useState<F1SessionKind | null>(null);
  const shown = sessions.find((s) => s.kind === picked) ?? sessions[sessions.length - 1];
  const rows = useShownRows(shown.rows, shown.kind);
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
            <ToggleGroupItem key={s.kind} value={s.kind}>
              {SHORT_SESSION[s.kind]}
              {/* "P1 (Practice 1)": the name starts with what is on the button. The
                  space sits outside the span, as some readers trim an element's own text. */}
              {SHORT_SESSION[s.kind] !== SESSION_NAME[s.kind] && (
                <>
                  {" "}
                  <span className="sr-only">({SESSION_NAME[s.kind]})</span>
                </>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <div className="overflow-hidden rounded-lg border bg-card">
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
            {rows.shown.map((row, i) => {
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
        <ShowMoreRows rows={rows} className="border-t py-1" />
      </div>
    </div>
  );
}

function Mark({ label, code, detail }: { label: string; code: string; detail?: string }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-card p-2">
      <Eyebrow size="sm" asChild>
        <dt>{label}</dt>
      </Eyebrow>
      <dd className="flex min-w-0 flex-col">
        <Mono className="text-sm font-semibold">{code}</Mono>
        {detail && <Mono className="text-2xs text-muted-foreground">{detail}</Mono>}
      </dd>
    </div>
  );
}

function ClassificationTable({ rows: all }: { rows: F1ClassificationRow[] }): React.ReactElement {
  const rows = useShownRows(all);
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table aria-label="Classification">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SportsTh className="w-10 pl-3">Pos</SportsTh>
            <SportsTh>Driver</SportsTh>
            <SportsTh className="text-right">Time</SportsTh>
            <SportsTh className="pr-3 text-right">Pts</SportsTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.shown.map((row, i) => (
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
                    <>
                      <Timer aria-hidden className="size-3.5 text-muted-foreground" />
                      <span className="sr-only">Fastest lap</span>
                    </>
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
      <ShowMoreRows rows={rows} className="border-t py-1" />
    </div>
  );
}
