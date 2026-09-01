import { describe, expect, it } from "vitest";

import { __testing } from "./espn-f1-standings-service";

const { stat, teamCode } = __testing;

const entry = (stats: Array<[string, string]>) => ({
  stats: stats.map(([name, displayValue]) => ({ name, displayValue })),
});

describe("stat", () => {
  it("takes the first name that is there", () => {
    // The two tables disagree: a driver's total is `championshipPts` and a
    // constructor's is `points`. Reading one gave the other a column of zeroes.
    expect(stat(entry([["championshipPts", "242"]]), "championshipPts", "points")).toBe(242);
    expect(stat(entry([["points", "425"]]), "points", "championshipPts")).toBe(425);
  });

  it("is zero when neither name is there", () => {
    expect(stat(entry([["rank", "1"]]), "points")).toBe(0);
  });
});

describe("teamCode", () => {
  it("takes three letters from a one-word name", () => {
    // ESPN's `abbreviation` for a constructor is driver initials — Mercedes
    // came back as "LP" — so the name is the only field that describes it.
    expect(teamCode("Mercedes")).toBe("MER");
    expect(teamCode("Ferrari")).toBe("FER");
  });

  it("takes initials from a multi-word one", () => {
    expect(teamCode("Red Bull Racing")).toBe("RBR");
  });

  it("has nothing to say about a missing name", () => {
    expect(teamCode(undefined)).toBeUndefined();
  });
});
