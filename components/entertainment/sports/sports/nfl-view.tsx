"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { NflConference, NflData, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { MatchesByDate } from "../shared/matches-by-date";
import { OverviewSplit } from "../shared/overview-split";
import { SportShell } from "../shared/sport-shell";
import { SportsTh, TableCellNum } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";

type NflViewProps = {
  data: NflData;
};

export function NflView({ data }: NflViewProps): React.ReactElement {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );

  const hasPlayoffs = data.playoffs.length > 0;

  return (
    <Tabs defaultValue={hasPlayoffs ? "playoffs" : "overview"} className="gap-6">
      <SportShell
        emoji="🏈"
        title="American Football · NFL"
        subtitle={`Season ${data.season}`}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {/* Always there, locked until the postseason: where the bracket
                will be is worth knowing before it exists. */}
            <TabsTrigger value="playoffs" disabled={!hasPlayoffs}>
              {!hasPlayoffs && <Lock aria-hidden />}
              Playoffs
            </TabsTrigger>
          </TabsList>
        }
      >
        {/* The week's games and the table on one tab. */}
        <TabsContent value="overview">
          <OverviewSplit
            matches={
              <MatchesByDate
                matches={data.games}
                teams={teamsMap}
                label="Games"
                emptyTitle="No games this week."
              />
            }
            table={<NflStandings data={data} teamsMap={teamsMap} />}
            tableLabel="Standings"
          />
        </TabsContent>

        {hasPlayoffs && (
          <TabsContent value="playoffs">
            <Card size="sm">
              <CardContent>
                <KnockoutBracket rounds={data.playoffs} teams={teamsMap} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
  );
}

function NflStandings({
  data,
  teamsMap,
}: {
  data: NflData;
  teamsMap: Map<string, Team>;
}): React.ReactElement {
  const [conf, setConf] = useState<NflConference>("afc");
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
          onValueChange={(v) => v && setConf(v as NflConference)}
          aria-label="Conference"
        >
          <ToggleGroupItem value="afc">AFC</ToggleGroupItem>
          <ToggleGroupItem value="nfc">NFC</ToggleGroupItem>
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
                T
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
                  <TableCellNum value={row.wins} />
                  <TableCellNum value={row.losses} />
                  <TableCellNum value={row.ties} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
