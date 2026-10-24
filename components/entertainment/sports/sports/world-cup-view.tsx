"use client";

import { useMemo, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow } from "@/components/ui/typography";
import type { FootballLeagueData, NewsStory, Team } from "@/types/sports";

import { ChampionCard } from "../shared/champion-card";
import { KnockoutBracket } from "../shared/knockout-bracket";
import { NewsTab } from "../shared/news-list";
import { SportShell } from "../shared/sport-shell";
import { StandingsTable } from "../shared/standings-table";
import { TableCard } from "../shared/table-primitives";

type WorldCupViewProps = {
  data: FootballLeagueData;
  /** Football's competition picker: the World Cup is one of its leagues. */
  controls?: ReactNode;
  /** ESPN's World Cup news; no News tab without any. */
  news?: NewsStory[];
  /** `?tab=news` asked for it. */
  openNews?: boolean;
};

export function WorldCupView({ data, controls, news = [], openNews = false }: WorldCupViewProps) {
  const teamsMap = useMemo(
    () => new Map<string, Team>(data.teams.map((t) => [t.id, t])),
    [data],
  );

  const hasKnockout = !!data.knockout && data.knockout.length > 0;
  const hasGroups = !!data.groups && data.groups.length > 0;
  // The groups, then the knockout, in the order they are played — and the
  // knockout to open on: it is what is decided last.
  const defaultTab = openNews ? "news" : hasKnockout ? "knockout" : "groups";
  // Once the final has a winner, who won it leads the page.
  const final = data.knockout?.find((r) => r.id === "final")?.matches.at(-1);

  return (
    <Tabs defaultValue={defaultTab} className="gap-6">
      <SportShell
        emoji="🏆"
        title={data.league.name}
        subtitle={`${data.league.region} · ${data.league.season}`}
        controls={controls}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="groups" disabled={!hasGroups}>
              Groups
            </TabsTrigger>
            <TabsTrigger value="knockout" disabled={!hasKnockout}>
              Knockout
            </TabsTrigger>
            {news.length > 0 && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        <div className="flex flex-col gap-4">
          {final?.winnerTeamId && (
            <ChampionCard
              competition={data.league.name}
              championId={final.winnerTeamId}
              final={final}
              teams={teamsMap}
            />
          )}
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

          {news.length > 0 && (
            <TabsContent value="news">
              <NewsTab stories={news} interest={{ names: [] }} />
            </TabsContent>
          )}
        </div>
      </SportShell>
    </Tabs>
  );
}
