import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatWeekdayDay } from "@/lib/utils/date";
import type { BracketMatch, Team } from "@/types/sports";

import { BracketDate, bracketWhen, MatchHover } from "./bracket-canvas";
import { Portrait } from "./portrait";
import { useMatchTime } from "./time-zone-context";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const OUTCOMES: Record<NonNullable<BracketMatch["outcome"]>, string> = {
  walkover: "Walkover",
  retired: "Retired",
};

/**
 * "6–4", or "7–6(1)" for a set that went to a tie-break — the loser's points,
 * the way a scoreline prints them. The boxes have no room for it; the
 * tooltip does.
 */
function setLabel(set: NonNullable<BracketMatch["legs"]>[number]): string {
  const base = `${set.homeScore}–${set.awayScore}`;
  const home = set.homeScore ?? 0;
  const away = set.awayScore ?? 0;
  const tiebreak = home < away ? set.homeTiebreak : away < home ? set.awayTiebreak : null;
  return tiebreak !== null && tiebreak !== undefined ? `${base}(${tiebreak})` : base;
}

/**
 * One tie in a racquet draw.
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
 *
 * `variant="pair"` is a padel tie: two players a side, both surnames stacked
 * (`shortName` is "Coello / Tapia"), a seed and the sets — no flag, since the
 * provider sends no nationality, and no photo.
 */
export function DrawMatchCard({
  match,
  teams,
  withFaces = false,
  variant = "player",
  className,
}: {
  match: BracketMatch;
  teams: Map<string, Team>;
  /** Some player in the draw has a photo, so every row keeps a disc's width. */
  withFaces?: boolean;
  variant?: "player" | "pair";
  className?: string;
}) {
  const format = useMatchTime();
  const home = match.homeTeamId ? (teams.get(match.homeTeamId) ?? null) : null;
  const away = match.awayTeamId ? (teams.get(match.awayTeamId) ?? null) : null;
  const sets = match.legs ?? [];
  const decided = !!match.winnerTeamId;
  const played = sets.filter((s) => s.homeScore !== null && s.awayScore !== null);
  const outcome = match.outcome ? OUTCOMES[match.outcome] : null;

  // A calendar day — tennis dates a match by its day — stays the day it names
  // (`toDay` reads it local, never as UTC midnight); an instant, padel's
  // schedule, is the day and time in the reader's zone.
  const date = match.date;
  const isDay = date !== undefined && DATE_ONLY.test(date);
  const when = !date ? null : isDay ? formatWeekdayDay(date) : bracketWhen(date, format);
  const whenInFull = !date ? null : isDay ? when : format.dayTime(date);

  // The bracket's own box: the same border, padding, small print and hover
  // as every other tie in the hub.
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <MatchHover
        className="flex flex-col gap-1 px-2.5 py-1.5"
        details={
          <>
            <span className="font-semibold">
              {(variant === "pair" ? home?.name : home?.shortName) ?? "TBD"} vs{" "}
              {(variant === "pair" ? away?.name : away?.shortName) ?? "TBD"}
            </span>
            {whenInFull && <span>{whenInFull}</span>}
            {(played.length > 0 || decided) && (
              <span className="opacity-70">
                {[played.map(setLabel).join(" "), outcome ?? (decided ? "Final" : null)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </>
        }
      >
        {[
          { player: home, side: "home" as const },
          { player: away, side: "away" as const },
        ].map(({ player, side }) => {
          const other = side === "home" ? "away" : "home";
          const props = {
            player,
            scores: sets.map((s) => s[`${side}Score`]),
            opponentScores: sets.map((s) => s[`${other}Score`]),
            isWinner: decided && match.winnerTeamId === (side === "home" ? match.homeTeamId : match.awayTeamId),
            decided,
          };
          return variant === "pair" ? (
            <PairRow key={side} {...props} />
          ) : (
            <PlayerRow key={side} {...props} withFaces={withFaces} />
          );
        })}
        {(when || outcome) && (
          <BracketDate>{[when, outcome].filter(Boolean).join(" · ")}</BracketDate>
        )}
      </MatchHover>
    </div>
  );
}

type RowProps = {
  player: Team | null;
  scores: Array<number | null>;
  opponentScores: Array<number | null>;
  isWinner: boolean;
  decided: boolean;
};

function SetScores({ scores, opponentScores }: Pick<RowProps, "scores" | "opponentScores">) {
  return (
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
  );
}

function Seed({ player }: { player: Team }) {
  const seed = player.code?.trim();
  if (!seed) return null;
  return <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{seed}</span>;
}

function PlayerRow({
  player,
  scores,
  opponentScores,
  isWinner,
  decided,
  withFaces,
}: RowProps & { withFaces: boolean }) {
  if (!player) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("shrink-0", withFaces ? "w-6" : "w-5")} />
        <span className="min-w-0 flex-1 truncate">TBD</span>
      </div>
    );
  }

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
      <Seed player={player} />
      <SetScores scores={scores} opponentScores={opponentScores} />
    </div>
  );
}

/** A padel pair: both surnames stacked, so neither is cut off in a narrow column. */
function PairRow({ player, scores, opponentScores, isWinner, decided }: RowProps) {
  if (!player) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">TBD</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        decided && !isWinner && "text-muted-foreground"
      )}
    >
      <span className={cn("flex min-w-0 flex-1 flex-col", isWinner && "font-semibold")}>
        {player.shortName.split(" / ").map((name, i) => (
          <span key={i} className="truncate leading-tight">
            {name}
          </span>
        ))}
      </span>
      <Seed player={player} />
      <SetScores scores={scores} opponentScores={opponentScores} />
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
