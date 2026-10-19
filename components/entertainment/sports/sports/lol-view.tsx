"use client";

import { useMemo, useState, type ReactElement } from "react";
import { CalendarX, Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { isBracketDrawn } from "@/lib/sports/bracket";
import type {
  LolChampion,
  LolData,
  LolMatch,
  LolRegion,
  LolSplit,
  LolUpcoming,
  Team,
} from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { Last5Form } from "../shared/last-5-form";
import { SportShell } from "../shared/sport-shell";
import { SwissBracket } from "../shared/swiss-bracket";
import { SportsTh, TableCard } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";
import { useMatchTime } from "../shared/time-zone-context";

type LolViewProps = {
  data: LolData;
};

export function LolView({ data }: LolViewProps) {
  const [region, setRegion] = useState<LolRegion>(data.splits[0]?.region ?? "lec");
  const split = useMemo(
    () => data.splits.find((s) => s.region === region) ?? data.splits[0],
    [data.splits, region],
  );
  const teamsMap = useMemo(
    () => new Map<string, Team>(split.teams.map((t) => [t.id, t])),
    [split],
  );

  const playoffs = split.playoffs && split.playoffs.length > 0 ? split.playoffs : null;
  // A bracket that exists but names nobody is not somewhere to land: opening
  // on it showed "not drawn yet" as the first thing on the page while the
  // split's actual matches sat one tab away.
  const playoffsDrawn = playoffs !== null && isBracketDrawn(playoffs);
  // Worlds' main stage until its knockouts are drawn, so it is where to land.
  const swiss = split.swiss ?? null;
  const hasMatches = split.matches.length > 0;
  const opening = playoffsDrawn
    ? "playoffs"
    : swiss
      ? "swiss"
      : !hasMatches && split.standings.length > 0
        ? "standings"
        : "matches";

  return (
    // Keyed by region: switching to a region without playoffs while on the
    // "playoffs" tab would otherwise strand the uncontrolled Tabs on a value
    // whose trigger/content no longer exist (blank body).
    <Tabs
      key={region}
      defaultValue={opening}
      className="gap-6"
    >
      <SportShell
        emoji="🎮"
        title="League of Legends"
        // "Worlds 2026" already names its year; "LEC Split 3" does not.
        subtitle={split.name.includes(String(split.season)) ? split.name : `${split.name} · ${split.season}`}
        controls={
          <Select value={region} onValueChange={(v) => setRegion(v as LolRegion)}>
            <SelectTrigger className="w-56" aria-label="Region">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {data.splits.map((s) => (
                <SelectItem key={s.region} value={s.region}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="matches">Matches</TabsTrigger>
            {/* Worlds' Swiss stage publishes no table until it is played. */}
            {split.standings.length > 0 && (
              <TabsTrigger value="standings">Standings</TabsTrigger>
            )}
            {swiss && <TabsTrigger value="swiss">Swiss stage</TabsTrigger>}
            {playoffs && <TabsTrigger value="playoffs">Playoffs</TabsTrigger>}
          </TabsList>
        }
      >
        <div className="flex flex-col gap-4">
          {split.champion && (
            <LolSeasonEnd
              split={split}
              champion={split.champion}
              teams={teamsMap}
              upcoming={data.upcoming ?? []}
            />
          )}

          <TabsContent value="matches">
            {hasMatches ? (
              <div className="grid gap-2 @xl:grid-cols-2">
                {split.matches.map((m) => (
                  <LolMatchCard key={m.id} match={m} teams={teamsMap} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarX}
                title="No matches to show"
                description="Lolesports has not sent this split's schedule."
              />
            )}
          </TabsContent>

          {split.standings.length > 0 && (
            <TabsContent value="standings">
              <LolStandings split={split} teamsMap={teamsMap} />
            </TabsContent>
          )}

          {swiss && (
            <TabsContent value="swiss">
              <Card size="sm">
                <CardContent>
                  <SwissBracket stage={swiss} teams={teamsMap} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {playoffs && (
            <TabsContent value="playoffs">
              <Card size="sm">
                <CardContent>
                  <KnockoutBracket rounds={playoffs} teams={teamsMap} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </div>
      </SportShell>
    </Tabs>
  );
}

/**
 * Who won the split on screen, and when each league is back. After Worlds the
 * hub opened on a finished bracket with nothing saying the season was over.
 */
function LolSeasonEnd({
  split,
  champion,
  teams,
  upcoming,
}: {
  split: LolSplit;
  champion: LolChampion;
  teams: Map<string, Team>;
  upcoming: LolUpcoming[];
}): ReactElement {
  const format = useMatchTime();
  const { teamId, final } = champion;
  const atHome = final.homeTeamId === teamId;
  const winner = teams.get(teamId);
  const runnerUpId = atHome ? final.awayTeamId : final.homeTeamId;
  const runnerUp = runnerUpId ? teams.get(runnerUpId) : undefined;
  const won = atHome ? final.homeScore : final.awayScore;
  const lost = atHome ? final.awayScore : final.homeScore;
  const result =
    runnerUp && won != null && lost != null
      ? `Beat ${runnerUp.shortName} ${won}–${lost} in the final`
      : "Won the final";

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-4 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {winner && <TeamBadge team={winner} size="lg" />}
          <div className="flex min-w-0 flex-col gap-0.5">
            <Eyebrow size="sm" as="div" className="flex items-center gap-1.5">
              <Trophy aria-hidden className="size-3.5 text-warning" />
              {split.name} champions
            </Eyebrow>
            <Heading level="h5" as="p" className="truncate">
              {winner?.name ?? teamId}
            </Heading>
            <Text variant="small" as="div">
              {final.date ? `${result} · ${format.shortDay(final.date)}` : result}
            </Text>
          </div>
        </div>
        {/* Only once Lolesports lists them: before that there is no date to give. */}
        {upcoming.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-3 @2xl:min-w-64 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-4">
            <Eyebrow size="sm" as="div">
              Next up
            </Eyebrow>
            <ul className="flex flex-col gap-1">
              {upcoming.map((u) => (
                <li key={u.region} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium">{u.name}</span>
                  <Mono className="shrink-0 text-2xs text-muted-foreground">
                    {format.day(u.startDate)}
                  </Mono>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LolMatchCard({
  match,
  teams,
}: {
  match: LolMatch;
  teams: Map<string, Team>;
}) {
  const format = useMatchTime();
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  if (!home || !away) return null;
  const isScheduled = match.status === "scheduled";
  const isLive = match.status === "live";
  const homeWon =
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.homeScore > match.awayScore;
  const awayWon =
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.awayScore > match.homeScore;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-1.5">
        {match.stageLabel && (
          <Eyebrow size="sm" as="div">
            {match.stageLabel} · BO{match.bestOf}
          </Eyebrow>
        )}
        <LolTeamRow team={home} score={match.homeScore} winner={homeWon} scheduled={isScheduled} />
        <LolTeamRow team={away} score={match.awayScore} winner={awayWon} scheduled={isScheduled} />
      </div>
      {/* Same column as `ScoreCard`: the status over the day for a result,
          the day over the time for a fixture. */}
      <div className="flex min-w-16 flex-col items-end justify-center gap-0.5 border-l pl-3 text-right">
        {!isScheduled && (
          <span
            className={cn(
              "text-2xs font-medium uppercase tracking-wide text-muted-foreground",
              isLive && "text-success",
            )}
          >
            {match.status}
          </span>
        )}
        {!isLive && (
          <Mono className="text-2xs text-muted-foreground">{format.shortDay(match.date)}</Mono>
        )}
        {isScheduled && (
          <Mono className="text-2xs text-muted-foreground">{format.time(match.date)}</Mono>
        )}
      </div>
    </div>
  );
}

function LolTeamRow({
  team,
  score,
  winner,
  scheduled,
}: {
  team: Team;
  score: number | null;
  winner: boolean;
  scheduled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <TeamBadge team={team} size="sm" />
        <span className={cn("truncate", winner && "font-semibold")}>{team.shortName}</span>
      </div>
      {!scheduled && score !== null && (
        <Mono
          className={cn(
            "text-sm tabular-nums",
            winner ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {score}
        </Mono>
      )}
    </div>
  );
}

function LolStandings({
  split,
  teamsMap,
}: {
  split: LolSplit;
  teamsMap: Map<string, Team>;
}) {
  return (
    <TableCard>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-8 pl-3">
                #
              </SportsTh>
              <SportsTh>
                Team
              </SportsTh>
              <SportsTh className="text-center">
                W
              </SportsTh>
              <SportsTh className="text-center">
                L
              </SportsTh>
              <SportsTh className="text-center">
                Last 5
              </SportsTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {split.standings.map((row) => {
              const team = teamsMap.get(row.teamId);
              return (
                <TableRow key={row.teamId}>
                  <TableCell className="pl-3 text-sm tabular-nums text-muted-foreground">
                    {row.position}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {team && <TeamBadge team={team} size="sm" />}
                      <span className="text-sm">{team?.shortName ?? row.teamId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Mono className="text-sm">{row.wins}</Mono>
                  </TableCell>
                  <TableCell className="text-center">
                    <Mono className="text-sm">{row.losses}</Mono>
                  </TableCell>
                  <TableCell>
                    {row.form && (
                      <Last5Form results={row.form} className="justify-center" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
    </TableCard>
  );
}
