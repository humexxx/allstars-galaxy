"use client";

import { useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import type { SportId } from "@/types/sports";

import { SportHubControls } from "./shared/sport-shell";

const SPORT_IDS: ReadonlySet<string> = new Set(SPORTS_BY_ID.keys());

/**
 * Moves the hub to another sport or league inside the hub's own transition,
 * so the hub can show what is coming (`SportSkeleton`) instead of a spinner
 * beside the control that was used.
 */
export const SportsNavigationContext = createContext<(href: string) => void>(() => {});

export function useSportsNavigation(): (href: string) => void {
  return useContext(SportsNavigationContext);
}

/**
 * `SportShell`'s two rows while a page loads: the name row (tile, title,
 * subtitle) and the tabs over their rule. Inside the hub the name row ends on
 * the hub's own favourites and sport picker, usable while the page loads; a
 * route's `loading.tsx` has no hub, so it draws their places.
 */
export function ShellHeadSkeleton({ title = "w-44" }: { title?: "w-44" | "w-72" } = {}): React.ReactElement {
  const hubControls = useContext(SportHubControls);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4 @5xl:flex-nowrap">
        <div className="flex min-w-0 items-center gap-3" aria-hidden="true">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-col">
            <Skeleton className={cn("my-0.5 h-6 max-w-full", title)} />
            <Skeleton className="my-0.5 h-4 w-28" />
          </div>
        </div>
        {hubControls ? (
          <div className="flex max-w-full min-w-0 items-center gap-2">{hubControls}</div>
        ) : (
          <div className="flex max-w-full min-w-0 items-center gap-2" aria-hidden="true">
            <Skeleton className="size-9 shrink-0 rounded-full sm:size-8" />
            <Skeleton className="h-9 w-183 min-w-0 rounded-md sm:h-8" />
          </div>
        )}
      </div>
      <div className="flex h-12 items-end gap-4 border-b pb-2" aria-hidden="true">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
    </>
  );
}

/**
 * What a sport's page opens on, for its skeleton: days of match cards beside
 * a table; F1's race card and its standings; a racquet or surf tour's event
 * card, tiles and rankings; or a bracket under its champion.
 */
type Shape = "matches" | "f1" | "racquet" | "surf" | "bracket" | "news";

/** The table beside the matches: football's has its key, the US leagues a conference switch. */
type TableShape = { rows: 40 | 45 | 57; toggle?: "band" | "inset"; withKey?: boolean; rowCount?: number };

const TABLES: Partial<Record<SportId, TableShape>> = {
  football: { rows: 40, withKey: true },
  nba: { rows: 40, toggle: "inset" },
  nfl: { rows: 40, toggle: "inset" },
  nhl: { rows: 40, toggle: "inset" },
  mlb: { rows: 40, toggle: "inset" },
  lol: { rows: 40 },
  f1: { rows: 57, toggle: "band" },
  padel: { rows: 45 },
  tennis: { rows: 45 },
  surf: { rows: 40 },
};

/**
 * The shape by sport, and for the two whose page opens on a bracket for part
 * of the year by the month: MLB's postseason from October to the spring, and
 * League of Legends' Worlds knockouts in its last weeks. By the UTC month,
 * so the server and the browser draw the same one.
 */
export function sportShape(sport: SportId | undefined, tab?: string | null, now: Date = new Date()): Shape {
  if (tab === "news") return "news";
  const month = now.getUTCMonth();
  switch (sport) {
    case "f1":
      return "f1";
    case "padel":
    case "tennis":
      return "racquet";
    case "surf":
      return "surf";
    case "mlb":
      return month >= 9 || month <= 2 ? "bracket" : "matches";
    case "lol":
      return month >= 9 && month <= 10 ? "bracket" : "matches";
    default:
      return "matches";
  }
}

/**
 * One sport's page while it loads, laid out as `SportShell` is — the name
 * row, the tabs over their rule — then what the sport opens on (`sportShape`),
 * each part under a line set like a day heading, and beside it the table's
 * label and card as that sport draws it (`TABLES`). Inside the hub the name
 * row ends on the hub's own favourites and sport picker, usable while the
 * sport loads; the route's `loading.tsx` has no hub, and draws their places.
 */
export function SportSkeleton({ sport, tab }: { sport?: SportId; tab?: string | null } = {}): React.ReactElement {
  const shape = sportShape(sport, tab);
  const table = (sport && TABLES[sport]) ?? { rows: 40 };
  return (
    <div className="@container flex flex-col">
      <ShellHeadSkeleton />
      <div aria-hidden="true" className="pt-6">
        {shape === "news" ? (
          <NewsSkeleton />
        ) : shape === "bracket" ? (
          <BracketSkeleton />
        ) : (
          <div className="grid items-start gap-6 @4xl:grid-cols-[2fr_1fr]">
            <div className="flex min-w-0 flex-col gap-6">
              {shape === "f1" ? (
                <RaceSkeleton />
              ) : shape === "racquet" ? (
                <EventsSkeleton poster={sport === "padel"} />
              ) : shape === "surf" ? (
                <EventsSkeleton poster={false} tiles={4} />
              ) : (
                <MatchesSkeleton />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <HeadingLine className="w-20" />
              <TableSkeleton {...table} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A day heading's line: 22px, as `Eyebrow size="sm"` with `py-1`. */
function HeadingLine({ className }: { className?: string }): React.ReactElement {
  return (
    <div className="flex h-5.5 items-center">
      <Skeleton className={cn("h-3 w-40", className)} />
    </div>
  );
}

/** Two days of match cards, two across where there is room, as `MatchesByDate`. */
function MatchesSkeleton(): React.ReactElement {
  return (
    <>
      {[6, 4].map((count, day) => (
        <section key={day} className="flex flex-col gap-2">
          <HeadingLine className="w-48" />
          <div className="grid gap-2 @xl:grid-cols-2">
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton key={i} className="h-18 w-full rounded-lg" />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** F1: the race leading the page — its header and circuit, five sessions, "View details" — then the races to come. */
function RaceSkeleton(): React.ReactElement {
  return (
    <>
      <section className="flex flex-col gap-2">
        <HeadingLine className="w-24" />
        <Card>
          <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-5 @2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @2xl:gap-x-8">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="size-20 @2xl:row-span-3 @2xl:size-60 @2xl:place-self-center" />
            <Skeleton className="col-span-2 h-6 w-32 @2xl:col-span-1" />
            <div className="col-span-2 flex flex-col @2xl:col-span-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex h-10.5 items-center justify-between border-b last:border-b-0">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
            <div className="col-span-2 flex justify-end">
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </section>
      <TilesSkeleton count={2} height="h-28" />
    </>
  );
}

/**
 * A tour's event on now or next — padel's with its poster down the left, the
 * others text alone — then its tiles: the next one, the last one won.
 */
function EventsSkeleton({ poster, tiles = 1 }: { poster: boolean; tiles?: number }): React.ReactElement {
  return (
    <>
      <section className="flex flex-col gap-2">
        <HeadingLine className="w-20" />
        <Card className={cn("overflow-hidden", poster && "py-0 @xl:flex-row")}>
          {poster && <Skeleton className="aspect-video w-full rounded-none @xl:aspect-auto @xl:h-78 @xl:w-56" />}
          <CardContent className={cn("flex flex-1 flex-col gap-3", poster && "py-6")}>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-4 w-36" />
            {poster && <Skeleton className="h-4 w-28" />}
            <div className="mt-auto flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </section>
      {tiles === 1 ? (
        // What is coming up and the last one won, a tile each.
        <>
          <TilesSkeleton count={1} height="h-28" />
          <TilesSkeleton count={1} height="h-32" />
        </>
      ) : (
        <TilesSkeleton count={tiles} height="h-36" />
      )}
    </>
  );
}

function TilesSkeleton({ count, height }: { count: number; height: "h-28" | "h-32" | "h-36" }): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <HeadingLine className="w-24" />
      <div className="grid gap-3 @xl:grid-cols-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={cn("w-full rounded-lg", height)} />
        ))}
      </div>
    </section>
  );
}

/** A bracket under its champion's card: MLB's postseason, Worlds' knockouts. */
function BracketSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Card size="sm">
        <CardContent className="grid grid-cols-2 gap-4 @3xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col} className={cn("flex flex-col justify-around gap-4", col > 1 && "hidden @3xl:flex")}>
              <Skeleton className="h-3 w-20" />
              {Array.from({ length: col === 2 ? 1 : 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** The News tab (`NewsList`): the lead and two beside it, then the list. */
function NewsSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 @3xl:grid-cols-3">
        <Card className="gap-0 overflow-hidden py-0 @3xl:col-span-2">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4 @2xl:p-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-1 @3xl:grid-rows-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="gap-0 overflow-hidden py-0">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </Card>
          ))}
        </div>
      </div>
      <section className="flex flex-col gap-2">
        <HeadingLine className="w-24" />
        <div className="grid gap-x-8 @3xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 border-b py-3">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="aspect-video w-20 shrink-0 rounded-md sm:w-24" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const ROW_HEIGHT: Record<TableShape["rows"], string> = { 40: "h-10", 45: "h-11.25", 57: "h-14.25" };

/** A table card: its switch, header band, ten rows, the "Show more" line and, for football, its key. */
function TableSkeleton({ rows, toggle, withKey, rowCount = 10 }: TableShape): React.ReactElement {
  const body = (
    <>
      <div className="flex h-10 items-center border-b bg-muted/40 px-3">
        <Skeleton className="h-3 w-full" />
      </div>
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className={cn("flex items-center gap-3 border-b px-3", ROW_HEIGHT[rows])}>
          <Skeleton className={cn("shrink-0 rounded-full", rows === 57 ? "size-8" : "size-6")} />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-8" />
        </div>
      ))}
      <div className="flex h-10 items-center justify-center">
        <Skeleton className="h-3.5 w-24" />
      </div>
      {withKey && (
        <div className="flex h-8 items-center gap-3 border-t px-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      )}
    </>
  );
  if (toggle === "inset") {
    return (
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-8 w-32" />
          <div>{body}</div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="gap-0 py-0">
      {toggle === "band" && (
        <div className="flex h-14 items-center border-b px-4">
          <Skeleton className="h-8 w-44" />
        </div>
      )}
      {body}
    </Card>
  );
}

/**
 * The route's skeleton (`loading.tsx`), which has no hub to say what is
 * coming: the sport and tab are read off the address, as the page will.
 */
export function RouteSportSkeleton(): React.ReactElement {
  return (
    <Suspense fallback={<SportSkeleton />}>
      <AddressedSportSkeleton />
    </Suspense>
  );
}

function AddressedSportSkeleton(): React.ReactElement {
  const params = useSearchParams();
  const sport = params?.get("sport") ?? undefined;
  const id = sport === "worldcup" ? "football" : SPORT_IDS.has(sport as SportId) ? (sport as SportId) : undefined;
  return <SportSkeleton sport={id} tab={params?.get("tab")} />;
}
