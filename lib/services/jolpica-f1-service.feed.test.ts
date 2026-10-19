import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";

import { getF1CircuitWinner, getF1Data, getF1RaceClassification } from "./jolpica-f1-service";

// Its own file: the rate limiter lives in the module, and these tests run on
// a fake clock that must not meet the real timestamps of another file's calls.

const driver = (code: string, givenName = code, familyName = code) => ({
  driverId: code.toLowerCase(),
  code,
  givenName,
  familyName,
  nationality: "Dutch",
});
const team = (name: string) => ({ constructorId: name.toLowerCase(), name });
const row = (position: string, code: string, teamName: string, extra: object = {}) => ({
  position,
  positionText: position,
  points: "0",
  grid: position,
  laps: "56",
  status: "Finished",
  Driver: driver(code),
  Constructor: team(teamName),
  ...extra,
});

const circuit = (circuitId: string, country: string) => ({
  circuitId,
  circuitName: circuitId,
  Location: { locality: circuitId, country },
});
const shanghai = {
  season: "2026",
  round: "2",
  raceName: "Chinese Grand Prix",
  date: "2026-03-15",
  time: "07:00:00Z",
  Circuit: circuit("shanghai", "China"),
  Sprint: { date: "2026-03-14", time: "03:00:00Z" },
};
const austin = {
  season: "2026",
  round: "18",
  raceName: "United States Grand Prix",
  date: "2026-10-25",
  time: "20:00:00Z",
  Circuit: circuit("americas", "USA"),
  Qualifying: { date: "2026-10-24", time: "21:00:00Z" },
};

const races = (list: object[]) => ({ MRData: { RaceTable: { season: "2026", Races: list } } });
const standings = (key: string, list: object[]) => ({
  MRData: { StandingsTable: { StandingsLists: [{ season: "2026", round: "17", [key]: list }] } },
});

const PAYLOADS: Record<string, unknown> = {
  "/current.json": races([shanghai, austin]),
  "/current/driverStandings.json": standings("DriverStandings", [
    { position: "1", points: "300", wins: "6", Driver: driver("VER"), Constructors: [team("Red Bull")] },
  ]),
  "/current/constructorStandings.json": standings("ConstructorStandings", [
    { position: "1", points: "500", wins: "8", Constructor: team("Red Bull") },
  ]),
  "/current/results/1.json?limit=100": races([
    { ...shanghai, Results: [row("1", "VER", "Red Bull", { Time: { time: "1:32:11.902" } })] },
  ]),
  "/2026/results/2.json?limit=100": races([
    { ...shanghai, Results: [row("2", "LEC", "Ferrari", { Time: { time: "+5.402" } })] },
  ]),
  "/2026/results/3.json?limit=100": races([
    { ...shanghai, Results: [row("3", "NOR", "McLaren", { Time: { time: "+11.237" } })] },
  ]),
  "/2026/qualifying/1.json?limit=100": races([
    {
      ...shanghai,
      QualifyingResults: [
        { position: "1", Driver: driver("RUS"), Q1: "1:33.3", Q2: "1:32.4", Q3: "1:32.064" },
        { position: "4", Driver: driver("LEC"), Q1: "1:33.1" },
      ],
    },
  ]),
  "/2026/fastest/1/results.json?limit=100": races([
    {
      ...shanghai,
      Results: [row("2", "LEC", "Ferrari", { FastestLap: { rank: "1", lap: "52", Time: { time: "1:33.418" } } })],
    },
  ]),
  "/2026/sprint/1.json?limit=100": races([{ ...shanghai, SprintResults: [row("1", "RUS", "Mercedes")] }]),
  "/2026/2/results.json?limit=100": races([
    {
      ...shanghai,
      Results: [
        row("1", "VER", "Red Bull", { points: "25", Time: { time: "1:32:11.902" } }),
        { ...row("20", "STR", "Aston Martin", { laps: "30", status: "Retired" }), positionText: "R" },
      ],
    },
  ]),
  "/2026/18/results.json?limit=100": races([]),
  "/2025/circuits/americas/results/1.json": races([
    { ...austin, season: "2025", Results: [row("1", "VER", "Red Bull")] },
  ]),
  "/2025/circuits/madring/results/1.json": races([]),
};

const BASE = "https://api.jolpi.ca/ergast/f1";
const starts: number[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  starts.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (!input.startsWith(BASE)) throw new Error("ESPN is not under test");
      starts.push(Date.now());
      const payload = PAYLOADS[input.slice(BASE.length)];
      return payload
        ? new Response(JSON.stringify(payload), { status: 200 })
        : new Response("not found", { status: 404 });
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests")))
  );
});

async function settle<T>(pending: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return pending;
}

describe("getF1Data", () => {
  it("fills each race's weekend and results from one refresh", async () => {
    const data = await settle(getF1Data());
    expect(data).not.toBe(F1_DATA);

    const [china, usa] = data.races;
    expect(china).toMatchObject({
      status: "completed",
      sprint: true,
      country: "China",
      podium: ["VER", "LEC", "NOR"],
      podiumGaps: ["+5.402", "+11.237"],
      winner: { code: "VER", time: "1:32:11.902" },
      pole: { code: "RUS", time: "1:32.064" },
      fastestLap: { code: "LEC", lap: 52, time: "1:33.418" },
      sprintWinner: { code: "RUS", team: "Mercedes" },
    });
    expect(usa).toMatchObject({ status: "upcoming", startsAt: "2026-10-25T20:00:00.000Z" });
    expect(usa.sessions?.map((s) => s.kind)).toEqual(["qualifying", "race"]);
  });

  it("never starts more than four Jolpica calls inside the limit's window", async () => {
    await settle(getF1Data());
    expect(starts).toHaveLength(9);
    for (const [i, start] of starts.entries()) {
      expect(starts.filter((t) => t >= start && t < start + 1_200).length, `from call ${i}`).toBeLessThanOrEqual(4);
    }
  });
});

describe("getF1RaceClassification", () => {
  it("maps the whole field of a finished race", async () => {
    const classification = await settle(getF1RaceClassification(2026, 2));
    expect(classification?.rows.map((r) => [r.position, r.code, r.result])).toEqual([
      ["1", "VER", "1:32:11.902"],
      ["DNF", "STR", "Retired"],
    ]);
  });

  it("is nothing while the results are not in", async () => {
    await expect(settle(getF1RaceClassification(2026, 18))).resolves.toBeNull();
  });
});

describe("getF1CircuitWinner", () => {
  it("finds last season's winner at the circuit, and nobody at a new one", async () => {
    await expect(settle(getF1CircuitWinner(2025, "americas"))).resolves.toEqual({
      season: 2025,
      code: "VER",
      name: "V. VER",
      team: "Red Bull",
    });
    await expect(settle(getF1CircuitWinner(2025, "madring"))).resolves.toBeNull();
  });
});
