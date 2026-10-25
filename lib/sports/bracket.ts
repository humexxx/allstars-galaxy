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

/**
 * The round being played: the first with a tie whose two sides are known and
 * nobody has won yet. A bye is decided, and a slot still to fill is not
 * playable. Undefined once every tie is decided, or before anybody is drawn.
 */
export function roundInPlay(rounds: BracketRound[]): BracketRound | undefined {
  return rounds.find((round) =>
    round.matches.some((match) => !match.winnerTeamId && match.homeTeamId && match.awayTeamId),
  );
}
