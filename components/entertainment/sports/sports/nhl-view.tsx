"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { roundInPlay } from "@/lib/sports/bracket";
import { splitSeasonLabel } from "@/lib/sports/season";
import type { NewsStory, NhlConference, NhlData, Team } from "@/types/sports";

import { LeagueView, StandingsTeamCell, useTeamsMap } from "../shared/league-view";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCellNum } from "../shared/table-primitives";

type NhlViewProps = {
  data: NhlData;
  /** ESPN's NHL news; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

const CONFERENCE_NAMES: Record<NhlConference, string> = {
  east: "Eastern Conference",
  west: "Western Conference",
};

/**
 * Five figures and a name in a third of the row: the figures keep tight
 * padding and the name gives way, cut short rather than pushing the table
 * past its card.
 */
const NUM_TH = "px-1 text-center";
const NUM_TD = "px-1";

export function NhlView({ data, news = [], initialTab }: NhlViewProps): React.ReactElement {
  const teamsMap = useTeamsMap(data.teams);
  return (
    <LeagueView
      sportId="nhl"
      title="Ice Hockey · NHL"
      subtitle={`Season ${splitSeasonLabel(data.season)}`}
      games={data.games}
      teams={teamsMap}
      standings={data.standings}
      playoffs={data.playoffs}
      bracketLabel="Playoffs"
      // The bracket leads while a series is on, and through the summer when
      // there are no games; a finished one waits behind its tab once the
      // season is back.
      opensOnBracket={roundInPlay(data.playoffs) !== undefined || data.games.length === 0}
      news={news}
      initialTab={initialTab}
      emptyTitle="No games scheduled right now."
      table={data.standings.length > 0 && <NhlStandings data={data} teamsMap={teamsMap} />}
    />
  );
}

function NhlStandings({
  data,
  teamsMap,
}: {
  data: NhlData;
  teamsMap: Map<string, Team>;
}): React.ReactElement {
  const [conference, setConference] = useState<NhlConference>("east");
  const rows = data.standings
    .filter((s) => s.conference === conference)
    .sort((a, b) => a.position - b.position);
  const shownRows = useShownRows(rows, conference);

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        {/* A segmented control: both conferences share the one table below. */}
        <ToggleGroup
          type="single"
          size="sm"
          value={conference}
          onValueChange={(v) => v && setConference(v as NhlConference)}
          aria-label="Conference"
        >
          <ToggleGroupItem value="east">East</ToggleGroupItem>
          <ToggleGroupItem value="west">West</ToggleGroupItem>
        </ToggleGroup>
        <Table aria-label={`${CONFERENCE_NAMES[conference]} standings`}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-8" label="Seed">#</SportsTh>
              <SportsTh>Team</SportsTh>
              <SportsTh className={NUM_TH} label="Games played">
                GP
              </SportsTh>
              <SportsTh className={NUM_TH} label="Wins">
                W
              </SportsTh>
              <SportsTh className={NUM_TH} label="Losses in regulation">
                L
              </SportsTh>
              <SportsTh className={NUM_TH} label="Overtime losses">
                OTL
              </SportsTh>
              <SportsTh className={NUM_TH} label="Points">
                PTS
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
                  <TableCellNum value={row.gamesPlayed} className={NUM_TD} />
                  <TableCellNum value={row.wins} className={NUM_TD} />
                  <TableCellNum value={row.losses} className={NUM_TD} />
                  <TableCellNum value={row.otLosses} className={NUM_TD} />
                  <TableCellNum value={row.points} className={NUM_TD} />
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
