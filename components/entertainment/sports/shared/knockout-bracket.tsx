"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

/** Index of the CURRENT round: first with an undecided tie; a fully decided
 *  bracket lands on the final instead of opening on the oldest round. */
function currentRoundIndex(rounds: BracketRound[]): number {
  const idx = rounds.findIndex((r) => r.matches.some((m) => !m.winnerTeamId));
  return idx === -1 ? rounds.length - 1 : idx;
}

/** A round's ties by the half of the draw they are in: the top half, then the bottom. */
function halves<T>(list: T[]): [T[], T[]] {
  const mid = Math.ceil(list.length / 2);
  return [list.slice(0, mid), list.slice(mid)];
}

const reducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Each column's left edge, in the scrolled content's own coordinates. */
function columnLefts(viewport: HTMLElement): number[] {
  const origin = viewport.getBoundingClientRect().left - viewport.scrollLeft;
  return [...viewport.querySelectorAll<HTMLElement>("[data-column]")].map(
    (column) => column.getBoundingClientRect().left - origin
  );
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
 * A knockout as a tree, drawn as a printed bracket is: the top half of the
 * draw on the left running in, the bottom half mirrored on the right, and
 * the final between them — the third-place match under it, with no branch
 * into it, as it is fed by the semi-finals' losers. A box per tie, branches
 * joining each pair of ties to the one they feed.
 *
 * Wider than its card, it scrolls sideways (swipe, or the buttons over it: a
 * column a tap, or straight to either end, the other half of the draw). It
 * opens on the round being played, its top half centred.
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
  const viewport = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ overflow: false, atStart: true, atEnd: true });

  const { columns, edges, opening } = useMemo(() => {
    const current = currentRoundIndex(tree.rounds);
    const last = tree.rounds.length - 1;
    const item = (match: BracketMatch, caption?: string) => ({
      key: match.id,
      caption,
      node: <TieBox match={match} teams={teams} renderMatch={renderMatch} />,
    });
    const column = (round: BracketRound, i: number, side: string, matches: BracketMatch[]) => ({
      key: `${round.id}-${side}`,
      label: round.label,
      current: i === current,
      items: matches.map((m) => item(m)),
    });
    const before = tree.rounds.slice(0, last);
    const final = tree.rounds[last];
    const columns: BracketColumn[] = [
      ...before.map((round, i) => column(round, i, "top", halves(round.matches)[0])),
      {
        key: `${final?.id ?? "final"}-centre`,
        label: final?.label ?? "",
        current: last === current,
        items: [
          ...(final?.matches ?? []).map((m) => item(m)),
          ...(thirdPlace?.matches ?? []).map((m) => item(m, thirdPlace?.label)),
        ],
      },
      ...before.map((round, i) => column(round, i, "bottom", halves(round.matches)[1])).reverse(),
    ];
    const edges: BracketEdge[] = before.flatMap((round, i) => {
      if (!tree.paired[i]) return [];
      return tree.rounds[i + 1].matches.flatMap((target, k) =>
        [round.matches[k * 2], round.matches[k * 2 + 1]]
          .filter((feeder): feeder is BracketMatch => Boolean(feeder))
          .map((feeder) => ({ from: feeder.id, to: target.id }))
      );
    });
    // The top half's column of the round being played; the final's own once
    // only the final is left.
    return { columns, edges, opening: Math.min(current, last) };
  }, [tree, thirdPlace, teams, renderMatch]);

  const readEnds = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { overflow: max > 1, atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft >= max - 1 };
    setEnds((prev) =>
      prev.overflow === next.overflow && prev.atStart === next.atStart && prev.atEnd === next.atEnd
        ? prev
        : next
    );
  }, []);

  // On the round being played, before the first paint; again for new rounds
  // (another league, a revalidation), never on the reader's own scrolling.
  useLayoutEffect(() => {
    const el = viewport.current;
    const target = el?.querySelector<HTMLElement>(`[data-column="${opening}"]`);
    if (el && target) {
      const left = columnLefts(el)[opening] ?? 0;
      el.scrollLeft = Math.max(0, left - (el.clientWidth - target.offsetWidth) / 2);
    }
    readEnds();
  }, [rounds, opening, readEnds]);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(readEnds);
    observer.observe(el);
    el.addEventListener("scroll", readEnds, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", readEnds);
    };
  }, [readEnds]);

  const scrollTo = (left: number): void => {
    viewport.current?.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
  };
  /** To the next column's left edge that way, or the end. */
  const step = (direction: 1 | -1): void => {
    const el = viewport.current;
    if (!el) return;
    const at = el.scrollLeft;
    const lefts = columnLefts(el);
    const next =
      direction > 0 ? lefts.find((x) => x > at + 1) : [...lefts].reverse().find((x) => x < at - 1);
    scrollTo(next ?? (direction > 0 ? el.scrollWidth : 0));
  };

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
      {ends.overflow && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              disabled={ends.atStart}
              onClick={() => scrollTo(0)}
              aria-label="Left end of the bracket"
            >
              <ChevronsLeft />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={ends.atStart}
              onClick={() => step(-1)}
              aria-label="Scroll left"
            >
              <ChevronLeft />
            </Button>
          </div>
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              disabled={ends.atEnd}
              onClick={() => step(1)}
              aria-label="Scroll right"
            >
              <ChevronRight />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={ends.atEnd}
              onClick={() => scrollTo(viewport.current?.scrollWidth ?? 0)}
              aria-label="Right end of the bracket"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      )}
      <BracketCanvas
        columns={columns}
        edges={edges}
        minColumnWidth={minColumnWidth}
        viewportRef={viewport}
      />
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
