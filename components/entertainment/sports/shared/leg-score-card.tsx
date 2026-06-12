import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { BracketMatch, Team } from "@/types/sports";

import { TeamBadge } from "./team-badge";

type LegScoreCardProps = {
  match: BracketMatch;
  teams: Map<string, Team>;
  className?: string;
};

/**
 * Two-legged bracket card (UCL knockout style). Shows L1 / L2 score columns and
 * an aggregate line at the bottom.
 */
export function LegScoreCard({ match, teams, className }: LegScoreCardProps) {
  const home = match.homeTeamId ? teams.get(match.homeTeamId) ?? null : null;
  const away = match.awayTeamId ? teams.get(match.awayTeamId) ?? null : null;
  const legs = match.legs ?? [];
  const hasLegs = legs.length > 0;
  const hasAggregate =
    match.aggregateHome !== undefined &&
    match.aggregateAway !== undefined &&
    match.aggregateHome !== null &&
    match.aggregateAway !== null;

  // Two-legged ties (UCL knockout) carry per-leg scores; single best-of series
  // (LoL playoffs, NFL playoffs) carry homeScore/awayScore directly. Fall back
  // to a single score column for the latter so the card never hides the result.
  const homeScores = hasLegs
    ? legs.map((l) => l.homeScore)
    : match.homeScore !== undefined && match.homeScore !== null
      ? [match.homeScore]
      : [];
  const awayScores = hasLegs
    ? legs.map((l) => l.awayScore)
    : match.awayScore !== undefined && match.awayScore !== null
      ? [match.awayScore]
      : [];

  return (
    <div className={cn("rounded-lg border bg-card p-3 text-sm", className)}>
      {hasLegs && (
        <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-x-3">
          <span />
          {legs.map((_, idx) => (
            <span
              key={idx}
              className="inline-flex h-5 w-6 items-center justify-center rounded-full bg-muted text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              L{idx + 1}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <LegRow
          team={home}
          scores={homeScores}
          isWinner={match.winnerTeamId === match.homeTeamId}
        />
        <LegRow
          team={away}
          scores={awayScores}
          isWinner={match.winnerTeamId === match.awayTeamId}
        />
      </div>
      {hasAggregate && (
        <div className="mt-2 border-t pt-1.5 text-2xs text-muted-foreground">
          Aggregate: {match.aggregateHome} - {match.aggregateAway}
        </div>
      )}
      {!hasAggregate && match.date && (
        <div className="mt-2 border-t pt-1.5 text-2xs text-muted-foreground">
          {new Date(match.date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}

function LegRow({
  team,
  scores,
  isWinner,
}: {
  team: Team | null;
  scores: Array<number | null>;
  isWinner: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3">
      <div className="flex min-w-0 items-center gap-2">
        {team ? (
          <>
            <TeamBadge team={team} size="sm" />
            <span className={cn("min-w-0 truncate", isWinner && "font-semibold")}>
              {team.code}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">TBD</span>
        )}
      </div>
      {scores.map((score, idx) => (
        <Mono
          key={idx}
          className={cn(
            "w-6 text-right text-sm tabular-nums",
            isWinner ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {score === null ? "—" : score}
        </Mono>
      ))}
    </div>
  );
}
