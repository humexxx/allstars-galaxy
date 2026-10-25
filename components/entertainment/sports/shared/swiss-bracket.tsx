"use client";

import { useMemo } from "react";

import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { SwissExit, SwissMatch, SwissPool, SwissStage, Team } from "@/types/sports";

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

type WinLoss = { wins: number; losses: number };

type Node =
  | (WinLoss & { kind: "pool"; pool: SwissPool })
  | (WinLoss & { kind: "exit"; exit: SwissExit });

const keyOf = (r: WinLoss): string => `${r.wins}-${r.losses}`;
const label = (r: WinLoss): string => `${r.wins}–${r.losses}`;
/** A record in words: a screen reader at its default punctuation says "1 0" for "1–0". */
const spoken = (r: WinLoss): string =>
  `${r.wins} ${r.wins === 1 ? "win" : "wins"}, ${r.losses} ${r.losses === 1 ? "loss" : "losses"}`;

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

/**
 * A Swiss stage as the tree it is: every record pool in the round it is
 * played, joined to the two pools its winners and losers move on to, and the
 * records that end the stage where they are reached.
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
  const columns = useMemo((): BracketColumn[] => {
    const current = stage.rounds.findIndex((round) =>
      round.some((pool) => pool.matches.some((m) => m.status !== "ft"))
    );
    return columnsOf(stage).map((nodes, played) => ({
      key: String(played),
      label: played < stage.rounds.length ? `Round ${played + 1}` : "Result",
      current: played === current,
      items: nodes.map((node) => ({
        key: keyOf(node),
        node:
          node.kind === "pool" ? (
            <PoolBox pool={node.pool} teams={teams} />
          ) : (
            <ExitBox exit={node.exit} teams={teams} />
          ),
      })),
    }));
  }, [stage, teams]);

  const edges = useMemo(
    (): BracketEdge[] =>
      stage.rounds.flat().flatMap((pool) => [
        { from: keyOf(pool), to: keyOf({ wins: pool.wins + 1, losses: pool.losses }) },
        { from: keyOf(pool), to: keyOf({ wins: pool.wins, losses: pool.losses + 1 }) },
      ]),
    [stage]
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Text variant="small">
        Winners move up a branch, losers down. {stage.winsToAdvance} wins go through to the
        knockouts; {stage.lossesToExit} losses go home.
      </Text>
      <BracketCanvas columns={columns} edges={edges} />
    </div>
  );
}

function PoolBox({ pool, teams }: { pool: SwissPool; teams: Map<string, Team> }) {
  const bestOf = pool.matches.find((m) => m.bestOf)?.bestOf;
  return (
    <div role="group" className="relative overflow-hidden rounded-lg border bg-card" aria-label={spoken(pool)}>
      <header className="flex items-center justify-between gap-2 border-b px-2.5 py-1">
        <Mono className="text-xs font-semibold">{label(pool)}</Mono>
        {bestOf && (
          <Eyebrow size="sm" as="span">
            <span aria-hidden>BO{bestOf}</span>
            <span className="sr-only">Best of {bestOf}</span>
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
    </div>
  );
}

export const STATUS_LABEL: Record<SwissMatch["status"], string> = {
  scheduled: "Upcoming",
  live: "Live",
  ft: "Final",
  aet: "Final",
  pen: "Final",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

/**
 * Both teams of one match, with when it is in small print under them. The
 * format and the status are a click away.
 */
function MatchRows({ match, teams }: { match: SwissMatch; teams: Map<string, Team> }) {
  const format = useMatchTime();
  const decided = Boolean(match.winnerTeamId);
  const sides = [
    { id: match.homeTeamId, score: match.homeScore },
    { id: match.awayTeamId, score: match.awayScore },
  ].map((side) => ({ ...side, team: side.id ? teams.get(side.id) : undefined }));
  const played = sides.every((side) => side.score !== null && side.score !== undefined);
  const name = (side: (typeof sides)[number]) => side.team?.code ?? "TBD";

  return (
    <MatchHover
      className="flex flex-col gap-1 px-2.5 py-1.5"
      details={
        <>
          <span className="font-semibold">
            {played
              ? `${name(sides[0])} ${sides[0].score}–${sides[1].score} ${name(sides[1])}`
              : `${name(sides[0])} vs ${name(sides[1])}`}
          </span>
          {match.date && <span>{format.dayTime(match.date)}</span>}
          <span className="opacity-70">
            {[match.bestOf ? `Best of ${match.bestOf}` : null, STATUS_LABEL[match.status]]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </>
      }
    >
      {sides.map((side, i) => {
        const won = decided && side.id === match.winnerTeamId;
        return (
          <span key={i} className="flex items-center justify-between gap-2 text-xs">
            <BracketTeam team={side.team} muted={decided && !won} strong={won} />
            {side.score !== null && side.score !== undefined && (
              <Mono className={cn(won ? "font-semibold" : "text-muted-foreground")}>{side.score}</Mono>
            )}
            {i === 0 && match.status === "live" && (
              <>
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
                <span className="sr-only">, live</span>
              </>
            )}
          </span>
        );
      })}
      {match.date && <BracketDate>{bracketWhen(match.date, format)}</BracketDate>}
    </MatchHover>
  );
}

function ExitBox({ exit, teams }: { exit: SwissExit; teams: Map<string, Team> }) {
  const slots = Array.from({ length: exit.slots }, (_, i) => exit.teamIds[i]);
  return (
    <div
      role="group"
      aria-label={`${spoken(exit)}, ${exit.advanced ? "through" : "eliminated"}`}
      className={cn(
        "relative rounded-lg border px-2.5 py-1.5",
        exit.advanced ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5"
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <Mono className="text-xs font-semibold">{label(exit)}</Mono>
        <Eyebrow size="sm" as="span" className="text-foreground">
          {exit.advanced ? "Through" : "Out"}
        </Eyebrow>
      </header>
      <ul className="mt-1.5 flex flex-col gap-1 text-xs">
        {slots.map((id, i) => (
          <li key={id ?? `open-${i}`}>
            <BracketTeam team={id ? teams.get(id) : undefined} />
          </li>
        ))}
      </ul>
    </div>
  );
}
