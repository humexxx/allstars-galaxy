"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { SwissExit, SwissMatch, SwissPool, SwissStage, Team } from "@/types/sports";

import { TeamBadge } from "./team-badge";
import { useMatchTime } from "./time-zone-context";

type WinLoss = { wins: number; losses: number };

type Node =
  | (WinLoss & { kind: "pool"; pool: SwissPool })
  | (WinLoss & { kind: "exit"; exit: SwissExit });

const keyOf = (r: WinLoss): string => `${r.wins}-${r.losses}`;
const label = (r: WinLoss): string => `${r.wins}–${r.losses}`;

/**
 * Column n holds every record reached after n matches — the pools still
 * playing and the exits just reached — best record first. Laid out that way
 * both of a pool's branches lead one column right: winners up, losers down.
 */
function columnsOf(stage: SwissStage): Node[][] {
  const nodes: Node[] = [
    ...stage.rounds.flat().map((pool) => ({ kind: "pool" as const, wins: pool.wins, losses: pool.losses, pool })),
    ...stage.exits.map((exit) => ({ kind: "exit" as const, wins: exit.wins, losses: exit.losses, exit })),
  ];
  const last = Math.max(...nodes.map((n) => n.wins + n.losses));
  return Array.from({ length: last + 1 }, (_, played) =>
    nodes
      .filter((n) => n.wins + n.losses === played)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
  );
}

/** A horizontal run, a rounded turn, the vertical drop, and in again. */
function elbow(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  const dy = y2 - y1;
  const r = Math.min(8, Math.abs(dy) / 2, (x2 - x1) / 4);
  if (r < 1) return `M${x1},${y1} L${x2},${y2}`;
  const s = Math.sign(dy);
  return [
    `M${x1},${y1}`,
    `H${mid - r}`,
    `Q${mid},${y1} ${mid},${y1 + s * r}`,
    `V${y2 - s * r}`,
    `Q${mid},${y2} ${mid + r},${y2}`,
    `H${x2}`,
  ].join(" ");
}

/**
 * A Swiss stage as the tree it is: every record pool in the round it is
 * played, joined to the two pools its winners and losers move on to, and the
 * records that end the stage where they are reached.
 *
 * The branches are drawn over the laid-out boxes, measured after layout: the
 * pools are as tall as their matches, so where a branch starts and lands is
 * only known once they are on the page.
 */
export function SwissBracket({
  stage,
  teams,
  className,
}: {
  stage: SwissStage;
  teams: Map<string, Team>;
  className?: string;
}) {
  const columns = useMemo(() => columnsOf(stage), [stage]);
  const current = stage.rounds.findIndex((round) =>
    round.some((pool) => pool.matches.some((m) => m.status !== "ft"))
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const boxes = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<string[]>([]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const origin = canvas.getBoundingClientRect();
      const next: string[] = [];
      for (const pool of stage.rounds.flat()) {
        const from = boxes.current.get(keyOf(pool))?.getBoundingClientRect();
        if (!from) continue;
        for (const target of [
          { wins: pool.wins + 1, losses: pool.losses },
          { wins: pool.wins, losses: pool.losses + 1 },
        ]) {
          const to = boxes.current.get(keyOf(target))?.getBoundingClientRect();
          if (!to) continue;
          next.push(
            elbow(
              from.right - origin.left,
              from.top + from.height / 2 - origin.top,
              to.left - origin.left,
              to.top + to.height / 2 - origin.top
            )
          );
        }
      }
      setPaths(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    for (const box of boxes.current.values()) observer.observe(box);
    return () => observer.disconnect();
  }, [stage, columns]);

  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) boxes.current.set(key, el);
    else boxes.current.delete(key);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Text variant="small">
        Winners move up a branch, losers down. {stage.winsToAdvance} wins go through to the
        knockouts; {stage.lossesToExit} losses go home.
      </Text>
      {/* Wider than a phone: it scrolls sideways, as a printed bracket would.
          `w-max min-w-full` sizes the canvas to the columns, so the branches
          drawn over it cover the part scrolled out of view too. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          ref={canvasRef}
          className="relative grid w-max min-w-full gap-x-5"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(8rem, 1fr))` }}
        >
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full overflow-visible text-muted-foreground/50"
          >
            {paths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
            ))}
          </svg>
          {columns.map((nodes, played) => (
            <div key={played} className="flex flex-col gap-2">
              <Eyebrow as="div" size="sm" className={cn(played === current && "text-foreground")}>
                {played < stage.rounds.length ? `Round ${played + 1}` : "Result"}
              </Eyebrow>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {nodes.map((node) =>
                  node.kind === "pool" ? (
                    <PoolBox key={keyOf(node)} ref={register(keyOf(node))} pool={node.pool} teams={teams} />
                  ) : (
                    <ExitBox key={keyOf(node)} ref={register(keyOf(node))} exit={node.exit} teams={teams} />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PoolBox({
  pool,
  teams,
  ref,
}: {
  pool: SwissPool;
  teams: Map<string, Team>;
  ref: (el: HTMLElement | null) => void;
}) {
  const bestOf = pool.matches.find((m) => m.bestOf)?.bestOf;
  return (
    <section ref={ref} className="relative rounded-lg border bg-card" aria-label={`${label(pool)} pool`}>
      <header className="flex items-center justify-between gap-2 border-b px-2.5 py-1">
        <Mono className="text-xs font-semibold">{label(pool)}</Mono>
        {bestOf && (
          <Eyebrow size="sm" as="span">
            BO{bestOf}
          </Eyebrow>
        )}
      </header>
      <ul className="divide-y">
        {pool.matches.map((match) => (
          <li key={match.id}>
            <MatchRows match={match} teams={teams} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatchRows({ match, teams }: { match: SwissMatch; teams: Map<string, Team> }) {
  const format = useMatchTime();
  const decided = Boolean(match.winnerTeamId);
  const sides = [
    { id: match.homeTeamId, score: match.homeScore },
    { id: match.awayTeamId, score: match.awayScore },
  ];
  return (
    <div
      className="flex flex-col gap-1 px-2.5 py-1.5"
      title={match.date ? format.dayTime(match.date) : undefined}
    >
      {sides.map(({ id, score }, i) => {
        const team = id ? teams.get(id) : undefined;
        const won = decided && id === match.winnerTeamId;
        return (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <TeamLine team={team} muted={decided && !won} strong={won} />
            {score !== null && score !== undefined && (
              <Mono className={cn(won ? "font-semibold" : "text-muted-foreground")}>{score}</Mono>
            )}
            {i === 0 && match.status === "live" && (
              <span aria-label="Live" className="size-1.5 shrink-0 rounded-full bg-success" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeamLine({ team, muted = false, strong = false }: { team?: Team; muted?: boolean; strong?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", muted && "text-muted-foreground")}>
      {team ? (
        <TeamBadge team={team} size="sm" className="size-5" />
      ) : (
        <span aria-hidden className="size-5 shrink-0 rounded-full border border-dashed" />
      )}
      <span className={cn("truncate", strong && "font-semibold", !team && "text-muted-foreground")}>
        {team?.code ?? "TBD"}
      </span>
    </span>
  );
}

function ExitBox({
  exit,
  teams,
  ref,
}: {
  exit: SwissExit;
  teams: Map<string, Team>;
  ref: (el: HTMLElement | null) => void;
}) {
  const slots = Array.from({ length: exit.slots }, (_, i) => exit.teamIds[i]);
  return (
    <section
      ref={ref}
      aria-label={`${label(exit)}, ${exit.advanced ? "through" : "eliminated"}`}
      className={cn(
        "relative rounded-lg border px-2.5 py-1.5",
        exit.advanced ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5"
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <Mono className="text-xs font-semibold">{label(exit)}</Mono>
        <Eyebrow size="sm" as="span" className={exit.advanced ? "text-success" : "text-destructive"}>
          {exit.advanced ? "Through" : "Out"}
        </Eyebrow>
      </header>
      <ul className="mt-1.5 flex flex-col gap-1 text-xs">
        {slots.map((id, i) => (
          <li key={id ?? `open-${i}`}>
            <TeamLine team={id ? teams.get(id) : undefined} />
          </li>
        ))}
      </ul>
    </section>
  );
}
