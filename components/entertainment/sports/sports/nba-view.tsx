"use client";

import { useMemo, useState } from "react";
import { CalendarX } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { NbaConference, NbaData, Team } from "@/types/sports";

import { ScoreCard } from "../shared/score-card";
import { SportShell } from "../shared/sport-shell";
import { SportsTh, TableCellNum } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";

type NbaViewProps = {
  data: NbaData;
};

export function NbaView({ data }: NbaViewProps) {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );
  const hasStandings = data.standings.length > 0;
  const played = useMemo(
    () => data.games.filter((g) => g.status !== "scheduled"),
    [data.games]
  );
  const upcoming = useMemo(
    () => data.games.filter((g) => g.status === "scheduled"),
    [data.games]
  );

  return (
    <Tabs defaultValue="games" className="gap-6">
      <SportShell
        emoji="🏀"
        title="NBA"
        subtitle={`Season ${data.season}`}
        tabs={
          <TabsList>
            <TabsTrigger value="games">Games</TabsTrigger>
            {/* balldontlie's free tier does not serve /standings, and a table
                invented next to real scores is worse than no table. */}
            {hasStandings && <TabsTrigger value="standings">Standings</TabsTrigger>}
          </TabsList>
        }
      >
        <TabsContent value="games">
          {data.games.length === 0 ? (
            <EmptyState icon={CalendarX} title="No games scheduled right now." />
          ) : (
            /* Split, not one undifferentiated grid: out of season the list is
               half finished finals and half fixtures months away, and the two
               were rendering as the same thing. */
            <div className="flex flex-col gap-6">
              {([
                ["Results", played],
                ["Upcoming", upcoming],
              ] as const).map(([label, list]) =>
                list.length === 0 ? null : (
                  <section key={label} className="flex flex-col gap-2">
                    <Eyebrow>{label}</Eyebrow>
                    <div className="grid gap-2 @xl:grid-cols-2">
                      {list.map((g) => (
                        <ScoreCard key={g.id} match={g} teams={teamsMap} />
                      ))}
                    </div>
                  </section>
                )
              )}
            </div>
          )}
        </TabsContent>

        {hasStandings && (
          <TabsContent value="standings">
            <NbaStandings data={data} teamsMap={teamsMap} />
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
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
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        {/* A segmented control: both conferences share the one table below. */}
        <ToggleGroup
          type="single"
          size="sm"
          value={conf}
          onValueChange={(v) => v && setConf(v as NbaConference)}
          aria-label="Conference"
        >
          <ToggleGroupItem value="east">Eastern Conference</ToggleGroupItem>
          <ToggleGroupItem value="west">Western Conference</ToggleGroupItem>
        </ToggleGroup>
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
                PCT
              </SportsTh>
              <SportsTh className="text-center">
                GB
              </SportsTh>
              <SportsTh className="text-center">
                STRK
              </SportsTh>
              <SportsTh className="text-center">
                Last 10
              </SportsTh>
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
      </CardContent>
    </Card>
  );
}
