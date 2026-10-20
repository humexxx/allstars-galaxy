import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leadRace, racesTabGroups } from "@/lib/sports/f1-weekend";
import type { F1Data } from "@/types/sports";

// Its own file: the rate limiter lives in the module, and these tests run on
// a fake clock that must not meet the real timestamps of another file's calls.
// For the same reason each test imports the module afresh: they set the clock
// back, and a limiter still holding the last test's calls would make them wait.
type Service = typeof import("./jolpica-f1-service");
let service: Service;
let F1_DATA: F1Data;

// unstable_cache as it behaves on a stale entry: every read refreshes, and a
// refresh that throws leaves the last good answer in place. Only a key never
// stored lets the error out, to the feed's fallback.
const cache = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  reads: [] as Array<{ key: string; revalidate: number }>,
}));

vi.mock("next/cache", () => ({
  unstable_cache:
    <Args extends unknown[], T>(
      fn: (...args: Args) => Promise<T>,
      keyParts: string[],
      options: { revalidate: number }
    ) =>
    async (...args: Args): Promise<T> => {
      const key = `${keyParts.join(",")}:${JSON.stringify(args)}`;
      cache.reads.push({ key, revalidate: options.revalidate });
      try {
        const value = await fn(...args);
        cache.entries.set(key, JSON.parse(JSON.stringify(value)));
        return value;
      } catch (error) {
        if (cache.entries.has(key)) return cache.entries.get(key) as T;
        throw error;
      }
    },
}));

// Each call's deadline, on the fake clock.
vi.mock("./upstream", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./upstream")>()),
  upstreamSignal: (): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), 8_000);
    return controller.signal;
  },
}));

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
  "/current/results/2.json?limit=100": races([
    { ...shanghai, Results: [row("2", "LEC", "Ferrari", { Time: { time: "+5.402" } })] },
  ]),
  "/current/results/3.json?limit=100": races([
    { ...shanghai, Results: [row("3", "NOR", "McLaren", { Time: { time: "+11.237" } })] },
  ]),
  "/current/qualifying/1.json?limit=100": races([
    {
      ...shanghai,
      QualifyingResults: [
        { position: "1", Driver: driver("RUS"), Q1: "1:33.3", Q2: "1:32.4", Q3: "1:32.064" },
        { position: "4", Driver: driver("LEC"), Q1: "1:33.1" },
      ],
    },
  ]),
  "/current/fastest/1/results.json?limit=100": races([
    {
      ...shanghai,
      Results: [row("2", "LEC", "Ferrari", { FastestLap: { rank: "1", lap: "52", Time: { time: "1:33.418" } } })],
    },
  ]),
  "/current/sprint/1.json?limit=100": races([{ ...shanghai, SprintResults: [row("1", "RUS", "Mercedes")] }]),
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
  "/2025/results/1.json?limit=100": races([
    { ...austin, round: "19", season: "2025", Results: [row("1", "VER", "Red Bull")] },
  ]),
};

const BASE = "https://api.jolpi.ca/ergast/f1";
const starts: number[] = [];
/** Paths Jolpica answers 429 to. */
const refused = new Set<string>();

function jolpica(input: string): Response {
  const path = input.slice(BASE.length);
  if (refused.has(path)) return new Response("slow down", { status: 429 });
  const payload = PAYLOADS[path];
  return payload
    ? new Response(JSON.stringify(payload), { status: 200 })
    : new Response("not found", { status: 404 });
}

beforeEach(async () => {
  vi.resetModules();
  service = await import("./jolpica-f1-service");
  ({ F1_DATA } = await import("@/lib/data/sports/f1"));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  starts.length = 0;
  refused.clear();
  cache.entries.clear();
  cache.reads.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (!input.startsWith(BASE)) throw new Error("ESPN is not under test");
      starts.push(Date.now());
      return jolpica(input);
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
  it("fills each race's weekend and results from one read", async () => {
    const data = await settle(service.getF1Data());
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
    expect(data.drivers[0]).toMatchObject({ code: "VER", podiums: 1 });
  });

  it("never starts more than four Jolpica calls inside the limit's window", async () => {
    await settle(service.getF1Data());
    expect(starts).toHaveLength(9);
    for (const [i, start] of starts.entries()) {
      expect(starts.filter((t) => t >= start && t < start + 1_200).length, `from call ${i}`).toBeLessThanOrEqual(4);
    }
  });

  it("asks for everything at once, so no call waits on another's answer", async () => {
    const t0 = Date.now();
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (!String(input).startsWith(BASE)) throw new Error("ESPN is not under test");
      starts.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      return jolpica(String(input));
    });
    await settle(service.getF1Data());
    // Only the rate limit spaces them: the last starts long before the first answers.
    expect(Math.max(...starts) - t0).toBeLessThan(3_000);
  });

  it("gives up on a Jolpica that never answers inside one deadline, queue included", async () => {
    const t0 = Date.now();
    vi.mocked(fetch).mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) reject(signal.reason);
          signal?.addEventListener("abort", () => reject(signal.reason));
        })
    );
    await expect(settle(service.getF1Data())).resolves.toBe(F1_DATA);
    // Nine calls queue up to 2.4s for a slot; that wait spends the same 8s.
    expect(Date.now() - t0).toBe(8_000);
  });

  it("moves each race on from the status its cache entry was stored with", async () => {
    // Read on the Saturday of Austin, then nothing answers until Monday: the
    // Saturday entries are all there is.
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    await settle(service.getF1Data());
    vi.mocked(fetch).mockRejectedValue(new Error("Jolpica is down"));

    const monday = Date.parse("2026-10-26T20:00:00Z");
    vi.setSystemTime(monday);
    const data = await settle(service.getF1Data(monday));

    expect(data).not.toBe(F1_DATA);
    const usa = data.races.find((r) => r.round === 18);
    expect(usa?.status).toBe("completed");
    // Over, and nothing on the calendar after it: it is the last race run,
    // never the next one.
    expect(racesTabGroups(data.races)).toMatchObject({ featured: undefined, comingUp: [] });
    expect(racesTabGroups(data.races).justFinished.map((r) => r.round)).toEqual([18, 2]);
    expect(leadRace(data.races)?.status).toBe("completed");
  });

  it("keeps a list's last answer through a refresh it fails, without losing the rest", async () => {
    await settle(service.getF1Data());
    refused.add("/current/qualifying/1.json?limit=100");
    refused.add("/current/results/1.json?limit=100");

    const [china] = (await settle(service.getF1Data())).races;

    expect(china).toMatchObject({
      podium: ["VER", "LEC", "NOR"],
      winner: { code: "VER" },
      pole: { code: "RUS" },
      fastestLap: { code: "LEC" },
    });
  });

  it("still serves the season when a list has never answered, only without it", async () => {
    refused.add("/current/qualifying/1.json?limit=100");

    const data = await settle(service.getF1Data());

    expect(data).not.toBe(F1_DATA);
    expect(data.races[0].pole).toBeUndefined();
    expect(data.races[0]).toMatchObject({ podium: ["VER", "LEC", "NOR"], fastestLap: { code: "LEC" } });
  });

  it("leaves out a list still holding another season's rounds", async () => {
    PAYLOADS["/current/sprint/1.json?limit=100"] = races([
      { ...shanghai, season: "2025", SprintResults: [row("1", "PIA", "McLaren")] },
    ]);
    try {
      const [china] = (await settle(service.getF1Data())).races;
      expect(china.sprintWinner).toBeUndefined();
    } finally {
      PAYLOADS["/current/sprint/1.json?limit=100"] = races([
        { ...shanghai, SprintResults: [row("1", "RUS", "Mercedes")] },
      ]);
    }
  });
});

describe("getF1RaceClassification", () => {
  const classificationReads = (): Array<{ key: string; revalidate: number }> =>
    cache.reads.filter((r) => r.key.startsWith("jolpica:f1-classification"));

  it("maps the whole field of a finished race", async () => {
    const classification = await settle(service.getF1RaceClassification(2026, 2));
    expect(classification?.rows.map((r) => [r.position, r.code, r.result])).toEqual([
      ["1", "VER", "1:32:11.902"],
      ["DNF", "STR", "Retired"],
    ]);
  });

  it("is nothing while the results are not in", async () => {
    await expect(settle(service.getF1RaceClassification(2026, 18))).resolves.toBeNull();
  });

  it("keeps a race on the feed's five minutes until the stewards are done with it", async () => {
    const sundayNight = Date.parse("2026-10-26T02:00:00Z");
    await settle(service.getF1RaceClassification(2026, 18, sundayNight));
    expect(classificationReads().at(-1)?.revalidate).toBe(300);

    // Three days on, the result has settled.
    await settle(service.getF1RaceClassification(2026, 18, sundayNight + 3 * 24 * 60 * 60_000));
    expect(classificationReads().at(-1)?.revalidate).toBe(86_400);
  });

  it("holds a race from months ago, or from a past season, for a day", async () => {
    await settle(service.getF1RaceClassification(2026, 2));
    await settle(service.getF1RaceClassification(2025, 19));
    expect(classificationReads().map((r) => r.revalidate)).toEqual([86_400, 86_400]);
  });

  it("reads a race the calendar cannot place as recent", async () => {
    await settle(service.getF1RaceClassification(2026, 30));
    expect(classificationReads().at(-1)?.revalidate).toBe(300);
  });
});

describe("getF1SeasonWinners", () => {
  it("names the winner at each circuit of the season, from one call", async () => {
    const winners = await settle(service.getF1SeasonWinners(2025));
    expect(winners).toEqual({
      americas: { season: 2025, code: "VER", name: "V. VER", team: "Red Bull" },
    });
    expect(winners.madring).toBeUndefined();
    expect(starts).toHaveLength(1);
  });

  it("has nobody when Jolpica does not answer", async () => {
    refused.add("/2025/results/1.json?limit=100");
    await expect(settle(service.getF1SeasonWinners(2025))).resolves.toEqual({});
  });
});
