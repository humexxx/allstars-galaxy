"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BracketRound, Team } from "@/types/sports";

import { LegScoreCard } from "./leg-score-card";

type KnockoutBracketProps = {
  rounds: BracketRound[];
  teams: Map<string, Team>;
  className?: string;
};

export function KnockoutBracket({ rounds, teams, className }: KnockoutBracketProps) {
  const [windowStart, setWindowStart] = useState(0);
  const visibleCount = 3;
  const maxStart = Math.max(0, rounds.length - visibleCount);
  const visibleRounds = rounds.slice(windowStart, windowStart + visibleCount);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={windowStart === 0}
          onClick={() => setWindowStart((s) => Math.max(0, s - 1))}
          aria-label="Previous round"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div
          className={cn(
            "grid flex-1 gap-2 text-center text-sm font-medium",
            visibleRounds.length === 1 && "grid-cols-1",
            visibleRounds.length === 2 && "grid-cols-2",
            visibleRounds.length === 3 && "grid-cols-3",
          )}
        >
          {visibleRounds.map((round) => (
            <span key={round.id} className="truncate">
              {round.label}
            </span>
          ))}
        </div>
        <Button
          size="icon"
          variant="ghost"
          disabled={windowStart >= maxStart}
          onClick={() => setWindowStart((s) => Math.min(maxStart, s + 1))}
          aria-label="Next round"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={cn(
          "grid items-stretch gap-3",
          visibleRounds.length === 1 && "grid-cols-1",
          visibleRounds.length === 2 && "grid-cols-2",
          visibleRounds.length === 3 && "grid-cols-3",
        )}
      >
        {visibleRounds.map((round) => (
          <div key={round.id} className="flex flex-col justify-around gap-3">
            {round.matches.map((match) => (
              <LegScoreCard key={match.id} match={match} teams={teams} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
