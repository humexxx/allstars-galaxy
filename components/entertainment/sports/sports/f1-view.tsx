"use client";

import { useState } from "react";

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
import type { F1Constructor, F1Data, F1Driver, F1NewsArticle } from "@/types/sports";

import { F1Races } from "../f1-races";
import { NewsList } from "../shared/news-list";
import { Portrait } from "../shared/portrait";
import { SportShell } from "../shared/sport-shell";
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
          <F1Races data={data} />
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
