import { describe, expect, it } from "vitest";

import { SINGLE_LIST_SPORTS } from "@/types/sports";

import { teamFilterList } from "./team-filter";

describe("teamFilterList", () => {
  it("is the football league on screen", () => {
    expect(teamFilterList("football", "la-liga")).toEqual({ sportId: "football", competition: "la-liga" });
    expect(teamFilterList("football", "world-cup")).toEqual({
      sportId: "football",
      competition: "world-cup",
    });
  });

  it.each(SINGLE_LIST_SPORTS)("is the sport's one list for %s, whatever the league says", (sport) => {
    expect(teamFilterList(sport, "premier-league")).toEqual({ sportId: sport, competition: sport });
  });

  it.each(["f1", "lol", "tennis", "padel", "surf"] as const)("is null for %s, which has no team filter", (sport) => {
    expect(teamFilterList(sport, "premier-league")).toBeNull();
  });
});
