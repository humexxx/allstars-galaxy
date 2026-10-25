"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import type { NewsStory, NflConference, NflData, Team } from "@/types/sports";

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

type NflViewProps = {
  data: NflData;
  /** ESPN's NFL news; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

export function NflView({ data, news = [], initialTab }: NflViewProps): React.ReactElement {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );

  const hasPlayoffs = data.playoffs.length > 0;
  const opening = initialTab === "news" && news.length > 0 ? "news" : hasPlayoffs ? "playoffs" : "overview";

  return (
    <Tabs defaultValue={opening} className="gap-6">
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
            {news.length > 0 && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        {/* The week's games and the table on one tab; a team tapped in either
            narrows the games to its own. */}
        <TabsContent value="overview">
          <TeamPicksProvider>
            <OverviewSplit
              matches={
                <MatchesByDate
                  matches={data.games}
                  teams={teamsMap}
                  emptyTitle="No games this week."
                />
              }
              table={<NflStandings data={data} teamsMap={teamsMap} />}
              tableLabel="Standings"
            />
          </TeamPicksProvider>
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

        {/* Led by the teams picked in the week's games and each conference's top two. */}
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
