"use client";

import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Text } from "@/components/ui/typography";
import type { FootballLeagueData, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { ScoreCard } from "../shared/score-card";
import { SportShell } from "../shared/sport-shell";
import { StandingsTable } from "../shared/standings-table";

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
    <Tabs defaultValue={defaultTab} className="space-y-6">
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
            <Card>
              <CardContent className="p-4">
                <KnockoutBracket rounds={data.knockout} teams={teamsMap} />
              </CardContent>
            </Card>
          ) : (
            <EmptyBlock message="The knockout stage hasn't started yet." />
          )}
        </TabsContent>

        <TabsContent value="matches">
          {data.matches.length === 0 ? (
            <EmptyBlock message="No matches available yet." />
          ) : (
            <MatchesGrid data={data} teamsMap={teamsMap} />
          )}
        </TabsContent>

        <TabsContent value="groups">
          {hasGroups && data.groups ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.groups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <Eyebrow className="text-2xs">{group.label}</Eyebrow>
                  <Card>
                    <CardContent className="p-0">
                      <StandingsTable
                        standings={group.standings}
                        teams={teamsMap}
                      />
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock message="Group tables are not available." />
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
    <div className="space-y-4">
      {Object.entries(grouped).map(([label, group]) => (
        <div key={label} className="space-y-2">
          <Eyebrow className="text-2xs">{label}</Eyebrow>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.map((match) => (
              <ScoreCard key={match.id} match={match} teams={teamsMap} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Text variant="muted">{message}</Text>
    </div>
  );
}
