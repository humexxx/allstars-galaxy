"use client";

import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Text } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import type { FootballLeagueData, FootballLeagueId, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { ScoreCard } from "../shared/score-card";
import { SportShell } from "../shared/sport-shell";
import { StandingsTable } from "../shared/standings-table";

type FootballViewProps = {
  leagues: FootballLeagueData[];
};

type TabKey = "overview" | "matches" | "table" | "knockout";

export function FootballView({ leagues }: FootballViewProps) {
  const [leagueId, setLeagueId] = useState<FootballLeagueId>(
    leagues[0]?.league.id ?? "uefa-champions-league",
  );

  const league = useMemo(
    () => leagues.find((l) => l.league.id === leagueId) ?? leagues[0],
    [leagues, leagueId],
  );

  const teamsMap = useMemo(
    () => new Map<string, Team>(league.teams.map((t) => [t.id, t])),
    [league],
  );

  const defaultTab: TabKey = league.league.hasKnockout ? "overview" : "table";

  return (
    <SportShell
      emoji="⚽"
      title={league.league.name}
      subtitle={`${league.league.region} · Season ${league.league.season}`}
      controls={
        <Select
          value={leagueId}
          onValueChange={(v) => setLeagueId(v as FootballLeagueId)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="League" />
          </SelectTrigger>
          <SelectContent>
            {leagues.map((l) => (
              <SelectItem key={l.league.id} value={l.league.id}>
                {l.league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Tabs defaultValue={defaultTab} className="space-y-5">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="matches" disabled={league.matches.length === 0}>
            Matches
          </TabsTrigger>
          <TabsTrigger value="table" disabled={league.standings.length === 0}>
            Table
          </TabsTrigger>
          {league.league.hasKnockout && (
            <TabsTrigger
              value="knockout"
              disabled={!league.knockout || league.knockout.length === 0}
            >
              Knockout
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <OverviewLayout
            matches={
              <MatchesGrid
                league={league}
                teamsMap={teamsMap}
                limit={6}
              />
            }
            standings={
              <Card>
                <CardContent className="p-0">
                  <StandingsTable
                    standings={league.standings.slice(0, 6)}
                    teams={teamsMap}
                  />
                </CardContent>
              </Card>
            }
          />
        </TabsContent>

        <TabsContent value="matches">
          {league.matches.length === 0 ? (
            <EmptyBlock message="No matches available yet." />
          ) : (
            <MatchesGrid league={league} teamsMap={teamsMap} />
          )}
        </TabsContent>

        <TabsContent value="table">
          {league.standings.length === 0 ? (
            <EmptyBlock message="No standings available yet." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <StandingsTable standings={league.standings} teams={teamsMap} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {league.league.hasKnockout && league.knockout && (
          <TabsContent value="knockout">
            <Card>
              <CardContent className="p-4">
                <KnockoutBracket rounds={league.knockout} teams={teamsMap} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </SportShell>
  );
}

function OverviewLayout({
  matches,
  standings,
}: {
  matches: React.ReactNode;
  standings: React.ReactNode;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-3">
        <Eyebrow>Matches</Eyebrow>
        {matches}
      </section>
      <section className="space-y-3">
        <Eyebrow>Table</Eyebrow>
        {standings}
      </section>
    </div>
  );
}

function MatchesGrid({
  league,
  teamsMap,
  limit,
}: {
  league: FootballLeagueData;
  teamsMap: Map<string, Team>;
  limit?: number;
}) {
  const matches = limit ? league.matches.slice(0, limit) : league.matches;
  const grouped = matches.reduce<Record<string, typeof matches>>((acc, m) => {
    const key = m.stageLabel ?? "Matches";
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([label, group]) => (
        <div key={label} className="space-y-2">
          <Eyebrow className="text-[10px]">{label}</Eyebrow>
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
