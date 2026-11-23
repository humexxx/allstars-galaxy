"use client";

import { useMemo, useState } from "react";

import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  FootballClubMatches,
  FootballGroupStandings,
  FootballLeagueData,
  FootballLeagueId,
  Match,
  NewsStory,
  Team,
} from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { useTeamsMap } from "../shared/league-view";
import { MatchesByDate } from "../shared/matches-by-date";
import { TeamNewsTab } from "../shared/news-list";
import { OverviewSplit } from "../shared/overview-split";
import { SportShell } from "../shared/sport-shell";
import { StandingsTable } from "../shared/standings-table";
import { TableCard } from "../shared/table-primitives";
import { TeamPicksProvider, useTeamPicks } from "../shared/team-picks";
import { useSportsNavigation } from "../sports-navigation";
import { WorldCupView } from "./world-cup-view";

type FootballViewProps = {
  league: FootballLeagueData;
  options: ReadonlyArray<{ id: FootballLeagueId; name: string }>;
  /** ESPN's news for the league; no News tab without any. */
  news?: NewsStory[];
  /** The clubs last picked in the match list, in every competition they play in. */
  clubs?: FootballClubMatches | null;
  /** `?tab=`: the tab to open on, when the league has it. */
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
export function FootballView({ league, options, news = [], clubs, initialTab }: FootballViewProps): React.ReactElement {
  const leagues = <LeagueMenu leagueId={league.league.id} options={options} />;
  return league.league.id === "world-cup" ? (
    <WorldCupView data={league} leagues={leagues} news={news} initialTab={initialTab} />
  ) : (
    <LeagueView league={league} leagues={leagues} news={news} clubs={clubs ?? null} initialTab={initialTab} />
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
  clubs,
  initialTab,
}: {
  league: FootballLeagueData;
  leagues: React.ReactNode;
  news: NewsStory[];
  clubs: FootballClubMatches | null;
  initialTab?: string;
}): React.ReactElement {
  const leagueId = league.league.id;

  const teamsMap = useTeamsMap(league.teams);

  const hasKnockoutData = !!league.knockout && league.knockout.length > 0;
  // A league played in conferences (MLS) shows one at a time; its
  // `standings` is the league-wide table, which leads the news.
  const conferences = league.groups && league.groups.length > 1 ? league.groups : null;
  const asked: TabKey | null =
    initialTab === "news" && news.length > 0
      ? "news"
      : initialTab === "knockout" && hasKnockoutData
        ? "knockout"
        : initialTab === "overview"
          ? "overview"
          : null;
  const defaultTab: TabKey = asked ?? (hasKnockoutData ? "knockout" : "overview");

  return (
    // Keyed by league: leagues differ in which tabs exist (a knockout or not),
    // and an uncontrolled Tabs keeps its old value when the active trigger
    // unmounts — switching UCL→La Liga stranded the view on a blank "knockout"
    // tab. Remounting re-resolves defaultTab for the new league.
    <Tabs key={leagueId} defaultValue={defaultTab} className="gap-6">
      <SportShell
        sportId="football"
        title={league.league.name}
        subtitle={`${league.league.region} · Season ${league.league.season}`}
        titleMenu={leagues}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {league.league.hasKnockout && hasKnockoutData && <TabsTrigger value="knockout">Knockout</TabsTrigger>}
            {news.length > 0 && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        {/* Every match day by day, and the whole table beside them: a Table
            tab of its own only repeated it with more columns. A club tapped
            in either narrows the matches to its own, in every competition. */}
        <TabsContent value="overview">
          <TeamPicksProvider matches={league.matches}>
            <OverviewSplit
              matches={<LeagueMatches matches={league.matches} teams={teamsMap} clubs={clubs} />}
              table={
                conferences ? (
                  <ConferenceStandings
                    groups={conferences}
                    teams={teamsMap}
                    competition={leagueId}
                    label={league.league.name}
                  />
                ) : (
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
                )
              }
            />
          </TeamPicksProvider>
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

/** The same teams, whatever order they were picked in. */
function sameTeams(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
}

/**
 * The league's match days, or with clubs picked their games in every
 * competition they play in, each led by its competition. Those arrive with
 * the page's refresh after a pick saves (`clubs`), for the clubs it saved:
 * until they match the clubs picked, the list is the league's own games.
 * The filter keeps offering the league's clubs alone.
 */
function LeagueMatches({
  matches,
  teams,
  clubs,
}: {
  matches: Match[];
  teams: Map<string, Team>;
  clubs: FootballClubMatches | null;
}): React.ReactElement {
  const { picks } = useTeamPicks();
  const own = useMemo(() => new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])), [matches]);
  const picked = picks.filter((id) => own.has(id));
  const across = clubs && picked.length > 0 && sameTeams(picked, clubs.teamIds) ? clubs : null;

  const listed = useMemo((): Match[] => {
    if (!across) return matches;
    const ids = new Set(across.matches.map((m) => m.id));
    return [...across.matches, ...matches.filter((m) => !ids.has(m.id))];
  }, [across, matches]);
  const named = useMemo(
    (): Map<string, Team> => (across ? new Map([...across.teams.map((t) => [t.id, t] as const), ...teams]) : teams),
    [across, teams]
  );

  return <MatchesByDate matches={listed} teams={named} filterTeamIds={across ? own : undefined} />;
}

/**
 * One conference's table at a time, picked by a segmented control above it
 * as the NBA's is: side by side, two fifteen-club tables would run twice the
 * height of the matches beside them.
 */
function ConferenceStandings({
  groups,
  teams,
  competition,
  label,
}: {
  groups: FootballGroupStandings[];
  teams: Map<string, Team>;
  competition: FootballLeagueId;
  label: string;
}): React.ReactElement {
  const [shown, setShown] = useState(groups[0].label);
  const group = groups.find((g) => g.label === shown) ?? groups[0];
  return (
    <TableCard>
      <div className="border-b px-3 py-2">
        <ToggleGroup
          type="single"
          size="sm"
          value={group.label}
          onValueChange={(v) => v && setShown(v)}
          aria-label="Conference"
        >
          {groups.map((g) => (
            <ToggleGroupItem key={g.label} value={g.label}>
              {g.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {/* Keyed, so another conference opens on its first ten again. */}
      <StandingsTable
        key={group.label}
        standings={group.standings}
        teams={teams}
        competition={competition}
        label={`${label}, ${group.label}`}
      />
    </TableCard>
  );
}
