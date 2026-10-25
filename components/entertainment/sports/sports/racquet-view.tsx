"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { getRacquetDrawAction } from "@/app/actions/racquet";
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
import { drawVariant, featuredTournament, seasonOf, shippedDraw } from "@/lib/sports/racquet";
import { cn } from "@/lib/utils";
import { racquetDrawSchema } from "@/schemas/racquet";
import type { NewsStory, RacquetData, RacquetDraw, RacquetSport } from "@/types/sports";

import { NewsTab } from "../shared/news-list";
import { OverviewSplit } from "../shared/overview-split";
import { Portrait } from "../shared/portrait";
import { SportShell } from "../shared/sport-shell";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCard } from "../shared/table-primitives";
import { useSportsToday } from "../shared/time-zone-context";
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

/** A draw asked for: what came back, or where the asking stands. */
type AskedDraw = RacquetDraw | "loading" | "failed" | "unavailable";

/**
 * The draws asked for so far, by tournament, and the call that loads one: the
 * featured tournament's, when the feed could not ship it.
 *
 * Each is asked for once in the life of the view, whatever came back — the
 * server caches too, but each miss there spends a provider's daily budget.
 */
function useRacquetDraws(sport: RacquetSport): {
  drawOf: (tournamentId: string) => RacquetDraw | undefined;
  load: (tournamentId: string) => void;
} {
  const [draws, setDraws] = useState<Record<string, AskedDraw>>({});
  const asked = useRef(new Set<string>());

  const load = useCallback(
    (tournamentId: string): void => {
      if (asked.current.has(tournamentId)) return;
      asked.current.add(tournamentId);
      const set = (state: AskedDraw): void => setDraws((prev) => ({ ...prev, [tournamentId]: state }));
      // The schema the action applies, checked here first: the fixture's ids
      // ("wpt-m-rome") would only come back refused.
      const request = racquetDrawSchema.safeParse({ sport, tournamentId });
      if (!request.success) {
        set("unavailable");
        return;
      }
      set("loading");
      getRacquetDrawAction(request.data)
        .then((result): AskedDraw => (result.success ? result.data : "failed"))
        .catch((): AskedDraw => "failed")
        .then(set);
    },
    [sport]
  );

  const drawOf = useCallback(
    (tournamentId: string): RacquetDraw | undefined => {
      const known = draws[tournamentId];
      return typeof known === "object" ? known : undefined;
    },
    [draws]
  );

  return { drawOf, load };
}

/**
 * Padel and tennis: Overview (the tournament on now or next beside the
 * rankings, the season under it) and, with news, News. Every tournament
 * opens on its own page, its whole draw there.
 */
export function RacquetView({
  sport,
  emoji,
  title,
  subtitle,
  data,
  news,
  initialTab,
}: RacquetViewProps): React.ReactElement {
  const today = useSportsToday();
  const hasNews = (news?.length ?? 0) > 0;
  const variant = drawVariant(sport);

  // Every tournament being played, and the one picked of them. The Overview
  // features it, else the first, else the next to start.
  const onNow = data.tournaments.filter((t) => t.status === "live");
  const [picked, setPicked] = useState<string | null>(null);
  const featured =
    onNow.find((t) => t.id === picked) ??
    featuredTournament(data.tournaments) ??
    featuredTournament(seasonOf(data));
  const { drawOf, load } = useRacquetDraws(sport);

  // The feed ships the featured draw once it can exist. A live one it could
  // not ship (the provider failed that refresh, or it was picked from several
  // on now) the view asks for, for the round under way and the seeds. An
  // upcoming one is left to the feed, which reads it and finds it empty until
  // it is drawn: asking again would only repeat that.
  const shipped = featured && shippedDraw(featured, data.drawPlayers ?? []);
  const toLoad = featured?.status === "live" && !shipped ? featured.id : undefined;
  useEffect(() => {
    if (toLoad) load(toLoad);
  }, [toLoad, load]);
  const draw = shipped ?? (toLoad ? drawOf(toLoad) : undefined);

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
                draw={draw}
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
        <Table aria-label="Rankings">
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
      <span className="inline-flex items-center gap-0.5 text-xs font-medium">
        <ArrowUp className="size-3 text-success" aria-hidden />
        <span className="sr-only">Up </span>
        {movement}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium">
      <ArrowDown className="size-3 text-destructive" aria-hidden />
      <span className="sr-only">Down </span>
      {Math.abs(movement)}
    </span>
  );
}
