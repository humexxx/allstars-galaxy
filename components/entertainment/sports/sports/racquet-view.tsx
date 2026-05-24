"use client";

import { ArrowDown, ArrowUp, Minus, Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { RacquetData } from "@/types/sports";

import { SportShell } from "../shared/sport-shell";

type TourTab = { value: string; label: string; data: RacquetData };

type RacquetViewProps = {
  emoji: string;
  title: string;
  subtitle: string;
  tours: TourTab[];
};

export function RacquetView({ emoji, title, subtitle, tours }: RacquetViewProps) {
  const defaultTour = tours[0]?.value ?? "main";
  return (
    <SportShell emoji={emoji} title={title} subtitle={subtitle}>
      <Tabs defaultValue={defaultTour} className="space-y-5">
        <TabsList>
          {tours.map((tour) => (
            <TabsTrigger key={tour.value} value={tour.value}>
              {tour.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tours.map((tour) => (
          <TabsContent key={tour.value} value={tour.value} className="space-y-5">
            <Tabs defaultValue="rankings">
              <TabsList variant="line">
                <TabsTrigger value="rankings">Rankings</TabsTrigger>
                <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
              </TabsList>
              <TabsContent value="rankings" className="mt-3">
                <RankingsTable data={tour.data} />
              </TabsContent>
              <TabsContent value="tournaments" className="mt-3">
                <TournamentsList data={tour.data} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </SportShell>
  );
}

function RankingsTable({ data }: { data: RacquetData }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-12 text-xs uppercase tracking-wide text-muted-foreground">
                Rank
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Player
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Points
              </TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                Move
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rankings.map((p) => (
              <TableRow key={p.position}>
                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  {p.position}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{p.flagEmoji}</span>
                    <span className="text-sm font-medium">{p.shortName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Mono className="text-sm font-semibold">{p.points.toLocaleString()}</Mono>
                </TableCell>
                <TableCell className="text-center">
                  <Movement movement={p.movement} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Movement({ movement }: { movement: number }) {
  if (movement === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  if (movement > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
        <ArrowUp className="h-3 w-3" /> {movement}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-600">
      <ArrowDown className="h-3 w-3" /> {Math.abs(movement)}
    </span>
  );
}

function TournamentsList({ data }: { data: RacquetData }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {data.tournaments.map((t) => (
        <Card key={t.id} size="sm">
          <CardContent className="space-y-2 py-1">
            <div className="flex items-start justify-between gap-2">
              <div className="leading-tight">
                <Eyebrow className="text-[10px]">{t.surface ?? "Tour"}</Eyebrow>
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.location}</div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  t.status === "completed" && "bg-muted text-muted-foreground",
                  t.status === "upcoming" &&
                    "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                  t.status === "live" &&
                    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                )}
              >
                {t.status}
              </span>
            </div>
            <Mono className="block text-xs text-muted-foreground">
              {formatRange(t.startDate, t.endDate)}
            </Mono>
            {t.champion && (
              <div className="flex items-center gap-2 border-t pt-2 text-xs">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium">{t.champion}</span>
                {t.runnerUp && (
                  <>
                    <span className="text-muted-foreground">def.</span>
                    <span className="text-muted-foreground">{t.runnerUp}</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (sameMonth) {
    return `${s.toLocaleDateString(undefined, opts)} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}, ${e.getFullYear()}`;
}
