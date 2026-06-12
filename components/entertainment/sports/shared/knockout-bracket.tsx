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

const VISIBLE_COUNT = 3;

/** Window start that puts the CURRENT round (first with an undecided tie) in
 *  view; a fully decided bracket lands on the final columns instead of opening
 *  on the oldest rounds and hiding the most interesting one. */
function initialWindowStart(rounds: BracketRound[]): number {
  const maxStart = Math.max(0, rounds.length - VISIBLE_COUNT);
  const currentIdx = rounds.findIndex((r) =>
    r.matches.some((m) => !m.winnerTeamId)
  );
  if (currentIdx === -1) return maxStart;
  return Math.min(currentIdx, maxStart);
}

export function KnockoutBracket({ rounds, teams, className }: KnockoutBracketProps) {
  const [windowStart, setWindowStart] = useState(() => initialWindowStart(rounds));
  const maxStart = Math.max(0, rounds.length - VISIBLE_COUNT);

  // Re-focus when the rounds themselves change (league switch, revalidation) —
  // a stale windowStart could point past the new bracket's last round. This is
  // React's render-time derived-state reset pattern (not an effect).
  const [prevRounds, setPrevRounds] = useState(rounds);
  if (prevRounds !== rounds) {
    setPrevRounds(rounds);
    setWindowStart(initialWindowStart(rounds));
  }

  const start = Math.min(windowStart, maxStart);
  const visibleRounds = rounds.slice(start, start + VISIBLE_COUNT);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={start === 0}
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
          disabled={start >= maxStart}
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
