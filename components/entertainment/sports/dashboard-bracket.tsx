import { Eyebrow } from "@/components/ui/typography";
import type { DashboardBracket as DashboardBracketData } from "@/types/sports";

import { BracketTie } from "./dashboard-bracket-tie";
import type { MatchTimeFormat } from "./shared/match-time";

/**
 * An event's knockouts on its dashboard card, where another sport has its
 * table: a column a round, each tie its two sides with the score, the ties of
 * a round spread down the column so each sits between the two that fed it.
 *
 * Small on purpose — it shares a card with a lead box and the news. The
 * columns carry no heading (three columns ending in one tie read as a bracket
 * without one); each tie's tooltip says the round, the day it was played and
 * the two sides by their full names, and its accessible name the first two.
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
                // Past four ties a column draws each on one line, or it would be twice the height.
                return <BracketTie key={tie.id} tie={tie} when={when} oneLine={round.ties.length > 4} />;
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
