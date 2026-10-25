"use client";

import { useMemo } from "react";
import { CalendarClock, EyeOff, RotateCw, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { BracketRound, DrawState, DrawVariant, RacquetTournament, Team } from "@/types/sports";

import { DrawMatchCard } from "../shared/draw-match-card";
import { KnockoutBracket } from "../shared/knockout-bracket";

/** One draw as a bracket: a column per round, each tie in the racquet card. */
function RacquetBracket({
  rounds,
  players,
  variant,
}: {
  rounds: BracketRound[];
  players: Map<string, Team>;
  variant: DrawVariant;
}): React.ReactElement {
  // Only ranked players come with a photo, so most draws are a mix. Once any
  // player in this draw has one, every row reserves a disc's width and the
  // names line up. A padel pair has two.
  const withFaces = useMemo(
    () =>
      rounds.some((round) =>
        round.matches.some((m) =>
          [m.homeTeamId, m.awayTeamId].some((id) => {
            const entry = id ? players.get(id) : undefined;
            return variant === "pair" ? entry?.photos?.some(Boolean) : entry?.logoUrl;
          })
        )
      ),
    [rounds, players, variant]
  );

  return (
    <KnockoutBracket
      rounds={rounds}
      teams={players}
      // Two faces take the room the surnames had at 11rem.
      minColumnWidth={variant === "pair" && withFaces ? "13rem" : "11rem"}
      renderMatch={(match, teams) => (
        <DrawMatchCard match={match} teams={teams} withFaces={withFaces} variant={variant} />
      )}
    />
  );
}

/** Whatever there is to show of a tournament's draw, in each of its states. */
export function DrawBody({
  tournament,
  state,
  variant,
  onRetry,
  retrying = false,
}: {
  tournament: RacquetTournament;
  state: DrawState;
  variant: DrawVariant;
  onRetry: () => void;
  /** A retry is on its way: the button says so and keeps its focus. */
  retrying?: boolean;
}): React.ReactElement {
  const players = useMemo(
    () =>
      new Map(state.status === "ready" ? state.draw.players.map((p) => [p.id, p] as const) : []),
    [state]
  );

  switch (state.status) {
    case "pending":
      return <NotDrawnYet />;
    case "error":
      return (
        <EmptyState
          icon={Trophy}
          title="The draw could not be loaded"
          description="The results service did not answer. It usually does on a second try."
          action={
            <>
              {/* aria-disabled, not disabled: a disabled button drops its focus. */}
              <Button
                variant="outline"
                size="sm"
                aria-disabled={retrying || undefined}
                onClick={() => {
                  if (!retrying) onRetry();
                }}
              >
                <RotateCw className={cn(retrying && "motion-safe:animate-spin")} />
                Try again
              </Button>
              <span role="status" className="sr-only">
                {retrying ? "Checking for the draw…" : ""}
              </span>
            </>
          }
        />
      );
    case "unavailable":
      return <EmptyState icon={Trophy} title="This draw is not available" />;
    case "ready": {
      const { draw } = state;
      const champion = draw.champion ?? tournament.champion;
      const runnerUp = draw.runnerUp ?? tournament.runnerUp;
      if (draw.resultsHidden) {
        return <ChampionsOnly champion={champion} runnerUp={runnerUp} />;
      }
      if (draw.rounds.length === 0) {
        if (tournament.status === "upcoming") return <NotDrawnYet />;
        if (tournament.status === "live") {
          return <EmptyState icon={Trophy} title="The draw has not been published" />;
        }
        return champion ? (
          <ChampionsOnly champion={champion} runnerUp={runnerUp} />
        ) : (
          <EmptyState icon={Trophy} title="No draw was published for this tournament" />
        );
      }
      return <RacquetBracket rounds={draw.rounds} players={players} variant={variant} />;
    }
  }
}

function NotDrawnYet() {
  return (
    <EmptyState
      icon={CalendarClock}
      title="The draw is not out yet"
      description="It is published a day or two before play starts."
    />
  );
}

/**
 * An old padel draw: the free plan withholds results older than about six
 * months, but the tournament still names its champions.
 */
function ChampionsOnly({ champion, runnerUp }: { champion?: string; runnerUp?: string }): React.ReactElement {
  if (!champion) {
    return (
      <EmptyState
        icon={EyeOff}
        title="The results are no longer available"
        description="Match results are only kept for about six months."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Trophy aria-hidden className="size-4 shrink-0 text-warning" />
        <Text as="span" weight="semibold">
          <span className="sr-only">Champions: </span>
          {champion}
        </Text>
      </div>
      {runnerUp && <Text variant="muted">Beat {runnerUp} in the final</Text>}
      <Text variant="small">
        Match results are only kept for about six months, so the rest of this draw is gone.
      </Text>
    </div>
  );
}
