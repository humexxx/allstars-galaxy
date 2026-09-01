import { existsSync } from "node:fs";
import { join } from "node:path";

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

describe("teamLogo", () => {
  it("maps the names ESPN actually reports", () => {
    expect(__testing.teamLogo("Mercedes")).toBe("/f1/teams/mercedes.png");
    // ESPN says "Red Bull"; the logo file is named for the full entrant.
    expect(__testing.teamLogo("Red Bull")).toBe("/f1/teams/red-bull-racing.png");
    expect(__testing.teamLogo("Racing Bulls")).toBe("/f1/teams/racing-bulls.png");
    expect(__testing.teamLogo("  aston martin ")).toBe("/f1/teams/aston-martin.png");
  });

  it("gives nothing for a team with no logo published, so the badge falls back", () => {
    // Both joined the grid for 2026 and F1 has published no mark for them.
    expect(__testing.teamLogo("Audi")).toBeUndefined();
    expect(__testing.teamLogo("Cadillac")).toBeUndefined();
    expect(__testing.teamLogo(undefined)).toBeUndefined();
  });
});

describe("the vendored logo files", () => {
  it("exist for every team the map claims one for", () => {
    // The map returning a path proves nothing about the file being there, and
    // a renamed asset would fail silently as a blank badge.
    const teams = ["Mercedes", "Ferrari", "McLaren", "Red Bull", "Racing Bulls",
                   "Alpine", "Haas", "Williams", "Aston Martin"];
    for (const team of teams) {
      const url = __testing.teamLogo(team);
      expect(url, team).toBeDefined();
      expect(existsSync(join(process.cwd(), "public", url!)), url).toBe(true);
    }
  });
});
