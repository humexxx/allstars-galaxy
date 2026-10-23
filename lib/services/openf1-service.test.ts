import { afterEach, describe, expect, it, vi } from "vitest";

import { __testing } from "./openf1-service";

const { clock, gapText, nameOf, sessionRows, fetchWeekendResults } = __testing;

// Trimmed from OpenF1's own answers for the 2026 United States GP weekend.
const DRIVERS = new Map([
  [16, { driver_number: 16, name_acronym: "LEC", first_name: "Charles", last_name: "Leclerc", team_name: "Ferrari", team_colour: "E8002D" }],
  [12, { driver_number: 12, name_acronym: "ANT", first_name: "Andrea Kimi", last_name: "Antonelli", team_name: "Mercedes", team_colour: "27F4D2" }],
  [3, { driver_number: 3, name_acronym: "VER", first_name: "Max", last_name: "Verstappen", team_name: "Red Bull Racing", team_colour: "3671C6" }],
  [1, { driver_number: 1, name_acronym: "NOR", first_name: "Lando", last_name: "Norris", team_name: "McLaren", team_colour: "F47600" }],
]);

const FP2 = [
  { position: 2, driver_number: 12, number_of_laps: 25, duration: 95.333, gap_to_leader: 0.042 },
  { position: 1, driver_number: 16, number_of_laps: 30, duration: 95.291, gap_to_leader: 0 },
  { position: 3, driver_number: 3, number_of_laps: 24, duration: 95.48, gap_to_leader: 0.189 },
];

describe("clock", () => {
  it("reads a lap as m:ss.mmm and a race as h:mm:ss.mmm", () => {
    expect(clock(95.291)).toBe("1:35.291");
    expect(clock(59.5)).toBe("0:59.500");
    expect(clock(5599.273)).toBe("1:33:19.273");
  });
});

describe("gapText", () => {
  it("signs a gap in seconds, and keeps laps in words", () => {
    expect(gapText(0.042)).toBe("+0.042");
    expect(gapText(27.092)).toBe("+27.092");
    expect(gapText("+2 LAPS")).toBe("+2 laps");
    expect(gapText("+1 LAP")).toBe("+1 lap");
  });

  it("is nothing for the leader or a car without one", () => {
    expect(gapText(0)).toBeUndefined();
    expect(gapText(null)).toBeUndefined();
  });
});

describe("nameOf", () => {
  it("is the initial and the surname, or the car's number without a driver", () => {
    expect(nameOf(DRIVERS.get(16), 16)).toBe("C. Leclerc");
    expect(nameOf(DRIVERS.get(12), 12)).toBe("A. Antonelli");
    expect(nameOf(undefined, 43)).toBe("#43");
  });
});

describe("sessionRows", () => {
  it("orders a practice by position: the best lap each, a gap behind the fastest", () => {
    expect(sessionRows("fp2", FP2, DRIVERS)).toEqual([
      { position: "1", code: "LEC", name: "C. Leclerc", team: "Ferrari", teamColor: "#E8002D", laps: 30, time: "1:35.291" },
      { position: "2", code: "ANT", name: "A. Antonelli", team: "Mercedes", teamColor: "#27F4D2", laps: 25, time: "1:35.333", gap: "+0.042" },
      { position: "3", code: "VER", name: "M. Verstappen", team: "Red Bull Racing", teamColor: "#3671C6", laps: 24, time: "1:35.480", gap: "+0.189" },
    ]);
  });

  it("gives each car in qualifying the last part it reached", () => {
    const rows = sessionRows(
      "qualifying",
      [
        { position: 1, driver_number: 12, duration: [88.653, 88.289, 87.798], gap_to_leader: [0, 0.173, 0] },
        { position: 2, driver_number: 3, duration: [89.099, 88.116, 87.964], gap_to_leader: [0.446, 0, 0.166] },
        { position: 18, driver_number: 1, duration: [89.9, null, null], gap_to_leader: [1.247, null, null] },
      ],
      DRIVERS
    );
    expect(rows.map((r) => [r.position, r.code, r.time, r.gap, r.segment])).toEqual([
      ["1", "ANT", "1:27.798", undefined, "Q3"],
      ["2", "VER", "1:27.964", "+0.166", "Q3"],
      ["18", "NOR", "1:29.900", "+1.247", "Q1"],
    ]);
  });

  it("times only a race's winner; the rest are gaps, laps behind or out", () => {
    const rows = sessionRows(
      "race",
      [
        { position: 1, driver_number: 12, number_of_laps: 57, duration: 5599.273, gap_to_leader: 0 },
        { position: 2, driver_number: 1, number_of_laps: 57, duration: 5602.537, gap_to_leader: 3.264 },
        { position: 18, driver_number: 3, number_of_laps: 55, duration: null, gap_to_leader: "+2 LAPS" },
        { position: null, driver_number: 16, number_of_laps: 7, dnf: true, duration: null, gap_to_leader: null },
      ],
      DRIVERS
    );
    expect(rows.map((r) => [r.position, r.code, r.time, r.gap])).toEqual([
      ["1", "ANT", "1:33:19.273", undefined],
      ["2", "NOR", undefined, "+3.264"],
      ["18", "VER", undefined, "+2 laps"],
      ["DNF", "LEC", undefined, undefined],
    ]);
  });
});

describe("fetchWeekendResults", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown): Response =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("asks only for the sessions that are over, in order, and skips one with nothing in", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        urls.push(url);
        if (url.includes("/sessions?")) {
          return Promise.resolve(
            json([
              { session_key: 11391, session_name: "Practice 3", date_start: "2026-10-24T17:30:00+00:00", date_end: "2026-10-24T18:30:00+00:00", meeting_key: 1297 },
              { session_key: 11390, session_name: "Practice 2", date_start: "2026-10-23T21:00:00+00:00", date_end: "2026-10-23T22:00:00+00:00", meeting_key: 1297 },
              { session_key: 11389, session_name: "Practice 1", date_start: "2026-10-23T17:30:00+00:00", date_end: "2026-10-23T18:30:00+00:00", meeting_key: 1297 },
              { session_key: 9999, session_name: "Day 1", date_start: "2026-10-23T09:00:00+00:00", date_end: "2026-10-23T10:00:00+00:00", meeting_key: 1297 },
            ])
          );
        }
        if (url.includes("/drivers?")) return Promise.resolve(json([...DRIVERS.values()]));
        if (url.includes("session_key=11390")) return Promise.resolve(json(FP2));
        return Promise.resolve(json([]));
      })
    );

    const weekend = await fetchWeekendResults(
      2026,
      19,
      "2026-10-23T17:30:00Z",
      "2026-10-25T20:00:00Z",
      Date.parse("2026-10-24T03:00:00Z")
    );

    expect(urls[0]).toContain("/sessions?year=2026&date_start%3E=2026-10-23T05:30:00.000Z&date_start%3C=2026-10-26T08:00:00.000Z");
    expect(urls[1]).toContain("/drivers?meeting_key=1297");
    // Practice 3 is tomorrow and "Day 1" is no session of a race weekend.
    expect(urls.slice(2)).toEqual([
      expect.stringContaining("session_key=11389"),
      expect.stringContaining("session_key=11390"),
    ]);
    // Practice 1 came back empty and is left out.
    expect(weekend).toEqual({
      season: 2026,
      round: 19,
      sessions: [{ kind: "fp2", rows: sessionRows("fp2", FP2, DRIVERS) }],
    });
  });

  it("makes one call before the first session: there is nothing to read yet", async () => {
    const spy = vi.fn(() =>
      Promise.resolve(
        json([{ session_key: 11389, session_name: "Practice 1", date_start: "2026-10-23T17:30:00+00:00", date_end: "2026-10-23T18:30:00+00:00", meeting_key: 1297 }])
      )
    );
    vi.stubGlobal("fetch", spy);

    const weekend = await fetchWeekendResults(2026, 19, "2026-10-23T17:30:00Z", "2026-10-25T20:00:00Z", Date.parse("2026-10-22T12:00:00Z"));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(weekend.sessions).toEqual([]);
  });
});
