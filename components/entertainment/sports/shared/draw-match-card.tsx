import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatWeekdayDay } from "@/lib/utils/date";
import type { BracketMatch, Team } from "@/types/sports";

import { BracketDate, MatchHover } from "./bracket-canvas";
import { Portrait } from "./portrait";

/**
 * One tie in a tennis draw.
 *
 * A racquet draw reads nothing like a football one. There is no aggregate and
 * no two legs — there is a seed, a flag, and a row of set scores, and the
 * winner is the name you want to find first. `BracketMatch.legs` carries the
 * sets: a set is exactly a leg with a different name.
 *
 * A player travels in the `teams` map, where `shortName` is the name, `code`
 * is the seed and `logoUrl` the photo, when there is one; the flag rides in
 * `primaryColor`'s place as an emoji on `name`. See `playerEntry` below for
 * the one place that shape is built.
 */
/**
 * A calendar day, read as a calendar day: a match is played on a date, not at
 * an instant, so only the `YYYY-MM-DD` part is used (`toDay` reads it local).
 */
function formatDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(day)) return day;
  return formatWeekdayDay(day.slice(0, 10));
}

export function DrawMatchCard({
  match,
  teams,
  withFaces = false,
  className,
}: {
  match: BracketMatch;
  teams: Map<string, Team>;
  /** Some player in the draw has a photo, so every row keeps a disc's width. */
  withFaces?: boolean;
  className?: string;
}) {
  const home = match.homeTeamId ? (teams.get(match.homeTeamId) ?? null) : null;
  const away = match.awayTeamId ? (teams.get(match.awayTeamId) ?? null) : null;
  const sets = match.legs ?? [];
  const decided = !!match.winnerTeamId;
  const played = sets.filter((s) => s.homeScore !== null && s.awayScore !== null);

  // The bracket's own box: the same border, padding, small print and hover
  // as every other tie in the hub.
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <MatchHover
        className="flex flex-col gap-1 px-2.5 py-1.5"
        details={
          <>
            <span className="font-semibold">
              {home?.shortName ?? "TBD"} vs {away?.shortName ?? "TBD"}
            </span>
            {match.date && <span>{formatDay(match.date)}</span>}
            {(played.length > 0 || decided) && (
              <span className="opacity-70">
                {[played.map((s) => `${s.homeScore}–${s.awayScore}`).join(" "), decided ? "Final" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </>
        }
      >
        <PlayerRow
          player={home}
          scores={sets.map((s) => s.homeScore)}
          opponentScores={sets.map((s) => s.awayScore)}
          isWinner={!!match.winnerTeamId && match.winnerTeamId === match.homeTeamId}
          decided={!!match.winnerTeamId}
          withFaces={withFaces}
        />
        <PlayerRow
          player={away}
          scores={sets.map((s) => s.awayScore)}
          opponentScores={sets.map((s) => s.homeScore)}
          isWinner={!!match.winnerTeamId && match.winnerTeamId === match.awayTeamId}
          decided={!!match.winnerTeamId}
          withFaces={withFaces}
        />
        {match.date && <BracketDate>{formatDay(match.date)}</BracketDate>}
      </MatchHover>
    </div>
  );
}

function PlayerRow({
  player,
  scores,
  opponentScores,
  isWinner,
  decided,
  withFaces,
}: {
  player: Team | null;
  scores: Array<number | null>;
  opponentScores: Array<number | null>;
  isWinner: boolean;
  decided: boolean;
  withFaces: boolean;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("shrink-0", withFaces ? "w-6" : "w-5")} />
        <span className="min-w-0 flex-1 truncate">TBD</span>
      </div>
    );
  }

  const seed = player.code?.trim();
  const flag = <span className="text-base leading-none">{player.name}</span>;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        decided && !isWinner && "text-muted-foreground"
      )}
    >
      {/* The flag sits where a crest would, at the same width, so two rows
          line up whether or not a player has one — and a photo, where there
          is one, at the width every row then keeps. */}
      {withFaces ? (
        <Portrait
          size="sm"
          subject={{ name: player.shortName, imageUrl: player.logoUrl, flagEmoji: player.name }}
          fallback={flag}
        />
      ) : (
        <span aria-hidden className="w-5 shrink-0 text-sm leading-none">
          {player.name}
        </span>
      )}
      <span className={cn("min-w-0 flex-1 truncate", isWinner && "font-semibold")}>
        {player.shortName}
      </span>
      {seed && (
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
          {seed}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-0.5">
        {scores.map((score, i) => (
          <Mono
            key={i}
            className={cn(
              "inline-flex size-4 items-center justify-center rounded-sm text-2xs tabular-nums",
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
 * `name` carries the flag, `shortName` the player, `code` the seed and
 * `logoUrl` the photo.
 */
export function playerEntry(
  id: string,
  name: string,
  flagEmoji: string,
  seed?: number,
  photoUrl?: string
): [string, Team] {
  return [
    id,
    { id, name: flagEmoji, shortName: name, code: seed ? `${seed}` : "", logoUrl: photoUrl },
  ];
}
