"use client";

import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
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
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  LolData,
  LolMatch,
  LolRegion,
  LolSplit,
  Team,
} from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { Last5Form } from "../shared/last-5-form";
import { SportShell } from "../shared/sport-shell";
import { SportsTh } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";

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

  const hasPlayoffs = !!split.playoffs && split.playoffs.length > 0;

  return (
    // Keyed by region: switching to a region without playoffs while on the
    // "playoffs" tab would otherwise strand the uncontrolled Tabs on a value
    // whose trigger/content no longer exist (blank body).
    <Tabs
      key={region}
      defaultValue={hasPlayoffs ? "playoffs" : "matches"}
      className="space-y-6"
    >
      <SportShell
        emoji="🎮"
        title="League of Legends"
        subtitle={`${split.name} · ${split.season}`}
        controls={
          <Select value={region} onValueChange={(v) => setRegion(v as LolRegion)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {data.splits.map((s) => (
                <SelectItem key={s.region} value={s.region}>
                  {s.region.toUpperCase()} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        tabs={
          <TabsList>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            {hasPlayoffs && <TabsTrigger value="playoffs">Playoffs</TabsTrigger>}
          </TabsList>
        }
      >
        <TabsContent value="matches">
          <div className="grid gap-2 sm:grid-cols-2">
            {split.matches.map((m) => (
              <LolMatchCard key={m.id} match={m} teams={teamsMap} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="standings">
          <LolStandings split={split} teamsMap={teamsMap} />
        </TabsContent>

        {hasPlayoffs && (
          <TabsContent value="playoffs">
            <Card>
              <CardContent className="p-4">
                <KnockoutBracket rounds={split.playoffs!} teams={teamsMap} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
  );
}

function LolMatchCard({
  match,
  teams,
}: {
  match: LolMatch;
  teams: Map<string, Team>;
}) {
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  if (!home || !away) return null;
  const isScheduled = match.status === "scheduled";
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
      <div className="min-w-0 space-y-1.5">
        {match.stageLabel && (
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            {match.stageLabel} · BO{match.bestOf}
          </div>
        )}
        <LolTeamRow team={home} score={match.homeScore} winner={homeWon} scheduled={isScheduled} />
        <LolTeamRow team={away} score={match.awayScore} winner={awayWon} scheduled={isScheduled} />
      </div>
      <div className="border-l pl-3 text-right">
        <Mono className="text-2xs uppercase tracking-wide text-muted-foreground">
          {isScheduled
            ? new Date(match.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : match.status.toUpperCase()}
        </Mono>
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
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-8">
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
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
