import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DashboardBracket as DashboardBracketData, DashboardBracketSide } from "@/types/sports";

import type { MatchTimeFormat } from "./shared/match-time";
import { TeamBadge } from "./shared/team-badge";

/**
 * An event's knockouts on its dashboard card, where another sport has its
 * table: a column a round, each tie its two sides with the score, the ties of
 * a round spread down the column so each sits between the two that fed it.
 *
 * Small on purpose — it shares a card with a lead box and the news. The
 * columns carry no heading (three columns ending in one tie read as a bracket
 * without one); a round's name and the day it was played are in each tie's
 * tooltip and its accessible name.
 */
export function DashboardBracket({
  bracket,
  format,
  hideLabel = false,
}: {
  bracket: DashboardBracketData;
  format: MatchTimeFormat;
  /** Inside a switch, whose control already names it. */
  hideLabel?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {!hideLabel && (
        <Eyebrow size="sm" asChild>
          <h3>{bracket.label}</h3>
        </Eyebrow>
      )}
      <ol
        role="list"
        aria-label={bracket.label}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${bracket.rounds.length}, minmax(0, 1fr))` }}
      >
        {bracket.rounds.map((round) => (
          <li key={round.label} className="min-w-0">
            <ul role="list" aria-label={round.label} className="flex h-full flex-col justify-around gap-1">
              {round.ties.map((tie) => {
                const when = tie.playedAt ? `${round.label} · ${format.shortDay(tie.playedAt)}` : round.label;
                return (
                  <li key={tie.id} title={when} className="flex flex-col rounded-md bg-muted/40 px-1.5 py-0.5">
                    <span className="sr-only">{when}: </span>
                    <BracketSide side={tie.home} decided={tie.decided} />
                    <BracketSide side={tie.away} decided={tie.decided} />
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BracketSide({ side, decided }: { side: DashboardBracketSide; decided: boolean }): React.ReactElement {
  const lost = decided && !side.winner;
  return (
    <span className={cn("flex h-5 items-center gap-1 text-2xs", lost && "text-muted-foreground")}>
      {side.flag !== undefined ? (
        side.flag && (
          <span aria-hidden className="shrink-0 leading-none">
            {side.flag}
          </span>
        )
      ) : (
        <TeamBadge
          team={{ name: side.name, shortName: side.name, code: side.code, primaryColor: side.color, logoUrl: side.logoUrl }}
          size="sm"
          className={cn("size-4", lost && "opacity-60")}
        />
      )}
      <span className={cn("min-w-0 flex-1 truncate", side.winner && "font-semibold")} title={side.name}>
        {side.code}
      </span>
      {side.score !== null && <Mono className={cn("text-2xs", side.winner && "font-semibold")}>{side.score}</Mono>}
    </span>
  );
}
