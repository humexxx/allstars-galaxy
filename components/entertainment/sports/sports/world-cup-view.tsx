"use client";

import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow } from "@/components/ui/typography";
import type { FootballLeagueData, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { ScoreCard } from "../shared/score-card";
import { SportShell } from "../shared/sport-shell";
import { StandingsTable } from "../shared/standings-table";
import { TableCard } from "../shared/table-primitives";

type WorldCupViewProps = {
  data: FootballLeagueData;
};

export function WorldCupView({ data }: WorldCupViewProps) {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data],
  );

  const hasKnockout = !!data.knockout && data.knockout.length > 0;
  const hasGroups = !!data.groups && data.groups.length > 0;
  const defaultTab = hasKnockout ? "knockout" : "matches";

  return (
    <Tabs defaultValue={defaultTab} className="gap-6">
      <SportShell
        emoji="🏆"
        title={data.league.name}
        subtitle={`${data.league.region} · ${data.league.season}`}
        tabs={
          <TabsList>
            <TabsTrigger value="knockout" disabled={!hasKnockout}>
              Knockout
            </TabsTrigger>
            <TabsTrigger value="matches" disabled={data.matches.length === 0}>
              Matches
            </TabsTrigger>
            <TabsTrigger value="groups" disabled={!hasGroups}>
              Groups
            </TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="knockout">
          {hasKnockout && data.knockout ? (
            <Card size="sm">
              <CardContent>
                <KnockoutBracket rounds={data.knockout} teams={teamsMap} />
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="The knockout stage hasn't started yet." />
          )}
        </TabsContent>

        <TabsContent value="matches">
          {data.matches.length === 0 ? (
            <EmptyState title="No matches available yet." />
          ) : (
            <MatchesGrid data={data} teamsMap={teamsMap} />
          )}
        </TabsContent>

        <TabsContent value="groups">
          {hasGroups && data.groups ? (
            // Compact tables, two to a row only once a row can hold two: a
            // group is four teams and its points, and three full tables side
            // by side were each clipped before the points column.
            <div className="grid gap-4 @2xl:grid-cols-2">
              {data.groups.map((group) => (
                <div key={group.label} className="flex min-w-0 flex-col gap-2">
                  <Eyebrow size="sm">{group.label}</Eyebrow>
                  <TableCard>
                    <StandingsTable
                      standings={group.standings}
                      teams={teamsMap}
                      variant="compact"
                    />
                  </TableCard>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Group tables are not available." />
          )}
        </TabsContent>
      </SportShell>
    </Tabs>
  );
}

function MatchesGrid({
  data,
  teamsMap,
}: {
  data: FootballLeagueData;
  teamsMap: Map<string, Team>;
}) {
  const grouped = data.matches.reduce<Record<string, typeof data.matches>>(
    (acc, m) => {
      const key = m.stageLabel ?? "Matches";
      (acc[key] ??= []).push(m);
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(grouped).map(([label, group]) => (
        <div key={label} className="flex flex-col gap-2">
          <Eyebrow size="sm">{label}</Eyebrow>
          <div className="grid gap-2 @xl:grid-cols-2">
            {group.map((match) => (
              // The group heading already names the stage.
              <ScoreCard key={match.id} match={match} teams={teamsMap} hideStage />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
