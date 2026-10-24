"use client";

import { RotateCw, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type JSX, type ReactNode } from "react";

import { PageHeader } from "@/components/portal/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { raceSessions, SESSION_LABEL, weekendNow } from "@/lib/sports/f1-weekend";
import { cn } from "@/lib/utils";
import type {
  F1ClassificationRow,
  F1Driver,
  F1Race,
  F1SessionKind,
  F1SessionResult,
} from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { racePlace, raceWhen, SprintBadge } from "./f1-race-labels";
import { Podium, sessionDriver, SessionList } from "./f1-race-parts";
import { Portrait } from "./shared/portrait";
import { ShowMoreRows, useShownRows } from "./shared/show-more";
import { SportsBreadcrumbs } from "./shared/sports-breadcrumbs";
import { useMatchTime } from "./shared/time-zone-context";
import { StatusPill } from "./shared/status-pill";
import { SportsTh } from "./shared/table-primitives";
import { useNow } from "./use-now";

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
};

/**
 * One race on a page of its own: the way back to F1, its circuit, every
 * session's order as it comes in, the timetable, podium, pole, fastest lap,
 * sprint and — for a finished race — the whole field with its points. The
 * timetable and podium on the left, the tables on the right, on a wide
 * screen; one column on a phone.
 *
 * Everything comes with the page (read on the server); what was not in yet is
 * asked for again by refreshing it.
 */
export function F1RacePage({
  race,
  season,
  drivers,
  classification,
  sessions: weekend,
  current = false,
}: F1RacePageProps): JSX.Element {
  const router = useRouter();
  const format = useMatchTime();
  const now = useNow();
  // The weekend under way, or about to be: what is on track, else what is next.
  const state = current && now !== null ? weekendNow(race, now) : {};
  const session = state.live ?? state.next;
  const hasSessions = raceSessions(race).length > 0;
  const hasMarks = race.pole || race.fastestLap || race.sprintWinner;
  // The race of a finished weekend is the classification below, with points.
  const sessions = weekend.filter((s) => !(s.kind === "race" && race.status === "completed"));
  const hasTables = sessions.length > 0 || race.status === "completed";

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SportsBreadcrumbs sport="f1" current={race.name} />
        <PageHeader
          eyebrow={`Round ${race.round} · ${season}`}
          title={
            <span className="flex items-center gap-3">
              <span aria-hidden className="leading-none">
                {race.flagEmoji}
              </span>
              {race.name}
            </span>
          }
          description={racePlace(race)}
        />
      </div>

      <div className={cn("grid gap-6", hasTables && "@4xl:grid-cols-2 @4xl:items-start")}>
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardContent className="flex items-center gap-4 @md:gap-6">
              <F1CircuitOutline
                circuitId={race.circuitId}
                className="size-24 shrink-0 text-foreground @md:size-32"
              />
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
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

          {hasSessions && (
            <Section title="Weekend">
              <SessionList race={race} format={format} now={now} results={weekend} drivers={drivers} />
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
        </div>

        {hasTables && (
          <div className="flex min-w-0 flex-col gap-6">
            {sessions.length > 0 && (
              <Section title="Results">
                <SessionResults sessions={sessions} drivers={drivers} />
              </Section>
            )}
            {race.status === "completed" && (
              <Section title="Classification">
                {classification ? (
                  <ClassificationTable rows={classification} />
                ) : (
                  // Not destructive: a race just run usually has no results in yet.
                  <Alert>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                      The classification isn&apos;t available yet
                      <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                        <RotateCw /> Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
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

function ClassificationTable({ rows: all }: { rows: F1ClassificationRow[] }): JSX.Element {
  const rows = useShownRows(all);
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
      <ShowMoreRows rows={rows} className="border-t py-1" />
    </div>
  );
}
