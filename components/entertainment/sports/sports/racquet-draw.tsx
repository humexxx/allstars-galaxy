"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarClock, EyeOff, RotateCw, Trophy } from "lucide-react";

import { getRacquetDrawAction } from "@/app/actions/racquet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { racquetDrawSchema } from "@/schemas/racquet";
import type {
  BracketRound,
  DrawState,
  DrawVariant,
  RacquetSport,
  RacquetTournament,
  Team,
} from "@/types/sports";

import { DrawMatchCard } from "../shared/draw-match-card";
import { KnockoutBracket } from "../shared/knockout-bracket";

/**
 * The draws asked for so far, by tournament, and the call that loads one: the
 * current tournament's, when the feed could not ship it.
 *
 * Kept for the life of the view, so it is asked for once — the server caches
 * too, but each miss there spends a provider's daily budget.
 */
export function useRacquetDraws(sport: RacquetSport): {
  draws: Record<string, DrawState>;
  load: (tournamentId: string) => void;
} {
  const [draws, setDraws] = useState<Record<string, DrawState>>({});

  const load = useCallback(
    (tournamentId: string): void => {
      const set = (state: DrawState): void => setDraws((prev) => ({ ...prev, [tournamentId]: state }));
      // The schema the action applies, checked here first: the fixture's ids
      // ("wpt-m-rome") would only come back refused.
      const request = racquetDrawSchema.safeParse({ sport, tournamentId });
      if (!request.success) {
        set({ status: "unavailable" });
        return;
      }
      set({ status: "loading" });
      getRacquetDrawAction(request.data)
        .then((result): DrawState =>
          result.success ? { status: "ready", draw: result.data } : { status: "error" }
        )
        .catch((): DrawState => ({ status: "error" }))
        .then(set);
    },
    [sport]
  );

  return { draws, load };
}

/**
 * One draw as a bracket: a column per round, each tie in the racquet card.
 * Tennis pages through a Grand Slam's seven rounds four at a time; padel's
 * draw already starts at the round of 16.
 */
export function RacquetBracket({
  rounds,
  players,
  variant,
}: {
  rounds: BracketRound[];
  players: Map<string, Team>;
  variant: DrawVariant;
}) {
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
}: {
  tournament: RacquetTournament;
  state: DrawState;
  variant: DrawVariant;
  /** Offered when the draw failed to load; a draw that came with the page has nothing to retry. */
  onRetry?: () => void;
}) {
  const players = useMemo(
    () =>
      new Map(state.status === "ready" ? state.draw.players.map((p) => [p.id, p] as const) : []),
    [state]
  );

  switch (state.status) {
    case "pending":
      return <NotDrawnYet />;
    case "loading":
      return <DrawSkeleton />;
    case "error":
      return (
        <EmptyState
          icon={Trophy}
          title="The draw could not be loaded"
          description="The results service did not answer. It usually does on a second try."
          action={
            onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCw />
                Try again
              </Button>
            )
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
function ChampionsOnly({ champion, runnerUp }: { champion?: string; runnerUp?: string }) {
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
        <Trophy className="size-4 shrink-0 text-warning" aria-label="Champions" />
        <Text as="span" weight="semibold">
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

function DrawSkeleton() {
  return (
    <div role="status" aria-label="Loading the draw" className="grid grid-cols-2 items-center gap-3">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className="h-14" />
    </div>
  );
}
