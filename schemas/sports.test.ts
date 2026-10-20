import { describe, expect, it } from "vitest";

import { setSportCompetitionSchema, setSportTeamFilterSchema } from "./sports";

const valid = (sportId: string, competition: string | null): boolean =>
  setSportCompetitionSchema.safeParse({ sportId, competition }).success;

describe("setSportCompetitionSchema", () => {
  it.each([
    ["football", "uefa-champions-league"],
    ["football", "la-liga"],
    ["football", "premier-league"],
    ["football", "serie-a"],
    ["football", "world-cup"],
    ["lol", "worlds"],
    ["lol", "msi"],
    ["lol", "first-stand"],
    ["lol", "lck"],
    ["tennis", "atp"],
    ["tennis", "wta"],
    ["padel", "men"],
    ["padel", "women"],
  ])("accepts %s's %s", (sportId, competition) => {
    expect(valid(sportId, competition)).toBe(true);
  });

  it.each(["football", "lol", "tennis", "padel"])("accepts null for %s: the card's own pick", (sportId) => {
    expect(valid(sportId, null)).toBe(true);
  });

  it.each([
    ["tennis", "lck"],
    ["padel", "atp"],
    ["football", "men"],
    ["lol", "la-liga"],
  ])("refuses %s with another sport's %s", (sportId, competition) => {
    expect(valid(sportId, competition)).toBe(false);
  });

  it("refuses a championship nobody offers", () => {
    expect(valid("football", "bundesliga")).toBe(false);
    expect(valid("football", "")).toBe(false);
  });

  it.each(["nba", "nfl", "f1"])("refuses any choice for %s, which has none", (sportId) => {
    expect(valid(sportId, null)).toBe(false);
    expect(valid(sportId, "east")).toBe(false);
  });

  it("refuses an unknown sport and a missing championship", () => {
    expect(valid("cricket", null)).toBe(false);
    expect(setSportCompetitionSchema.safeParse({ sportId: "tennis" }).success).toBe(false);
  });
});

describe("setSportTeamFilterSchema", () => {
  const valid = (input: unknown): boolean => setSportTeamFilterSchema.safeParse(input).success;

  it.each([
    ["football", "premier-league"],
    ["football", "world-cup"],
    ["nba", "nba"],
    ["nfl", "nfl"],
  ])("accepts %s's %s list", (sportId, competition) => {
    expect(valid({ sportId, competition, teamIds: ["arsenal", "chelsea"] })).toBe(true);
  });

  it("accepts no teams: every team", () => {
    expect(valid({ sportId: "nba", competition: "nba", teamIds: [] })).toBe(true);
  });

  it.each([
    ["football", "nba"],
    ["football", "bundesliga"],
    ["nba", "nfl"],
    ["nfl", "premier-league"],
    ["f1", "f1"],
    ["lol", "worlds"],
  ])("refuses %s with %s, which is not one of its lists", (sportId, competition) => {
    expect(valid({ sportId, competition, teamIds: [] })).toBe(false);
  });

  it("refuses a blank team, an overlong one and more teams than any league has", () => {
    const list = { sportId: "nfl", competition: "nfl" };
    expect(valid({ ...list, teamIds: [" "] })).toBe(false);
    expect(valid({ ...list, teamIds: ["x".repeat(65)] })).toBe(false);
    expect(valid({ ...list, teamIds: Array.from({ length: 65 }, (_, i) => `t${i}`) })).toBe(false);
    expect(valid(list)).toBe(false);
  });
});
