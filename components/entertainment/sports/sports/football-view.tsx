"use client";

import { useMemo } from "react";

import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { FootballLeagueData, FootballLeagueId, NewsStory, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { MatchesByDate } from "../shared/matches-by-date";
import { TeamNewsTab } from "../shared/news-list";
import { OverviewSplit } from "../shared/overview-split";
import { SportShell } from "../shared/sport-shell";
import { StandingsTable } from "../shared/standings-table";
import { TableCard } from "../shared/table-primitives";
import { useSportsNavigation } from "../sports-navigation";
import { WorldCupView } from "./world-cup-view";

type FootballViewProps = {
  league: FootballLeagueData;
  options: ReadonlyArray<{ id: FootballLeagueId; name: string }>;
  /** ESPN's news for the league; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

type TabKey = "overview" | "knockout" | "news";

/**
 * One competition, picked through the URL (`?league=`) rather than client
 * state: the page fetches only the one on screen, so a refresh keeps it, Back
 * returns to the last one, and a link can point at one.
 *
 * The World Cup is one of them, laid out as the tournament it is: a bracket,
 * fixtures and group tables rather than a season's single table.
 */
export function FootballView({ league, options, news = [], initialTab }: FootballViewProps): React.ReactElement {
  const leagues = <LeagueMenu leagueId={league.league.id} options={options} />;
  const openNews = initialTab === "news" && news.length > 0;
  return league.league.id === "world-cup" ? (
    <WorldCupView data={league} leagues={leagues} news={news} openNews={openNews} />
  ) : (
    <LeagueView league={league} leagues={leagues} news={news} openNews={openNews} />
  );
}

/** The competitions, under the title: picking one loads it in the hub's own transition. */
function LeagueMenu({
  leagueId,
  options,
}: {
  leagueId: FootballLeagueId;
  options: FootballViewProps["options"];
}): React.ReactElement {
  const navigate = useSportsNavigation();
  return (
    <DropdownMenuRadioGroup
      value={leagueId}
      onValueChange={(v) => v !== leagueId && navigate(`?sport=football&league=${v}`)}
    >
      {options.map((o) => (
        <DropdownMenuRadioItem key={o.id} value={o.id}>
          {o.name}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

function LeagueView({
  league,
  leagues,
  news,
  openNews,
}: {
  league: FootballLeagueData;
  leagues: React.ReactNode;
  news: NewsStory[];
  openNews: boolean;
}): React.ReactElement {
  const leagueId = league.league.id;

  const teamsMap = useMemo(
    () => new Map<string, Team>(league.teams.map((t) => [t.id, t])),
    [league],
  );

  const hasKnockoutData = !!league.knockout && league.knockout.length > 0;
  const defaultTab: TabKey = openNews ? "news" : hasKnockoutData ? "knockout" : "overview";

  return (
    // Keyed by league: leagues differ in which tabs exist (a knockout or not),
    // and an uncontrolled Tabs keeps its old value when the active trigger
    // unmounts — switching UCL→La Liga stranded the view on a blank "knockout"
    // tab. Remounting re-resolves defaultTab for the new league.
    <Tabs key={leagueId} defaultValue={defaultTab} className="gap-6">
      <SportShell
        emoji="⚽"
        title={league.league.name}
        subtitle={`${league.league.region} · Season ${league.league.season}`}
        titleMenu={leagues}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {league.league.hasKnockout && (
              <TabsTrigger value="knockout" disabled={!hasKnockoutData}>
                Knockout
              </TabsTrigger>
            )}
            {news.length > 0 && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        {/* Every match day by day, and the whole table beside them: a Table
            tab of its own only repeated it with more columns. */}
        <TabsContent value="overview">
          <OverviewSplit
            matches={<MatchesByDate matches={league.matches} teams={teamsMap} />}
            table={
              league.standings.length > 0 && (
                <TableCard>
                  <StandingsTable
                    standings={league.standings}
                    teams={teamsMap}
                    competition={leagueId}
                    label={league.league.name}
                  />
                </TableCard>
              )
            }
          />
        </TabsContent>

        {league.league.hasKnockout && league.knockout && (
          <TabsContent value="knockout">
            <Card size="sm">
              <CardContent>
                <KnockoutBracket rounds={league.knockout} teams={teamsMap} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Led by the teams picked in the matches and the table's top three. */}
        {news.length > 0 && (
          <TabsContent value="news">
            <TeamNewsTab
              stories={news}
              teams={teamsMap}
              leaders={league.standings.filter((s) => s.position <= 3).map((s) => s.teamId)}
            />
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
  );
}
