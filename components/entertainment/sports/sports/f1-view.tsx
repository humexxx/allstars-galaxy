"use client";

import { Trophy } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatWeekdayDayYear } from "@/lib/utils/date";
import type { F1Constructor, F1Data, F1Driver, F1NewsArticle, F1Race } from "@/types/sports";

import { F1CircuitOutline } from "../f1-circuit-outline";
import { NewsList } from "../shared/news-list";
import { Portrait } from "../shared/portrait";
import { SportShell } from "../shared/sport-shell";
import { StatusPill } from "../shared/status-pill";
import { SportsTh, TableCard } from "../shared/table-primitives";

type F1ViewProps = {
  data: F1Data;
  /** Stored F1 news, newest first. Empty hides the tab. */
  news?: F1NewsArticle[];
  /** `?tab=news` — the article page's "All news" link lands on the wire. */
  initialTab?: string;
};

const TABS = ["standings", "races", "news"] as const;
type F1Tab = (typeof TABS)[number];
type Championship = "drivers" | "constructors";

// Narrow on a phone, so Podiums is on screen without a sideways scroll.
const NUM = "px-1 text-right sm:px-2";

/**
 * Where `?tab=` opens the view. Drivers and Constructors were tabs of their
 * own before they shared Standings, and a link to either still lands on its
 * table.
 */
function openingView(
  initialTab: string | undefined,
  hasNews: boolean
): { tab: F1Tab; championship: Championship } {
  if (initialTab === "drivers" || initialTab === "constructors") {
    return { tab: "standings", championship: initialTab };
  }
  const tab = TABS.find((t) => t === initialTab) ?? "standings";
  return { tab: tab === "news" && !hasNews ? "standings" : tab, championship: "drivers" };
}

export function F1View({ data, news = [], initialTab }: F1ViewProps) {
  const opening = openingView(initialTab, news.length > 0);
  const [championship, setChampionship] = useState<Championship>(opening.championship);

  return (
    <Tabs defaultValue={opening.tab} className="gap-6">
      <SportShell
        emoji="🏎️"
        title="Formula 1"
        subtitle={`${data.season} Season`}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="races">Races</TabsTrigger>
            {news.length > 0 && <TabsTrigger value="news">News</TabsTrigger>}
          </TabsList>
        }
      >
        <TabsContent value="standings">
          <TableCard>
            {/* A segmented control, not two more tabs: both championships
                are the one table with its rows swapped. */}
            <div className="border-b px-4 py-3">
              <ToggleGroup
                type="single"
                size="sm"
                value={championship}
                onValueChange={(v) => v && setChampionship(v as Championship)}
                aria-label="Championship"
              >
                <ToggleGroupItem value="drivers">Drivers</ToggleGroupItem>
                <ToggleGroupItem value="constructors">Constructors</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {championship === "drivers" ? (
              <DriversTable drivers={data.drivers} />
            ) : (
              <ConstructorsTable constructors={data.constructors} />
            )}
          </TableCard>
        </TabsContent>

        <TabsContent value="races">
          <div className="grid gap-2 @xl:grid-cols-2 @4xl:grid-cols-3">
            {data.races.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        </TabsContent>

        {news.length > 0 && (
          <TabsContent value="news">
            <NewsList items={news} />
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
  );
}

function DriversTable({ drivers }: { drivers: F1Driver[] }) {
  // Faces come from ESPN. Without them the table keeps its flags, in a slot
  // only as wide as a flag.
  const showsFaces = drivers.some((d) => d.imageUrl);
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <SportsTh className="w-8 pl-3">#</SportsTh>
          <SportsTh>Driver</SportsTh>
          <SportsTh className={NUM}>Points</SportsTh>
          <SportsTh className={NUM}>Wins</SportsTh>
          <SportsTh className={cn(NUM, "pr-3 sm:pr-4")}>Podiums</SportsTh>
        </TableRow>
      </TableHeader>
      <TableBody>
        {drivers.map((d) => (
          <TableRow key={d.code}>
            <TableCell className="pl-3 text-sm tabular-nums text-muted-foreground">
              {d.position}
            </TableCell>
            <TableCell>
              <div className={cn("flex items-center", showsFaces ? "gap-2 sm:gap-3" : "gap-3")}>
                {showsFaces ? (
                  <Portrait
                    size="table"
                    subject={{ name: d.shortName, imageUrl: d.imageUrl, flagUrl: d.flagUrl }}
                    fallback={<span className="text-base leading-none">{d.flagEmoji}</span>}
                  />
                ) : (
                  <span className="text-base leading-none">{d.flagEmoji}</span>
                )}
                <div className="leading-tight">
                  <Text as="div" weight="medium">{d.shortName}</Text>
                  <Text variant="small" as="div">{d.team}</Text>
                </div>
              </div>
            </TableCell>
            <TableCell className={NUM}>
              <Mono className="text-sm font-semibold">{d.points}</Mono>
            </TableCell>
            <TableCell className={NUM}>
              <Mono className="text-sm">{d.wins}</Mono>
            </TableCell>
            <TableCell className={cn(NUM, "pr-3 sm:pr-4")}>
              <Mono className="text-sm">{d.podiums}</Mono>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ConstructorsTable({ constructors }: { constructors: F1Constructor[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <SportsTh className="w-8 pl-3">#</SportsTh>
          <SportsTh>Team</SportsTh>
          <SportsTh className={NUM}>Points</SportsTh>
          <SportsTh className={NUM}>Wins</SportsTh>
          <SportsTh className={cn(NUM, "pr-3 sm:pr-4")}>Podiums</SportsTh>
        </TableRow>
      </TableHeader>
      <TableBody>
        {constructors.map((c) => (
          <TableRow key={c.name}>
            <TableCell className="pl-3 text-sm tabular-nums text-muted-foreground">
              {c.position}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2 sm:gap-3">
                {/* The logo, or the livery for a team with none
                    published yet — the dashboard's badge. */}
                <Portrait
                  size="table"
                  subject={{ name: c.shortName, logoUrl: c.logoUrl, color: c.primaryColor }}
                />
                {/* The short name, as the drivers table labels the
                    team: with the logo beside it, "Cadillac F1
                    Team" pushed Podiums off a phone's screen. */}
                <Text as="span" weight="medium">{c.shortName}</Text>
              </div>
            </TableCell>
            <TableCell className={NUM}>
              <Mono className="text-sm font-semibold">{c.points}</Mono>
            </TableCell>
            <TableCell className={NUM}>
              <Mono className="text-sm">{c.wins}</Mono>
            </TableCell>
            <TableCell className={cn(NUM, "pr-3 sm:pr-4")}>
              <Mono className="text-sm">{c.podiums}</Mono>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RaceCard({ race }: { race: F1Race }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-xl leading-none">{race.flagEmoji}</span>
            <div className="leading-tight">
              <Text variant="small" as="div">
                Round {race.round}
              </Text>
              <Text as="div" weight="semibold">{race.name}</Text>
            </div>
          </div>
          <StatusPill status={race.status} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Text variant="small" as="div">
              {race.circuit} · {race.location}
            </Text>
            {/* A calendar day: only the YYYY-MM-DD part, read local. */}
            <Mono className="block text-xs text-muted-foreground">
              {formatWeekdayDayYear(race.date.slice(0, 10))}
            </Mono>
          </div>
          <F1CircuitOutline circuitId={race.circuitId} className="size-12 text-muted-foreground" />
        </div>
        {race.podium && (
          <div className="mt-1 flex items-center gap-2 border-t pt-2 text-xs">
            <Trophy className="size-3.5 text-warning" aria-label="Podium" />
            <Mono className="font-medium">{race.podium[0]}</Mono>
            <span className="text-muted-foreground">·</span>
            <Mono>{race.podium[1]}</Mono>
            <span className="text-muted-foreground">·</span>
            <Mono>{race.podium[2]}</Mono>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
