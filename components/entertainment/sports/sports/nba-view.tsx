"use client";

import { useMemo, useState, type ReactElement } from "react";
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
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { NbaConference, NbaData, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { MatchesByDate } from "../shared/matches-by-date";
import { OverviewSplit } from "../shared/overview-split";
import { SportShell } from "../shared/sport-shell";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCellNum } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";
import { useMatchTime } from "../shared/time-zone-context";

type NbaViewProps = {
  data: NbaData;
};

export function NbaView({ data }: NbaViewProps) {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );
  // ESPN's table rides along with balldontlie's games; a table invented next
  // to real scores is worse than none, so without it the games fill the row.
  const hasStandings = data.standings.length > 0;
  const playoffs = data.playoffs ?? [];
  const hasPlayoffs = playoffs.length > 0;

  return (
    <Tabs defaultValue={hasPlayoffs ? "postseason" : "overview"} className="gap-6">
      <SportShell
        emoji="🏀"
        title="NBA"
        subtitle={`Season ${data.season}`}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {/* Always there, locked until the play-in week: where the bracket
                will be is worth knowing before it exists. */}
            <TabsTrigger value="postseason" disabled={!hasPlayoffs}>
              {!hasPlayoffs && <Lock aria-hidden />}
              Postseason
            </TabsTrigger>
          </TabsList>
        }
      >
        {/* Games and the table on one tab: day by day on the left, the
            conference table beside them. */}
        <TabsContent value="overview" className="flex flex-col gap-6">
          <SeasonNote data={data} teamsMap={teamsMap} hasStandings={hasStandings} />
          <OverviewSplit
            matches={
              <MatchesByDate
                matches={data.games}
                teams={teamsMap}
                emptyTitle="No games scheduled right now."
              />
            }
            table={hasStandings && <NbaStandings data={data} teamsMap={teamsMap} />}
            tableLabel="Standings"
          />
        </TabsContent>

        {hasPlayoffs && (
          <TabsContent value="postseason">
            <Card size="sm">
              <CardContent>
                <KnockoutBracket rounds={playoffs} teams={teamsMap} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
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
}) {
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
                GB
              </SportsTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shownRows.shown.map((row) => {
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
