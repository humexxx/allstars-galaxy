"use client";

import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { NbaConference, NbaData, Team } from "@/types/sports";

import { ScoreCard } from "../shared/score-card";
import { SportShell } from "../shared/sport-shell";
import { TeamBadge } from "../shared/team-badge";

type NbaViewProps = {
  data: NbaData;
};

export function NbaView({ data }: NbaViewProps) {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );

  return (
    <SportShell emoji="🏀" title="NBA" subtitle={`Season ${data.season}`}>
      <Tabs defaultValue="games" className="space-y-5">
        <TabsList>
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
        </TabsList>

        <TabsContent value="games">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.games.map((g) => (
              <ScoreCard key={g.id} match={g} teams={teamsMap} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="standings">
          <NbaStandings data={data} teamsMap={teamsMap} />
        </TabsContent>
      </Tabs>
    </SportShell>
  );
}

function NbaStandings({
  data,
  teamsMap,
}: {
  data: NbaData;
  teamsMap: Map<string, Team>;
}) {
  const [conf, setConf] = useState<NbaConference>("east");
  const rows = data.standings
    .filter((s) => s.conference === conf)
    .sort((a, b) => a.position - b.position);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Tabs value={conf} onValueChange={(v) => setConf(v as NbaConference)}>
          <TabsList variant="line">
            <TabsTrigger value="east">Eastern Conference</TabsTrigger>
            <TabsTrigger value="west">Western Conference</TabsTrigger>
          </TabsList>
        </Tabs>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-8 text-xs uppercase tracking-wide text-muted-foreground">
                #
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Team
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                W
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                L
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                PCT
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                GB
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                STRK
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                Last 10
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const team = teamsMap.get(row.teamId);
              const isLeader = row.position === 1;
              return (
                <TableRow key={row.teamId}>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {row.position}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {team && <TeamBadge team={team} size="sm" />}
                      <span className={cn("text-sm", isLeader && "font-semibold")}>
                        {team?.shortName ?? row.teamId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCellNum value={row.won} />
                  <TableCellNum value={row.lost} />
                  <TableCellNum value={row.winPct.toFixed(3)} />
                  <TableCellNum value={row.gamesBehind === 0 ? "—" : row.gamesBehind} />
                  <TableCellNum value={row.streak} />
                  <TableCellNum value={row.last10} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Eyebrow className="block text-[10px]">Blue = playoff seed · Bottom rows enter play-in</Eyebrow>
      </CardContent>
    </Card>
  );
}

function TableCellNum({ value }: { value: number | string }) {
  return (
    <TableCell className="text-center">
      <Mono className="text-sm tabular-nums">{value}</Mono>
    </TableCell>
  );
}
