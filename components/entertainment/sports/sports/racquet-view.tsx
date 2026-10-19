"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ListOrdered, Minus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mono, Text } from "@/components/ui/typography";
import { currentTournament, drawIsOut } from "@/lib/sports/racquet";
import { cn } from "@/lib/utils";
import type { RacquetData, RacquetTour, RacquetTournament } from "@/types/sports";

import { Portrait } from "../shared/portrait";
import { SportShell } from "../shared/sport-shell";
import { SportsTh, TableCard } from "../shared/table-primitives";
import { useSportsToday } from "../shared/time-zone-context";
import {
  drawKey,
  useRacquetDraws,
  type DrawState,
  type DrawVariant,
  type RacquetSport,
} from "./racquet-draw";
import { RacquetTournamentSheet } from "./racquet-tournament-sheet";
import { findTournament, RacquetCurrent, RacquetTournaments } from "./racquet-tournaments";

type TourTab = { value: string; label: string; data: RacquetData };

type RacquetViewProps = {
  /** Which provider's draws the sheet asks for, and how a tie is drawn. */
  sport: RacquetSport;
  emoji: string;
  title: string;
  subtitle: string;
  tours: TourTab[];
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

export function RacquetView({ sport, emoji, title, subtitle, tours }: RacquetViewProps) {
  const today = useSportsToday();
  const defaultTour = tours[0]?.value ?? "main";
  const [tourValue, setTourValue] = useState<string>(defaultTour);
  const activeTour = tours.find((t) => t.value === tourValue) ?? tours[0];
  const data = activeTour.data;
  const variant: DrawVariant = sport === "padel" ? "pair" : "player";

  const current = currentTournament(data.tournaments);
  const { draws, load } = useRacquetDraws(sport);
  // Which tournament the sheet shows outlives whether it is open, so the
  // sheet keeps its content while it slides away.
  const [opened, setOpened] = useState<{ tour: RacquetTour; id: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openedData = tours.find((t) => t.data.tour === opened?.tour)?.data;
  const openedTournament = opened && openedData ? findTournament(openedData, opened.id) : undefined;

  const drawFor = (t: RacquetTournament, tourData: RacquetData): DrawState => {
    if (t.bracket?.length) return shippedDraw(t, tourData);
    if (!drawIsOut(t.status, t.startDate, today)) return { status: "pending" };
    return draws[drawKey(tourData.tour, t.id)] ?? { status: "loading" };
  };

  // The feed ships the current draw when it can; when it could not (the
  // provider failed that refresh), Current asks for it like the sheet does,
  // instead of standing on an empty draw.
  const currentKey = current ? drawKey(data.tour, current.id) : null;
  const currentNeedsLoad =
    current !== undefined && !current.bracket?.length && drawIsOut(current.status, current.startDate, today);
  const currentKnown = currentKey ? draws[currentKey] : undefined;
  useEffect(() => {
    if (current && currentNeedsLoad && !currentKnown) load(data.tour, current.id);
  }, [current, currentNeedsLoad, currentKnown, data.tour, load]);
  const currentDraw: DrawState = current ? drawFor(current, data) : { status: "pending" };

  const openTournament = (id: string): void => {
    const t = findTournament(data, id);
    if (!t) return;
    setOpened({ tour: data.tour, id });
    setSheetOpen(true);
    const known = draws[drawKey(data.tour, id)];
    const needsLoad = !t.bracket?.length && drawIsOut(t.status, t.startDate, today);
    if (needsLoad && (!known || known.status === "error")) load(data.tour, id);
  };

  return (
    <Tabs defaultValue="current" className="gap-6">
      <SportShell
        emoji={emoji}
        title={title}
        subtitle={subtitle}
        controls={
          tours.length > 1 ? (
            <Select value={tourValue} onValueChange={setTourValue}>
              <SelectTrigger className="w-56" aria-label="Tour">
                <SelectValue placeholder="Tour" />
              </SelectTrigger>
              <SelectContent>
                {tours.map((tour) => (
                  <SelectItem key={tour.value} value={tour.value}>
                    {tour.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="current">Current</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="rankings">Rankings</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="current">
          <RacquetCurrent
            tournament={current}
            draw={currentDraw}
            variant={variant}
            onOpen={openTournament}
            onRetry={() => current && load(data.tour, current.id)}
          />
        </TabsContent>
        <TabsContent value="tournaments">
          <RacquetTournaments data={data} variant={variant} onOpen={openTournament} />
        </TabsContent>
        <TabsContent value="rankings">
          <RankingsTable data={data} />
        </TabsContent>
      </SportShell>
      <RacquetTournamentSheet
        tournament={openedTournament}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        draw={
          openedTournament && openedData
            ? drawFor(openedTournament, openedData)
            : { status: "pending" }
        }
        variant={variant}
        onRetry={() => opened && load(opened.tour, opened.id)}
      />
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

  if (data.rankings.length === 0) {
    return <EmptyState icon={ListOrdered} title="No rankings published for this tour yet." />;
  }

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
            {data.rankings.map((p, idx) => (
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
