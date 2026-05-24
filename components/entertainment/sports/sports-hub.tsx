"use client";

import { useState } from "react";

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
};

export function SportsHub({ defaultSport = "football" }: SportsHubProps) {
  const [activeSport, setActiveSport] = useState<SportId>(defaultSport);

  return (
    <div className="space-y-6">
      <SportSelector active={activeSport} onChange={setActiveSport} />
      <SportContent sport={activeSport} />
    </div>
  );
}

function SportSelector({
  active,
  onChange,
}: {
  active: SportId;
  onChange: (sport: SportId) => void;
}) {
  return (
    <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
      {SPORTS.map((sport) => {
        const isActive = sport.id === active;
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
