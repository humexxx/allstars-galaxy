import type { BracketRound } from "@/types/sports";

/**
 * Has anybody actually qualified into this bracket?
 *
 * A provider will happily hand back the shape of a playoff before the draw is
 * made — LoL returns eight TBD-vs-TBD slots — and rendering that looks like a
 * broken view rather than a tournament that has not started.
 */
export function isBracketDrawn(rounds: BracketRound[]): boolean {
  return rounds.some((round) =>
    round.matches.some((match) => match.homeTeamId || match.awayTeamId),
  );
}
