"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Mono } from "@/components/ui/typography";
import { isBracketDrawn } from "@/lib/sports/bracket";
import { cn } from "@/lib/utils";
import type { BracketMatch, BracketRound, Team } from "@/types/sports";

import {
  BracketCanvas,
  BracketDate,
  BracketTeam,
  bracketWhen,
  MatchHover,
  type BracketColumn,
  type BracketEdge,
} from "./bracket-canvas";
import { useMatchTime } from "./time-zone-context";

type KnockoutBracketProps = {
  rounds: BracketRound[];
  teams: Map<string, Team>;
  className?: string;
  /**
   * How one tie is drawn. Football, LoL and the NFL share the default box;
   * tennis passes its own, because a draw wants seeds, flags and set scores.
   */
  renderMatch?: (match: BracketMatch, teams: Map<string, Team>) => ReactNode;
  /** Passed to the canvas: a column never narrows past this. */
  minColumnWidth?: string;
};

/** Rounds on screen at once: a Grand Slam's seven page through, the rest fit. */
const VISIBLE_ROUNDS = 4;

/** Index of the CURRENT round: first with an undecided tie; a fully decided
 *  bracket lands on the final instead of opening on the oldest round. */
function currentRoundIndex(rounds: BracketRound[]): number {
  const idx = rounds.findIndex((r) => r.matches.some((m) => !m.winnerTeamId));
  return idx === -1 ? rounds.length - 1 : idx;
}

function initialWindowStart(rounds: BracketRound[]): number {
  return Math.min(currentRoundIndex(rounds), Math.max(0, rounds.length - VISIBLE_ROUNDS));
}

/**
 * Reorder the active round's matches so the two feeders of next-round match k
 * sit at positions 2k / 2k+1. Feeders are matched by team membership (a
 * next-round slot already naming a team must be fed by the tie that team played
 * in); undecided slots fill up with the remaining matches in original order.
 */
function orderPairs(active: BracketMatch[], next: BracketMatch[]): Array<BracketMatch | null> {
  const used = new Set<string>();
  const slots: Array<BracketMatch | null> = next.flatMap(() => [null, null]);

  const feederFor = (teamId: string | null | undefined): BracketMatch | undefined =>
    teamId
      ? active.find(
          (m) => !used.has(m.id) && (m.homeTeamId === teamId || m.awayTeamId === teamId)
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

/**
 * Every round in tree order, worked back from the final: each round sorted so
 * the two ties that feed a later one sit next to each other. `paired[i]` says
 * round i halves into round i + 1 — only then are there branches between them.
 */
function treeOrder(rounds: BracketRound[]): { rounds: BracketRound[]; paired: boolean[] } {
  const ordered = rounds.map((r) => ({ ...r, matches: [...r.matches] }));
  const paired = rounds.map(() => false);
  for (let i = ordered.length - 2; i >= 0; i--) {
    const next = ordered[i + 1].matches;
    if (ordered[i].matches.length !== next.length * 2) continue;
    ordered[i].matches = orderPairs(ordered[i].matches, next).filter(
      (m): m is BracketMatch => m !== null
    );
    paired[i] = true;
  }
  return { rounds: ordered, paired };
}

/**
 * A knockout as a tree, drawn like the Swiss stage: a column per round, a box
 * per tie, and branches joining each pair of ties to the one they feed. The
 * third-place match stands in a column of its own after the final, with no
 * branch into it — it is fed by the semi-finals' losers, not their winners.
 */
export function KnockoutBracket({
  rounds,
  teams,
  className,
  renderMatch,
  minColumnWidth,
}: KnockoutBracketProps) {
  const tree = useMemo(() => treeOrder(rounds.filter((r) => r.id !== "third-place")), [rounds]);
  const thirdPlace = rounds.find((r) => r.id === "third-place");

  const [windowStart, setWindowStart] = useState(() => initialWindowStart(tree.rounds));
  // Re-focus when the rounds themselves change (league switch, revalidation):
  // a stale start could point past the new bracket's last round. React's
  // render-time derived-state reset, not an effect.
  const [prevRounds, setPrevRounds] = useState(rounds);
  if (prevRounds !== rounds) {
    setPrevRounds(rounds);
    setWindowStart(initialWindowStart(tree.rounds));
  }

  const maxStart = Math.max(0, tree.rounds.length - VISIBLE_ROUNDS);
  const start = Math.min(windowStart, maxStart);
  const visible = useMemo(() => tree.rounds.slice(start, start + VISIBLE_ROUNDS), [tree, start]);

  const { columns, edges } = useMemo(() => {
    const current = currentRoundIndex(tree.rounds);
    const box = (match: BracketMatch) => (
      <TieBox match={match} teams={teams} renderMatch={renderMatch} />
    );
    const columns: BracketColumn[] = visible.map((round, i) => ({
      key: `${round.id}-${start + i}`,
      label: round.label,
      current: start + i === current,
      items: round.matches.map((m) => ({ key: m.id, node: box(m) })),
    }));
    const showsFinal = start + visible.length === tree.rounds.length;
    if (thirdPlace && showsFinal && thirdPlace.matches.length > 0) {
      columns.push({
        key: "third-place",
        label: thirdPlace.label,
        items: thirdPlace.matches.map((m) => ({ key: m.id, node: box(m) })),
      });
    }
    const edges: BracketEdge[] = visible.flatMap((round, i) => {
      const next = visible[i + 1];
      if (!next || !tree.paired[start + i]) return [];
      return next.matches.flatMap((target, k) =>
        [round.matches[k * 2], round.matches[k * 2 + 1]]
          .filter((feeder): feeder is BracketMatch => Boolean(feeder))
          .map((feeder) => ({ from: feeder.id, to: target.id }))
      );
    });
    return { columns, edges };
  }, [tree, visible, start, thirdPlace, teams, renderMatch]);

  if (rounds.length === 0 || !isBracketDrawn(rounds)) {
    return (
      <EmptyState
        icon={Trophy}
        title="The bracket is not drawn yet"
        description="Nobody has qualified into it."
        className={className}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* A round a tap, or straight to either end: the first round, or the
          rounds that end in the final. */}
      {maxStart > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              disabled={start === 0}
              onClick={() => setWindowStart(0)}
              aria-label="First round"
            >
              <ChevronsLeft />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={start === 0}
              onClick={() => setWindowStart(Math.max(0, start - 1))}
              aria-label="Earlier rounds"
            >
              <ChevronLeft />
            </Button>
          </div>
          <Mono className="text-center text-xs text-muted-foreground">
            {visible[0]?.label} – {visible[visible.length - 1]?.label}
          </Mono>
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              disabled={start >= maxStart}
              onClick={() => setWindowStart(Math.min(maxStart, start + 1))}
              aria-label="Later rounds"
            >
              <ChevronRight />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={start >= maxStart}
              onClick={() => setWindowStart(maxStart)}
              aria-label="To the final"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      )}
      <BracketCanvas columns={columns} edges={edges} minColumnWidth={minColumnWidth} />
    </div>
  );
}

/** The card for one tie: the sport's own, or the shared box. */
function TieBox({
  match,
  teams,
  renderMatch,
}: {
  match: BracketMatch;
  teams: Map<string, Team>;
  renderMatch?: KnockoutBracketProps["renderMatch"];
}) {
  if (renderMatch) return <>{renderMatch(match, teams)}</>;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <TieRows match={match} teams={teams} />
    </div>
  );
}

const has = (n: number | null | undefined): n is number => n !== null && n !== undefined;

/**
 * Both teams with the tie's score, and when it is in small print under them.
 *
 * A two-legged tie shows its aggregate once both legs are in, the running
 * total until then, and the day of each leg; the legs' own scores are in the
 * tooltip. A single match or series shows its score and its day and time.
 */
function TieRows({ match, teams }: { match: BracketMatch; teams: Map<string, Team> }) {
  const format = useMatchTime();
  const legs = match.legs ?? [];
  const decided = Boolean(match.winnerTeamId);
  const played = legs.filter((l) => has(l.homeScore) && has(l.awayScore));

  const scoreOf = (side: "home" | "away"): number | null => {
    if (legs.length === 0) return side === "home" ? (match.homeScore ?? null) : (match.awayScore ?? null);
    const aggregate = side === "home" ? match.aggregateHome : match.aggregateAway;
    if (has(aggregate)) return aggregate;
    if (played.length === 0) return null;
    return played.reduce((sum, l) => sum + ((side === "home" ? l.homeScore : l.awayScore) ?? 0), 0);
  };

  const sides = [
    { id: match.homeTeamId, score: scoreOf("home") },
    { id: match.awayTeamId, score: scoreOf("away") },
  ].map((side) => ({ ...side, team: side.id ? teams.get(side.id) : undefined }));
  const name = (i: 0 | 1) => sides[i].team?.code ?? "TBD";
  const scored = has(sides[0].score) && has(sides[1].score);

  const legDays = legs.map((l, i) => (l.date ? `L${i + 1} ${format.shortDay(l.date)}` : null)).filter(Boolean);
  const when = legDays.length > 0 ? legDays.join(" · ") : match.date ? bracketWhen(match.date, format) : null;

  return (
    <MatchHover
      className="flex flex-col gap-1 px-2.5 py-1.5"
      details={
        <>
          <span className="font-semibold">
            {scored ? `${name(0)} ${sides[0].score}–${sides[1].score} ${name(1)}` : `${name(0)} vs ${name(1)}`}
          </span>
          {legs.length > 0
            ? legs.map((leg, i) => (
                <span key={i}>
                  Leg {i + 1}
                  {leg.date ? ` · ${format.dayTime(leg.date)}` : ""}
                  {has(leg.homeScore) && has(leg.awayScore) ? ` · ${leg.homeScore}–${leg.awayScore}` : ""}
                </span>
              ))
            : match.date && <span>{format.dayTime(match.date)}</span>}
          {(match.bestOf || decided) && (
            <span className="opacity-70">
              {[match.bestOf ? `Best of ${match.bestOf}` : null, decided ? "Final" : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </>
      }
    >
      {sides.map((side, i) => {
        const won = decided && side.id === match.winnerTeamId;
        return (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <BracketTeam team={side.team} muted={decided && !won} strong={won} />
            {has(side.score) && (
              <Mono className={cn(won ? "font-semibold" : "text-muted-foreground")}>{side.score}</Mono>
            )}
          </div>
        );
      })}
      {when && <BracketDate>{when}</BracketDate>}
    </MatchHover>
  );
}
