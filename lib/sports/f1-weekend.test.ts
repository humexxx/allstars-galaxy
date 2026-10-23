import { describe, expect, it } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import type { F1Race } from "@/types/sports";

import {
  isRaceWeekend,
  leadRace,
  raceSessions,
  racesTabGroups,
  startsIn,
  weekendNow,
  weekendPhrase,
  weekendWindow,
} from "./f1-weekend";

// Austin 2026 as Jolpica lists it, a normal weekend.
const austin: F1Race = {
  id: "r-18",
  round: 18,
  name: "United States Grand Prix",
  circuit: "Circuit of the Americas",
  circuitId: "americas",
  location: "Austin",
  country: "USA",
  flagEmoji: "🇺🇸",
  date: "2026-10-25",
  startsAt: "2026-10-25T20:00:00.000Z",
  status: "upcoming",
  sessions: [
    { kind: "fp1", startsAt: "2026-10-23T17:30:00.000Z" },
    { kind: "fp2", startsAt: "2026-10-23T21:00:00.000Z" },
    { kind: "fp3", startsAt: "2026-10-24T17:30:00.000Z" },
    { kind: "qualifying", startsAt: "2026-10-24T21:00:00.000Z" },
    { kind: "race", startsAt: "2026-10-25T20:00:00.000Z" },
  ],
};

const at = (iso: string): number => Date.parse(iso);

describe("weekendNow", () => {
  it("has nothing live and practice next a week out", () => {
    expect(weekendNow(austin, at("2026-10-18T12:00:00Z"))).toEqual({
      next: { kind: "fp1", startsAt: "2026-10-23T17:30:00.000Z" },
    });
  });

  it("marks the session on track and the one after it", () => {
    const state = weekendNow(austin, at("2026-10-24T21:30:00Z"));
    expect(state.live?.kind).toBe("qualifying");
    expect(state.next?.kind).toBe("race");
  });

  it("calls the race live for three hours, red flags included", () => {
    expect(weekendNow(austin, at("2026-10-25T22:30:00Z")).live?.kind).toBe("race");
    expect(weekendNow(austin, at("2026-10-25T23:30:00Z"))).toEqual({});
  });

  it("falls back to the race alone when there is no timetable", () => {
    const bare = { ...austin, sessions: undefined };
    expect(raceSessions(bare)).toEqual([{ kind: "race", startsAt: austin.startsAt }]);
    expect(raceSessions({ ...bare, startsAt: undefined })).toEqual([]);
  });
});

describe("startsIn", () => {
  const now = at("2026-10-24T12:00:00Z");
  it.each([
    ["2026-10-24T12:00:20Z", "in 1m"],
    ["2026-10-24T12:45:00Z", "in 45m"],
    ["2026-10-24T15:00:00Z", "in 3h"],
    ["2026-10-26T11:00:00Z", "in 47h"],
    ["2026-10-30T12:00:00Z", "in 6d"],
  ])("%s → %s", (startsAt, text) => {
    expect(startsIn(startsAt, now)).toBe(text);
  });
});

describe("weekendPhrase", () => {
  it("names the next session and how far off it is", () => {
    expect(weekendPhrase(austin, at("2026-10-24T18:30:00Z"))).toEqual({
      text: "Qualifying in 3h",
      tone: "soon",
    });
    expect(weekendPhrase(austin, at("2026-10-18T12:00:00Z"))).toEqual({
      text: "Practice 1 in 5d",
      tone: "later",
    });
  });

  it("says which session is live", () => {
    expect(weekendPhrase(austin, at("2026-10-23T18:00:00Z"))).toEqual({
      text: "Practice 1 live",
      tone: "live",
    });
  });

  it("has nothing to say once the race is over", () => {
    expect(weekendPhrase(austin, at("2026-10-26T12:00:00Z"))).toBeNull();
  });
});

describe("isRaceWeekend", () => {
  it("runs from the first session to the end of the race", () => {
    expect(isRaceWeekend(austin, at("2026-10-23T17:00:00Z"))).toBe(false);
    expect(isRaceWeekend(austin, at("2026-10-24T08:00:00Z"))).toBe(true);
    expect(isRaceWeekend(austin, at("2026-10-26T00:00:00Z"))).toBe(false);
  });
});

describe("leadRace", () => {
  it("prefers the race on now over the next one", () => {
    const races = F1_DATA.races.map((r) => (r.round === 8 ? { ...r, status: "live" as const } : r));
    expect(leadRace(races)?.round).toBe(8);
  });

  it("takes the next race, else the last one run", () => {
    expect(leadRace(F1_DATA.races)?.round).toBe(7);
    const over = F1_DATA.races.map((r) => ({ ...r, status: "completed" as const }));
    expect(leadRace(over)?.round).toBe(10);
    expect(leadRace([])).toBeUndefined();
  });
});

describe("racesTabGroups", () => {
  it("features the next race, then the three after it and the three just run", () => {
    const groups = racesTabGroups(F1_DATA.races);
    expect(groups.featured?.round).toBe(7);
    expect(groups.comingUp.map((r) => r.round)).toEqual([8, 9, 10]);
    expect(groups.justFinished.map((r) => r.round)).toEqual([6, 5, 4]);
  });

  it("has no featured race once the season is over", () => {
    const over = F1_DATA.races.map((r) => ({ ...r, status: "completed" as const }));
    const groups = racesTabGroups(over);
    expect(groups.featured).toBeUndefined();
    expect(groups.comingUp).toEqual([]);
    expect(groups.justFinished.map((r) => r.round)).toEqual([10, 9, 8]);
  });
});

describe("weekendWindow", () => {
  it("runs from the first session to the race", () => {
    expect(weekendWindow(austin)).toEqual({
      from: austin.sessions![0].startsAt,
      to: austin.sessions![austin.sessions!.length - 1].startsAt,
    });
  });

  it("is nothing before the first session: OpenF1 has no results yet", () => {
    const first = Date.parse(austin.sessions![0].startsAt);
    expect(weekendWindow(austin, first - 1)).toBeNull();
    expect(weekendWindow(austin, first + 1)).not.toBeNull();
  });

  it("is nothing for a race with no times", () => {
    expect(weekendWindow({ ...austin, sessions: undefined, startsAt: undefined })).toBeNull();
  });
});
