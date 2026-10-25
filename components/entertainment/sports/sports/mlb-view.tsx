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
import { isBracketDrawn } from "@/lib/sports/bracket";
import { cn } from "@/lib/utils";
import type { MlbData, MlbDivision, MlbLeague, NewsStory, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { MatchesByDate } from "../shared/matches-by-date";
import { TeamNewsTab } from "../shared/news-list";
import { OverviewSplit } from "../shared/overview-split";
import { SportShell } from "../shared/sport-shell";
import { SportsTh, TableCellNum } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";
import { TeamPicksProvider } from "../shared/team-picks";
import { TeamPick } from "../shared/team-pick";

type MlbViewProps = {
  data: MlbData;
  /** ESPN's MLB news; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

const LEAGUE_NAMES: Record<MlbLeague, string> = {
  al: "American League",
  nl: "National League",
};

const DIVISIONS: readonly MlbDivision[] = ["al-east", "al-central", "al-west", "nl-east", "nl-central", "nl-west"];

const DIVISION_NAMES: Record<MlbDivision, string> = {
  "al-east": "AL East",
  "al-central": "AL Central",
  "al-west": "AL West",
  "nl-east": "NL East",
  "nl-central": "NL Central",
  "nl-west": "NL West",
};

/**
 * Four figures and a name in a third of the row: the figures keep tight
 * padding and the name gives way, to the club's code where the card is
 * narrow, rather than pushing the table past its card.
 */
const NUM_TH = "px-1 text-center";
const NUM_TD = "px-1";

/** Baseball's own way: ".578", and a perfect record "1.000". */
function formatPct(pct: number): string {
  return pct.toFixed(3).replace(/^0/, "");
}

/** A division leader is no games behind: a dash, as the papers print it. */
function formatGamesBehind(gamesBehind: number): string {
  return gamesBehind > 0 ? String(gamesBehind) : "—";
}

export function MlbView({ data, news = [], initialTab }: MlbViewProps): React.ReactElement {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );

  const hasPlayoffs = isBracketDrawn(data.playoffs);
  const opening = initialTab === "news" && news.length > 0 ? "news" : hasPlayoffs ? "postseason" : "overview";

  return (
    <Tabs defaultValue={opening} className="gap-6">
      <SportShell
        emoji={SPORTS_BY_ID.get("mlb")?.emoji ?? "⚾"}
        title="Baseball · MLB"
        subtitle={`Season ${data.season}`}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {/* Always there, locked until the Wild Card: where the bracket
                will be is worth knowing before it exists. */}
            <TabsTrigger value="postseason" disabled={!hasPlayoffs}>
              {!hasPlayoffs && <Lock aria-hidden />}
              Postseason
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
              table={data.standings.length > 0 && <MlbStandings data={data} teamsMap={teamsMap} />}
              tableLabel="Standings"
            />
          </TeamPicksProvider>
        </TabsContent>

        {hasPlayoffs && (
          <TabsContent value="postseason">
            <Card size="sm">
              <CardContent>
                <KnockoutBracket rounds={data.playoffs} teams={teamsMap} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Led by the teams picked in the games and each league's top two. */}
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

function MlbStandings({
  data,
  teamsMap,
}: {
  data: MlbData;
  teamsMap: Map<string, Team>;
}): React.ReactElement {
  const [league, setLeague] = useState<MlbLeague>("al");
  const rows = data.standings
    .filter((s) => s.league === league)
    .sort((a, b) => DIVISIONS.indexOf(a.division) - DIVISIONS.indexOf(b.division) || a.position - b.position);
  // Every row, not the hub's ten: a cut at ten would hide a division whole.
  const groups = DIVISIONS.map((division) => ({
    division,
    rows: rows.filter((r) => r.division === division),
  })).filter((g) => g.rows.length > 0);

  return (
    <Card size="sm">
      <CardContent className="@container flex flex-col gap-3">
        {/* A segmented control: both leagues share the one table below. */}
        <ToggleGroup
          type="single"
          size="sm"
          value={league}
          onValueChange={(v) => v && setLeague(v as MlbLeague)}
          aria-label="League"
        >
          <ToggleGroupItem value="al" aria-label={LEAGUE_NAMES.al}>
            AL
          </ToggleGroupItem>
          <ToggleGroupItem value="nl" aria-label={LEAGUE_NAMES.nl}>
            NL
          </ToggleGroupItem>
        </ToggleGroup>
        <Table aria-label={`${LEAGUE_NAMES[league]} standings`}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-8" label="Seed">
                #
              </SportsTh>
              <SportsTh>Team</SportsTh>
              <SportsTh className={NUM_TH} label="Wins">
                W
              </SportsTh>
              <SportsTh className={NUM_TH} label="Losses">
                L
              </SportsTh>
              <SportsTh className={NUM_TH} label="Winning percentage">
                PCT
              </SportsTh>
              <SportsTh className={NUM_TH} label="Games behind division leader">
                GB
              </SportsTh>
            </TableRow>
          </TableHeader>
          {/* By division, its leader first: GB counts from that leader, so
              only there does it read as a ladder. The seed stays in #. */}
          {groups.map((group) => (
            <TableBody key={group.division}>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="rowgroup" colSpan={6} className="h-8 text-xs font-medium text-muted-foreground">
                  {DIVISION_NAMES[group.division]}
                </TableHead>
              </TableRow>
              {group.rows.map((row) => {
                const team = teamsMap.get(row.teamId);
                const isLeader = row === group.rows[0];
                return (
                  <TableRow key={row.teamId} className="hover:bg-transparent">
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{row.position}</TableCell>
                    <TableHead scope="row" className="w-full max-w-0 font-normal text-foreground">
                      {team ? (
                        <TeamPick team={team} className="max-w-full">
                          <TeamBadge team={team} size="sm" />
                          {/* Too narrow for "Diamondbacks", the code, as the bracket has it. */}
                          <span className={cn("text-sm @sm:hidden", isLeader && "font-semibold")}>{team.code}</span>
                          <span
                            title={team.name}
                            className={cn("hidden truncate text-sm @sm:block", isLeader && "font-semibold")}
                          >
                            {team.shortName}
                          </span>
                        </TeamPick>
                      ) : (
                        row.teamId
                      )}
                    </TableHead>
                    <TableCellNum value={row.wins} className={NUM_TD} />
                    <TableCellNum value={row.losses} className={NUM_TD} />
                    <TableCellNum value={formatPct(row.pct)} className={NUM_TD} />
                    <TableCellNum value={formatGamesBehind(row.gamesBehind)} className={NUM_TD} />
                  </TableRow>
                );
              })}
            </TableBody>
          ))}
        </Table>
      </CardContent>
    </Card>
  );
}
