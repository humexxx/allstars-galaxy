"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mono, Text } from "@/components/ui/typography";
import { tournamentPath } from "@/lib/sports/paths";
import { currentTournament, drawIsOut, featuredTournament, seasonOf } from "@/lib/sports/racquet";
import { cn } from "@/lib/utils";
import type {
  DrawState,
  DrawVariant,
  NewsStory,
  RacquetData,
  RacquetSport,
  RacquetTournament,
} from "@/types/sports";

import { NewsTab } from "../shared/news-list";
import { OverviewSplit } from "../shared/overview-split";
import { Portrait } from "../shared/portrait";
import { SportShell } from "../shared/sport-shell";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCard } from "../shared/table-primitives";
import { useSportsToday } from "../shared/time-zone-context";
import { useRacquetDraws } from "./racquet-draw";
import { RacquetOverview } from "./racquet-tournaments";

type RacquetViewProps = {
  /** Which provider's draws the view asks for, and how a tie is drawn. */
  sport: RacquetSport;
  emoji: string;
  title: string;
  subtitle: string;
  /** The men's tour: the hub follows no women's tour. */
  data: RacquetData;
  /** The tour's news (tennis's, from ESPN); padel has none. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

/** A draw the feed shipped with the page: the featured and the current tournament's. */
function shippedDraw(t: RacquetTournament, data: RacquetData): DrawState {
  return {
    status: "ready",
    draw: {
      tournamentId: t.id,
      rounds: t.bracket ?? [],
      players: data.drawPlayers ?? [],
      champion: t.champion,
      runnerUp: t.runnerUp,
    },
  };
}

/**
 * Padel and tennis: Overview (the tournament on now or next beside the
 * rankings, the season under it) and, with news, News. Every tournament
 * opens on its own page, its whole draw there.
 */
export function RacquetView({ sport, emoji, title, subtitle, data, news, initialTab }: RacquetViewProps) {
  const today = useSportsToday();
  const hasNews = (news?.length ?? 0) > 0;
  const variant: DrawVariant = sport === "padel" ? "pair" : "player";

  // Every tournament being played, and the one picked of them. The Overview
  // features it, else the first, else the next to start.
  const onNow = data.tournaments.filter((t) => t.status === "live");
  const [picked, setPicked] = useState<string | null>(null);
  const pickedLive = onNow.find((t) => t.id === picked);
  const current = pickedLive ?? currentTournament(data.tournaments);
  const featured =
    pickedLive ?? featuredTournament(data.tournaments) ?? featuredTournament(seasonOf(data));
  const { draws, load } = useRacquetDraws(sport);

  // The feed ships the current draw when it can; when it could not (the
  // provider failed that refresh), the view asks for it, for the round under
  // way and the seeds, instead of standing on an empty draw.
  const currentNeedsLoad =
    current !== undefined && !current.bracket?.length && drawIsOut(current.status, current.startDate, today);
  const currentKnown = current ? draws[current.id] : undefined;
  useEffect(() => {
    if (current && currentNeedsLoad && !currentKnown) load(current.id);
  }, [current, currentNeedsLoad, currentKnown, load]);
  const currentDraw: DrawState | undefined = !current
    ? undefined
    : current.bracket?.length
      ? shippedDraw(current, data)
      : (currentKnown ?? (currentNeedsLoad ? { status: "loading" } : { status: "pending" }));

  return (
    <Tabs defaultValue={initialTab === "news" && hasNews ? "news" : "overview"} className="gap-6">
      <SportShell
        emoji={emoji}
        title={title}
        subtitle={subtitle}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {hasNews && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        {/* As F1's Overview: the tournament on now (else the next) and the
            season around it, the tour's rankings beside them. A tour with no
            rankings published leaves the tournaments the whole row. */}
        <TabsContent value="overview">
          <OverviewSplit
            matches={
              <RacquetOverview
                data={data}
                featured={featured}
                draw={featured && featured.id === current?.id && currentDraw?.status === "ready" ? currentDraw.draw : undefined}
                variant={variant}
                today={today}
                onNow={onNow}
                onPick={setPicked}
                hrefFor={(id) => tournamentPath(sport, id)}
              />
            }
            table={data.rankings.length > 0 && <RankingsTable data={data} />}
            tableLabel="Rankings"
          />
        </TabsContent>

        {/* The tour's news, led by its top five players and the tournament featured. */}
        {hasNews && (
          <TabsContent value="news">
            <NewsTab
              stories={news ?? []}
              interest={{
                names: data.rankings.slice(0, 5).map((p) => p.shortName.split(" ").slice(-1)[0] ?? ""),
                places: featured ? [featured.name, featured.location] : [],
              }}
            />
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
  );
}

function RankingsTable({ data }: { data: RacquetData }) {
  // Padel's provider reports no week-on-week movement, so the column was a
  // stack of "— 0" down the whole table. A column that never says anything is
  // better left out than filled with a placeholder.
  const showsMovement = data.rankings.some((p) => p.movement !== 0);
  // Without a single photo the table keeps its flags, in a slot only as wide
  // as a flag.
  const showsFaces = data.rankings.some((p) => p.photoUrl);
  const rows = useShownRows(data.rankings);

  return (
    <TableCard>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-12 pl-3">
                Rank
              </SportsTh>
              <SportsTh>
                Player
              </SportsTh>
              <SportsTh className="text-right">
                Points
              </SportsTh>
              {showsMovement ? (
                <SportsTh className="text-center">
                  Move
                </SportsTh>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.shown.map((p, idx) => (
              <TableRow key={`${p.position}-${p.name}-${idx}`}>
                <TableCell className="pl-3 text-sm tabular-nums text-muted-foreground">
                  {p.position}
                </TableCell>
                <TableCell>
                  <div className={cn("flex items-center", showsFaces ? "gap-2 sm:gap-2.5" : "gap-2.5")}>
                    {showsFaces ? (
                      <Portrait
                        size="table"
                        subject={{ name: p.shortName, imageUrl: p.photoUrl, flagEmoji: p.flagEmoji }}
                        fallback={<span className="text-base leading-none">{p.flagEmoji}</span>}
                      />
                    ) : (
                      <span aria-hidden className="text-base leading-none">{p.flagEmoji}</span>
                    )}
                    <Text as="span" weight="medium">{p.shortName}</Text>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Mono className="text-sm font-semibold">{p.points.toLocaleString("en-US")}</Mono>
                </TableCell>
                {showsMovement ? (
                  <TableCell className="text-center">
                    <Movement movement={p.movement} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ShowMoreRows rows={rows} className="border-t py-1" />
    </TableCard>
  );
}

function Movement({ movement }: { movement: number }) {
  if (movement === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" aria-hidden /> 0
      </span>
    );
  }
  if (movement > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success">
        <ArrowUp className="size-3" aria-label="Up" /> {movement}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-destructive">
      <ArrowDown className="size-3" aria-label="Down" /> {Math.abs(movement)}
    </span>
  );
}
