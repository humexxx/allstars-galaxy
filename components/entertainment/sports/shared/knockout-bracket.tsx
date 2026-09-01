"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isBracketDrawn } from "@/lib/sports/bracket";
import { cn } from "@/lib/utils";
import type { BracketMatch, BracketRound, Team } from "@/types/sports";

import { LegScoreCard } from "./leg-score-card";

type KnockoutBracketProps = {
  rounds: BracketRound[];
  teams: Map<string, Team>;
  className?: string;
  /**
   * How one tie is drawn. Football's two-legged card is the default; tennis
   * passes its own, because a draw wants seeds, flags and set scores rather
   * than L1/L2 columns and an aggregate.
   */
  renderMatch?: (match: BracketMatch, teams: Map<string, Team>) => ReactNode;
};

const VISIBLE_COUNT = 3;

/** The card for one tie: the sport's own, or football's two-legged default. */
function Tie({
  match,
  teams,
  render,
}: {
  match: BracketMatch;
  teams: Map<string, Team>;
  render?: (match: BracketMatch, teams: Map<string, Team>) => ReactNode;
}) {
  return <>{render ? render(match, teams) : <LegScoreCard match={match} teams={teams} />}</>;
}

/** Index of the CURRENT round: first with an undecided tie; a fully decided
 *  bracket lands on the final instead of opening on the oldest round. */
function currentRoundIndex(rounds: BracketRound[]): number {
  const idx = rounds.findIndex((r) => r.matches.some((m) => !m.winnerTeamId));
  return idx === -1 ? rounds.length - 1 : idx;
}

function initialWindowStart(rounds: BracketRound[]): number {
  const maxStart = Math.max(0, rounds.length - VISIBLE_COUNT);
  return Math.min(currentRoundIndex(rounds), maxStart);
}

export function KnockoutBracket({ rounds, teams, className, renderMatch }: KnockoutBracketProps) {
  if (rounds.length === 0 || !isBracketDrawn(rounds)) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        The bracket is not drawn yet — nobody has qualified into it.
      </div>
    );
  }

  return (
    <div className={className}>
      <MobileBracket rounds={rounds} teams={teams} renderMatch={renderMatch} className="sm:hidden" />
      <DesktopBracket rounds={rounds} teams={teams} renderMatch={renderMatch} className="hidden sm:block" />
    </div>
  );
}

// ---------- Mobile: Google-style round tabs + paired ties ----------

/**
 * Reorder the active round's matches so the two feeders of next-round match k
 * sit at positions 2k / 2k+1. Feeders are matched by team membership (a
 * next-round slot already naming a team must be fed by the tie that team played
 * in); undecided slots fill up with the remaining matches in original order.
 */
function orderPairs(
  active: BracketMatch[],
  next: BracketMatch[],
): Array<BracketMatch | null> {
  const used = new Set<string>();
  const slots: Array<BracketMatch | null> = next.flatMap(() => [null, null]);

  const feederFor = (teamId: string | null | undefined): BracketMatch | undefined =>
    teamId
      ? active.find(
          (m) =>
            !used.has(m.id) &&
            (m.homeTeamId === teamId || m.awayTeamId === teamId),
        )
      : undefined;

  next.forEach((nm, k) => {
    const top = feederFor(nm.homeTeamId);
    if (top) {
      slots[k * 2] = top;
      used.add(top.id);
    }
    const bottom = feederFor(nm.awayTeamId);
    if (bottom) {
      slots[k * 2 + 1] = bottom;
      used.add(bottom.id);
    }
  });

  const leftovers = active.filter((m) => !used.has(m.id));
  let li = 0;
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) slots[i] = leftovers[li++] ?? null;
  }
  return slots;
}

function MobileBracket({
  rounds,
  teams,
  className,
  renderMatch,
}: KnockoutBracketProps) {
  const [activeIdx, setActiveIdx] = useState(() => currentRoundIndex(rounds));

  // Derived-state reset when the bracket itself changes (league switch).
  const [prevRounds, setPrevRounds] = useState(rounds);
  if (prevRounds !== rounds) {
    setPrevRounds(rounds);
    setActiveIdx(currentRoundIndex(rounds));
  }

  const idx = Math.min(activeIdx, rounds.length - 1);
  const active = rounds[idx];
  // The right-hand column shows where winners go. Third-place is a losers'
  // fixture — skip it so semi-final winners connect to the final.
  const next = rounds
    .slice(idx + 1)
    .find((r) => r.id !== "third-place");
  const canPair =
    !!next && next.matches.length * 2 === active.matches.length;
  const slots =
    canPair && next ? orderPairs(active.matches, next.matches) : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="tablist"
        aria-label="Knockout rounds"
        className="relative -mx-1 flex gap-1 overflow-x-auto px-1"
      >
        {rounds.map((round, i) => (
          <button
            key={round.id}
            type="button"
            role="tab"
            aria-selected={i === idx}
            onClick={() => setActiveIdx(i)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              i === idx
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {round.label}
          </button>
        ))}
      </div>

      {slots && next ? (
        <div className="space-y-4">
          {next.matches.map((nextMatch, k) => {
            const top = slots[k * 2];
            const bottom = slots[k * 2 + 1];
            return (
              <div key={nextMatch.id} className="flex items-stretch">
                <div className="flex min-w-0 flex-1 flex-col justify-around gap-3">
                  {top && <Tie match={top} teams={teams} render={renderMatch} />}
                  {bottom && <Tie match={bottom} teams={teams} render={renderMatch} />}
                </div>
                <PairConnector />
                <div className="flex min-w-0 flex-1 items-center">
                  <div className="w-full">
                    <Tie match={nextMatch} teams={teams} render={renderMatch} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.matches.map((match) => (
            <Tie key={match.id} match={match} teams={teams} render={renderMatch} />
          ))}
        </div>
      )}
    </div>
  );
}

/** ⌐/⌡ lines joining a pair of ties to the tie their winners meet in. */
function PairConnector() {
  return (
    <div aria-hidden className="relative w-5 shrink-0">
      <div className="absolute left-0 right-1/2 top-1/4 h-px bg-border" />
      <div className="absolute bottom-1/4 left-0 right-1/2 h-px bg-border" />
      <div className="absolute bottom-1/4 left-1/2 top-1/4 w-px bg-border" />
      <div className="absolute left-1/2 right-0 top-1/2 h-px bg-border" />
    </div>
  );
}

// ---------- Desktop: 3-column sliding window ----------

function DesktopBracket({ rounds, teams, className, renderMatch }: KnockoutBracketProps) {
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
        {maxStart > 0 ? (
          <Button
            size="icon"
            variant="ghost"
            disabled={start === 0}
            onClick={() => setWindowStart((s) => Math.max(0, s - 1))}
            aria-label="Previous round"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : null}
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
        {maxStart > 0 ? (
          <Button
            size="icon"
            variant="ghost"
            disabled={start >= maxStart}
            onClick={() => setWindowStart((s) => Math.min(maxStart, s + 1))}
            aria-label="Next round"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : null}
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
              <Tie key={match.id} match={match} teams={teams} render={renderMatch} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
