"use client";

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TableCard } from "../shared/table-primitives";
import type { FootballLeagueData, FootballLeagueId, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { MatchesByDate } from "../shared/matches-by-date";
import { OverviewSplit } from "../shared/overview-split";
import { SportShell } from "../shared/sport-shell";
import { StandingsTable } from "../shared/standings-table";
import { useSportsNavigation } from "../sports-navigation";
import { WorldCupView } from "./world-cup-view";

type FootballViewProps = {
  league: FootballLeagueData;
  options: ReadonlyArray<{ id: FootballLeagueId; name: string }>;
};

type TabKey = "overview" | "knockout";

/**
 * One competition, picked through the URL (`?league=`) rather than client
 * state: the page fetches only the one on screen, so a refresh keeps it, Back
 * returns to the last one, and a link can point at one.
 *
 * The World Cup is one of them, laid out as the tournament it is: a bracket,
 * fixtures and group tables rather than a season's single table.
 */
export function FootballView({ league, options }: FootballViewProps): React.ReactElement {
  const picker = <LeaguePicker leagueId={league.league.id} options={options} />;
  return league.league.id === "world-cup" ? (
    <WorldCupView data={league} controls={picker} />
  ) : (
    <LeagueView league={league} picker={picker} />
  );
}

function LeaguePicker({
  leagueId,
  options,
}: {
  leagueId: FootballLeagueId;
  options: FootballViewProps["options"];
}): React.ReactElement {
  // The hub's own transition: while the league loads, the hub shows a
  // skeleton of it.
  const navigate = useSportsNavigation();
  return (
    <div className="flex items-center gap-2">
      <Select
        value={leagueId}
        onValueChange={(v) => navigate(`?sport=football&league=${v as FootballLeagueId}`)}
      >
        <SelectTrigger className="w-56" aria-label="League">
          <SelectValue placeholder="League" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LeagueView({
  league,
  picker,
}: {
  league: FootballLeagueData;
  picker: React.ReactNode;
}): React.ReactElement {
  const leagueId = league.league.id;

  const teamsMap = useMemo(
    () => new Map<string, Team>(league.teams.map((t) => [t.id, t])),
    [league],
  );

  const hasKnockoutData = !!league.knockout && league.knockout.length > 0;
  const defaultTab: TabKey = hasKnockoutData ? "knockout" : "overview";

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
        controls={picker}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {league.league.hasKnockout && (
              <TabsTrigger value="knockout" disabled={!hasKnockoutData}>
                Knockout
              </TabsTrigger>
            )}
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
                  <StandingsTable standings={league.standings} teams={teamsMap} variant="compact" />
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
      </SportShell>
    </Tabs>
  );
}
