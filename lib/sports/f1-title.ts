import type { F1Data } from "@/types/sports";

/** The most one driver can add in a race, and in a sprint. */
const DRIVER_MAX = { race: 25, sprint: 8 };
/** The most one team can add: its two cars first and second. */
const CONSTRUCTOR_MAX = { race: 25 + 18, sprint: 8 + 7 };

export type F1Champions = {
  /** The champion's code ("VER"), as `F1Driver.code`. */
  driver?: string;
  /** The champion's name, as `F1Constructor.name`. */
  constructorName?: string;
};

/**
 * Who has the title won, with the rounds still to score counted against them.
 *
 * A title is clinched when the leader's margin over second is MORE than the
 * most second could still add. Level on points is not clinched: countback
 * decides it, and that can still move. Once no round is left to score, the
 * table's first row is the champion, the feed having applied the countback.
 *
 * Scoring, the regulations from 2025 on:
 * - a race pays 25 to its winner and 18 to second, so a driver can add 25 and
 *   a team 43; there is no point for the fastest lap;
 * - a sprint pays 8 and 7, so a sprint weekend is worth 33 to a driver and 58
 *   to a team;
 * - a shortened race pays less, never more, so these are ceilings.
 *
 * What is "still to score" is read off the standings, not the calendar's
 * statuses: a race reads as completed hours before its points reach the
 * table, and a margin measured before a race against a calendar from after it
 * would crown somebody early. `standingsRound` is the last round the table
 * counts. Every round after it is open, sprint included. That round itself is
 * open too while its race has no winner: the table has moved for the sprint
 * alone, and the sprint is counted again rather than guessed at, which can
 * only delay the mark until the race. Without `standingsRound` (the sample
 * season) nobody is marked.
 */
export function f1Champions(data: F1Data): F1Champions {
  const counted = data.standingsRound;
  if (counted === undefined || data.races.length === 0) return {};

  let driverLeft = 0;
  let constructorLeft = 0;
  for (const race of data.races) {
    const open = race.round > counted || (race.round === counted && !race.winner);
    if (!open) continue;
    driverLeft += DRIVER_MAX.race + (race.sprint ? DRIVER_MAX.sprint : 0);
    constructorLeft += CONSTRUCTOR_MAX.race + (race.sprint ? CONSTRUCTOR_MAX.sprint : 0);
  }

  return {
    driver: clinched(data.drivers, driverLeft)?.code,
    constructorName: clinched(data.constructors, constructorLeft)?.name,
  };
}

function clinched<T extends { position: number; points: number }>(
  standings: T[],
  left: number,
): T | undefined {
  const [first, second] = [...standings].sort((a, b) => a.position - b.position);
  if (!first) return undefined;
  if (left === 0) return first;
  return first.points - (second?.points ?? 0) > left ? first : undefined;
}
