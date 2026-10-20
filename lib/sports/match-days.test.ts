import { describe, expect, it } from "vitest";

import type { Match } from "@/types/sports";

import { matchDays } from "./match-days";

const match = (id: string, kickoff: string, home = "a", away = "b"): Match => ({
  id,
  homeTeamId: home,
  awayTeamId: away,
  homeScore: null,
  awayScore: null,
  kickoff,
  status: "scheduled",
});

describe("matchDays", () => {
  const list = [
    match("late", "2026-10-21T19:00:00Z", "rma", "bar"),
    match("night", "2026-10-21T01:30:00Z", "psg", "bay"),
    match("early", "2026-10-20T16:45:00Z", "liv", "rma"),
  ];

  it("groups by the reader's day, oldest first, each day in kickoff order", () => {
    // 01:30 UTC on the 21st is still the 20th in Costa Rica (UTC−6).
    expect(matchDays(list, "America/Costa_Rica").map((d) => [d.day, d.matches.map((m) => m.id)])).toEqual([
      ["2026-10-20", ["early", "night"]],
      ["2026-10-21", ["late"]],
    ]);
    expect(matchDays(list, "UTC").map((d) => [d.day, d.matches.map((m) => m.id)])).toEqual([
      ["2026-10-20", ["early"]],
      ["2026-10-21", ["night", "late"]],
    ]);
  });

  it("narrows to one team's matches, home or away", () => {
    expect(matchDays(list, "UTC", "rma").flatMap((d) => d.matches.map((m) => m.id))).toEqual([
      "early",
      "late",
    ]);
  });
});
