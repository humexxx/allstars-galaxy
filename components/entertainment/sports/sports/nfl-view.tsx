"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { NewsStory, NflConference, NflData, Team } from "@/types/sports";

import { LeagueView, StandingsTeamCell, useTeamsMap } from "../shared/league-view";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCellNum } from "../shared/table-primitives";

type NflViewProps = {
  data: NflData;
  /** ESPN's NFL news; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

export function NflView({ data, news = [], initialTab }: NflViewProps): React.ReactElement {
  const teamsMap = useTeamsMap(data.teams);
  return (
    <LeagueView
      sportId="nfl"
      title="American Football · NFL"
      subtitle={`Season ${data.season}`}
      games={data.games}
      teams={teamsMap}
      standings={data.standings}
      playoffs={data.playoffs}
      bracketLabel="Playoffs"
      news={news}
      initialTab={initialTab}
      emptyTitle="No games this week."
      table={<NflStandings data={data} teamsMap={teamsMap} />}
    />
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
  const shownRows = useShownRows(rows, conf);

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
        <Table aria-label={`${conf.toUpperCase()} standings`}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-8" label="Seed">
                #
              </SportsTh>
              <SportsTh>
                Team
              </SportsTh>
              <SportsTh className="text-center" label="Wins">
                W
              </SportsTh>
              <SportsTh className="text-center" label="Losses">
                L
              </SportsTh>
              <SportsTh className="text-center" label="Ties">
                T
              </SportsTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shownRows.shown.map((row) => {
              const team = teamsMap.get(row.teamId);
              const isLeader = row.position === 1;
              return (
                <TableRow key={row.teamId} className="hover:bg-transparent">
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {row.position}
                  </TableCell>
                  <StandingsTeamCell team={team} teamId={row.teamId} isLeader={isLeader} />
                  <TableCellNum value={row.wins} />
                  <TableCellNum value={row.losses} />
                  <TableCellNum value={row.ties} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ShowMoreRows rows={shownRows} />
      </CardContent>
    </Card>
  );
}
