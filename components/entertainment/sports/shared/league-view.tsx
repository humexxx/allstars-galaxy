"use client";

import { useMemo, type ReactNode } from "react";
import { Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { TableHead } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isBracketDrawn } from "@/lib/sports/bracket";
import { cn } from "@/lib/utils";
import type { BracketRound, Match, NewsStory, SportId, Team } from "@/types/sports";

import { KnockoutBracket } from "./knockout-bracket";
import { MatchesByDate } from "./matches-by-date";
import { TeamNewsTab } from "./news-list";
import { OverviewSplit } from "./overview-split";
import { SportShell } from "./sport-shell";
import { TeamBadge } from "./team-badge";
import { TeamPicksProvider } from "./team-picks";
import { TeamPick } from "./team-pick";

/** A view's teams by id, for the list, the table and the bracket to name them by. */
export function useTeamsMap(teams: readonly Team[]): Map<string, Team> {
  return useMemo(() => new Map<string, Team>(teams.map((t) => [t.id, t])), [teams]);
}

/**
 * A US league's page — the NFL, the NBA, MLB, the NHL: Overview (the games
 * day by day beside the sport's own table, a team tapped in either narrowing
 * the games to its own), the bracket, and News when there is any.
 *
 * The bracket's tab is always there, locked until somebody is drawn into it:
 * where the bracket will be is worth knowing before it exists. Once there is
 * one the view opens on it, unless the sport says otherwise (`opensOnBracket`).
 */
export function LeagueView({
  sportId,
  title,
  subtitle,
  games,
  teams,
  standings,
  playoffs,
  bracketLabel,
  opensOnBracket = true,
  news,
  initialTab,
  emptyTitle,
  table,
  lead,
}: {
  sportId: SportId;
  title: string;
  subtitle: string;
  games: Match[];
  /** `useTeamsMap`'s, shared with the view's own table. */
  teams: Map<string, Team>;
  /** Each table's top two lead the News, after the teams picked. */
  standings: ReadonlyArray<{ teamId: string; position: number }>;
  playoffs: BracketRound[];
  /** The bracket tab's name: "Playoffs", "Postseason". */
  bracketLabel: string;
  /** Whether a drawn bracket leads; it never does before it is drawn. */
  opensOnBracket?: boolean;
  news: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
  emptyTitle: string;
  /** The sport's standings, or nothing: the games then fill the row. */
  table: ReactNode;
  /** Above the split on the Overview (the NBA's note before tip-off). */
  lead?: ReactNode;
}): React.ReactElement {
  const hasPlayoffs = isBracketDrawn(playoffs);
  const hasNews = news.length > 0;
  const opening =
    initialTab === "news" && hasNews ? "news" : hasPlayoffs && opensOnBracket ? "bracket" : "overview";

  return (
    <Tabs defaultValue={opening} className="gap-6">
      <SportShell
        sportId={sportId}
        title={title}
        subtitle={subtitle}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bracket" disabled={!hasPlayoffs}>
              {!hasPlayoffs && <Lock aria-hidden />}
              {bracketLabel}
            </TabsTrigger>
            {hasNews && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        <TabsContent value="overview" className={cn(lead && "flex flex-col gap-6")}>
          {lead}
          <TeamPicksProvider matches={games}>
            <OverviewSplit
              matches={<MatchesByDate matches={games} teams={teams} emptyTitle={emptyTitle} />}
              table={table}
              tableLabel="Standings"
            />
          </TeamPicksProvider>
        </TabsContent>

        {hasPlayoffs && (
          <TabsContent value="bracket">
            <Card size="sm">
              <CardContent>
                <KnockoutBracket rounds={playoffs} teams={teams} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasNews && (
          <TabsContent value="news">
            <TeamNewsTab
              stories={news}
              teams={teams}
              leaders={standings.filter((s) => s.position <= 2).map((s) => s.teamId)}
            />
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
  );
}

/**
 * A standings row's header: the team's badge and name, a tap on them
 * narrowing the games to its own. The name takes what the figures leave and
 * gives way, cut short rather than pushing the table past its card; with
 * `codeWhenNarrow` it is the club's code until the card (an `@container`)
 * has room for the name.
 */
export function StandingsTeamCell({
  team,
  teamId,
  isLeader,
  codeWhenNarrow = false,
}: {
  team: Team | undefined;
  teamId: string;
  isLeader: boolean;
  codeWhenNarrow?: boolean;
}): React.ReactElement {
  const weight = isLeader && "font-semibold";
  return (
    <TableHead scope="row" className="w-full max-w-0 font-normal text-foreground">
      {team ? (
        <TeamPick team={team} className="max-w-full">
          <TeamBadge team={team} size="sm" />
          {codeWhenNarrow ? (
            <>
              <span className={cn("text-sm @sm:hidden", weight)}>{team.code}</span>
              <span title={team.name} className={cn("hidden truncate text-sm @sm:block", weight)}>
                {team.shortName}
              </span>
            </>
          ) : (
            <span className={cn("truncate text-sm", weight)}>{team.shortName}</span>
          )}
        </TeamPick>
      ) : (
        teamId
      )}
    </TableHead>
  );
}
