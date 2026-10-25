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
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { isBracketDrawn, roundInPlay } from "@/lib/sports/bracket";
import { splitSeasonLabel } from "@/lib/sports/season";
import { cn } from "@/lib/utils";
import type { NewsStory, NhlConference, NhlData, Team } from "@/types/sports";

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
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );

  const hasPlayoffs = isBracketDrawn(data.playoffs);
  // The bracket leads while a series is on, and through the summer when there
  // are no games; a finished one waits behind its tab once the season is back.
  const bracketFirst = hasPlayoffs && (roundInPlay(data.playoffs) !== undefined || data.games.length === 0);
  const opening = initialTab === "news" && news.length > 0 ? "news" : bracketFirst ? "playoffs" : "overview";

  return (
    <Tabs defaultValue={opening} className="gap-6">
      <SportShell
        emoji={SPORTS_BY_ID.get("nhl")?.emoji ?? "🏒"}
        title="Ice Hockey · NHL"
        subtitle={`Season ${splitSeasonLabel(data.season)}`}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {/* Always there, locked until the first round: where the bracket
                will be is worth knowing before it exists. */}
            <TabsTrigger value="playoffs" disabled={!hasPlayoffs}>
              {!hasPlayoffs && <Lock aria-hidden />}
              Playoffs
            </TabsTrigger>
            {news.length > 0 && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        {/* The days' games and the table on one tab; a team tapped in either
            narrows the games to its own. */}
        <TabsContent value="overview">
          <TeamPicksProvider>
            <OverviewSplit
              matches={
                <MatchesByDate
                  matches={data.games}
                  teams={teamsMap}
                  emptyTitle="No games scheduled right now."
                />
              }
              table={data.standings.length > 0 && <NhlStandings data={data} teamsMap={teamsMap} />}
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
                  <TableHead scope="row" className="w-full max-w-0 font-normal text-foreground">
                    {team ? (
                      <TeamPick team={team} className="max-w-full">
                        <TeamBadge team={team} size="sm" />
                        <span className={cn("truncate text-sm", isLeader && "font-semibold")}>{team.shortName}</span>
                      </TeamPick>
                    ) : (
                      row.teamId
                    )}
                  </TableHead>
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
