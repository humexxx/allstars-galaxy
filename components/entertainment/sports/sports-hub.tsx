"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { getFootballLeagues } from "@/lib/data/sports/football";
import { F1_DATA } from "@/lib/data/sports/f1";
import { LOL_DATA } from "@/lib/data/sports/lol";
import { NBA_DATA } from "@/lib/data/sports/nba";
import { NFL_DATA } from "@/lib/data/sports/nfl";
import { PADEL_DATA } from "@/lib/data/sports/padel";
import { SPORTS } from "@/lib/data/sports/registry";
import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import type { SportId } from "@/types/sports";

import { F1View } from "./sports/f1-view";
import { FootballView } from "./sports/football-view";
import { LolView } from "./sports/lol-view";
import { NbaView } from "./sports/nba-view";
import { NflView } from "./sports/nfl-view";
import { PadelView } from "./sports/padel-view";
import { TennisView } from "./sports/tennis-view";

const FOOTBALL_LEAGUES = getFootballLeagues();

type SportsHubProps = {
  defaultSport?: SportId;
  /** Favourites surface as starred tabs and get pinned to the front of the strip. */
  favoriteSportIds?: SportId[];
};

export function SportsHub({
  defaultSport,
  favoriteSportIds = [],
}: SportsHubProps) {
  const favSet = useMemo(() => new Set(favoriteSportIds), [favoriteSportIds]);
  const initial: SportId = defaultSport ?? favoriteSportIds[0] ?? "football";
  const [activeSport, setActiveSport] = useState<SportId>(initial);

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
    <div className="space-y-6">
      <SportSelector
        active={activeSport}
        onChange={setActiveSport}
        favSet={favSet}
        sports={orderedSports}
      />
      <SportContent sport={activeSport} />
    </div>
  );
}

function SportSelector({
  active,
  onChange,
  favSet,
  sports,
}: {
  active: SportId;
  onChange: (sport: SportId) => void;
  favSet: Set<SportId>;
  sports: typeof SPORTS;
}) {
  return (
    <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
      {sports.map((sport) => {
        const isActive = sport.id === active;
        const isFav = favSet.has(sport.id);
        return (
          <button
            key={sport.id}
            type="button"
            onClick={() => onChange(sport.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground/15 bg-foreground/5 text-foreground shadow-xs"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span aria-hidden className="text-base leading-none">
              {sport.emoji}
            </span>
            <span>{sport.shortLabel}</span>
            {isFav && (
              <Star
                aria-hidden
                className="h-3 w-3 fill-amber-400 text-amber-400"
                strokeWidth={2}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function SportContent({ sport }: { sport: SportId }) {
  switch (sport) {
    case "football":
      return <FootballView leagues={FOOTBALL_LEAGUES} />;
    case "f1":
      return <F1View data={F1_DATA} />;
    case "nba":
      return <NbaView data={NBA_DATA} />;
    case "tennis":
      return <TennisView data={TENNIS_DATA} />;
    case "padel":
      return <PadelView data={PADEL_DATA} />;
    case "nfl":
      return <NflView data={NFL_DATA} />;
    case "lol":
      return <LolView data={LOL_DATA} />;
  }
}
