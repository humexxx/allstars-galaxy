import { describe, expect, it } from "vitest";

import { isBracketDrawn, roundInPlay } from "./bracket";
import type { BracketRound } from "@/types/sports";

const round = (matches: Array<[string | null, string | null]>): BracketRound =>
  ({
    id: "r",
    label: "Round",
    matches: matches.map(([home, away], i) => ({
      id: `m${i}`,
      homeTeamId: home,
      awayTeamId: away,
    })),
  }) as unknown as BracketRound;

describe("isBracketDrawn", () => {
  it("is false when every slot is still empty", () => {
    // What LoL's provider returns before the split's playoffs are seeded: the
    // shape of the bracket with nobody in it. Rendering that put eight
    // identical TBD-vs-TBD cards down the page.
    expect(
      isBracketDrawn([round([[null, null], [null, null]]), round([[null, null]])])
    ).toBe(false);
  });

  it("is true as soon as one slot names somebody", () => {
    expect(isBracketDrawn([round([["g2", null]])])).toBe(true);
  });

  it("is false for no rounds at all", () => {
    expect(isBracketDrawn([])).toBe(false);
  });
});

describe("roundInPlay", () => {
  const decided = (home: string, away: string): BracketRound["matches"][number] => ({
    id: `${home}-${away}`,
    homeTeamId: home,
    awayTeamId: away,
    winnerTeamId: home,
  });

  it("is the first round with a tie both sides of which are known and undecided", () => {
    const first: BracketRound = { ...round([["a", "b"], ["c", "d"]]), label: "Semi-finals" };
    first.matches = [decided("a", "b"), first.matches[1]];
    const final: BracketRound = { ...round([["a", null]]), label: "Final" };
    expect(roundInPlay([first, final])?.label).toBe("Semi-finals");
  });

  it("passes over byes and slots still to fill, and is nothing once all is decided", () => {
    const bye = { ...round([["a", null]]), label: "Round of 64" };
    expect(roundInPlay([bye])).toBeUndefined();
    const done = { ...round([]), label: "Final", matches: [decided("a", "b")] };
    expect(roundInPlay([done])).toBeUndefined();
  });
});
