"use client";

import { useState, type ReactElement } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Text } from "@/components/ui/typography";
import type { NbaConference, NbaData, NewsStory, Team } from "@/types/sports";

import { LeagueView, StandingsTeamCell, useTeamsMap } from "../shared/league-view";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCellNum } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";
import { useMatchTime } from "../shared/time-zone-context";

type NbaViewProps = {
  data: NbaData;
  /** ESPN's NBA news; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

export function NbaView({ data, news = [], initialTab }: NbaViewProps): React.ReactElement {
  const teamsMap = useTeamsMap(data.teams);
  // ESPN's table rides along with balldontlie's games; a table invented next
  // to real scores is worse than none, so without it the games fill the row.
  const hasStandings = data.standings.length > 0;
  return (
    <LeagueView
      sportId="nba"
      title="NBA"
      subtitle={`Season ${data.season}`}
      games={data.games}
      teams={teamsMap}
      standings={data.standings}
      playoffs={data.playoffs ?? []}
      bracketLabel="Postseason"
      news={news}
      initialTab={initialTab}
      emptyTitle="No games scheduled right now."
      lead={<SeasonNote data={data} teamsMap={teamsMap} hasStandings={hasStandings} />}
      table={hasStandings && <NbaStandings data={data} teamsMap={teamsMap} />}
    />
  );
}

/**
 * Until the opener: who won last season, when this one tips off and, with no
 * table yet, when there will be one. Gone from the first regular-season game,
 * when the season's own results and table take over.
 */
function SeasonNote({
  data,
  teamsMap,
  hasStandings,
}: {
  data: NbaData;
  teamsMap: Map<string, Team>;
  hasStandings: boolean;
}): ReactElement | null {
  const format = useMatchTime();
  if (!data.tipOff) return null;
  const { champion } = data;
  const team = champion ? teamsMap.get(champion.teamId) : undefined;
  const detail = [
    `Tips off ${format.weekdayDay(data.tipOff)}`,
    !hasStandings && "Standings start with the opener",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        {team && <TeamBadge team={team} size="lg" />}
        <div className="flex min-w-0 flex-col gap-0.5">
          {champion && (
            <Text weight="medium">
              {champion.season} champions: {champion.summary}
            </Text>
          )}
          <Text variant="small">{detail}</Text>
        </div>
      </CardContent>
    </Card>
  );
}

function NbaStandings({
  data,
  teamsMap,
}: {
  data: NbaData;
  teamsMap: Map<string, Team>;
}): ReactElement {
  const [conf, setConf] = useState<NbaConference>("east");
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
          onValueChange={(v) => v && setConf(v as NbaConference)}
          aria-label="Conference"
        >
          <ToggleGroupItem value="east">East</ToggleGroupItem>
          <ToggleGroupItem value="west">West</ToggleGroupItem>
        </ToggleGroup>
        <Table aria-label={`${conf === "east" ? "Eastern" : "Western"} Conference standings`}>
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
              <SportsTh className="text-center" label="Games behind">
                GB
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
                  <TableCellNum value={row.won} />
                  <TableCellNum value={row.lost} />
                  <TableCellNum value={row.gamesBehind === 0 ? "—" : row.gamesBehind} />
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
