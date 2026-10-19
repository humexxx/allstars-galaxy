import { describe, expect, it } from "vitest";

import { setSportCompetitionSchema } from "./sports";

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
