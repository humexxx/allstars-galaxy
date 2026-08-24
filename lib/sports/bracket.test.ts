import { describe, expect, it } from "vitest";

import { isBracketDrawn } from "./bracket";
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
