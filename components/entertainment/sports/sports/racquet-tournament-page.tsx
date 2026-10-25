"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { sportPath } from "@/lib/sports/paths";
import { drawVariant, playLine, topSeeds, tourLine } from "@/lib/sports/racquet";
import type { DrawState, RacquetSport, RacquetTournament, SportId } from "@/types/sports";

import { SportShell } from "../shared/sport-shell";
import { StatusPill } from "../shared/status-pill";
import { SportPageControls } from "../sport-page-controls";
import { DrawBody } from "./racquet-draw";
import { TournamentCard, TournamentFacts } from "./racquet-tournaments";

/**
 * One padel or tennis tournament on a page of its own, laid out as the
 * sport's page is: the same name row, the favourites and the sport picker
 * at its end, its title a breadcrumb back to the sport ("Padel › Kuwait
 * Major 2026"). Two tabs: the Bracket, which it opens on, the whole draw the
 * width of the page; and the Overview, a card with the poster, the facts
 * (the champions among them, once there are some) and the three best seeds.
 *
 * The draw comes with the page (read on the server); one that failed is
 * asked for again by refreshing the page.
 */
export function RacquetTournamentPage({
  sport,
  tournament: t,
  draw,
  today,
  season,
  favoriteSportIds,
  initialTab,
}: {
  sport: RacquetSport;
  tournament: RacquetTournament;
  draw: DrawState;
  /** The reader's today, for "Starts in 5 days". */
  today: string;
  /** The tour's season, for the line under the sport's name. */
  season: number;
  favoriteSportIds: SportId[];
  /** `?tab=overview` opens on the Overview. */
  initialTab?: string;
}): React.ReactElement {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const meta = SPORTS_BY_ID.get(sport);
  const variant = drawVariant(sport);
  const ready = draw.status === "ready" ? draw.draw : undefined;
  const champion = ready?.champion ?? t.champion;
  const runnerUp = ready?.runnerUp ?? t.runnerUp;
  const now = playLine(t, ready?.rounds, today);
  const kinds = [t.tier, t.surface].filter((k): k is string => Boolean(k));

  return (
    <SportPageControls sport={sport} favoriteSportIds={favoriteSportIds}>
      <Tabs defaultValue={initialTab === "overview" ? "overview" : "bracket"} className="gap-6">
        <SportShell
          emoji={meta?.emoji}
          title={t.name}
          subtitle={tourLine(sport, season)}
          parent={{ label: meta?.label ?? sport, href: sportPath(sport) }}
          tabs={
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
            </TabsList>
          }
        >
          <TabsContent value="overview">
            <TournamentCard tournament={t} seeds={ready ? topSeeds(ready) : []} variant={variant}>
              {(corner) => (
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {kinds.map((kind) => (
                        <Badge key={kind} variant="outline">
                          {kind}
                        </Badge>
                      ))}
                      <StatusPill status={t.status} />
                    </div>
                    {corner}
                  </div>
                  <TournamentFacts tournament={{ ...t, champion, runnerUp }} variant={variant} />
                  {now && (
                    <Text as="p" weight="medium">
                      {now}
                    </Text>
                  )}
                </div>
              )}
            </TournamentCard>
          </TabsContent>
          <TabsContent value="bracket">
            <DrawBody
              tournament={t}
              state={draw}
              variant={variant}
              retrying={retrying}
              onRetry={() => startRetry(() => router.refresh())}
            />
          </TabsContent>
        </SportShell>
      </Tabs>
    </SportPageControls>
  );
}
