"use client";

import { useMemo } from "react";
import Link, { useLinkStatus } from "next/link";
import { Info, Star } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/data/sports/registry";
import { SAMPLE_DATA_SPORTS, type SportPayload } from "@/lib/sports/payload";
import type { SportId, SportMeta } from "@/types/sports";

import { F1View } from "./sports/f1-view";
import { FootballView } from "./sports/football-view";
import { LolView } from "./sports/lol-view";
import { NbaView } from "./sports/nba-view";
import { NflView } from "./sports/nfl-view";
import { PadelView } from "./sports/padel-view";
import { TennisView } from "./sports/tennis-view";
import { WorldCupView } from "./sports/world-cup-view";

type SportsHubProps = {
  activeSport: SportId;
  /** Favourites surface as starred tabs and get pinned to the front of the strip. */
  favoriteSportIds?: SportId[];
  /** Exactly the sport being shown — the page fetches one, not all eight. */
  payload: SportPayload;
};

export function SportsHub({
  activeSport,
  favoriteSportIds = [],
  payload,
}: SportsHubProps) {
  const favSet = useMemo(() => new Set(favoriteSportIds), [favoriteSportIds]);

  // Render favourites first so the user lands on their most-watched sports.
  const orderedSports = useMemo(
    () =>
      [...SPORTS].sort((a, b) => {
        const aFav = favSet.has(a.id) ? 0 : 1;
        const bFav = favSet.has(b.id) ? 0 : 1;
        return aFav - bFav;
      }),
    [favSet]
  );

  return (
    <div className="flex flex-col gap-6">
      <SportSelector active={activeSport} favSet={favSet} sports={orderedSports} />
      {SAMPLE_DATA_SPORTS.has(activeSport) && <SampleDataNotice />}
      <SportContent payload={payload} />
    </div>
  );
}

/**
 * Says out loud that a sport is a fixture.
 *
 * The NFL has no free provider with current data, so it renders a
 * hand-written season. Nothing on the page admitted it, which made a stale
 * scoreboard look like a broken live one.
 */
function SampleDataNotice() {
  return (
    // A standing note, not an alert: nothing happened, so nothing to announce.
    <Alert role="note">
      <Info />
      <AlertTitle>Sample data</AlertTitle>
      <AlertDescription>
        No live provider is wired up for this sport yet, so these fixtures and
        standings are made up.
      </AlertDescription>
    </Alert>
  );
}

/**
 * The sport strip. Each sport is a link (`?sport=`), so it navigates like one:
 * middle-click opens it, Back returns, and the active one is `aria-current`.
 */
function SportSelector({
  active,
  favSet,
  sports,
}: {
  active: SportId;
  favSet: Set<SportId>;
  sports: SportMeta[];
}) {
  return (
    <nav aria-label="Sports" className="relative -mx-2 overflow-x-auto px-2 pb-1">
      <ul className="flex gap-2">
        {sports.map((sport) => {
          const isActive = sport.id === active;
          const link = (
            <Link
              href={`?sport=${sport.id}`}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isActive
                  ? "border-foreground/15 bg-foreground/5 text-foreground shadow-xs"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <SportMark emoji={sport.emoji} />
              <span>{sport.shortLabel}</span>
              {favSet.has(sport.id) && (
                <>
                  <Star aria-hidden className="size-3 fill-warning text-warning" strokeWidth={2} />
                  <span className="sr-only">(favorite)</span>
                </>
              )}
            </Link>
          );
          return (
            <li key={sport.id} className="shrink-0">
              {/* The strip shows the short label; the full name ("League of
                  Legends") rides in a tooltip where the two differ. */}
              {sport.label === sport.shortLabel ? (
                link
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent>{sport.label}</TooltipContent>
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The sport's emoji, swapped for a spinner while its link is loading. */
function SportMark({ emoji }: { emoji: string }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Spinner />
  ) : (
    <span aria-hidden className="text-base leading-none">
      {emoji}
    </span>
  );
}

function SportContent({ payload }: { payload: SportPayload }) {
  switch (payload.sport) {
    case "football":
      return <FootballView leagues={payload.leagues} />;
    case "worldcup":
      return <WorldCupView data={payload.data} />;
    case "f1":
      return <F1View data={payload.data} news={payload.news} />;
    case "nba":
      return <NbaView data={payload.data} />;
    case "tennis":
      return <TennisView data={payload.data} />;
    case "padel":
      return <PadelView data={payload.data} />;
    case "nfl":
      return <NflView data={payload.data} />;
    case "lol":
      return <LolView data={payload.data} />;
  }
}
