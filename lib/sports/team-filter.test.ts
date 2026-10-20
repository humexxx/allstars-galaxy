import { describe, expect, it } from "vitest";

import { teamFilterList } from "./team-filter";

describe("teamFilterList", () => {
  it("is the football league on screen", () => {
    expect(teamFilterList("football", "la-liga")).toEqual({ sportId: "football", competition: "la-liga" });
    expect(teamFilterList("football", "world-cup")).toEqual({
      sportId: "football",
      competition: "world-cup",
    });
  });

  it("is the sport's one list for the NBA and the NFL, whatever the league says", () => {
    expect(teamFilterList("nba", "premier-league")).toEqual({ sportId: "nba", competition: "nba" });
    expect(teamFilterList("nfl", "premier-league")).toEqual({ sportId: "nfl", competition: "nfl" });
  });

  it.each(["f1", "lol", "tennis", "padel"] as const)("is null for %s, which has no team filter", (sport) => {
    expect(teamFilterList(sport, "premier-league")).toBeNull();
  });
});
