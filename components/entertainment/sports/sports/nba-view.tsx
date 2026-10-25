"use client";

import { useMemo, useState, type ReactElement } from "react";
import { Lock } from "lucide-react";

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { NbaConference, NbaData, NewsStory, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { MatchesByDate } from "../shared/matches-by-date";
import { TeamNewsTab } from "../shared/news-list";
import { OverviewSplit } from "../shared/overview-split";
import { SportShell } from "../shared/sport-shell";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCellNum } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";
import { TeamPicksProvider } from "../shared/team-picks";
import { TeamPick } from "../shared/team-pick";
import { useMatchTime } from "../shared/time-zone-context";

type NbaViewProps = {
  data: NbaData;
  /** ESPN's NBA news; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

export function NbaView({ data, news = [], initialTab }: NbaViewProps) {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );
  // ESPN's table rides along with balldontlie's games; a table invented next
  // to real scores is worse than none, so without it the games fill the row.
  const hasStandings = data.standings.length > 0;
  const playoffs = data.playoffs ?? [];
  const hasPlayoffs = playoffs.length > 0;
  const opening = initialTab === "news" && news.length > 0 ? "news" : hasPlayoffs ? "postseason" : "overview";

  return (
    <Tabs defaultValue={opening} className="gap-6">
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
            {news.length > 0 && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        {/* Games and the table on one tab: day by day on the left, the
            conference table beside them. */}
        <TabsContent value="overview" className="flex flex-col gap-6">
          <SeasonNote data={data} teamsMap={teamsMap} hasStandings={hasStandings} />
          {/* A team tapped in the table or a game narrows the games to its own. */}
          <TeamPicksProvider>
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
          </TeamPicksProvider>
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

        {/* Led by the teams picked in the games and each conference's top two. */}
        {news.length > 0 && (
          <TabsContent value="news">
            <TeamNewsTab
              stories={news}
              teams={teamsMap}
              leaders={data.standings.filter((s) => s.position <= 2).map((s) => s.teamId)}
            />
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
        <Table aria-label={`${conf === "east" ? "Eastern" : "Western"} Conference standings`}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-8">
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
                  <TableHead scope="row" className="font-normal text-foreground">
                    {team ? (
                      <TeamPick team={team}>
                        <TeamBadge team={team} size="sm" />
                        <span className={cn("text-sm", isLeader && "font-semibold")}>{team.shortName}</span>
                      </TeamPick>
                    ) : (
                      row.teamId
                    )}
                  </TableHead>
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
