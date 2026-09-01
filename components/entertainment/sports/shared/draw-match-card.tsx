import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { BracketMatch, Team } from "@/types/sports";

/**
 * One tie in a tennis draw.
 *
 * A racquet draw reads nothing like a football one. There is no aggregate and
 * no two legs — there is a seed, a flag, and a row of set scores, and the
 * winner is the name you want to find first. `BracketMatch.legs` carries the
 * sets: a set is exactly a leg with a different name.
 *
 * A player travels in the `teams` map, where `shortName` is the name, `code`
 * is the seed and `logoUrl` is unused; the flag rides in `primaryColor`'s
 * place as an emoji on `name`. See `playerEntry` below for the one place that
 * shape is built.
 */
/**
 * A calendar day, read as a calendar day.
 *
 * `new Date("2025-09-05")` is UTC midnight, and anybody west of Greenwich then
 * renders it as the 4th. A match is played on a date, not at an instant.
 */
function formatDay(day: string): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DrawMatchCard({
  match,
  teams,
  className,
}: {
  match: BracketMatch;
  teams: Map<string, Team>;
  className?: string;
}) {
  const home = match.homeTeamId ? (teams.get(match.homeTeamId) ?? null) : null;
  const away = match.awayTeamId ? (teams.get(match.awayTeamId) ?? null) : null;
  const sets = match.legs ?? [];

  return (
    <div className={cn("rounded-lg border bg-card p-3 text-sm", className)}>
      <div className="flex flex-col gap-1.5">
        <PlayerRow
          player={home}
          scores={sets.map((s) => s.homeScore)}
          opponentScores={sets.map((s) => s.awayScore)}
          isWinner={!!match.winnerTeamId && match.winnerTeamId === match.homeTeamId}
          decided={!!match.winnerTeamId}
        />
        <PlayerRow
          player={away}
          scores={sets.map((s) => s.awayScore)}
          opponentScores={sets.map((s) => s.homeScore)}
          isWinner={!!match.winnerTeamId && match.winnerTeamId === match.awayTeamId}
          decided={!!match.winnerTeamId}
        />
      </div>
      {match.date && (
        <div className="mt-2 border-t pt-1.5 text-2xs text-muted-foreground">
          {formatDay(match.date)}
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  scores,
  opponentScores,
  isWinner,
  decided,
}: {
  player: Team | null;
  scores: Array<number | null>;
  opponentScores: Array<number | null>;
  isWinner: boolean;
  decided: boolean;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">TBD</span>
      </div>
    );
  }

  const seed = player.code?.trim();
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        decided && !isWinner && "text-muted-foreground"
      )}
    >
      {/* The flag sits where a crest would, at the same width, so two rows
          line up whether or not a player has one. */}
      <span aria-hidden className="w-5 shrink-0 text-base leading-none">
        {player.name}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", isWinner && "font-semibold")}>
        {player.shortName}
      </span>
      {seed && (
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
          {seed}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1">
        {scores.map((score, i) => (
          <Mono
            key={i}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-sm text-xs tabular-nums",
              // The set a player won is the one worth finding at a glance.
              score !== null &&
                opponentScores[i] !== null &&
                score > (opponentScores[i] as number)
                ? "bg-muted font-semibold text-foreground"
                : "text-muted-foreground"
            )}
          >
            {score ?? "–"}
          </Mono>
        ))}
      </span>
    </div>
  );
}

/**
 * A player in the shape the bracket's `teams` map expects.
 *
 * The map is typed for teams, so the fields are reused rather than widened:
 * `name` carries the flag, `shortName` the player, `code` the seed.
 */
export function playerEntry(
  id: string,
  name: string,
  flagEmoji: string,
  seed?: number
): [string, Team] {
  return [id, { id, name: flagEmoji, shortName: name, code: seed ? `${seed}` : "" }];
}
