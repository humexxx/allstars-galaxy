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
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { NflConference, NflData, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { ScoreCard } from "../shared/score-card";
import { SportShell } from "../shared/sport-shell";
import { TeamBadge } from "../shared/team-badge";

type NflViewProps = {
  data: NflData;
};

export function NflView({ data }: NflViewProps) {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );

  return (
    <SportShell
      emoji="🏈"
      title="American Football · NFL"
      subtitle={`Season ${data.season}`}
    >
      <Tabs defaultValue="games" className="space-y-5">
        <TabsList>
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
        </TabsList>

        <TabsContent value="games">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.games.map((g) => (
              <ScoreCard key={g.id} match={g} teams={teamsMap} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="standings">
          <NflStandings data={data} teamsMap={teamsMap} />
        </TabsContent>

        <TabsContent value="playoffs">
          <Card>
            <CardContent className="p-4">
              <KnockoutBracket rounds={data.playoffs} teams={teamsMap} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SportShell>
  );
}

function NflStandings({
  data,
  teamsMap,
}: {
  data: NflData;
  teamsMap: Map<string, Team>;
}) {
  const [conf, setConf] = useState<NflConference>("afc");
  const rows = data.standings
    .filter((s) => s.conference === conf)
    .sort((a, b) => a.position - b.position);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Tabs value={conf} onValueChange={(v) => setConf(v as NflConference)}>
          <TabsList variant="line">
            <TabsTrigger value="afc">AFC</TabsTrigger>
            <TabsTrigger value="nfc">NFC</TabsTrigger>
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
                T
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                PCT
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                PF
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                PA
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                STRK
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
                  <TableCellNum value={row.wins} />
                  <TableCellNum value={row.losses} />
                  <TableCellNum value={row.ties} />
                  <TableCellNum value={row.pct.toFixed(3)} />
                  <TableCellNum value={row.pointsFor} />
                  <TableCellNum value={row.pointsAgainst} />
                  <TableCellNum value={row.streak} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
